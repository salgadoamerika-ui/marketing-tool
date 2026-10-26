import { type RefObject, useLayoutEffect } from 'react';
import { calendarRippleDelay, calendarRippleFinishMs } from '@/lib/calendar-entrance';
import './calendar-entrance.css';

/**
 * Decorate only the initially mounted chips. DOM order is calendar date order
 * (left to right, then the next row); subsequent posts and rerenders are untouched.
 * The paused CSS animation keeps posts hidden while the welcome screen exits.
 */
export function useCalendarEntrance(
  calendarRef: RefObject<HTMLDivElement | null>,
  hasEntered: boolean,
  prepare = true,
) {
  useLayoutEffect(() => {
    if (!prepare) return;
    const root = calendarRef.current;
    if (!root) return;
    let posts: HTMLElement[] = [];
    let attached = false;
    let observer: MutationObserver | undefined;
    let timer: number | undefined;
    const clearDecoration = () => {
      posts.forEach((post) => {
        post.classList.remove('calendar-post-ripple');
        post.style.removeProperty('--calendar-ripple-delay');
      });
    };
    const attachOnce = () => {
      if (attached || !root.querySelector('.calendar-grid, .week-post')) return;
      attached = true;
      observer?.disconnect();
      posts = Array.from(root.querySelectorAll<HTMLElement>('.calendar-grid .event-chip, .week-post'));
      posts.forEach((post, index) => {
        post.style.setProperty('--calendar-ripple-delay', `${calendarRippleDelay(index)}ms`);
        post.classList.add('calendar-post-ripple');
      });
      if (hasEntered) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        timer = window.setTimeout(clearDecoration, reduceMotion ? 0 : calendarRippleFinishMs(posts.length));
      }
    };
    attachOnce();
    if (!attached) {
      // Routing/context updates can commit the newly built calendar after its
      // outer entry shell. Watch only until that first grid actually exists.
      observer = new MutationObserver(attachOnce);
      observer.observe(root, { childList: true, subtree: true });
    }
    return () => {
      observer?.disconnect();
      window.clearTimeout(timer);
      clearDecoration();
    };
  }, [calendarRef, prepare, hasEntered]);
}
