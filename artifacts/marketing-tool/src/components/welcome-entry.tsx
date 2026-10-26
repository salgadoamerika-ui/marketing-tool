import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveWelcomeName, welcomeNameStorageKey } from '@/lib/welcome-profile';
import { useCalendarEntrance } from '@/hooks/use-calendar-entrance';
import { firstRunStorageKey, shouldOfferFirstRun } from '@/lib/first-run';
import { FirstRunContext } from './first-run-context';
import { WelcomeScreen } from './welcome-screen';
import './welcome-entry.css';

/** Mounted above routing: changing a business, view, or route never restarts the greeting. */
export function WelcomeEntry({ children, userName, sampleServiceIds }: {
  children: ReactNode; userName?: string | null; sampleServiceIds: string[];
}) {
  const [startup] = useState(() => {
    const needsSetup = shouldOfferFirstRun(window.localStorage, sampleServiceIds);
    let hasFinishedSetup = false;
    try { hasFinishedSetup = Boolean(window.localStorage.getItem(firstRunStorageKey)); } catch { /* Preserve existing data. */ }
    return { needsSetup, isFreshWorkspace: needsSetup || hasFinishedSetup };
  });
  const [needsSetup, setNeedsSetup] = useState(startup.needsSetup);
  const finishSetup = useCallback(() => setNeedsSetup(false), []);
  const firstRun = useMemo(() => ({
    needsSetup, isFreshWorkspace: startup.isFreshWorkspace, finishSetup,
  }), [needsSetup, startup.isFreshWorkspace, finishSetup]);
  const [phase, setPhase] = useState<'welcome' | 'leaving' | 'entered'>('welcome');
  const [storedName] = useState(() => {
    try { return window.localStorage.getItem(welcomeNameStorageKey); }
    catch { return null; }
  });
  const contentRef = useRef<HTMLDivElement>(null);
  const isBlocking = phase !== 'entered';
  const calendarReady = phase === 'entered' && !needsSetup;
  useCalendarEntrance(contentRef, calendarReady, !needsSetup);

  useEffect(() => {
    if (!isBlocking) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isBlocking]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setPhase('entered'), reduceMotion ? 20 : 650);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === 'entered') contentRef.current?.focus({ preventScroll: true });
  }, [phase]);

  return (
    <FirstRunContext.Provider value={firstRun}>
      <div
        ref={contentRef}
        data-calendar-entry={calendarReady ? 'running' : 'waiting'}
        className={`welcome-app-content${phase !== 'welcome' ? ' welcome-app-content-visible' : ''}`}
        aria-hidden={isBlocking ? true : undefined}
        inert={isBlocking}
        tabIndex={-1}
      >
        {children}
      </div>
      {isBlocking && (
        <WelcomeScreen
          name={resolveWelcomeName(userName, storedName)}
          isLeaving={phase === 'leaving'}
          onEnter={() => setPhase((current) => current === 'welcome' ? 'leaving' : current)}
        />
      )}
    </FirstRunContext.Provider>
  );
}
