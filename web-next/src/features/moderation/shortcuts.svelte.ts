/**
 * Single-key shortcuts by `KeyboardEvent.code` (`KeyJ`), so they work in the Russian layout too. Ignored
 * while typing, with Ctrl, Cmd or Alt, and under a dialog. `handlers` is read at key time, so it may
 * depend on state; a missing handler leaves the key to the browser. Call during component setup.
 */
export function shortcuts(handlers: () => Partial<Record<string, () => void>>): void {
  $effect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (
        isTyping(event.target) ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      ) {
        return;
      }
      const handler = handlers()[event.code];
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
