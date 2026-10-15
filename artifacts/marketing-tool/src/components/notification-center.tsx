import { useEffect, useRef, useState } from 'react';
import { Bell, CalendarDays, Check, Sparkles, X } from 'lucide-react';
import type { AppNotification } from '@/lib/notifications';

type Props = {
  businessName: string;
  notifications: AppNotification[];
  unreadCount: number;
  onOpened: () => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onActivate: (notification: AppNotification) => void;
};

function notificationIcon(icon: string) {
  if (icon === 'calendar') return <CalendarDays size={16} strokeWidth={1.8} />;
  if (icon === 'check') return <Check size={16} strokeWidth={2} />;
  if (icon === 'sparkle') return <Sparkles size={16} strokeWidth={1.8} />;
  return <span aria-hidden="true">{icon || '✦'}</span>;
}

function formatNotificationTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function NotificationCenter({
  businessName,
  notifications,
  unreadCount,
  onOpened,
  onDismiss,
  onClearAll,
  onActivate,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const toggle = () => {
    if (!isOpen) onOpened();
    setIsOpen((current) => !current);
  };

  const ordered = [...notifications].sort((left, right) => right.createdAt - left.createdAt);

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="notification-bell"
        onClick={toggle}
        type="button"
      >
        <Bell size={17} strokeWidth={1.8} />
        {unreadCount > 0 && <span aria-label={`${unreadCount} unread`} className="notification-count">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>}
      </button>
      {isOpen && (
        <section aria-label={`${businessName} notifications`} className="notification-panel" role="dialog">
          <header className="notification-panel-header">
            <div>
              <p>Workspace updates</p>
              <h2>Notifications</h2>
            </div>
            <button
              className="notification-clear-all"
              disabled={ordered.length === 0}
              onClick={onClearAll}
              type="button"
            >
              Clear all
            </button>
          </header>
          {ordered.length === 0 ? (
            <p className="notification-empty">Nothing here yet. Plan changes and insights will collect here.</p>
          ) : (
            <div className="notification-list">
              {ordered.map((notification) => (
                <article
                  className={`notification-item${notification.isRead ? '' : ' notification-item-unread'}`}
                  key={notification.id}
                >
                  <span aria-hidden="true" className={`notification-item-icon notification-icon-${notification.kind}`}>
                    {notificationIcon(notification.icon)}
                  </span>
                  <div className="notification-item-content">
                    <div className="notification-item-heading">
                      <strong>{notification.title}</strong>
                      {!notification.isRead && <span aria-label="Unread" className="notification-unread-dot" />}
                      <button
                        aria-label={`Dismiss notification: ${notification.title}`}
                        className="notification-dismiss"
                        data-testid={`dismiss-notification-${notification.id}`}
                        onClick={() => onDismiss(notification.id)}
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <p>{notification.subtitle}</p>
                    <time dateTime={new Date(notification.createdAt).toISOString()}>
                      {formatNotificationTime(notification.createdAt)}
                    </time>
                    {notification.action && (
                      <button
                        className="notification-action"
                        data-testid={`notification-action-${notification.id}`}
                        onClick={() => {
                          setIsOpen(false);
                          onActivate(notification);
                        }}
                        type="button"
                      >
                        {notification.action.label}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
