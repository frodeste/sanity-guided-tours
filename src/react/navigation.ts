import type {GuidedTourDoc, GuidedTourStep} from '../queries/types'

/**
 * One step of a tour, flattened out of its chapter and annotated with the
 * indices the viewer needs to render progress and navigate: `stepIndex` is
 * the step's position in the flat list (what "current step" means
 * throughout the viewer), `chapterIndex` is the chapter's position in
 * `tour.chapters` (stable even when an earlier chapter has zero steps),
 * and `indexInChapter` is the step's position within its own chapter.
 *
 * @public
 */
export interface FlatStep {
  chapterIndex: number
  stepIndex: number
  indexInChapter: number
  chapterTitle: string
  step: GuidedTourStep
}

/**
 * Flattens a tour's chapters into a single ordered list of steps. Chapters
 * with zero steps contribute nothing to the list — they never produce a
 * gap or a placeholder entry, they just don't appear.
 *
 * @public
 */
export function flattenTour(tour: GuidedTourDoc): FlatStep[] {
  const flat: FlatStep[] = []
  let stepIndex = 0

  tour.chapters.forEach((chapter, chapterIndex) => {
    chapter.steps.forEach((step, indexInChapter) => {
      flat.push({
        chapterIndex,
        stepIndex,
        indexInChapter,
        chapterTitle: chapter.title,
        step,
      })
      stepIndex += 1
    })
  })

  return flat
}

/**
 * Clamps `index` into the valid range of `steps`, `[0, steps.length - 1]`.
 * An empty list clamps everything to `0`.
 *
 * @public
 */
export function clampStep(steps: FlatStep[], index: number): number {
  if (steps.length === 0) return 0
  if (index < 0) return 0
  if (index > steps.length - 1) return steps.length - 1
  return index
}

/**
 * Returns the next step index, staying on the last step once there.
 *
 * @public
 */
export function nextStep(steps: FlatStep[], current: number): number {
  return clampStep(steps, current + 1)
}

/**
 * Returns the previous step index, staying on the first step once there.
 *
 * @public
 */
export function prevStep(steps: FlatStep[], current: number): number {
  return clampStep(steps, current - 1)
}

/**
 * Returns the global step index of the first step in `chapterIndex`, or
 * `-1` if that chapter has no steps (including if it doesn't exist).
 *
 * @public
 */
export function firstStepOfChapter(steps: FlatStep[], chapterIndex: number): number {
  const found = steps.find((flatStep) => flatStep.chapterIndex === chapterIndex)
  return found ? found.stepIndex : -1
}
