/*
  Timing for each work row's reveal — everything in the row (eyebrow, title,
  thesis, role, outcome, skills, CTA, and the cover image) fades in together
  at one shared delay, rather than staggered piece by piece (see
  WorkRow.astro).

  Shared between WorkRow.astro (which renders these as CSS custom
  properties driving its animations) and WorkSection.astro (which needs the
  same math to know how long one row's reveal takes, so it can hand the
  next row a startOffsetMs that begins only once the previous row has
  finished — the "project by project" cascade rather than every row
  animating at once).
*/

export const REVEAL_DURATION_MS = 220;
/* Pause after one row's reveal finishes before the next row begins, so the
   cascade still reads as a paced sequence rather than every row's fade
   crowding straight into the next one. */
export const ROW_GAP_MS = 250;

export interface RowTiming {
  revealDelayMs: number;
  rowEndMs: number;
}

export function computeRowTiming(startOffsetMs: number): RowTiming {
  return {
    revealDelayMs: startOffsetMs,
    rowEndMs: startOffsetMs + REVEAL_DURATION_MS,
  };
}
