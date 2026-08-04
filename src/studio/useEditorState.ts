// Selection/device/expanded state for the three-pane canvas editor
// (CanvasInput.tsx). Kept as a standalone hook — no `sanity`/`@sanity/ui`
// imports — so it stays trivially unit-testable with
// `@testing-library/react`'s `renderHook` and has zero exposure to the
// Studio-test risk the master plan flags for form-builder imports.
//
// `chapters` is read as `unknown[]` throughout (master plan Task 4 note):
// the *shape* of a chapter/step/element only matters to the panes that
// render them (Tasks 5-7); this hook only ever needs a `_key` and, to walk
// into steps, a `steps` array — read via the same unknown-narrowing style
// `src/schema/guidedTour.ts`'s `stepCountOf` and `src/studio/patches.ts`'s
// `isRecord` use, rather than trusting a richer static type that the real
// Sanity form value can't actually guarantee (drafts are `unknown` on the
// wire).
import {useState} from 'react'

export interface EditorSelection {
  chapterKey: string | null
  stepKey: string | null
  elementKey: string | null
}

export interface EditorState {
  selection: EditorSelection
  // Arrow-function property types, not TS method shorthand
  // (`selectStep(...): void`): method shorthand gives these an implicit
  // `this` parameter, which oxlint's `unbound-method` rule flags at every
  // call site that destructures and passes them on as a bare callback
  // (`onSelectStep={selectStep}` in CanvasInput.tsx) — they never read
  // `this`, so there's nothing to unbind.
  selectStep: (chapterKey: string, stepKey: string) => void
  selectElement: (elementKey: string | null) => void
  device: 'desktop' | 'mobile'
  setDevice: (d: 'desktop' | 'mobile') => void
  expanded: boolean
  setExpanded: (b: boolean) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function keyOf(value: unknown): string | null {
  return isRecord(value) && typeof value._key === 'string' ? value._key : null
}

function stepsOf(chapter: unknown): unknown[] {
  return isRecord(chapter) && Array.isArray(chapter.steps) ? chapter.steps : []
}

function elementsOf(step: unknown): unknown[] {
  return isRecord(step) && Array.isArray(step.elements) ? step.elements : []
}

/** The first `{chapterKey, stepKey}` pair in reading order, or `null` if `chapters` has no steps at all. */
function firstStep(chapters: unknown[]): {chapterKey: string; stepKey: string} | null {
  for (const chapter of chapters) {
    const chapterKey = keyOf(chapter)
    if (chapterKey === null) continue
    for (const step of stepsOf(chapter)) {
      const stepKey = keyOf(step)
      if (stepKey !== null) return {chapterKey, stepKey}
    }
  }
  return null
}

function stepExists(chapters: unknown[], chapterKey: string, stepKey: string): boolean {
  for (const chapter of chapters) {
    if (keyOf(chapter) !== chapterKey) continue
    return stepsOf(chapter).some((step) => keyOf(step) === stepKey)
  }
  return false
}

function elementExists(
  chapters: unknown[],
  chapterKey: string,
  stepKey: string,
  elementKey: string,
): boolean {
  for (const chapter of chapters) {
    if (keyOf(chapter) !== chapterKey) continue
    for (const step of stepsOf(chapter)) {
      if (keyOf(step) !== stepKey) continue
      return elementsOf(step).some((element) => keyOf(element) === elementKey)
    }
  }
  return false
}

/**
 * Given the current `chapters` value and a candidate `selection`, returns
 * the selection that should actually be in effect: unchanged if it's still
 * valid, healed to the first step if the selected step (or its chapter)
 * vanished — undo, a remote edit, the last element of a deleted step —
 * or with just `elementKey` cleared if only the element vanished.
 *
 * Pure and side-effect-free so the hook can call it during render (see
 * `useEditorState` below) and so it's unit-testable on its own.
 */
function healSelection(chapters: unknown[], selection: EditorSelection): EditorSelection {
  const {chapterKey, stepKey} = selection
  const stepStillThere =
    chapterKey !== null && stepKey !== null && stepExists(chapters, chapterKey, stepKey)

  if (!stepStillThere) {
    const first = firstStep(chapters)
    return {
      chapterKey: first?.chapterKey ?? null,
      stepKey: first?.stepKey ?? null,
      elementKey: null,
    }
  }

  if (
    selection.elementKey !== null &&
    !elementExists(chapters, chapterKey, stepKey, selection.elementKey)
  ) {
    return {chapterKey, stepKey, elementKey: null}
  }

  return selection
}

/**
 * Selection/device/expanded state for the canvas editor. `chapters` is the
 * live `chapters` field value (from `ArrayOfObjectsInputProps.value`):
 * every render, the current selection is checked against it and healed if
 * the selected step or element no longer exists — done as a render-time
 * state adjustment (compute `healSelection`, `setSelection` only if it
 * actually differs) rather than a `useEffect`, the same "adjust state when
 * a prop changes" pattern `src/react/Step.tsx` and `src/react/Image.tsx`
 * use: it converges within the render that removed the step/element
 * instead of committing one extra frame with a dangling selection first.
 */
export function useEditorState(chapters: unknown[]): EditorState {
  const [selection, setSelection] = useState<EditorSelection>(() => {
    const first = firstStep(chapters)
    return {
      chapterKey: first?.chapterKey ?? null,
      stepKey: first?.stepKey ?? null,
      elementKey: null,
    }
  })
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [expanded, setExpanded] = useState(false)

  const healed = healSelection(chapters, selection)
  if (
    healed.chapterKey !== selection.chapterKey ||
    healed.stepKey !== selection.stepKey ||
    healed.elementKey !== selection.elementKey
  ) {
    setSelection(healed)
  }

  function selectStep(chapterKey: string, stepKey: string): void {
    setSelection({chapterKey, stepKey, elementKey: null})
  }

  function selectElement(elementKey: string | null): void {
    setSelection((current) => ({...current, elementKey}))
  }

  return {selection, selectStep, selectElement, device, setDevice, expanded, setExpanded}
}
