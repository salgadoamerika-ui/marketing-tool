import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadServices, modeLabel, normalizeService, validateService } from '../src/lib/services.ts';
import { buildActionInsight } from '../src/lib/action-insight.ts';

const ongoing = { id: 'mosaic:Insurance', businessId: 'mosaic', name: 'Insurance', mode: 'evergreen' };
const campaign = { ...ongoing, mode: 'campaign', startDate: '2026-09-01', endDate: '2026-10-02' };

test('only plain user-facing labels leave the internal mode model', () => {
  assert.equal(modeLabel('evergreen'), 'Service');
  assert.equal(modeLabel('campaign'), 'Campaign');
});
test('existing entries become Services without manufacturing deadlines', () => {
  assert.deepEqual(loadServices(null, [ongoing, ongoing]), [ongoing]);
  assert.deepEqual(normalizeService({ id: ongoing.id, businessId: ongoing.businessId, name: ongoing.name }), ongoing);
});
test('campaign dates are required, validated, and permit historical and same-day campaigns', () => {
  assert.equal(validateService(campaign), undefined);
  assert.ok(validateService({ ...campaign, startDate: '' }));
  assert.ok(validateService({ ...campaign, endDate: '2026-02-30' }));
  assert.ok(validateService({ ...campaign, endDate: '2026-08-31' }));
  assert.equal(validateService({ ...campaign, endDate: campaign.startDate }), undefined);
});
test('switching back to Service removes both dates, not just the displayed inputs', () => {
  assert.deepEqual(normalizeService({ ...campaign, mode: 'evergreen' }), ongoing);
});
test('service platforms and calendar colors survive saved-service hydration', () => {
  const configured = { ...ongoing, platforms: ['Instagram', 'TikTok'], tone: 'sage' };
  assert.deepEqual(normalizeService(configured), configured);
  assert.deepEqual(loadServices(JSON.stringify([configured]), [ongoing]), [configured]);
  assert.throws(() => normalizeService({ ...configured, platforms: [' '] }));
  assert.throws(() => normalizeService({ ...configured, tone: 'not-a-calendar-color' }));
});
test('saved modes survive hydration while new defaults and old post projects are merged', () => {
  const extra = { ...ongoing, id: 'other', name: 'Tax planning' };
  const otherBusiness = { ...ongoing, id: 'harbor:Insurance', businessId: 'harbor' };
  const result = loadServices(JSON.stringify([campaign]), [ongoing, extra, otherBusiness]);
  assert.deepEqual(result, [campaign, extra, otherBusiness]);
  assert.deepEqual(loadServices(JSON.stringify(result), [ongoing, extra, otherBusiness]), result);
});
test('bad storage, unknown modes and duplicate identities fail explicitly instead of erasing data', () => {
  assert.throws(() => loadServices('{', [ongoing]));
  assert.throws(() => loadServices('{}', [ongoing]));
  assert.throws(() => normalizeService({ ...ongoing, mode: 'invalid' }));
  assert.throws(() => loadServices(JSON.stringify([ongoing, ongoing]), []));
  assert.throws(() => loadServices(JSON.stringify([ongoing, { ...ongoing, id: 'copy', name: 'insurance' }]), []));
});
test('saved Service and Campaign definitions now change content suggestion policy', () => {
  const source = { ...ongoing, project: ongoing.name, title: 'What coverage includes', contentType: 'Announcement', date: '2026-09-22' };
  const actual = buildActionInsight('logged', source, [source], source.date, [], [ongoing]);
  const withDates = { ...source, ...campaign, project: ongoing.name };
  assert.notDeepEqual(buildActionInsight('logged', withDates, [withDates], source.date, [], [campaign]), actual);
  assert.equal(buildActionInsight('logged', withDates, [withDates], '2026-12-31', [], [campaign]).proposals.length, 0);
});