import type { ActionInsight } from '@/lib/action-insight';

export const notificationsStorageKey = 'marketing-tool.notifications';

export type NotificationKind = 'plan-change' | 'insight' | 'dismissed-banner' | 'campaign-wakeup';

export type NotificationAction =
  | {
    kind: 'calendar-post';
    label: string;
    postId: string;
    date: string;
  }
  | {
    kind: 'reopen-insight';
    label: string;
    sourcePostId: string;
    insight: ActionInsight;
  }
  | {
    kind: 'campaign-wakeup';
    label: string;
    campaignId: string;
    cycleKey: string;
    startDate: string;
    endDate: string;
  };

export type AppNotification = {
  id: string;
  businessId: string;
  dedupeKey?: string;
  icon: string;
  title: string;
  subtitle: string;
  kind: NotificationKind;
  createdAt: number;
  isRead: boolean;
  bannerDismissed?: boolean;
  action?: NotificationAction;
};

const validKinds = new Set<NotificationKind>([
  'plan-change', 'insight', 'dismissed-banner', 'campaign-wakeup',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNotificationAction(value: unknown): value is NotificationAction {
  if (!isRecord(value) || typeof value.kind !== 'string' || typeof value.label !== 'string') return false;
  if (value.kind === 'calendar-post') {
    return typeof value.postId === 'string' && typeof value.date === 'string';
  }
  if (value.kind === 'reopen-insight') {
    const insight = value.insight;
    return typeof value.sourcePostId === 'string'
      && isRecord(insight)
      && typeof insight.title === 'string'
      && typeof insight.evidence === 'string'
      && typeof insight.recommendation === 'string'
      && Array.isArray(insight.proposals)
      && Array.isArray(insight.beats);
  }
  if (value.kind === 'campaign-wakeup') {
    return typeof value.campaignId === 'string'
      && typeof value.cycleKey === 'string'
      && typeof value.startDate === 'string'
      && typeof value.endDate === 'string';
  }
  return false;
}

export function parseNotifications(serialized: string | null): AppNotification[] {
  if (!serialized) return [];
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is AppNotification =>
      isRecord(value)
      && typeof value.id === 'string'
      && typeof value.businessId === 'string'
      && typeof value.icon === 'string'
      && typeof value.title === 'string'
      && typeof value.subtitle === 'string'
      && typeof value.kind === 'string'
      && validKinds.has(value.kind as NotificationKind)
      && typeof value.createdAt === 'number'
      && typeof value.isRead === 'boolean'
      && (value.bannerDismissed === undefined || typeof value.bannerDismissed === 'boolean')
      && (value.dedupeKey === undefined || typeof value.dedupeKey === 'string')
      && (value.action === undefined || isNotificationAction(value.action)));
  } catch {
    return [];
  }
}

export function insightNotificationKey(businessId: string, insight: ActionInsight): string {
  const proposalDetails = insight.proposals.map((proposal) => [
    proposal.sourcePostId,
    proposal.kind,
    proposal.contentType,
    proposal.title,
    proposal.date,
  ]);
  const fingerprint = JSON.stringify({
    action: insight.action,
    title: insight.title,
    evidence: insight.evidence,
    recommendation: insight.recommendation,
    proposals: proposalDetails,
    performance: insight.performanceInsight,
  });
  let hash = 2166136261;
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = Math.imul(hash ^ fingerprint.charCodeAt(index), 16777619);
  }
  return `insight:${businessId}:${insight.sourcePostId ?? 'general'}:${(hash >>> 0).toString(36)}`;
}
