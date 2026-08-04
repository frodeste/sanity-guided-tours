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
})
