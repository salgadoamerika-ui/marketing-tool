import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AIRTIME_RULES, getAirtimeAllocations } from '../src/lib/airtime-allocation.ts';

const services = [
  { name: 'Fall programs', seasonMonths: [8, 9, 10] },
  { name: 'Divorce', seasonMonths: [] },
];

const post = (id, project, views, date, extra = {}) => ({
  id,
  businessId: 'mosaic',
  project,
  date,
  performance: { views },
  ...extra,
});

test('in-season services receive a higher score and more weekly airtime', () => {
  const result = getAirtimeAllocations('mosaic', services, [], 2026, 9);
  const fall = result.allocations.find((item) => item.service === 'Fall programs');
  const divorce = result.allocations.find((item) => item.service === 'Divorce');

  assert.equal(fall.airtimeScore, AIRTIME_RULES.baseScore + AIRTIME_RULES.seasonBoost);
  assert.ok(fall.postsPerWeek > divorce.postsPerWeek);
  assert.equal(fall.inSeason, true);
  assert.equal(divorce.inSeason, false);
});

test('recent above-average views add attention after three comparable results', () => {
  const posts = [
    post('a', 'Fall programs', 100, '2026-06-01'),
    post('b', 'Fall programs', 120, '2026-07-01'),
    post('c', 'Fall programs', 160, '2026-08-01'),
    post('other-service', 'Divorce', 1000, '2026-08-02'),
    { ...post('other-business', 'Fall programs', 2000, '2026-08-03'), businessId: 'harbor' },
  ];
  const result = getAirtimeAllocations('mosaic', services, posts, 2026, 9);
  const fall = result.allocations.find((item) => item.service === 'Fall programs');

  assert.equal(fall.measuredPostCount, 3);
  assert.equal(fall.signal, 'above-average');
  assert.equal(fall.priorAverageViews, 110);
  assert.equal(fall.airtimeScore, AIRTIME_RULES.baseScore + AIRTIME_RULES.seasonBoost + AIRTIME_RULES.attentionBoost);
  assert.ok(fall.postsPerWeek > 0.75);
});

test('performance does not adjust the score before three results', () => {
  const posts = [
    post('a', 'Divorce', 100, '2026-07-01'),
    post('b', 'Divorce', 200, '2026-08-01'),
  ];
  const result = getAirtimeAllocations('mosaic', services, posts, 2026, 9);
  const divorce = result.allocations.find((item) => item.service === 'Divorce');

  assert.equal(divorce.measuredPostCount, 2);
  assert.equal(divorce.signal, 'insufficient-data');
  assert.equal(divorce.airtimeScore, AIRTIME_RULES.baseScore);
});

test('three consecutive below-average results lower airtime to, but not below, the floor', () => {
  const posts = [
    post('a', 'Divorce', 120, '2026-04-01'),
    post('b', 'Divorce', 110, '2026-05-01'),
    post('c', 'Divorce', 40, '2026-06-01'),
    post('d', 'Divorce', 30, '2026-07-01'),
    post('e', 'Divorce', 20, '2026-08-01'),
  ];
  const result = getAirtimeAllocations('mosaic', services, posts, 2026, 9);
  const divorce = result.allocations.find((item) => item.service === 'Divorce');

  assert.equal(divorce.signal, 'consistently-weak');
  assert.equal(divorce.averageViews, 64);
  assert.equal(divorce.airtimeScore, AIRTIME_RULES.scoreFloor);
  assert.ok(divorce.postsPerWeek >= AIRTIME_RULES.monthlyFloor / 4);
});

test('in-season flat or weak results preserve seasonal volume and flag a new angle', () => {
  const flatPosts = [
    post('a', 'Fall programs', 100, '2026-06-01'),
    post('b', 'Fall programs', 100, '2026-07-01'),
    post('c', 'Fall programs', 100, '2026-08-01'),
  ];
  const flat = getAirtimeAllocations('mosaic', services, flatPosts, 2026, 9)
    .allocations.find((item) => item.service === 'Fall programs');
  assert.equal(flat.signal, 'flat');
  assert.equal(flat.airtimeScore, AIRTIME_RULES.baseScore + AIRTIME_RULES.seasonBoost);
  assert.equal(flat.tryNewAngle, true);

  const weakPosts = [
    post('a', 'Fall programs', 120, '2026-04-01'),
    post('b', 'Fall programs', 110, '2026-05-01'),
    post('c', 'Fall programs', 40, '2026-06-01'),
    post('d', 'Fall programs', 30, '2026-07-01'),
    post('e', 'Fall programs', 20, '2026-08-01'),
  ];
  const weak = getAirtimeAllocations('mosaic', services, weakPosts, 2026, 9)
    .allocations.find((item) => item.service === 'Fall programs');
  assert.equal(weak.signal, 'consistently-weak');
  assert.equal(weak.airtimeScore, AIRTIME_RULES.baseScore + AIRTIME_RULES.seasonBoost);
  assert.equal(weak.tryNewAngle, true);
});

test('skipped results and results after the selected month do not influence allocation', () => {
  const posts = [
    post('a', 'Divorce', 100, '2026-07-01'),
    post('b', 'Divorce', 110, '2026-08-01'),
    post('skipped', 'Divorce', 500, '2026-08-15', { status: 'skipped' }),
    post('future', 'Divorce', 10000, '2026-10-01'),
  ];
  const result = getAirtimeAllocations('mosaic', services, posts, 2026, 9);
  const divorce = result.allocations.find((item) => item.service === 'Divorce');

  assert.equal(divorce.measuredPostCount, 2);
  assert.equal(divorce.signal, 'insufficient-data');
});

test('weekly shares sum to capacity and keep every service at the monthly minimum', () => {
  const result = getAirtimeAllocations('mosaic', services, [], 2026, 9);

  assert.ok(Math.abs(result.allocations.reduce((sum, item) => sum + item.postsPerWeek, 0) - result.weeklyCapacity) < 1e-9);
  assert.ok(result.allocations.every((item) => item.postsPerWeek >= result.monthlyFloor / 4));
});

test('rejects an invalid month instead of silently choosing a season', () => {
  assert.throws(() => getAirtimeAllocations('mosaic', services, [], 2026, 13), RangeError);
});