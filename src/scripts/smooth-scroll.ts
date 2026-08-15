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

  // In-page anchors have to go through Lenis or they jump while it interpolates.
  document.addEventListener('click', (e) => {
    const link = (e.target as Element | null)?.closest?.(
      'a[href^="#"], a[href^="/#"]'
    ) as HTMLAnchorElement | null;
    if (!link) return;

    const hash = link.getAttribute('href')?.split('#')[1];
    if (!hash) return;

    const target = document.getElementById(hash);
    if (!target) return;

    e.preventDefault();
    lenis.scrollTo(target, { offset: -80 });
    // Keep the URL and the back button honest.
    history.pushState(null, '', `#${hash}`);
  });
}
