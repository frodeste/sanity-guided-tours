import {afterEach, describe, expect, test} from 'bun:test'

// Render smoke tests for `CanvasInput` (master plan Task 4). Per the
// brief's Studio-test caveat, the first fallback tried was wrapping
// fixtures in `@sanity/ui`'s `ThemeProvider`/`studioTheme` — that alone
// wasn't enough (`@sanity/ui`'s `Dialog` also needs a `LayerProvider`
// ancestor, or its internal `useLayer()` throws "missing context value";
// everything else — `Card`/`Box`/`Button`/etc — only needed the theme).
// With that wrap, no `sanity` mocking was ever required: `CanvasInput.tsx`
// makes zero *runtime* imports from `sanity` (only the
// `ArrayOfObjectsInputProps` type, erased at compile time — see its module
// doc comment), so there was nothing for the form-builder's own context
// providers to explode on. The fixture below still has to satisfy the
// *type* `ArrayOfObjectsInputProps` in full, though — `CanvasInput` calls
// `props.renderDefault(props)` for the "Plain editor" escape hatch, and
// `renderDefault`'s declared signature takes the complete `InputProps`,
// so the props object handed to the component has to be a fully valid one
// (`baseInputProps()` below), not a hand-picked subset. Per-test, only
// `value`/`onChange`/`renderDefault` actually vary.
import {LayerProvider, ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react'
import type {ReactNode} from 'react'
import type {ArrayOfObjectsInputProps} from 'sanity'

import {CanvasInput} from '../../src/studio/CanvasInput'

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
}): FixtureStep {
  return {...overrides, elements: []}
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

    const screenshot = screen.getByTestId('canvas-screenshot')
    expect(screenshot.getAttribute('alt')).toBe('Welcome screenshot')
  })

  test('selecting a different step updates the canvas screenshot', () => {
    renderWithTheme(<CanvasInput {...baseInputProps()} value={fixtureChapters} />)

    fireEvent.click(screen.getByTestId('filmstrip-step-c1-s2'))

    const screenshot = screen.getByTestId('canvas-screenshot')
    // Step s2's screenshot has no `alt` of its own, so CanvasPane falls
    // back to the step title — still a distinct, assertable value from
    // step s1's screenshot.
    expect(screenshot.getAttribute('alt')).toBe('Features')
    expect(screenshot.getAttribute('src')).toBe('image-bbb-800x600-png')
  })

  test('the device toggle flips which screenshot is shown', () => {
    renderWithTheme(<CanvasInput {...baseInputProps()} value={fixtureChapters} />)

    fireEvent.click(screen.getByTestId('filmstrip-step-c2-s3'))
    expect(screen.getByTestId('canvas-screenshot').getAttribute('src')).toBe(
      'image-ccc-desktop-800x600-png',
    )

    const desktopToggle = screen.getByTestId('device-desktop')
    const mobileToggle = screen.getByTestId('device-mobile')
    expect(desktopToggle.getAttribute('aria-pressed')).toBe('true')
    expect(mobileToggle.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(mobileToggle)

    expect(mobileToggle.getAttribute('aria-pressed')).toBe('true')
    expect(desktopToggle.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('canvas-screenshot').getAttribute('src')).toBe(
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
