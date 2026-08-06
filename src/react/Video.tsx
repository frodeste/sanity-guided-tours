'use client'

import {useEffect, useRef, useState, type ReactNode} from 'react'

/** The `matchMedia` query `useReducedMotionMedia` subscribes to — the same string `../react/helpers.ts`'s one-shot `prefersReducedMotion()` reads. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** `IntersectionObserver`'s `threshold` — "≥50% visible" (plan Task 2, design spec §18). */
const VISIBILITY_THRESHOLD = 0.5

/**
 * Whether `prefers-reduced-motion: reduce` currently matches, live-updated
 * for the life of the mount via a `change` listener + cleanup — unlike
 * `../react/helpers.ts`'s `prefersReducedMotion()`, which only ever reads
 * the value once per call and has no listener of its own. A one-shot read
 * is enough for that helper's call sites (a hotspot's per-render class
 * computation, which itself re-runs on every render); autoplay gating here
 * is different — the OS/browser preference can change while `<Video>` stays
 * mounted on the same step (a user opens their OS accessibility settings
 * mid-tour), and playback must follow it without needing an unrelated
 * re-render to happen to notice.
 *
 * SSR-safe the same way `useIsMobile` (`./helpers.ts`) is: the initial
 * state is a synchronous read guarded by `typeof window`, not deferred to
 * the effect — unlike `useIsMobile`, there's no hydration-mismatch risk to
 * guard against here (this hook doesn't affect what's rendered, only
 * imperative `play()`/`pause()` calls made from an effect after mount), so
 * there's no reason to force a `false` first paint the way that hook does.
 */
function useReducedMotionMedia(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(REDUCED_MOTION_QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY)
    const update = (): void => setReduced(mediaQueryList.matches)

    update()
    mediaQueryList.addEventListener('change', update)
    return () => mediaQueryList.removeEventListener('change', update)
  }, [])

  return reduced
}

export interface VideoProps {
  /** The uploaded file asset's resolved URL (`GuidedTourStepVideo.fileUrl`) — takes precedence over `url` when both are somehow present. */
  fileUrl: string | null
  /** The direct-link URL (`GuidedTourStepVideo.url`) — used only when `fileUrl` is `null`. */
  url: string | null
  /** The step's (mobile-resolved) screenshot URL — both the `poster` frame shown before playback starts and the reduced-motion/no-JS fallback frame. */
  posterUrl: string
  /** The accessible name (`aria-label`) — `Step` resolves this from the step's title before calling in, coalescing `null` to a non-empty fallback (see that call site). */
  ariaLabel: string
  className?: string
}

