// jsdom lacks a few browser APIs the design system uses on mount. These are environment shims only:
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
