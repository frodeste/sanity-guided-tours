// Pure module — only imports the plain data constructors from `sanity`
// (`set`/`unset`/`insert`/`setIfMissing`), so every builder here is testable
// without a running Studio: given the same arguments they always return the
// same patch objects.
//
// Paths are keyed segments relative to the `chapters` array field the input
// owns: [{_key: chapterKey}, 'steps', {_key: stepKey}, 'elements', {_key:
// elementKey}]. Builders never prefix with `'chapters'` — the form machinery
// already scopes `onChange` to that field.
//
// Append-to-possibly-empty-array grounding: `insert(items, 'after', [...
// path, -1])` alone assumes the array at `path` already exists — the content
// lake's insert mutation errors on a missing/absent array. Sanity's own
// form-builder guards against exactly this (see the clipboard-paste patch
// builder in node_modules/sanity/lib/useBundleDocuments-*.js) by always
// prepending `setIfMissing([], path)` before an append-after-last insert. We
// follow the same two-patch pattern everywhere we append into an array that
// may not exist yet or may be empty (new chapter's first step, new step's
// first element, a chapter with no steps at all). Where we insert after a
// specific existing key, the array is already known non-empty, so the
// `setIfMissing` guard is omitted.

import {insert, set, setIfMissing, unset} from 'sanity'
import type {FormPatch} from 'sanity'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Mirrors @sanity/types' `PathSegment`/`Path` shape (a keyed segment, a
// field name, or an array index) without importing it — the patch
// constructors from `sanity` accept anything structurally compatible.
type PathStep = string | number | {_key: string}

function chapterSegment(chapterKey: string): {_key: string} {
  return {_key: chapterKey}
}

function stepSegment(stepKey: string): {_key: string} {
  return {_key: stepKey}
}

function elementSegment(elementKey: string): {_key: string} {
  return {_key: elementKey}
}

function stepsPath(chapterKey: string): PathStep[] {
  return [chapterSegment(chapterKey), 'steps']
}

function stepPath(chapterKey: string, stepKey: string): PathStep[] {
  return [chapterSegment(chapterKey), 'steps', stepSegment(stepKey)]
}

function elementsPath(chapterKey: string, stepKey: string): PathStep[] {
  return [...stepPath(chapterKey, stepKey), 'elements']
}

function elementPath(chapterKey: string, stepKey: string, elementKey: string): PathStep[] {
  return [...elementsPath(chapterKey, stepKey), elementSegment(elementKey)]
}

/** Two-patch safe-append: guards against `path` being absent or empty. */
function appendPatches(items: unknown[], path: PathStep[]): FormPatch[] {
  return [setIfMissing([], path), insert(items, 'after', [...path, -1])]
}

/**
 * Inserts a newly placed element. `device` mirrors `moveElementPatch`'s
 * parameter but — since this is a single insert, not a move against an
 * existing document value — there's no existing document state to patch
 * around: the override has to ride *in* the inserted element itself. In
 * mobile mode, `element.x`/`element.y` were measured against the mobile
 * screenshot (`Canvas.tsx`'s `pointToPercent` against whichever screenshot
 * `device` is currently showing), so they're wrong as *desktop* coordinates
 * on their own — desktop and mobile screenshots routinely have very
 * different aspect ratios. Composing `mobile: {x, y}` from those same
 * values into the element before insert (any existing `mobile` members —
 * none from a fresh `elementDefaults()` call, but this stays correct for a
 * caller that already set e.g. `mobile.width` — are preserved) fixes that:
 * the desktop `x`/`y` become a reasonable least-surprise default, and the
 * mobile override is the one that actually governs the mobile view
 * (`resolvedPosition`'s `mobile.x ?? x`). Desktop mode is unchanged from
 * before this parameter existed.
 */
export function insertElementPatch(
  chapterKey: string,
  stepKey: string,
  element: {_type: string; _key: string; x: number; y: number} & Record<string, unknown>,
  device: 'desktop' | 'mobile',
): FormPatch[] {
  if (device === 'desktop') {
    return appendPatches([element], elementsPath(chapterKey, stepKey))
  }

  const existingMobile = isRecord(element.mobile) ? element.mobile : {}
  const composed = {...element, mobile: {...existingMobile, x: element.x, y: element.y}}
  return appendPatches([composed], elementsPath(chapterKey, stepKey))
}

