import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMonthlyAirtime, MONTHLY_AIRTIME_RULES } from '../src/lib/monthly-airtime.ts';

const services = ['Fall programs', 'Tax planning', 'Divorce', 'Immigration', 'Insurance'];
const post = (id, project, date = '2026-09-10', extra = {}) => ({
  id, project, date, businessId: 'mosaic', ...extra,
});
const volume = (project, count) => Array.from({ length: count }, (_, i) => post(`${project}-${i}`, project));
const calculate = (posts) => getMonthlyAirtime('mosaic', services, posts, 2026, 9);
const find = (rows, service) => rows.find((row) => row.service === service);
const total = (rows) => rows.reduce((sum, row) => sum + row.sharePercent, 0);

test('monthly calendar volume determines bar lengths and the Peak tag without performance data', () => {
  const rows = calculate([
    ...volume('Fall programs', 5),
    ...services.slice(1).flatMap((service) => volume(service, 2)),
  ]);
  const peak = find(rows, 'Fall programs');
  assert.equal(peak.tag, 'Peak');
  assert.equal(peak.postCount, 5);
  assert.ok(peak.sharePercent > find(rows, 'Tax planning').sharePercent);
  assert.equal(find(rows, 'Tax planning').tag, 'Steady');
  assert.ok(Math.abs(total(rows) - 100) < 1e-9);
});

test('three measured posts unlock a boost and the Riding tag when another service still leads', () => {
  const posts = [
    ...volume('Fall programs', 5),
    post('a', 'Tax planning', '2026-09-01', { performance: { views: 100 } }),
    post('b', 'Tax planning', '2026-09-02', { performance: { views: 100 } }),
    post('c', 'Tax planning', '2026-09-03', { performance: { views: 200 } }),
  ];
  const boosted = find(calculate(posts), 'Tax planning');
  const unmeasured = find(calculate(posts.map(({ performance, ...p }) => p)), 'Tax planning');
  assert.equal(boosted.boosted, true);
  assert.equal(boosted.tag, 'Riding');
  assert.ok(boosted.sharePercent > unmeasured.sharePercent);
  assert.ok(Math.abs(total(calculate(posts)) - 100) < 1e-9);
});

test('one or two measured posts never trigger a performance boost', () => {
  const rows = calculate([
    ...volume('Fall programs', 5),
    post('a', 'Tax planning', '2026-09-01', { performance: { views: 100 } }),
    post('b', 'Tax planning', '2026-09-02', { performance: { views: 10000 } }),
    post('c', 'Tax planning', '2026-09-03'),
  ]);
  assert.equal(find(rows, 'Tax planning').boosted, false);
  assert.equal(find(rows, 'Tax planning').tag, 'Steady');
});

test('services with zero or one post retain the visible minimum', () => {
  const rows = calculate([...volume('Fall programs', 5), post('one', 'Insurance')]);
  for (const service of services.slice(1)) {
    assert.equal(find(rows, service).sharePercent, MONTHLY_AIRTIME_RULES.floorPercent);
    assert.equal(find(rows, service).tag, 'Floor');
  }
  assert.equal(find(rows, 'Fall programs').sharePercent, 68);
});

test('consistently weak services stay at maintenance floor even with many monthly posts', () => {
  const history = [120, 110, 40, 30, 20].map((views, i) =>
    post(`history-${i}`, 'Divorce', `2026-0${i + 4}-01`, { performance: { views } }));
  const rows = calculate([...history, ...volume('Divorce', 8), ...volume('Insurance', 3)]);
  assert.equal(find(rows, 'Divorce').maintenance, true);
  assert.equal(find(rows, 'Divorce').tag, 'Floor');
  assert.equal(find(rows, 'Divorce').sharePercent, 8);
  assert.equal(find(rows, 'Insurance').tag, 'Peak');
});

test('counts and performance stay isolated by business, service and selected month', () => {
  const rows = calculate([
    ...volume('Fall programs', 2),
    ...volume('Insurance', 9).map((p) => ({ ...p, businessId: 'harbor', performance: { views: 900 } })),
    post('prior', 'Insurance', '2026-08-01'),
    post('future', 'Insurance', '2026-10-01', { performance: { views: 10000 } }),
    post('skipped', 'Insurance', '2026-09-02', { status: 'skipped', performance: { views: 10000 } }),
    post('unassigned', 'Other service'),
    post('invalid', 'Insurance', '2026-09-31'),
  ]);
  assert.equal(find(rows, 'Insurance').postCount, 0);
  assert.equal(find(rows, 'Insurance').boosted, false);
  assert.equal(find(rows, 'Fall programs').postCount, 2);
});

test('empty months show equal visible floors, no invented performance or Peak', () => {
  const rows = calculate([]);
  assert.ok(rows.every((row) => row.tag === 'Floor' && row.sharePercent === 20 && !row.boosted));
  assert.equal(total(rows), 100);
});

test('tied active leaders choose a stable Peak without changing their shares', () => {
  const rows = calculate([...volume('Fall programs', 3), ...volume('Insurance', 3)]);
  assert.equal(find(rows, 'Fall programs').sharePercent, find(rows, 'Insurance').sharePercent);
  assert.equal(find(rows, 'Fall programs').tag, 'Peak');
  assert.equal(find(rows, 'Insurance').tag, 'Steady');
});

test('empty service lists and invalid months are handled explicitly', () => {
  assert.deepEqual(getMonthlyAirtime('mosaic', [], [], 2026, 9), []);
  assert.throws(() => getMonthlyAirtime('mosaic', services, [], 2026, 13), RangeError);
});