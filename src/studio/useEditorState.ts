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

/**
 * A cheap structural fingerprint of every chapter/step/element `_key`
 * present in `chapters`, in reading order. Two calls return the same
 * string iff every key at every level is the same — insert, delete, or
 * reorder any one of them and the signature changes.
 *
 * This exists to distinguish "confirmed removed" from "not visible in
 * this particular snapshot yet" for the heal check in `useEditorState`
 * below: `props.value` doesn't update synchronously with a local
 * `selectElement()` call right after emitting an insert patch (the new
 * element only appears once Sanity's document store round-trips the
 * patch back down), so a selected key can legitimately be absent from
 * `chapters` for a render or two without having been deleted. Gating the
 * heal on "did the key set actually change" means that render is a no-op
 * instead of clearing the fresh selection.
 */
function keyPathSignature(chapters: unknown[]): string {
  const chapterEntries: string[] = []
  for (const chapter of chapters) {
    const stepEntries: string[] = []
    for (const step of stepsOf(chapter)) {
      const elementKeys = elementsOf(step)
        .map((element) => keyOf(element) ?? '')
        .join(',')
      stepEntries.push(`${keyOf(step) ?? ''}[${elementKeys}]`)
    }
    chapterEntries.push(`${keyOf(chapter) ?? ''}{${stepEntries.join(',')}}`)
  }
  return chapterEntries.join('|')
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
 * live `chapters` field value (from `ArrayOfObjectsInputProps.value`): the
 * selection is checked against it and healed if the selected step or
 * element no longer exists — but only on renders where `chapters`' key set
 * (`keyPathSignature`) actually changed since the last one, not on every
 * render.
 *
 * That gating matters: `CanvasInput.tsx` calls `selectElement(newKey)`
 * (this hook's own local `setState`) in the same tick it emits the patch
 * that inserts the new element, and `props.value` only catches up once
 * Sanity's document store round-trips that patch back down — an
 * intervening render can see `selection.elementKey` pointing at a key
 * `chapters` doesn't have yet, indistinguishable from a deletion if the
 * heal ran unconditionally. Running the heal only when the signature
 * changed means that intervening render (same stale `chapters`, same
 * signature) is a no-op — the selection survives untouched — and the
 * *next* content change (chapters catching up to include the new key, or
 * an actual delete elsewhere) is what the heal reacts to, correctly
 * either confirming the selection or clearing it.
 *
 * Both the signature tracking and the heal itself are done as a
 * render-time state adjustment (a `useState`-held previous signature,
 * `setSelection`/`setPreviousSignature` only called when something
 * actually differs) rather than a `useEffect`, the same "adjust state
 * when a prop changes" pattern `src/react/Step.tsx` and
 * `src/react/Image.tsx` use: it converges within the render that changed
 * instead of committing one extra frame with a stale value first.
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

  const signature = keyPathSignature(chapters)
  const [previousSignature, setPreviousSignature] = useState(signature)
  const contentChanged = signature !== previousSignature
  if (contentChanged) {
    setPreviousSignature(signature)

    const healed = healSelection(chapters, selection)
    if (
      healed.chapterKey !== selection.chapterKey ||
      healed.stepKey !== selection.stepKey ||
      healed.elementKey !== selection.elementKey
    ) {
      setSelection(healed)
    }
  }

  function selectStep(chapterKey: string, stepKey: string): void {
    setSelection({chapterKey, stepKey, elementKey: null})
  }

  function selectElement(elementKey: string | null): void {
    setSelection((current) => ({...current, elementKey}))
  }

  return {selection, selectStep, selectElement, device, setDevice, expanded, setExpanded}
}
