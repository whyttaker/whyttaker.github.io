import { useEffect, useRef, type RefObject } from 'react';

export interface DragState {
  active: boolean;
  /** 0 → resting fan, 1 → fully separated. */
  separation: number;
  /** Target rotation offsets, radians. */
  spinX: number;
  spinY: number;
}

const REDUCED = '(prefers-reduced-motion: reduce)';

/*
  Drag is handled on the container element, not through R3F's raycast pointer
  events.

  Two reasons. It behaves better: the sheets are thin and steeply angled, so
  requiring a direct hit on one made "drag to separate" feel broken whenever
  you grabbed the gap between them — the whole stage should be draggable. And
  it is testable: raycast events derive their coordinates from offsetX/offsetY,
  which synthetic pointer events cannot set.
*/
export function useDragState(
  host: RefObject<HTMLElement | null>
): RefObject<DragState> {
  const state = useRef<DragState>({
    active: false,
    separation: 0,
    spinX: 0,
    spinY: 0,
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (window.matchMedia(REDUCED).matches) return;

    let startX = 0;
    let startY = 0;
    let pointer = -1;

    const down = (e: PointerEvent) => {
      // Ignore secondary buttons and second fingers; the latter is almost
      // always the start of a pinch-zoom, not a drag.
      if (e.button !== 0 || pointer !== -1) return;
      pointer = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      state.current.active = true;
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = 'grabbing';
    };

    const move = (e: PointerEvent) => {
      if (!state.current.active || e.pointerId !== pointer) return;
      const dx = (e.clientX - startX) / window.innerWidth;
      const dy = (e.clientY - startY) / window.innerHeight;

      state.current.separation = Math.min(
        Math.abs(dx) * 1.5 + Math.abs(dy) * 1.0,
        1
      );
      state.current.spinY = Math.max(-0.6, Math.min(0.6, dx * 0.9));
      state.current.spinX = Math.max(-0.35, Math.min(0.35, dy * 0.5));
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = -1;
      state.current.active = false;
      state.current.separation = 0;
      state.current.spinX = 0;
      state.current.spinY = 0;
      el.releasePointerCapture?.(e.pointerId);
      el.style.cursor = '';
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);

    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [host]);

  return state;
}
