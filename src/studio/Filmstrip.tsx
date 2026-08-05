// The filmstrip pane (master plan Task 6): a chapter-grouped vertical list
// of step thumbnails with add-step/add-chapter buttons per chapter header,
// selection highlight, and a per-step `MenuButton` (reorder up/down,
// duplicate, move to another chapter, delete). Like `Canvas.tsx`, this
// component only ever *reports* intent upward via the `callbacks` bundle
// (`StepMutationCallbacks`) — it builds no patches itself; `CanvasInput.tsx`
// (the caller) turns each callback into a `patches.ts` builder wrapped in
// `PatchEvent.from(...)` for its own `props.onChange`. The one piece of
// state this component DOES own locally is UI-only: which confirm dialog
// (if any) is open, and which step is mid-drag — neither needs a patch to
// exist.
//
// Cross-chapter drag-and-drop is a documented, deliberate gap, not an
// oversight: SDD ledger Parked-thread A ruled the spec's §7.2 "move a step
// across chapters" requirement is satisfied by the Move-to-chapter menu
// (below) — also the keyboard-accessible path — and deferred cross-chapter
// HTML5 drag past M3 with a follow-up issue at milestone end. `handleDragOver`
// below is where that boundary is enforced: a drag is only ever a valid drop
// target within the SAME chapter it started in.
import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Inline,
  Menu,
  MenuButton,
  MenuDivider,
  MenuGroup,
  MenuItem,
  Stack,
  Text,
} from '@sanity/ui'
import type {DragEvent, KeyboardEvent, ReactNode} from 'react'
import {useState} from 'react'

import {assetRefToUrl} from './assetRef'
import type {EditorSelection} from './useEditorState'

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

function elementsOf(step: unknown): unknown[] {
  return isRecord(step) && Array.isArray(step.elements) ? step.elements : []
}

function screenshotAssetRef(step: unknown): string | undefined {
  const screenshot = isRecord(step) ? step.screenshot : undefined
  const asset = isRecord(screenshot) ? screenshot.asset : undefined
  return isRecord(asset) && typeof asset._ref === 'string' ? asset._ref : undefined
}

/**
 * The amended validation-warning heuristic (design amendment, binding on
 * this task): a step needs attention when its screenshot is missing OR
 * present but its `alt` text is missing/empty. This is a plain
 * presence-of-required-fields check on the step's own value — NOT a read of
 * `props.validation`/member validation — recorded here as the mechanism
 * actually used: the array field's `validation` prop is keyed by top-level
 * marker paths on the whole `chapters` value, not something this
 * per-step-row component can cheaply slice its own step out of, and the
 * two fields this checks (`screenshot`, `screenshot.alt`) are exactly the
 * schema's own required fields (`schema/step.ts`) — so the heuristic and
 * the platform's real validation agree on what "needs attention" means,
 * they just aren't the same code path. This also directly targets the
 * amendment's stated case: `bulkUpload.ts`'s `stepsFromAssets` scaffolds a
 * screenshot with no `alt` by construction, so every bulk-uploaded step
 * starts out needing attention until an author fills it in.
 */
function stepNeedsAttention(step: unknown): boolean {
  const screenshot = isRecord(step) ? step.screenshot : undefined
  if (!isRecord(screenshot)) return true
  const alt = screenshot.alt
  return typeof alt !== 'string' || alt.trim() === ''
}

/**
 * The `chapters`-relative step/chapter mutation callbacks this pane
 * expects — deliberately keyed by `chapterKey`/`stepKey` only (never a raw
 * step/chapter record): `CanvasInput.tsx` already owns `chapters` and its
 * own `findStep`/chapter-lookup helpers, so it re-derives whatever record a
 * patch builder needs from its own current value at emit time, the same
 * "each layer computes what it needs from the canonical value" split
 * `elementCallbacks` uses for `onMoveElement`/`onRemoveElement` (Task 5).
 */
export interface StepMutationCallbacks {
  onAddStep: (chapterKey: string) => void
  onAddChapter: (afterChapterKey: string | null) => void
  onDuplicateStep: (chapterKey: string, stepKey: string) => void
  onDeleteStep: (chapterKey: string, stepKey: string) => void
  onReorderStep: (chapterKey: string, stepKey: string, targetIndex: number) => void
  onMoveStepToChapter: (fromChapterKey: string, stepKey: string, toChapterKey: string) => void
}

