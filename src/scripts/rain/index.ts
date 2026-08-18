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

  const size = parseFloat(cs.fontSize);
  const font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
  /* Display type is tracked, and CSS letter-spacing is not something canvas
     applies on its own. Carrying the value through is what keeps the drawn
     name the same width as the element it becomes. */
  const letterSpacing = parseFloat(cs.letterSpacing) || 0;

  probe.font = font;
  probe.textBaseline = 'alphabetic';

  const m = probe.measureText('M');
  const ascent = m.fontBoundingBoxAscent ?? size * 0.8;
  const descent = m.fontBoundingBoxDescent ?? size * 0.2;
  const lineHeight = parseFloat(cs.lineHeight) || size;
  const halfLeading = (lineHeight - (ascent + descent)) / 2;

  return lines.map((el) => {
    const r = el.getBoundingClientRect();
    const text = el.textContent ?? '';

    /*
      Per-letter positions come from the browser's own geometry — a Range over
      each character — not from measuring leading substrings.

      Prefix measurement cannot see the character that follows, so it misses
      every kerning pair: measureText('Whittak') has no idea an 'e' is coming,
      and the k-e kern that pulls it 5.5px left never gets applied. The same
      happened to the 'o' in Worland behind the W, at 8px. Every other letter
      in the name agreed to within 0.02px, which is exactly the signature of a
      kerning miss rather than a systematic offset.

      Ranges are ground truth by construction: whatever the browser will do
      when the real element takes over is what gets measured here.
    */
    const node = el.firstChild;
    const offsets: number[] = [];
    if (node && node.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      for (let i = 0; i < text.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        offsets.push(range.getBoundingClientRect().left - r.left);
      }
    } else {
      // No text node to range over; fall back to prefix measurement.
      for (let i = 0; i < text.length; i++) {
        offsets.push(probe.measureText(text.slice(0, i)).width + i * letterSpacing);
      }
    }

    return {
      text,
      x: r.left - c.left,
      /* The alphabetic baseline, not the em-box top. Canvas's 'top' baseline
         is the top of the em square, which is not necessarily the same metric
         the browser lays a line box out from — close enough to look right and
         far enough off to shift when the real element takes over. The
         baseline is unambiguous in both. */
      y: r.top - c.top + halfLeading + ascent,
      offsets,
      size,
      font,
      letterSpacing,
    };
  });
}

export function initRain(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-rain]');
  if (!canvas) return;

  const hero = document.getElementById('hero');
  const clearEls = Array.from(document.querySelectorAll<HTMLElement>('[data-rain-clear]'));
  const reduced = window.matchMedia(REDUCED).matches;

  const nameCanvas = document.querySelector<HTMLCanvasElement>('[data-rain-name]');
  const rain = createRain(canvas, { reduced, clearEls, nameCanvas });
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
