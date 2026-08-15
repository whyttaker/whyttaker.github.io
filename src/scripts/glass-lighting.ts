/*
  Feeds the pointer position into whichever glass surface is under it, as
  --mx/--my in element-local pixels. glass.css turns that into a specular
  highlight that tracks the cursor.

  Written as one delegated listener rather than a React hook so it covers every
  glass surface on the page — including ones rendered by Astro components that
  never hydrate — at the cost of a single rAF per frame of movement.
*/

const REDUCED = '(prefers-reduced-motion: reduce)';

export function initGlassLighting(): void {
  if (window.matchMedia(REDUCED).matches) return;

  let current: HTMLElement | null = null;
  let x = 0;
  let y = 0;
  let queued = false;

  const clear = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.removeProperty('--mx');
    el.style.removeProperty('--my');
  };

  const flush = () => {
    queued = false;
    if (!current) return;
    const r = current.getBoundingClientRect();
    current.style.setProperty('--mx', `${x - r.left}px`);
    current.style.setProperty('--my', `${y - r.top}px`);
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      // Touch has no hover state to light, and firing this on every touchmove
      // would cost a layout read per frame for no visible result.
      if (e.pointerType !== 'mouse') return;

      const target = e.target as Element | null;
      const el = (target?.closest?.('.glass') as HTMLElement | null) ?? null;

      if (el !== current) {
        clear(current);
        current = el;
      }
      if (!current) return;

      x = e.clientX;
      y = e.clientY;
      if (!queued) {
        queued = true;
        requestAnimationFrame(flush);
      }
    },
    { passive: true }
  );

  document.addEventListener('pointerleave', () => {
    clear(current);
    current = null;
  });
}
