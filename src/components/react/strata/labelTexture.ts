import * as THREE from 'three';

/*
  Each plate's etching is drawn into a 2D canvas and used as an alpha-mapped
  overlay on the plate's front face.

  Drawing the type into the geometry rather than positioning DOM labels over
  the canvas means the lettering is locked to the plate by construction —
  during a drag there is no way for the text and the sheet it is engraved on
  to drift apart by a frame. It also avoids shipping a font atlas for
  troika-style 3D text, since the browser already has JetBrains Mono loaded.

  The engraving is decorative: the canvas is aria-hidden, and every metric
  here is stated again in the sections below.
*/

const W = 1024;
const H = 96;

export function createLabelTexture(
  label: string,
  metric: string,
  dpr = 2
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr;
  canvas.height = H * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const mid = H / 2;
  const right = W - 24;

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';

  // Metric sits at the trailing edge, cool and dimmer than the label.
  ctx.font = '400 26px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(191, 212, 238, 0.62)';
  ctx.fillText(metric, right, mid);
  const metricW = ctx.measureText(metric).width;

  // Rule between the two, matching the CSS baseline composition.
  const ruleRight = right - metricW - 22;
  ctx.strokeStyle = 'rgba(191, 212, 238, 0.32)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ruleRight - 34, mid);
  ctx.lineTo(ruleRight, mid);
  ctx.stroke();

  // Domain label, tracked out like engraved lettering.
  ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(237, 232, 224, 0.82)';
  ctx.letterSpacing = '3px';
  ctx.fillText(label.toUpperCase(), ruleRight - 46, mid);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Aspect ratio of the generated texture, so callers can size the plane. */
export const LABEL_ASPECT = W / H;
