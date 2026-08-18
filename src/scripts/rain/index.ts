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
  const nameEl = document.querySelector<HTMLElement>('.hero__name');
  if (!nameEl || !lines.length) return [];

  const cs = getComputedStyle(nameEl);
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.textBaseline = 'alphabetic';

  /*
    Baselines are aligned from real font metrics rather than a guessed cap
    offset. Eyeballing a fraction of the size put the glyphs about 12px high
    of the type they land on, and the error scales with viewport width.

    Monospace cannot match both the width and the cap height of a proportional
    face — its advance is far wider — so width wins: the block occupies the
    same footprint, and the crossfade reads as the letterforms changing in
    place rather than the name jumping size.
  */
  const measureAscent = (font: string) => {
    probe.font = font;
    const m = probe.measureText('H');
    return m.fontBoundingBoxAscent ?? 0;
  };

  const domFont = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const domAscent = measureAscent(domFont);
  const domDescent = (() => {
    probe.font = domFont;
    return probe.measureText('H').fontBoundingBoxDescent ?? 0;
  })();
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize);
  const halfLeading = (lineHeight - (domAscent + domDescent)) / 2;

  // One size for both lines: monospace has a single advance, so the size is
  // shared and only the tracking differs per line.
  const sizes = lines.map((el) => {
    const r = el.getBoundingClientRect();
    return r.width / Math.max(1, el.textContent!.trim().length) / 0.6;
  });
  const size = Math.min(...sizes);
  const monoAscent = measureAscent(
    `600 ${size}px "JetBrains Mono", ui-monospace, monospace`
  );

  return lines.map((el) => {
    const r = el.getBoundingClientRect();
    const text = el.textContent?.trim() ?? '';
    const baseline = r.top - c.top + halfLeading + domAscent;
    return {
      text,
      x: r.left - c.left,
      // Canvas draws with textBaseline 'top', i.e. from the em-box top.
      y: baseline - monoAscent,
      pitch: r.width / Math.max(1, text.length),
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

  const nameCanvas = document.querySelector<HTMLCanvasElement>('[data-rain-name]');
  const rain = createRain(canvas, { reduced, clearEl, nameCanvas });
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
