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

test('a newly logged post with thin data gets an honest next step, not a fabricated trend', () => {
  const next = post('new');
  const insight = buildActionInsight('logged', next, [post('old', measured(100, 10, 2)), next]);
  assert.match(insight.evidence, /1 Insurance post has complete results/);
  assert.match(insight.recommendation, /At least 3 measured posts/);
  assert.doesNotMatch(insight.evidence, /most-viewed|average|trend/);
});

test('a new post can cite an actual measured example after three comparable posts', () => {
  const next = post('new');
  const insight = buildActionInsight('logged', next, [
    post('a', measured(100, 8, 2)),
    post('best', measured(250, 15, 3)),
    post('c', measured(80, 4, 1)),
    post('other', measured(900, 90, 12), { project: 'Divorce' }),
    next,
  ]);
  assert.match(insight.evidence, /3 Insurance posts/);
  assert.match(insight.evidence, /Post best.*250 views/);
  assert.doesNotMatch(insight.evidence, /900/);
  assert.match(insight.recommendation, /experiment—not a guaranteed result/);
});

test('saved results cite exact values and only recommend testimonial after the three-post gate', () => {
  const target = post('low', measured(100, 10, 0));
  const peers = [post('a', measured(100, 10, 4)), post('b', measured(100, 10, 4))];
  const thin = buildActionInsight('results', target, [target, peers[0]]);
  assert.match(thin.evidence, /100 views, 10 saves, and 0 bookings/);
  assert.doesNotMatch(thin.recommendation, /testimonial/);
  const trust = post('trust', undefined, { suggestionKind: 'trust', sourcePostId: target.id });
  const ready = buildActionInsight('results', target, [target, ...peers, trust]);
  assert.match(ready.evidence, /below 20% of both views and saves/);
  assert.match(ready.recommendation, /suggested testimonial was added/);
});

test('a skipped post is not treated as performance, and completing without results prompts measurement', () => {
  const skipped = post('skip', undefined, { status: 'skipped' });
  const skippedInsight = buildActionInsight('skipped', skipped, [skipped]);
  assert.match(skippedInsight.evidence, /0 Insurance posts have complete results/);
  assert.match(skippedInsight.recommendation, /Do not count an unpublished post as underperforming/);
  const completed = post('done', undefined, { status: 'completed' });
  const completedInsight = buildActionInsight('completed', completed, [completed]);
  assert.match(completedInsight.evidence, /does not yet have views, saves, and bookings/);
  assert.match(completedInsight.recommendation, /Add the missing results/);
});

test('after testimonial results still fall below 20%, cites scheduled offer rather than another testimonial', () => {
  const source = post('original', measured(100, 10, 0));
  const trust = post('trust', measured(100, 10, 0), { suggestionKind: 'trust', sourcePostId: source.id });
  const offer = post('offer', undefined, { suggestionKind: 'offer', sourcePostId: source.id });
  const insight = buildActionInsight('results', trust, [
    source, trust, post('peer', measured(100, 10, 4)), offer,
  ]);
  assert.match(insight.recommendation, /suggested referral offer was added/);
});