/*
  Relatedness highlighting for the stack field.

  This is the one interaction worth keeping from the old site (app.js:229-258):
  hovering an entry surfaces what it connects to. The original dimmed unrelated
  items with opacity alone; here the states also move in depth, so the field
  reorganises itself rather than just fading.

  Vanilla rather than a React island — the markup is static and server
  rendered, so hydrating 47 nodes to attach two listeners would be waste. Event
  delegation means exactly three listeners total regardless of entry count.
*/

type State = 'active' | 'related' | 'muted';

export function initStackField(): void {
  const field = document.querySelector<HTMLElement>('[data-stack-field]');
  if (!field) return;

  const items = Array.from(
    field.querySelectorAll<HTMLElement>('[data-stack-item]')
  );
  if (!items.length) return;

  const groupsOf = (el: HTMLElement): Set<string> =>
    new Set((el.dataset.groups ?? '').split(' ').filter(Boolean));

  const groupCache = new Map(items.map((el) => [el, groupsOf(el)]));

  const overlaps = (a: Set<string>, b: Set<string>): boolean => {
    for (const g of a) if (b.has(g)) return true;
    return false;
  };

  const clear = () => {
    for (const el of items) delete el.dataset.state;
  };

  const focusOn = (target: HTMLElement) => {
    const groups = groupCache.get(target)!;
    for (const el of items) {
      const state: State =
        el === target
          ? 'active'
          : overlaps(groups, groupCache.get(el)!)
            ? 'related'
            : 'muted';
      el.dataset.state = state;
    }
  };

  const resolve = (e: Event): HTMLElement | null =>
    (e.target as Element | null)?.closest?.('[data-stack-item]') ?? null;

  field.addEventListener('pointerover', (e) => {
    const el = resolve(e);
    if (el) focusOn(el as HTMLElement);
  });

  field.addEventListener('pointerleave', clear);

  /* Deliberately not focusable. Making all 47 entries tabbable to expose the
     relatedness highlight put 47 stops between About and Contact for keyboard
     users — a real cost for an enhancement, on content that is not
     interactive. The list itself is the information; the highlight is a
     pointer affordance on top of it. */
}
