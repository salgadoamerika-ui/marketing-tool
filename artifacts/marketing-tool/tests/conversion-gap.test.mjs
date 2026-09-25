import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessConversionGap, getConversionGap } from '../src/lib/conversion-gap.ts';

const post = (views, saves, bookings, project = 'Insurance', businessId = 'mosaic') => ({
  project,
  businessId,
  performance: { views, saves, bookings },
});

test('requires three complete results from the same business and service before checking the ratio', () => {
  const target = post(300, 30, 0);
  assert.equal(getConversionGap(target, [target, post(100, 10, 4)]), null);
  assert.deepEqual(assessConversionGap(target, [target, post(100, 10, 4)]), {
    status: 'needs-history', postCount: 2,
  });
  assert.equal(getConversionGap(target, [
    target, post(100, 10, 4), post(100, 10, 4, 'Divorce'), post(100, 10, 4, 'Insurance', 'harbor'),
    { ...post(100, 10, 4), performance: { views: 100, saves: 10 } },
  ]), null);
  assert.deepEqual(getConversionGap(target, [target, post(100, 10, 4), post(100, 10, 4)]), {
    views: 300, saves: 30, bookings: 0,
  });
});

test('requires bookings strictly below 20% of both views and saves after the gate', () => {
  const peers = [post(100, 10, 4), post(100, 10, 4)];
  const check = (target) => getConversionGap(target, [target, ...peers]);
  assert.notEqual(check(post(200, 20, 3)), null);
  assert.equal(check(post(200, 20, 4)), null); // Exactly 20% of saves
  assert.equal(check(post(5, 100, 1)), null); // Exactly 20% of views
  assert.equal(check(post(1000, 5, 1)), null); // High views alone are not enough
  assert.notEqual(check(post(50, 5, 0)), null); // No average-engagement gate
});

test('does not mistake no engagement or missing results for a conversion gap', () => {
  const peers = [post(100, 10, 4), post(100, 10, 4)];
  const check = (target) => getConversionGap(target, [target, ...peers]);
  assert.equal(check(post(0, 20, 0)), null);
  assert.equal(check(post(300, 0, 0)), null);
  assert.equal(check(post(0, 0, 0)), null);
  assert.equal(check({ ...post(300, 30, 0), performance: { views: 300, saves: 30 } }), null);
  assert.equal(check(post(300, -1, 0)), null);
  const incomplete = { ...post(300, 30, 0), performance: { views: 300, saves: 30 } };
  assert.deepEqual(assessConversionGap(incomplete, [incomplete, ...peers]), {
    status: 'needs-results', postCount: 2,
  });
  const noGap = post(200, 20, 4);
  assert.deepEqual(assessConversionGap(noGap, [noGap, ...peers]), {
    status: 'not-detected', postCount: 3,
  });
});