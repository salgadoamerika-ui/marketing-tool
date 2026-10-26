import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  businessOverridesStorageKey, loadBusinessOverrides, validateBusinessName,
  withoutBusiness, withoutBusinessSettings, withoutBusinessSeasons,
} from '../src/lib/business-management.ts';
import { shouldOfferFirstRun } from '../src/lib/first-run.ts';

test('business names are required and unique, without blocking an unchanged name', () => {
  const businesses = [{ id: 'a', name: 'Willow Studio' }, { id: 'b', name: 'Orchard School' }];
  assert.match(validateBusinessName(' ', 'a', businesses), /name/);
  assert.match(validateBusinessName(' orchard school ', 'a', businesses), /already exists/);
  assert.equal(validateBusinessName(' Willow Studio ', 'a', businesses), undefined);
  assert.equal(validateBusinessName('Willow Collective', 'a', businesses), undefined);
});

test('deletion removes only the exact business, retaining other businesses and embedded results', () => {
  const other = { businessId: 'a-second', performance: { views: 100, saves: 4, bookings: 2 } };
  const rows = [{ businessId: 'a' }, other, { businessId: 'b', id: 'service-b' }];
  const result = withoutBusiness(rows, 'a');
  assert.deepEqual(result, [other, rows[2]]);
  assert.equal(result[0], other);
  assert.equal(rows.length, 3);
  assert.deepEqual(withoutBusinessSettings({ a: { types: ['Proof'] }, b: { types: ['Insight'] } }, 'a'), {
    b: { types: ['Insight'] },
  });
});

test('service-season learning is removed per business, not by service name or ID prefix', () => {
  const seasons = {
    [JSON.stringify(['a', 'Consulting'])]: [2, 3],
    [JSON.stringify(['b', 'Consulting'])]: [5, 6],
    [JSON.stringify(['a-second', 'Consulting'])]: [7],
  };
  const remaining = withoutBusinessSeasons(seasons, 'a');
  assert.equal(Object.keys(remaining).length, 2);
  assert.deepEqual(remaining[JSON.stringify(['b', 'Consulting'])], [5, 6]);
  assert.equal(Object.keys(seasons).length, 3);
});

test('legacy names/deletions survive storage and prevent re-onboarding after intentional deletion', () => {
  const raw = JSON.stringify({ mosaic: { name: 'New business name' }, deleted: { deleted: true } });
  assert.deepEqual(loadBusinessOverrides(raw), { mosaic: { name: 'New business name' }, deleted: { deleted: true } });
  assert.deepEqual(loadBusinessOverrides(null), {});
  assert.equal(shouldOfferFirstRun({ getItem: (key) => key === businessOverridesStorageKey ? raw : null }, []), false);
  for (const invalid of ['bad JSON', '[]', 'null', '{"a":{"name":""}}', '{"a":{"deleted":"yes"}}']) {
    assert.throws(() => loadBusinessOverrides(invalid));
  }
});
