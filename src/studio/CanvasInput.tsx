// The `chapters` field's input component (design spec §7.1, master plan
// Task 4): a three-pane shell (Filmstrip | Canvas | Inspector) plus a
// header toolbar and a full-screen `@sanity/ui` Dialog escape valve. Tasks
// 5-7 replace the pane bodies below with the real Canvas/Filmstrip/
// Inspector components (drag-and-drop placement, chapter grouping, real
// member-input rendering); this task only wires the shell, the shared
// selection/device/expanded state (`useEditorState`), and the "Plain
// editor" fallback that keeps the default Sanity array input reachable
// in-place.
//
// Deliberately zero *runtime* imports from `sanity` — only the
// `ArrayOfObjectsInputProps` type (erased at compile time). Every field
// this component reads off `props.value` is narrowed from `unknown`, the
// same convention `src/schema/guidedTour.ts`'s `stepCountOf` and
// `src/studio/patches.ts`'s `isRecord` use, rather than trusting the
// field's own default generic (`{_key: string}`, since we don't
// parametrize the type with a richer chapter shape — see the doc comment
// on `CanvasInputProps` below for why). That keeps this file's only
// Studio-context dependency `@sanity/ui`, so the smoke tests render it
// with nothing more than a `ThemeProvider`/`LayerProvider` wrap and a
// hand-built `ArrayOfObjectsInputProps` fixture — no mocking of `sanity`
// itself was needed (see test/studio/smoke.test.tsx).
import {Box, Button, Card, Dialog, Flex, Inline, Stack, Text} from '@sanity/ui'
import type {ReactNode} from 'react'
import type {ArrayOfObjectsInputProps} from 'sanity'

import {useEditorState, type EditorSelection} from './useEditorState'

/**
 * The prop type Sanity actually hands `components.input` for an array
 * field: `ArrayOfObjectsInputProps` at its default generic
 * (`{_key: string}` items). We could parametrize it with a richer
 * `{_key: string; title?: string; steps?: ...}` chapter shape for our own
 * convenience, but that generic appears *contravariantly* in several of
 * the interface's own callback fields (`onItemAppend`, `onItemPrepend`,
 * `resolveInitialValue`'s parameter position, etc.) — parametrizing it
 * would make this component's prop type incompatible with the
 * `ComponentType<ArrayOfObjectsInputProps>` the `components: {input}` slot
 * in `defineField` (schema/guidedTour.ts) expects, forcing an `as` cast
 * that oxlint bans. Sticking with the default generic and narrowing values
 * from `unknown` internally (see module doc comment above) is the
 * "ObjectInputProps-compatible typing that tsc passes cleanly" the master
 * plan's Task 4 notes anticipate.
 */
type CanvasInputProps = ArrayOfObjectsInputProps

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function keyOf(value: unknown): string | null {
  return isRecord(value) && typeof value._key === 'string' ? value._key : null
}

function stringField(value: unknown, field: string): string | undefined {
  return isRecord(value) && typeof value[field] === 'string' ? value[field] : undefined
}

function stepsOf(chapter: unknown): unknown[] {
  return isRecord(chapter) && Array.isArray(chapter.steps) ? chapter.steps : []
}

interface FlatStep {
  chapterKey: string
  chapterTitle: string
  stepKey: string
  stepTitle: string
  index: number
}

/** Flattens every chapter's steps into one reading-order list (filmstrip = flat step list, Task 4; chapter grouping arrives in Task 6's real Filmstrip). */
function flattenSteps(chapters: unknown[]): FlatStep[] {
  const flat: FlatStep[] = []
  let index = 0
  for (const chapter of chapters) {
    const chapterKey = keyOf(chapter)
    if (chapterKey === null) continue
    const chapterTitle = stringField(chapter, 'title') ?? 'Chapter'
    for (const step of stepsOf(chapter)) {
      const stepKey = keyOf(step)
      if (stepKey === null) continue
      index += 1
      flat.push({
        chapterKey,
        chapterTitle,
        stepKey,
        stepTitle: stringField(step, 'title') ?? `Step ${index}`,
        index,
      })
    }
  }
  return flat
}

