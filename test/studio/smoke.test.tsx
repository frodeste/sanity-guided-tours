import {afterEach, describe, expect, mock, test} from 'bun:test'

// Render smoke tests for `CanvasInput` (master plan Tasks 4-5). Per the
// brief's Studio-test caveat, the first fallback tried was wrapping
// fixtures in `@sanity/ui`'s `ThemeProvider`/`studioTheme` — that alone
// wasn't enough (`@sanity/ui`'s `Dialog` also needs a `LayerProvider`
// ancestor, or its internal `useLayer()` throws "missing context value";
// everything else — `Card`/`Box`/`Button`/etc — only needed the theme). With
// that wrap, no `sanity` *mocking* was ever required, even once Task 5 added
// `CanvasInput.tsx`'s first runtime `sanity` imports (`PatchEvent` — a plain
// data class with no context dependency — and `useProjectDataset`, which
// wraps `useWorkspace()`): there's no `WorkspaceProvider` ancestor in this
// render tree, so `useWorkspace()` throws and `useProjectDataset` catches
// it, returning nulls — `Canvas` then renders the asset-ref placeholder
// text instead of a real `<img>` (see `Canvas.tsx`'s and
// `useProjectDataset.ts`'s module comments). The fixture below still has to
// satisfy the *type* `ArrayOfObjectsInputProps` in full, though —
// `CanvasInput` calls `props.renderDefault(props)` for the "Plain editor"
// escape hatch, and `renderDefault`'s declared signature takes the complete
// `InputProps`, so the props object handed to the component has to be a
// fully valid one (`baseInputProps()` below), not a hand-picked subset.
// Per-test, only `value`/`onChange`/`renderDefault` actually vary.
import {LayerProvider, ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react'
import type {ReactNode} from 'react'
import {PatchEvent, setIfMissing} from 'sanity'
import type {ArrayOfObjectsInputProps, FormInsertPatch, FormPatch} from 'sanity'

import {CanvasInput} from '../../src/studio/CanvasInput'
import {moveElementPatch, removeElementPatch, setElementWidthPatch} from '../../src/studio/patches'

afterEach(() => {
  cleanup()
})

// `studioTheme` (the `@sanity/ui` v2-era default) is deprecated in favor of
// `buildTheme()` from `@sanity/ui/theme` — oxlint's `no-deprecated` rule
// catches the old one, so build a plain default theme instead.
const theme = buildTheme()

function renderWithTheme(ui: ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <LayerProvider>{ui}</LayerProvider>
    </ThemeProvider>,
  )
}

// --- ArrayOfObjectsInputProps fixture ----------------------------------
//
// A fully valid `ArrayOfObjectsInputProps` (default generic: array items
// only guaranteed a `_key`), with every field CanvasInput doesn't read
// filled with the simplest stub that satisfies its type. `renderDefault`
// returns a recognizable marker node so the "Plain editor" escape hatch is
// assertable without depending on Sanity's real default array input.

function baseInputProps(): ArrayOfObjectsInputProps {
  return {
    id: 'chapters',
    schemaType: {name: 'chapters', jsonType: 'array', of: []},
    level: 0,
    path: [],
    presence: [],
    validation: [],
    value: undefined,
    focusPath: [],
    members: [],
    __unstable_computeDiff: () => ({
      type: 'null',
      action: 'unchanged',
      isChanged: false,
      fromValue: null,
      toValue: null,
    }),
    changed: false,
    hasUpstreamVersion: false,
    onChange: () => {},
    onItemAppend: () => {},
    onItemPrepend: () => {},
    onItemRemove: () => {},
    onItemMove: () => {},
    onInsert: () => {},
    resolveInitialValue: () => Promise.resolve({_key: 'x'}),
    resolveUploader: () => null,
    onPathFocus: () => {},
    onItemCollapse: () => {},
    onItemExpand: () => {},
    onItemOpen: () => {},
    onItemClose: () => {},
    renderField: () => null,
    renderInput: () => null,
    renderItem: () => null,
    renderPreview: () => null,
    elementProps: {
      'id': 'chapters',
      'onFocus': () => {},
      'onBlur': () => {},
      'ref': {current: null},
      'aria-describedby': undefined,
      'style': {},
    },
    renderDefault: () => <div data-testid="plain-editor-stub">plain editor</div>,
    displayInlineChanges: false,
  }
}

