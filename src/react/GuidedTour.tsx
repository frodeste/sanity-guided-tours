'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import type {GuidedTourDoc} from '../queries/types'
import {GuidedTourContext} from './context'
import type {GuidedTourEventHandler} from './events'
import {isNavigationExempt} from './helpers'
import {defaultLabels, formatLabel, type GuidedTourLabels} from './labels'
import {clampStep, firstStepOfChapter, flattenTour, nextStep, prevStep} from './navigation'
import {Outro} from './Outro'
import {missingRequired, personalizeText, resolveTokens} from './personalize'
import {createTracker} from './session'
import {Step} from './Step'
import {themeToStyle} from './theme'
import type {GuidedTourImageProps} from './types'

/**
 * @public
 */
export interface GuidedTourProps {
  tour: GuidedTourDoc
  tokens?: Record<string, string | string[] | undefined>
  labels?: Partial<GuidedTourLabels>
  onEvent?: GuidedTourEventHandler
  /**
   * Optional image renderer override, e.g. to substitute `next/image`.
   * Replaces the default `<Image>` renderer entirely (Task 7) for every
   * screenshot this renders — the current step's and both preloaded
   * neighbors' — receiving `GuidedTourImageProps` for each.
   */
  renderImage?: (props: GuidedTourImageProps) => ReactNode
  /**
   * Controlled position (global step index). The outro screen (M4) is not
   * itself a step index — there is no value of `step` that means "showing
   * the outro" — so an externally-driven change to this prop to a
   * DIFFERENT index (a route change, a "restart" action, browser
   * back/forward) always dismisses the outro if it's currently showing.
   * Re-setting `step` to the exact index it already held is not observable
   * as a change and won't dismiss it on its own. Only the component's own
   * internal transitions (e.g. Prev from the outro) manage the outro's
   * visibility themselves otherwise.
   */
  step?: number
  onStepChange?: (step: number) => void
  className?: string
  /**
   * Merged onto the tour root — the documented hook for `--gt-*`
   * custom-property overrides. Permanent public API, not an M2 stopgap:
   * M4's theme wiring composes with it (theme first, then this style
   * wins). Design spec §8.1.
   */
  style?: CSSProperties
}

function joinClassNames(...classNames: (string | false | undefined)[]): string {
  return classNames.filter((name): name is string => Boolean(name)).join(' ')
}

// Elements with native Space/Enter activation of their own (plan Task 8:
// "Space next ONLY when the event target isn't a button/link/input" —
// never hijack activation). A Space keydown on any of these is left alone
// entirely — no `preventDefault`, no navigation — so the browser's own
// click-on-activation still fires exactly once. `isNavigationExempt`
// (./helpers) is Space's *other* guard, layered on top of this one (CI
// review round 2 on PR 93) — the two check different things and neither
// subsumes the other: this set exists so Space doesn't hijack a
// button/link's own activation, `isNavigationExempt` so Space (like
// Arrow/Home/End) doesn't yank a keyboard user out of a text field or an
// open tooltip's content.
const NATIVE_ACTIVATION_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'])

// The four navigating keys `isNavigationExempt` (./helpers) guards — Space
// is handled separately in the `switch` below since it layers a second,
// independent guard (`NATIVE_ACTIVATION_TAGS` above) on top.
const NAVIGATION_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'Home', 'End'])

// `--gt-progress-percent` is a CSS custom property, not a member of
// `CSSProperties` — React's type doesn't model arbitrary custom
// properties, so this narrow extension stands in for a cast (`as` is
// banned by oxlint). Same pattern as `TextOverlay.tsx`'s `OverlayStyle`.
type ProgressStyle = CSSProperties & {'--gt-progress-percent'?: string}

