/**
 * The analytics events the viewer can emit, exactly as design spec §8.4.
 * Consumers subscribe via {@link GuidedTourEventHandler} passed to
 * `<GuidedTour onEvent>`; the viewer never sends these anywhere itself —
 * emission is entirely the consumer's responsibility.
 *
 * @public
 */
export type GuidedTourEvent =
  | {type: 'tour_started'; tourId: string; sessionId: string}
  | {type: 'step_viewed'; stepIndex: number; stepKey: string; chapterIndex: number}
  | {type: 'element_clicked'; elementType: string; elementKey: string}
  | {type: 'cta_clicked'; label: string; href: string}
  | {type: 'lead_submitted'}
  | {type: 'tour_completed'; stepsViewed: number; durationMs: number}
  | {type: 'tour_abandoned'; lastStepIndex: number; durationMs: number}

/**
 * @public
 */
export type GuidedTourEventHandler = (event: GuidedTourEvent) => void
