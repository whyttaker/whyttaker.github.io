import { createRain } from './engine';
import { subscribeScroll } from '../scroll-store';
import { handoffAt, heroProgress } from '../handoff';

/*
  Mounts the rain. Vanilla rather than a React island — the canvas needs a
  loop, a pointer and a scroll subscription, none of which React contributes
  anything to. Keeping it out of the island graph is why the hero now ships no
  component JavaScript at all.
*/

const REDUCED = '(prefers-reduced-motion: reduce)';

/**
 * Measures the two display-type lines so the rain can assemble the name on top
 * of them exactly.
 *
 * The glyph name has to match position, line break and optical size, or the
 * handover reads as a swap. Two adjustments earn their keep: monospace sits
 * lower in its em box than Archivo, so the draw origin is nudged up; and the
 * mono advance is ~0.6em, so matching the DOM line's *measured width* rather
 * than its font size is what keeps the two the same length on screen.
 */
function measureNameTargets(canvas: HTMLCanvasElement) {
  const lines = Array.from(
    document.querySelectorAll<HTMLElement>('[data-name-line]')
  );
  const c = canvas.getBoundingClientRect();

  return lines.map((el) => {
    const r = el.getBoundingClientRect();
    const text = el.textContent?.trim() ?? '';
    const pitch = r.width / Math.max(1, text.length);
    // Mono advance is about 0.6em, so this is the size that spans the same
    // width with the same number of characters.
    const size = pitch / 0.6;
    return {
      text,
      x: r.left - c.left,
      y: r.top - c.top - size * 0.12,
      pitch,
      size,
    };
  });
}

export function initRain(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-rain]');
  if (!canvas) return;

  const hero = document.getElementById('hero');
  const clearEl = document.querySelector<HTMLElement>('[data-rain-clear]');
  const reduced = window.matchMedia(REDUCED).matches;

  const rain = createRain(canvas, { reduced, clearEl });
  canvas.dataset.ready = '';

  if (reduced) {
    // The intro gate is set before paint by an inline script; if we are not
    // going to play one, it has to come off immediately or the hero stays dim.
    document.documentElement.removeAttribute('data-intro');
    return;
  }

  if (document.documentElement.hasAttribute('data-intro')) {
    rain.runIntro(
      () => measureNameTargets(canvas),
      () => document.documentElement.setAttribute('data-intro-reveal', ''),
      () => {
        document.documentElement.removeAttribute('data-intro');
        document.documentElement.removeAttribute('data-intro-reveal');
        try {
          sessionStorage.setItem('ww-intro', '1');
        } catch {
          // Private mode: the intro simply plays again next load.
        }
      }
    );
  }

  // Stop the loop when the hero is off screen. There is no reason to keep
  // painting a canvas nobody can see.
  const io = new IntersectionObserver(
    ([entry]) => rain.setRunning(entry.isIntersecting),
    { rootMargin: '10% 0px' }
  );
  io.observe(canvas);

  // Same handoff curve the glass hero used: the rain accelerates and its
  // trails lengthen as the hero scrolls away, then washes out.
  if (hero) {
    subscribeScroll(({ y }) => {
      const { close } = handoffAt(heroProgress(y, hero.offsetHeight));
      rain.setHandoff(close);
      canvas.style.setProperty('--handoff', String(1 - close));
    });
  }
}
