// The capture harness's actual page: renders the REAL `CanvasInput`
// (`../../src/studio/CanvasInput`) and `GuidedTourPreviewView`
// (`../../src/studio/PreviewView`) components — the exact same modules the
// published plugin ships — fed a plain in-memory fixture tour
// (`./fixtures.ts`) instead of a live Studio document store. This is the
// "honesty constraint" the task brief calls out: every PNG this harness
// produces is a capture of real plugin UI with fixture data, never a
// mockup, and the meta tour's own description says so.
//
// `?state=` selects which of the five states to render — `canvas.png`
// through `preview.png` in `seed/images/meta/`, produced by `capture.ts`
// navigating here once per state and driving whatever extra clicks that
// state's screenshot needs (opening the full editor, selecting a step,
// toggling device) BEFORE screenshotting. This file itself never simulates
// those clicks — `capture.ts`'s Playwright driver does, the same "harness
// renders, driver interacts" split `build.ts`'s module comment draws
// between bundling/serving and browser automation.
//
// Every mutation-driving prop here (`onChange`, `onItemOpen`) is a
// deliberate no-op: `CanvasInput` is a CONTROLLED component (`value` is
// this fixture's plain array, never patched back in), and every capture
// state is reachable through PURELY LOCAL component state — which tool is
// active, which step/element is selected, which device is toggled — none of
// which round-trips through `onChange`
// (`src/studio/useEditorState.ts`/`Canvas.tsx`'s own `useState` calls own
// all of it). A capture that needs an element to already exist gets it from
// the fixture directly instead of simulating the click that would insert
// it — see `fixtures.ts`'s `fixtureChapters` for exactly which elements
// each capture state relies on already being present.
import {LayerProvider, ThemeProvider, ToastProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import type {ReactNode} from 'react'
import {createRoot} from 'react-dom/client'

import {CanvasInput} from '../../src/studio/CanvasInput'
import {GuidedTourPreviewView} from '../../src/studio/PreviewView'
import {canvasInputProps, demoAssetRefs, fixtureChapters, previewFixtureDocument} from './fixtures'

const theme = buildTheme()

function Shell({children}: {children: ReactNode}): ReactNode {
  return (
    <ThemeProvider theme={theme}>
      <LayerProvider>
        <ToastProvider>{children}</ToastProvider>
      </LayerProvider>
    </ThemeProvider>
  )
}

/** `canvas`/`upload`/`filmstrip`/`inspector` all render the same three-pane editor — `capture.ts` tells the four apart entirely through which elements it clicks before screenshotting, not through anything rendered differently here. */
function CanvasCapture(): ReactNode {
  const chapters = fixtureChapters(demoAssetRefs())
  return (
    <div
      data-capture-ready="canvas"
      style={{background: '#f3f4f6', minHeight: '100vh', padding: 24}}
    >
      <CanvasInput {...canvasInputProps(chapters)} />
    </div>
  )
}

function PreviewCapture(): ReactNode {
  const document = previewFixtureDocument(demoAssetRefs())
  return (
    <div data-capture-ready="preview" style={{height: '100vh'}}>
      <GuidedTourPreviewView
        document={{draft: null, displayed: document, historical: null, published: null}}
        documentId="preview-fixture"
        options={{}}
        schemaType={{name: 'guidedTour', jsonType: 'object', fields: []}}
      />
    </div>
  )
}

function readState(): string {
  return new URLSearchParams(window.location.search).get('state') ?? 'canvas'
}

function App(): ReactNode {
  const state = readState()
  return <Shell>{state === 'preview' ? <PreviewCapture /> : <CanvasCapture />}</Shell>
}

const root = document.getElementById('root')
if (root) createRoot(root).render(<App />)
