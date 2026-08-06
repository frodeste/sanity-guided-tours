/**
 * A controllable `window.IntersectionObserver` stub for deterministic tests
 * of `<Video>`'s (`src/react/Video.tsx`) autoplay-visibility gating.
 * happy-dom (as of the version this repo pins, `@happy-dom/global-registrator`
 * 20.x) DOES implement a real `IntersectionObserver` constructor —
 * `observe()` doesn't throw — but its callback is never actually invoked:
 * there is no real layout engine behind it to compute an intersection, so
 * nothing ever crosses the configured threshold on its own. That's fine for
 * code that only ever constructs an observer defensively, but useless for
 * asserting playback reacts to a visibility change, which is exactly what
 * `<Video>`'s gating needs covered — the same gap `test/setup/matchMedia.ts`
 * fills for `window.matchMedia`'s equally inert happy-dom implementation.
 *
 * `installIntersectionObserver` swaps `globalThis.IntersectionObserver` for
 * `FakeIntersectionObserver` itself (a real `class`, not a wrapper function —
 * assigning the class directly, rather than a factory that returns instances
 * of it, is what lets this satisfy the global's `{prototype; new(...)}`
 * constructor-interface type without an `as` cast, which oxlint bans). Every
 * `new IntersectionObserver(...)` call anywhere in the code under test — in
 * practice, only `<Video>`'s one call — is recorded on the class's static
 * `instances` array; a test drives the most recent one with `latest()?.fire(...)`,
 * which synchronously invokes the real registered callback with a hand-built
 * `IntersectionObserverEntry`-shaped object (a plain object literal
 * satisfying the interface structurally — again no cast — for the one field
 * `<Video>` actually reads, `isIntersecting`; `DOMRectReadOnly`, unlike
 * `IntersectionObserverEntry`, IS genuinely constructible in happy-dom, so
 * `boundingClientRect`/`intersectionRect` are real instances rather than
 * further hand-rolled stand-ins).
 */

// `IntersectionObserverEntry` is built up in an untyped local first, then
// returned, rather than as a literal typed directly to the interface: the
// project's own pinned `typescript` (5.9.3, `bun run typecheck`) and
// oxlint's bundled `oxlint-tsgolint` type-checker disagree on that
// interface's exact member set — `isVisible` below is part of a later DOM
// spec revision tsgolint already tracks but 5.9.3's `lib.dom.d.ts` doesn't
// yet declare. A literal assigned/returned directly to a known target type
// undergoes excess-property checking (5.9.3 would reject `isVisible` as
// unknown); a plain variable passed through doesn't, so both type-checkers
// accept this without needing an `as` cast (oxlint bans unsafe ones) or two
// diverging copies of this function.
function fakeEntry(target: Element, isIntersecting: boolean): IntersectionObserverEntry {
  const rect = new DOMRectReadOnly(0, 0, isIntersecting ? 100 : 0, isIntersecting ? 100 : 0)
  const entry = {
    boundingClientRect: rect,
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: rect,
    isIntersecting,
    isVisible: isIntersecting,
    rootBounds: null,
    target,
    time: 0,
  }
  return entry
}

class FakeIntersectionObserver implements IntersectionObserver {
  /** Every instance constructed since the last `installIntersectionObserver()` call reset this. */
  static instances: FakeIntersectionObserver[] = []

  readonly root: Element | Document | null
  readonly rootMargin: string
  readonly thresholds: ReadonlyArray<number>
  // Newer members of the `IntersectionObserver` interface (mirroring their
  // `IntersectionObserverInit` counterparts) that only tsgolint's bundled
  // lib requires — see `fakeEntry`'s doc comment above for why this file
  // has to satisfy two type-checkers with slightly different DOM lib
  // versions. Harmless extras under the project's own older `tsc`: unlike
  // an object literal, a class `implements`-checks only require it to have
  // AT LEAST an interface's members, never flag it for having more.
  readonly delay: number = 0
  readonly trackVisibility: boolean = false
  readonly scrollMargin: string = ''
  /** Set true by `disconnect()` — asserted directly by the unmount-cleanup test. */
  disconnected = false
  private observedTarget: Element | null = null
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback
    this.root = options?.root ?? null
    this.rootMargin = options?.rootMargin ?? ''
    const threshold = options?.threshold ?? 0
    this.thresholds = Array.isArray(threshold) ? threshold : [threshold]
    FakeIntersectionObserver.instances.push(this)
  }

  observe(target: Element): void {
    this.observedTarget = target
  }

  unobserve(target: Element): void {
    if (this.observedTarget === target) this.observedTarget = null
  }

  disconnect(): void {
    this.disconnected = true
    this.observedTarget = null
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  /** Synchronously invokes the registered callback with one fabricated entry for whatever this observer is currently observing. A no-op if `observe()` was never called (or was followed by `unobserve()`/`disconnect()`). */
  fire(isIntersecting: boolean): void {
    if (!this.observedTarget) return
    this.callback([fakeEntry(this.observedTarget, isIntersecting)], this)
  }
}

export interface InstalledIntersectionObserver {
  /** The most recently constructed `FakeIntersectionObserver` instance, or `null` if none has been constructed yet. `<Video>` only ever constructs one per mount, so this is enough for every call site. */
  latest(): FakeIntersectionObserver | null
  /** Restores the original `IntersectionObserver` global. Call from `afterEach`. */
  restore(): void
}

/** Installs the stub and returns the controls to drive and later remove it. */
export function installIntersectionObserver(): InstalledIntersectionObserver {
  const original = globalThis.IntersectionObserver
  FakeIntersectionObserver.instances = []
  globalThis.IntersectionObserver = FakeIntersectionObserver

  return {
    latest() {
      return FakeIntersectionObserver.instances.at(-1) ?? null
    },
    restore() {
      globalThis.IntersectionObserver = original
    },
  }
}
