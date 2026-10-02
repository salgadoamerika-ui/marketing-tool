import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildActionInsight } from '../src/lib/action-insight.ts';
import { buildConversionReview } from '../src/lib/conversion-review.ts';
import { getCampaignPhase, getPacedSuggestionDate, describeContentPacing } from '../src/lib/content-pacing.ts';

const service = { id: 'b:s', businessId: 'b', name: 'Advice', mode: 'evergreen' };
const campaign = { id: 'b:c', businessId: 'b', name: 'Fall intake', mode: 'campaign', startDate: '2026-09-01', endDate: '2026-11-30' };
const source = (project, date, extras = {}) => ({
  id: `source-${project}-${date}`, businessId: 'b', project, date, title: 'A useful introduction', contentType: 'Insight', ...extras,
});
const insight = (offering, date, posts, offerings = [offering]) => {
  const post = posts?.at(-1) ?? source(offering.name, date);
  return buildActionInsight('logged', post, posts ?? [post], date, [], offerings);
};

test('Campaign phase boundaries include deadline minus 14 and the deadline day, not the day after', () => {
  assert.equal(getCampaignPhase(campaign, '2026-08-31'), 'upcoming');
  assert.equal(getCampaignPhase(campaign, '2026-09-10'), 'early');
  assert.equal(getCampaignPhase(campaign, '2026-11-15'), 'middle');
  assert.equal(getCampaignPhase(campaign, '2026-11-16'), 'closing');
  assert.equal(getCampaignPhase(campaign, '2026-11-30'), 'closing');
  assert.equal(getCampaignPhase(campaign, '2026-12-01'), 'closed');
});

test('Campaigns move from awareness to proof to a closer-spaced conversion close', () => {
  const early = insight(campaign, '2026-09-05').proposals;
  assert.deepEqual(early.map((p) => p.contentType), ['Announcement', 'Inside look']);
  assert.deepEqual(early.map((p) => p.date), ['2026-09-12', '2026-09-19']);
  const middle = insight(campaign, '2026-10-25').proposals;
  assert.deepEqual(middle.map((p) => p.contentType), ['Testimonial', 'Proof']);
  assert.deepEqual(middle.map((p) => p.date), ['2026-10-29', '2026-11-02']);
  const close = insight(campaign, '2026-11-20').proposals;
  assert.deepEqual(close.map((p) => p.contentType), ['Pricing', 'Book now', 'Last chance']);
  assert.deepEqual(close.map((p) => p.date), ['2026-11-22', '2026-11-24', '2026-11-26']);
  assert.ok(close.every((p) => p.title.includes(campaign.endDate)));
});

test('A proposal crossing into the final window uses closing content immediately', () => {
  const moves = insight(campaign, '2026-11-14').proposals;
  assert.equal(moves[0].date, '2026-11-16');
  assert.equal(moves[0].contentType, 'Pricing');
});

test('Campaign suggestions never precede the start or exceed the deadline, including retries and collision nudges', () => {
  assert.ok(insight(campaign, '2026-08-01').proposals.every((p) => p.date >= campaign.startDate));
  assert.deepEqual(insight(campaign, '2026-11-29').proposals.map((p) => p.date), ['2026-11-30']);
  assert.equal(insight(campaign, '2026-12-01').proposals.length, 0);
  const skipped = source(campaign.name, '2026-11-29', { status: 'skipped' });
  assert.equal(insight(campaign, '2026-12-01', [skipped]).proposals.length, 0);
  assert.equal(getPacedSuggestionDate(campaign, [campaign], [], '2026-11-29', '2026-11-30', ['2026-11-30']), undefined);
});

test('Healthy Services sustain a weekly rotation without a ramp or an end date', () => {
  const moves = insight(service, '2029-01-01').proposals;
  assert.deepEqual(moves.map((p) => p.date), ['2029-01-08', '2029-01-15']);
  assert.deepEqual(moves.map((p) => p.contentType), ['Book now', 'Testimonial']);
  assert.doesNotMatch(JSON.stringify(insight(service, '2029-01-01')), /evergreen|ramp/i);
});

