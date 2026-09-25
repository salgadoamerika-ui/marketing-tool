import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildActionInsight } from '../src/lib/action-insight.ts';

const post = (id, performance, extra = {}) => ({
  id,
  businessId: 'mosaic',
  project: 'Insurance',
  title: `Post ${id}`,
  contentType: 'Insight',
  date: '2026-09-22',
  ...(performance ? { performance } : {}),
  ...extra,
});
const measured = (views, saves, bookings) => ({ views, saves, bookings });
const peers = [post('a', measured(100, 10, 4)), post('b', measured(100, 10, 4))];

test('thin data cites the actual sample and offers no invented performance suggestion', () => {
  const next = post('new');
  const logged = buildActionInsight('logged', next, [peers[0], next]);
  assert.match(logged.evidence, /1 Insurance post has complete results/);
  assert.match(logged.recommendation, /at least 3 posts/);
  assert.equal(logged.proposal, undefined);

  const low = post('low', measured(100, 10, 0));
  const results = buildActionInsight('results', low, [peers[0], low]);
  assert.match(results.evidence, /100 views, 10 saves, and 0 bookings/);
  assert.equal(results.proposal, undefined);
});

test('a logged post with three measured peers can offer one experimental follow-up', () => {
  const next = post('new');
  const insight = buildActionInsight('logged', next, [
    ...peers,
    post('best', measured(250, 15, 3)),
    post('other', measured(900, 90, 12), { project: 'Divorce' }),
    next,
  ], '2026-09-25');
  assert.match(insight.evidence, /3 Insurance posts/);
  assert.match(insight.evidence, /Post best.*250 views/);
  assert.doesNotMatch(insight.evidence, /900/);
  assert.match(insight.recommendation, /experiment—not a guaranteed pattern/);
  assert.equal(insight.proposal?.kind, 'insight');
  assert.equal(insight.proposal?.date, '2026-09-28');
});

test('conversion gap recommends a testimonial but never claims it was already added', () => {
  const low = post('low', measured(100, 10, 0));
  const insight = buildActionInsight('results', low, [...peers, low], '2026-09-25');
  assert.match(insight.evidence, /below 20% of both views and saves/);
  assert.match(insight.recommendation, /client testimonial/);
  assert.doesNotMatch(insight.recommendation, /was added/);
  assert.deepEqual(insight.proposal, {
    kind: 'trust',
    triggerPostId: low.id,
    sourcePostId: low.id,
    contentType: 'Proof',
    title: 'Insurance: a client testimonial',
    date: '2026-09-27',
  });
});

test('only after the testimonial also has a low-booking result does it offer the second stage', () => {
  const source = post('original', measured(100, 10, 0));
  const trust = post('trust', undefined, { suggestionKind: 'trust', sourcePostId: source.id });
  assert.equal(buildActionInsight('completed', trust, [source, ...peers, trust]).proposal, undefined);

  const measuredTrust = { ...trust, performance: measured(100, 10, 0) };
  const insight = buildActionInsight('results', measuredTrust, [source, ...peers, measuredTrust]);
  assert.equal(insight.proposal?.kind, 'offer');
  assert.match(insight.recommendation, /testimonials? drew engagement|testimonial drew engagement/);
  const offer = post('offer', undefined, { suggestionKind: 'offer', sourcePostId: source.id });
  assert.equal(buildActionInsight('results', measuredTrust, [source, ...peers, measuredTrust, offer]).proposal, undefined);
});

test('skipping a post can offer a reschedule without counting it as poor performance', () => {
  const skipped = post('skip', undefined, { status: 'skipped' });
  const insight = buildActionInsight('skipped', skipped, [skipped], '2026-09-25');
  assert.match(insight.evidence, /0 Insurance posts have complete results/);
  assert.match(insight.recommendation, /missed date tells us nothing/);
  assert.equal(insight.proposal?.kind, 'reschedule');
  assert.equal(insight.proposal?.date, '2026-09-27');
  const existing = post('reschedule', undefined, { sourcePostId: skipped.id, suggestionKind: 'reschedule' });
  assert.equal(buildActionInsight('skipped', skipped, [skipped, existing]).proposal, undefined);
});

test('completing without results suggests measurement, not another calendar post', () => {
  const completed = post('done', undefined, { status: 'completed' });
  const insight = buildActionInsight('completed', completed, [completed]);
  assert.match(insight.evidence, /does not yet have views, saves, and bookings/);
  assert.equal(insight.proposal, undefined);
});