import {afterEach, describe, expect, test} from 'bun:test'

// Smoke tests for `GuidedTourPreviewView` (master plan Task 8). Like
// `smoke.test.tsx`'s `CanvasInput` renders, these wrap fixtures in nothing
// more than `@sanity/ui`'s `ThemeProvider`/`LayerProvider` — no
// `WorkspaceProvider` ancestor, so `useProjectDataset()` (called inside this
// component) returns nulls and every step is dropped for lacking a
// resolvable screenshot URL (`draftToTour.ts`'s module comment, point 3).
// That's exactly the "neutral without projectId" case this suite is
// documented to exercise; `draftToTour.test.ts` already covers the mapper's
// full behavior (including the WITH-projectId/dataset resolved-image path)
// directly, with no Studio-context rendering involved.
import {LayerProvider, ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {cleanup, render, screen} from '@testing-library/react'
import type {ReactNode} from 'react'

import {GuidedTourPreviewView} from '../../src/studio/PreviewView'

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

function image(ref: string, alt?: string): Record<string, unknown> {
  const base: Record<string, unknown> = {_type: 'image', asset: {_type: 'reference', _ref: ref}}
  if (alt !== undefined) base.alt = alt
  return base
}

function fixtureDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _id: 'tour-1',
    _type: 'guidedTour',
    title: 'My tour',
    slug: {current: 'my-tour'},
    chapters: [
      {
        _type: 'guidedTourChapter',
        _key: 'c1',
        title: 'Chapter one',
        steps: [
          {
            _type: 'guidedTourStep',
            _key: 's1',
            screenshot: image('image-aaa-800x600-png', 'Alt text'),
            elements: [],
          },
        ],
      },
    ],
    ...overrides,
  }
}

// `UserViewComponent`'s declared prop type (`sanity/structure`) requires
// `documentId`/`options`/`schemaType` too — this component only ever reads
// `props.document.displayed`, but the fixture fills in the rest so it
// satisfies the real type, the same "fixture matches the platform's full
// contract" convention `smoke.test.tsx`'s `baseInputProps()` establishes.
// `displayed` is typed as a plain record — never `undefined` — matching
// `UserViewComponent`'s own real contract: the Studio document pane always
// hands this view at least an empty object, never `undefined` (a doc with
// no data yet is `{}`, not a missing `displayed`). The `undefined`/
// non-record-document case IS still a real defensive concern for
// `draftToTour` itself (a fixture or an exotic caller could hand it
// anything) — that's exercised directly, with no component/prop-type
// involved, by `draftToTour.test.ts`'s "a non-record document" case.
function baseProps(displayed: Record<string, unknown>) {
  return {
    document: {draft: null, displayed, historical: null, published: null},
    documentId: 'tour-1',
    options: {},
    schemaType: {name: 'guidedTour', jsonType: 'object' as const, fields: []},
  }
}

describe('GuidedTourPreviewView: no WorkspaceProvider ancestor', () => {
  test('renders the "no context" notice and an empty-tour view (every step dropped, no URL to resolve)', () => {
    renderWithTheme(<GuidedTourPreviewView {...baseProps(fixtureDoc())} />)

    expect(screen.getByTestId('preview-no-context')).toBeTruthy()
    expect(screen.queryByTestId('preview-dropped-steps')).toBeNull()
    // GuidedTour's own empty-tour branch (src/react/GuidedTour.tsx) renders
    // the title in a `.gt-empty` div once `flat.length === 0` — true here
    // since draftToTour dropped the fixture's only step.
    expect(document.querySelector('.gt-empty')?.textContent).toBe('My tour')
  })

  test('does not throw on a document with no chapters at all', () => {
    renderWithTheme(
      <GuidedTourPreviewView {...baseProps({_id: 'x', title: 'Untitled', slug: {current: 'x'}})} />,
    )

    expect(screen.getByTestId('preview-no-context')).toBeTruthy()
  })
})
