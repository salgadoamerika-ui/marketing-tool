import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bestCampaignLearningPost,
  campaignCycleForYear,
  campaignNameForCycle,
  cycleForCampaignName,
  findDormantCampaignMatch,
  handledWakeCycle,
  isCampaignWakeCycleOpen,
  nextCampaignWakeCycle,
} from '../src/lib/campaign-wakeups.ts';
import { markExpiredCampaignsDormant, normalizeService } from '../src/lib/services.ts';
import { buildActionInsight } from '../src/lib/action-insight.ts';
import { getClosingCampaigns, getPacedSuggestionDate } from '../src/lib/content-pacing.ts';

const dormant = {
  id: 'summer-2026',
  businessId: 'mosaic',
  name: 'Summer Camp 2026',
  mode: 'campaign',
  startDate: '2026-06-01',
  endDate: '2026-08-31',
  status: 'dormant',
  dormantSince: '2026-09-01',
};

test('expired campaigns become dormant without dropping their dates or retained learning metadata', () => {
  const campaign = { ...dormant, status: 'active', wakeSourcePostId: 'post-7' };
  assert.deepEqual(markExpiredCampaignsDormant([campaign], '2026-09-01'), [
    { ...campaign, status: 'dormant', dormantSince: '2026-09-01' },
  ]);
  assert.deepEqual(normalizeService(campaign), campaign);
  const loadedLate = markExpiredCampaignsDormant([{ ...campaign, startDate: '2025-06-01', endDate: '2025-08-31' }], '2026-06-10')[0];
  assert.equal(loadedLate.dormantSince, '2025-09-01');
  assert.equal(isCampaignWakeCycleOpen(loadedLate, nextCampaignWakeCycle(loadedLate, '2026-06-10'), '2026-06-10'), true);
});

test('a campaign wake window follows the next full annual date range and stops after a handled cycle', () => {
  const next = nextCampaignWakeCycle(dormant, '2027-04-01');
  assert.deepEqual(next, {
    cycleKey: 'summer-2026:2027-06-01',
    startDate: '2027-06-01',
    endDate: '2027-08-31',
  });
  assert.equal(isCampaignWakeCycleOpen(dormant, next, '2027-05-31'), false);
  assert.equal(isCampaignWakeCycleOpen(dormant, next, '2027-06-01'), true);
  const handled = { ...dormant, wakeUpHandledCycles: handledWakeCycle(dormant, next.cycleKey) };
  assert.equal(isCampaignWakeCycleOpen(handled, next, '2027-06-01'), false);
  assert.equal(nextCampaignWakeCycle(dormant, '2027-09-01').startDate, '2028-06-01');
});

test('annual cycle calculation preserves campaign length and clamps leap-day starts safely', () => {
  const february = { ...dormant, startDate: '2024-02-29', endDate: '2024-03-10' };
  assert.deepEqual(campaignCycleForYear(february, 2025), {
    cycleKey: 'summer-2026:2025-02-28',
    startDate: '2025-02-28',
    endDate: '2025-03-10',
  });
});

test('closing a future Campaign cannot make it wake in a season before that planned cycle', () => {
  const future = { ...dormant, startDate: '2028-06-01', endDate: '2028-08-31', dormantSince: '2026-10-26' };
  assert.equal(nextCampaignWakeCycle(future, '2026-10-26').startDate, '2029-06-01');
});

test('year-matched campaign names find dormant campaigns only inside the same business', () => {
  const otherBusiness = { ...dormant, id: 'northline-summer', businessId: 'northline' };
  assert.equal(findDormantCampaignMatch('Summer Camp 2027', [dormant, otherBusiness], 'mosaic')?.id, dormant.id);
  assert.deepEqual(cycleForCampaignName(dormant, 'Summer Camp 2027', '2026-10-22'), {
    cycleKey: 'summer-2026:2027-06-01',
    startDate: '2027-06-01',
    endDate: '2027-08-31',
  });
  assert.equal(campaignNameForCycle(dormant.name, { cycleKey: 'x', startDate: '2027-06-01', endDate: '2027-08-31' }),
    'Summer Camp 2027');
  assert.equal(findDormantCampaignMatch('Summer Camp 2027', [otherBusiness], 'mosaic'), undefined);
});

test('wake plans use the strongest measured post first and retain a latest-post fallback', () => {
  const posts = [
    { id: 'low', businessId: 'mosaic', project: dormant.name, date: '2026-06-02', contentType: 'Announcement', performance: { views: 40, bookings: 0 } },
    { id: 'winner', businessId: 'mosaic', project: dormant.name, date: '2026-07-02', contentType: 'Proof', performance: { views: 500, bookings: 5 } },
    { id: 'other-business', businessId: 'northline', project: dormant.name, date: '2026-07-03', contentType: 'Insight', performance: { views: 900, bookings: 9 } },
  ];
  assert.equal(bestCampaignLearningPost(dormant, posts)?.id, 'winner');
  assert.equal(bestCampaignLearningPost(dormant, posts.slice(0, 1))?.id, 'low');
  const active = { ...dormant, status: 'active', startDate: '2027-06-01', endDate: '2027-08-31', wakeSourcePostId: 'winner' };
  const seed = { ...posts[1], date: '2027-06-01' };
  const next = buildActionInsight('completed', seed, posts, '2027-06-01', [], [active]);
  assert.equal(next.proposals[0]?.contentType, 'Proof');
});

test('manually dormant Campaigns cannot generate posts or throttle another Service before their old deadline', () => {
  const campaign = { ...dormant, startDate: '2026-06-01', endDate: '2026-08-31', dormantSince: '2026-08-20' };
  const post = { id: 'closed-post', businessId: 'mosaic', project: campaign.name, contentType: 'Announcement', date: '2026-08-20' };
  assert.equal(buildActionInsight('completed', post, [post], '2026-08-21', [], [campaign]).proposals.length, 0);
  assert.deepEqual(getClosingCampaigns([campaign], 'mosaic', '2026-08-21'), []);
  assert.equal(getPacedSuggestionDate(campaign, [campaign], [post], '2026-08-21', '2026-08-23'), undefined);
});

test('previous cycle metadata survives hydration without copying performance into a second store', () => {
  const campaign = {
    ...dormant,
    campaignHistory: [{
      name: 'Summer Camp 2025',
      startDate: '2025-06-01',
      endDate: '2025-08-31',
      closedAt: '2025-09-01',
      postIds: ['post-1', 'post-2'],
      platforms: ['Instagram'],
    }],
  };
  assert.deepEqual(normalizeService(campaign), campaign);
  assert.throws(() => normalizeService({ ...campaign, campaignHistory: [{ ...campaign.campaignHistory[0], endDate: '2025-01-01' }] }));
});
