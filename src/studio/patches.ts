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
function appendPatches(items: unknown[], path: PathStep[]): unknown[] {
  return [setIfMissing([], path), insert(items, 'after', [...path, -1])]
}

export function insertElementPatch(
  chapterKey: string,
  stepKey: string,
  element: {_type: string; _key: string; x: number; y: number} & Record<string, unknown>,
): unknown[] {
  return appendPatches([element], elementsPath(chapterKey, stepKey))
}

export function moveElementPatch(
  chapterKey: string,
  stepKey: string,
  elementKey: string,
  pos: {x: number; y: number},
  device: 'desktop' | 'mobile',
): unknown[] {
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
): unknown[] {
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
): unknown[] {
  return [unset(elementPath(chapterKey, stepKey, elementKey))]
}

export function insertStepPatch(
  chapterKey: string,
  step: Record<string, unknown>,
  afterStepKey: string | null,
): unknown[] {
  const path = stepsPath(chapterKey)

  if (afterStepKey === null) {
    return appendPatches([step], path)
  }

  return [insert([step], 'after', [...path, stepSegment(afterStepKey)])]
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
): unknown[] {
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

export function removeStepPatch(chapterKey: string, stepKey: string): unknown[] {
  return [unset(stepPath(chapterKey, stepKey))]
}

export function moveStepPatch(
  fromChapterKey: string,
  stepKey: string,
  step: Record<string, unknown>,
  toChapterKey: string,
  afterStepKey: string | null,
): unknown[] {
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
): unknown[] {
  if (afterChapterKey === null) {
    return appendPatches([chapter], [])
  }

  return [insert([chapter], 'after', [chapterSegment(afterChapterKey)])]
}

export function setStepFieldPatch(
  chapterKey: string,
  stepKey: string,
  field: string,
  value: unknown,
): unknown[] {
  return [set(value, [...stepPath(chapterKey, stepKey), field])]
}