test('Services ease toward their floor during closing, then recover automatically without changing approved posts', () => {
  const post = source(service.name, '2026-11-16');
  const posts = [post];
  const before = JSON.stringify(posts);
  const quiet = insight(service, '2026-11-16', posts, [service, campaign]);
  assert.deepEqual(quiet.proposals.map((p) => p.date), ['2026-12-01']);
  assert.equal(quiet.proposals.length, 1);
  const normal = insight(service, '2026-12-01', posts, [service, campaign]);
  assert.deepEqual(normal.proposals.map((p) => p.date), ['2026-12-08', '2026-12-15']);
  assert.equal(JSON.stringify(posts), before);
});

test('An overdue Service floor gets a useful post even inside the Campaign close', () => {
  const post = source(service.name, '2026-10-15');
  const moves = insight(service, '2026-11-16', [post], [service, campaign]).proposals;
  assert.equal(moves.length, 1);
  assert.equal(moves[0].kind, 'maintenance');
  assert.equal(moves[0].date, '2026-11-18');
});

test('Other businesses do not throttle Services; overlapping Campaigns release priority after the last close', () => {
  const post = source(service.name, '2026-11-15');
  const other = { ...campaign, id: 'other', businessId: 'other' };
  assert.equal(insight(service, '2026-11-16', [post], [service, other]).proposals[0].date, '2026-11-23');
  const later = { ...campaign, id: 'later', name: 'Winter intake', endDate: '2026-12-05' };
  const peakPost = source(service.name, '2026-11-22');
  assert.equal(insight(service, '2026-11-23', [peakPost], [service, campaign, later]).proposals[0].date, '2026-12-06');
});

test('Three measured results are still needed for the overperformer cadence and its evidence', () => {
  const posts = [0, 0, 1000].map((views, index) => source(service.name, `2026-09-0${index + 1}`,
    { id: `measured-${index}`, performance: { views, saves: 0, bookings: 0 } }));
  const gated = insight(service, '2026-09-03', posts.slice(1));
  assert.equal(gated.proposals[0].date, '2026-09-10');
  assert.doesNotMatch(gated.recommendation, /twice the average/);
  const learned = insight(service, '2026-09-03', posts);
  assert.equal(learned.proposals[0].date, '2026-09-08');
  assert.equal(learned.proposals[0].contentType, 'Fresh angle');
  assert.match(learned.recommendation, /at least twice the usual views/);
});

test('Approved moves are recognized rather than duplicated on the next request', () => {
  const post = source(service.name, '2026-09-01');
  const approved = insight(service, post.date, [post]).proposals.map((p, index) => ({
    ...post, ...p, id: `approved-${index}`, suggestionKind: p.kind,
  }));
  const next = buildActionInsight('logged', post, [post, ...approved], post.date, [], [service]);
  assert.equal(next.proposals.length, 0);
  assert.ok(next.beats.every((beat) => beat.state === 'scheduled'));
});

test('A matching approved suggestion on an earlier or later date is proposed as an in-place move', () => {
  const post = source(service.name, '2026-09-01');
  for (const priorDate of ['2026-09-05', '2026-09-12']) {
    const previous = {
      ...post, id: `approved-${priorDate}`, contentType: 'Book now', title: 'Previously approved booking post',
      date: priorDate, schedulingStatus: 'approved-suggestion', sourcePostId: 'earlier-source',
    };
    const plan = buildActionInsight('logged', post, [post, previous], '2026-09-02', [], [service]);
    assert.deepEqual(plan.proposals[0].replaces, {
      postId: previous.id, title: previous.title, contentType: previous.contentType, date: previous.date,
    });
    assert.equal(plan.proposals[0].date, '2026-09-09');
    assert.equal(plan.proposals[0].contentType, previous.contentType);
  }
});

