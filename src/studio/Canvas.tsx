// The canvas pane (master plan Task 5): the selected step's screenshot at
// natural aspect ratio, a tool palette for placing new elements, and every
// element rendered as a draggable/nudgeable/resizable `CanvasElement` chip
// on top of it. This component only ever *reports* intent upward
// (`onInsertElement`/`onMoveElement`/`onResizeElement`/`onRemoveElement`/
// `onSelectElement`) — it builds no patches and touches no `sanity` form
// APIs itself; `CanvasInput.tsx` (the caller) turns those callbacks into
// `patches.ts` builders wrapped in `PatchEvent.from(...)` and its own
// `props.onChange`. That split is what keeps this file testable with plain
// `fireEvent` pointer/keyboard simulation and no `sanity` mocking.
//
// `projectId`/`dataset` arrive as plain props rather than this component
// calling `useProjectDataset()` itself (design spec's Task 5 additional
// scope): `CanvasInput` is the one Studio-context-aware caller, and
// threading the resolved values down keeps `Canvas`/`CanvasElement` free of
// any `sanity` runtime dependency, so smoke tests can render them with
// nothing more than `@sanity/ui`'s `ThemeProvider`.
import {Badge, Box, Button, Card, Flex, Inline, Stack, Text} from '@sanity/ui'
import type {MouseEvent, ReactNode} from 'react'
import {useId, useRef, useState} from 'react'

import {assetRefDimensions, assetRefToUrl} from './assetRef'
import {CanvasElement} from './CanvasElement'
import {
  type ElementKind,
  elementAccessibleName,
  elementDefaults,
  elementKind,
  hasMobileOverride,
  isResizableKind,
  resizeWidth,
  resolvedPosition,
  resolvedWidth,
} from './canvasHandlers'
import type {Rect} from './geometry'
import {nudge, pointToPercent} from './geometry'
import {randomKey} from './keys'

type Tool = 'select' | ElementKind

const TOOLS: {tool: Tool; label: string}[] = [
  {tool: 'select', label: 'Select'},
  {tool: 'hotspot', label: '+ Hotspot'},
  {tool: 'tooltip', label: '+ Tooltip'},
  {tool: 'textOverlay', label: '+ Text overlay'},
]

/** A newly placed element's width before any resize — mirrors `canvasHandlers.ts`'s `elementDefaults`, used only as a defensive fallback if `resolvedWidth` ever comes back `undefined` for a resizable kind. */
const DEFAULT_WIDTH: Record<'tooltip' | 'textOverlay', number> = {tooltip: 300, textOverlay: 30}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringField(value: unknown, field: string): string | undefined {
  return isRecord(value) && typeof value[field] === 'string' ? value[field] : undefined
}

function elementsOf(step: unknown): Record<string, unknown>[] {
  if (!isRecord(step) || !Array.isArray(step.elements)) return []
  return step.elements.filter(isRecord)
}

/** `screenshotMobile ?? screenshot` when `device` is mobile, else `screenshot` — same fallback `CanvasInput.tsx`'s Task 4 placeholder used. */
function screenshotFor(step: unknown, device: 'desktop' | 'mobile'): unknown {
  if (device === 'mobile') {
    const mobile = isRecord(step) ? step.screenshotMobile : undefined
    if (isRecord(mobile)) return mobile
  }
  return isRecord(step) ? step.screenshot : undefined
}

function screenshotAssetRef(image: unknown): string | undefined {
  if (!isRecord(image)) return undefined
  const asset = image.asset
  return isRecord(asset) && typeof asset._ref === 'string' ? asset._ref : undefined
}

/**
 * Whether the selected step carries a `video` object at all (M11 Task 3) —
 * presence alone, not a check that `file`/`url` actually resolves: the
 * canvas backdrop stays the SCREENSHOT either way (module comment), so this
 * only decides whether the small "Video" badge below renders, not what
 * image is shown. Mirrors `screenshotAssetRef`'s own "narrow from `unknown`"
 * convention.
 */
function hasVideoField(step: unknown): boolean {
  return isRecord(step) && isRecord(step.video)
}

interface DragPosition {
  key: string
  x: number
  y: number
}

interface ResizeState {
  key: string
  kind: 'tooltip' | 'textOverlay'
  startWidth: number
  startClientX: number
  currentWidth: number
}

