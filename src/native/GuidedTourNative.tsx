import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  Text,
  View,
  useColorScheme,
  type ColorSchemeName,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import type {GuidedTourDoc} from '../queries/types'
import type {GuidedTourEventHandler} from '../react/events'
import {defaultLabels, formatLabel, type GuidedTourLabels} from '../react/labels'
import {clampStep, firstStepOfChapter, flattenTour, nextStep, prevStep} from '../react/navigation'
import {missingRequired, personalizeText, resolveTokens} from '../react/personalize'
import {createTracker} from '../react/session'
import {NativeTourContext} from './context'
import {resolveNativeTheme, type NativeTheme} from './nativeTheme'
import {OutroNative} from './OutroNative'
import {usePrefetchSiblings} from './prefetch'
import {useReducedMotion} from './reducedMotion'
import {StepNative} from './StepNative'
import {createStyles} from './styles'

/**
 * `<GuidedTour colorScheme>`'s native vocabulary — same three values and
 * same `'auto'` default as web's `GuidedTourColorScheme` (`../react/types.ts`),
 * a SEPARATE type rather than a reuse of it: `types.ts` isn't on
 * `test/exports.test.ts`'s allow-list for `src/native`'s `../react/*`
 * imports (see `./context.ts`'s doc comment for the same reasoning applied
 * to `context.ts`).
 *
 * @public
 */
export type NativeColorScheme = 'auto' | 'light' | 'dark'

/**
 * @public
 */
export interface GuidedTourNativeProps {
  tour: GuidedTourDoc
  tokens?: Record<string, string | string[] | undefined>
  labels?: Partial<GuidedTourLabels>
  onEvent?: GuidedTourEventHandler
  /** Controlled position (global step index) — same contract as web's `GuidedTourProps.step`: an externally-driven change to a DIFFERENT index always dismisses the outro if it's showing. */
  step?: number
  onStepChange?: (step: number) => void
  /** `'auto'` (default) resolves the OS scheme via `useColorScheme()`; `'light'`/`'dark'` force it regardless. */
  colorScheme?: NativeColorScheme
  style?: StyleProp<ViewStyle>
}

/** `useColorScheme()`'s real RN type is `'light' | 'dark' | 'unspecified' | null` (Android's `'unspecified'` on top of the two web-familiar values) — anything other than exactly `'dark'` resolves to `'light'`, the same "absent/unknown defaults to light" idiom `resolveNativeTheme`'s own `scheme` parameter has no third option for. */
function resolveScheme(
  colorScheme: NativeColorScheme,
  systemScheme: ColorSchemeName,
): 'light' | 'dark' {
  if (colorScheme !== 'auto') return colorScheme
  return systemScheme === 'dark' ? 'dark' : 'light'
}

/**
 * The React Native guided tour viewer (M8 Task 3): header (title, progress,
 * chapter chip row), the current step's screenshot and elements, and
 * prev/next/dots controls — the native counterpart of web's
 * `GuidedTour.tsx`, built from RN primitives and reusing the SAME DOM-free
 * core (`navigation.ts`/`personalize.ts`/`events.ts`/`session.ts`/
 * `labels.ts`) so flattening, token substitution, event sequencing and
 * session handling are IDENTICAL to web, not a second implementation that
 * could drift.
 *
 * v1 SCOPE (deliberate subset — see the Task 3 report for the full
 * rationale): no lead capture, no `renderImage` override, no Google Font
 * auto-loading (a consumer's own responsibility on native — there is no
 * `document.head` to append a stylesheet `<link>` to), no keyboard
 * navigation (RN has no keyboard-focus-driven Arrow/Home/End/Space
 * equivalent for a touch-primary platform). Steps, hotspots, tooltips,
 * text overlays, progress, chapter jump, outro, personalization and FULL
 * event parity are all in scope and implemented below.
 *
 * Uncontrolled by default (internal position state starting at step 0);
 * pass `step`/`onStepChange` to control the position externally — same
 * contract as web.
 *
 * @public
 */
