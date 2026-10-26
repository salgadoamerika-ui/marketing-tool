import { useEffect, useRef, useState } from 'react';
import type { AppNotification } from '@/lib/notifications';
import {
  NotificationSoundInbox,
  SoftNotificationChime,
  notificationSoundStorageKey,
  parseSoundPreference,
} from '@/lib/notification-sound';

export function useNotificationSound(notifications: AppNotification[], businessId: string) {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return parseSoundPreference(window.localStorage.getItem(notificationSoundStorageKey)); }
    catch { return true; }
  });
  const enabledRef = useRef(soundEnabled);
  const inboxRef = useRef<NotificationSoundInbox | null>(null);
  const chimeRef = useRef<SoftNotificationChime | null>(null);
  if (!inboxRef.current) inboxRef.current = new NotificationSoundInbox(notifications);

  useEffect(() => {
    const chime = new SoftNotificationChime(() => {
      const AudioContextConstructor = window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      return AudioContextConstructor ? new AudioContextConstructor() : undefined;
    });
    chime.setEnabled(enabledRef.current);
    chimeRef.current = chime;
    const unlock = () => chime.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      chime.dispose();
      chimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (inboxRef.current?.receive(notifications, businessId)) chimeRef.current?.notify();
  }, [notifications, businessId]);

  const toggleSound = () => {
    const enabled = !enabledRef.current;
    enabledRef.current = enabled;
    setSoundEnabled(enabled);
    chimeRef.current?.setEnabled(enabled);
    if (enabled) chimeRef.current?.unlock();
    try { window.localStorage.setItem(notificationSoundStorageKey, String(enabled)); }
    catch { /* The toggle still works for this visit when storage is unavailable. */ }
  };

  return { soundEnabled, toggleSound };
}
