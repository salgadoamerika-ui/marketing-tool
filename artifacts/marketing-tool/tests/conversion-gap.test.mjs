import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getConversionGap } from '../src/lib/conversion-gap.ts';

const post = (views, saves, bookings, project = 'Insurance', businessId = 'mosaic') => ({
  project,
  businessId,
  performance: { views, saves, bookings },
});

test('requires three complete results from the same business and service', () => {
  const target = post(300, 30, 0);
  assert.equal(getConversionGap(target, [target, post(100, 10, 3)]), null);
  assert.equal(getConversionGap(target, [
    target, post(100, 10, 3), { ...post(100, 10, 3), performance: { views: 100, saves: 10 } },
    post(100, 10, 3, 'Divorce'), post(100, 10, 3, 'Insurance', 'harbor'),
  ]), null);
  assert.equal(getConversionGap({ ...target, performance: { views: 300, saves: 30 } }, [
    target, post(100, 10, 3), post(100, 10, 3),
  ]), null);
});

test('flags strong views and saves with zero bookings and includes the current post in the averages', () => {
  const target = post(300, 30, 0);
  const result = getConversionGap(target, [target, post(100, 10, 3), post(100, 10, 3)]);
  assert.deepEqual(result, {
    views: 300, saves: 30, bookings: 0,
    averageViews: 500 / 3, averageSaves: 50 / 3, averageBookings: 2, postCount: 3,
  });
});

test('treats bookings at half the average as well below, but not just below average', () => {
  const target = post(200, 20, 2);
  assert.notEqual(getConversionGap(target, [target, post(100, 10, 5), post(100, 10, 5)]), null);
  const almost = post(200, 20, 3);
  assert.equal(getConversionGap(almost, [almost, post(100, 10, 5), post(100, 10, 5)]), null);
});

test('does not flag weak views, weak saves, or empty engagement', () => {
  const weakViews = post(50, 30, 0);
  assert.equal(getConversionGap(weakViews, [weakViews, post(100, 10, 3), post(100, 10, 3)]), null);
  const weakSaves = post(300, 1, 0);
  assert.equal(getConversionGap(weakSaves, [weakSaves, post(100, 10, 3), post(100, 10, 3)]), null);
  const empty = post(0, 0, 0);
  assert.equal(getConversionGap(empty, [empty, empty, empty]), null);
});