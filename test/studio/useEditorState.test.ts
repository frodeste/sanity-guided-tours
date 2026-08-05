import {describe, expect, test} from 'bun:test'

// Load-bearing behavior: `useEditorState`'s auto-heal keeps the selection
// pointed at something that still exists in `chapters` after an undo,
// remote edit, or an author's own delete — CanvasInput.tsx has no other
// guard against rendering a canvas/inspector pane for a step/element that
// no longer exists. Exercised directly via `renderHook` rather than
// through CanvasInput, since it's pure selection-state logic with no
// `@sanity/ui`/`sanity` dependency of its own.
import {act, renderHook} from '@testing-library/react'

import {useEditorState} from '../../src/studio/useEditorState'

function chapter(key: string, steps: unknown[]): unknown {
  return {_key: key, steps}
}

function step(key: string, elements: unknown[] = []): unknown {
  return {_key: key, elements}
}

describe('useEditorState', () => {
  test('initial selection is the first step in reading order', () => {
    const chapters = [chapter('c1', [step('s1'), step('s2')]), chapter('c2', [step('s3')])]
    const {result} = renderHook(({chapters}) => useEditorState(chapters), {
      initialProps: {chapters},
    })

    expect(result.current.selection).toEqual({chapterKey: 'c1', stepKey: 's1', elementKey: null})
  })

  test('deleting the selected chapter heals to the first step of what remains', () => {
    const chapters = [chapter('c1', [step('s1')]), chapter('c2', [step('s2')])]
    const {result, rerender} = renderHook(({chapters}) => useEditorState(chapters), {
      initialProps: {chapters},
    })

    act(() => result.current.selectStep('c2', 's2'))
    expect(result.current.selection).toEqual({chapterKey: 'c2', stepKey: 's2', elementKey: null})

    // Chapter c2 — and the selected step along with it — is gone.
    rerender({chapters: [chapter('c1', [step('s1')])]})

    expect(result.current.selection).toEqual({chapterKey: 'c1', stepKey: 's1', elementKey: null})
  })

  test('deleting the selected step (its chapter survives) heals to the first step of what remains', () => {
    const chapters = [chapter('c1', [step('s1'), step('s2')])]
    const {result, rerender} = renderHook(({chapters}) => useEditorState(chapters), {
      initialProps: {chapters},
    })

    act(() => result.current.selectStep('c1', 's2'))
    expect(result.current.selection).toEqual({chapterKey: 'c1', stepKey: 's2', elementKey: null})

    rerender({chapters: [chapter('c1', [step('s1')])]})

    expect(result.current.selection).toEqual({chapterKey: 'c1', stepKey: 's1', elementKey: null})
  })

  test('removing every chapter heals the selection to all-null', () => {
    const chapters = [chapter('c1', [step('s1')])]
    const {result, rerender} = renderHook(({chapters}) => useEditorState(chapters), {
      initialProps: {chapters},
    })

    rerender({chapters: []})

    expect(result.current.selection).toEqual({chapterKey: null, stepKey: null, elementKey: null})
  })

  test('deleting only the selected element clears elementKey but keeps the step selection', () => {
    const chapters = [chapter('c1', [step('s1', [{_key: 'e1'}, {_key: 'e2'}])])]
    const {result, rerender} = renderHook(({chapters}) => useEditorState(chapters), {
      initialProps: {chapters},
    })

    act(() => result.current.selectElement('e2'))
    expect(result.current.selection).toEqual({chapterKey: 'c1', stepKey: 's1', elementKey: 'e2'})

    rerender({chapters: [chapter('c1', [step('s1', [{_key: 'e1'}])])]})

    expect(result.current.selection).toEqual({chapterKey: 'c1', stepKey: 's1', elementKey: null})
  })

  test('a still-valid selection is left untouched across a re-render', () => {
    const chapters = [chapter('c1', [step('s1'), step('s2')])]
    const {result, rerender} = renderHook(({chapters}) => useEditorState(chapters), {
      initialProps: {chapters},
    })

    act(() => result.current.selectStep('c1', 's2'))
    rerender({chapters})

    expect(result.current.selection).toEqual({chapterKey: 'c1', stepKey: 's2', elementKey: null})
  })

  // The heal-away race (PR 97 review, then a re-review): `CanvasInput.tsx`
  // calls `selectElement(newKey)` in the same tick it emits the patch that
  // inserts that element — a local `setState`. `chapters` (from
  // `props.value`) doesn't catch up synchronously; it only reflects the
  // insert once Sanity's document store round-trips the patch back down.
  //
  // The first fix gated the heal on "did chapters' overall content change
  // at all" — better than unconditional, but still wrong: a *second*,
  // unrelated content change (or a second pending insert's own patch
  // landing) still made the still-missing key look confirmed-gone, and
  // once `elementKey` was cleared to `null` there was nothing left to
  // heal back. The actual fix (this file) only heals a key that was
  // PRESENT in some snapshot `chapters` previously held and is absent
  // from the current one — never-yet-seen keys survive any number of
  // unrelated snapshot changes, however many, until the snapshot that
  // introduces them finally arrives.
  describe('heal-away race: a selection set ahead of a stale `chapters` snapshot', () => {
    test('survives a re-render whose chapters snapshot is unchanged', () => {
      const chapters = [chapter('c1', [step('s1', [{_key: 'e1'}])])]
      const {result, rerender} = renderHook(({chapters}) => useEditorState(chapters), {
        initialProps: {chapters},
      })

      // e2 doesn't exist in `chapters` yet — the insert patch is still in
      // flight — but it was just selected locally.
      act(() => result.current.selectElement('e2'))
      expect(result.current.selection).toEqual({chapterKey: 'c1', stepKey: 's1', elementKey: 'e2'})

      // Re-render with the exact same (still-stale) snapshot: this must
      // NOT be treated as confirmation that e2 was deleted.
      rerender({chapters})

      expect(result.current.selection).toEqual({chapterKey: 'c1', stepKey: 's1', elementKey: 'e2'})
    })

    // Encoded the OLD (first-fix) "any content change + still missing =
    // heal" semantics before the re-review — that's exactly the bug: e2
    // was never confirmed present anywhere, so an unrelated change (e3
    // showing up) elsewhere must NOT read as "e2 was deleted". Updated to
    // assert the correct survive behavior.
    test('an unrelated concurrent edit landing before the pending insert does not heal it away', () => {
      const chapters = [chapter('c1', [step('s1', [{_key: 'e1'}])])]
      const {result, rerender} = renderHook(({chapters}) => useEditorState(chapters), {
        initialProps: {chapters},
      })

      act(() => result.current.selectElement('e2'))
      expect(result.current.selection.elementKey).toBe('e2')

      // The snapshot changes — a wholly unrelated element, e3, shows up —
      // but e2 was never in a previous snapshot to begin with, so its
      // continued absence here isn't a confirmed deletion.
      rerender({chapters: [chapter('c1', [step('s1', [{_key: 'e1'}, {_key: 'e3'}])])]})

      expect(result.current.selection).toEqual({chapterKey: 'c1', stepKey: 's1', elementKey: 'e2'})
    })

    test('insert flow: selection survives until a snapshot containing the new key arrives', () => {
      const chapters = [chapter('c1', [step('s1', [{_key: 'e1'}])])]
      const {result, rerender} = renderHook(({chapters}) => useEditorState(chapters), {
        initialProps: {chapters},
      })

      act(() => result.current.selectElement('e2'))

      // An intervening render with the still-stale snapshot — same
      // scenario as the first test above.
      rerender({chapters})
      expect(result.current.selection.elementKey).toBe('e2')

      // The patch round-trips: `chapters` now actually contains e2.
      rerender({chapters: [chapter('c1', [step('s1', [{_key: 'e1'}, {_key: 'e2'}])])]})

      expect(result.current.selection).toEqual({chapterKey: 'c1', stepKey: 's1', elementKey: 'e2'})
    })

    // The regression the re-review caught: selecting e2 then e3 while
    // BOTH inserts are still in flight. When e2's patch lands first, the
    // snapshot changes (e2 now present) but e3 — the actual current
    // selection — still isn't in it. The old "any change + still missing"
    // heal read that as e3 being deleted and cleared it, permanently
    // (nothing ever heals a selection back from `null`). e3 must survive
    // e2's patch landing, and then stay selected once its own patch lands
    // too.
    test('a second selection made before the first pending insert lands survives that insert landing', () => {
      const chapters = [chapter('c1', [step('s1', [{_key: 'e1'}])])]
      const {result, rerender} = renderHook(({chapters}) => useEditorState(chapters), {
        initialProps: {chapters},
      })

      act(() => result.current.selectElement('e2'))
      act(() => result.current.selectElement('e3'))
      expect(result.current.selection.elementKey).toBe('e3')

      // e2's insert round-trips first — e3's is still in flight.
      rerender({chapters: [chapter('c1', [step('s1', [{_key: 'e1'}, {_key: 'e2'}])])]})
      expect(result.current.selection).toEqual({chapterKey: 'c1', stepKey: 's1', elementKey: 'e3'})

      // e3's insert round-trips too.
      rerender({
        chapters: [chapter('c1', [step('s1', [{_key: 'e1'}, {_key: 'e2'}, {_key: 'e3'}])])],
      })
      expect(result.current.selection).toEqual({chapterKey: 'c1', stepKey: 's1', elementKey: 'e3'})
    })
  })
})
