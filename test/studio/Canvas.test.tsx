// Direct render tests for `Canvas` (as opposed to `smoke.test.tsx`, which
// only ever exercises it through `CanvasInput` — and, since none of those
// renders have a `WorkspaceProvider` ancestor, `projectId`/`dataset` are
// always null there and every screenshot renders via the placeholder-text
// branch). This file supplies `projectId`/`dataset` directly as props (the
// documented design: `Canvas` never calls `useProjectDataset()` itself — see
// `Canvas.tsx`'s module comment) to exercise the other branch: a real
// `assetRefToUrl`-resolved `<img src>`.
import {afterEach, describe, expect, mock, test} from 'bun:test'

import {LayerProvider, ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import type {ReactNode} from 'react'

import {Canvas, type CanvasProps} from '../../src/studio/Canvas'

afterEach(() => {
  cleanup()
})

const theme = buildTheme()

function renderWithTheme(ui: ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <LayerProvider>{ui}</LayerProvider>
    </ThemeProvider>,
  )
}

function baseProps(overrides: Partial<CanvasProps> = {}): CanvasProps {
  return {
    dataset: null,
    device: 'desktop',
    onInsertElement: () => {},
    onMoveElement: () => {},
    onRemoveElement: () => {},
    onResizeElement: () => {},
    onSelectElement: () => {},
    projectId: null,
    selectedElementKey: null,
    step: null,
    ...overrides,
  }
}

describe('Canvas', () => {
  test('renders a real <img> with a CDN URL when projectId/dataset resolve a well-formed ref', () => {
    const step = {
      _key: 's1',
      title: 'Welcome',
      screenshot: {
        _type: 'image',
        asset: {_type: 'reference', _ref: 'image-abc123-800x600-png'},
        alt: 'Welcome screenshot',
      },
      elements: [],
    }

    renderWithTheme(<Canvas {...baseProps({dataset: 'production', projectId: 'proj123', step})} />)

    expect(screen.queryByTestId('canvas-screenshot-placeholder')).toBeNull()
    const img = screen.getByTestId('canvas-screenshot')
    expect(img.getAttribute('src')).toBe(
      'https://cdn.sanity.io/images/proj123/production/abc123-800x600.png',
    )
    expect(img.getAttribute('alt')).toBe('Welcome screenshot')
  })

  test('falls back to the placeholder when projectId/dataset are null (no WorkspaceProvider)', () => {
    const step = {
      _key: 's1',
      title: 'Welcome',
      screenshot: {_type: 'image', asset: {_type: 'reference', _ref: 'image-abc123-800x600-png'}},
      elements: [],
    }

    renderWithTheme(<Canvas {...baseProps({step})} />)

    expect(screen.queryByTestId('canvas-screenshot')).toBeNull()
    expect(screen.getByTestId('canvas-screenshot-placeholder').textContent).toContain(
      'image-abc123-800x600-png',
    )
  })

  test('falls back to the placeholder when the ref is malformed, even with projectId/dataset set', () => {
    const step = {
      _key: 's1',
      title: 'Welcome',
      screenshot: {_type: 'image', asset: {_type: 'reference', _ref: 'not-a-real-ref'}},
      elements: [],
    }

    renderWithTheme(<Canvas {...baseProps({dataset: 'production', projectId: 'proj123', step})} />)

    expect(screen.queryByTestId('canvas-screenshot')).toBeNull()
    expect(screen.getByTestId('canvas-screenshot-placeholder').textContent).toContain(
      'not-a-real-ref',
    )
  })

  test('shows "no screenshot yet" when the step has no screenshot field at all (as opposed to a malformed ref)', () => {
    const step = {_key: 's1', title: 'Welcome', elements: []}

    renderWithTheme(
      <Canvas {...baseProps({dataset: 'production', projectId: 'proj123', step})} />,
    )

    expect(screen.queryByTestId('canvas-screenshot')).toBeNull()
    expect(screen.queryByTestId('canvas-screenshot-placeholder')).toBeNull()
    expect(screen.getByText('This step has no screenshot yet.')).toBeTruthy()
  })
})

// M11 Task 3: video steps keep the screenshot as the positioning backdrop
// (module comment) — a small "Video" badge is the only visible change on
// the stage. These cover presence/absence and the "must not intercept
// pointer events" constraint the plan calls out explicitly.
describe('Canvas: video badge', () => {
  function stepWithScreenshot(overrides: Record<string, unknown> = {}) {
    return {
      _key: 's1',
      title: 'Welcome',
      screenshot: {
        _type: 'image',
        asset: {_type: 'reference', _ref: 'image-abc123-800x600-png'},
        alt: 'Welcome screenshot',
      },
      elements: [],
      ...overrides,
    }
  }

  test('renders the "Video" badge when the selected step carries a video object', () => {
    const step = stepWithScreenshot({video: {source: 'url', url: 'https://example.com/a.mp4'}})
    renderWithTheme(<Canvas {...baseProps({dataset: 'production', projectId: 'proj123', step})} />)

    expect(screen.getByTestId('canvas-video-badge').textContent).toBe('Video')
  })

  test('does not render the badge when the step has no video field', () => {
    const step = stepWithScreenshot()
    renderWithTheme(<Canvas {...baseProps({dataset: 'production', projectId: 'proj123', step})} />)

    expect(screen.queryByTestId('canvas-video-badge')).toBeNull()
  })

  test('does not render the badge when there is no step selected at all', () => {
    renderWithTheme(<Canvas {...baseProps({dataset: 'production', projectId: 'proj123'})} />)

    expect(screen.queryByTestId('canvas-video-badge')).toBeNull()
  })

  test('the badge is styled non-interactive (pointerEvents none) and never blocks the click-to-place surface beneath it', () => {
    const onInsertElement = mock((_element: {_type: string; _key: string}) => {})
    const step = stepWithScreenshot({video: {source: 'file', file: {asset: {_ref: 'file-abc-mp4'}}}})
    renderWithTheme(
      <Canvas
        {...baseProps({dataset: 'production', projectId: 'proj123', step, onInsertElement})}
      />,
    )

    const badge = screen.getByTestId('canvas-video-badge')
    expect(badge.style.pointerEvents).toBe('none')

    // The badge never calls stopPropagation, so a click that lands on it
    // still bubbles to the surface's click-to-place handler — proving it
    // doesn't swallow interaction even in an environment (like this test's
    // happy-dom renderer) that doesn't perform real CSS hit-testing.
    fireEvent.click(screen.getByTestId('canvas-tool-hotspot'))
    fireEvent.click(badge)
    expect(onInsertElement).toHaveBeenCalledTimes(1)
  })
})

