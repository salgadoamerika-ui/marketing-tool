import assert from 'node:assert/strict';
import { test } from 'node:test';
import { firstRunStorageKey, shouldOfferFirstRun, validateFirstRun } from '../src/lib/first-run.ts';

const sampleIds = ['mosaic:Sample service', 'northline:Sample service'];
const store = (values = {}) => ({ getItem: (key) => values[key] ?? null });
const serialized = (key, data) => ({ [key]: JSON.stringify(data) });

test('a blank device is eligible, and auto-saved sample services do not block setup', () => {
  assert.equal(shouldOfferFirstRun(store(), sampleIds), true);
  assert.equal(shouldOfferFirstRun(store(serialized('marketing-tool.services',
    sampleIds.map((id) => ({ id, mode: 'evergreen' })))), sampleIds), true);
});

test('completion and skipping persistently suppress setup even with no business yet', () => {
  for (const result of ['completed', 'skipped']) {
    assert.equal(shouldOfferFirstRun(store({ [firstRunStorageKey]: result }), sampleIds), false);
  }
});

test('real businesses, posts, and custom services are existing user data', () => {
  for (const data of [
    serialized('marketing-tool.businesses', [{ id: 'real-business' }]),
    serialized('marketing-tool.user-posts', [{ id: 'real-post', businessId: 'mosaic' }]),
    serialized('marketing-tool.services', [{ id: 'real-service', mode: 'evergreen' }]),
    serialized('marketing-tool.services', [{ id: sampleIds[0], mode: 'campaign' }]),
    serialized('marketing-tool.services', [{ id: sampleIds[0], mode: 'evergreen', platforms: ['TikTok'] }]),
    serialized('marketing-tool.services', [{ id: sampleIds[0], mode: 'evergreen', tone: 'sage' }]),
    serialized('marketing-tool.services', [{ id: sampleIds[0], businessId: 'mosaic', name: 'My renamed service', mode: 'evergreen' }]),
  ]) assert.equal(shouldOfferFirstRun(store(data), sampleIds), false);
});

test('malformed or inaccessible saved data never gets treated as a blank account', () => {
  for (const value of ['invalid JSON', '{}', 'null']) {
    assert.equal(shouldOfferFirstRun(store({ 'marketing-tool.businesses': value }), sampleIds), false);
  }
  assert.equal(shouldOfferFirstRun({ getItem() { throw new Error('Storage unavailable'); } }, sampleIds), false);
});

test('customized content/platform catalogs are existing data, not disposable samples', () => {
  assert.equal(shouldOfferFirstRun(store(serialized('marketing-tool.business-content-settings', {
    mosaic: { contentTypes: ['My own content type'] },
  })), sampleIds), false);
  assert.equal(shouldOfferFirstRun(store(serialized('marketing-tool.platform-options', ['Instagram', 'LinkedIn'])), sampleIds), false);
  assert.equal(shouldOfferFirstRun(store(serialized('marketing-tool.business-content-settings', {
    mosaic: { contentTypeAliases: { Announcement: null } },
  })), sampleIds), false);
  assert.equal(shouldOfferFirstRun(store(serialized('marketing-tool.business-content-settings', {
    mosaic: { selectedPlatforms: ['Instagram'] },
  })), sampleIds), false);
});

const today = '2031-04-15';
const platforms = ['Facebook', 'Instagram', 'TikTok'];
const types = ['Announcement', 'Insight'];
const draft = {
  businessName: 'Willow Studio',
  serviceName: 'Tax preparation', mode: 'evergreen', deadline: '',
  platforms: ['Instagram'], contentType: 'Announcement', date: today, isCompleted: false,
};

test('a Service needs no deadline and can seed a planned or already-posted move', () => {
  assert.equal(validateFirstRun(draft, platforms, types, today), undefined);
  assert.equal(validateFirstRun({ ...draft, date: '2031-04-12', isCompleted: true }, platforms, types, today), undefined);
});

test('Campaigns require a real future deadline and keep their first move inside it', () => {
  for (const deadline of ['', '2031-02-30', '2031-04-14']) {
    assert.match(validateFirstRun({ ...draft, mode: 'campaign', deadline }, platforms, types, today), /deadline/);
  }
  assert.equal(validateFirstRun({ ...draft, mode: 'campaign', deadline: today }, platforms, types, today), undefined);
  assert.match(validateFirstRun({
    ...draft, mode: 'campaign', deadline: today, date: '2031-04-16',
  }, platforms, types, today), /on or before/);
});

test('missing service, platform, content type, or valid calendar day is rejected', () => {
  for (const change of [
    { businessName: '  ' }, { serviceName: '  ' }, { platforms: [] }, { platforms: ['Unavailable'] },
    { contentType: 'Deleted type' }, { date: '2031-02-30' },
  ]) assert.equal(typeof validateFirstRun({ ...draft, ...change }, platforms, types, today), 'string');
});
