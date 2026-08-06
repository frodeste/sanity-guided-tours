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
import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react'
import {StrictMode, type ReactNode} from 'react'
import {PatchEvent, setIfMissing} from 'sanity'
import {SourceContext} from 'sanity/_singletons'
import type {
  ArrayOfObjectsInputProps,
  ArrayOfObjectsItemMember,
  ArrayOfObjectsMember,
  FieldMember,
  FormInsertPatch,
  FormPatch,
  ObjectArrayFormNode,
  ObjectMember,
} from 'sanity'

import {CanvasInput} from '../../src/studio/CanvasInput'
import {
  insertChapterPatch,
  moveElementPatch,
  moveStepPatch,
  removeChapterPatch,
  removeElementPatch,
  removeStepPatch,
  reorderStepPatch,
  setElementWidthPatch,
} from '../../src/studio/patches'

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

// `<StrictMode>` makes React dev-mode double-invoke state updater
// functions (`setX(current => ...)`), the same check that would have
// caught `Canvas.tsx`'s old impure `handleResizeEnd` (it called
// `props.onResizeElement` — which round-trips into `onChange` — from
// inside a `setResizeState` updater). Confirmed empirically in this
// harness: a deliberately-impure updater's side effect fires twice under
// this wrap, once under `renderWithTheme`. Used only where a test's whole
// point is guarding updater purity — not the default, since it doubles
// every render (fine for these targeted assertions, unnecessary overhead
// and noise elsewhere).
function renderStrict(ui: ReactNode) {
  return render(
    <StrictMode>
      <ThemeProvider theme={theme}>
        <LayerProvider>{ui}</LayerProvider>
      </ThemeProvider>
    </StrictMode>,
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

// --- `props.members` fixture (Task 7 / Inspector.tsx) -------------------
//
// `Inspector.tsx` drills `ArrayOfObjectsInputProps.members` — a completely
// separate prop from `value` (real Sanity form-builder state carries both,
// kept in sync by the platform; this bare test harness has no such platform
// underneath it, so the two are built independently here and threaded
// through by hand). `buildMembers` mirrors `fixtureChapters`' own shape
// mechanically (chapter item -> `steps` field -> step item -> `elements`
// field -> element item) so the two fixtures can't silently drift apart;
// the "orphan selection" tests below deliberately break that mirroring on
// purpose, to model `members` lagging behind `value` (see their own
// comments).
//
// Every node fills in the full real `sanity` member-tree shape (matching
// `baseInputProps()`'s own philosophy above: the fixture must satisfy the
// real type in full, not a hand-picked subset) so `Inspector.tsx`'s walk
// exercises the exact same types production code does — the only
// `unknown`-narrowing step (`FieldMember.field`'s `.members`, generically
// erased by `sanity`'s own types) lives in `Inspector.tsx` itself, not
// duplicated here.
function keyOfFixture(value: unknown): string {
  return isRecord(value) && typeof value._key === 'string' ? value._key : 'missing'
}

/** `ObjectArrayFormNode.value` requires (at minimum) `ObjectItem` — `{_key: string}` — unlike the rest of this file's fixtures, which stay `unknown` throughout (mirroring how the real `chapters` field value arrives on the wire). Used for the `steps`/`elements` field-placeholder nodes below, where the field's own `.value` is never read (`Inspector.tsx`'s `arrayFieldMembers` only reads `.members` off a field's FormNode), and for the real chapter/step/element nodes, where it's just the already-`_key`-bearing fixture value passed through. */
function asKeyedRecord(value: unknown, key: string): {_key: string} & Record<string, unknown> {
  return isRecord(value) ? {...value, _key: key} : {_key: key}
}

function objectArrayFormNode(
  path: (string | {_key: string})[],
  value: {_key: string} & Record<string, unknown>,
  members: ObjectMember[],
): ObjectArrayFormNode {
  return {
    id: 'x',
    schemaType: {name: 'x', jsonType: 'object', fields: []},
    level: 0,
    path,
    presence: [],
    validation: [],
    value,
    focusPath: [],
    groups: [],
    members,
    __unstable_computeDiff: () => ({
      type: 'null',
      action: 'unchanged',
      isChanged: false,
      fromValue: null,
      toValue: null,
    }),
    changed: false,
    compareValue: undefined,
    hasUpstreamVersion: false,
  }
}

function arrayFieldMember(name: string, members: ArrayOfObjectsMember[]): FieldMember {
  // Built via a variable (not inline in the returned literal below) so its
  // extra `members` property — real on `ObjectArrayFormNode`, but not part
  // of `FieldMember.field`'s own generically-erased `BaseFormNode` type —
  // doesn't trip TypeScript's excess-property check the way assigning a
  // *fresh literal* directly into a `BaseFormNode`-typed slot would.
  // `Inspector.tsx`'s `arrayFieldMembers` reads it back out through an
  // `unknown`-narrowing helper for exactly this reason.
  const field = objectArrayFormNode([], {_key: 'field'}, [])
  const fieldWithMembers = {...field, members}
  return {
    kind: 'field',
    key: name,
    name,
    index: 0,
    collapsed: false,
    collapsible: false,
    open: false,
    inSelectedGroup: true,
    groups: [],
    path: [],
    field: fieldWithMembers,
  }
}

function elementItemMember(
  chapterKey: string,
  stepKey: string,
  element: unknown,
): ArrayOfObjectsItemMember {
  const key = keyOfFixture(element)
  return {
    kind: 'item',
    key,
    index: 0,
    collapsed: false,
    collapsible: false,
    open: false,
    parentSchemaType: {name: 'elements', jsonType: 'array', of: []},
    item: objectArrayFormNode(
      [{_key: chapterKey}, 'steps', {_key: stepKey}, 'elements', {_key: key}],
      asKeyedRecord(element, key),
      [],
    ),
  }
}

function stepItemMember(chapterKey: string, step: unknown): ArrayOfObjectsItemMember {
  const key = keyOfFixture(step)
  const elements = isRecord(step) && Array.isArray(step.elements) ? step.elements : []
  const elementsField = arrayFieldMember(
    'elements',
    elements.map((element) => elementItemMember(chapterKey, key, element)),
  )
  return {
    kind: 'item',
    key,
    index: 0,
    collapsed: false,
    collapsible: false,
    open: false,
    parentSchemaType: {name: 'steps', jsonType: 'array', of: []},
    item: objectArrayFormNode(
      [{_key: chapterKey}, 'steps', {_key: key}],
      asKeyedRecord(step, key),
      [elementsField],
    ),
  }
}

function chapterItemMember(chapter: unknown): ArrayOfObjectsItemMember {
  const key = keyOfFixture(chapter)
  const steps = isRecord(chapter) && Array.isArray(chapter.steps) ? chapter.steps : []
  const stepsField = arrayFieldMember(
    'steps',
    steps.map((step) => stepItemMember(key, step)),
  )
  return {
    kind: 'item',
    key,
    index: 0,
    collapsed: false,
    collapsible: false,
    open: false,
    parentSchemaType: {name: 'chapters', jsonType: 'array', of: []},
    item: objectArrayFormNode([{_key: key}], asKeyedRecord(chapter, key), [stepsField]),
  }
}

function buildMembers(chapters: unknown[]): ArrayOfObjectsMember[] {
  return chapters.map(chapterItemMember)
}

describe('CanvasInput', () => {
  test('renders the filmstrip and the first step’s screenshot', () => {
    renderWithTheme(<CanvasInput {...baseInputProps()} value={fixtureChapters} />)

    expect(screen.getByTestId('filmstrip-step-c1-s1')).toBeTruthy()
    expect(screen.getByTestId('filmstrip-step-c1-s2')).toBeTruthy()
    expect(screen.getByTestId('filmstrip-step-c2-s3')).toBeTruthy()
    // Chapter-grouped rendering (Task 6): the chapter title lives once in
    // its group header, not repeated on every one of its step rows.
    expect(screen.getByTestId('filmstrip-chapter-c1').textContent).toContain('Intro')
    expect(screen.getByTestId('filmstrip-step-c1-s1').textContent).toContain('Welcome')

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

  test('clicking the canvas surface with a tool active in mobile device mode writes both top-level and mobile positions', () => {
    // Regression test for PR #97's review finding: click-to-place ignored
    // `device`, so a mobile-mode click (coordinates measured against the
    // *mobile* screenshot) landed only in top-level desktop x/y with no
    // `mobile` override — nonsense positions once viewed on desktop.
    // `insertElementPatch`'s `device` param (patches.ts) now composes a
    // `mobile: {x, y}` override from those same coordinates into the
    // inserted element in mobile mode, so both the desktop default and the
    // mobile override land in a single insert patch.
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    fireEvent.click(screen.getByTestId('device-mobile'))
    fireEvent.click(screen.getByTestId('canvas-tool-hotspot'))
    fireEvent.click(screen.getByTestId('canvas-surface'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')

    const insertPatch = call.patches[1]
    if (!isInsertPatch(insertPatch)) throw new Error('expected an insert patch')
    expect(insertPatch.items).toHaveLength(1)
    // Same zero-rect caveat as the desktop insert test above: happy-dom's
    // `getBoundingClientRect()` places the click at (0, 0) on both axes —
    // the point under test is that `mobile.x`/`mobile.y` match the
    // top-level `x`/`y` exactly (same measured coordinates, written to
    // both places), not the specific value.
    expect(insertPatch.items[0]).toMatchObject({
      _type: 'guidedTourHotspot',
      action: 'advance',
      pulse: true,
      x: 0,
      y: 0,
      mobile: {x: 0, y: 0},
    })
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

  // Canvas.tsx's handleResizeEnd used to call props.onResizeElement (->
  // onChange -> a PatchEvent) from inside its setResizeState updater —
  // impure, since a StrictMode-double-invoked updater would fire that
  // side effect twice. Fixed by mirroring resize state into a ref and
  // reading the ref from an ordinary (non-updater) handler instead;
  // handleResizeMove's updater stayed pure throughout (it only computes
  // and returns a value). Rendering under StrictMode is what actually
  // exercises the double-invoke path renderWithTheme's ordinary render
  // never would.
  test('a resize gesture emits exactly one onChange even under StrictMode', () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderStrict(<CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />)

    const resizeHandle = screen.getByTestId('canvas-element-e2-resize')
    fireEvent.pointerDown(resizeHandle, {clientX: 100, pointerId: 1})
    fireEvent.pointerMove(resizeHandle, {clientX: 120, pointerId: 1})
    fireEvent.pointerMove(resizeHandle, {clientX: 150, pointerId: 1})
    fireEvent.pointerUp(resizeHandle, {clientX: 150, pointerId: 1})

    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Opens the given step's `MenuButton` (per-step `⋯` menu, `Filmstrip.tsx`). */
function openStepMenu(chapterKey: string, stepKey: string): void {
  fireEvent.click(screen.getByTestId(`filmstrip-step-menu-${chapterKey}-${stepKey}`))
}

/** The "Move to chapter" `MenuGroup` doesn't eagerly render its target-chapter `MenuItem`s — its own submenu popover only mounts once its trigger is clicked (see `Filmstrip.test.tsx`'s identical helper). Call after `openStepMenu`. */
function openMoveToChapterSubmenu(): void {
  const trigger = screen.getByText('Move to chapter').closest('button')
  if (!trigger) throw new Error('expected the Move to chapter trigger to be a <button>')
  fireEvent.click(trigger)
}

// Master plan Task 6 / post-review gap: the smoke tests above (Tasks 4-5)
// and `Filmstrip.test.tsx` (Task 6, callback-spy level) never actually
// exercised `CanvasInput.tsx`'s OWN wiring for step management — the
// `onDeleteStep`/`onMoveStepToChapter` isLastStep/sourceBecomesEmpty
// branches, and the `findStep`/`findChapter` re-derivation from `chapters`
// at emit time — end to end through the rendered UI and the real
// `onChange`/`PatchEvent` seam. These tests close that gap: they drive the
// per-step menu and confirm dialog exactly as an author would, then assert
// on the emitted patch shapes (reusing the same `patches.ts` builders the
// production code calls, the same grounding `patches.test.ts` and the
// existing "Canvas interactions" describe block above both use).
describe('CanvasInput: filmstrip step-management wiring (Task 6)', () => {
  test('duplicating a step emits a single insert patch with the step key and every element key regenerated', () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    // Step s1 (chapter c1) carries two fixture elements (e1, e2).
    openStepMenu('c1', 's1')
    fireEvent.click(screen.getByTestId('filmstrip-duplicate-c1-s1'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')
    expect(call.patches).toHaveLength(1)

    const insertPatch = call.patches[0]
    if (!isInsertPatch(insertPatch)) throw new Error('expected an insert patch')
    expect(insertPatch.position).toBe('after')
    expect(insertPatch.path).toEqual([{_key: 'c1'}, 'steps', {_key: 's1'}])
    expect(insertPatch.items).toHaveLength(1)

    const duplicated = insertPatch.items[0]
    if (!isRecord(duplicated)) throw new Error('expected a record')
    expect(typeof duplicated._key).toBe('string')
    expect(duplicated._key).not.toBe('s1')

    const elements = duplicated.elements
    if (!Array.isArray(elements)) throw new Error('expected an elements array')
    expect(elements).toHaveLength(2)
    const elementKeys = elements.map((element) => (isRecord(element) ? element._key : undefined))
    expect(elementKeys).not.toContain('e1')
    expect(elementKeys).not.toContain('e2')
    expect(elementKeys).not.toContain(duplicated._key)
    expect(new Set(elementKeys).size).toBe(2)
  })

  test("deleting a step that is NOT its chapter's last emits removeStepPatch, only after confirming", () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    // c1 has two steps (s1, s2) — s2 isn't the chapter's last.
    openStepMenu('c1', 's2')
    fireEvent.click(screen.getByTestId('filmstrip-delete-c1-s2'))

    expect(onChange).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).not.toContain('also delete the chapter')

    fireEvent.click(screen.getByTestId('filmstrip-confirm-confirm'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')
    expect(call.patches).toEqual(removeStepPatch('c1', 's2'))
  })

  // SDD ledger Parked C ruling: deleting a chapter's LAST step must remove
  // the whole chapter (removeChapterPatch), not just the step
  // (removeStepPatch) — chapter.steps is schema min(1). c2 (fixtureChapters)
  // has exactly one step, s3.
  test("deleting a chapter's LAST step emits removeChapterPatch instead, after a confirm that warns about it", () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    openStepMenu('c2', 's3')
    fireEvent.click(screen.getByTestId('filmstrip-delete-c2-s3'))

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Advanced')
    expect(dialog.textContent).toContain('also delete the chapter')
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('filmstrip-confirm-confirm'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')
    expect(call.patches).toEqual(removeChapterPatch('c2'))
  })

  test("moving a step that is NOT its chapter's last runs immediately (no confirm) and emits moveStepPatch only", () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    // s2 is c1's second (non-last) step; move it to c2.
    openStepMenu('c1', 's2')
    openMoveToChapterSubmenu()
    fireEvent.click(screen.getByTestId('filmstrip-move-to-c2-c1-s2'))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')
    // The moved step's own record is re-derived from `chapters` at emit
    // time (`CanvasInput.tsx`'s `findStep`) — the exact fixture object c1's
    // s2, not a hand-built stand-in, grounds this the same way
    // `patches.test.ts` grounds its own `moveStepPatch` assertions. Routed
    // through `isRecord` (rather than a fixture-typed variable) so it
    // structurally satisfies `moveStepPatch`'s `Record<string, unknown>`
    // parameter without an `as` cast — `FixtureStep`'s named interface type
    // has no index signature TS will accept there directly.
    const movedStepValue: unknown = fixtureChapters[0].steps[1]
    if (!isRecord(movedStepValue)) throw new Error('expected a record')
    expect(call.patches).toEqual(moveStepPatch('c1', 's2', movedStepValue, 'c2', null))
  })

  // SDD ledger Parked C ruling: moving a chapter's LAST step away must also
  // remove the now-empty source chapter, appended after the move patches —
  // and the confirm dialog must warn about it before either runs.
  test("moving a chapter's LAST step requires confirmation and appends removeChapterPatch for the now-empty source", () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    // s3 is c2's only step; move it to c1.
    openStepMenu('c2', 's3')
    openMoveToChapterSubmenu()
    fireEvent.click(screen.getByTestId('filmstrip-move-to-c1-c2-s3'))

    expect(onChange).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Advanced')
    expect(dialog.textContent).toContain('also be deleted')

    fireEvent.click(screen.getByTestId('filmstrip-confirm-confirm'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')
    const movedStepValue: unknown = fixtureChapters[1].steps[0]
    if (!isRecord(movedStepValue)) throw new Error('expected a record')
    expect(call.patches).toEqual([
      ...moveStepPatch('c2', 's3', movedStepValue, 'c1', null),
      ...removeChapterPatch('c2'),
    ])
  })

  test('the add-step button appends a new step scaffold via a setIfMissing+insert patch pair', () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    fireEvent.click(screen.getByTestId('filmstrip-add-step-c2'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')
    expect(call.patches).toHaveLength(2)
    expect(call.patches[0]).toEqual(setIfMissing([], [{_key: 'c2'}, 'steps']))

    const insertPatch = call.patches[1]
    if (!isInsertPatch(insertPatch)) throw new Error('expected an insert patch')
    expect(insertPatch.position).toBe('after')
    expect(insertPatch.path).toEqual([{_key: 'c2'}, 'steps', -1])
    expect(insertPatch.items).toHaveLength(1)

    const newStep = insertPatch.items[0]
    if (!isRecord(newStep)) throw new Error('expected a record')
    expect(newStep._type).toBe('guidedTourStep')
    expect(newStep.elements).toEqual([])
    const newKey = newStep._key
    if (typeof newKey !== 'string') throw new Error('expected a string _key')
    expect(newKey.length).toBeGreaterThan(0)
  })

  test('the add-chapter button inserts a new chapter scaffold after the clicked chapter', () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    fireEvent.click(screen.getByTestId('filmstrip-add-chapter-c1'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')
    expect(call.patches).toHaveLength(1)

    const insertPatch = call.patches[0]
    if (!isInsertPatch(insertPatch)) throw new Error('expected an insert patch')
    const newChapter = insertPatch.items[0]
    if (!isRecord(newChapter)) throw new Error('expected a record')
    expect(newChapter).toMatchObject({
      _type: 'guidedTourChapter',
      title: 'New chapter',
      steps: [],
    })
    expect(typeof newChapter._key).toBe('string')
    // The wrapping shape (position 'after', anchored at c1) matches
    // `patches.ts`'s own `insertChapterPatch` builder exactly, given the
    // same (real, randomly-keyed) chapter this handler just produced.
    expect(call.patches).toEqual(insertChapterPatch(newChapter, 'c1'))
  })

  test('the Move down menu item emits a reorder patch via onReorderStep', () => {
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithTheme(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
    )

    openStepMenu('c1', 's1')
    fireEvent.click(screen.getByTestId('filmstrip-move-down-c1-s1'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')
    // `CanvasInput.tsx`'s own `onReorderStep` re-derives the chapter's
    // current `steps` from its own `chapters` value (`stepsOf(findChapter(...))`)
    // rather than trusting anything passed up from `Filmstrip` — asserting
    // against `reorderStepPatch` called with that same fixture slice pins
    // that re-derivation, not just the target index.
    const rawSteps: unknown[] = fixtureChapters[0].steps
    expect(call.patches).toEqual(reorderStepPatch('c1', rawSteps.filter(isRecord), 's1', 1))
  })
})

// SourceContext technique established by M9 QA hardening's `useUploader.test.tsx`
// (see that file's own doc comment for the full mechanism/rejected-
// alternatives trail): a minimal `{getClient}` stand-in through `sanity`'s
// own public `SourceContext` singleton gives `useUploader()` a real,
// working uploader inside this bare `ThemeProvider`/`LayerProvider` smoke
// harness — the only way to reach `CanvasInput.tsx`'s `handleUploadBatch`
// (Filmstrip's upload UI is hidden entirely while `uploader === null`,
// true of every OTHER test in this file).
describe('CanvasInput: bulk upload -> handleUploadBatch (Task 8 seam)', () => {
  function renderWithSource(
    ui: ReactNode,
    fakeClient: {assets: {upload: (assetType: string, file: File) => Promise<{_id: string}>}},
  ) {
    // `any`, not a cast off the real (huge) `Source` type — oxlint's
    // `typescript/no-unsafe-type-assertion` rejects a narrowing `as`
    // outright, and this repo's own "no `as` casts" constraint agrees; see
    // `useUploader.test.tsx`'s doc comment for the full rationale. Only the
    // slice `useClient()` actually reads (`getClient`) is implemented.
    const fakeSource: any = {getClient: () => fakeClient}
    return render(
      <ThemeProvider theme={theme}>
        <LayerProvider>
          {/* oxlint-disable-next-line react/jsx-no-constructed-context-values -- `fakeSource` is a stable per-call const, not a re-render-perf concern (same as `useUploader.test.tsx`'s identical case). */}
          <SourceContext.Provider value={fakeSource}>{ui}</SourceContext.Provider>
        </LayerProvider>
      </ThemeProvider>,
    )
  }

  test('a successful upload emits one insertStepsPatch scaffolding a step per uploaded asset, then a success toast (no ToastProvider here, so it silently no-ops)', async () => {
    const fakeClient = {
      assets: {
        upload: async (_assetType: string, file: File) => ({_id: `image-${file.name}`}),
      },
    }
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithSource(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
      fakeClient,
    )

    fireEvent.change(screen.getByTestId('filmstrip-upload-input-c2'), {
      target: {files: [new File(['bytes'], 'shot.png', {type: 'image/png'})]},
    })
    // Settles the microtask-driven upload chain (`runUpload`'s `await
    // uploader(file)` then `props.onUploadBatch(...)`) fired from outside
    // any `fireEvent`-provided `act()` scope — the same empty-callback
    // `act(async () => {})` idiom `test/react/leadForm.test.tsx`'s `flush()`
    // documents in full, then plain synchronous assertions (repo
    // convention: never `waitFor`-for-removal).
    await act(async () => {})

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0][0]
    if (!isPatchEvent(call)) throw new Error('expected a PatchEvent')
    expect(call.patches).toHaveLength(2)
    expect(call.patches[0]).toEqual(setIfMissing([], [{_key: 'c2'}, 'steps']))

    const insertPatch = call.patches[1]
    if (!isInsertPatch(insertPatch)) throw new Error('expected an insert patch')
    expect(insertPatch.items).toHaveLength(1)
    expect(insertPatch.items[0]).toMatchObject({
      _type: 'guidedTourStep',
      screenshot: {_type: 'image', asset: {_type: 'reference', _ref: 'image-shot.png'}},
      elements: [],
    })
  })

  test('an all-failed upload emits NO patch at all — only the toast summary', async () => {
    const fakeClient = {
      assets: {
        upload: async (): Promise<{_id: string}> => {
          throw new Error('upload failed')
        },
      },
    }
    const onChange = mock((_patch: FormPatch | FormPatch[] | PatchEvent) => {})
    renderWithSource(
      <CanvasInput {...baseInputProps()} onChange={onChange} value={fixtureChapters} />,
      fakeClient,
    )

    fireEvent.change(screen.getByTestId('filmstrip-upload-input-c1'), {
      target: {files: [new File(['bytes'], 'shot.png', {type: 'image/png'})]},
    })
    await act(async () => {})

    expect(onChange).not.toHaveBeenCalled()
  })
})

// Master plan Task 7: the Inspector pane, driven by a real (fixture)
// `props.members` tree via `buildMembers` above. `Inspector.tsx`'s module
// comment records the chosen mechanism in full: `onItemOpen(node.path)`
// hands editing off to Sanity's own real item dialog rather than rendering
// the located member inline, so "delegation occurs" is asserted here as
// "the located FormNode's own `.path` is handed to the platform's real
// item-open entry point" — the loose, presence-plus-delegation shape the
// plan's Task 7 test note asks for, adapted to this component's actual
// mechanism.
describe('Inspector (Task 7): member drilling + delegation to the platform', () => {
  test('selecting an element renders its summary from the member tree; Edit fields delegates via onItemOpen at the drilled path', () => {
    const onItemOpen = mock((_path: unknown) => {})
    renderWithTheme(
      <CanvasInput
        {...baseInputProps()}
        members={buildMembers(fixtureChapters)}
        onItemOpen={onItemOpen}
        value={fixtureChapters}
      />,
    )

    // Step s1 (chapter c1, selected by default) has no element selected
    // yet — the inspector shows the step pane.
    expect(screen.getByTestId('inspector-step')).toBeTruthy()

    fireEvent.pointerDown(screen.getByTestId('canvas-element-e1'), {pointerId: 1})

    expect(screen.getByTestId('inspector-element')).toBeTruthy()
    expect(screen.getByTestId('inspector-element-label').textContent).toContain('Hotspot')
    expect(onItemOpen).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('inspector-edit-element'))

    expect(onItemOpen).toHaveBeenCalledTimes(1)
    expect(onItemOpen.mock.calls[0][0]).toEqual([
      {_key: 'c1'},
      'steps',
      {_key: 's1'},
      'elements',
      {_key: 'e1'},
    ])
  })

  test('no element selected renders the step summary from the member tree; Edit step fields delegates via onItemOpen at the step path', () => {
    const onItemOpen = mock((_path: unknown) => {})
    renderWithTheme(
      <CanvasInput
        {...baseInputProps()}
        members={buildMembers(fixtureChapters)}
        onItemOpen={onItemOpen}
        value={fixtureChapters}
      />,
    )

    expect(screen.getByTestId('inspector-step-title').textContent).toContain('Welcome')

    fireEvent.click(screen.getByTestId('inspector-edit-step'))

    expect(onItemOpen).toHaveBeenCalledTimes(1)
    expect(onItemOpen.mock.calls[0][0]).toEqual([{_key: 'c1'}, 'steps', {_key: 's1'}])
  })

  // SDD ledger follow-up bound to this task: an orphaned elementKey — the
  // selection points at a key that doesn't resolve to a member (a pending
  // insert `props.members` hasn't caught up with yet, or a genuinely stale
  // key) — must degrade to the neutral state, not a broken pane. Modeled
  // here by building `members` from a chapters value with s1's elements
  // deliberately stripped, while `value` (what `Canvas.tsx` renders the
  // selectable chips from) still carries them — the exact "members lags
  // behind value" shape a pending insert produces.
  test('an orphaned elementKey (selected but absent from the member tree) renders the neutral state, not a broken pane', () => {
    const chaptersWithoutElementMembers = fixtureChapters.map((chapterFixture) =>
      chapterFixture._key === 'c1'
        ? {
            ...chapterFixture,
            steps: chapterFixture.steps.map((stepFixture) =>
              stepFixture._key === 's1' ? {...stepFixture, elements: []} : stepFixture,
            ),
          }
        : chapterFixture,
    )
    renderWithTheme(
      <CanvasInput
        {...baseInputProps()}
        members={buildMembers(chaptersWithoutElementMembers)}
        value={fixtureChapters}
      />,
    )

    // The chip still renders (Canvas.tsx reads `value`, not `members`), so
    // it can still be selected — this is exactly the pending-insert window
    // the neutral state exists for.
    fireEvent.pointerDown(screen.getByTestId('canvas-element-e1'), {pointerId: 1})

    expect(screen.getByTestId('inspector-syncing')).toBeTruthy()
    expect(screen.queryByTestId('inspector-element')).toBeNull()
  })

  test('a selection pointing at a chapter/step absent from the member tree also renders the neutral state', () => {
    renderWithTheme(<CanvasInput {...baseInputProps()} members={[]} value={fixtureChapters} />)

    // Step s1 is selected by default (useEditorState's initial selection,
    // read off `value`), but the empty `members` fixture never resolves it.
    expect(screen.getByTestId('inspector-syncing')).toBeTruthy()
  })

  test('nothing selected at all (empty document) renders the neutral "select" state, not "syncing"', () => {
    renderWithTheme(<CanvasInput {...baseInputProps()} />)

    expect(screen.getByTestId('inspector-empty')).toBeTruthy()
    expect(screen.getByText('Select an element to edit its fields.')).toBeTruthy()
  })
})
