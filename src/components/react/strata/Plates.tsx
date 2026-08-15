import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { createLabelTexture, LABEL_ASPECT } from './labelTexture';
import { subscribeScroll } from '../../../scripts/scroll-store';
import type { DragState } from './useDragState';

export interface PlateSpec {
  id: string;
  label: string;
  metric: string;
}

interface Props {
  plates: PlateSpec[];
  /** Full glass on desktop; a cheaper opaque approximation on phones. */
  cheap: boolean;
  reduced: boolean;
  heroEl: HTMLElement | null;
  /* Owned by StrataCanvas and updated from DOM listeners on the container. */
  dragRef: React.RefObject<DragState>;
}

const PLATE_W = 3.9;
const PLATE_H = 0.92;
const PLATE_D = 0.055;

/* The fan sits right of centre so the display type owns the left half of the
   frame, matching the CSS baseline composition. */
const GROUP_X = 0.9;

/* Resting fan, matched to the CSS baseline so the handover from the static
   composition to the canvas is not a jump. Separation grows from here. */
const REST = { x: 0.17, y: 0.44, z: 0.32 };
const SPREAD = { x: 0.055, y: 0.2, z: 0.5 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function Plates({
  plates,
  cheap,
  reduced,
  heroEl,
  dragRef,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const plateRefs = useRef<(THREE.Group | null)[]>([]);
  const { size } = useThree();

  const [hovered, setHovered] = useState<number | null>(null);

  /* Animation state lives in refs: it changes every frame and must never
     trigger a React render. */
  /* separation: 0 = resting fan, 1 = fully pulled apart. */
  const sep = useRef(0);
  const spin = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const scrollSep = useRef(0);

  const textures = useMemo(
    () => plates.map((p) => createLabelTexture(p.label, p.metric)),
    [plates]
  );

  useEffect(() => {
    return () => textures.forEach((t) => t.dispose());
  }, [textures]);

  /* Scroll drives separation too, so the object comes apart as you leave the
     hero even if you never touch it. */
  useEffect(() => {
    if (!heroEl) return;
    return subscribeScroll(({ y }) => {
      const h = heroEl.offsetHeight || 1;
      scrollSep.current = Math.min(Math.max(y / h, 0), 1);
    });
  }, [heroEl]);

  /* Responsive scale: the group is sized so the fan fills a comfortable
     fraction of the viewport at any width rather than being cropped. */
  const scale = useMemo(() => {
    const base = Math.min(size.width / 1440, 1.15);
    return Math.max(0.52, base);
  }, [size.width]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;

    const d = Math.min(delta, 1 / 30);

    // Separation target: whichever is greater, what the drag asked for or
    // what the scroll implies. Taking the max rather than summing means a
    // drag part-way down the hero cannot push the fan past its limit.
    const drag = dragRef.current;
    const target = Math.max(drag.separation, scrollSep.current);

    if (reduced) {
      sep.current = target;
    } else {
      // Light material: low stiffness, noticeable overshoot. Glass should not
      // feel like it has the mass of the experience panels further down.
      sep.current = lerp(sep.current, target, 1 - Math.pow(0.006, d));
    }

    // Spin spring, driven by the drag. Low stiffness and light damping give
    // the overshoot that makes the stack read as light material.
    const s = spin.current;
    if (reduced) {
      s.x = drag.spinX;
      s.y = drag.spinY;
    } else {
      s.vx = (s.vx + (drag.spinX - s.x) * 0.14) * 0.82;
      s.vy = (s.vy + (drag.spinY - s.y) * 0.14) * 0.82;
      s.x += s.vx;
      s.y += s.vy;
    }

    g.rotation.x = 0.19 + s.x;
    g.rotation.y = -0.33 + s.y;
    g.rotation.z = 0.026;
    /* Pull back slightly as the stack opens. Without this the fan grows past
       the frame at full separation and the outermost sheets get cropped. */
    const pullback = 1 - 0.14 * sep.current;
    g.scale.setScalar(scale * pullback);
    g.position.x = GROUP_X * scale * pullback;

    const n = plates.length;
    for (let i = 0; i < n; i++) {
      const p = plateRefs.current[i];
      if (!p) continue;

      const t = sep.current;
      const centred = i - (n - 1) / 2;

      p.position.x = i * (REST.x + SPREAD.x * t);
      p.position.y = centred * (REST.y + SPREAD.y * t);
      p.position.z = -i * (REST.z + SPREAD.z * t);

      // The hovered sheet lifts toward the viewer — the only per-plate state
      // change, so it reads clearly without needing a colour shift.
      const lift = hovered === i ? 0.16 : 0;
      p.position.z += lift;
      p.rotation.y = hovered === i ? 0.045 : 0;
    }
  });

  const enter = (i: number) => () => {
    setHovered(i);
    document.body.style.cursor = 'grab';
  };

  const leave = () => {
    setHovered(null);
    document.body.style.cursor = '';
  };

  useEffect(() => () => void (document.body.style.cursor = ''), []);

  return (
    <group ref={group}>
      {plates.map((p, i) => (
        <group
          key={p.id}
          ref={(el) => {
            plateRefs.current[i] = el;
          }}
          onPointerOver={enter(i)}
          onPointerOut={leave}
        >
          <RoundedBox
            args={[PLATE_W, PLATE_H, PLATE_D]}
            radius={0.045}
            smoothness={3}
            castShadow={false}
            receiveShadow={false}
          >
            {cheap ? (
              /* Phones: no transmission pass. A dark, very smooth standard
                 material still catches the lightformers as specular streaks,
                 which is what actually sells the glass — refraction over a
                 black backdrop contributes almost nothing anyway. */
              <meshStandardMaterial
                color="#0b0d11"
                roughness={0.14}
                metalness={0.18}
                transparent
                opacity={0.62}
              />
            ) : (
              /*
                Smoked glass, not frosted.

                Transmission with a bright environment and no absorption gives
                a milky white slab, which on a true-black page reads as a grey
                rectangle and destroys the whole foundation. The fix is
                physical: a near-black attenuation colour over a very short
                attenuation distance, so light entering the sheet is absorbed
                before it exits. What survives is the surface — the clearcoat
                specular and the lit edges — which is exactly what should be
                carrying this material.
              */
              <meshPhysicalMaterial
                color="#0d1016"
                transmission={1}
                thickness={1.1}
                roughness={0.055}
                ior={1.47}
                /* Splits the rim light into colour along the bevels. Low —
                   past ~0.4 it reads as a rendering fault. */
                dispersion={0.28}
                clearcoat={1}
                clearcoatRoughness={0.17}
                envMapIntensity={1.5}
                attenuationColor={new THREE.Color('#04060a')}
                attenuationDistance={0.62}
                transparent
                opacity={0.98}
              />
            )}
          </RoundedBox>

          {/* The etching, floated just clear of the front face. */}
          <mesh position={[0, 0.2, PLATE_D / 2 + 0.006]}>
            <planeGeometry args={[PLATE_W * 0.92, (PLATE_W * 0.92) / LABEL_ASPECT]} />
            <meshBasicMaterial
              map={textures[i]}
              transparent
              depthWrite={false}
              toneMapped={false}
              opacity={hovered === null || hovered === i ? 1 : 0.35}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
