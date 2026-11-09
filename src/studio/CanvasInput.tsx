// The `chapters` field's input component (design spec §7.1, master plan
// Task 4): a three-pane shell (Filmstrip | Canvas | Inspector) plus a
// header toolbar and a full-screen `@sanity/ui` Dialog escape valve. Task 5
// wired the real `Canvas` pane — tool palette, click-to-place, drag,
// keyboard nudge/delete/escape, width resize. Task 6 wired the real
// chapter-grouped `Filmstrip` pane in place of Task 4's flat placeholder
// list, adding a second bundle of semantic callbacks
// (`StepMutationCallbacks`) alongside Task 5's `ElementMutationCallbacks` —
// same split: `Filmstrip.tsx`/`Canvas.tsx` only ever report intent upward,
// this file turns each into a `patches.ts` builder wrapped in
// `PatchEvent.from(...)` for `props.onChange`. Task 7 (this revision) wires
// the real `Inspector` pane in place of Task 4's placeholder — unlike
// `Canvas`/`Filmstrip`, `Inspector` needs this component's OWN `props`
// (`Inspector.tsx`'s module comment: it reads `props.members`/
// `props.onItemOpen` directly, the real member tree and the platform's own
// item-editing entry point), not just `chapters`/`selection`, so it's
// threaded through `CanvasPanes` as `arrayProps` rather than joining the
// `chapters`/`selection` props the other two panes get.
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
import {Box, Button, Card, Dialog, Flex, Inline, Tab, TabList, TabPanel, Text} from '@sanity/ui'
import type {ReactNode} from 'react'
import {useId, useState} from 'react'
import {PatchEvent} from 'sanity'
import type {ArrayOfObjectsInputProps, FormPatch} from 'sanity'

import type {UploadedAsset} from './bulkUpload'
import {stepsFromAssets, summarizeUploadOutcome} from './bulkUpload'
import {Canvas} from './Canvas'
import {Filmstrip, type StepMutationCallbacks} from './Filmstrip'
import {drillToStep, Inspector} from './Inspector'
import {randomKey} from './keys'
import {
  duplicateStepPatch,
  insertChapterPatch,
  insertElementPatch,
  insertStepPatch,
  insertStepsPatch,
  moveElementPatch,
  moveStepPatch,
  removeChapterPatch,
  removeElementPatch,
  removeStepPatch,
  reorderStepPatch,
  setElementWidthPatch,
} from './patches'
import {useEditorState, type EditorSelection} from './useEditorState'
import {useProjectDataset} from './useProjectDataset'
import {useSafeToast} from './useSafeToast'
import {useUploader} from './useUploader'

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

// Respond to the document pane's width, including when desk navigation is
// open. Consumers do not need another stylesheet import for the editor.
const EDITOR_LAYOUT = `
  .gt-editor-panes.gt-editor-panes { display: grid; grid-template-columns: 260px minmax(0, 1fr) 260px; grid-template-rows: minmax(0, 1fr); min-height: 0; }
  .gt-editor-panel.gt-editor-panel { display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: auto; }
  .gt-editor-panel.gt-editor-panel > * { flex: 1; min-height: 0; }
  .gt-editor-navigation.gt-editor-navigation { display: none; }
  @container guided-tour-editor (max-width: 959px) {
    .gt-editor-navigation.gt-editor-navigation { display: block; }
    .gt-editor-panes.gt-editor-panes { grid-template-columns: minmax(0, 1fr); }
    .gt-editor-panel.gt-editor-panel[data-active="false"] { display: none; }
  }
  @supports not (container-type: inline-size) {
    .gt-editor-navigation.gt-editor-navigation { display: block; }
    .gt-editor-panes.gt-editor-panes { grid-template-columns: minmax(0, 1fr); }
    .gt-editor-panel.gt-editor-panel[data-active="false"] { display: none; }
  }
`

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function keyOf(value: unknown): string | null {
  return isRecord(value) && typeof value._key === 'string' ? value._key : null
}

