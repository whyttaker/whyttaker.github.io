/*
  Magnetic controls: elements marked [data-magnetic] lean toward the pointer
  when it comes near, and spring back when it leaves.

  The pull is capped well below the pointer's actual offset (0.28) and the
  element never travels more than a few px. A control that chases the cursor
  properly stops being a target you can click.
*/

const REDUCED = '(prefers-reduced-motion: reduce)';

/** How far outside its own box an element starts reacting. */
const FIELD = 90;
/** Fraction of the pointer offset the element follows. */
const PULL = 0.28;
/** Spring constants — snappy, since these are small controls. */
const STIFFNESS = 0.16;
const DAMPING = 0.72;

interface Magnet {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
}

export function initMagnetic(): void {
  if (window.matchMedia(REDUCED).matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  /* The registry has to be live, not a one-time query: islands hydrate after
     this runs (the copy control is client:visible), so anything scanned at
     load would miss them. */
  const registry = new Map<HTMLElement, Magnet>();

  const sync = () => {
    const found = new Set(
      document.querySelectorAll<HTMLElement>('[data-magnetic]')
    );
    for (const el of found) {
      if (!registry.has(el)) {
        registry.set(el, { el, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 });
      }
    }
    for (const el of registry.keys()) {
      if (!found.has(el)) registry.delete(el);
    }
  };

  sync();

  let syncQueued = false;
  new MutationObserver(() => {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      sync();
    });
  }).observe(document.body, { childList: true, subtree: true });

  let running = false;

  const step = () => {
    let alive = false;

    for (const m of registry.values()) {
      const dx = m.tx - m.x;
      const dy = m.ty - m.y;

      m.vx = (m.vx + dx * STIFFNESS) * DAMPING;
      m.vy = (m.vy + dy * STIFFNESS) * DAMPING;
      m.x += m.vx;
      m.y += m.vy;

      // Park the element exactly at rest instead of asymptotically near it,
      // so we can stop the loop and stop compositing.
      if (
        Math.abs(dx) < 0.05 &&
        Math.abs(dy) < 0.05 &&
        Math.abs(m.vx) < 0.05 &&
        Math.abs(m.vy) < 0.05
      ) {
        m.x = m.tx;
        m.y = m.ty;
        m.vx = 0;
        m.vy = 0;
      } else {
        alive = true;
      }

      // Written as custom properties, not as `transform`, so an element can
      // compose the offset with its own transforms — the copy button's press
      // scale would otherwise be overwritten every frame.
      if (m.x === 0 && m.y === 0) {
        m.el.style.removeProperty('--mag-x');
        m.el.style.removeProperty('--mag-y');
      } else {
        m.el.style.setProperty('--mag-x', `${m.x.toFixed(2)}px`);
        m.el.style.setProperty('--mag-y', `${m.y.toFixed(2)}px`);
      }
    }

    if (alive) {
      requestAnimationFrame(step);
    } else {
      running = false;
    }
  };

  const kick = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(step);
  };

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;

      for (const m of registry.values()) {
        const r = m.el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;

        const withinX = Math.abs(dx) < r.width / 2 + FIELD;
        const withinY = Math.abs(dy) < r.height / 2 + FIELD;

        if (withinX && withinY) {
          m.tx = dx * PULL;
          m.ty = dy * PULL;
        } else {
          m.tx = 0;
          m.ty = 0;
        }
      }
      kick();
    },
    { passive: true }
  );
}
