import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessConversionGap, getConversionGap } from '../src/lib/conversion-gap.ts';

const post = (views, saves, bookings) => ({ performance: { views, saves, bookings } });

test('detects zero bookings with positive views and saves on a single post', () => {
  const target = post(300, 30, 0);
  assert.deepEqual(getConversionGap(target), { views: 300, saves: 30, bookings: 0 });
  assert.deepEqual(assessConversionGap(target), {
    status: 'detected', result: { views: 300, saves: 30, bookings: 0 },
  });
});

test('requires bookings strictly below 20% of both views and saves', () => {
  assert.notEqual(getConversionGap(post(200, 20, 3)), null);
  assert.equal(getConversionGap(post(200, 20, 4)), null); // Exactly 20% of saves
  assert.equal(getConversionGap(post(5, 100, 1)), null); // Exactly 20% of views
  assert.equal(getConversionGap(post(1000, 5, 1)), null); // High views alone are not enough
});

test('does not mistake no engagement or missing results for a conversion gap', () => {
  assert.equal(getConversionGap(post(0, 20, 0)), null);
  assert.equal(getConversionGap(post(300, 0, 0)), null);
  assert.equal(getConversionGap(post(0, 0, 0)), null);
  assert.equal(getConversionGap({ performance: { views: 300, saves: 30 } }), null);
  assert.equal(getConversionGap(post(300, -1, 0)), null);
  assert.deepEqual(assessConversionGap({ performance: { views: 300, saves: 30 } }), {
    status: 'needs-results',
  });
  assert.deepEqual(assessConversionGap(post(200, 20, 4)), { status: 'not-detected' });
});