export function moveElementPatch(
  chapterKey: string,
  stepKey: string,
  elementKey: string,
  pos: {x: number; y: number},
  device: 'desktop' | 'mobile',
): FormPatch[] {
  const base = elementPath(chapterKey, stepKey, elementKey)

  if (device === 'desktop') {
    return [set(pos.x, [...base, 'x']), set(pos.y, [...base, 'y'])]
  }

  return [
    setIfMissing({}, [...base, 'mobile']),
    set(pos.x, [...base, 'mobile', 'x']),
    set(pos.y, [...base, 'mobile', 'y']),
  ]
}

export function setElementWidthPatch(
  chapterKey: string,
  stepKey: string,
  elementKey: string,
  width: number,
  device: 'desktop' | 'mobile',
): FormPatch[] {
  const base = elementPath(chapterKey, stepKey, elementKey)

  if (device === 'desktop') {
    return [set(width, [...base, 'width'])]
  }

  return [setIfMissing({}, [...base, 'mobile']), set(width, [...base, 'mobile', 'width'])]
}

export function removeElementPatch(
  chapterKey: string,
  stepKey: string,
  elementKey: string,
): FormPatch[] {
  return [unset(elementPath(chapterKey, stepKey, elementKey))]
}

export function insertStepPatch(
  chapterKey: string,
  step: Record<string, unknown>,
  afterStepKey: string | null,
): FormPatch[] {
  const path = stepsPath(chapterKey)

  if (afterStepKey === null) {
    return appendPatches([step], path)
  }

  return [insert([step], 'after', [...path, stepSegment(afterStepKey)])]
}

/**
 * Appends MULTIPLE steps at once, in `steps`' given order, to the end of a
 * chapter (Filmstrip.tsx's bulk screenshot upload, master plan Task 8's
 * amendment: strictly sequential uploads, then ONE `PatchEvent` inserting
 * every successful `bulkUpload.ts` `stepsFromAssets` scaffold). A same-shape
 * generalization of `insertStepPatch`'s `afterStepKey === null` branch
 * (single-item `appendPatches` call) — reusing `appendPatches` here rather
 * than calling `insertStepPatch` once per step keeps this a single
 * `setIfMissing` + single `insert` pair (one insert carrying every scaffold)
 * instead of N pairs, so a chapter with zero prior steps only gets
 * `setIfMissing([], ...)` guarded against once.
 */
export function insertStepsPatch(
  chapterKey: string,
  steps: Record<string, unknown>[],
): FormPatch[] {
  return appendPatches(steps, stepsPath(chapterKey))
}

/**
 * Regenerates `_key` on every object that sits inside an array and carries
 * one, walking arbitrarily deep (elements, and anything nested inside them —
 * Portable Text blocks, spans, mark defs, further nested arrays). Objects
 * that aren't array members (e.g. a `mobile` override object) are copied
 * as-is; only their descendants are walked for further arrays.
 */
function regenerateKeysDeep(value: unknown, keyGen: () => string): unknown {
  if (Array.isArray(value)) {
    // Pre-order: assign this item's new key before recursing into its
    // fields, so keys come out in reading order (outer element before the
    // nested content it contains) — deterministic and easy to reason about
    // from a fixed keyGen sequence in tests.
    return value.map((item) => {
      if (isRecord(item) && '_key' in item) {
        return regenerateKeysDeep({...item, _key: keyGen()}, keyGen)
      }
      return regenerateKeysDeep(item, keyGen)
    })
  }

  if (isRecord(value)) {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value)) {
      result[key] = regenerateKeysDeep(value[key], keyGen)
    }
    return result
  }

  return value
}

export function duplicateStepPatch(
  chapterKey: string,
  step: Record<string, unknown>,
  newKey: string,
  elementKeyGen: () => string,
): FormPatch[] {
  const sourceKey = step._key
  if (typeof sourceKey !== 'string') {
    throw new Error('duplicateStepPatch: step is missing a string _key')
  }

  const regenerated = regenerateKeysDeep(step, elementKeyGen)
  if (!isRecord(regenerated)) {
    throw new Error('duplicateStepPatch: step must be an object')
  }

  const duplicated = {...regenerated, _key: newKey}

  return [insert([duplicated], 'after', stepPath(chapterKey, sourceKey))]
}

