import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  loadServiceSeasonSelections,
  normalizeSeasonMonths,
  serviceSeasonKey,
} from '../src/lib/service-seasons.ts';

test('selectable seasons are isolated for each service and business', () => {
  const seasons = {
    [serviceSeasonKey('mosaic', 'Insurance')]: [3, 4, 5],
    [serviceSeasonKey('northline', 'Insurance')]: [9],
  };
  assert.deepEqual(loadServiceSeasonSelections(JSON.stringify(seasons)), seasons);
  assert.deepEqual(loadServiceSeasonSelections(JSON.stringify(seasons))[serviceSeasonKey('mosaic', 'Insurance')], [3, 4, 5]);
  assert.deepEqual(loadServiceSeasonSelections(JSON.stringify(seasons))[serviceSeasonKey('northline', 'Insurance')], [9]);
});

test('empty selections, duplicates from draft buttons, and every month remain safe', () => {
  assert.deepEqual(loadServiceSeasonSelections(null), {});
  assert.deepEqual(normalizeSeasonMonths([]), []);
  assert.deepEqual(normalizeSeasonMonths([12, 1, 6, 1]), [1, 6, 12]);
});

test('malformed selections are rejected rather than silently clearing saved months', () => {
  for (const raw of ['{', '[]', '{"Insurance":"March"}', '{"Insurance":[0]}', '{"Insurance":[13]}', '{"Insurance":[2.5]}', '{"Insurance":[1,1]}']) {
    assert.throws(() => loadServiceSeasonSelections(raw));
  }
  assert.throws(() => normalizeSeasonMonths([NaN]));
});