test('Manual or measured posts are never moved by a new date suggestion', () => {
  const post = source(service.name, '2026-09-01');
  const manual = {
    ...post, id: 'manual-booking', contentType: 'Book now', title: 'Manual booking post',
    date: '2026-09-05',
  };
  const plan = buildActionInsight('logged', post, [post, manual], '2026-09-02', [], [service]);
  assert.ok(plan.proposals.every((proposal) => !proposal.replaces));
  assert.ok(plan.beats.some((beat) => beat.state === 'scheduled' && beat.existingPostId === manual.id));

  const measured = {
    ...manual, id: 'measured-booking', schedulingStatus: 'approved-suggestion',
    sourcePostId: 'earlier-source', performance: { views: 100 },
  };
  const measuredPlan = buildActionInsight('logged', post, [post, measured], '2026-09-02', [], [service]);
  assert.ok(measuredPlan.proposals.every((proposal) => !proposal.replaces));
});

test('The quiet flat-post ladder and persistent maintenance still control Service suggestions', () => {
  const measured = [1000, 1000, 10, 10, 10, 10].map((views, index) =>
    source(service.name, `2026-09-0${index + 1}`, { id: `flat-${index}`, performance: { views, saves: 0, bookings: 0 } }));
  const second = insight(service, '2026-09-04', measured.slice(0, 4));
  assert.equal(second.proposals[0].kind, 'repost');
  const third = insight(service, '2026-09-05', measured.slice(0, 5));
  assert.equal(third.proposals[0].kind, 'fresh-angle');
  const floor = insight(service, '2026-09-06', measured);
  assert.equal(floor.proposals[0].kind, 'maintenance');
  assert.equal(floor.proposals[0].date, '2026-10-06');
  assert.doesNotMatch(JSON.stringify(floor), /streak|strike|counter/i);
  const recovered = [...measured, source(service.name, '2026-09-07', { id: 'recovery', performance: { views: 1000, saves: 5, bookings: 1 } })];
  assert.notEqual(insight(service, '2026-09-07', recovered).proposals[0].kind, 'maintenance');
});

test('Conversion interventions retain the three-result gate, trust-first approval, floor, and cutoff', () => {
  const posts = [17, 18, 19].map((day) => source(service.name, `2026-11-${day}`, {
    id: `gap-${day}`, performance: { views: 300, saves: 20, bookings: 1 },
  }));
  assert.equal(buildConversionReview(posts[1], posts.slice(0, 2), '2026-11-20', [], [service, campaign]).proposal, undefined);
  const trust = buildConversionReview(posts[2], posts, '2026-11-20', [], [service, campaign]);
  assert.equal(trust.proposal.kind, 'trust');
  assert.equal(trust.proposal.date, '2026-12-01');
  const approvedTrust = { ...posts[2], id: 'trust', date: trust.proposal.date,
    sourcePostId: posts[2].id, suggestionKind: 'trust', performance: undefined };
  const waiting = buildConversionReview(posts[2], [...posts, approvedTrust], '2026-11-20', [], [service, campaign]);
  assert.equal(waiting.stage, 'waiting-trust');
  assert.equal(waiting.proposal, undefined);
  const campaignPosts = posts.map((post) => ({ ...post, project: campaign.name }));
  assert.equal(buildConversionReview(campaignPosts[2], campaignPosts, '2026-12-01', [], [campaign]).proposal, undefined);
  assert.doesNotMatch(describeContentPacing(service, [service], '2026-12-01'), /evergreen/);
});

test('A Service with only pre-peak history still gets a light presence during the close', () => {
  const post = source(service.name, '2026-11-15');
  const proposals = insight(service, '2026-11-16', [post], [service, campaign]).proposals;
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].kind, 'maintenance');
  assert.ok(proposals[0].date >= '2026-11-16' && proposals[0].date <= campaign.endDate);
  assert.equal(getPacedSuggestionDate(service, [service, campaign], [post], '2026-11-29', '2026-12-15'), '2026-11-30');
});