import Lenis from 'lenis';
import { publishScroll } from './scroll-store';

/*
  Lenis drives scrolling and, through it, the single rAF loop that every
  scroll-reactive thing on the page reads from.

  Under reduced motion Lenis is never constructed: smoothing scroll is exactly
  the kind of motion a visitor who set that preference is asking not to have.
  The store still publishes from native scroll events so the hero and handoff
  keep receiving position — they just resolve to discrete states instead of
  interpolated ones.
*/

const REDUCED = '(prefers-reduced-motion: reduce)';

/*
  How much space to leave above the scrolled-to heading. Matches the nav's
  own footprint (padding included) rather than a guessed constant, so the two
  can never drift apart if the nav's size changes later.
*/
function navClearance(): number {
  const nav = document.querySelector<HTMLElement>('.nav');
  return (nav?.getBoundingClientRect().height ?? 79) + 16;
}

export function initSmoothScroll(): void {
  if (window.matchMedia(REDUCED).matches) {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      publishScroll(y, y - last);
      last = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return;
  }

  const lenis = new Lenis({
    lerp: 0.085,
    wheelMultiplier: 1,
    touchMultiplier: 1.6,
    // Native scrolling on touch already has momentum from the OS; layering
    // Lenis on top of it fights the platform and feels laggy.
    syncTouch: false,
  });

  lenis.on('scroll', ({ scroll, velocity }: { scroll: number; velocity: number }) => {
    publishScroll(scroll, velocity);
  });

  const raf = (time: number) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  /*
    In-page anchors have to go through Lenis or they jump while it interpolates.

    The target is not the <section> itself. Every section has a large
    padding-block (--sp-section, up to 12rem) before its heading, and the
    section's own id sits on that outer element for scrollspy purposes — an
    IntersectionObserver elsewhere needs the full section height, not just the
    heading, to know which one is "current" while scrolling through it.
    Scrolling so the outer element's top clears the nav therefore left most of
    that top padding sitting empty between the nav and the actual heading,
    which is the gap that was visible after every nav click.

    The fix scrolls to the heading (.section-head) instead, computed as an
    absolute scroll position rather than through Lenis's own offset heuristic
    — that sidesteps having to reason about its offset sign convention and
    makes the target position exactly verifiable.
  */
  document.addEventListener('click', (e) => {
    const link = (e.target as Element | null)?.closest?.(
      'a[href^="#"], a[href^="/#"]'
    ) as HTMLAnchorElement | null;
    if (!link) return;

    const hash = link.getAttribute('href')?.split('#')[1];
    if (!hash) return;

    const section = document.getElementById(hash);
    if (!section) return;

    const heading = section.querySelector<HTMLElement>('.section-head');
    const target = heading ?? section;

    e.preventDefault();
    const clearance = navClearance();
    const destY =
      window.scrollY + target.getBoundingClientRect().top - clearance;
    lenis.scrollTo(Math.max(0, destY), { immediate: false });
    // Keep the URL and the back button honest.
    history.pushState(null, '', `#${hash}`);
  });
}