export function GuidedTour({
  tour,
  tokens: providedTokens,
  labels: labelOverrides,
  onEvent,
  step: controlledStep,
  onStepChange,
  colorScheme = 'auto',
  style,
}: GuidedTourNativeProps): ReactNode {
  const flat = useMemo(() => flattenTour(tour), [tour])
  const isControlled = typeof controlledStep === 'number'

  const [internalStep, setInternalStep] = useState(0)
  // Whether the outro screen is showing in place of the step stage — same
  // "not part of `flat`/`currentIndex`" design as web's `showOutro` (see
  // `GuidedTour.tsx`'s own doc comment): the outro isn't a step, so
  // progress freezes at 100% and no dot moves while it's showing.
  const [showOutro, setShowOutro] = useState(false)

  // Same render-time controlled-step sync as web's `GuidedTour.tsx` — see
  // that file's doc comment for why this runs during render (React's own
  // sanctioned "adjust state when a prop changes" pattern) rather than a
  // `useEffect`, and why `internalStep !== clampedControlled` is exactly
  // the signal for a genuinely EXTERNAL step change.
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

  // Same lazy-init-into-a-ref idiom as web's `trackerRef` — built once,
  // reused for this component's entire lifetime; every read happens inside
  // an effect or event handler, never inline during render.
  const trackerRef = useRef<ReturnType<typeof createTracker> | null>(null)
  if (trackerRef.current === null) {
    trackerRef.current = createTracker(onEvent, tour._id)
  }

  const viewedStepsRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    for (const key of missingRequired(tour.tokens, resolvedTokens)) {
      console.warn(`[GuidedTour/native] missing required personalization token "${key}"`)
    }
  }, [tour.tokens, resolvedTokens])

  // Strict-Mode-safe view/abandon tracking — identical shape to web's own
  // effect (`GuidedTour.tsx`): cleanup schedules an abandon for the step
  // being left, the next effect run cancels it first. No `showAfterStepLead`
  // gating here (v1 has no lead capture at all) — every step change simply
  // records a view.
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

  const goTo = useCallback(
    (index: number): void => {
      const clamped = clampStep(flat, index)
      setShowOutro(false)
      if (isControlled) {
        onStepChange?.(clamped)
        return
      }
      setInternalStep(clamped)
    },
    [flat, isControlled, onStepChange],
  )

  // Next on the last step of a tour with an `outro` completes AND advances
  // to it; a tour with no `outro` keeps Next a harmless no-op on the last
  // step forever after (the tracker's own terminal guard) — identical to
  // web, minus the lead-capture interstitial branch (out of v1 scope).
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

  function handlePrev(): void {
    goTo(showOutro ? currentIndex : prevStep(flat, currentIndex))
  }

  function handleChapterJump(chapterIndex: number): void {
    const target = firstStepOfChapter(flat, chapterIndex)
    if (target === -1) return
    goTo(target)
  }

  // advance:'auto' steps advance themselves after `duration` seconds — same
  // `?? 30` documented fallback as web, same plain-timer (no
  // visibility-state pause/resume) choice.
  useEffect(() => {
    const flatStep = flat[currentIndex]
    if (!flatStep || flatStep.step.advance !== 'auto') return undefined

    const timer = setTimeout(handleNext, (flatStep.step.duration ?? 30) * 1000)
    return () => clearTimeout(timer)
  }, [currentIndex, flat, handleNext])

  const reducedMotion = useReducedMotion()

  const systemScheme = useColorScheme()
  const resolvedScheme = resolveScheme(colorScheme, systemScheme)
  const theme: NativeTheme = useMemo(
    () => resolveNativeTheme(tour.theme, resolvedScheme),
    [tour.theme, resolvedScheme],
  )
  const styles = useMemo(() => createStyles(theme), [theme])

  const flatStep = flat[currentIndex]

  // Ruling A: ±1 sibling preload via `Image.prefetch`, keyed on the
  // adjacent steps' screenshot URLs — see `./prefetch.ts`'s own doc
  // comment for the dedupe/rejection-handling contract.
  usePrefetchSiblings(
    flat[currentIndex - 1]?.step.screenshot.url ?? null,
    flat[currentIndex + 1]?.step.screenshot.url ?? null,
  )

  const contextValue = useMemo(
    () => ({tokens: resolvedTokens, labels, trackerRef, theme, styles, reducedMotion}),
    [resolvedTokens, labels, theme, styles, reducedMotion],
  )

  // Step-change accessibility announcement (brief:
  // `AccessibilityInfo.announceForAccessibility` for step changes) — the
  // native counterpart of web's live-region `div`. Screen-reader
  // announcements aren't animation, so Ruling B's `reducedMotion` does NOT
  // gate WHETHER this fires; it's threaded through context (above) instead
  // for the two things it DOES gate in v1 — see `./reducedMotion.ts`'s own
  // doc comment.
  useEffect(() => {
    if (showOutro) {
      const message = formatLabel(labels.outroAnnouncement, {
        heading: tour.outro?.heading ? personalizeText(tour.outro.heading, resolvedTokens) : '',
      })
      AccessibilityInfo.announceForAccessibility(message)
      return
    }
    if (!flatStep) return
    const message = formatLabel(labels.stepAnnouncement, {
      current: currentIndex + 1,
      total: flat.length,
      title: flatStep.step.title ?? flatStep.chapterTitle,
    })
    AccessibilityInfo.announceForAccessibility(message)
  }, [currentIndex, flat.length, flatStep, labels, resolvedTokens, showOutro, tour.outro])

  if (flat.length === 0) {
    return (
      <View style={[styles.container, styles.empty, style]}>
        <Text style={styles.title}>{personalizeText(tour.title, resolvedTokens)}</Text>
      </View>
    )
  }

  if (!flatStep && !showOutro) return null // Unreachable: flat is non-empty and currentIndex is clamped into range.

  const counterText = flatStep
    ? formatLabel(labels.stepCounter, {current: currentIndex + 1, total: flat.length})
    : ''
  const progressPercent = ((currentIndex + 1) / flat.length) * 100

  return (
    <NativeTourContext.Provider value={contextValue}>
      <View style={[styles.container, style]}>
        <View style={styles.header}>
          <Text style={styles.title}>{personalizeText(tour.title, resolvedTokens)}</Text>
          {settings.showProgress && (
            <View
              style={styles.progressTrack}
              accessibilityRole="progressbar"
              accessibilityValue={{min: 1, max: flat.length, now: currentIndex + 1}}
              accessibilityLabel={labels.progressLabel}
            >
              <View style={[styles.progressFill, {width: `${progressPercent}%`}]} />
            </View>
          )}
          {settings.showChapterMenu && contributingChapters.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityRole="tablist"
              accessibilityLabel={labels.chapterMenuLabel}
              style={styles.chapterRow}
            >
              {contributingChapters.map(({chapter, chapterIndex}) => {
                const active = flatStep ? chapterIndex === flatStep.chapterIndex : false
                return (
                  <Pressable
                    key={chapter._key}
                    onPress={() => handleChapterJump(chapterIndex)}
                    accessibilityRole="tab"
                    accessibilityState={{selected: active}}
                    style={[styles.chapterChip, active ? styles.chapterChipActive : null]}
                  >
                    <Text style={active ? styles.chapterChipTextActive : styles.chapterChipText}>
                      {chapter.title}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          )}
        </View>

        {showOutro && tour.outro ? (
          <OutroNative outro={tour.outro} />
        ) : flatStep ? (
          <StepNative step={flatStep.step} onAdvance={handleNext} />
        ) : null}

        <View style={styles.controls}>
          <Pressable
            onPress={handlePrev}
            accessibilityRole="button"
            accessibilityLabel={labels.previous}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{labels.previous}</Text>
          </Pressable>
          <Text style={styles.counterText}>{counterText}</Text>
          <Pressable
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={labels.next}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{labels.next}</Text>
          </Pressable>
          {settings.showStepDots && (
            <View style={styles.dotsRow}>
              {flat.map((dotStep, index) => (
                <Pressable
                  key={dotStep.step._key}
                  onPress={() => goTo(index)}
                  accessibilityRole="button"
                  accessibilityLabel={formatLabel(labels.stepCounter, {
                    current: index + 1,
                    total: flat.length,
                  })}
                  accessibilityState={{selected: index === currentIndex}}
                  style={[styles.dot, index === currentIndex ? styles.dotActive : null]}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </NativeTourContext.Provider>
  )
}