interface PendingDelete {
  kind: 'delete'
  chapterKey: string
  stepKey: string
  stepTitle: string
  chapterTitle: string
  isLastStep: boolean
}

interface PendingMove {
  kind: 'move'
  chapterKey: string
  stepKey: string
  stepTitle: string
  chapterTitle: string
  toChapterKey: string
  toChapterTitle: string
}

type PendingAction = PendingDelete | PendingMove | null

interface DraggedStep {
  chapterKey: string
  stepKey: string
}

interface ChapterOption {
  key: string
  title: string
}

interface StepRowProps {
  chapterKey: string
  chapterTitle: string
  step: unknown
  arrayIndex: number
  totalInChapter: number
  selected: boolean
  otherChapters: ChapterOption[]
  projectId: string | null
  dataset: string | null
  onSelectStep: (chapterKey: string, stepKey: string) => void
  callbacks: StepMutationCallbacks
  dragging: boolean
  onDragStart: (chapterKey: string, stepKey: string) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLDivElement>, chapterKey: string) => void
  onDrop: (event: DragEvent<HTMLDivElement>, chapterKey: string, targetIndex: number) => void
  onRequestDelete: (
    chapterKey: string,
    stepKey: string,
    stepTitle: string,
    chapterTitle: string,
    isLastStep: boolean,
  ) => void
  onRequestMove: (
    chapterKey: string,
    stepKey: string,
    stepTitle: string,
    chapterTitle: string,
    toChapterKey: string,
    toChapterTitle: string,
    isLastStep: boolean,
  ) => void
}

