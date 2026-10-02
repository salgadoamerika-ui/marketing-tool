import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFlatPostState } from '../src/lib/flat-post-ladder.ts';
import { buildActionInsight } from '../src/lib/action-insight.ts';
import { buildConversionReview } from '../src/lib/conversion-review.ts';

const service = { businessId: 'mosaic', project: 'Insurance' };
const post = (index, views, extra = {}) => ({
  ...service, id: `post-${index}`, date: `2026-09-${String(index).padStart(2, '0')}`,
  title: 'What your coverage includes', contentType: 'Insight',
  performance: { views, saves: 10, bookings: 5 }, ...extra,
});
const series = (views) => views.map((value, index) => post(index + 1, value));
const history = series([100, 100, 50, 40, 30, 20]);
const state = (posts) => getFlatPostState(service, posts, '2026-10-02');
const insight = (posts, occupied = []) => buildActionInsight('results', posts.at(-1), posts, '2026-10-02', occupied);

test('requires three valid view results for this business/service and ignores unknown results', () => {
  assert.equal(state(history.slice(0, 2)).action, 'none');
  assert.equal(state(history.slice(0, 2)).streak, 0);
  const excluded = [
    post(3, 0, { businessId: 'harbor' }), post(4, 0, { project: 'Divorce' }),
    post(5, undefined), post(6, -1), post(7, NaN), post(8, 0, { status: 'skipped' }),
    post(9, 0, { date: '2026-09-31' }), post(10, 0, { date: '2026-11-01' }),
  ];
  assert.equal(state([...history.slice(0, 2), ...excluded]).measuredPostCount, 2);
  assert.equal(state([...history.slice(0, 2), ...excluded]).streak, 0);
});

test('internal stages are no-op, repost, fresh approach and monthly maintenance in order', () => {
  assert.equal(state(history.slice(0, 3)).streak, 1);
  assert.equal(state(history.slice(0, 3)).action, 'none');
  assert.equal(state(history.slice(0, 4)).action, 'repost');
  assert.equal(state(history.slice(0, 5)).action, 'fresh-angle');
  assert.equal(state(history).action, 'maintenance');
  assert.equal(state([...history, post(7, 10)]).streak, 5);
  assert.equal(state([...history, post(7, 10)]).action, 'maintenance');
});

test('at-average and above-average performance reset the counter; zero averages do not underperform', () => {
  assert.equal(state(series([100, 100, 50, 40, 72.5])).measuredPostCount, 4, 'Fractional view counts are invalid.');
  const equal = series([120, 120, 60, 50, 40, 30, 70]); // previous sum 420 / 6 = 70
  assert.equal(state(equal).streak, 0);
  assert.equal(state(equal).action, 'none');
  assert.equal(state([...history, post(7, 1000)]).streak, 0);
  assert.equal(state(series([0, 0, 0, 0])).streak, 0);
});

test('chronological history survives reload and resaves, and recovery is not reclassified by future averages', () => {
  const chronological = series([100, 100, 50, 40, 1000, 10, 10]);
  assert.equal(state(chronological).streak, 2);
  assert.deepEqual(state([...chronological].reverse()), state(chronological));
  assert.deepEqual(state(JSON.parse(JSON.stringify(chronological))), state(chronological));
  const recovered = history.map((p) => p.id === 'post-6' ? { ...p, performance: { views: 1000 } } : p);
  assert.equal(state(recovered).streak, 0);
  assert.equal(state(history.filter((p) => p.id !== 'post-6')).action, 'fresh-angle');
});

test('first underperformer leaves ordinary suggestions unchanged', () => {
  const result = insight(history.slice(0, 3));
  assert.ok(result.proposals.every((proposal) => proposal.kind === 'automatic'));
  assert.equal(result.proposals[0].contentType, 'Book now');
});

test('repost keeps the same title, topic and content type with a normal timing explanation', () => {
  const result = insight(history.slice(0, 4));
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].kind, 'repost');
  assert.equal(result.proposals[0].title, history[3].title);
  assert.equal(result.proposals[0].contentType, history[3].contentType);
  assert.equal(result.proposals[0].sourcePostId, history[3].id);
  assert.match(result.recommendation, /Worth another shot — timing may have been off/);
});

test('fresh approach retains the topic and suggests one move, never the normal booking sequence', () => {
  const result = insight(history.slice(0, 5));
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].kind, 'fresh-angle');
  assert.equal(result.proposals[0].contentType, 'Fresh angle');
  assert.ok(result.proposals[0].title.startsWith(history[4].title));
  assert.match(result.recommendation, /change the opening or format/);
});

