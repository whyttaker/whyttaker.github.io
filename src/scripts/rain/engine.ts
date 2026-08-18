import { PHRASES, TERMS, pick, randomGlyph } from './content';
import { MOTIFS, type Motif } from './motifs';

/*
  ============================================================================
  THE RAIN
  ============================================================================

  Three things happen at once.

  1. NOISE. Columns of hex and code punctuation fall at three different sizes.
     Size, speed and opacity are correlated, so smaller/slower/dimmer reads as
     further away. This is the parallax that most Matrix imitations skip.

  2. SIGNAL. Every few seconds, columns on a single uniform "focal" grid have
     their speeds retimed so their heads all arrive on the same row at the same
     instant, locking to the characters of a phrase from the resume. The rain
     itself converges — the phrase is not drawn on top of it.

  3. IMAGES. Motifs are glyph grids (see motifs.ts). They are never drawn
     directly; they mark cells as revealed, and any falling head passing
     through a revealed cell draws that character instead of noise. The rain
     paints the picture as it sweeps over it, then the trails let it fade.

  The decoder beam reuses (3): the cursor stamps a small block of readable
  terms into the reveal region, so the rain resolves wherever you point.

  ---------------------------------------------------------------------------
  Why there are two column sets

  Mixed font sizes mean there is no single shared grid, so a phrase spanning
  columns of different widths would have ragged spacing and broken alignment.
  The focal set is a separate uniform grid that carries all meaning; the noise
  set supplies depth and never carries any. Visually they are indistinguishable
  — all of it is falling glyphs — but only one of them has to line up.
  ---------------------------------------------------------------------------

  Cost: one fade rect plus one draw per active head, roughly 150 draw calls a
  frame. Nothing is redrawn to make the trails; the fade rect does that. Noise
  is grouped by tier so `ctx.font` is assigned three times per frame rather
  than once per column, which is the expensive part of canvas text.
*/

const BONE = '237, 232, 224';
const RIM = '191, 212, 238';

/** Focal grid — the plane that carries phrases, motifs and the decoder. */
const FOCAL_SIZE = 15;
const FOCAL_CELL_W = 9;
const FOCAL_CELL_H = 17;
const FOCAL_SPEED = 9; // rows per second

interface Tier {
  size: number;
  cellW: number;
  cellH: number;
  speedMul: number;
  alpha: number;
  weight: number;
}

const TIERS: Tier[] = [
  { size: 10, cellW: 6, cellH: 12, speedMul: 0.45, alpha: 0.28, weight: 45 },
  { size: 15, cellW: 9, cellH: 17, speedMul: 1.0, alpha: 0.55, weight: 35 },
  { size: 22, cellW: 13, cellH: 25, speedMul: 1.7, alpha: 0.78, weight: 20 },
];

interface NoiseCol {
  x: number;
  head: number;
  speed: number;
  glyph: string;
}

interface FocalCol {
  col: number;
  head: number;
  speed: number;
  active: boolean;
  glyph: string;
  lockChar: string | null;
  /** Float, so the landing row can be an exact pixel target, not a cell. */
  lockRow: number;
  holding: boolean;
  /** Intro name only: draw at this size instead of the focal size. */
  lockSize?: number;
}

/*
  Intro letters are their own falling particles rather than borrowed focal
  columns.

  Claiming columns had two failure modes that both showed up on screen: two
  stacked lines routinely want the same column, and the loser was silently
  dropped (WORLAND rendered as "W RLAND"); and snapping x to the 9px grid
  jittered the letter pitch enough to read as broken spacing ("WHI T TAKER").
  A particle owns an exact x and cannot collide with anything.
*/
interface Letter {
  ch: string;
  x: number;
  /** Final size once landed. */
  size: number;
  /** Rows, float. */
  head: number;
  start: number;
  target: number;
  speed: number;
  holding: boolean;
}

/** One line of the hero name, measured from the DOM it will morph into. */
export interface NameTarget {
  text: string;
  /** Left edge, canvas px. */
  x: number;
  /** Cap top, canvas px. */
  y: number;
  /** Distance between character origins, canvas px. */
  pitch: number;
  /** Glyph size, canvas px. */
  size: number;
}

