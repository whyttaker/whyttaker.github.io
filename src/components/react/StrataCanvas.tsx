import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { useReducedMotion } from 'motion/react';
import * as THREE from 'three';
import Plates, { type PlateSpec } from './strata/Plates';
import { useDragState } from './strata/useDragState';

interface Props {
  plates: PlateSpec[];
}

/*
  Glass over a black page has nothing to refract, so refraction is not what
  sells it — reflection is. The scene is lit like a photographic studio: a
  broad soft key above, a narrow bright strip that becomes the specular streak
  travelling across each sheet, and a cool rim behind. Lightformers rather than
  an HDR file, so the whole environment costs nothing to download.
*/
function Studio() {
  /* blur softens the lightformer rectangles into gradients. Without it their
     straight edges show up as hard diagonal seams reflected across the sheets,
     which reads as a texture bug rather than a highlight. */
  return (
    <Environment resolution={512} blur={0.65}>
      {/* Key: broad, soft, above and slightly front. */}
      <Lightformer
        intensity={1.15}
        form="rect"
        position={[0, 4.5, 3]}
        rotation={[-Math.PI / 2.6, 0, 0]}
        scale={[10, 6, 1]}
        color="#f4f0e8"
      />
      {/* The streak. Narrow and angled, this is the highlight that rakes
          across the sheets as they turn. */}
      <Lightformer
        intensity={2.0}
        form="rect"
        position={[-3.4, 1.2, 2.4]}
        rotation={[0, Math.PI / 2.6, Math.PI / 7]}
        scale={[1.7, 9, 1]}
        color="#ffffff"
      />
      {/* Front reflector. The sheets face the camera, so what they show on
          their faces is whatever sits behind the viewer — with nothing there,
          a face-on plane in a dark studio reflects nothing and reads as a hole
          rather than a surface. This is the panel that gives them a face. */}
      <Lightformer
        intensity={1.25}
        form="rect"
        position={[-3.2, 1.6, 6.5]}
        rotation={[0, 0.42, Math.PI / 5]}
        scale={[6, 9, 1]}
        color="#dfe8f5"
      />
      {/* Cool rim from behind-left, picking out the edges. */}
      <Lightformer
        intensity={0.85}
        form="rect"
        position={[-5, 0, -4]}
        rotation={[0, -Math.PI / 3, 0]}
        scale={[6, 5, 1]}
        color="#bfd4ee"
      />
      {/* A whisper of warmth on the right so the palette is not entirely cold. */}
      <Lightformer
        intensity={0.3}
        form="rect"
        position={[5, -1.4, 1]}
        rotation={[0, -Math.PI / 2.2, 0]}
        scale={[5, 4, 1]}
        color="#e0a97f"
      />
    </Environment>
  );
}

/** Keeps the transmission pass cheap and the buffer sane on high-DPR screens. */
function RendererTuning({ cheap }: { cheap: boolean }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.82;
    // Transmission renders the scene an extra time. Halving its resolution is
    // invisible through frosted glass and roughly halves that cost.
    const anyGl = gl as unknown as { transmissionResolutionScale?: number };
    if ('transmissionResolutionScale' in anyGl) {
      anyGl.transmissionResolutionScale = cheap ? 0.25 : 0.5;
    }
  }, [gl, cheap]);
  return null;
}

export default function StrataCanvas({ plates }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() ?? false;
  const dragRef = useDragState(host);

  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [cheap, setCheap] = useState(false);
  const [heroEl, setHeroEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeroEl(document.getElementById('hero'));
    setCheap(window.matchMedia('(max-width: 60rem), (pointer: coarse)').matches);
  }, []);

  /* Only render while the hero is on screen. Once you have scrolled to the
     work section there is no reason to keep a transmission pass running. */
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '10% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* Flag the document once the canvas has painted, which fades out the CSS
     baseline composition underneath and reveals the drag hint. */
  useEffect(() => {
    if (!ready) return;
    document.documentElement.setAttribute('data-strata-ready', '');
    return () => document.documentElement.removeAttribute('data-strata-ready');
  }, [ready]);

  /* Mobile drops to four sheets: below 60rem the fan compresses so hard that
     six sheets read as a rendering fault rather than a stack. */
  const shown = useMemo(
    () => (cheap ? plates.slice(0, 4) : plates),
    [cheap, plates]
  );

  return (
    <div ref={host} className="strata" data-ready={ready || undefined}>
      <Canvas
        /* Under reduced motion the scene is composed once and the loop stops,
           leaving a still render rather than an empty box. */
        frameloop={reduced ? 'demand' : visible ? 'always' : 'never'}
        dpr={cheap ? [1, 1.5] : [1, 1.75]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [0, 0, 9], fov: 34 }}
        onCreated={() => setReady(true)}
        aria-hidden="true"
      >
        <RendererTuning cheap={cheap} />
        <Suspense fallback={null}>
          <Studio />
          <Plates
            plates={shown}
            cheap={cheap}
            reduced={reduced}
            heroEl={heroEl}
            dragRef={dragRef}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
