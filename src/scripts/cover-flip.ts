/*
  Hash navigations skip the cross-document view transition (see the
  visibility gate in Base.astro) to dodge the browser's fragment-scroll
  race, which also drops the native shared-element cover morph — the case
  study's cover just appears already shrunk into its row with no motion.
  This captures the cover's on-screen rect right before the "All work" link
  navigates away, so the home page can read it back and animate the row's
  media box from that rect down to its own resting position by hand (see
  the settle() script in Base.astro, which does the actual FLIP).
*/
export function initCoverFlip(): void {
  // The frame, not the outer .case__cover figure: the figure is a wide,
  // height-capped box that letterboxes near-square covers, while the frame
  // (and the home page's .work__media it's paired with) is always sized
  // tightly to the cover's own aspect ratio. Capturing the figure's rect
  // instead would carry that shape mismatch into the FLIP transform as a
  // non-uniform scale, stretching the image as it shrinks.
  const cover = document.querySelector<HTMLElement>('.case__cover-frame');
  const back = document.querySelector<HTMLAnchorElement>('.case__back');
  if (!cover || !back) return;

  back.addEventListener('click', () => {
    const id = back.hash.slice(1);
    if (!id) return;
    const r = cover.getBoundingClientRect();
    sessionStorage.setItem(
      'coverFlip',
      JSON.stringify({ id, top: r.top, left: r.left, width: r.width, height: r.height })
    );
  });
}
