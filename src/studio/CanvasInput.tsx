// The `chapters` field's input component (design spec §7.1, master plan
// Task 4): a three-pane shell (Filmstrip | Canvas | Inspector) plus a
// header toolbar and a full-screen `@sanity/ui` Dialog escape valve. Tasks
// 6-7 still owe the real Filmstrip/Inspector (chapter grouping, real
// member-input rendering); Task 5 (this revision) wires the real `Canvas`
// pane in place of the Task 4 placeholder — tool palette, click-to-place,
// drag, keyboard nudge/delete/escape, width resize — and turns its semantic
// callbacks (`onInsertElement`/`onMoveElement`/etc.) into `patches.ts`
// builders wrapped in `PatchEvent.from(...)` for `props.onChange`.
//
// Task 4 kept this file's only Studio-context dependency `@sanity/ui`
// (zero runtime `sanity` imports). Task 5 necessarily adds two: `PatchEvent`
// (a plain data class — wraps the `FormPatch[]` arrays `patches.ts`'s
// builders return; no context dependency, so nothing new for the smoke
// tests to route around) and `useProjectDataset` (`./useProjectDataset`,
// wrapping `sanity`'s `useWorkspace()`), for `Canvas`'s real `<img src>`
// URLs (`assetRef.ts`, pulled forward from Task 8 — see `assetRef.ts`'s
// module comment). `useWorkspace()` throws outside a `WorkspaceProvider`
// ancestor — true of every smoke-test render in this suite, which wraps
// fixtures in nothing more than `@sanity/ui`'s `ThemeProvider`/
// `LayerProvider` — so `useProjectDataset` catches that and returns nulls;
// `Canvas` then renders the "asset-ref placeholder text" path instead of a
// real `<img>` (see `Canvas.tsx`'s screenshot rendering and
// `useProjectDataset.ts`'s module comment for the full design note). This
// is also why `Canvas`/`CanvasElement` take `projectId`/`dataset` as plain
// props rather than calling the hook themselves: only this file — the one
// Studio-context-aware caller — needs to tolerate the hook's no-provider
// case, and threading resolved values down keeps the two child components
// testable with plain `fireEvent`, no `sanity` mocking.
//
// Every field this component reads off `props.value` is narrowed from
// `unknown`, the same convention `src/schema/guidedTour.ts`'s
// `stepCountOf` and `src/studio/patches.ts`'s `isRecord` use, rather than
// trusting the field's own default generic (`{_key: string}` — see the doc
// comment on `CanvasInputProps` below for why it isn't parametrized).
import {Box, Button, Card, Dialog, Flex, Inline, Stack, Text} from '@sanity/ui'
import type {ReactNode} from 'react'
import {PatchEvent} from 'sanity'
import type {ArrayOfObjectsInputProps, FormPatch} from 'sanity'

import {Canvas} from './Canvas'
import {
  insertElementPatch,
  moveElementPatch,
  removeElementPatch,
  setElementWidthPatch,
} from './patches'
import {useEditorState, type EditorSelection} from './useEditorState'
import {useProjectDataset} from './useProjectDataset'

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

/**
 * The `chapters`-array-relative element mutation callbacks `Canvas.tsx`
 * expects — each one turns a semantic event into a `patches.ts` builder
 * call wrapped in `PatchEvent.from(...)` for `props.onChange`. Bundled into
 * one object (rather than passed as five separate props threaded through
 * `CanvasPanes`) so the `chapterKey`/`stepKey`/`device` closures only need
 * building once per render, at the one call site (`CanvasInput`) that
 * actually has `props.onChange` and the current selection in scope.
 */
