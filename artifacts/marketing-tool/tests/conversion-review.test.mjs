import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConversionReview } from '../src/lib/conversion-review.ts';
import { buildActionInsight } from '../src/lib/action-insight.ts';

const post = (id, bookings = 1, extra = {}) => ({
  id, businessId: 'mosaic', project: 'Insurance', title: id,
  date: `2026-09-0${id === 'a' ? 1 : id === 'b' ? 2 : 3}`, contentType: 'Announcement',
  performance: { views: 300, saves: 10, bookings }, ...extra,
});
const base = [post('a'), post('b'), post('c')];
const review = (selected, posts, occupied = [], today = '2026-10-02') => buildConversionReview(selected, posts, today, occupied);

test('third measured post gets the service summary and a future trust proposal', () => {
  const result = review(base[2], base);
  assert.equal(result.assessment.status, 'detected');
  assert.equal(result.subject.id, 'c');
  assert.equal(result.assessment.result.views, 900);
  assert.equal(result.proposal.kind, 'trust');
  assert.equal(result.proposal.contentType, 'Testimonial');
  assert.equal(result.proposal.date, '2026-10-04');
  assert.equal(result.proposal.blocked, false);
});

test('missing results and insufficient comparable history cannot generate recommendations', () => {
  assert.equal(review(base[0], base.slice(0, 2)).assessment.status, 'needs-history');
  const incomplete = post('a', 0, { performance: { views: 300, saves: 10 } });
  assert.equal(review(incomplete, [incomplete, base[1], base[2]]).proposal, undefined);
  const isolated = [base[0], post('b', 1, { businessId: 'harbor' }), post('c', 1, { project: 'Divorce' })];
  assert.equal(review(base[0], isolated).assessment.postCount, 1);
});

test('recovering service has no proposal or sequence even when opening an older weak post', () => {
  const recovered = [...base, post('healthy', 30, { date: '2026-10-01' })];
  assert.equal(review(base[0], recovered).assessment.status, 'not-detected');
  assert.equal(review(base[0], recovered).proposal, undefined);
  assert.equal(review(base[0], recovered).stage, undefined);
});

test('trust results unlock only an offer after its scheduled date, no automatic writes', () => {
  const trust = post('trust', 1, {
    date: '2026-10-04', contentType: 'Testimonial', suggestionKind: 'trust', sourcePostId: 'c', performance: undefined,
  });
  assert.equal(review(base[2], [...base, trust]).stage, 'waiting-trust');
  const measuredTrust = { ...trust, performance: { views: 300, saves: 10, bookings: 1 } };
  assert.equal(review(measuredTrust, [...base, measuredTrust]).proposal, undefined);
  const result = review(measuredTrust, [...base, measuredTrust], [], '2026-10-04');
  assert.equal(result.stage, 'offer');
  assert.equal(result.proposal.contentType, 'Book now');
  const offer = post('offer', 0, {
    suggestionKind: 'offer', sourcePostId: 'c', contentType: 'Book now', date: result.proposal.date,
  });
  assert.equal(review(offer, [...base, measuredTrust, offer], [], '2026-10-10').proposal, undefined);
});

test('conversion checks never replace normal content-sequence beats', () => {
  const result = buildActionInsight('results', base[0], base);
  assert.ok(result.proposals.some((proposal) => proposal.contentType === 'Inside look'));
  assert.ok(result.proposals.every((proposal) => proposal.kind === 'automatic'));
});

test('follow-ups avoid occupied dates and block rather than backdate a full week', () => {
  assert.equal(review(base[2], base, ['2026-10-04']).proposal.date, '2026-10-05');
  const occupied = Array.from({ length: 8 }, (_, i) => `2026-10-${String(i + 4).padStart(2, '0')}`);
  assert.equal(review(base[2], base, occupied).proposal.blocked, true);
});