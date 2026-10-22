import { Sparkles, X } from 'lucide-react';
import type { AppNotification } from '@/lib/notifications';

type Props = {
  notification: AppNotification;
  onYes: (notification: AppNotification) => void;
  onNotNow: (notification: AppNotification) => void;
  onDismiss: (notification: AppNotification) => void;
};

export function CampaignWakeupBanner({ notification, onYes, onNotNow, onDismiss }: Props) {
  return (
    <aside className="campaign-wakeup-banner" aria-label="Campaign wake-up">
      <span className="campaign-wakeup-mark" aria-hidden="true"><Sparkles size={17} /></span>
      <div className="campaign-wakeup-copy">
        <p>Campaign wake-up</p>
        <h2>{notification.title}</h2>
        <span>{notification.subtitle}</span>
      </div>
      <div className="campaign-wakeup-actions">
        <button className="campaign-wakeup-yes" onClick={() => onYes(notification)} type="button">Yes</button>
        <button className="campaign-wakeup-later" onClick={() => onNotNow(notification)} type="button">Not now</button>
      </div>
      <button
        className="campaign-wakeup-dismiss"
        aria-label="Dismiss Campaign wake-up and save it to notifications"
        onClick={() => onDismiss(notification)}
        type="button"
      >
        <X size={15} />
      </button>
    </aside>
  );
}