function stepsOf(chapter: unknown): unknown[] {
  return isRecord(chapter) && Array.isArray(chapter.steps) ? chapter.steps : []
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

function findChapter(chapters: unknown[], chapterKey: string): unknown {
  for (const chapter of chapters) {
    if (keyOf(chapter) === chapterKey) return chapter
  }
  return null
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

function CanvasPanes({
  chapters,
  selection,
  onSelectStep,
  onSelectElement,
  device,
  elementCallbacks,
  stepCallbacks,
  projectId,
  dataset,
  arrayProps,
  uploader,
  onUploadBatch,
}: {
  chapters: unknown[]
  selection: EditorSelection
  onSelectStep: (chapterKey: string, stepKey: string) => void
  onSelectElement: (elementKey: string | null) => void
  device: 'desktop' | 'mobile'
  elementCallbacks: ElementMutationCallbacks
  stepCallbacks: StepMutationCallbacks
  projectId: string | null
  dataset: string | null
  arrayProps: CanvasInputProps
  uploader: ((file: File) => Promise<UploadedAsset>) | null
  onUploadBatch: (chapterKey: string, ok: UploadedAsset[], failed: number) => void
}): ReactNode {
  const step = findStep(chapters, selection.chapterKey, selection.stepKey)
  const [panel, setPanel] = useState<'steps' | 'canvas' | 'details'>(step ? 'canvas' : 'steps')
  const panelId = useId()
  const stepNode =
    selection.chapterKey !== null && selection.stepKey !== null
      ? drillToStep(arrayProps.members, selection.chapterKey, selection.stepKey)
      : null

  return (
    <Flex direction="column" style={{height: '100%', minHeight: 0}}>
      <Box className="gt-editor-navigation" padding={2}>
        <TabList gap={1} aria-label="Tour editor panels">
          {(['steps', 'canvas', 'details'] as const).map((name) => (
            <Tab
              aria-controls={`${panelId}-${name}`}
              id={`${panelId}-tab-${name}`}
              selected={panel === name}
              data-testid={`editor-panel-${name}`}
              key={name}
              onClick={() => setPanel(name)}
              label={name === 'steps' ? 'Steps' : name === 'canvas' ? 'Canvas' : 'Details'}
            />
          ))}
        </TabList>
      </Box>
      <Box className="gt-editor-panes" flex={1}>
        <TabPanel
          id={`${panelId}-steps`}
          aria-labelledby={`${panelId}-tab-steps`}
          className="gt-editor-panel"
          data-active={panel === 'steps'}
        >
          <Filmstrip
            callbacks={stepCallbacks}
            chapters={chapters}
            dataset={dataset}
            onSelectStep={(chapterKey, stepKey) => {
              onSelectStep(chapterKey, stepKey)
              setPanel('canvas')
            }}
            onUploadBatch={onUploadBatch}
            onEditChapter={(chapterKey) => {
              const member = arrayProps.members.find(
                (item) => item.kind === 'item' && item.key === chapterKey,
              )
              if (member?.kind === 'item') arrayProps.onItemOpen(member.item.path)
            }}
            projectId={projectId}
            selection={selection}
            uploader={uploader}
          />
        </TabPanel>
        <TabPanel
          id={`${panelId}-canvas`}
          aria-labelledby={`${panelId}-tab-canvas`}
          className="gt-editor-panel"
          data-active={panel === 'canvas'}
        >
          <Canvas
            key={JSON.stringify([selection.chapterKey, selection.stepKey])}
            dataset={dataset}
            device={device}
            onInsertElement={elementCallbacks.onInsertElement}
            onMoveElement={elementCallbacks.onMoveElement}
            onRemoveElement={elementCallbacks.onRemoveElement}
            onResizeElement={elementCallbacks.onResizeElement}
            onSelectElement={onSelectElement}
            onAddScreenshot={
              stepNode && !arrayProps.readOnly
                ? () => arrayProps.onItemOpen(stepNode.path)
                : undefined
            }
            onEditStep={() => {
              onSelectElement(null)
              setPanel('details')
            }}
            projectId={projectId}
            readOnly={arrayProps.readOnly === true}
            selectedElementKey={selection.elementKey}
            step={step}
          />
        </TabPanel>
        <TabPanel
          id={`${panelId}-details`}
          aria-labelledby={`${panelId}-tab-details`}
          className="gt-editor-panel"
          data-active={panel === 'details'}
        >
          <Inspector
            arrayProps={arrayProps}
            onSelectElement={onSelectElement}
            onRemoveElement={elementCallbacks.onRemoveElement}
            selection={selection}
          />
        </TabPanel>
      </Box>
    </Flex>
  )
}

function Toolbar({
  device,
  onSetDevice,
  onOpenFullEditor,
  expanded,
}: {
  device: 'desktop' | 'mobile'
  onSetDevice: (d: 'desktop' | 'mobile') => void
  onOpenFullEditor: () => void
  expanded: boolean
}): ReactNode {
  return (
    <Flex align="center" justify="space-between" padding={2} paddingX={3} wrap="wrap" gap={2}>
      <Inline gap={1}>
        <Box padding={2}>
          <Text muted size={1}>
            Edit layout
          </Text>
        </Box>
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
      {!expanded && (
        <Button
          data-testid="open-full-editor"
          onClick={onOpenFullEditor}
          text="Open full editor"
          mode="ghost"
          tone="primary"
        />
      )}
    </Flex>
  )
}

/** The `chapters` array field's input component (`components: {input: CanvasInput}` in `schema/guidedTour.ts`). @internal */
export function CanvasInput(props: CanvasInputProps): ReactNode {
  const chapters: unknown[] = props.value ?? []
  const {selection, selectStep, selectElement, device, setDevice, expanded, setExpanded} =
    useEditorState(chapters)
  const {projectId, dataset} = useProjectDataset()
  const uploader = useUploader()
  const toast = useSafeToast()

  function emit(patches: FormPatch[]): void {
    props.onChange(PatchEvent.from(patches))
  }

  /**
   * `Filmstrip.tsx`'s bulk-upload drop zone reports one finished, partitioned
   * batch here (master plan Task 8) — this is the one place that turns it
   * into document mutations: `ok` assets become `stepsFromAssets` scaffolds
   * appended to `chapterKey` via a single `insertStepsPatch`/`PatchEvent`
   * (skipped entirely when every upload failed — an empty `insert` patch
   * would be a no-op mutation), then a `useSafeToast` summary reports the
   * ok/failed counts regardless. Filmstrip itself never builds patches or
   * shows toasts (its own module comment) — this handler is the seam.
   */
  function handleUploadBatch(chapterKey: string, ok: UploadedAsset[], failed: number): void {
    if (ok.length > 0) {
      emit(insertStepsPatch(chapterKey, stepsFromAssets(ok, randomKey)))
    }
    toast.push(summarizeUploadOutcome(ok.length, failed))
  }

  // Bundles the five element-mutation callbacks `Canvas.tsx` expects
  // (see `ElementMutationCallbacks`'s doc comment) — each a no-op while no
  // step is selected (`chapters` is empty, or the selection hasn't healed
  // yet), which `Canvas` itself also guards against by only ever rendering
  // elements/the click-to-place surface for a non-null `step`.
  const elementCallbacks: ElementMutationCallbacks = {
    onInsertElement(element) {
      if (selection.chapterKey === null || selection.stepKey === null) return
      emit(insertElementPatch(selection.chapterKey, selection.stepKey, element, device))
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
      toast.push({status: 'success', title: 'Element removed'})
    },
  }

  // The `Filmstrip.tsx` mutation callbacks — keyed by `chapterKey`/`stepKey`
  // only (see `StepMutationCallbacks`'s doc comment); each re-derives
  // whatever chapter/step record a `patches.ts` builder needs from this
  // component's own `chapters`, the "each layer computes what it needs from
  // the canonical value" split `elementCallbacks` above already uses.
  //
  // SDD ledger Parked C ruling (LAST-STEP handling): both `onDeleteStep`
  // and `onMoveStepToChapter` check whether the step being removed/moved is
  // its chapter's ONLY step — deleting/moving it away would otherwise leave
  // that chapter violating `steps`' schema `min(1)` (schema/chapter.ts).
  // `onDeleteStep` unsets the whole chapter (`removeChapterPatch`) instead
  // of just the step in that case; `onMoveStepToChapter` appends
  // `removeChapterPatch` after the move. `Filmstrip.tsx`'s confirm dialog
  // surfaces this consequence in its text before either ever runs.
  const stepCallbacks: StepMutationCallbacks = {
    onAddStep(chapterKey) {
      const newStep = {_type: 'guidedTourStep', _key: randomKey(), elements: []}
      emit(insertStepPatch(chapterKey, newStep, null))
      selectStep(chapterKey, newStep._key)
    },
    onAddChapter(afterChapterKey) {
      const newChapter = {
        _type: 'guidedTourChapter',
        _key: randomKey(),
        title: 'New chapter',
        steps: [],
      }
      emit(insertChapterPatch(newChapter, afterChapterKey))
    },
    onDuplicateStep(chapterKey, stepKey) {
      const step = findStep(chapters, chapterKey, stepKey)
      if (!isRecord(step)) return
      const newKey = randomKey()
      emit(duplicateStepPatch(chapterKey, step, newKey, randomKey))
      selectStep(chapterKey, newKey)
    },
    onDeleteStep(chapterKey, stepKey) {
      const steps = stepsOf(findChapter(chapters, chapterKey))
      const isLastStep = steps.length === 1 && keyOf(steps[0]) === stepKey
      emit(isLastStep ? removeChapterPatch(chapterKey) : removeStepPatch(chapterKey, stepKey))
    },
    onReorderStep(chapterKey, stepKey, targetIndex) {
      const steps = stepsOf(findChapter(chapters, chapterKey)).filter(isRecord)
      emit(reorderStepPatch(chapterKey, steps, stepKey, targetIndex))
    },
    onMoveStepToChapter(fromChapterKey, stepKey, toChapterKey) {
      const step = findStep(chapters, fromChapterKey, stepKey)
      if (!isRecord(step)) return
      const steps = stepsOf(findChapter(chapters, fromChapterKey))
      const sourceBecomesEmpty = steps.length === 1 && keyOf(steps[0]) === stepKey
      const movePatches = moveStepPatch(fromChapterKey, stepKey, step, toChapterKey, null)
      emit(
        sourceBecomesEmpty ? [...movePatches, ...removeChapterPatch(fromChapterKey)] : movePatches,
      )
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
    <Flex
      direction="column"
      style={{height: '100%', minHeight: 0, container: 'guided-tour-editor / inline-size'}}
    >
      <style>{EDITOR_LAYOUT}</style>
      <Toolbar
        device={device}
        expanded={expanded}
        onOpenFullEditor={() => setExpanded(true)}
        onSetDevice={setDevice}
      />
      <Card
        borderTop
        style={{height: expanded ? undefined : 520, flex: expanded ? 1 : undefined, minHeight: 0}}
      >
        <CanvasPanes
          arrayProps={props}
          chapters={chapters}
          dataset={dataset}
          device={device}
          elementCallbacks={elementCallbacks}
          onSelectElement={selectElement}
          onSelectStep={selectStep}
          onUploadBatch={handleUploadBatch}
          projectId={projectId}
          selection={selection}
          stepCallbacks={stepCallbacks}
          uploader={uploader}
        />
      </Card>
    </Flex>
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
            No `style` override on <Dialog> itself: per @sanity/ui,
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
          <summary style={{cursor: 'pointer'}}>All chapter and step fields</summary>
          <Box marginTop={2}>{props.renderDefault(props)}</Box>
        </details>
      )}
    </Box>
  )
}
