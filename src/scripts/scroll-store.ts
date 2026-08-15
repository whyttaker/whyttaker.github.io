/*
  One source of truth for scroll position and velocity.

  Everything scroll-driven on the page reads from here rather than attaching
  its own listener: the hero canvas, the handoff, the work-row displacement.
  That matters for the hero-to-cards handoff in particular — two independent
  scroll listeners will disagree by a frame under smooth scrolling, and the
  canvas and the DOM cards would visibly drift apart during the transition.
*/

export interface ScrollState {
  /** Scroll offset in px. Under Lenis this is the smoothed value, not raw. */
  y: number;
  /** px per frame, signed. Used for velocity-reactive effects. */
  velocity: number;
}

type Listener = (state: ScrollState) => void;

const state: ScrollState = { y: 0, velocity: 0 };
const listeners = new Set<Listener>();

export function subscribeScroll(fn: Listener): () => void {
  listeners.add(fn);
  fn(state);
  return () => {
    listeners.delete(fn);
  };
}

export function getScroll(): Readonly<ScrollState> {
  return state;
}

export function publishScroll(y: number, velocity: number): void {
  state.y = y;
  state.velocity = velocity;
  for (const fn of listeners) fn(state);
}

/**
 * Progress of `el` through the viewport, 0 when its top hits the top of the
 * viewport and 1 after it has scrolled its full height past.
 * Values are not clamped — callers that want overscroll (the handoff does)
 * can read past 1.
 */
export function progressThrough(el: HTMLElement, y: number): number {
  const top = el.offsetTop;
  const height = el.offsetHeight || 1;
  return (y - top) / height;
}

export const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