// --- chapters/steps fixture (2 chapters, 3 steps) -----------------------

interface FixtureImage {
  _type: 'image'
  asset: {_type: 'reference'; _ref: string}
  alt?: string
}

function image(ref: string, alt?: string): FixtureImage {
  return alt === undefined
    ? {_type: 'image', asset: {_type: 'reference', _ref: ref}}
    : {_type: 'image', asset: {_type: 'reference', _ref: ref}, alt}
}

interface FixtureStep {
  _key: string
  title: string
  screenshot?: FixtureImage
  screenshotMobile?: FixtureImage
  elements: unknown[]
}

function step(overrides: {
  _key: string
  title: string
  screenshot?: FixtureImage
  screenshotMobile?: FixtureImage
  elements?: unknown[]
}): FixtureStep {
  const {elements, ...rest} = overrides
  return {...rest, elements: elements ?? []}
}

interface FixtureChapter {
  _key: string
  title: string
  steps: FixtureStep[]
}

function chapter(overrides: FixtureChapter): FixtureChapter {
  return overrides
}

const fixtureChapters = [
  chapter({
    _key: 'c1',
    title: 'Intro',
    steps: [
      step({
        _key: 's1',
        title: 'Welcome',
        screenshot: image('image-aaa-800x600-png', 'Welcome screenshot'),
        elements: [
          {_type: 'guidedTourHotspot', _key: 'e1', x: 10, y: 10, action: 'advance', pulse: true},
          {
            _type: 'guidedTourTooltip',
            _key: 'e2',
            x: 20,
            y: 20,
            width: 300,
            placement: 'auto',
            trigger: 'click',
            content: [],
          },
        ],
      }),
      step({_key: 's2', title: 'Features', screenshot: image('image-bbb-800x600-png')}),
    ],
  }),
  chapter({
    _key: 'c2',
    title: 'Advanced',
    steps: [
      step({
        _key: 's3',
        title: 'Wrap up',
        screenshot: image('image-ccc-desktop-800x600-png'),
        screenshotMobile: image('image-ccc-mobile-400x800-png'),
      }),
    ],
  }),
]

describe('CanvasInput', () => {
  test('renders the filmstrip and the first step’s screenshot', () => {
    renderWithTheme(<CanvasInput {...baseInputProps()} value={fixtureChapters} />)

    expect(screen.getByTestId('filmstrip-step-c1-s1')).toBeTruthy()
    expect(screen.getByTestId('filmstrip-step-c1-s2')).toBeTruthy()
    expect(screen.getByTestId('filmstrip-step-c2-s3')).toBeTruthy()
    expect(
      within(screen.getByTestId('filmstrip-step-c1-s1')).getByText('Intro — Welcome'),
    ).toBeTruthy()

    // No `WorkspaceProvider` ancestor in this render tree (see this file's
    // module comment), so `useProjectDataset()` returns nulls and `Canvas`
    // falls back to the asset-ref placeholder text instead of a real
    // `<img>` — see `Canvas.tsx`'s module comment and
    // `useProjectDataset.ts`'s for the full design note.
    expect(screen.getByTestId('canvas-screenshot-placeholder').textContent).toContain(
      'image-aaa-800x600-png',
    )
  })

  test('selecting a different step updates which screenshot ref is shown', () => {
    renderWithTheme(<CanvasInput {...baseInputProps()} value={fixtureChapters} />)

    fireEvent.click(screen.getByTestId('filmstrip-step-c1-s2'))

    expect(screen.getByTestId('canvas-screenshot-placeholder').textContent).toContain(
      'image-bbb-800x600-png',
    )
  })

  test('the device toggle flips which screenshot ref is shown', () => {
    renderWithTheme(<CanvasInput {...baseInputProps()} value={fixtureChapters} />)

    fireEvent.click(screen.getByTestId('filmstrip-step-c2-s3'))
    expect(screen.getByTestId('canvas-screenshot-placeholder').textContent).toContain(
      'image-ccc-desktop-800x600-png',
    )

    const desktopToggle = screen.getByTestId('device-desktop')
    const mobileToggle = screen.getByTestId('device-mobile')
    expect(desktopToggle.getAttribute('aria-pressed')).toBe('true')
    expect(mobileToggle.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(mobileToggle)

    expect(mobileToggle.getAttribute('aria-pressed')).toBe('true')
    expect(desktopToggle.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('canvas-screenshot-placeholder').textContent).toContain(
      'image-ccc-mobile-400x800-png',
    )
  })

  test('opening the full editor renders the panes inside a dialog', () => {
    renderWithTheme(<CanvasInput {...baseInputProps()} value={fixtureChapters} />)

    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByTestId('open-full-editor'))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByTestId('filmstrip-step-c1-s1')).toBeTruthy()
    // Collapsed and expanded are mutually exclusive — the inline card's
    // copy of the panes isn't also left mounted behind the dialog.
    expect(screen.getAllByTestId('filmstrip-step-c1-s1')).toHaveLength(1)
  })

  test('renders the collapsed "Plain editor" escape hatch via renderDefault', () => {
    renderWithTheme(<CanvasInput {...baseInputProps()} value={fixtureChapters} />)

    expect(screen.getByText('Plain editor')).toBeTruthy()
    expect(screen.getByTestId('plain-editor-stub')).toBeTruthy()
  })

  test('does not crash with an empty/undefined value', () => {
    renderWithTheme(<CanvasInput {...baseInputProps()} />)

    expect(screen.getByText('No steps yet.')).toBeTruthy()
    expect(screen.getByText('Select a step to see its screenshot.')).toBeTruthy()
    expect(screen.getByText('Select an element to edit its fields.')).toBeTruthy()
  })
})

