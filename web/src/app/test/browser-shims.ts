// jsdom lacks a few browser APIs the design system and the charts use on mount. These are environment shims only:
// HTTP is never stubbed here, it goes through MSW.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) satisfies MediaQueryList;
}

if (!Element.prototype.animate) {
  Element.prototype.animate = function animate() {
    return { cancel: () => undefined, finished: Promise.resolve() } as unknown as Animation;
  };
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe = () => undefined;
    unobserve = () => undefined;
    disconnect = () => undefined;
  };
}

window.scrollTo = () => undefined;

// jsdom has the <dialog> element without its methods; the design system opens dialogs with them.
if (!('showModal' in HTMLDialogElement.prototype)) {
  const dialog = HTMLDialogElement.prototype as HTMLDialogElement;
  dialog.show = function show(this: HTMLDialogElement) {
    this.open = true;
  };
  dialog.showModal = dialog.show;
  dialog.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

// Charts may draw on a 2D canvas with Path2D, which jsdom does not implement: a context
// and paths that accept every call and draw nothing.
function inert<T extends object>(target: T): T {
  return new Proxy(target, {
    get: (object, key) =>
      key in object
        ? (object as Record<PropertyKey, unknown>)[key]
        : key === 'measureText'
          ? () => ({ width: 0 })
          : () => undefined,
  });
}

if (!window.Path2D) {
  // Called with `new`; returning an object from a constructor makes that object the instance.
  window.Path2D = function Path2D() {
    return inert({});
  } as unknown as typeof Path2D;
}

HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement) {
  return inert({ canvas: this });
} as unknown as HTMLCanvasElement['getContext'];