interface ElementMutationCallbacks {
  onInsertElement: (
    element: {_type: string; _key: string; x: number; y: number} & Record<string, unknown>,
  ) => void
  onMoveElement: (elementKey: string, pos: {x: number; y: number}) => void
  onResizeElement: (elementKey: string, width: number) => void
  onRemoveElement: (elementKey: string) => void
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
  onSelectElement,
  device,
  elementCallbacks,
  projectId,
  dataset,
}: {
  chapters: unknown[]
  selection: EditorSelection
  onSelectStep: (chapterKey: string, stepKey: string) => void
  onSelectElement: (elementKey: string | null) => void
  device: 'desktop' | 'mobile'
  elementCallbacks: ElementMutationCallbacks
  projectId: string | null
  dataset: string | null
}): ReactNode {
  const step = findStep(chapters, selection.chapterKey, selection.stepKey)

  return (
    <Flex style={{height: '100%', minHeight: 0}}>
      <FilmstripPane
        steps={flattenSteps(chapters)}
        selection={selection}
        onSelectStep={onSelectStep}
      />
      <Canvas
        dataset={dataset}
        device={device}
        onInsertElement={elementCallbacks.onInsertElement}
        onMoveElement={elementCallbacks.onMoveElement}
        onRemoveElement={elementCallbacks.onRemoveElement}
        onResizeElement={elementCallbacks.onResizeElement}
        onSelectElement={onSelectElement}
        projectId={projectId}
        selectedElementKey={selection.elementKey}
        step={step}
      />
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
  const {selection, selectStep, selectElement, device, setDevice, expanded, setExpanded} =
    useEditorState(chapters)
  const {projectId, dataset} = useProjectDataset()

  function emit(patches: FormPatch[]): void {
    props.onChange(PatchEvent.from(patches))
  }

  // Bundles the five element-mutation callbacks `Canvas.tsx` expects
  // (see `ElementMutationCallbacks`'s doc comment) — each a no-op while no
  // step is selected (`chapters` is empty, or the selection hasn't healed
  // yet), which `Canvas` itself also guards against by only ever rendering
  // elements/the click-to-place surface for a non-null `step`.
  const elementCallbacks: ElementMutationCallbacks = {
    onInsertElement(element) {
      if (selection.chapterKey === null || selection.stepKey === null) return
      emit(insertElementPatch(selection.chapterKey, selection.stepKey, element))
      selectElement(element._key)
    },
    onMoveElement(elementKey, pos) {
      if (selection.chapterKey === null || selection.stepKey === null) return
      emit(moveElementPatch(selection.chapterKey, selection.stepKey, elementKey, pos, device))
    },
    onResizeElement(elementKey, width) {
      if (selection.chapterKey === null || selection.stepKey === null) return
      emit(setElementWidthPatch(selection.chapterKey, selection.stepKey, elementKey, width, device))
    },
    onRemoveElement(elementKey) {
      if (selection.chapterKey === null || selection.stepKey === null) return
      emit(removeElementPatch(selection.chapterKey, selection.stepKey, elementKey))
      selectElement(null)
    },
  }

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
          dataset={dataset}
          device={device}
          elementCallbacks={elementCallbacks}
          onSelectElement={selectElement}
          onSelectStep={selectStep}
          projectId={projectId}
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
          padding={4}
          width="auto"
        >
          {/*
            No `style` override on <Dialog> itself: per @sanity/ui 3.5.1,
            `width="auto"` already makes the DialogCard fill the backdrop,
            and the backdrop (Dialog's own outer restProps-styled Layer)
            already stretches full-viewport on its own — sizing it again
            here would land on that outer fixed element and overconstrain
            it (fixed inset + explicit width/height leaves slivers of the
            viewport uncovered/undimmed). Fill is instead applied to this
            inner content container, which the Dialog's own layout doesn't
            otherwise size for us.
          */}
          <Box style={{height: '80vh', minHeight: 0}}>{body}</Box>
        </Dialog>
      ) : (
        <Card border radius={2}>
          {body}
        </Card>
      )}

      {!expanded && (
        <details style={{marginTop: '1rem'}}>
          <summary style={{cursor: 'pointer'}}>Plain editor</summary>
          <Box marginTop={2}>{props.renderDefault(props)}</Box>
        </details>
      )}
    </Box>
  )
}
