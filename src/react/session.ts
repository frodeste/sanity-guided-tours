import type {GuidedTourEvent, GuidedTourEventHandler} from './events'

/**
 * A tour session: a random identifier plus the timestamp events measure
 * `durationMs` against. Created once per tracker and held in memory only —
 * no cookie, no storage, nothing that survives a page reload.
 *
 * @public
 */
export interface GuidedTourSession {
  sessionId: string
  startedAt: number
}

/**
 * Creates a fresh session: a `crypto.randomUUID()` identifier and the
 * current time via `Date.now()`. `Date.now()` is deliberately used here
 * (rather than `performance.now()`) because this is product code, not a
 * build/workflow script — see design spec §8.4.
 *
 * @public
 */
export function createSession(): GuidedTourSession {
  return {sessionId: crypto.randomUUID(), startedAt: Date.now()}
}

/**
 * Stateful emitter for a single tour session's lifecycle. Enforces the
 * invariants the raw {@link GuidedTourEvent} union can't express on its
 * own:
 *
 * - `start()` emits `tour_started` at most once; `stepViewed()` calls it
 *   first if the tracker hasn't started yet, so `tour_started` always
 *   precedes the first `step_viewed` regardless of call order.
 * - `complete()` and `abandon()` are mutually exclusive terminal calls —
 *   whichever fires first wins, in either order, and the loser is silently
 *   dropped rather than emitting a second terminal event.
 * - `scheduleAbandon()` / `cancelScheduledAbandon()` give callers a
 *   Strict-Mode-safe way to defer an abandon: the effect cleanup schedules
 *   it, the next mount's effect body cancels it before it fires. Only a
 *   real unmount lets the 0 ms timer run to completion.
 *
 * Passing `undefined` for `handler` makes every method a silent no-op —
 * the tracker still tracks its own state so tracking behaves identically
 * whether or not a consumer is listening, but nothing is ever called.
 *
 * @public
 */
export interface GuidedTourTracker {
  start(): void
  stepViewed(step: {stepIndex: number; stepKey: string; chapterIndex: number}): void
  elementClicked(element: {elementType: string; elementKey: string}): void
  /** Emits `cta_clicked` for an outro CTA click — `label` is the personalized, displayed text; `href` is the raw, unpersonalized target (spec §8.3). */
  ctaClicked(cta: {label: string; href: string}): void
  /** Emits `lead_submitted` — called once, after a lead-capture form's `onLeadSubmit` resolves successfully (never on Skip, never on a rejection). No payload: the submitted values themselves are never part of the event (design spec §8.5 — the plugin stores nothing). */
  leadSubmitted(): void
  complete(stepsViewed: number): void
  abandon(lastStepIndex: number): void
  scheduleAbandon(lastStepIndex: number): void
  cancelScheduledAbandon(): void
}

/**
 * Creates a {@link GuidedTourTracker} for one tour session.
 *
 * @public
 */
export function createTracker(
  handler: GuidedTourEventHandler | undefined,
  tourId: string,
): GuidedTourTracker {
  const session = createSession()
  let started = false
  let terminal = false
  let scheduledTimer: ReturnType<typeof setTimeout> | null = null

  function emit(event: GuidedTourEvent): void {
    handler?.(event)
  }

  function durationMs(): number {
    return Date.now() - session.startedAt
  }

  function start(): void {
    if (started) return
    started = true
    emit({type: 'tour_started', tourId, sessionId: session.sessionId})
  }

  function stepViewed(step: {stepIndex: number; stepKey: string; chapterIndex: number}): void {
    start()
    emit({type: 'step_viewed', ...step})
  }

  function elementClicked(element: {elementType: string; elementKey: string}): void {
    emit({type: 'element_clicked', ...element})
  }

  function ctaClicked(cta: {label: string; href: string}): void {
    emit({type: 'cta_clicked', ...cta})
  }

  function leadSubmitted(): void {
    emit({type: 'lead_submitted'})
  }

  function cancelScheduledAbandon(): void {
    if (scheduledTimer === null) return
    clearTimeout(scheduledTimer)
    scheduledTimer = null
  }

  function complete(stepsViewed: number): void {
    if (terminal) return
    terminal = true
    cancelScheduledAbandon()
    emit({type: 'tour_completed', stepsViewed, durationMs: durationMs()})
  }

  function abandon(lastStepIndex: number): void {
    if (terminal) return
    terminal = true
    cancelScheduledAbandon()
    emit({type: 'tour_abandoned', lastStepIndex, durationMs: durationMs()})
  }

  function scheduleAbandon(lastStepIndex: number): void {
    cancelScheduledAbandon()
    scheduledTimer = setTimeout(() => {
      scheduledTimer = null
      abandon(lastStepIndex)
    }, 0)
  }

  return {
    start,
    stepViewed,
    elementClicked,
    ctaClicked,
    leadSubmitted,
    complete,
    abandon,
    scheduleAbandon,
    cancelScheduledAbandon,
  }
}