function findStep(chapters: unknown[], chapterKey: string | null, stepKey: string | null): unknown {
  if (chapterKey === null || stepKey === null) return null
  for (const chapter of chapters) {
    if (keyOf(chapter) !== chapterKey) continue
    for (const step of stepsOf(chapter)) {
      if (keyOf(step) === stepKey) return step
    }
  }
  return null
}

/** `screenshotMobile ?? screenshot` when `device` is mobile (design spec §7.2's device-aware fallback), else `screenshot`. */
function screenshotFor(step: unknown, device: 'desktop' | 'mobile'): unknown {
  if (device === 'mobile') {
    const mobile = isRecord(step) ? step.screenshotMobile : undefined
    if (isRecord(mobile)) return mobile
  }
  return isRecord(step) ? step.screenshot : undefined
}

/**
 * The raw asset `_ref` off a Sanity image value (e.g.
 * `image-abc123-800x600-png`) — not a resolved CDN URL. Real URL
 * resolution (`assetRefToUrl`, parsing the ref's id/dimensions/format) is
 * Task 8's job; this placeholder canvas pane only needs *something*
 * per-step and distinguishable to render into `<img src>`, since Tasks 5-7
 * replace this pane's body outright.
 */
function screenshotAssetRef(image: unknown): string | undefined {
  if (!isRecord(image)) return undefined
  const asset = image.asset
  return isRecord(asset) && typeof asset._ref === 'string' ? asset._ref : undefined
}

function FilmstripPane({
  steps,
  selection,
  onSelectStep,
}: {
  steps: FlatStep[]
  selection: EditorSelection
  onSelectStep: (chapterKey: string, stepKey: string) => void
}): ReactNode {
  return (
    <Card borderRight padding={2} style={{minWidth: 220, overflowY: 'auto'}}>
      <Stack gap={1}>
        {steps.length === 0 && (
          <Text muted size={1}>
            No steps yet.
          </Text>
        )}
        {steps.map((step) => {
          const selected =
            step.chapterKey === selection.chapterKey && step.stepKey === selection.stepKey
          return (
            <Card
              key={`${step.chapterKey}-${step.stepKey}`}
              as="button"
              type="button"
              padding={2}
              radius={2}
              tone={selected ? 'primary' : 'default'}
              aria-pressed={selected}
              data-testid={`filmstrip-step-${step.chapterKey}-${step.stepKey}`}
              onClick={() => onSelectStep(step.chapterKey, step.stepKey)}
              style={{textAlign: 'left', width: '100%'}}
            >
              <Text size={1}>
                {step.chapterTitle} — {step.stepTitle}
              </Text>
            </Card>
          )
        })}
      </Stack>
    </Card>
  )
}

function CanvasPane({
  chapters,
  selection,
  device,
}: {
  chapters: unknown[]
  selection: EditorSelection
  device: 'desktop' | 'mobile'
}): ReactNode {
  const step = findStep(chapters, selection.chapterKey, selection.stepKey)
  const screenshot = screenshotFor(step, device)
  const assetRef = screenshotAssetRef(screenshot)
  const stepTitle = stringField(step, 'title') ?? ''
  const alt = stringField(screenshot, 'alt') || stepTitle

  return (
    <Flex flex={1} align="center" justify="center" padding={4} style={{overflow: 'auto'}}>
      {step === null ? (
        <Text muted size={1}>
          Select a step to see its screenshot.
        </Text>
      ) : assetRef ? (
        <img
          alt={alt}
          data-testid="canvas-screenshot"
          src={assetRef}
          style={{maxWidth: '100%', maxHeight: '100%'}}
        />
      ) : (
        <Text muted size={1}>
          This step has no screenshot yet.
        </Text>
      )}
    </Flex>
  )
}