test('maintenance suggests a real monthly post and does not silently schedule or drop the service', () => {
  const posts = JSON.parse(JSON.stringify(history));
  const result = insight(posts);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].kind, 'maintenance');
  assert.equal(result.proposals[0].contentType, 'Insight');
  assert.equal(result.proposals[0].date, '2026-10-06', 'Thirty days after last service post, not a weekly beat.');
  assert.deepEqual(posts, history, 'Building a suggestion must not mutate posts.');
  assert.match(result.recommendation, /monthly check-in/);
});

test('approved retry/fresh/monthly suggestions are reused instead of duplicated', () => {
  for (const length of [4, 5, 6]) {
    const posts = history.slice(0, length);
    const proposal = insight(posts).proposals[0];
    const approved = {
      ...post(10, undefined), id: 'approved', title: proposal.title, date: proposal.date,
      contentType: proposal.contentType, sourcePostId: proposal.sourcePostId, suggestionKind: proposal.kind,
    };
    const result = insight([...posts, approved]);
    assert.equal(result.proposals.length, 0);
    assert.equal(result.beats[0].existingPostId, 'approved');
  }
});

test('a manually scheduled upcoming service post covers maintenance without adding more posts', () => {
  const upcoming = post(10, undefined, { id: 'planned', date: '2026-10-20' });
  const result = insight([...history, upcoming]);
  assert.equal(result.proposals.length, 0);
  assert.equal(result.beats[0].existingPostId, 'planned');
  assert.deepEqual(insight(history).proposals.map((proposal) => proposal.date), ['2026-10-06']);
});

test('a distant future calendar post does not suppress the intervening monthly presence', () => {
  const distant = post(10, undefined, { id: 'distant', date: '2026-12-02' });
  const result = insight([...history, distant]);
  assert.equal(result.proposals[0].date, '2026-10-06');
  const conversionPosts = [...history, distant].map((p) => ({
    ...p, performance: p.performance.views === undefined ? undefined : { views: p.performance.views, saves: 10, bookings: 0 },
  }));
  assert.equal(buildConversionReview(history.at(-1), conversionPosts, '2026-10-02').proposal.date, '2026-10-06');
});

test('new posts for a service inherit its suggestion policy; other services remain ordinary', () => {
  const logged = post(10, undefined, { date: '2026-10-02' });
  assert.equal(buildActionInsight('logged', logged, [...history.slice(0, 4), logged], '2026-10-02').proposals[0].kind, 'repost');
  const otherService = { ...logged, project: 'Divorce' };
  assert.ok(buildActionInsight('logged', otherService, [...history, otherService], '2026-10-02').proposals.every((proposal) => proposal.kind === 'automatic'));
});

test('good results restore the ordinary sequence, and a fresh weak run starts over', () => {
  const recovered = [...history, post(7, 1000)];
  assert.ok(insight(recovered).proposals.every((proposal) => proposal.kind === 'automatic'));
  assert.equal(state([...recovered, post(8, 10)]).action, 'none');
  assert.equal(state([...recovered, post(8, 10), post(9, 10)]).action, 'repost');
});

test('occupied dates are nudged, and a full window disables Add instead of overbooking', () => {
  const retry = insight(history.slice(0, 4), ['2026-10-04']);
  assert.equal(retry.proposals[0].date, '2026-10-05');
  const full = Array.from({ length: 8 }, (_, index) => `2026-10-${String(index + 4).padStart(2, '0')}`);
  const blocked = insight(history.slice(0, 4), full);
  assert.equal(blocked.proposals.length, 0);
  assert.equal(blocked.beats[0].state, 'blocked');
});

test('visible insight fields contain no counter, strike labels or ladder badges', () => {
  for (const length of [3, 4, 5, 6]) {
    const result = insight(history.slice(0, length));
    const visible = [result.title, result.evidence, result.recommendation,
      ...result.beats.flatMap((beat) => [beat.title, beat.contentType])].join(' ');
    assert.doesNotMatch(visible, /strike|streak|ladder|underperform|maintenance|scoreboard/i);
    assert.equal('streak' in result, false);
  }
});

test('conversion trust/offer recommendations preserve their sequence but respect monthly pacing', () => {
  const weakConversion = history.map((p) => ({ ...p, performance: { ...p.performance, bookings: 0 } }));
  const result = buildConversionReview(weakConversion.at(-1), weakConversion, '2026-10-02');
  assert.equal(result.proposal.kind, 'trust');
  assert.equal(result.proposal.date, '2026-10-06');
});