/**
 * Renders a step's video (M11) — replaces the screenshot `<img>` entirely
 * when a step has one (`Step.tsx`), never stacked alongside it. Fixed
 * playback defaults, not schema-configurable (design spec §18): `muted`,
 * `loop`, `playsInline`, `preload="metadata"`. `src` is `fileUrl ?? url` —
 * exactly one is expected to be non-null once `video` is present at all
 * (`GuidedTourStepVideo`'s doc comment), but this doesn't throw on the
 * defensive both-null case (an unvalidated document written outside
 * Studio); it just renders a `<video>` with no `src`.
 *
 * Autoplay is orchestrated, not declarative (a plain `autoPlay` attribute
 * would ignore both gates below): two conditions must BOTH hold before
 * this ever calls `.play()` —
 *
 * 1. `!useReducedMotionMedia()` — reduced-motion users never get autoplay;
 *    `controls` renders instead so they can start it themselves.
 * 2. The video is ≥50% visible in the viewport, tracked via an
 *    `IntersectionObserver` (`threshold: 0.5`) observing the `<video>`
 *    element itself.
 *
 * Whenever either condition stops holding, `.pause()` is called instead —
 * covers both directions (scrolled off-stage, OR reduced-motion flips on
 * mid-playback) with the same effect, keyed on `[visible, reducedMotion,
 * src]` — `src` (the resolved `fileUrl ?? url`) is a dep too, not just the
 * two gates, so that a same-mount source change (`Step` renders `<Video>`
 * without a `key`, so consecutive video steps update props on the same
 * `<video>` rather than remounting it) re-evaluates and calls `.play()`
 * again for the new source instead of leaving a silently-loaded-but-never-
 * played video behind.
 *
 * Two happy-dom accommodations (plan Task 2, both load-bearing for the test
 * suite, not just defensive production code):
 * - `HTMLMediaElement.play()`/`.pause()` exist as callable stubs, but
 *   `.play()` isn't guaranteed to return a real `Promise` in every
 *   environment this ever runs in (autoplay-policy rejection is a real
 *   browser behavior too) — both calls are guarded with a `typeof` check
 *   first, and a returned `.play()` promise's rejection is swallowed
 *   (`.catch(() => {})`) rather than left to become an unhandled rejection.
 * - `IntersectionObserver` is feature-detected
 *   (`typeof IntersectionObserver === 'function'`); when it's absent, the
 *   video is treated as visible unconditionally — the same "degrade to
 *   permissive" choice a browser without support would force anyway (no
 *   way to gate on visibility at all), and it keeps a test environment
 *   without the constructor from deadlocking playback gating on a signal
 *   that can never arrive.
 *
 * Ref reads only ever happen inside these effects, never during render —
 * see `GuidedTourContextValue`'s doc comment (`./context.ts`) for why a
 * render-time ref read is unsafe (the same rule `GuidedTour.tsx`'s
 * `trackerRef`/`stageRef` follow).
 */
export function Video({fileUrl, url, posterUrl, ariaLabel, className}: VideoProps): ReactNode {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const reducedMotion = useReducedMotionMedia()
  const [visible, setVisible] = useState(false)
  const src = fileUrl ?? url ?? undefined

  useEffect(() => {
    const node = videoRef.current
    if (!node) return undefined

    // Feature-detected before the `IntersectionObserver` construction
    // below, not inside its callback — an environment without the
    // constructor at all never gets a callback to invoke in the first
    // place. `markVisible` (a locally-defined function called synchronously,
    // same indirection `useIsMobile`'s `update` above uses for its own
    // synchronous first call) keeps this and the observer's `onIntersect`
    // below as the only two places `setVisible` is ever called.
    if (typeof IntersectionObserver !== 'function') {
      const markVisible = (): void => setVisible(true)
      markVisible()
      return undefined
    }

    const onIntersect = (entries: IntersectionObserverEntry[]): void => {
      const entry = entries.at(-1)
      if (entry) setVisible(entry.isIntersecting)
    }

    const observer = new IntersectionObserver(onIntersect, {threshold: VISIBILITY_THRESHOLD})
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const node = videoRef.current
    if (!node) return

    if (visible && !reducedMotion) {
      if (typeof node.play === 'function') {
        // Autoplay-policy rejections (no user gesture yet, etc.) are
        // expected and not actionable — swallowed rather than surfaced.
        node.play().catch(() => {})
      }
      return
    }

    if (typeof node.pause === 'function') node.pause()
    // `src` is a dep, not just `visible`/`reducedMotion`: `<Step>` renders
    // `<Video>` without a `key` (`Step.tsx`), so navigating between two
    // consecutive video steps re-renders this SAME mounted component with
    // new `fileUrl`/`url` props rather than remounting it — React DOM does
    // issue a fresh `load()` when the `src` attribute changes underneath,
    // but nothing here would call `.play()` again for it without `src` in
    // this array, since `visible`/`reducedMotion` can both stay unchanged
    // across that transition (already-visible, motion already allowed).
  }, [visible, reducedMotion, src])

  return (
    <video
      ref={videoRef}
      className={className}
      muted
      loop
      playsInline
      preload="metadata"
      poster={posterUrl}
      src={src}
      aria-label={ariaLabel}
      controls={reducedMotion}
    />
  )
}
