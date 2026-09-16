/**
 * Ensures window.fetch has both a getter and setter so any logging, devtools,
 * or polyfill script in the iframe environment can safely reassign or wrap window.fetch.
 */
(function setupFetchProxy() {
  if (typeof window === 'undefined') return;

  try {
    const target: any = window;
    const origFetch = target.fetch ? target.fetch.bind(target) : null;
    let currentFetch = origFetch;

    const descriptor: PropertyDescriptor = {
      configurable: true,
      enumerable: true,
      get() {
        return currentFetch || origFetch;
      },
      set(newFetch: any) {
        currentFetch = newFetch;
      },
    };

    try {
      Object.defineProperty(target, 'fetch', descriptor);
    } catch {}

    if (typeof Window !== 'undefined' && Window.prototype) {
      try {
        Object.defineProperty(Window.prototype, 'fetch', descriptor);
      } catch {}
    }

    let proto = target;
    while (proto) {
      try {
        const d = Object.getOwnPropertyDescriptor(proto, 'fetch');
        if (d && !d.set) {
          Object.defineProperty(proto, 'fetch', descriptor);
        }
      } catch {}
      proto = Object.getPrototypeOf(proto);
    }
  } catch {}
})();
