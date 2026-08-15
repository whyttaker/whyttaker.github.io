import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface NavItem {
  label: string;
  href: string;
}

interface Props {
  items: readonly NavItem[];
  monogram: string;
  /* Section ids observed for the active indicator, in document order. */
  sections: readonly string[];
}

/*
  Two states, one element.

  At the top of the page the nav is bare: monogram and links laid out across
  the header with no material at all. Once you leave the hero it condenses into
  a floating glass pill. The morph is a width/padding/background transition on
  a single container rather than two components crossfading, so it reads as one
  object changing shape.

  The active indicator is a shared-layout element that slides between links,
  which is the "transition smoothly rather than change colour" the brief asked
  for. Under reduced motion it still moves — instantly — so the state is never
  ambiguous.
*/
export default function GlassNav({ items, monogram, sections }: Props) {
  const [condensed, setCondensed] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const ratios = useRef(new Map<string, number>());

  /* Condense once the hero is behind us. On phones the nav lives at the bottom
     and is a pill from the start, so there is no bare state to leave. */
  useEffect(() => {
    const compact = window.matchMedia('(max-width: 48rem)');

    const update = () => {
      setCondensed(compact.matches || window.scrollY > window.innerHeight * 0.6);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    compact.addEventListener('change', update);
    return () => {
      window.removeEventListener('scroll', update);
      compact.removeEventListener('change', update);
    };
  }, []);

  /* Active section: track visibility ratios and pick the most visible, rather
     than firing on whichever section crossed a line most recently. That keeps
     the indicator stable when two sections are on screen at once. */
  useEffect(() => {
    const els = sections
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.current.set(entry.target.id, entry.intersectionRatio);
        }
        let best: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios.current) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        }
        setActive(bestRatio > 0.08 ? best : null);
      },
      { threshold: [0, 0.08, 0.25, 0.5, 0.75, 1], rootMargin: '-15% 0px -35% 0px' }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav
      className={`nav ${condensed ? 'is-condensed' : ''}`}
      aria-label="Sections"
      data-nav
    >
      <div className={`nav__shell ${condensed ? 'glass glass--pill' : ''}`}>
        <a className="nav__mark" href="/" aria-label="Home">
          {monogram}
        </a>

        <ul className="nav__links">
          {items.map((item) => {
            const id = item.href.split('#')[1] ?? '';
            const isActive = active === id;
            return (
              <li key={item.href} className="nav__item">
                <a
                  className="nav__link"
                  href={item.href}
                  data-active={isActive || undefined}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="nav__indicator"
                      aria-hidden="true"
                      transition={
                        reduced
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 380, damping: 32, mass: 0.6 }
                      }
                    />
                  )}
                  <span className="nav__label">{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