export function removeStepPatch(chapterKey: string, stepKey: string): FormPatch[] {
  return [unset(stepPath(chapterKey, stepKey))]
}

export function moveStepPatch(
  fromChapterKey: string,
  stepKey: string,
  step: Record<string, unknown>,
  toChapterKey: string,
  afterStepKey: string | null,
): FormPatch[] {
  const removePatch = unset(stepPath(fromChapterKey, stepKey))
  const targetPath = stepsPath(toChapterKey)

  if (afterStepKey === null) {
    return [removePatch, ...appendPatches([step], targetPath)]
  }

  return [removePatch, insert([step], 'after', [...targetPath, stepSegment(afterStepKey)])]
}

export function insertChapterPatch(
  chapter: Record<string, unknown>,
  afterChapterKey: string | null,
): FormPatch[] {
  if (afterChapterKey === null) {
    return appendPatches([chapter], [])
  }

  return [insert([chapter], 'after', [chapterSegment(afterChapterKey)])]
}

/**
 * Removes a whole chapter (design spec's filmstrip, master plan Task 6; SDD
 * ledger Parked C ruling). Exists specifically for the LAST-STEP cases the
 * ruling calls out — `steps` is `min(1)`-validated (`schema/chapter.ts`), so
 * removing a chapter's only remaining step would leave it in a state the
 * schema forbids: `Filmstrip.tsx`'s delete-confirm flow calls this instead
 * of `removeStepPatch` when the step being deleted is its chapter's last
 * one (a single `unset` on the chapter removes the step along with it), and
 * its move-to-chapter flow appends this after `moveStepPatch` when the move
 * would leave the source chapter empty. Both call sites surface the
 * chapter-removal consequence in their confirm dialog's text before this
 * ever runs.
 */
export function removeChapterPatch(chapterKey: string): FormPatch[] {
  return [unset([chapterSegment(chapterKey)])]
}

function keyOfRecord(value: unknown): string | null {
  return isRecord(value) && typeof value._key === 'string' ? value._key : null
}

/**
 * Moves a step by one or more positions within its OWN chapter (design
 * spec's filmstrip up/down menu items and HTML5 drag reorder, master plan
 * Task 6). `steps` is the chapter's current step list in reading order
 * (the moved step's own record included, at its current position);
 * `targetIndex` is where it should end up, 0-based, in that same list.
 * Shares one remove-then-insert shape with `moveStepPatch` (this is a
 * same-array special case of it), but keyed by the *neighbor* the moved
 * step should land next to rather than by `null`-means-append: inserting
 * `'before'` the item currently at `targetIndex` when moving earlier, or
 * `'after'` it when moving later, produces the correct final order without
 * a separate "insert at index 0" case — reusable as-is for drag-to-arbitrary-
 * position, not just the adjacent up/down swap the menu items use.
 *
 * Returns an empty array (no-op) if `stepKey` isn't in `steps`, or
 * `targetIndex` is out of range or equal to the step's current index.
 */
export function reorderStepPatch(
  chapterKey: string,
  steps: Record<string, unknown>[],
  stepKey: string,
  targetIndex: number,
): FormPatch[] {
  const index = steps.findIndex((candidate) => keyOfRecord(candidate) === stepKey)
  if (index === -1 || targetIndex < 0 || targetIndex >= steps.length || targetIndex === index) {
    return []
  }

  const step = steps[index]
  const neighborKey = keyOfRecord(steps[targetIndex])
  if (neighborKey === null) return []

  const removePatch = unset(stepPath(chapterKey, stepKey))
  const position = targetIndex > index ? 'after' : 'before'
  return [
    removePatch,
    insert([step], position, [...stepsPath(chapterKey), stepSegment(neighborKey)]),
  ]
}

export function setStepFieldPatch(
  chapterKey: string,
  stepKey: string,
  field: string,
  value: unknown,
): FormPatch[] {
  return [set(value, [...stepPath(chapterKey, stepKey), field])]
}
