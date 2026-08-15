/*
  The hero-to-work handoff, expressed as pure functions of scroll.

  Both the geometry (Plates) and the canvas fade (StrataCanvas) derive their
  values from here rather than each easing scroll on its own. They run in
  different places — one inside the R3F frame loop, one as a DOM style write —
  and if they disagreed by even a few percent the sheets would still be
  visible after the object was supposed to have handed over, or would vanish
  mid-move.

  What the choreography actually does: as you scroll the hero, the stack opens.
  Past the halfway point it reverses — the sheets converge back into a single
  slab, the fan rotates flat to face you, and the whole object descends and
  dissolves just as the first work row arrives underneath it. The object closes
  itself and hands the page over.

  This is a choreographed handover rather than a literal coordinate match onto
  the four project cards. Two reasons it is the better build: the canvas is a
  child of the hero, so it scrolls away and physically cannot reach the cards
  without restructuring the hero into a sticky container; and six sheets do not
  map cleanly onto four cards, so a per-card handoff would read as a muddle
  rather than a transformation.
*/

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Scroll progress through the hero, 0 at the top and 1 once it is fully past. */
export function heroProgress(y: number, heroHeight: number): number {
  return clamp01(y / (heroHeight || 1));
}

export interface Handoff {
  /** How far the stack has opened, 0–1. Rises, then falls as it hands over. */
  open: number;
  /** How far into the handover, 0–1. Drives flatten, descent and fade. */
  close: number;
}

export function handoffAt(progress: number): Handoff {
  const close = smoothstep(0.45, 1, progress);
  const open = smoothstep(0, 0.45, progress) * (1 - close);
  return { open, close };
}
