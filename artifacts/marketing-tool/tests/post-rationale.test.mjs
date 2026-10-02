import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPostRationale } from '../src/lib/post-rationale.ts';
import { buildActionInsight } from '../src/lib/action-insight.ts';

const service = { id: 's', businessId: 'b', name: 'Advice', mode: 'evergreen' };
const campaign = { id: 'c', businessId: 'b', name: 'Intake', mode: 'campaign', startDate: '2026-09-01', endDate: '2026-11-30' };
const post = (contentType, date, extras = {}) => ({
  id: `${contentType}-${date}`, businessId: 'b', project: 'Intake', contentType, date, title: contentType, ...extras,
});

test('Closing reasoning explains paid bookings and the actual content without exposing cadence', () => {
  const text = buildPostRationale(post('Pricing', '2026-11-20'), [], '2026-11-20', [campaign]);
  assert.match(text, /final two weeks/);
  assert.match(text, /paid bookings/);
  assert.match(text, /what booking costs/);
  assert.doesNotMatch(text, /cadence|rhythm|weekly|monthly|every two|floor|streak/i);
  assert.ok(text.length < 700);
});

test('Rationale changes with awareness, proof, closing and Service purpose', () => {
  assert.match(buildPostRationale(post('Announcement', '2026-09-03'), [], '2026-09-03', [campaign]), /introduction stage/);
  assert.match(buildPostRationale(post('Testimonial', '2026-10-25'), [], '2026-10-25', [campaign]), /reasons to believe/);
  assert.match(buildPostRationale(post('Insight', '2026-11-20', { project: service.name }), [], '2026-11-20', [service]), /ongoing offer/);
  assert.match(buildPostRationale(post('Insight', '2026-11-20', { project: service.name }), [], '2026-11-20', [service, campaign]), /visible alongside/);
});

test('Performance interpretation waits for evidence and ignores other businesses and future results', () => {
  const history = [0, 0, 1000].map((views, index) => post('Insight', `2026-09-0${index + 1}`, {
    id: `result-${index}`, project: service.name, performance: { views },
  }));
  const followup = post('Fresh angle', '2026-09-10', { project: service.name, sourcePostId: history[2].id });
  assert.doesNotMatch(buildPostRationale(followup, history.slice(1), '2026-09-03', [service]), /twice/);
  assert.match(buildPostRationale(followup, history, '2026-09-03', [service]), /twice the usual/);
  const unusable = [history[2], { ...history[0], businessId: 'other' }, { ...history[1], date: '2026-10-01' }];
  assert.doesNotMatch(buildPostRationale(followup, unusable, '2026-09-03', [service]), /twice|less attention/);
});

test('Conversion data is explained as interest not becoming bookings, without invented claims', () => {
  const history = [1, 2, 3].map((day) => post('Insight', `2026-09-0${day}`, {
    id: `gap-${day}`, performance: { views: 300, saves: 20, bookings: 1 },
  }));
  assert.match(buildPostRationale(post('Testimonial', '2026-09-10'), history, '2026-09-03', [campaign]), /bookings have not kept up/);
  assert.doesNotMatch(buildPostRationale(post('Testimonial', '2026-09-10'), history.slice(0, 2), '2026-09-03', [campaign]), /bookings have not kept up/);
});

test('An unrelated calendar content type cannot claim to cover the suggested move', () => {
  const source = post('Announcement', '2026-09-01');
  const unrelated = post('Book now', '2026-09-05', { title: 'Actual existing booking post' });
  const plan = buildActionInsight('logged', source, [source, unrelated], source.date, [], [campaign]);
  assert.equal(plan.beats[0].state, 'suggested');
  assert.equal(plan.beats[0].contentType, 'Inside look');
  assert.ok(plan.proposals.length > 0);
  assert.ok(!plan.beats.some((beat) => beat.existingPostId === unrelated.id));
});

test('A matched calendar post uses its actual identity, title, content and date and is not re-added', () => {
  const source = post('Announcement', '2026-09-01');
  const existing = post('Inside look', '2026-09-08', { id: 'real-calendar-post', title: 'Our actual team tour' });
  const plan = buildActionInsight('logged', source, [source, existing], source.date, [], [campaign]);
  assert.deepEqual(plan.beats[0], {
    state: 'scheduled', existingPostId: existing.id, contentType: existing.contentType,
    title: existing.title, date: existing.date,
  });
  assert.ok(!plan.proposals.some((proposal) => proposal.contentType === existing.contentType));
});

test('Outdated generated Campaign suggestions are proposed as updates, never changed without approval', () => {
  const source = post('Announcement', '2026-11-20');
  const outdated = post('Inside look', '2026-11-27', {
    id: 'approved-old', title: 'The original plan', schedulingStatus: 'approved-suggestion', sourcePostId: source.id,
  });
  const before = JSON.stringify(outdated);
  const plan = buildActionInsight('completed', source, [source, outdated], source.date, [], [campaign]);
  assert.deepEqual(plan.proposals[0].replaces, {
    postId: outdated.id, title: outdated.title, contentType: outdated.contentType, date: outdated.date,
  });
  assert.equal(plan.proposals[0].contentType, 'Pricing');
  assert.equal(JSON.stringify(outdated), before);
  assert.equal(plan.proposals.filter((proposal) => proposal.replaces?.postId === outdated.id).length, 1);
  for (const preserved of [
    { ...outdated, schedulingStatus: 'published' }, { ...outdated, performance: { views: 100 } },
    { ...outdated, sourcePostId: 'another-source' }, { ...outdated, businessId: 'other' },
    { ...outdated, date: source.date },
  ]) {
    assert.ok(!buildActionInsight('completed', source, [source, preserved], source.date, [], [campaign])
      .proposals.some((proposal) => proposal.replaces));
  }
});