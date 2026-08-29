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

/* Must match --font-mono exactly. The intro hands its glyphs to the real
   display type, and that only works because they are the same face. */
const MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';

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
  /** The display face, used once it has landed. */
  font: string;
  /** Where it lands out of the rain: one centred line, mid screen. */
  cx: number;
  cy: number;
  csize: number;
  /** Where it travels to: its slot in the stacked hero name. */
  hx: number;
  hy: number;
  hsize: number;
  /** Fall, in rows. */
  head: number;
  start: number;
  target: number;
  speed: number;
  holding: boolean;
}

/** One line of the hero name, measured from the DOM it will become. */
export interface NameTarget {
  text: string;
  /** Left edge, canvas px. */
  x: number;
  /** Alphabetic baseline, canvas px. */
  y: number;
  /** Per-character offsets from x — measured, so any face works. */
  offsets: number[];
  /** Glyph size, canvas px. */
  size: number;
  /** The exact CSS font shorthand the display element resolves to. */
  font: string;
  /** CSS letter-spacing in px; canvas does not apply it on its own. */
  letterSpacing: number;
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

/**
 * A text block the rain has to stay legible behind. Measured fresh every
 * frame rather than once on resize — the canvas is now a fixed full-viewport
 * layer, so unlike the old hero-only version, a tracked element's position
 * relative to it changes on every scroll tick, not just when the window
 * resizes.
 */
interface ClearZone {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** The hero's own block keeps the bespoke left-wash treatment below. */
  isHero: boolean;
}

export function createRain(
  canvas: HTMLCanvasElement,
  opts: {
    reduced: boolean;
    /** Every text block the rain needs to stay legible behind, page-wide. */
    clearEls: HTMLElement[];
    /** Cleared every frame; carries the landed name so it never smears. */
    nameCanvas: HTMLCanvasElement | null;
  }
): RainHandle {
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const nctx = opts.nameCanvas?.getContext('2d', { alpha: true }) ?? null;
  const clearEls = opts.clearEls;

  let W = 0;
  let H = 0;
  let rows = 0;
  let focalCols = 0;

  /** Grouped by tier so the font is set once per group, not once per column. */
  let noiseByTier: NoiseCol[][] = [];
  let focal: FocalCol[] = [];

  let clearZones: ClearZone[] = [];

  /* clearK sits at a constant 0 or 1 for the entire run except a ~1s window
     during the intro handoff, and the hero wash only depends on the canvas
     size — so it is almost always identical frame to frame. Rebuilding it 60
     times a second forever, for a value that changes maybe once, was pure
     waste; caching by the inputs that actually vary means the rebuild only
     happens on the frames where the picture really changes. */
  let clearGradCache: { clearK: number; w: number; h: number; wash: CanvasGradient; top: CanvasGradient } | null =
    null;

  /* Every other zone's dark pool reuses one gradient regardless of position:
     it is authored as a unit circle at the origin and the ellipse's actual
     place and size come entirely from a translate+scale at fill time, so the
     gradient object itself never depends on a zone's (moving) coordinates
     and only ever needs to be built once. */
  let poolGrad: CanvasGradient | null = null;

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
  /** Kept so the arrived name can be drawn as whole lines, not per letter. */
  let nameLines: NameTarget[] = [];
  /** 0 = centred line, 1 = in the hero's stacked position. */
  let moveP = 0;
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
  const INTRO_PHRASE_AT = 0.35;
  /** Fall, landing as one centred line at ~1.85s. */
  const INTRO_CONVERGE = 1.5;
  /** Held centred, then the letters travel to their hero slots. */
  const INTRO_MOVE_AT = 2.55;
  const INTRO_MOVE_DUR = 1.05;
  /* The handover must come AFTER the travel finishes, not during it. The
     letters arrive at MOVE_AT + MOVE_DUR = 3.60s; handing over at 3.55s
     swapped in the real element while they were still about 5% short, and
     that last 5% was the shift you could see at the end of the animation. */
  const INTRO_MORPH_AT = 3.72;
  const INTRO_MORPH_MS = 500;
  /* Budgeted for the hero content's own staggered reveal downstream (see
     Hero.astro): eyebrow wipe, then the summary paragraph streaming in
     word by word, then the scroll cue — none of that is part of the
     storm itself, but data-intro/data-intro-reveal have to stay present
     until all of it has actually finished, or removing them mid-cascade
     snaps whatever hasn't transitioned yet straight to its end state. */
  const INTRO_END_AT = 8.0;
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

    if (nctx && opts.nameCanvas) {
      opts.nameCanvas.width = Math.round(W * dpr);
      opts.nameCanvas.height = Math.round(H * dpr);
      nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nctx.textBaseline = 'top';
    }

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

  function measureClearZones() {
    clearZones = [];
    if (!clearEls.length) return;
    const c = canvas.getBoundingClientRect();
    for (const el of clearEls) {
      const t = el.getBoundingClientRect();
      // Skip anything well outside the viewport — no need to protect text
      // nobody can see, and it keeps the per-frame zone list short while
      // scrolling through a long page.
      if (t.width === 0 || t.bottom < -200 || t.top - c.top > H + 200) continue;
      clearZones.push({
        cx: t.left - c.left + t.width / 2,
        cy: t.top - c.top + t.height / 2,
        rx: t.width * 0.78,
        ry: t.height * 0.95,
        isHero: el.dataset.rainClear === 'hero',
      });
    }
  }

  /**
   * How strongly (x,y) sits inside a protected block: 0 outside every zone,
   * rising to 1 at a zone's centre. Used to thin the falling field out as it
   * approaches a block, rather than leaving it full density under a
   * translucent wash — a dark overlay on top of a still-busy field reads as
   * busy regardless of how dark the overlay is.
   */
  function zoneCoverage(x: number, y: number): number {
    if (clearK <= 0.001 || !clearZones.length) return 0;
    let max = 0;
    for (const z of clearZones) {
      const dx = (x - z.cx) / z.rx;
      const dy = (y - z.cy) / z.ry;
      const d2 = dx * dx + dy * dy;
      if (d2 >= 1) continue;
      const k = 1 - Math.sqrt(d2);
      if (k > max) max = k;
    }
    return max * clearK;
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
    nameLines = [];
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
    /* During the intro this machine only detects the landing. Everything after
       that — the hold, the travel, the handover — is on the intro's clock, and
       letting the generic 0.7s flash/fade run alongside it faded the name out
       at 3.0s, before it had finished moving. */
    if (introT >= 0 && phraseState !== 'converging') return;

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
   * Dims the rain behind every tracked text block. Without it, running text
   * anywhere down the page sits on a field of moving characters and stops
   * being readable — the same problem the hero always had, now everywhere
   * the rain shows through rather than just behind the name.
   */
  function drawClearZone() {
    if (clearK <= 0.001 || !clearZones.length) return;

    // The hero keeps its bespoke composition: a left-weighted wash rather
    // than a circle cut out of the rain (a radial hole behind the type read
    // as a black blob — an obvious mask), plus a strip behind the nav. That
    // treatment only makes sense for the hero's own upper-left layout, so it
    // stays specific to that one zone rather than generalizing to every
    // block — it naturally stops being drawn once the hero scrolls out of
    // measureClearZones's tracked range.
    const hero = clearZones.find((z) => z.isHero);
    if (hero) {
      let wash: CanvasGradient;
      let top: CanvasGradient;
      if (clearGradCache && clearGradCache.clearK === clearK && clearGradCache.w === W && clearGradCache.h === H) {
        ({ wash, top } = clearGradCache);
      } else {
        wash = ctx.createLinearGradient(0, 0, W * 0.72, 0);
        wash.addColorStop(0, `rgba(0,0,0,${0.92 * clearK})`);
        wash.addColorStop(0.45, `rgba(0,0,0,${0.72 * clearK})`);
        wash.addColorStop(1, 'rgba(0,0,0,0)');

        // The nav sits top-right, over the busiest part of the field.
        top = ctx.createLinearGradient(0, 0, 0, 130);
        top.addColorStop(0, `rgba(0,0,0,${0.8 * clearK})`);
        top.addColorStop(1, 'rgba(0,0,0,0)');

        clearGradCache = { clearK, w: W, h: H, wash, top };
      }
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, W * 0.72, H);

      ctx.fillStyle = top;
      ctx.fillRect(0, 0, W, 130);
    }

    // A soft pool behind every tracked block, so a bright column passing
    // through can never break the read — the hero's is layered on top of its
    // wash above, everything else relies on the pool alone.
    if (!poolGrad) {
      poolGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      poolGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
      poolGrad.addColorStop(1, 'rgba(0,0,0,0)');
    }

    ctx.globalAlpha = clearK;
    ctx.fillStyle = poolGrad;
    for (const z of clearZones) {
      ctx.save();
      ctx.translate(z.cx, z.cy);
      ctx.scale(z.rx, z.ry);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawFrame(dt: number) {
    // Every tracked block's screen position moves on every scroll tick now
    // that the canvas is a fixed full-viewport layer, so this has to be
    // fresh every frame rather than measured once on resize — and it has to
    // happen before the draw loops below, which consult it to thin the field
    // out approaching a protected block rather than just relying on the dark
    // pool drawn over it afterward.
    measureClearZones();

    // Trails are produced entirely by this rect. A faster handoff fades less
    // per frame, leaving longer streaks — which is what sells "falling into
    // the page" rather than simply speeding up.
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(0, 0, 0, ${0.06 - handoff * 0.04})`;
    ctx.fillRect(0, 0, W, H);

    // The storm drives everything faster until the reveal, then eases back to
    // the resting speed as the wash comes in.
    const storm =
      introT < 0 ? 0 : 1 - Math.min(1, Math.max(0, (introT - INTRO_MOVE_AT) / 1.1));
    const boost = 1 + handoff * 4 + storm * 0.75;

    // --- noise, one font assignment per tier -------------------------
    for (let ti = 0; ti < TIERS.length; ti++) {
      const tier = TIERS[ti];
      const cols = noiseByTier[ti];
      if (!cols.length) continue;

      ctx.font = `500 ${tier.size}px ${MONO}`;
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

        const cover = zoneCoverage(c.x, y);
        if (cover > 0) {
          // Thinned rather than just dimmed: most of what would have landed
          // here simply doesn't draw, so the field looks sparser approaching
          // a protected block instead of merely darker.
          if (Math.random() < cover * 0.85) continue;
          ctx.globalAlpha = tier.alpha * (1 - cover * 0.6);
          ctx.fillText(c.glyph, c.x, y);
          ctx.globalAlpha = tier.alpha;
          continue;
        }
        ctx.fillText(c.glyph, c.x, y);
      }
    }

    // --- focal -------------------------------------------------------
    ctx.font = `500 ${FOCAL_SIZE}px ${MONO}`;

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
          ctx.font = `600 ${size}px ${MONO}`;
        }
        ctx.globalAlpha = phraseAlpha;
        ctx.fillStyle = phraseState === 'flash' ? '#ffffff' : `rgb(${BONE})`;
        ctx.fillText(c.lockChar, x, y);
        ctx.globalAlpha = phraseAlpha * 0.32;
        ctx.fillStyle = `rgb(${RIM})`;
        ctx.fillText(c.lockChar, x, y);
        ctx.fillStyle = `rgb(${BONE})`;
        if (resized) {
          ctx.font = `500 ${FOCAL_SIZE}px ${MONO}`;
        }
        continue;
      }

      // Landed phrase/name letters above are exempt from thinning — they are
      // the one deliberate foreground moment and should never partially drop
      // out — but plain noise and motif/decoder reveals thin out approaching
      // a protected block same as everything else.
      const cover = zoneCoverage(x, y);
      if (cover > 0 && Math.random() < cover * 0.85) continue;
      const dim = cover > 0 ? 1 - cover * 0.6 : 1;

      const rev = revealAt(c.col, row);
      if (rev) {
        // Passing through a motif or the decoder: draw its character instead
        // of noise. This is how the picture gets painted.
        ctx.globalAlpha = (0.5 + 0.5 * rev.k) * dim;
        ctx.fillText(rev.char, x, y);
        continue;
      }

      if (Math.random() < 0.35) c.glyph = randomGlyph();
      ctx.globalAlpha = 0.62 * dim;
      ctx.fillText(c.glyph, x, y);
    }

    ctx.globalAlpha = 1;
    drawClearZone();

    // After the wash, never before: the wash darkens the left of the frame,
    // which is precisely where the name is heading.
    drawLetters(dt);
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
    moveP = 0;

    const targets = introGetTargets?.() ?? [];
    if (!targets.length) return;
    nameLines = targets;

    /*
      Two layouts per letter.

      It falls out of the rain into a single centred line — the shape the intro
      had before, readable on its own — and then travels to its slot in the
      stacked hero name. Same glyph, same face, no crossfade in between: the
      letters simply move and scale. Only at the very end does the real display
      type come up underneath, and by then the mono is sitting on its position
      and size exactly.
    */
    const nameSize = targets[0].size;
    /*
      The centred line is typeset in the display face at its own natural
      advances, not stepped along a uniform pitch. A fixed pitch is only right
      for a monospaced face; against a proportional one it opened visible gaps
      between letters and a hole where the space falls.
    */
    const joined = targets.map((t) => t.text).join(' ');
    const csize = Math.max(22, Math.min(46, W / 34));
    const cfont = targets[0].font.replace(/\b[\d.]+px\b/, `${csize}px`);
    const cls = targets[0].letterSpacing * (csize / targets[0].size);

    ctx.font = cfont;
    setLetterSpacing(ctx, cls);
    const coffsets: number[] = [];
    for (let i = 0; i < joined.length; i++) {
      coffsets.push(ctx.measureText(joined.slice(0, i)).width + i * cls);
    }
    const cwidth = ctx.measureText(joined).width + joined.length * cls;
    setLetterSpacing(ctx, 0);

    const cx0 = (W - cwidth) / 2;
    const cy = H * 0.44;
    const targetRow = cy / FOCAL_CELL_H;

    let gi = 0;
    for (const t of targets) {
      for (let i = 0; i < t.text.length; i++) {
        const ch = t.text[i];
        if (ch !== ' ') {
          const head = -(2 + Math.random() * 30);
          letters.push({
            ch,
            cx: cx0 + coffsets[gi],
            cy,
            csize,
            hx: t.x + t.offsets[i],
            hy: t.y,
            hsize: nameSize,
            font: t.font,
            head,
            start: head,
            target: targetRow,
            speed: (targetRow - head) / duration,
            holding: false,
          });
        }
        gi++;
      }
      // The space between the two words.
      gi++;
    }

    if (!letters.length) return;
    phraseState = 'converging';
    phraseAlpha = 1;
    phraseGuard = duration + 3;
  }

  /** Canvas letterSpacing is recent; returns false where it is unsupported. */
  const setLetterSpacing = (g: CanvasRenderingContext2D, px: number) => {
    if (!('letterSpacing' in g)) return false;
    (g as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
    return true;
  };

  /** Rewrites the measured font shorthand at an arbitrary size. */
  const scaledFont = (l: Letter, size: number) =>
    l.font.replace(/\b[\d.]+px\b/, `${size}px`);

  /** Ease in and out, so the travel starts and settles rather than sliding. */
  const easeInOut = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function drawLetters(dt: number) {
    // The clean layer is wiped every frame whether or not there is a name on
    // it, so nothing is ever left behind when the intro ends.
    if (nctx) nctx.clearRect(0, 0, W, H);
    if (!letters.length) return;

    // Letters are positioned from their baseline; the rain is not.
    ctx.textBaseline = 'alphabetic';
    if (nctx) nctx.textBaseline = 'alphabetic';

    const e = easeInOut(moveP);

    /*
      Once arrived, the name is drawn as whole strings rather than letter by
      letter. Placing each glyph at its own measured offset is correct to
      within a pixel, but the browser accumulates subpixel positions slightly
      differently, and that residual drift is visible the instant the real
      element takes over. Handing the final frame to the same call the browser
      makes removes it by construction.
    */
    if (moveP >= 0.999 && nctx) {
      for (const t of nameLines) {
        nctx.font = t.font;
        nctx.globalAlpha = phraseAlpha;
        nctx.fillStyle = `rgb(${BONE})`;
        if (setLetterSpacing(nctx, t.letterSpacing)) {
          nctx.fillText(t.text, t.x, t.y);
          setLetterSpacing(nctx, 0);
        } else {
          // No canvas letterSpacing support: fall back to the measured
          // per-letter offsets, which already include the tracking.
          for (let i = 0; i < t.text.length; i++) {
            nctx.fillText(t.text[i], t.x + t.offsets[i], t.y);
          }
        }
      }
      nctx.globalAlpha = 1;
      ctx.textBaseline = 'top';
      return;
    }

    for (const l of letters) {
      if (!l.holding) {
        l.head += l.speed * dt;
        if (l.head >= l.target) {
          l.head = l.target;
          l.holding = true;
        }

        /* Still falling, so it belongs to the storm: drawn into the trailing
           canvas at the size it will land at, scrambling like everything
           else around it. */
        ctx.font = `600 ${l.csize}px ${MONO}`;
        ctx.globalAlpha =
          0.4 +
          0.45 *
            Math.min(1, Math.max(0, (l.head - l.start) / (l.target - l.start || 1)));
        ctx.fillStyle = `rgb(${BONE})`;
        ctx.fillText(randomGlyph(), l.cx, l.head * FOCAL_CELL_H);
        continue;
      }

      /* Landed. From here it lives on the clean layer and travels to its slot
         in the stacked hero name — same face, same glyph, moving and scaling,
         with no trail behind it. */
      const g = nctx ?? ctx;
      const x = l.cx + (l.hx - l.cx) * e;
      const y = l.cy + (l.hy - l.cy) * e;
      const size = l.csize + (l.hsize - l.csize) * e;

      /* Interpolating between two faces is not possible, so the letter
         adopts the display face as soon as it lands and keeps it for the
         whole travel. It is only ever seen at rest or moving, never mid
         glyph-substitution. */
      g.font = e > 0 || phraseState !== 'converging' ? scaledFont(l, size) : `600 ${size}px ${MONO}`;
      g.globalAlpha = phraseAlpha;
      /* Always bone, never the white flash regular phrase-reveals get: the
         intro freezes phraseState at 'flash' for the whole hold-and-travel
         (see updatePhrase) so its own alpha control doesn't get fought by
         the generic fade timer, but that left these letters rendering pure
         white for that entire stretch instead of the brief flash it was
         meant to be — a visible colour shift right before the letters
         become the real heading text, which is exactly bone already. */
      g.fillStyle = `rgb(${BONE})`;
      g.fillText(l.ch, x, y);
    }

    ctx.globalAlpha = 1;
    ctx.font = `500 ${FOCAL_SIZE}px ${MONO}`;
    ctx.textBaseline = 'top';
    if (nctx) nctx.globalAlpha = 1;
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
    // Travel from the centred line into the stacked hero position.
    moveP = Math.min(1, Math.max(0, (introT - INTRO_MOVE_AT) / INTRO_MOVE_DUR));

    /*
      The handover. The mono is already sitting on the display type's exact
      position and size by now, so fading one out as the other comes up reads
      as the letterforms resolving rather than as a swap.
    */
    /*
      No crossfade, no overlap either. The glyphs sit at the same position,
      size and colour as the display type underneath, but canvas and the
      browser's own text layout are different rendering pipelines — not
      truly pixel-identical even with matching fill/font/size — so holding
      both on screen at once for even a few frames reads as a brief flicker
      where their antialiasing disagrees. Clearing the canvas letters in the
      same tick the DOM type is revealed, rather than a few frames after,
      removes that window entirely: exactly one of the two is ever visible.
    */
    if (!introRevealed && introT >= INTRO_MORPH_AT) {
      introRevealed = true;
      onIntroReveal?.();
      letters = [];
    }

    phraseAlpha = 1;

    clearK =
      introT < INTRO_MOVE_AT ? 0 : Math.min(1, (introT - INTRO_MOVE_AT) / 1.0);

    if (introT >= INTRO_END_AT) {
      introT = -1;
      clearK = 1;
      releasePhrase();
      onIntroDone?.();
      onIntroDone = null;
      onIntroReveal = null;
    }
  }

  // --------------------------------------------------------------- events

  /* Mobile browsers fire a resize event as their address bar collapses or
     expands while the page settles — the viewport's height changes, its
     width doesn't. Reacting to that mid-intro re-randomizes the whole field
     via layout() and leaves the letter targets measured at intro start
     pointing at stale coordinates, so the assembled name lands somewhere the
     real DOM text isn't once it hands over. A real resize (rotation, an
     actual window resize) always changes the width, so gating on that is
     enough to ignore the address-bar case without missing a genuine one. */
  let lastResizeWidth = window.innerWidth;

  const onResize = () => {
    if (window.innerWidth === lastResizeWidth) return;
    lastResizeWidth = window.innerWidth;
    layout();
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