function StepRow(props: StepRowProps): ReactNode {
  const stepKey = keyOf(props.step)
  if (stepKey === null) return null

  const {chapterKey, chapterTitle, arrayIndex, totalInChapter} = props
  const displayIndex = arrayIndex + 1
  const title = stringField(props.step, 'title') ?? `Step ${displayIndex}`
  const elementCount = elementsOf(props.step).length
  const needsAttention = stepNeedsAttention(props.step)
  const assetRef = screenshotAssetRef(props.step)
  const thumbnailUrl =
    assetRef && props.projectId && props.dataset
      ? assetRefToUrl(assetRef, props.projectId, props.dataset, 'w=160&auto=format')
      : null
  // `totalInChapter` (passed down from `Filmstrip`'s loop over the
  // chapter's own `steps.length`) is 1 exactly when this row's step is the
  // only one in its chapter — the SDD ledger's Parked C "LAST-STEP" case
  // that both the delete-confirm and move-to-chapter flows need to warn
  // about (deleting/moving it away leaves the chapter violating `steps`'
  // schema `min(1)`, so the confirm flow removes the whole chapter too).
  const isLastStep = totalInChapter === 1

  function handleRowKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    // Re-guards `stepKey` (already narrowed non-null above): TS doesn't
    // carry control-flow narrowing of an outer `const` into a nested
    // function DECLARATION's body (only into function expressions/arrows
    // defined inline at the narrowed point) — a real TS limitation, not a
    // genuine possibility of `stepKey` having changed.
    if (stepKey === null) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    props.onSelectStep(chapterKey, stepKey)
  }

  return (
    // A real `<button>` can't host this row: it nests a `MenuButton`
    // (itself a real `<button>`), and interactive content nested inside a
    // `<button>` is invalid HTML — the same rationale `CanvasElement.tsx`
    // documents for its own `role="button"` chip below. `onKeyDown`
    // (Enter/Space activates, same as a real button) plus `tabIndex` keeps
    // this genuinely keyboard-operable rather than leaning on a blanket
    // lint suppression.
    <Card
      aria-pressed={props.selected}
      data-testid={`filmstrip-step-${chapterKey}-${stepKey}`}
      draggable
      onClick={() => props.onSelectStep(chapterKey, stepKey)}
      onDragEnd={props.onDragEnd}
      onDragOver={(event) => props.onDragOver(event, chapterKey)}
      onDragStart={() => props.onDragStart(chapterKey, stepKey)}
      onDrop={(event) => props.onDrop(event, chapterKey, arrayIndex)}
      onKeyDown={handleRowKeyDown}
      padding={2}
      radius={2}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="button"
      style={{cursor: 'pointer', opacity: props.dragging ? 0.4 : 1}}
      tabIndex={0}
      tone={props.selected ? 'primary' : 'default'}
    >
      <Flex align="center" gap={2}>
        {thumbnailUrl ? (
          <img
            alt=""
            data-testid={`filmstrip-thumbnail-${chapterKey}-${stepKey}`}
            src={thumbnailUrl}
            style={{borderRadius: 3, display: 'block', height: 40, objectFit: 'cover', width: 40}}
          />
        ) : (
          <Box
            data-testid={`filmstrip-thumbnail-placeholder-${chapterKey}-${stepKey}`}
            style={{
              background: 'var(--card-border-color, #ccc)',
              borderRadius: 3,
              flexShrink: 0,
              height: 40,
              width: 40,
            }}
          />
        )}
        <Stack flex={1} gap={2} style={{minWidth: 0}}>
          <Text size={1} textOverflow="ellipsis">
            {displayIndex}. {title}
          </Text>
          <Inline gap={2}>
            <Badge data-testid={`filmstrip-count-${chapterKey}-${stepKey}`}>
              {elementCount} element{elementCount === 1 ? '' : 's'}
            </Badge>
            {needsAttention && (
              <Badge
                data-testid={`filmstrip-warning-${chapterKey}-${stepKey}`}
                title="Missing screenshot or alt text"
                tone="caution"
              >
                Needs attention
              </Badge>
            )}
          </Inline>
        </Stack>
        {/* Stops the menu button's own click from also selecting/activating
            the step row (this row's own onClick/onKeyDown, above) — pure
            event-bubbling isolation, not an interaction of its own, same
            rationale `Canvas.tsx`'s click-to-place surface documents for
            its own disable comment. */}
        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
        <div onClick={(event) => event.stopPropagation()}>
          <MenuButton
            button={
              <Button
                aria-label="Step actions"
                data-testid={`filmstrip-step-menu-${chapterKey}-${stepKey}`}
                mode="bleed"
                text="⋯"
              />
            }
            id={`filmstrip-menu-${chapterKey}-${stepKey}`}
            menu={
              <Menu>
                <MenuItem
                  data-testid={`filmstrip-move-up-${chapterKey}-${stepKey}`}
                  disabled={arrayIndex === 0}
                  onClick={() => props.callbacks.onReorderStep(chapterKey, stepKey, arrayIndex - 1)}
                  text="Move up"
                />
                <MenuItem
                  data-testid={`filmstrip-move-down-${chapterKey}-${stepKey}`}
                  disabled={arrayIndex === totalInChapter - 1}
                  onClick={() => props.callbacks.onReorderStep(chapterKey, stepKey, arrayIndex + 1)}
                  text="Move down"
                />
                <MenuDivider />
                <MenuItem
                  data-testid={`filmstrip-duplicate-${chapterKey}-${stepKey}`}
                  onClick={() => props.callbacks.onDuplicateStep(chapterKey, stepKey)}
                  text="Duplicate"
                />
                {props.otherChapters.length > 0 && (
                  <MenuGroup text="Move to chapter">
                    {props.otherChapters.map((target) => (
                      <MenuItem
                        data-testid={`filmstrip-move-to-${target.key}-${chapterKey}-${stepKey}`}
                        key={target.key}
                        onClick={() =>
                          props.onRequestMove(
                            chapterKey,
                            stepKey,
                            title,
                            chapterTitle,
                            target.key,
                            target.title,
                            isLastStep,
                          )
                        }
                        text={target.title}
                      />
                    ))}
                  </MenuGroup>
                )}
                <MenuDivider />
                <MenuItem
                  data-testid={`filmstrip-delete-${chapterKey}-${stepKey}`}
                  onClick={() =>
                    props.onRequestDelete(chapterKey, stepKey, title, chapterTitle, isLastStep)
                  }
                  text="Delete"
                  tone="critical"
                />
              </Menu>
            }
          />
        </div>
      </Flex>
    </Card>
  )
}

interface ChapterHeaderProps {
  chapterKey: string
  chapterTitle: string
  stepCount: number
  onAddStep: (chapterKey: string) => void
  onAddChapter: (afterChapterKey: string | null) => void
}

