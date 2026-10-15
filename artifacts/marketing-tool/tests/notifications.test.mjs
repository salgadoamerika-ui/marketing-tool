import assert from 'node:assert/strict';
import { test } from 'node:test';
import { insightNotificationKey, parseNotifications } from '../src/lib/notifications.ts';

test('notification storage accepts business-scoped campaign wake-ups and ignores malformed records', () => {
  const records = [
    {
      id: 'wake-up',
      businessId: 'mosaic',
      icon: 'calendar',
      title: 'Campaign halfway point',
      subtitle: 'Review the paid run.',
      kind: 'campaign-wakeup',
      createdAt: 100,
      isRead: false,
    },
    { id: 'bad-record', businessId: 'mosaic', kind: 'unknown' },
  ];
  assert.deepEqual(parseNotifications(JSON.stringify(records)), [records[0]]);
  assert.deepEqual(parseNotifications('{ broken json'), []);
});

test('insight notification keys remain stable for the same workspace and differ across businesses', () => {
  const insight = {
    action: 'completed',
    sourcePostId: 'post-1',
    title: 'A next step',
    evidence: 'One post was completed.',
    recommendation: 'Add a follow-up.',
    beats: [],
    proposals: [{
      sourcePostId: 'post-1',
      triggerPostId: 'post-1',
      kind: 'automatic',
      contentType: 'Book now',
      title: 'A booking post',
      date: '2026-10-23',
    }],
  };
  assert.equal(insightNotificationKey('mosaic', insight), insightNotificationKey('mosaic', insight));
  assert.notEqual(insightNotificationKey('mosaic', insight), insightNotificationKey('northline', insight));
});
