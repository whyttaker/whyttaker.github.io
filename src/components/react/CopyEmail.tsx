import { useCallback, useEffect, useRef, useState } from 'react';

type State = 'idle' | 'copied' | 'failed';

interface Props {
  email: string;
}

/*
  Copy-to-clipboard with feedback that has weight to it: the control physically
  compresses on press, then the label swaps behind a mask. The ember rim is the
  success signal — one of only three places that colour is allowed to appear.

  Falls back to a mailto link if the Clipboard API is unavailable or blocked
  (non-secure context, permissions policy), so the control is never a dead end.
*/
export default function CopyEmail({ email }: Props) {
  const [state, setState] = useState<State>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(async () => {
    window.clearTimeout(timer.current);
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(email);
      setState('copied');
    } catch {
      setState('failed');
    }
    timer.current = window.setTimeout(() => setState('idle'), 2200);
  }, [email]);

  const label =
    state === 'copied'
      ? 'Copied to clipboard'
      : state === 'failed'
        ? 'Press ⌘C to copy'
        : email;

  return (
    <div className="copy">
      <button
        type="button"
        className="copy__btn glass glass--pill"
        onClick={copy}
        data-state={state}
      >
        {/* The live region announces the result without moving focus. */}
        <span className="copy__label" key={label}>
          {label}
        </span>
        <span className="copy__icon" aria-hidden="true">
          {state === 'copied' ? '✓' : '⧉'}
        </span>
      </button>

      <span aria-live="polite" className="visually-hidden">
        {state === 'copied'
          ? `${email} copied to clipboard`
          : state === 'failed'
            ? 'Copy failed. Select the address to copy it manually.'
            : ''}
      </span>

      <a className="copy__fallback t-mono" href={`mailto:${email}`}>
        or open mail
      </a>
    </div>
  );
}
