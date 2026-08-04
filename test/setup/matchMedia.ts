/**
 * A controllable `window.matchMedia` stub for deterministic tests of
 * hooks that read and subscribe to media queries (`useIsMobile`, Task 7;
 * usable later for `prefersReducedMotion`, Task 9). happy-dom ships its
 * own `matchMedia`, but it always reports `matches: false` and its
 * `MediaQueryList` never actually fires `change` — there is no real
 * viewport behind it to flip. That is fine for code that only ever reads
 * `.matches` once, but useless for asserting a hook reacts when the query
 * flips, which is exactly what `useIsMobile`'s resize-listener behavior
 * needs covered.
 *
 * `installMatchMedia` swaps in one fake `MediaQueryList` per query string
 * a test calls `matchMedia` on; a test then flips it with `setMatches`,
 * which updates `.matches` and dispatches a real `change` event. `FakeMediaQueryList`
 * extends the real (happy-dom-provided) `EventTarget`, so
 * `addEventListener`/`removeEventListener`/`dispatchEvent` — the only
 * members any real call site in this codebase actually uses (see
 * `src/react/helpers.ts`'s `useIsMobile`) — are the genuine, fully
 * functional implementation, not a hand-rolled stand-in. `addListener`/
 * `removeListener` (the deprecated pre-`EventTarget` API) are implemented
 * as no-ops purely to satisfy `MediaQueryList`'s structural shape, which
 * lets this whole file assign to `window.matchMedia` without an `as` cast
 * (oxlint bans them) — genuinely wiring those two to `addEventListener`
 * hits an unrelated variance mismatch in `EventListener`'s `Event`-typed
 * parameter, for two methods nothing here calls.
 */

class FakeMediaQueryList extends EventTarget implements MediaQueryList {
  matches: boolean
  readonly media: string
  onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null

  constructor(media: string, matches: boolean) {
    super()
    this.media = media
    this.matches = matches
  }

  addListener(): void {}
  removeListener(): void {}
}

export interface InstalledMatchMedia {
  /**
   * Sets `matches` for `query` and dispatches a real `change` event to
   * every listener registered on it via `addEventListener`. A no-op for a
   * query nothing has called `matchMedia(query)` on yet (there is no
   * `FakeMediaQueryList` to update).
   */
  setMatches(query: string, matches: boolean): void
  /** Restores the original `window.matchMedia`. Call from `afterEach`. */
  restore(): void
}

/** Installs the stub and returns the controls to drive and later remove it. */
export function installMatchMedia(): InstalledMatchMedia {
  const original = window.matchMedia
  const registry = new Map<string, FakeMediaQueryList>()

  function matchMedia(query: string): FakeMediaQueryList {
    const existing = registry.get(query)
    if (existing) return existing

    const mql = new FakeMediaQueryList(query, false)
    registry.set(query, mql)
    return mql
  }

  window.matchMedia = matchMedia

  return {
    setMatches(query, matches) {
      const mql = registry.get(query)
      if (!mql) return
      mql.matches = matches
      mql.dispatchEvent(new Event('change'))
    },
    restore() {
      window.matchMedia = original
    },
  }
}
