import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getOverperformer } from '../src/lib/overperformer.ts';

const post = (id, views, project = 'Insurance', businessId = 'mosaic') => ({
  id,
  project,
  businessId,
  performance: views === undefined ? { saves: 2 } : { views },
});

test('waits for three posts with views in the same service and business', () => {
  const standout = post('standout', 900);
  assert.equal(getOverperformer(standout, [standout, post('a', 100)]), null);
  assert.equal(getOverperformer(standout, [
    standout, post('a', 100), post('saves-only', undefined), post('other-service', 100, 'Divorce'),
    post('other-business', 100, 'Insurance', 'harbor'),
  ]), null);
});

test('compares against the average including the entered post at the exact 2x threshold', () => {
  const standout = post('standout', 400);
  const posts = [standout, post('a', 100), post('b', 100)];
  assert.deepEqual(getOverperformer(standout, posts), {
    views: 400, averageViews: 200, multiple: 2, postCount: 3,
  });
  assert.equal(getOverperformer(posts[1], posts), null);
});

test('does not flag a post under 2x, missing views, or an all-zero average', () => {
  const posts = [post('a', 399), post('b', 100), post('c', 100)];
  assert.equal(getOverperformer(posts[0], posts), null);
  assert.equal(getOverperformer(post('missing', undefined), posts), null);
  const zeroPosts = [post('a', 0), post('b', 0), post('c', 0)];
  assert.equal(getOverperformer(zeroPosts[0], zeroPosts), null);
});