export interface CanvasProps {
  /** The selected step's raw value, or `null` when nothing is selected. */
  step: unknown
  device: 'desktop' | 'mobile'
  selectedElementKey: string | null
  /** Opens the selected step's details pane without constructing form paths here. */
  onEditStep?: () => void
  /** Opens the real step form directly when its screenshot is missing. */
  onAddScreenshot?: () => void
  onSelectElement: (elementKey: string | null) => void
  onInsertElement: (
    element: {_type: string; _key: string; x: number; y: number} & Record<string, unknown>,
  ) => void
  onMoveElement: (elementKey: string, pos: {x: number; y: number}) => void
  onResizeElement: (elementKey: string, width: number) => void
  onRemoveElement: (elementKey: string) => void
  projectId: string | null
  dataset: string | null
}

/** The canvas pane: tool palette, screenshot, and every element positioned on top of it. */
export function Canvas(props: CanvasProps): ReactNode {
  const [tool, setTool] = useState<Tool>('select')
  const [dragPosition, setDragPosition] = useState<DragPosition | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hintId = useId()

  // A ref mirror of `resizeState`, updated in lockstep by every setter
  // below (`setResize`). React state updater callbacks must stay pure —
  // StrictMode double-invokes them in dev to catch violations — so
  // `handleResizeEnd` can't compute the final width AND call
  // `props.onResizeElement` (which round-trips into a `PatchEvent` via
  // `CanvasInput.tsx`'s `onChange`) from inside a `setResizeState(current
  // => ...)` updater: doing that would fire the patch twice under
  // StrictMode. Reading the ref instead — a plain, non-reactive value,
  // safe to read from an ordinary (non-updater) event handler — lets
  // `handleResizeEnd` compute the width and call the side effect as
  // regular sequential code, with the state write (`setResizeState`,
  // for re-rendering the live resize width) kept separate and pure.
  const resizeStateRef = useRef<ResizeState | null>(null)

  function setResize(next: ResizeState | null): void {
    resizeStateRef.current = next
    setResizeState(next)
  }

  function measureRect(): Rect | null {
    const el = wrapperRef.current
    if (!el) return null
    const domRect = el.getBoundingClientRect()
    return {left: domRect.left, top: domRect.top, width: domRect.width, height: domRect.height}
  }

  function handleSurfaceClick(event: MouseEvent<HTMLDivElement>): void {
    if (tool === 'select') return
    const rect = measureRect()
    if (!rect) return
    const pos = pointToPercent(event.clientX, event.clientY, rect)
    placeElement(pos)
  }

  function placeElement(pos: {x: number; y: number}): void {
    if (tool === 'select') return
    const element = elementDefaults(tool, randomKey(), pos)
    props.onInsertElement(element)
    props.onSelectElement(element._key)
    setTool('select')
  }

  function handleDragMove(elementKey: string, clientX: number, clientY: number): void {
    const rect = measureRect()
    if (!rect) return
    const pos = pointToPercent(clientX, clientY, rect)
    setDragPosition({key: elementKey, x: pos.x, y: pos.y})
  }

  function handleDragEnd(elementKey: string, clientX: number, clientY: number): void {
    const rect = measureRect()
    setDragPosition(null)
    if (!rect) return
    const pos = pointToPercent(clientX, clientY, rect)
    props.onMoveElement(elementKey, pos)
  }

  function handleResizeStart(
    elementKey: string,
    kind: ElementKind,
    startWidth: number,
    clientX: number,
  ): void {
    if (!isResizableKind(kind)) return
    setResize({
      key: elementKey,
      kind,
      startWidth,
      startClientX: clientX,
      currentWidth: startWidth,
    })
  }

  function handleResizeMove(clientX: number): void {
    const current = resizeStateRef.current
    if (!current) return
    const rect = measureRect()
    const rectWidth = rect ? rect.width : 0
    const currentWidth = resizeWidth(
      current.kind,
      current.startWidth,
      clientX - current.startClientX,
      rectWidth,
    )
    setResize({...current, currentWidth})
  }

  function handleResizeEnd(clientX: number): void {
    const current = resizeStateRef.current
    setResize(null)
    if (!current) return
    const rect = measureRect()
    const rectWidth = rect ? rect.width : 0
    const width = resizeWidth(
      current.kind,
      current.startWidth,
      clientX - current.startClientX,
      rectWidth,
    )
    props.onResizeElement(current.key, width)
  }

  function handleNudge(
    elementKey: string,
    element: Record<string, unknown>,
    axis: 'x' | 'y',
    direction: -1 | 1,
    big: boolean,
  ): void {
    const pos = resolvedPosition(element, props.device)
    const nextPos =
      axis === 'x'
        ? {x: nudge(pos.x, direction, big), y: pos.y}
        : {x: pos.x, y: nudge(pos.y, direction, big)}
    props.onMoveElement(elementKey, nextPos)
  }

  const screenshot = screenshotFor(props.step, props.device)
  const assetRef = screenshotAssetRef(screenshot)
  const stepTitle = stringField(props.step, 'title') ?? ''
  const alt = stringField(screenshot, 'alt') || stepTitle
  const url =
    assetRef && props.projectId && props.dataset
      ? assetRefToUrl(assetRef, props.projectId, props.dataset)
      : null
  const elements = elementsOf(props.step)
  const selectedElement = elements.find((element) => element._key === props.selectedElementKey)
  const dimensions = assetRef ? assetRefDimensions(assetRef) : null
  const aspectRatio =
    dimensions && dimensions.width > 0 && dimensions.height > 0
      ? dimensions.width / dimensions.height
      : null

  return (
    <Flex direction="column" flex={1} style={{minHeight: 0, minWidth: 0}}>
      <Card borderBottom padding={2}>
        <Flex align="center" gap={2} justify="space-between" padding={2} wrap="wrap">
          <Text size={1} weight="semibold">
            {stepTitle || 'Screenshot canvas'}
          </Text>
          {props.step !== null && props.onEditStep && (
            <Button mode="bleed" text="Step details" onClick={props.onEditStep} />
          )}
        </Flex>
        <Inline gap={1}>
          {TOOLS.map((entry) => (
            <Button
              aria-pressed={tool === entry.tool}
              data-testid={`canvas-tool-${entry.tool}`}
              disabled={entry.tool !== 'select' && !assetRef}
              key={entry.tool}
              mode={tool === entry.tool ? 'default' : 'bleed'}
              onClick={() => setTool(entry.tool)}
              text={entry.label}
            />
          ))}
        </Inline>
        {assetRef && (
          <Stack gap={2} padding={2}>
            <Text id={hintId} as="output" aria-live="polite" size={1} muted>
              {tool === 'select'
                ? selectedElement
                  ? `${elementAccessibleName(selectedElement).split(':')[0]} selected. Drag to move; arrow keys nudge, Shift + arrow moves farther. Delete removes.`
                  : 'Select an element to edit it, or choose a tool to add one.'
                : `Click the screenshot to place ${tool === 'textOverlay' ? 'a text overlay' : `a ${tool}`}.`}
            </Text>
            {tool !== 'select' && (
              <Inline gap={2}>
                <Button
                  text="Place in center"
                  mode="ghost"
                  tone="primary"
                  onClick={() => placeElement({x: 50, y: 50})}
                />
                <Button text="Cancel placement" mode="bleed" onClick={() => setTool('select')} />
              </Inline>
            )}
            {props.device === 'mobile' && (
              <Card padding={3} radius={2} tone="caution">
                <Text size={1}>
                  Moving or resizing here changes only the mobile layout.
                  {!isRecord(props.step) || !isRecord(props.step.screenshotMobile)
                    ? ' Using the desktop screenshot until you add a mobile screenshot in Step details.'
                    : ''}
                </Text>
              </Card>
            )}
          </Stack>
        )}
      </Card>
      <Box flex={1} padding={3} style={{minHeight: 0, overflow: 'auto'}}>
        <Box data-testid="canvas-stage" style={{height: '100%', containerType: 'size'}}>
          {props.step === null ? (
            <Stack gap={3}>
              <Text weight="semibold" size={2}>
                Build your tour from screenshots
              </Text>
              <Text muted size={1}>
                Select a step to see its screenshot.
              </Text>
              <Text muted size={1}>
                Start in Steps: add a chapter, then upload screenshots. Each screenshot becomes a
                step.
              </Text>
            </Stack>
          ) : !assetRef ? (
            <Stack gap={3}>
              <Text weight="semibold" size={2}>
                Add a screenshot to this step
              </Text>
              <Text muted size={1}>
                This step has no screenshot yet.
              </Text>
              <Text muted size={1}>
                Upload a screenshot and add descriptive alt text in this step's fields.
              </Text>
              {props.onAddScreenshot && (
                <Button
                  text="Add screenshot"
                  mode="ghost"
                  tone="primary"
                  onClick={props.onAddScreenshot}
                />
              )}
            </Stack>
          ) : (
            // Pointer placement supplies exact coordinates. Keyboard users
            // can use Place in center above, then nudge via the element.
            // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div
              data-testid="canvas-surface"
              onClick={handleSurfaceClick}
              ref={wrapperRef}
              style={{
                cursor: tool === 'select' ? 'default' : 'crosshair',
                display: 'block',
                marginInline: 'auto',
                width: aspectRatio ? `min(100%, ${aspectRatio * 100}cqh)` : '100%',
                aspectRatio: aspectRatio ?? undefined,
                position: 'relative',
              }}
            >
              {url ? (
                <img
                  alt={alt}
                  data-testid="canvas-screenshot"
                  src={url}
                  style={{display: 'block', height: 'auto', width: '100%'}}
                />
              ) : (
                <Card padding={4} radius={2}>
                  <Text data-testid="canvas-screenshot-placeholder" muted size={1}>
                    Screenshot: {assetRef}
                  </Text>
                </Card>
              )}
              {hasVideoField(props.step) && (
                // Decorative status marker, not a control — labelled by its
                // own visible text (same convention `CanvasElement.tsx`'s "M"
                // mobile-override badge uses: readable text + a `title`, no
                // `aria-hidden`) rather than absorbing any pointer interaction
                // of its own. `pointerEvents: 'none'` keeps it out of hit
                // testing entirely so it can never swallow a click meant for
                // the click-to-place surface beneath it, on top of never
                // calling `stopPropagation`.
                <Badge
                  data-testid="canvas-video-badge"
                  style={{left: 8, pointerEvents: 'none', position: 'absolute', top: 8}}
                  title="This step has a video"
                  tone="primary"
                >
                  Video
                </Badge>
              )}
              {elements.map((element) => {
                const elementKeyValue = typeof element._key === 'string' ? element._key : undefined
                const kind = elementKind(element._type)
                if (!elementKeyValue || !kind) return null

                const resizable = isResizableKind(kind)
                const basePos = resolvedPosition(element, props.device)
                const pos =
                  dragPosition && dragPosition.key === elementKeyValue
                    ? {x: dragPosition.x, y: dragPosition.y}
                    : basePos
                const baseWidth = resizable
                  ? (resolvedWidth(element, props.device) ?? DEFAULT_WIDTH[kind])
                  : undefined
                const width =
                  resizable && resizeState && resizeState.key === elementKeyValue
                    ? resizeState.currentWidth
                    : baseWidth

                return (
                  <CanvasElement
                    accessibleName={elementAccessibleName(element)}
                    describedBy={hintId}
                    elementKey={elementKeyValue}
                    hasOverride={hasMobileOverride(element)}
                    key={elementKeyValue}
                    kind={kind}
                    onDelete={() => props.onRemoveElement(elementKeyValue)}
                    onDeselect={() => props.onSelectElement(null)}
                    onDragEnd={(clientX, clientY) =>
                      handleDragEnd(elementKeyValue, clientX, clientY)
                    }
                    onDragMove={(clientX, clientY) =>
                      handleDragMove(elementKeyValue, clientX, clientY)
                    }
                    onNudge={(axis, direction, big) =>
                      handleNudge(elementKeyValue, element, axis, direction, big)
                    }
                    onResizeEnd={handleResizeEnd}
                    onResizeMove={handleResizeMove}
                    onResizeStart={(clientX) => {
                      // `baseWidth` is only ever `undefined` when `!resizable`
                      // (line ~293) — and `CanvasElement` only wires up the
                      // resize handle that fires this callback when
                      // `resizable && width !== undefined` — so this guard
                      // never actually fires; it's here so this closure
                      // doesn't need a placeholder default (the old
                      // `DEFAULT_WIDTH.tooltip` fallback was always dead code,
                      // and wrong for textOverlay besides).
                      if (baseWidth === undefined) return
                      handleResizeStart(elementKeyValue, kind, baseWidth, clientX)
                    }}
                    onSelect={() => props.onSelectElement(elementKeyValue)}
                    resizable={resizable}
                    selected={props.selectedElementKey === elementKeyValue}
                    width={width}
                    x={pos.x}
                    y={pos.y}
                  />
                )
              })}
            </div>
          )}
        </Box>
      </Box>
    </Flex>
  )
}
