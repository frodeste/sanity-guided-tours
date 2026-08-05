import {afterEach, describe, expect, test} from 'bun:test'

// Direct render tests for `Canvas` (as opposed to `smoke.test.tsx`, which
// only ever exercises it through `CanvasInput` — and, since none of those
// renders have a `WorkspaceProvider` ancestor, `projectId`/`dataset` are
// always null there and every screenshot renders via the placeholder-text
// branch). This file supplies `projectId`/`dataset` directly as props (the
// documented design: `Canvas` never calls `useProjectDataset()` itself — see
// `Canvas.tsx`'s module comment) to exercise the other branch: a real
// `assetRefToUrl`-resolved `<img src>`.
import {LayerProvider, ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {cleanup, render, screen} from '@testing-library/react'
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
})
