import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConversionReview } from '../src/lib/conversion-review.ts';
import { buildActionInsight } from '../src/lib/action-insight.ts';

const post = (id, bookings = 4, extra = {}) => ({
  id, businessId: 'mosaic', project: 'Insurance', title: id,
  date: `2026-09-0${id === 'a' ? 1 : id === 'b' ? 2 : 3}`,
  contentType: 'Announcement',
  performance: { views: 100, saves: 10, bookings }, ...extra,
});
const base = [post('a', 0), post('b'), post('c')];
const review = (selected, posts, occupied = []) => buildConversionReview(selected, posts, '2026-10-02', occupied);

test('saving the third result activates an earlier gap and proposes a future testimonial', () => {
  const result = review(base[2], base);
  assert.equal(result.assessment.status, 'detected');
  assert.equal(result.subject.id, 'a');
  assert.equal(result.proposal.kind, 'trust');
  assert.equal(result.proposal.contentType, 'Testimonial');
  assert.equal(result.proposal.date, '2026-10-04');
  assert.equal(result.proposal.blocked, false);
});

test('missing results and fewer than three comparable posts explain why the rule is not active', () => {
  assert.equal(review(base[0], base.slice(0, 2)).assessment.status, 'needs-history');
  const incomplete = post('a', 0, { performance: { views: 100, saves: 10 } });
  assert.equal(review(incomplete, [incomplete, base[1], base[2]]).assessment.status, 'needs-results');
  const isolated = [base[0], post('b', 4, { businessId: 'harbor' }), post('c', 4, { project: 'Divorce' })];
  assert.equal(review(base[0], isolated).assessment.postCount, 1);
});

test('exactly 20% of saves is not a gap and a blank booking field is not zero', () => {
  const boundary = post('a', 2);
  assert.equal(review(boundary, [boundary, ...base.slice(1)]).assessment.status, 'not-detected');
  const blank = post('a', 0, { performance: { views: 100, saves: 10 } });
  assert.equal(review(blank, [blank, ...base.slice(1)]).proposal, undefined);
});

test('testimonial results unlock the offer, with no automatic calendar writes or duplicate stage', () => {
  const trust = post('trust', 0, {
    date: '2026-10-04', contentType: 'Testimonial', suggestionKind: 'trust', sourcePostId: 'a',
    performance: undefined,
  });
  assert.equal(review(base[0], [...base, trust]).proposal, undefined);
  const measuredTrust = { ...trust, performance: { views: 100, saves: 10, bookings: 0 } };
  const result = review(measuredTrust, [...base, measuredTrust]);
  assert.equal(result.proposal.kind, 'offer');
  assert.equal(result.proposal.contentType, 'Book now');
  const offer = post('offer', 0, {
    suggestionKind: 'offer', sourcePostId: 'a', contentType: 'Book now', date: result.proposal.date,
  });
  assert.equal(review(offer, [...base, measuredTrust, offer]).proposal, undefined);
});

test('conversion checks never replace normal content-sequence beats', () => {
  const result = buildActionInsight('results', base[0], base);
  assert.ok(result.proposals.some((proposal) => proposal.contentType === 'Inside look'));
  assert.ok(result.proposals.every((proposal) => proposal.kind === 'automatic'));
});

test('follow-ups avoid occupied dates and report a blocked week instead of backdating', () => {
  assert.equal(review(base[0], base, ['2026-10-04']).proposal.date, '2026-10-05');
  const occupied = Array.from({ length: 8 }, (_, i) => `2026-10-${String(i + 4).padStart(2, '0')}`);
  assert.equal(review(base[0], base, occupied).proposal.blocked, true);
});