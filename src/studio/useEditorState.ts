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
 * One opaque string per chapter/step/element `_key` currently present in
 * `chapters`, tagged by level and full ancestry so a step keeps its
 * chapter's key and an element keeps both its chapter's and its step's
 * (two elements named `e1` in different steps are different paths). Built
 * with `JSON.stringify` on the segment array rather than any hand-rolled
 * delimiter — arbitrary `_key` strings can't collide with `["element",
 * "c1", "s1", "e1"]`'s own quoting/escaping the way naive `/`- or
 * `|`-joining could.
 *
 * This is the "has this exact key ever been seen" record the heal check
 * in `useEditorState` below needs (see that function's doc comment for
 * why "seen before" — not just "not currently present" — is the right
 * question to ask).
 */
function keyPathsOf(chapters: unknown[]): Set<string> {
  const paths = new Set<string>()
  for (const chapter of chapters) {
    const chapterKey = keyOf(chapter)
    if (chapterKey === null) continue
    paths.add(JSON.stringify(['chapter', chapterKey]))
    for (const step of stepsOf(chapter)) {
      const stepKey = keyOf(step)
      if (stepKey === null) continue
      paths.add(JSON.stringify(['step', chapterKey, stepKey]))
      for (const element of elementsOf(step)) {
        const elementKey = keyOf(element)
        if (elementKey === null) continue
        paths.add(JSON.stringify(['element', chapterKey, stepKey, elementKey]))
      }
    }
  }
  return paths
}

/** Same size and same members — used to decide whether a new `keyPathsOf` snapshot is worth remembering as "previous" (see `useEditorState`), not to compare selections. */
function keyPathsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const path of a) {
    if (!b.has(path)) return false
  }
  return true
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
 * Given the current `chapters` value, a candidate `selection`, and the key
 * paths `chapters` held as of the *previous* render (`previousKeyPaths`,
 * from `keyPathsOf` — see `useEditorState`'s doc comment for why this is
 * the previous render's set specifically), returns the selection that
 * should actually be in effect.
 *
 * A selected step or element is only healed away on CONFIRMED deletion:
 * it was present in `previousKeyPaths` (so `chapters` really did carry it
 * at some point this hook observed) and is absent now. A selection that
 * was never present in `previousKeyPaths` — a step/element just selected
 * locally, ahead of `chapters` catching up with the patch that created it
 * — is left alone regardless of whether it's in `chapters` yet; it isn't
 * a deletion, it's a snapshot that hasn't arrived.
 *
 * Pure and side-effect-free so the hook can call it during render (see
 * `useEditorState` below) and so it's unit-testable on its own.
 */
function healSelection(
  chapters: unknown[],
  selection: EditorSelection,
  previousKeyPaths: Set<string>,
): EditorSelection {
  const {chapterKey, stepKey, elementKey} = selection
  if (chapterKey === null || stepKey === null) return selection

  const stepPath = JSON.stringify(['step', chapterKey, stepKey])
  const stepStillThere = stepExists(chapters, chapterKey, stepKey)
  const stepConfirmedDeleted = previousKeyPaths.has(stepPath) && !stepStillThere

  if (stepConfirmedDeleted) {
    const first = firstStep(chapters)
    return {
      chapterKey: first?.chapterKey ?? null,
      stepKey: first?.stepKey ?? null,
      elementKey: null,
    }
  }

  if (elementKey !== null) {
    const elementPath = JSON.stringify(['element', chapterKey, stepKey, elementKey])
    const elementStillThere =
      stepStillThere && elementExists(chapters, chapterKey, stepKey, elementKey)
    const elementConfirmedDeleted = previousKeyPaths.has(elementPath) && !elementStillThere

    if (elementConfirmedDeleted) {
      return {chapterKey, stepKey, elementKey: null}
    }
  }

  return selection
}

/**
 * Selection/device/expanded state for the canvas editor. `chapters` is the
 * live `chapters` field value (from `ArrayOfObjectsInputProps.value`): the
 * selection is checked every render against `chapters` *and* against
 * `previousKeyPaths` — the key paths `chapters` held as of the render
 * before this one — and healed only on a CONFIRMED deletion (see
 * `healSelection`'s doc comment).
 *
 * Why "confirmed" and not just "currently missing": `CanvasInput.tsx`
 * calls `selectElement(newKey)` (this hook's own local `setState`) in the
 * same tick it emits the patch that inserts the new element, and
 * `props.value` only catches up once Sanity's document store round-trips
 * that patch back down. A version of this heal that only asked "is the
 * selected key in `chapters` right now" would clear that fresh selection
 * on the very next render — the key genuinely isn't there yet — and,
 * worse, would never recover it: once `elementKey` is cleared to `null`
 * there's nothing left to heal. Asking instead "was this key ever in a
 * snapshot `chapters` actually held, and is it missing from the current
 * one" only fires once a snapshot has actually dropped a key it used to
 * carry, which a snapshot that simply hasn't caught up with a pending
 * insert never does — regardless of how many *other*, unrelated changes
 * land in the meantime. It also survives a second, faster local selection
 * change landing before the first one's patch round-trips (selecting `e2`
 * then `e3` while both inserts are still in flight): neither key was ever
 * in a previous snapshot, so neither gets healed away by the other's
 * patch arriving.
 *
 * `previousKeyPaths` is tracked as a render-time state adjustment (a
 * `useState`-held previous `keyPathsOf(chapters)` snapshot, only replaced
 * when it actually differs in content from the new one — `keyPathsEqual`,
 * not object identity, since a fresh `Set` is built every render) rather
 * than a `useEffect`, the same "adjust state when a prop changes" pattern
 * `src/react/Step.tsx` and `src/react/Image.tsx` use: the heal converges
 * within the render that changed instead of committing one extra frame
 * with a stale value first, and the "previous" snapshot used for *this*
 * render's heal check is still the one from before the update (state
 * writes during render don't apply until the next render), which is
 * exactly the "as of the render before this one" the heal needs.
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

  const currentKeyPaths = keyPathsOf(chapters)
  const [previousKeyPaths, setPreviousKeyPaths] = useState(currentKeyPaths)
  if (!keyPathsEqual(previousKeyPaths, currentKeyPaths)) {
    setPreviousKeyPaths(currentKeyPaths)
  }

  let nextSelection = healSelection(chapters, selection, previousKeyPaths)

  // A `null` chapter/step selection is never a deliberate user state —
  // there's no "deselect the step" affordance, only ever one step being
  // selected instead of another, or (mount on a brand-new document, or
  // every chapter deleted) nothing existing yet to select. So whenever
  // nothing is selected and `chapters` now has a first step to offer —
  // the new-document flow: add the first step via bulk upload or the
  // add-step button after mounting empty — adopt it. This is the one case
  // `healSelection` deliberately doesn't handle itself: it bails out
  // early on an already-null selection without consulting `chapters` at
  // all (see its doc comment), because from *its* vantage point (only
  // ever asked to confirm or heal an *existing* selection) a null
  // selection has nothing to confirm-delete. `elementKey` gets no such
  // adoption — `null` there is a real, deliberate "nothing selected in
  // the Inspector" state, not a placeholder waiting to be filled.
  if (nextSelection.stepKey === null) {
    const first = firstStep(chapters)
    if (first !== null) {
      nextSelection = {chapterKey: first.chapterKey, stepKey: first.stepKey, elementKey: null}
    }
  }

  if (
    nextSelection.chapterKey !== selection.chapterKey ||
    nextSelection.stepKey !== selection.stepKey ||
    nextSelection.elementKey !== selection.elementKey
  ) {
    setSelection(nextSelection)
  }

  function selectStep(chapterKey: string, stepKey: string): void {
    setSelection({chapterKey, stepKey, elementKey: null})
  }

  function selectElement(elementKey: string | null): void {
    setSelection((current) => ({...current, elementKey}))
  }

  return {selection, selectStep, selectElement, device, setDevice, expanded, setExpanded}
}
