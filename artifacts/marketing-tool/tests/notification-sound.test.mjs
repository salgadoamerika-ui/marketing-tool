import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NotificationSoundInbox,
  SoftNotificationChime,
  isAttentionNotification,
  parseSoundPreference,
  performanceAttentionKey,
} from '../src/lib/notification-sound.ts';

const insight = (id, extra = {}) => ({
  id, businessId: 'mosaic', kind: 'insight', attentionEventKey: `pattern:${id}`,
  title: 'A measured pattern', subtitle: 'Three results', icon: 'sparkle', createdAt: 100, isRead: false, ...extra,
});
const wake = (id, extra = {}) => ({
  ...insight(id), attentionEventKey: undefined, kind: 'campaign-wakeup', dedupeKey: `season:${id}`,
  action: { kind: 'campaign-wakeup', campaignId: 'summer', cycleKey: '2027', startDate: '2027-06-01', endDate: '2027-08-31' },
  ...extra,
});

test('sound defaults on and a saved mute remains off', () => {
  assert.equal(parseSoundPreference(null), true);
  assert.equal(parseSoundPreference('true'), true);
  assert.equal(parseSoundPreference('false'), false);
});

test('ordinary actions, dismissed banners, and restart confirmations never qualify', () => {
  assert.equal(isAttentionNotification(insight('quiet', { attentionEventKey: undefined })), false);
  for (const kind of ['plan-change', 'dismissed-banner']) {
    assert.equal(isAttentionNotification(insight('quiet', { kind })), false);
  }
  assert.equal(isAttentionNotification(wake('due')), true);
  assert.equal(isAttentionNotification(wake('later', { bannerDismissed: true })), false);
  assert.equal(isAttentionNotification(wake('restarted', { action: undefined })), false);
  assert.equal(isAttentionNotification(insight('gated')), true);
});

test('hydration, read changes, re-renders, duplicate events, and business switching are silent', () => {
  const saved = insight('saved');
  const inbox = new NotificationSoundInbox([saved]);
  assert.equal(inbox.receive([saved], 'mosaic'), false);
  assert.equal(inbox.receive([{ ...saved, isRead: true }], 'mosaic'), false);
  const fresh = insight('fresh');
  assert.equal(inbox.receive([fresh, saved], 'mosaic'), true);
  assert.equal(inbox.receive([fresh, saved], 'mosaic'), false);
  assert.equal(inbox.receive([insight('new-id', { attentionEventKey: fresh.attentionEventKey })], 'mosaic'), false);
  const other = insight('other', { businessId: 'northline' });
  assert.equal(inbox.receive([other], 'mosaic'), false);
  assert.equal(inbox.receive([other], 'northline'), false);
  assert.equal(inbox.receive([insight('batch-1'), insight('batch-2')], 'mosaic'), true);
});

test('the same performance alert has one identity across source actions, isolated by service and business', () => {
  const alert = { title: 'Standout reach', evidence: '900 views', recommendation: 'Keep the topic.' };
  assert.equal(performanceAttentionKey('mosaic', 'Tax', alert), performanceAttentionKey('mosaic', 'Tax', { ...alert }));
  assert.notEqual(performanceAttentionKey('mosaic', 'Tax', alert), performanceAttentionKey('mosaic', 'Law', alert));
  assert.notEqual(performanceAttentionKey('mosaic', 'Tax', alert), performanceAttentionKey('northline', 'Tax', alert));
});

function audioStub() {
  const starts = [];
  const stops = [];
  const ramps = [];
  const context = {
    state: 'running', currentTime: 4, destination: {},
    createOscillator: () => ({
      frequency: { setValueAtTime() {} },
      connect() {}, disconnect() {},
      start: (time) => starts.push(time), stop: (time) => stops.push(time),
    }),
    createGain: () => ({
      gain: {
        setValueAtTime() {},
        linearRampToValueAtTime: (value, time) => ramps.push([value, time]),
        exponentialRampToValueAtTime() {},
      },
      connect() {}, disconnect() {},
    }),
    resume: () => Promise.resolve(),
    close: () => Promise.resolve(),
  };
  return { context, starts, stops, ramps };
}

test('one soft sub-second chime per burst, never before interaction or overlapping another chime', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  const audio = audioStub();
  const chime = new SoftNotificationChime(() => audio.context);
  chime.notify();
  t.mock.timers.tick(200);
  assert.equal(audio.starts.length, 0);
  chime.unlock();
  assert.equal(audio.starts.length, 0);
  chime.notify(); chime.notify(); chime.notify();
  t.mock.timers.tick(180);
  assert.equal(audio.starts.length, 2, 'two quiet harmonics form one chime');
  assert.ok(audio.stops.every((time) => time - audio.context.currentTime < 1));
  assert.ok(audio.ramps.every(([gain]) => gain <= 0.065));
  chime.notify(); t.mock.timers.tick(200);
  assert.equal(audio.starts.length, 2);
  t.mock.timers.tick(1200);
  chime.notify(); t.mock.timers.tick(180);
  assert.equal(audio.starts.length, 4);
  chime.dispose();
});

test('mute cancels pending audio; unmuting and unlocking never replay an old event', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  const audio = audioStub();
  const chime = new SoftNotificationChime(() => audio.context);
  chime.unlock(); chime.notify(); chime.setEnabled(false);
  t.mock.timers.tick(500);
  assert.equal(audio.starts.length, 0);
  chime.notify(); t.mock.timers.tick(500);
  chime.setEnabled(true); chime.unlock(); t.mock.timers.tick(500);
  assert.equal(audio.starts.length, 0);
  chime.notify(); chime.dispose(); t.mock.timers.tick(500);
  assert.equal(audio.starts.length, 0);
});

test('missing Web Audio and browser autoplay rejection are harmless', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const create of [
    () => undefined,
    () => { throw new Error('Audio unavailable'); },
    () => ({ state: 'suspended', resume: () => Promise.reject(new Error('NotAllowedError')), close: () => Promise.resolve() }),
  ]) {
    const chime = new SoftNotificationChime(create);
    assert.doesNotThrow(() => { chime.unlock(); chime.notify(); t.mock.timers.tick(200); chime.dispose(); });
  }
  await Promise.resolve();
});