interface ActiveMotif {
  motif: Motif;
  col: number;
  row: number;
  k: number;
  age: number;
  life: number;
}

interface Decoder {
  col: number;
  row: number;
  lines: string[];
  k: number;
}

export interface RainHandle {
  destroy(): void;
  setRunning(on: boolean): void;
  /** 0 = at rest, 1 = fully handed over to the page below. */
  setHandoff(v: number): void;
  renderStill(): void;
  /** Full-screen storm that spells the name and calms into the hero. */
  runIntro(
    /* A getter, not a value: measured at placement time so the display webfont
       has certainly loaded and layout has settled. Measuring up front raced
       the font and produced a name of the wrong width. */
    getTargets: () => NameTarget[],
    onReveal: () => void,
    onDone: () => void
  ): void;
}

export function createRain(
  canvas: HTMLCanvasElement,
  opts: { reduced: boolean; clearEl: HTMLElement | null }
): RainHandle {
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const clearEl = opts.clearEl;

  let W = 0;
  let H = 0;
  let rows = 0;
  let focalCols = 0;

  /** Grouped by tier so the font is set once per group, not once per column. */
  let noiseByTier: NoiseCol[][] = [];
  let focal: FocalCol[] = [];

  let clearRect: { cx: number; cy: number; rx: number; ry: number } | null = null;

  let motif: ActiveMotif | null = null;
  let motifCooldown = 2.5;

  let decoder: Decoder | null = null;
  let pointer: { x: number; y: number } | null = null;
  let decoderCooldown = 0;

  let phraseState: 'idle' | 'converging' | 'flash' | 'fading' = 'idle';
  /** Drives the flare-and-fade once a phrase has landed. */
  let phraseAlpha = 1;
  /** >1 renders the landed characters larger — used for the intro name. */
  let phraseScale = 1;
  let phraseCols: FocalCol[] = [];
  let letters: Letter[] = [];
  /** Seconds; the intro lengthens this so the fade matches the DOM handover. */
  let phraseFadeDur = 0.7;
  let phraseTimer = 3;
  let phraseGuard = 0;

  let handoff = 0;

  /*
    Intro. The page opens as a full-screen storm with the type invisible
    underneath, the rain spells the name out of itself, and then the storm
    calms into the hero exactly as it sits at rest. clearK ramps the dimming
    wash in at the end — during the storm there is no clear zone at all,
    because there is nothing to protect yet.
  */
  const INTRO_PHRASE_AT = 0.45;
  /** How long the letters take to fall into place. */
  const INTRO_CONVERGE = 1.75;
  /** Glyphs land at ~2.2s and hold before the handover. */
  const INTRO_MORPH_AT = 2.75;
  const INTRO_MORPH_MS = 780;
  const INTRO_END_AT = 4.4;
  let introT = -1;
  let introPhraseStarted = false;
  let introRevealed = false;
  let introGetTargets: (() => NameTarget[]) | null = null;
  let onIntroReveal: (() => void) | null = null;
  let onIntroDone: (() => void) | null = null;
  /** 0 = no dimming wash (storm), 1 = full wash (resting hero). */
  let clearK = 1;

  let running = true;
  let raf = 0;
  let last = 0;

  // ---------------------------------------------------------------- layout

  function weightedTier(): number {
    const total = TIERS.reduce((n, t) => n + t.weight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < TIERS.length; i++) {
      r -= TIERS[i].weight;
      if (r <= 0) return i;
    }
    return 1;
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textBaseline = 'top';

    rows = Math.ceil(H / FOCAL_CELL_H) + 2;
    focalCols = Math.ceil(W / FOCAL_CELL_W);

    focal = Array.from({ length: focalCols }, (_, col) => ({
      col,
      head: -Math.random() * rows,
      speed: FOCAL_SPEED * (0.75 + Math.random() * 0.6),
      active: Math.random() < 0.42,
      glyph: randomGlyph(),
      lockChar: null,
      lockRow: 0,
      holding: false,
    }));

    noiseByTier = TIERS.map(() => []);
    let x = 0;
    while (x < W) {
      const ti = weightedTier();
      const tier = TIERS[ti];
      noiseByTier[ti].push({
        x,
        head: -Math.random() * (H / tier.cellH),
        speed: FOCAL_SPEED * tier.speedMul * (0.8 + Math.random() * 0.5),
        glyph: randomGlyph(),
      });
      x += tier.cellW * (1 + Math.floor(Math.random() * 2));
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
  }

  function measureClear() {
    if (!clearEl) {
      clearRect = null;
      return;
    }
    const c = canvas.getBoundingClientRect();
    const t = clearEl.getBoundingClientRect();
    clearRect = {
      cx: t.left - c.left + t.width / 2,
      cy: t.top - c.top + t.height / 2,
      rx: t.width * 0.78,
      ry: t.height * 0.95,
    };
  }

  // ------------------------------------------------------------- reveal

  /**
   * Is (col,row) on the focal grid covered by a motif or the decoder?
   * Two bounds tests per head per frame, no allocation.
   */
  function revealAt(col: number, row: number): { char: string; k: number } | null {
    if (decoder) {
      const dy = row - decoder.row;
      if (dy >= 0 && dy < decoder.lines.length) {
        const line = decoder.lines[dy];
        const dx = col - decoder.col;
        if (dx >= 0 && dx < line.length && line[dx] !== ' ') {
          return { char: line[dx], k: decoder.k };
        }
      }
    }
    if (motif) {
      // Sprites are authored small and blown up by an integer scale, so each
      // authored cell covers a scale x scale block of the focal grid.
      const sc = motif.motif.scale ?? 1;
      const my = Math.floor((row - motif.row) / sc);
      if (my >= 0 && my < motif.motif.rows.length) {
        const line = motif.motif.rows[my];
        const mx = Math.floor((col - motif.col) / sc);
        if (mx >= 0 && mx < line.length && line[mx] !== ' ') {
          return { char: line[mx], k: motif.k };
        }
      }
    }
    return null;
  }

  function scheduleMotif(dt: number) {
    if (motif) {
      motif.age += dt;
      // Ramp in over 1.2s, hold, ramp out over 1.2s.
      motif.k = Math.min(motif.age / 1.2, 1, Math.max(0, (motif.life - motif.age) / 1.2));
      if (motif.age >= motif.life) {
        motif = null;
        motifCooldown = 3 + Math.random() * 3;
      }
      return;
    }

    motifCooldown -= dt;
    if (motifCooldown > 0) return;

    const m = pick(MOTIFS);
    const sc = m.scale ?? 1;
    const w = m.rows[0].length * sc;
    const h = m.rows.length * sc;
    if (w + 4 >= focalCols || h + 6 >= rows) {
      motifCooldown = 3;
      return;
    }
    motif = {
      motif: m,
      // Biased right of centre: the left of the frame belongs to the type.
      col: Math.floor(focalCols * 0.4) +
        Math.floor(Math.random() * Math.max(1, focalCols - w - 4 - focalCols * 0.4)),
      row: 2 + Math.floor(Math.random() * (rows - h - 6)),
      k: 0,
      age: 0,
      life: 6 + Math.random() * 2,
    };
  }

  // ------------------------------------------------------------- decoder

  function updateDecoder(dt: number) {
    const inside =
      pointer !== null &&
      pointer.x >= 0 &&
      pointer.y >= 0 &&
      pointer.x <= W &&
      pointer.y <= H;

    if (!inside) {
      if (decoder) {
        decoder.k -= dt * 3;
        if (decoder.k <= 0) decoder = null;
      }
      return;
    }

    decoderCooldown -= dt;
    const col = Math.floor(pointer!.x / FOCAL_CELL_W);
    const row = Math.floor(pointer!.y / FOCAL_CELL_H);

    // Re-seat when the pointer has moved a few cells, but rate limited:
    // rebuilding every frame makes the words flicker illegibly.
    const moved =
      !decoder ||
      Math.abs(decoder.col + (decoder.lines[0].length >> 1) - col) > 4 ||
      Math.abs(decoder.row + 1 - row) > 2;

    if (moved && decoderCooldown <= 0) {
      const lines = [pick(TERMS), pick(TERMS), pick(TERMS)];
      const w = Math.max(...lines.map((l) => l.length));
      decoder = {
        col: Math.max(0, Math.min(focalCols - w - 1, col - (w >> 1))),
        row: Math.max(0, Math.min(rows - 4, row - 1)),
        lines,
        k: decoder ? decoder.k : 0,
      };
      decoderCooldown = 0.45;
    }

    if (decoder) decoder.k = Math.min(1, decoder.k + dt * 4);
  }

  // -------------------------------------------------------------- phrases

  function startPhrase(preferRight = false) {
    const text = pick(PHRASES);
    if (text.length + 6 >= focalCols) return;

    const span = focalCols - text.length - 6;
    const start = preferRight
      ? Math.floor(focalCols * 0.45) +
        Math.floor(Math.random() * Math.max(1, span - focalCols * 0.45))
      : 3 + Math.floor(Math.random() * span);

    placePhrase(text, start, Math.floor(rows * (0.3 + Math.random() * 0.35)), 1.9 + Math.random() * 0.8);
  }

  /**
   * Sets a phrase converging on one row. Every column starts above the top of
   * the frame at its own random offset and gets whatever speed carries it to
   * the target in the shared duration — so they set off from different heights
   * at different rates and nothing looks marshalled on the way down. The
   * convergence reads as coincidence, which is the whole trick.
   */
  function placePhrase(
    text: string,
    startCol: number,
    targetRow: number,
    duration: number,
    /** Grid columns between characters. >1 tracks the phrase out. */
    spread = 1
  ) {
    phraseCols = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === ' ') continue;
      const c = focal[startCol + i * spread];
      if (!c) continue;

      c.head = -(2 + Math.random() * 26);
      c.active = true;
      c.speed = (targetRow - c.head) / duration;
      c.lockChar = ch;
      c.lockRow = targetRow;
      c.holding = false;
      phraseCols.push(c);
    }

    if (!phraseCols.length) return;
    phraseState = 'converging';
    phraseAlpha = 1;
    phraseGuard = duration + 3;
  }

  function releasePhrase() {
    for (const c of phraseCols) {
      c.lockChar = null;
      c.lockSize = undefined;
      c.holding = false;
      c.speed = FOCAL_SPEED * (0.75 + Math.random() * 0.6);
    }
    letters = [];
    phraseCols = [];
    phraseState = 'idle';
    phraseAlpha = 1;
    phraseScale = 1;
    phraseFadeDur = 0.7;
    phraseTimer = 3 + Math.random() * 2.5;
  }

  /*
    converging → flash → fading → idle

    On arrival the phrase flares to full white for a beat, then fades out in
    place. It does not resume falling: letting the columns carry on turned the
    moment into a handoff back to noise, where the fade lets it read as
    something that surfaced and was gone.
  */
  function updatePhrase(dt: number) {
    if (phraseState === 'idle') {
      phraseTimer -= dt;
      if (phraseTimer <= 0) startPhrase();
      return;
    }

    phraseGuard -= dt;

    if (phraseState === 'converging') {
      // A stalled column must never strand the phrase half-formed.
      if (phraseGuard <= 0) return releasePhrase();
      if ((letters.length ? letters : phraseCols).every((c) => c.holding)) {
        phraseState = 'flash';
        phraseGuard = 0.5;
        phraseAlpha = 1;
      }
      return;
    }

    if (phraseState === 'flash') {
      if (phraseGuard <= 0) {
        phraseState = 'fading';
        phraseGuard = phraseFadeDur;
      }
      return;
    }

    // fading
    phraseAlpha = Math.max(0, phraseGuard / phraseFadeDur);
    if (phraseGuard <= 0) releasePhrase();
  }

  // ---------------------------------------------------------------- draw

  /**
   * Dims the rain behind the display type. Without it the name sits on a field
   * of moving characters and stops being readable, which would fail the one
   * thing the hero actually has to do.
   */
  function drawClearZone() {
    if (clearK <= 0.001) return;
    // A left-weighted wash rather than a circle cut out of the rain. A radial
    // hole behind the type read as a black blob — an obvious mask. Dimming the
    // whole left side instead reads as composition: quiet where the type is,
    // active where it is not, which is the same left/right balance the rest of
    // the page uses.
    const wash = ctx.createLinearGradient(0, 0, W * 0.72, 0);
    wash.addColorStop(0, `rgba(0,0,0,${0.92 * clearK})`);
    wash.addColorStop(0.45, `rgba(0,0,0,${0.72 * clearK})`);
    wash.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W * 0.72, H);

    // The nav sits top-right, over the busiest part of the field.
    const top = ctx.createLinearGradient(0, 0, 0, 130);
    top.addColorStop(0, `rgba(0,0,0,${0.8 * clearK})`);
    top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 130);

    // A last soft pool directly behind the name, so a bright column passing
    // through can never break the read.
    if (!clearRect) return;
    const { cx, cy, rx, ry } = clearRect;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1);
    g.addColorStop(0, `rgba(0,0,0,${0.7 * clearK})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx, ry);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFrame(dt: number) {
    // Trails are produced entirely by this rect. A faster handoff fades less
    // per frame, leaving longer streaks — which is what sells "falling into
    // the page" rather than simply speeding up.
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(0, 0, 0, ${0.06 - handoff * 0.04})`;
    ctx.fillRect(0, 0, W, H);

    // The storm drives everything faster until the reveal, then eases back to
    // the resting speed as the wash comes in.
    const storm =
      introT < 0 ? 0 : 1 - Math.min(1, Math.max(0, (introT - INTRO_MORPH_AT) / 1.1));
    const boost = 1 + handoff * 4 + storm * 0.75;

    // --- noise, one font assignment per tier -------------------------
    for (let ti = 0; ti < TIERS.length; ti++) {
      const tier = TIERS[ti];
      const cols = noiseByTier[ti];
      if (!cols.length) continue;

      ctx.font = `500 ${tier.size}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.globalAlpha = tier.alpha;
      ctx.fillStyle = `rgb(${BONE})`;

      for (const c of cols) {
        c.head += c.speed * boost * dt;
        const y = c.head * tier.cellH;
        if (y > H + 40) {
          c.head = -2 - Math.random() * 20;
          continue;
        }
        if (y < -tier.cellH) continue;
        if (Math.random() < 0.4) c.glyph = randomGlyph();
        ctx.fillText(c.glyph, c.x, y);
      }
    }

    // --- focal -------------------------------------------------------
    ctx.font = `500 ${FOCAL_SIZE}px "JetBrains Mono", ui-monospace, monospace`;

    for (const c of focal) {
      if (!c.active) {
        if (Math.random() < 0.014) {
          c.active = true;
          c.head = -1 - Math.random() * 12;
        }
        continue;
      }

      if (!c.holding) {
        /* A column carrying a phrase letter is exempt from the speed boost.
           Its speed was solved so that it arrives on the target row at a
           precise moment; scaling it makes the whole line land early and in
           formation, which is exactly the marshalled look the staggered start
           heights exist to avoid. */
        c.head += (c.lockChar !== null ? c.speed : c.speed * boost) * dt;
        if (c.lockChar !== null && c.head >= c.lockRow) {
          c.head = c.lockRow;
          c.holding = true;
        }
      }

      const row = Math.floor(c.head);
      // Holding letters use the float head so the intro name lands on its
      // measured baseline rather than snapping to the 17px grid.
      const y = c.holding ? c.head * FOCAL_CELL_H : row * FOCAL_CELL_H;

      if (!c.holding && y > H + 40) {
        c.active = Math.random() < 0.8;
        c.head = -1 - Math.random() * 18;
        continue;
      }
      if (y < -FOCAL_CELL_H) continue;

      const x = c.col * FOCAL_CELL_W;

      if (c.holding && c.lockChar) {
        // Landed. Flares white, then fades in place. The second cool pass
        // separates it from the noise without introducing a new hue.
        const size = c.lockSize ?? FOCAL_SIZE * phraseScale;
        const resized = size !== FOCAL_SIZE;
        if (resized) {
          ctx.font = `600 ${size}px "JetBrains Mono", ui-monospace, monospace`;
        }
        ctx.globalAlpha = phraseAlpha;
        ctx.fillStyle = phraseState === 'flash' ? '#ffffff' : `rgb(${BONE})`;
        ctx.fillText(c.lockChar, x, y);
        ctx.globalAlpha = phraseAlpha * 0.32;
        ctx.fillStyle = `rgb(${RIM})`;
        ctx.fillText(c.lockChar, x, y);
        ctx.fillStyle = `rgb(${BONE})`;
        if (resized) {
          ctx.font = `500 ${FOCAL_SIZE}px "JetBrains Mono", ui-monospace, monospace`;
        }
        continue;
      }

      const rev = revealAt(c.col, row);
      if (rev) {
        // Passing through a motif or the decoder: draw its character instead
        // of noise. This is how the picture gets painted.
        ctx.globalAlpha = 0.5 + 0.5 * rev.k;
        ctx.fillText(rev.char, x, y);
        continue;
      }

      if (Math.random() < 0.35) c.glyph = randomGlyph();
      ctx.globalAlpha = 0.62;
      ctx.fillText(c.glyph, x, y);
    }

    drawLetters(dt);

    ctx.globalAlpha = 1;
    drawClearZone();
  }

  /**
   * Reduced motion: run the simulation forward without presenting it, so the
   * still has real trails, a resolved phrase and a motif in it — a composed
   * image rather than an empty box.
   */
  function renderStill() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const m = pick(MOTIFS);
    const mw = m.rows[0].length * (m.scale ?? 1);
    motif = {
      motif: m,
      col: Math.max(1, Math.min(focalCols - mw - 2, Math.floor(focalCols * 0.62))),
      row: Math.max(1, Math.min(rows - m.rows.length * (m.scale ?? 1) - 2, (rows >> 1) - 4)),
      k: 1,
      age: 0,
      life: 999,
    };

    // Right of the display type, so the one legible phrase is not sitting
    // underneath the name where the wash would swallow it.
    startPhrase(true);
    for (const c of phraseCols) {
      c.head = c.lockRow;
      c.holding = true;
    }
    phraseState = 'flash';
    phraseAlpha = 1;

    // Long enough for the trails to build to the same density the live loop
    // settles at. At 90 frames the still came out almost empty.
    for (let i = 0; i < 260; i++) drawFrame(1 / 60);
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- loop

  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    if (!running) return;

    const dt = Math.min((now - last) / 1000 || 0, 1 / 20);
    last = now;

    if (introT >= 0) updateIntro(dt);

    // No motifs or decoder during the intro — the name is the only thing that
    // should resolve, or the moment gets crowded.
    if (introT < 0) {
      scheduleMotif(dt);
      updateDecoder(dt);
    }
    updatePhrase(dt);
    drawFrame(dt);
  }

  /**
   * Assembles the name across the falling columns at the exact position, size
   * and line break of the display type it will become.
   *
   * Each character claims the column whose x is nearest its target, so the
   * letter lands where it belongs without ever sliding sideways — a column
   * only ever falls straight down. The landing row is a float rather than a
   * cell index, so the baseline is pixel-accurate instead of snapping to the
   * 17px grid, which at 100px glyphs would be a visible jolt.
   */
  function placeNameTargets(duration: number) {
    phraseCols = [];
    letters = [];

    for (const t of introGetTargets?.() ?? []) {
      const text = t.text.toUpperCase();
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === ' ') continue;
        // Each letter starts above the frame at its own height and gets the
        // speed that lands it on the shared row at the shared moment, so the
        // descent looks unrelated right up until it isn't.
        const head = -(2 + Math.random() * 30);
        const target = t.y / FOCAL_CELL_H;
        letters.push({
          ch,
          x: t.x + i * t.pitch,
          size: t.size,
          head,
          start: head,
          target,
          speed: (target - head) / duration,
          holding: false,
        });
      }
    }

    if (!letters.length) return;
    phraseState = 'converging';
    phraseAlpha = 1;
    phraseGuard = duration + 3;
  }

  function drawLetters(dt: number) {
    if (!letters.length) return;

    for (const l of letters) {
      if (!l.holding) {
        l.head += l.speed * dt;
        if (l.head >= l.target) {
          l.head = l.target;
          l.holding = true;
        }
      }

      const y = l.head * FOCAL_CELL_H;

      if (l.holding) {
        ctx.font = `600 ${l.size}px "JetBrains Mono", ui-monospace, monospace`;
        ctx.globalAlpha = phraseAlpha;
        ctx.fillStyle = phraseState === 'flash' ? '#ffffff' : `rgb(${BONE})`;
        ctx.fillText(l.ch, l.x, y);
        ctx.globalAlpha = phraseAlpha * 0.3;
        ctx.fillStyle = `rgb(${RIM})`;
        ctx.fillText(l.ch, l.x, y);
        continue;
      }

      /* On the way down a letter is indistinguishable from the storm: focal
         size, scrambling, dim. It rushes to full size only over the last
         third of its fall. Drawn at final size the whole way, the letters
         read as bright blobs smearing down the screen and give the surprise
         away long before they land. */
      const p = Math.min(
        1,
        Math.max(0, (l.head - l.start) / (l.target - l.start || 1))
      );
      const grow = Math.max(0, (p - 0.66) / 0.34);
      ctx.font = `600 ${FOCAL_SIZE + (l.size - FOCAL_SIZE) * grow * grow}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.globalAlpha = 0.4 + 0.45 * p;
      ctx.fillStyle = `rgb(${BONE})`;
      ctx.fillText(grow > 0.55 ? l.ch : randomGlyph(), l.x, y);
    }

    ctx.globalAlpha = 1;
    ctx.font = `500 ${FOCAL_SIZE}px "JetBrains Mono", ui-monospace, monospace`;
  }

  function updateIntro(dt: number) {
    introT += dt;

    if (!introPhraseStarted && introT >= INTRO_PHRASE_AT) {
      introPhraseStarted = true;
      placeNameTargets(INTRO_CONVERGE);
    }

    /*
      The morph. Rather than the phrase fading on its own schedule, the intro
      drives it: at the same instant the glyphs begin dissolving, the real
      display type is told to come up. The two cross in the middle, in the same
      position and at the same size, so it reads as the monospace setting into
      Archivo rather than as one element replacing another.
    */
    if (!introRevealed && introT >= INTRO_MORPH_AT) {
      introRevealed = true;
      phraseFadeDur = INTRO_MORPH_MS / 1000;
      phraseState = 'fading';
      phraseGuard = phraseFadeDur;
      onIntroReveal?.();
    }

    clearK =
      introT < INTRO_MORPH_AT ? 0 : Math.min(1, (introT - INTRO_MORPH_AT) / 1.1);

    if (introT >= INTRO_END_AT) {
      introT = -1;
      clearK = 1;
      onIntroDone?.();
      onIntroDone = null;
      onIntroReveal = null;
    }
  }

  // --------------------------------------------------------------- events

  const onResize = () => {
    layout();
    measureClear();
    if (opts.reduced) renderStill();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerLeave = () => {
    pointer = null;
  };

  const onPointerDown = (e: PointerEvent) => {
    // Touch has no hover, so a tap plants a decoder burst that decays.
    if (e.pointerType === 'mouse') return;
    const r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    decoderCooldown = 0;
    window.setTimeout(() => {
      pointer = null;
    }, 2000);
  };

  layout();
  measureClear();

  if (opts.reduced) {
    renderStill();
  } else {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    raf = requestAnimationFrame((t) => {
      last = t;
      raf = requestAnimationFrame(tick);
    });
  }

  window.addEventListener('resize', onResize);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    },
    setRunning(on: boolean) {
      if (on && !running) last = performance.now();
      running = on;
    },
    setHandoff(v: number) {
      handoff = v;
    },
    renderStill,
    runIntro(getTargets, onReveal, onDone) {
      introGetTargets = getTargets;
      onIntroReveal = onReveal;
      onIntroDone = onDone;
      introT = 0;
      introPhraseStarted = false;
      introRevealed = false;
      clearK = 0;
      // Every column falling from the first frame — the storm has to be at
      // full strength immediately, not ramp up into it.
      for (const c of focal) {
        c.active = true;
        c.head = -Math.random() * rows;
      }
      phraseTimer = 6;
      motifCooldown = 6;
    },
  };
}