function ChapterHeader(props: ChapterHeaderProps): ReactNode {
  return (
    <Flex align="center" justify="space-between" padding={2}>
      <Text data-testid={`filmstrip-chapter-${props.chapterKey}`} size={1} weight="semibold">
        {props.chapterTitle} ({props.stepCount})
      </Text>
      <Inline gap={1}>
        <Button
          data-testid={`filmstrip-add-step-${props.chapterKey}`}
          fontSize={0}
          mode="bleed"
          onClick={() => props.onAddStep(props.chapterKey)}
          padding={2}
          text="+ Step"
        />
        <Button
          data-testid={`filmstrip-add-chapter-${props.chapterKey}`}
          fontSize={0}
          mode="bleed"
          onClick={() => props.onAddChapter(props.chapterKey)}
          padding={2}
          text="+ Chapter"
        />
      </Inline>
    </Flex>
  )
}

function confirmDialogText(action: PendingDelete | PendingMove): string {
  if (action.kind === 'delete') {
    return action.isLastStep
      ? `"${action.stepTitle}" is the only step in "${action.chapterTitle}" — deleting it will also delete the chapter.`
      : `Delete "${action.stepTitle}"?`
  }

  return `Moving "${action.stepTitle}" will leave "${action.chapterTitle}" with no steps, so it will also be deleted.`
}

export interface FilmstripProps {
  chapters: unknown[]
  selection: EditorSelection
  projectId: string | null
  dataset: string | null
  onSelectStep: (chapterKey: string, stepKey: string) => void
  callbacks: StepMutationCallbacks
}

