import { type ReactNode, useEffect, useRef, useState } from 'react';
import { resolveWelcomeName, welcomeNameStorageKey } from '@/lib/welcome-profile';
import { WelcomeScreen } from './welcome-screen';
import './welcome-entry.css';

/** Mounted above routing: changing a business, view, or route never restarts the greeting. */
export function WelcomeEntry({ children, userName }: { children: ReactNode; userName?: string | null }) {
  const [phase, setPhase] = useState<'welcome' | 'leaving' | 'entered'>('welcome');
  const [storedName] = useState(() => {
    try { return window.localStorage.getItem(welcomeNameStorageKey); }
    catch { return null; }
  });
  const contentRef = useRef<HTMLDivElement>(null);
  const isBlocking = phase !== 'entered';

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
    <>
      <div
        ref={contentRef}
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
    </>
  );
}
