#!/usr/bin/env bun
// Drives the capture harness (`build.ts`) with Playwright, pinned to
// `playwright@1.62.1` (`package.json`'s devDependency — SDD ledger's Task 3
// dispatch note: "unpinned playwright version drift" was parked from Task
// 1's PR review specifically for this script to resolve) to produce the 5
// PNGs `seed/images/meta/` ships: `canvas.png`, `upload.png`,
// `filmstrip.png`, `inspector.png`, `preview.png`.
//
// Each state renders the SAME real `CanvasInput`/`GuidedTourPreviewView`
// components (`entry.tsx`) with the same fixture tour (`fixtures.ts`) — what
// makes the five captures different is which of the fixture's own,
// already-present elements this script selects/toggles before
// screenshotting, entirely through LOCAL component state (a filmstrip step,
// a canvas element, a tool button, the device toggle — see `entry.tsx`'s
// module comment for why no capture needs a working `onChange`).
//
// `?state=` -> capture mapping (chosen, not a 1:1 name echo — see
// `seed/builders.ts`'s `buildMetaTourDocument` doc comment for the fuller
// narrative each one serves):
//   canvas    -> the three-pane editor, opened full-screen, first step
//                selected (already has a hotspot + tooltip)
//   upload    -> the same editor, chapter one's bulk-upload drop zone
//                highlighted via a synthetic `dragover`
//   filmstrip -> the Hotspot tool active and an existing hotspot selected
//                on the canvas (click-to-place + nudge/drag)
//   inspector -> a tooltip element selected (Inspector showing its fields)
//                with the device toggle switched to mobile
//   preview   -> `GuidedTourPreviewView`, no editor chrome at all
import {mkdir, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {chromium, type Browser, type Page} from 'playwright'

import {buildAndServe} from './build'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, '..', '..', 'seed', 'images', 'meta')
const VIEWPORT = {width: 1280, height: 800}

/** Waits for every currently-present `<img>` to finish loading (or fail) — screenshotting before a CDN thumbnail has painted would capture a blank/broken image instead of the real thing. */
async function waitForImages(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const images = Array.from(document.querySelectorAll('img'))
    return images.every((img) => img.complete)
  })
}

async function openFullEditor(page: Page): Promise<void> {
  await page.getByTestId('open-full-editor').click()
  await page.waitForSelector('[data-testid="canvas-surface"]')
  await waitForImages(page)
}

/**
 * Dispatches a synthetic `dragover` carrying a `Files`-typed `DataTransfer`
 * at the given chapter's drop zone — `Filmstrip.tsx`'s
 * `handleChapterDragOver` only highlights the zone (its `isDragOver` prop)
 * for a drag whose `dataTransfer.types` includes `'Files'`, which Playwright
 * has no built-in helper for (its own `dragTo` simulates in-page element
 * drags, not an OS file drag). Best-effort: wrapped by the caller so a
 * browser that rejects constructing `DataTransfer`/`File` this way still
 * leaves `upload.png` showing the (unhighlighted, still real) drop zone and
 * upload button rather than failing the whole capture run.
 */
async function simulateFileDragOver(page: Page, testId: string): Promise<void> {
  await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`)
    if (!el) return
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File(['x'], 'shot.png', {type: 'image/png'}))
    el.dispatchEvent(new DragEvent('dragover', {bubbles: true, cancelable: true, dataTransfer}))
  }, testId)
}

interface CaptureState {
  file: string
  run: (page: Page) => Promise<void>
}

const STATES: CaptureState[] = [
  {
    file: 'canvas.png',
    async run(page) {
      await openFullEditor(page)
    },
  },
  {
    file: 'upload.png',
    async run(page) {
      await openFullEditor(page)
      try {
        await simulateFileDragOver(page, 'filmstrip-dropzone-c1')
      } catch (error) {
        console.error('upload.png: drag-over simulation failed, capturing unhighlighted', error)
      }
    },
  },
  {
    file: 'filmstrip.png',
    async run(page) {
      await openFullEditor(page)
      await page.getByTestId('filmstrip-step-c2-s3').click()
      await page.getByTestId('canvas-tool-hotspot').click()
      await page.getByTestId('canvas-element-h2').click()
    },
  },
  {
    file: 'inspector.png',
    async run(page) {
      await openFullEditor(page)
      await page.getByTestId('filmstrip-step-c1-s1').click()
      await page.getByTestId('canvas-element-t1').click()
      await page.getByTestId('device-mobile').click()
    },
  },
  {
    file: 'preview.png',
    async run(page) {
      await page.waitForSelector('[data-capture-ready="preview"]')
      await waitForImages(page)
    },
  },
]

/** One state's whole page lifecycle: navigate, drive its `run` interactions, screenshot, close. Pulled out of `main`'s loop so that loop needs only ONE `await` per iteration — this file's own module comment already explains why the 5 states run sequentially, not in parallel (deterministic console output, the same convention `seed/seed.ts`'s upload loop uses). */
async function captureState(browser: Browser, baseUrl: string, state: CaptureState): Promise<void> {
  const page = await browser.newPage({viewport: VIEWPORT})
  const queryState = state.file.replace(/\.png$/, '')
  await page.goto(`${baseUrl}/?state=${queryState}`)
  await page.waitForSelector('[data-capture-ready]')
  await state.run(page)

  const outPath = join(OUT_DIR, state.file)
  const buffer = await page.screenshot()
  await writeFile(outPath, buffer)
  console.error(`wrote ${outPath} (${buffer.length} bytes)`)
  await page.close()
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, {recursive: true})
  const harness = await buildAndServe()
  const browser = await chromium.launch()

  try {
    for (const state of STATES) {
      // Sequential, not Promise.all: keeps capture order deterministic and
      // console output easy to follow (`seed/seed.ts`'s own upload loop
      // makes the identical call for the identical reason).
      // oxlint-disable-next-line no-await-in-loop
      await captureState(browser, harness.url, state)
    }
  } finally {
    await browser.close()
    harness.stop()
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error))
    process.exitCode = 1
  })
}