/**
 * The guided tour viewer: header (title, progress, chapter menu), the
 * current step's screenshot and elements, and prev/next/dots controls.
 * Uncontrolled by default (internal position state starting at step 0);
 * pass `step`/`onStepChange` to control the position externally (e.g. to
 * sync it to the URL) — interactions then call `onStepChange` and never
 * mutate position themselves. See design spec §8.1-§8.4 and
 * `docs/superpowers/plans/2026-08-04-m2-viewer.md`'s Component/DOM
 * contract for the exact markup this renders.
 *
 * @public
 */
export function GuidedTour({
  tour,
  tokens: providedTokens,
  labels: labelOverrides,
  onEvent,
  renderImage,
  step: controlledStep,
  onStepChange,
  className,
  style,
}: GuidedTourProps): ReactNode {
  const flat = useMemo(() => flattenTour(tour), [tour])
  const isControlled = typeof controlledStep === 'number'

  const [internalStep, setInternalStep] = useState(0)

  // Whether the outro screen (M4, `Outro.tsx`) is showing in place of
  // `.gt-stage`. Deliberately not part of `flat`/`currentIndex` — the
  // outro isn't a step (no `step_viewed`, no dot, no progress movement:
  // progress freezes at 100% and the dots stay put on the last step,
  // design doc's "simplest" pick). `GuidedTourProps` has no `outro`-position
  // prop of its own to control this directly — it's always this component's
  // own `useState` — but while controlled it's still reconciled against
  // `step` below (the render-time sync block just after this), because an
  // externally-driven step change is the one thing besides the component's
  // own transitions that must be able to end it (see `GuidedTourProps.step`'s
  // doc comment). Set `true` only by `handleNext` completing the last step
  // of a tour that has an `outro`; reset `false` by `goTo` (every other
  // in-component navigation — Prev, Home/End, a dot, a chapter jump — exits
  // the outro back into the ordinary step flow) and, while controlled, by
  // the sync block below whenever `step` itself changes externally.
  const [showOutro, setShowOutro] = useState(false)

  // Keep `internalStep` mirroring the controlled value for as long as the
  // component is controlled, so that a later transition to uncontrolled
  // (the `step` prop dropped) picks up from the last controlled position
  // instead of snapping back to whatever `internalStep` held before
  // control started (it was never touched while controlled otherwise).
  // This is React's sanctioned "adjust state during render" pattern — safe
  // because it's gated on the value actually differing, so it converges in
  // the same render rather than looping, and it avoids the extra tick (and
  // stale-frame flash) a `useEffect` sync would introduce.
  //
  // `internalStep !== clampedControlled` is also the signal for a
  // genuinely *external* step change (a consumer-driven route change,
  // "restart", browser back/forward — see `GuidedTourProps.step`'s doc
  // comment): `internalStep` already holds the last controlled value this
  // component itself observed, so a difference here can only come from the
  // `step` prop having moved out from under it. The outro isn't a step
  // index the controlled contract can express, so any such change clears
  // `showOutro` unconditionally. (A "restart" that re-sets `step` to the
  // very index it already held — the tour was showing the outro past that
  // same last step — produces no observable prop change here and so isn't
  // caught by this branch; nothing short of an explicit remount can
  // distinguish that from "nothing happened," and it's not the reported
  // bug — the reported case is moving to a genuinely different index.) The
  // component's own transitions (Prev off the outro) go through `goTo`,
  // which resets `showOutro` itself and, while controlled, never changes
  // `internalStep` directly — so they never hit this branch and are
  // unaffected by it.
  if (isControlled) {
    const clampedControlled = clampStep(flat, controlledStep)
    if (internalStep !== clampedControlled) {
      setInternalStep(clampedControlled)
      setShowOutro(false)
    }
  }

  const currentIndex = clampStep(flat, isControlled ? controlledStep : internalStep)

  const labels = useMemo<GuidedTourLabels>(
    () => ({...defaultLabels, ...labelOverrides}),
    [labelOverrides],
  )

  const resolvedTokens = useMemo(
    () => resolveTokens(tour.tokens, providedTokens ?? {}),
    [tour.tokens, providedTokens],
  )

  const settings = {
    showProgress: tour.settings?.showProgress ?? true,
    showChapterMenu: tour.settings?.showChapterMenu ?? true,
    showStepDots: tour.settings?.showStepDots ?? true,
  }

  const contributingChapters = useMemo(
    () =>
      tour.chapters
        .map((chapter, chapterIndex) => ({chapter, chapterIndex}))
        .filter(({chapterIndex}) =>
          flat.some((flatStep) => flatStep.chapterIndex === chapterIndex),
        ),
    [tour.chapters, flat],
  )

  // The tracker is created once (lazy-initialized into a ref, not
  // `useRef(createTracker(...))`, which would build a throwaway tracker on
  // every render even though only the first one is ever kept) and then
  // reused for the component's entire lifetime, including across React
  // Strict Mode's dev-only mount->cleanup->remount cycle — that cycle
  // reuses the same fiber and its refs, it doesn't reset them. Only the
  // lazy-init write above is done during render; every read of
  // `trackerRef.current` below happens inside an effect or an event
  // handler, never inline in the render body (reading a ref during render
  // is unsafe — see GuidedTourContextValue's doc comment in ./context).
  const trackerRef = useRef<ReturnType<typeof createTracker> | null>(null)
  if (trackerRef.current === null) {
    trackerRef.current = createTracker(onEvent, tour._id)
  }

  // `.gt-stage` (`tabIndex={-1}`, below) is the keyboard-navigation focus
  // target (plan Task 8) — a stable DOM node across step changes (`Step`
  // re-renders inside it, it never remounts), so focusing it synchronously
  // from the key handler, before React has flushed the resulting
  // navigation, is safe.
  const stageRef = useRef<HTMLDivElement>(null)

  // `Step` keeps this pointed at a closer for whatever tooltip it
  // currently has open, or `null` when none is — see
  // `GuidedTourContextValue.closeOpenTooltipRef`'s doc comment (context.ts)
  // for why the root's Escape handling needs this instead of reaching
  // `Tooltip.tsx`'s own local handler directly (focus can be on
  // `.gt-stage`, outside that handler's subtree, right after keyboard
  // navigation put it there).
  const closeOpenTooltipRef = useRef<(() => void) | null>(null)

  // trackerRef/closeOpenTooltipRef are stable ref objects — safe to omit
  // from exhaustive-deps the way any useRef() return value is.
  const contextValue = useMemo(
    () => ({tokens: resolvedTokens, labels, trackerRef, closeOpenTooltipRef}),
    [resolvedTokens, labels],
  )

  // Distinct step indices actually viewed this session, passed to
  // `tracker.complete()` as `stepsViewed`. Deliberately not `flat.length`:
  // a viewer who jumps via the chapter menu or dots hasn't necessarily
  // seen every step, so this counts what was actually viewed.
  const viewedStepsRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    for (const key of missingRequired(tour.tokens, resolvedTokens)) {
      console.warn(`[GuidedTour] missing required personalization token "${key}"`)
    }
  }, [tour.tokens, resolvedTokens])

  // Strict-Mode-safe view/abandon tracking (design spec §8.4, plan Task 4
  // ruling): cleanup schedules an abandon for the step being left; the
  // next effect run cancels it before doing anything else. Only a real
  // unmount — no subsequent effect run to cancel it — lets the 0 ms timer
  // fire and actually emit `tour_abandoned`. This also means ordinary
  // navigation never spuriously abandons: the schedule (on cleanup) and
  // the cancel (at the top of the next run) happen synchronously in the
  // same commit, well before the deferred timer would fire.
  useEffect(() => {
    const tracker = trackerRef.current
    if (!tracker) return undefined

    const flatStep = flat[currentIndex]
    tracker.cancelScheduledAbandon()
    if (!flatStep) return undefined

    tracker.stepViewed({
      stepIndex: flatStep.stepIndex,
      stepKey: flatStep.step._key,
      chapterIndex: flatStep.chapterIndex,
    })
    viewedStepsRef.current.add(flatStep.stepIndex)

    return () => {
      tracker.scheduleAbandon(flatStep.stepIndex)
    }
  }, [currentIndex, flat])

  // Memoized (rather than a plain function like `handlePrev` below) so the
  // advance:'auto' timer effect right after it — and Step's hotspot-driven
  // advancement, threaded down as a prop — can depend on `handleNext`'s
  // identity without that dependency changing on every unrelated
  // re-render. It only changes when navigation itself would actually
  // behave differently: `currentIndex`/`flat` change, or `goTo` does
  // (which happens when `isControlled`/`onStepChange` change).
  const goTo = useCallback(
    (index: number): void => {
      const clamped = clampStep(flat, index)
      // Any explicit navigation to a step index exits the outro — Prev
      // (below, `prevStep` on the last index resolves to that same last
      // index, so this is what actually returns the viewer to it), Home/
      // End, a dot, or a chapter jump.
      setShowOutro(false)
      if (isControlled) {
        onStepChange?.(clamped)
        return
      }
      setInternalStep(clamped)
    },
    [flat, isControlled, onStepChange],
  )

  // Next on the last step of a tour with an `outro` completes AND
  // advances to it (plan M4 Task 2, reconciling with the complete-and-stay
  // rule below); a tour with no `outro` keeps M2's original behavior —
  // `complete()` fires (once, via the tracker's own terminal guard) and
  // Next stays a harmless no-op on the last step forever after. Once
  // `showOutro` is `true`, Next/→ is itself a no-op (checked first) rather
  // than relying solely on the tracker's terminal guard, so a second press
  // never even attempts to re-trigger the transition.
  const handleNext = useCallback((): void => {
    if (showOutro) return
    if (currentIndex === flat.length - 1) {
      trackerRef.current?.complete(viewedStepsRef.current.size)
      if (tour.outro) {
        setShowOutro(true)
      }
      return
    }
    goTo(nextStep(flat, currentIndex))
  }, [currentIndex, flat, goTo, showOutro, tour.outro])

  // advance:'auto' steps advance themselves after `duration` seconds.
  // `duration` is nullable — only Studio validation makes it "required",
  // and an API or seed write can bypass that — so `?? 30` is the
  // documented fallback (design spec §6, plan Task 5). Keyed on
  // [currentIndex, flat, handleNext]: `currentIndex` changing means a new
  // step (manual or timer-driven) to key the timer to, and `flat`/
  // `handleNext` cover the rarer case where the tour data or navigation
  // function itself changes under the same index. The cleanup below
  // covers both a reset (new step) and a real unmount. Deliberately a
  // plain timer — no `document.visibilityState`-based pause/resume: not
  // in spec, YAGNI.
  //
  // A step can independently have `advance: 'auto'` *and* an
  // `trigger: 'auto'` tooltip (Task 6) — considered here and deliberately
  // left uncoordinated: this timer only ever calls `handleNext`, and the
  // tooltip's own auto-open lives entirely in `Step`'s `openTooltipKey`
  // state. Neither reads the other, so the step can advance out from
  // under an open auto tooltip (or the tooltip can be dismissed and
  // reopened) without this effect needing to know the tooltip exists.
  useEffect(() => {
    const flatStep = flat[currentIndex]
    if (!flatStep || flatStep.step.advance !== 'auto') return undefined

    const timer = setTimeout(handleNext, (flatStep.step.duration ?? 30) * 1000)
    return () => clearTimeout(timer)
  }, [currentIndex, flat, handleNext])

  // On an ordinary step, Prev steps back one index as usual. From the
  // outro, `currentIndex` is still the last step's index (entering the
  // outro never touched it — see `showOutro`'s doc comment) — decrementing
  // it here would overshoot past the last step, so Prev instead re-targets
  // that same index. `goTo` resolves both cases identically: clamp, exit
  // the outro, commit.
  function handlePrev(): void {
    goTo(showOutro ? currentIndex : prevStep(flat, currentIndex))
  }

  function handleChapterJump(chapterIndex: number): void {
    const target = firstStepOfChapter(flat, chapterIndex)
    if (target === -1) return
    goTo(target)
  }

  /**
   * `onKeyDown` on the `.gt-tour` root — deliberately not a `window`/
   * `document` listener, so two independent `<GuidedTour>`s on one page
   * never cross-talk (plan Task 8, tested in
   * `test/react/keyboard.test.tsx`'s "multiple tours" suite): each
   * instance only ever sees keys that bubble up through its own subtree.
   *
   * ←/→ prev/next, Home/End first/last, Space next. All four of
   * ←/→/Home/End defer to `isNavigationExempt` (./helpers, CI review round
   * 2 on PR 93) — text-entry contexts and a focused link inside an open
   * tooltip panel — before navigating; Space layers that same check on top
   * of its own, narrower `NATIVE_ACTIVATION_TAGS` guard (a button/link
   * must keep its native Space activation, which `isNavigationExempt`
   * alone doesn't cover). Deliberately *not* a blanket "any focused
   * interactive element" exemption: `.gt-next`/`.gt-prev`/hotspot buttons
   * must keep responding to Arrow/Home/End while focused — the ordinary
   * case right after a click — so only those two specific contexts opt
   * out. Every navigating key also moves focus to `.gt-stage` afterward —
   * but only from here, not from `goTo`/`handleNext`/`handlePrev`
   * themselves, so mouse-driven navigation (Next/Prev/dots/chapter
   * menu/hotspot clicks) never yanks focus (plan Task 8's explicit
   * "clicking a hotspot shouldn't yank focus"). The live-region
   * announcement doesn't need any handling here at all — `announcement`
   * below is recomputed from `currentIndex` on every render, so it already
   * reflects mouse navigation too.
   *
   * Escape closes whatever tooltip `Step` currently has open, via
   * `closeOpenTooltipRef` (see its doc comment on
   * `GuidedTourContextValue`), else no-op — modal Escape is out of scope
   * until M4. This is deliberately *not* left to `Tooltip.tsx`'s own local
   * `onKeyDown` alone: that handler only ever fires when the event
   * originates inside the tooltip's own trigger/panel subtree, but
   * keyboard navigation (just above) moves focus to `.gt-stage` — a
   * sibling, not an ancestor of the tooltip — so an Escape pressed right
   * after arrowing onto a step with an auto-open tooltip would otherwise
   * never reach it. When Escape *does* originate inside the tooltip,
   * `Tooltip.tsx`'s handler runs first (bubbling) and this one runs
   * second; both resolve to the same `setOpenTooltipKey(null)`, so the
   * second call is a same-value, idempotent no-op — never a double-close
   * or a reopen.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    function navigate(action: () => void): void {
      event.preventDefault()
      action()
      stageRef.current?.focus()
    }

    if (NAVIGATION_KEYS.has(event.key) && isNavigationExempt(event.target)) {
      return
    }

    switch (event.key) {
      case 'ArrowRight':
        navigate(handleNext)
        break
      case 'ArrowLeft':
        navigate(handlePrev)
        break
      case 'Home':
        navigate(() => goTo(0))
        break
      case 'End':
        navigate(() => goTo(flat.length - 1))
        break
      case ' ': {
        const {target} = event
        if (target instanceof HTMLElement && NATIVE_ACTIVATION_TAGS.has(target.tagName)) {
          return
        }
        if (isNavigationExempt(target)) {
          return
        }
        navigate(handleNext)
        break
      }
      case 'Escape':
        closeOpenTooltipRef.current?.()
        break
      default:
        break
    }
  }

  // Theme first, consumer `style` prop second — an explicit `--gt-*` (or
  // any other CSS property) on `style` always wins over the theme's value
  // for that same property (design spec §8.1 amendment, M4). Composed once
  // here rather than inline at each `<div className="gt-tour" ...>` below,
  // since both the empty-tour and normal render paths need it.
  //
  // `themeToStyle` (./theme) returns a plain `Record<string, string>` for
  // its `--gt-*` keys — unlike `ProgressStyle`/`OverlayStyle` below and in
  // `TextOverlay.tsx`, this can't be typed as a `CSSProperties`
  // intersection: those add one known extra key to a literal built from
  // scratch, but this spreads a real incoming `style: CSSProperties` value
  // whose properties (e.g. `animationIterationCount`) can be numbers, which
  // an intersection with a blanket `Record<string, string>` index signature
  // rejects. Spreading straight into a `CSSProperties`-typed variable
  // sidesteps that: a spread source's properties aren't excess-property
  // checked against the target the way a literal's own keys are, so this
  // is honest — not an `as` cast — about the values genuinely being valid
  // `CSSProperties` (the `--gt-*` keys) plus whatever `style` itself
  // already validly contained.
  const rootStyle: CSSProperties = {...themeToStyle(tour.theme), ...style}

  if (flat.length === 0) {
    return (
      <div
        className={joinClassNames('gt-tour', 'gt-empty', className)}
        style={rootStyle}
        data-gt=""
      >
        {personalizeText(tour.title, resolvedTokens)}
      </div>
    )
  }

  const flatStep = flat[currentIndex]
  if (!flatStep) return null // Unreachable: flat is non-empty and currentIndex is clamped into range.

  const counterText = formatLabel(labels.stepCounter, {
    current: currentIndex + 1,
    total: flat.length,
  })
  // The outro isn't a step, so it gets its own announcement template
  // (`labels.outroAnnouncement`) rather than reusing `stepAnnouncement`'s
  // "Step X of Y" phrasing, which would be misleading once past the last
  // step. `tour.outro` is guaranteed non-null whenever `showOutro` is true
  // (the only place that sets it true, `handleNext` above, checks
  // `tour.outro` first) — the `?.`/`?? ''` here is defensive against the
  // same reactive-prop-change edge case the render swap below guards, not
  // a path this can reach in practice.
  const announcement = showOutro
    ? formatLabel(labels.outroAnnouncement, {
        heading: tour.outro?.heading ? personalizeText(tour.outro.heading, resolvedTokens) : '',
      })
    : formatLabel(labels.stepAnnouncement, {
        current: currentIndex + 1,
        total: flat.length,
        title: flatStep.step.title ?? flatStep.chapterTitle,
      })
  // The fill itself (`.gt-progress::after`'s `width`, styles.css) reads
  // `--gt-progress-percent`, set here rather than defaulted in CSS —
  // unlike the theme custom properties on `.gt-tour`, this one has no
  // static default; it's recomputed every navigation. `flat.length` is
  // non-zero past the empty-tour early return above, so this never
  // divides by zero.
  const progressStyle: ProgressStyle = {
    '--gt-progress-percent': String(((currentIndex + 1) / flat.length) * 100),
  }

  return (
    // `onKeyDown` here only ever catches keys bubbling up from a focused
    // descendant (a control button, the tooltip trigger, a hotspot/link) —
    // this div itself is never a focus target or otherwise interactive (no
    // `tabIndex`, no click handler), so it deliberately carries no ARIA
    // role: an interactive role would be a false affordance (the div isn't
    // operable directly), and a non-interactive role like `group` only
    // trades this lint rule for two others (`no-noninteractive-element-
    // interactions`, `prefer-tag-over-role`) without changing anything a
    // screen reader user could act on. Same "delegated keydown, not an
    // interactive element" shape as a native `<form onKeyDown>`.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={joinClassNames('gt-tour', className)}
      style={rootStyle}
      data-gt=""
      onKeyDown={handleKeyDown}
    >
      <div className="gt-header">
        {tour.theme?.logo && (
          // Decorative — the tour title just below is the adjacent text
          // that already conveys what this tour is about (design spec,
          // plan Task 1). CSS (`.gt-logo`, styles.css) caps the rendered height;
          // `width`/`height` attributes still come from the resolved
          // asset's own dimensions so the browser reserves the right
          // aspect ratio before the image loads.
          <img
            className="gt-logo"
            src={tour.theme.logo.url}
            alt=""
            width={tour.theme.logo.dimensions.width}
            height={tour.theme.logo.dimensions.height}
          />
        )}
        <h2 className="gt-title">{personalizeText(tour.title, resolvedTokens)}</h2>
        {settings.showProgress && (
          // A native <progress> can't be styled through the --gt-*
          // custom-property scheme (its fill is UA-specific and largely
          // unstylable across browsers); the div+role is the DOM contract
          // in docs/superpowers/plans/2026-08-04-m2-viewer.md.
          <div
            className="gt-progress"
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={flat.length}
            aria-valuenow={currentIndex + 1}
            aria-label={labels.progressLabel}
            style={progressStyle}
          />
        )}
        {settings.showChapterMenu && contributingChapters.length > 0 && (
          <nav className="gt-chapters" aria-label={labels.chapterMenuLabel}>
            {contributingChapters.map(({chapter, chapterIndex}) => (
              <button
                key={chapter._key}
                type="button"
                className="gt-chapter"
                aria-current={chapterIndex === flatStep.chapterIndex ? 'true' : undefined}
                onClick={() => handleChapterJump(chapterIndex)}
              >
                {chapter.title}
              </button>
            ))}
          </nav>
        )}
      </div>
      <GuidedTourContext.Provider value={contextValue}>
        {showOutro && tour.outro ? (
          // Replaces `.gt-stage` entirely (a sibling swap, not nested
          // inside it) — same "own tabIndex={-1}, own ref" keyboard-focus
          // idiom `.gt-stage` itself uses (plan Task 8), so the outro
          // keeps working as the target `navigate()`'s post-navigation
          // `stageRef.current?.focus()` expects. `tour.outro` is
          // re-checked here (not just trusted from `showOutro`) purely to
          // satisfy the type — `GuidedTourOutro | null` — without an `as`
          // cast; `showOutro` can only be `true` when `handleNext` already
          // saw a non-null `tour.outro`.
          <div className="gt-outro" tabIndex={-1} ref={stageRef}>
            <Outro outro={tour.outro} />
          </div>
        ) : (
          <div className="gt-stage" tabIndex={-1} ref={stageRef}>
            <Step
              step={flatStep.step}
              onAdvance={handleNext}
              previousStep={flat[currentIndex - 1]?.step ?? null}
              nextStep={flat[currentIndex + 1]?.step ?? null}
              renderImage={renderImage}
            />
          </div>
        )}
      </GuidedTourContext.Provider>
      <div className="gt-controls">
        <button type="button" className="gt-prev" onClick={handlePrev}>
          {labels.previous}
        </button>
        <span className="gt-counter">{counterText}</span>
        <button type="button" className="gt-next" onClick={handleNext}>
          {labels.next}
        </button>
        {settings.showStepDots && (
          <ol className="gt-dots">
            {flat.map((dotStep, index) => (
              <li key={dotStep.step._key}>
                <button
                  type="button"
                  className="gt-dot"
                  aria-label={formatLabel(labels.stepCounter, {
                    current: index + 1,
                    total: flat.length,
                  })}
                  aria-current={index === currentIndex ? 'true' : undefined}
                  onClick={() => goTo(index)}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="gt-live gt-visually-hidden" aria-live="polite">
        {announcement}
      </div>
    </div>
  )
}
