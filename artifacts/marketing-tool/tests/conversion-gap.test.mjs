import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessConversionGap, getConversionGap, getConversionGapMarkers } from '../src/lib/conversion-gap.ts';

const post = (id, views = 300, saves = 0, bookings = 1, extra = {}) => ({
  id, date: `2026-09-${String(id).padStart(2, '0')}`, businessId: 'mosaic', project: 'Insurance',
  performance: { views, saves, bookings }, ...extra,
});
const base = [post(1), post(2), post(3)];

test('honesty gate counts complete results only, isolated by business and service', () => {
  const target = base[2];
  assert.deepEqual(assessConversionGap(target, base.slice(0, 2)), { status: 'needs-history', postCount: 2 });
  const excluded = [
    post(4, 300, 10, 1, { project: 'Divorce' }),
    post(5, 300, 10, 1, { businessId: 'harbor' }),
    post(6, 300, 10, 1, { performance: { views: 300, saves: 10 } }),
    post(7, 300, 10, 1, { status: 'skipped' }),
    post(8, 300, -1, 0),
  ];
  assert.equal(getConversionGap(target, [target, ...excluded]), null);
  assert.deepEqual([...getConversionGapMarkers([target, ...excluded])], []);
});

test('300 views and 1 booking is a gap across three posts, even with no saves', () => {
  const result = getConversionGap(base[2], base);
  assert.equal(result.views, 900);
  assert.equal(result.bookings, 3);
  assert.equal(result.bookingRate, 3 / 900);
  assert.equal(result.lowConversionPosts, 3);
  assert.deepEqual(result.postIds, [1, 2, 3]);
  assert.deepEqual([...getConversionGapMarkers(base)], [3]);
});

test('under 2% combined conversion and at least two low-converting posts are both required', () => {
  const boundary = [post(1, 100, 10, 2), post(2, 100, 10, 2), post(3, 100, 10, 2)];
  assert.equal(getConversionGap(boundary[2], boundary), null);
  const inconsistent = [post(1, 10000, 1, 0), post(2, 100, 1, 3), post(3, 100, 1, 3)];
  assert.equal(getConversionGap(inconsistent[2], inconsistent), null, 'A single bad post cannot create a service pattern.');
  const pattern = [post(1, 300, 1, 1), post(2, 300, 1, 1), post(3, 100, 1, 3)];
  assert.notEqual(getConversionGap(pattern[2], pattern), null);
  const weighted = [post(1, 100, 1, 0), post(2, 100, 1, 0), post(3, 1000, 1, 30)];
  assert.equal(getConversionGap(weighted[2], weighted), null, 'Use combined bookings / combined views, not mean post ratios.');
});

test('uses only the latest three measured posts, clears on recovery, and never revives an old gap', () => {
  const recovered = [...base, post(4, 300, 0, 30)];
  assert.equal(getConversionGap(base[0], recovered), null);
  assert.deepEqual([...getConversionGapMarkers(recovered)], []);
  const later = [...recovered, post(5), post(6), post(7)];
  assert.equal(assessConversionGap(later[6], later).episodePostId, 7);
  assert.deepEqual([...getConversionGapMarkers([...later].reverse())], [7]);
});

test('no attention, invalid counts and unknown bookings cannot manufacture a gap', () => {
  const noViews = [post(1, 0, 5, 0), post(2, 0, 5, 0), post(3, 0, 5, 0)];
  assert.equal(getConversionGap(noViews[2], noViews), null);
  const unknown = post(4, 100, 1, 0, { performance: { views: 100, saves: 1 } });
  assert.deepEqual([...getConversionGapMarkers([...base, unknown])], [3]);
  assert.equal(assessConversionGap(post(1), [post(1), post(2, 300, 10, -1), post(3, 300, 10, NaN)]).postCount, 1);
});