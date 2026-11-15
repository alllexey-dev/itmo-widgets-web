import { useEffect, useRef } from 'react';

type Handlers = Partial<Record<string, () => void>>;

/** Controls that give keys a meaning of their own: text, lists of options, radios, toggles. */
const OWN_KEYS = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="radio"]',
  '[role="radiogroup"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="slider"]',
  '[role="tab"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[aria-pressed]',
].join(', ');

function ownsKeys(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest(OWN_KEYS) !== null;
}

/** An open dialog owns the keyboard. */
function isDialogOpen(): boolean {
  return document.querySelector('dialog[open]') !== null;
}

interface Options {
  /**
   * A selector of the area the keys belong to. With it a key counts only when the focus is inside
   * that area or on nothing at all, so it never acts from the navigation or a filter.
   */
  within?: string;
}

/**
 * Single-key shortcuts by `KeyboardEvent.code` (`KeyJ`), so they work in the Russian layout too.
 * Ignored with Ctrl, Cmd or Alt, on key repeat, under a dialog, and while the focus is on a control
 * that has its own keys (a text field, a selector, a radio or segmented control, a toggle). The
 * handlers of the latest render are read at key time; a missing handler leaves the key to the
 * browser.
 */
export function useShortcuts(handlers: Handlers, { within }: Options = {}): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (ownsKeys(event.target) || isDialogOpen()) return;
      if (within) {
        const target = event.target;
        const nowhere = target === document.body || target === document.documentElement;
        if (!nowhere && !(target instanceof Element && target.closest(within))) return;
      }
      const handler = latest.current[event.code];
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [within]);
}

/**
 * For a bar of filters: a mouse click on a filter does not keep the keyboard there, so the next key
 * is a shortcut again. A filter reached and changed from the keyboard keeps the focus.
 */
export function releasePointerFocus(event: { detail: number; currentTarget: Element }): void {
  const focused = document.activeElement;
  // `detail` counts mouse clicks; a click made by Enter or Space has none.
  if (event.detail > 0 && focused instanceof HTMLElement && event.currentTarget.contains(focused)) {
    focused.blur();
  }
}