function isInsertPatch(patch: unknown): patch is FormInsertPatch {
  return (
    typeof patch === 'object' &&
    patch !== null &&
    'type' in patch &&
    patch.type === 'insert' &&
    'items' in patch &&
    Array.isArray(patch.items)
  )
}

/** Narrows the `onChange` spy's `FormPatch | FormPatch[] | PatchEvent` argument without an `as` cast — `PatchEvent.from(...)` (CanvasInput.tsx's `emit`) always produces a real `PatchEvent` instance, so `instanceof` is exact here, not a heuristic. */
function isPatchEvent(value: unknown): value is PatchEvent {
  return value instanceof PatchEvent
}

// Master plan Task 5: "smoke: click-with-tool calls onChange with an insert
// patch (assert patch shape via the spy); nudge on selected element
// produces move patch; delete produces remove patch." Every element
// mutation in `Canvas.tsx` is reported upward as a semantic callback
// (`onInsertElement`/`onMoveElement`/`onRemoveElement`) that `CanvasInput`
// turns into a `patches.ts` builder wrapped in `PatchEvent.from(...)` for
// the top-level `props.onChange` — these tests spy on that top-level
// `onChange`, the same seam the master plan's Global Constraints require
// every document mutation to flow through.
describe('Canvas interactions', () => {
  test('clicking the canvas surface with a tool active inserts an element via onChange', () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    // Step s1 (chapter c1) is selected by default (first step in reading
    // order — `useEditorState`'s initial selection).
    fireEvent.click(screen.getByTestId('canvas-tool-hotspot'))
    fireEvent.click(screen.getByTestId('canvas-surface'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')
    const event = call
    expect(event.patches).toHaveLength(2)
    expect(event.patches[0]).toEqual(
      setIfMissing([], [{_key: 'c1'}, 'steps', {_key: 's1'}, 'elements']),
    )

    const insertPatch = event.patches[1]
    if (!isInsertPatch(insertPatch)) throw new Error('expected an insert patch')
    expect(insertPatch.items).toHaveLength(1)
    // happy-dom's `getBoundingClientRect()` always returns an all-zero
    // rect (no real layout engine), so `pointToPercent` — correctly, per
    // its own documented zero-width/height fallback — places the click at
    // (0, 0); the interesting assertion here is the type-specific default
    // fields (`canvasHandlers.test.ts` already covers `elementDefaults`
    // directly), not the exact coordinate.
    expect(insertPatch.items[0]).toMatchObject({
      _type: 'guidedTourHotspot',
      action: 'advance',
      pulse: true,
      x: 0,
      y: 0,
    })

    // Placing the element also resets the tool back to Select and selects
    // the new element (design spec §7.2) — the tool palette reflects that.
    expect(screen.getByTestId('canvas-tool-select').getAttribute('aria-pressed')).toBe('true')
  })

  test('nudging the selected element with an arrow key emits a move patch via onChange', () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    // Step s1 carries fixture element `e1`; selecting it is a pointerdown
    // on its chip (`CanvasElement`'s drag handle also selects on press).
    fireEvent.pointerDown(screen.getByTestId('canvas-element-e1'), {pointerId: 1})
    fireEvent.keyDown(screen.getByTestId('canvas-element-e1'), {key: 'ArrowRight'})

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')
    const event = call
    expect(event.patches).toEqual(moveElementPatch('c1', 's1', 'e1', {x: 10.5, y: 10}, 'desktop'))
  })

  test('Shift+arrow nudges the selected element by the big (5%) step', () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    fireEvent.pointerDown(screen.getByTestId('canvas-element-e1'), {pointerId: 1})
    fireEvent.keyDown(screen.getByTestId('canvas-element-e1'), {key: 'ArrowDown', shiftKey: true})

    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')
    const event = call
    expect(event.patches).toEqual(moveElementPatch('c1', 's1', 'e1', {x: 10, y: 15}, 'desktop'))
  })

  test('Delete on the selected element emits a remove patch via onChange', () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    fireEvent.pointerDown(screen.getByTestId('canvas-element-e1'), {pointerId: 1})
    fireEvent.keyDown(screen.getByTestId('canvas-element-e1'), {key: 'Delete'})

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')
    const event = call
    // This bare test harness is a controlled component with a static
    // `value` fixture — firing `onChange` doesn't feed a new `value` back
    // in (that's the surrounding form-builder's job in the real Studio),
    // so there's no "the chip is gone" DOM assertion to make here; the
    // patch shape itself is the thing under test.
    expect(event.patches).toEqual(removeElementPatch('c1', 's1', 'e1'))
  })

  test('Escape deselects the element without emitting a patch', () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    fireEvent.pointerDown(screen.getByTestId('canvas-element-e1'), {pointerId: 1})
    fireEvent.keyDown(screen.getByTestId('canvas-element-e1'), {key: 'Escape'})

    expect(onChange).not.toHaveBeenCalled()
  })

  test('resizing a tooltip in mobile device mode emits a mobile.width patch within the schema range', () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    // Step s1's fixture tooltip `e2` starts at width 300 (desktop, no
    // mobile override yet). Switching device to mobile before resizing is
    // the regression this test guards: `position.ts`'s `mobile.width`
    // field used to be validated `min(1).max(100)` (percent-shaped) even
    // though a tooltip's own `width` is px 200-600 — a mobile resize
    // landing above 100 would have failed real Studio validation despite
    // `resizeWidth`'s clamp being correct. That schema field is now
    // `min(1).max(600)` (position.ts); this test's resized width (350,
    // comfortably inside [200, 600] and well past the old 100 ceiling)
    // demonstrates the patch this produces is schema-valid.
    fireEvent.click(screen.getByTestId('device-mobile'))

    const resizeHandle = screen.getByTestId('canvas-element-e2-resize')
    fireEvent.pointerDown(resizeHandle, {clientX: 100, pointerId: 1})
    fireEvent.pointerMove(resizeHandle, {clientX: 150, pointerId: 1})
    fireEvent.pointerUp(resizeHandle, {clientX: 150, pointerId: 1})

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')

    // tooltip resize is 1:1 with the client-pixel delta (canvasHandlers.ts's
    // `resizeWidth`): startWidth 300 + delta 50 = 350.
    const expectedWidth = 350
    expect(expectedWidth).toBeGreaterThanOrEqual(200)
    expect(expectedWidth).toBeLessThanOrEqual(600)
    expect(call.patches).toEqual(setElementWidthPatch('c1', 's1', 'e2', expectedWidth, 'mobile'))
  })
})