/** The filmstrip pane: chapter-grouped step thumbnails, reorder/duplicate/move/delete via a per-step menu, and add-step/add-chapter per chapter header. */
export function Filmstrip(props: FilmstripProps): ReactNode {
  const [draggedStep, setDraggedStep] = useState<DraggedStep | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  const chapterOptions: ChapterOption[] = props.chapters.reduce<ChapterOption[]>((acc, chapter) => {
    const key = keyOf(chapter)
    if (key === null) return acc
    acc.push({key, title: stringField(chapter, 'title') ?? 'Chapter'})
    return acc
  }, [])

  const totalSteps = props.chapters.reduce<number>(
    (sum, chapter) => sum + stepsOf(chapter).length,
    0,
  )

  function handleDragStart(chapterKey: string, stepKey: string): void {
    setDraggedStep({chapterKey, stepKey})
  }

  function handleDragEnd(): void {
    setDraggedStep(null)
  }

  // See this file's module comment: cross-chapter drag is a deliberate,
  // ledger-ruled deferral. Only allow the drop to register (by calling
  // `preventDefault` — an HTML5 DnD drop target must do this to accept a
  // drop at all) when the dragged step's chapter matches the row it's
  // currently over; a drag that crosses into a different chapter's list
  // never becomes a valid drop target, so `handleDrop` below is never
  // reached for it.
  function handleDragOver(event: DragEvent<HTMLDivElement>, chapterKey: string): void {
    if (!draggedStep || draggedStep.chapterKey !== chapterKey) return
    event.preventDefault()
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
    chapterKey: string,
    targetIndex: number,
  ): void {
    if (!draggedStep || draggedStep.chapterKey !== chapterKey) return
    event.preventDefault()
    props.callbacks.onReorderStep(chapterKey, draggedStep.stepKey, targetIndex)
    setDraggedStep(null)
  }

  function requestDelete(
    chapterKey: string,
    stepKey: string,
    stepTitle: string,
    chapterTitle: string,
    isLastStep: boolean,
  ): void {
    setPendingAction({kind: 'delete', chapterKey, stepKey, stepTitle, chapterTitle, isLastStep})
  }

  function requestMove(
    chapterKey: string,
    stepKey: string,
    stepTitle: string,
    chapterTitle: string,
    toChapterKey: string,
    toChapterTitle: string,
    isLastStep: boolean,
  ): void {
    // Only the last-step case has a consequence worth confirming (the
    // source chapter also disappears) — an ordinary move runs immediately,
    // matching the brief's plain "menu item click moves the step" shape.
    if (!isLastStep) {
      props.callbacks.onMoveStepToChapter(chapterKey, stepKey, toChapterKey)
      return
    }
    setPendingAction({
      kind: 'move',
      chapterKey,
      stepKey,
      stepTitle,
      chapterTitle,
      toChapterKey,
      toChapterTitle,
    })
  }

  function confirmPendingAction(): void {
    if (pendingAction === null) return
    if (pendingAction.kind === 'delete') {
      props.callbacks.onDeleteStep(pendingAction.chapterKey, pendingAction.stepKey)
    } else {
      props.callbacks.onMoveStepToChapter(
        pendingAction.chapterKey,
        pendingAction.stepKey,
        pendingAction.toChapterKey,
      )
    }
    setPendingAction(null)
  }

  return (
    <Card borderRight padding={2} style={{minWidth: 260, overflowY: 'auto'}}>
      <Stack gap={3}>
        {totalSteps === 0 && (
          <Text muted size={1}>
            No steps yet.
          </Text>
        )}
        {props.chapters.map((chapter) => {
          const chapterKey = keyOf(chapter)
          if (chapterKey === null) return null
          const chapterTitle = stringField(chapter, 'title') ?? 'Chapter'
          const steps = stepsOf(chapter)
          const otherChapters = chapterOptions.filter((option) => option.key !== chapterKey)

          return (
            <Stack data-testid={`filmstrip-group-${chapterKey}`} gap={2} key={chapterKey}>
              <ChapterHeader
                chapterKey={chapterKey}
                chapterTitle={chapterTitle}
                onAddChapter={props.callbacks.onAddChapter}
                onAddStep={props.callbacks.onAddStep}
                stepCount={steps.length}
              />
              <Stack gap={1}>
                {steps.map((step, index) => {
                  const stepKey = keyOf(step)
                  const selected =
                    chapterKey === props.selection.chapterKey && stepKey === props.selection.stepKey
                  return (
                    <StepRow
                      arrayIndex={index}
                      callbacks={props.callbacks}
                      chapterKey={chapterKey}
                      chapterTitle={chapterTitle}
                      dataset={props.dataset}
                      dragging={
                        draggedStep?.chapterKey === chapterKey && draggedStep.stepKey === stepKey
                      }
                      key={stepKey ?? index}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDragStart={handleDragStart}
                      onDrop={handleDrop}
                      onRequestDelete={requestDelete}
                      onRequestMove={requestMove}
                      onSelectStep={props.onSelectStep}
                      otherChapters={otherChapters}
                      projectId={props.projectId}
                      selected={selected}
                      step={step}
                      totalInChapter={steps.length}
                    />
                  )
                })}
              </Stack>
            </Stack>
          )
        })}
        {chapterOptions.length === 0 && (
          <Button
            data-testid="filmstrip-add-chapter-empty"
            mode="bleed"
            onClick={() => props.callbacks.onAddChapter(null)}
            text="+ Chapter"
          />
        )}
      </Stack>

      {pendingAction && (
        // The same `Dialog` idiom `CanvasInput.tsx`'s "Open full editor"
        // escape valve establishes (`@sanity/ui` 3.5.1 has no dedicated
        // confirm-dialog component). Nested inside this pane rather than
        // at the outermost `CanvasInput` tree, but `Dialog` renders
        // through a portal (`@sanity/ui`'s `Layer`/`Portal`), so it still
        // layers above the rest of the editor regardless.
        <Dialog
          data-testid="filmstrip-confirm-dialog"
          footer={
            <Flex gap={2} justify="flex-end" padding={3}>
              <Button
                data-testid="filmstrip-confirm-cancel"
                mode="bleed"
                onClick={() => setPendingAction(null)}
                text="Cancel"
              />
              <Button
                data-testid="filmstrip-confirm-confirm"
                onClick={confirmPendingAction}
                text={pendingAction.kind === 'delete' ? 'Delete' : 'Move'}
                tone="critical"
              />
            </Flex>
          }
          header={pendingAction.kind === 'delete' ? 'Delete step' : 'Move step'}
          id="filmstrip-confirm-dialog"
          onClose={() => setPendingAction(null)}
          width={1}
        >
          <Box padding={4}>
            <Text size={1}>{confirmDialogText(pendingAction)}</Text>
          </Box>
        </Dialog>
      )}
    </Card>
  )
}
