import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildActionInsight } from '../src/lib/action-insight.ts';

const post = (id, contentType = 'Announcement', extra = {}) => ({
  id,
  businessId: 'mosaic',
  project: 'Insurance',
  title: `Post ${id}`,
  contentType,
  date: '2026-09-28',
  ...extra,
});

test('a newly logged announcement recommends the next Insight without any results or peers', () => {
  const announcement = post('first');
  const insight = buildActionInsight('logged', announcement, [announcement], '2026-09-28');
  assert.equal(insight.title, 'Insight is next in the sequence');
  assert.match(insight.evidence, /Post first.*Announcement.*Insurance/);
  assert.match(insight.recommendation, /useful insight.*before asking them to book/);
  assert.match(insight.recommendation, /not a claim about performance/);
  assert.deepEqual(insight.proposal, {
    kind: 'automatic',
    triggerPostId: 'first',
    sourcePostId: 'first',
    contentType: 'Insight',
    title: 'Insurance: share a useful insight',
    date: '2026-09-30',
  });
});

test('an Insight recommends a booking post without the three-post performance gate', () => {
  const source = post('useful', 'Insight');
  const suggestion = buildActionInsight('completed', source, [source], '2026-09-28');
  assert.equal(suggestion.proposal?.contentType, 'Book now');
  assert.equal(suggestion.proposal?.title, 'Insurance: turn value into a booking');
  assert.equal(suggestion.proposal?.date, '2026-10-02');
});

test('saving results cites real numbers but does not replace the content sequence with a performance rule', () => {
  const source = post('low', 'Announcement', { performance: { views: 100, saves: 10, bookings: 0 } });
  const insight = buildActionInsight('results', source, [source], '2026-09-29');
  assert.match(insight.evidence, /100 views, 10 saves, 0 bookings/);
  assert.equal(insight.proposal?.contentType, 'Insight');
  assert.notEqual(insight.proposal?.contentType, 'Proof');
  assert.equal(insight.proposal?.date, '2026-10-01');
});

test('when the first step is already scheduled, offer the next unplanned step, not a duplicate', () => {
  const announcement = post('first');
  const existingInsight = post('already-planned', 'Insight', { date: '2026-09-30' });
  const suggestion = buildActionInsight('logged', announcement, [announcement, existingInsight]);
  assert.equal(suggestion.proposal?.contentType, 'Book now');
  assert.equal(suggestion.proposal?.date, '2026-10-03');
  const existingBooking = post('already-booking', 'Book now', { date: '2026-10-03' });
  const noDuplicate = buildActionInsight('results', announcement, [announcement, existingInsight, existingBooking]);
  assert.equal(noDuplicate.proposal, undefined);
  assert.match(noDuplicate.recommendation, /already on the calendar/);
});

test('follow-ups for another service or business do not consume this sequence', () => {
  const announcement = post('first');
  const otherService = post('divorce', 'Insight', { project: 'Divorce', date: '2026-09-30' });
  const otherBusiness = post('harbor', 'Insight', { businessId: 'harbor', date: '2026-09-30' });
  const insight = buildActionInsight('logged', announcement, [announcement, otherService, otherBusiness]);
  assert.equal(insight.proposal?.contentType, 'Insight');
});

test('skipped posts offer to revisit the same step instead of falsely advancing the sequence', () => {
  const skipped = post('skip', 'Announcement', { status: 'skipped' });
  const insight = buildActionInsight('skipped', skipped, [skipped], '2026-09-30');
  assert.match(insight.recommendation, /revisit it before moving/);
  assert.equal(insight.proposal?.contentType, 'Announcement');
  assert.equal(insight.proposal?.kind, 'reschedule');
  assert.equal(insight.proposal?.date, '2026-10-02');
  const existing = post('reschedule', 'Announcement', { sourcePostId: skipped.id, suggestionKind: 'reschedule' });
  assert.equal(buildActionInsight('skipped', skipped, [skipped, existing]).proposal, undefined);
});

test('a skipped post with saved results asks for status review, not another post', () => {
  const skipped = post('skip', 'Insight', {
    status: 'skipped',
    performance: { views: 100, saves: 10, bookings: 0 },
  });
  const insight = buildActionInsight('skipped', skipped, [skipped]);
  assert.match(insight.evidence, /100 views, 10 saves, 0 bookings/);
  assert.equal(insight.proposal, undefined);
});