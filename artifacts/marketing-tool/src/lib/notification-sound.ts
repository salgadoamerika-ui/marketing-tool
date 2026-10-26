import type { AppNotification } from './notifications';
import type { PerformanceInsight } from './action-insight';

export const notificationSoundStorageKey = 'marketing-tool.notification-sound-enabled';

export function parseSoundPreference(value: string | null) {
  return value !== 'false';
}

export function performanceAttentionKey(businessId: string, project: string, insight: PerformanceInsight) {
  const text = JSON.stringify([businessId, project, insight.title, insight.evidence, insight.recommendation]);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `performance:${businessId}:${(hash >>> 0).toString(36)}`;
}

export function isAttentionNotification(notification: AppNotification) {
  if (notification.kind === 'insight') return Boolean(notification.attentionEventKey);
  return notification.kind === 'campaign-wakeup'
    && notification.action?.kind === 'campaign-wakeup'
    && !notification.bannerDismissed;
}

const eventKey = (notification: AppNotification) =>
  notification.attentionEventKey ?? notification.dedupeKey ?? notification.id;

/** Hydration, business switching, read-state changes, and refreshed entries are silent. */
export class NotificationSoundInbox {
  private ids: Set<string>;
  private events: Set<string>;

  constructor(initial: AppNotification[]) {
    this.ids = new Set(initial.map((item) => item.id));
    this.events = new Set(initial.map(eventKey));
  }

  receive(notifications: AppNotification[], businessId: string) {
    let attention = false;
    for (const notification of notifications) {
      const key = eventKey(notification);
      const fresh = !this.ids.has(notification.id) && !this.events.has(key);
      this.ids.add(notification.id);
      this.events.add(key);
      if (fresh && notification.businessId === businessId && isAttentionNotification(notification)) attention = true;
    }
    return attention;
  }
}

/** No asset download, no autoplay queue, and never more than one short chime at a time. */
export class SoftNotificationChime {
  private context?: AudioContext;
  private unlocked = false;
  private enabled = true;
  private disposed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private lastPlayed = -Infinity;
  private voices: OscillatorNode[] = [];
  private createContext: () => AudioContext | undefined;

  constructor(createContext: () => AudioContext | undefined) {
    this.createContext = createContext;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.cancelPending();
      this.stopVoices();
    }
  }

  unlock() {
    if (this.disposed) return;
    this.unlocked = true;
    if (!this.enabled) return;
    try {
      this.context ??= this.createContext();
      if (this.context?.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      // Unsupported audio, denied autoplay, or device failures must never affect the app.
    }
  }

  notify() {
    if (this.disposed || !this.enabled || !this.unlocked || this.context?.state !== 'running'
      || this.timer !== undefined || Date.now() - this.lastPlayed < 1200) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.disposed || !this.enabled || this.context?.state !== 'running') return;
      try {
        const context = this.context;
        const start = context.currentTime;
        const voices = [880, 1760].map((frequency, index) => {
          const oscillator = context.createOscillator();
          const envelope = context.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency, start);
          envelope.gain.setValueAtTime(0, start);
          envelope.gain.linearRampToValueAtTime(index === 0 ? 0.065 : 0.012, start + 0.015);
          envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.65);
          envelope.gain.linearRampToValueAtTime(0, start + 0.72);
          oscillator.connect(envelope);
          envelope.connect(context.destination);
          oscillator.onended = () => {
            oscillator.disconnect();
            envelope.disconnect();
            this.voices = this.voices.filter((voice) => voice !== oscillator);
          };
          return oscillator;
        });
        this.voices.push(...voices);
        voices.forEach((voice) => { voice.start(start); voice.stop(start + 0.74); });
        this.lastPlayed = Date.now();
      } catch {
        this.stopVoices();
      }
    }, 180);
  }

  private cancelPending() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private stopVoices() {
    this.voices.forEach((voice) => { try { voice.stop(); } catch { /* Already ended. */ } });
    this.voices = [];
  }

  dispose() {
    this.disposed = true;
    this.cancelPending();
    this.stopVoices();
    try { void this.context?.close().catch(() => {}); } catch { /* No available audio device. */ }
  }
}