// Element chip interaction: drag and keyboard nudge. `smoke.test.tsx`
// already covers ArrowRight/ArrowDown nudges and a full resize gesture
// (through `CanvasInput`); these cover the remaining gap — a drag gesture
// (Canvas.tsx's `handleDragMove`/`handleDragEnd`, CanvasElement.tsx's
// `handlePointerMove`/`handlePointerUp` while `dragging`) and the
// ArrowUp/ArrowLeft nudge cases — at the `Canvas` level directly, same
// rationale this file's own module comment gives for testing `Canvas`
// standalone rather than only through `CanvasInput`.
describe('Canvas: element chip drag and keyboard nudge', () => {
  function stepWithHotspot(x: number, y: number) {
    return {
      _key: 's1',
      screenshot: {
        _type: 'image',
        asset: {_type: 'reference', _ref: 'image-abc123-800x600-png'},
        alt: 'Welcome screenshot',
      },
      elements: [{_type: 'guidedTourHotspot', _key: 'e1', x, y, action: 'advance', pulse: true}],
    }
  }

  test('dragging a chip live-updates its rendered position, then reports the final drop via onMoveElement and reverts (this bare harness never feeds a new value back in)', () => {
    const onMoveElement = mock((_elementKey: string, _pos: {x: number; y: number}) => {})
    renderWithTheme(
      <Canvas
        {...baseProps({
          dataset: 'production',
          projectId: 'proj123',
          step: stepWithHotspot(10, 10),
          onMoveElement,
        })}
      />,
    )

    const chip = screen.getByTestId('canvas-element-e1')
    expect(chip.style.left).toBe('10%')

    fireEvent.pointerDown(chip, {pointerId: 1, clientX: 10, clientY: 10})
    // happy-dom's `getBoundingClientRect()` always returns an all-zero rect
    // (no real layout engine — same caveat `smoke.test.tsx`'s click-to-place
    // tests document), so `pointToPercent`'s documented zero-width/height
    // fallback places every drag position at (0, 0) regardless of
    // clientX/clientY: the point under test is that a live drag re-renders
    // the chip at the reported position at all, not the exact coordinate.
    fireEvent.pointerMove(chip, {pointerId: 1, clientX: 50, clientY: 50})
    expect(chip.style.left).toBe('0%')
    expect(chip.style.top).toBe('0%')

    fireEvent.pointerUp(chip, {pointerId: 1, clientX: 50, clientY: 50})
    expect(onMoveElement).toHaveBeenCalledTimes(1)
    expect(onMoveElement).toHaveBeenCalledWith('e1', {x: 0, y: 0})
    // The drag-live `dragPosition` state clears on drop, so the chip
    // reverts to its prop-derived position — this bare harness's `step` is
    // a static fixture, not fed a new value from `onMoveElement` the way a
    // real form-builder round-trip would.
    expect(chip.style.left).toBe('10%')
  })

  test('ArrowUp/ArrowLeft nudge the selected element up/left by the small (0.5%) step', () => {
    const onMoveElement = mock((_elementKey: string, _pos: {x: number; y: number}) => {})
    renderWithTheme(
      <Canvas
        {...baseProps({
          dataset: 'production',
          projectId: 'proj123',
          step: stepWithHotspot(50, 50),
          selectedElementKey: 'e1',
          onMoveElement,
        })}
      />,
    )

    const chip = screen.getByTestId('canvas-element-e1')
    fireEvent.keyDown(chip, {key: 'ArrowUp'})
    expect(onMoveElement).toHaveBeenCalledWith('e1', {x: 50, y: 49.5})

    fireEvent.keyDown(chip, {key: 'ArrowLeft'})
    expect(onMoveElement).toHaveBeenCalledWith('e1', {x: 49.5, y: 50})

    expect(onMoveElement).toHaveBeenCalledTimes(2)
  })

  test('clicking an existing chip does not also trigger the surface\'s click-to-place handler', () => {
    // CanvasElement.tsx's own doc comment: the chip's `onClick` stops the
    // click from also reaching `Canvas.tsx`'s click-to-place surface
    // handler — "selecting/dragging an existing element must never also
    // insert a new one under the cursor."
    const onInsertElement = mock((_element: {_type: string; _key: string}) => {})
    renderWithTheme(
      <Canvas
        {...baseProps({
          dataset: 'production',
          projectId: 'proj123',
          step: stepWithHotspot(50, 50),
          onInsertElement,
        })}
      />,
    )

    fireEvent.click(screen.getByTestId('canvas-tool-hotspot'))
    fireEvent.click(screen.getByTestId('canvas-element-e1'))

    expect(onInsertElement).not.toHaveBeenCalled()
  })
})