function InspectorPane({selection}: {selection: EditorSelection}): ReactNode {
  return (
    <Card borderLeft padding={3} style={{minWidth: 260}}>
      <Stack gap={3}>
        <Text size={1} weight="semibold">
          Inspector
        </Text>
        <Text muted size={1}>
          {selection.elementKey !== null
            ? 'Selected element fields render here (Task 7).'
            : 'Select an element to edit its fields.'}
        </Text>
      </Stack>
    </Card>
  )
}

function CanvasPanes({
  chapters,
  selection,
  onSelectStep,
  device,
}: {
  chapters: unknown[]
  selection: EditorSelection
  onSelectStep: (chapterKey: string, stepKey: string) => void
  device: 'desktop' | 'mobile'
}): ReactNode {
  return (
    <Flex style={{height: '100%', minHeight: 0}}>
      <FilmstripPane
        steps={flattenSteps(chapters)}
        selection={selection}
        onSelectStep={onSelectStep}
      />
      <CanvasPane chapters={chapters} selection={selection} device={device} />
      <InspectorPane selection={selection} />
    </Flex>
  )
}

function Toolbar({
  device,
  onSetDevice,
  onOpenFullEditor,
}: {
  device: 'desktop' | 'mobile'
  onSetDevice: (d: 'desktop' | 'mobile') => void
  onOpenFullEditor: () => void
}): ReactNode {
  return (
    <Flex align="center" justify="space-between" padding={2} paddingX={3}>
      <Inline gap={1}>
        <Button
          aria-pressed={device === 'desktop'}
          data-testid="device-desktop"
          mode={device === 'desktop' ? 'default' : 'bleed'}
          onClick={() => onSetDevice('desktop')}
          text="Desktop"
        />
        <Button
          aria-pressed={device === 'mobile'}
          data-testid="device-mobile"
          mode={device === 'mobile' ? 'default' : 'bleed'}
          onClick={() => onSetDevice('mobile')}
          text="Mobile"
        />
      </Inline>
      <Button
        data-testid="open-full-editor"
        onClick={onOpenFullEditor}
        text="Open full editor"
        tone="primary"
      />
    </Flex>
  )
}

/** The `chapters` array field's input component (`components: {input: CanvasInput}` in `schema/guidedTour.ts`). @internal */
export function CanvasInput(props: CanvasInputProps): ReactNode {
  const chapters: unknown[] = props.value ?? []
  const {selection, selectStep, device, setDevice, expanded, setExpanded} = useEditorState(chapters)

  // One JSX subtree — toolbar plus the three panes — reused verbatim
  // whether it's shown inline (collapsed) or inside the Dialog (expanded).
  // Only one of the two branches below is ever mounted at a time (they're
  // mutually exclusive on `expanded`), so this stays a single logical
  // instance: the same `useEditorState()` call above backs both, and no
  // interactive element (a filmstrip step, a device toggle) is ever
  // duplicated in the DOM.
  const body = (
    <Box>
      <Toolbar device={device} onOpenFullEditor={() => setExpanded(true)} onSetDevice={setDevice} />
      <Card borderTop style={{height: expanded ? undefined : 420, flex: expanded ? 1 : undefined}}>
        <CanvasPanes
          chapters={chapters}
          device={device}
          onSelectStep={selectStep}
          selection={selection}
        />
      </Card>
    </Box>
  )

  return (
    <Box>
      {expanded ? (
        <Dialog
          header="Guided tour editor"
          id={`${props.id}-canvas-editor`}
          onClose={() => setExpanded(false)}
          width="auto"
          style={{width: '92vw', height: '86vh', display: 'flex', flexDirection: 'column'}}
        >
          {body}
        </Dialog>
      ) : (
        <Card border radius={2}>
          {body}
        </Card>
      )}

      <details style={{marginTop: '1rem'}}>
        <summary style={{cursor: 'pointer'}}>Plain editor</summary>
        <Box marginTop={2}>{props.renderDefault(props)}</Box>
      </details>
    </Box>
  )
}
