import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFollowUpPlans } from '../src/lib/follow-ups.ts';

const source = {
  id: 'source',
  businessId: 'mosaic',
  project: 'Insurance',
  contentType: 'Announcement',
  date: '2026-09-29',
};

test('plans follow-ups with real dates, even when they fall in the next month', () => {
  assert.deepEqual(getFollowUpPlans(source, [source]), [
    { contentType: 'Insight', label: 'share a useful insight', date: '2026-10-01', existingPostId: undefined },
    { contentType: 'Book now', label: 'make the ask', date: '2026-10-04', existingPostId: undefined },
  ]);
});

test('posts in another service or business do not suppress calendar follow-ups', () => {
  const sameTypeOtherService = { ...source, id: 'other-service', project: 'Divorce', contentType: 'Insight', date: '2026-10-01' };
  const sameTypeOtherBusiness = { ...source, id: 'other-business', businessId: 'harbor', contentType: 'Book now', date: '2026-10-04' };
  assert.equal(getFollowUpPlans(source, [source, sameTypeOtherService, sameTypeOtherBusiness])
    .filter((plan) => !plan.existingPostId).length, 2);
});

test('recognizes a nearby post for the same service, but leaves the other suggestion available', () => {
  const existing = { ...source, id: 'existing', contentType: 'Insight', date: '2026-10-02' };
  const plans = getFollowUpPlans(source, [source, existing]);
  assert.equal(plans[0].existingPostId, 'existing');
  assert.equal(plans[1].existingPostId, undefined);
});