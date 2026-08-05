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
import {Box, Button, Card, Flex, Inline, Text} from '@sanity/ui'
import type {MouseEvent, ReactNode} from 'react'
import {useRef, useState} from 'react'

import {assetRefToUrl} from './assetRef'
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
    setResizeState({
      key: elementKey,
      kind,
      startWidth,
      startClientX: clientX,
      currentWidth: startWidth,
    })
  }

  function handleResizeMove(clientX: number): void {
    setResizeState((current) => {
      if (!current) return current
      const rect = measureRect()
      const rectWidth = rect ? rect.width : 0
      const currentWidth = resizeWidth(
        current.kind,
        current.startWidth,
        clientX - current.startClientX,
        rectWidth,
      )
      return {...current, currentWidth}
    })
  }

  function handleResizeEnd(clientX: number): void {
    setResizeState((current) => {
      if (!current) return null
      const rect = measureRect()
      const rectWidth = rect ? rect.width : 0
      const width = resizeWidth(
        current.kind,
        current.startWidth,
        clientX - current.startClientX,
        rectWidth,
      )
      props.onResizeElement(current.key, width)
      return null
    })
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

  return (
    <Flex direction="column" flex={1} style={{minHeight: 0, minWidth: 0}}>
      <Card borderBottom padding={2}>
        <Inline gap={1}>
          {TOOLS.map((entry) => (
            <Button
              aria-pressed={tool === entry.tool}
              data-testid={`canvas-tool-${entry.tool}`}
              key={entry.tool}
              mode={tool === entry.tool ? 'default' : 'bleed'}
              onClick={() => setTool(entry.tool)}
              text={entry.label}
            />
          ))}
        </Inline>
      </Card>
      <Box flex={1} padding={4} style={{overflow: 'auto'}}>
        {props.step === null ? (
          <Text muted size={1}>
            Select a step to see its screenshot.
          </Text>
        ) : !assetRef ? (
          <Text muted size={1}>
            This step has no screenshot yet.
          </Text>
        ) : (
          // Click-to-place has no keyboard equivalent to delegate to — the
          // whole point is the click's *coordinates* (converted to a
          // percent position via `pointToPercent`), which a key event
          // doesn't carry. Placement is still fully keyboard-reachable
          // otherwise: an inserted element is auto-selected and nudgeable
          // via `CanvasElement`'s arrow-key handling. No ARIA role fits a
          // screenshot-with-overlays surface either, same
          // `prefer-tag-over-role` false-positive shape as
          // `react/GuidedTour.tsx`'s progress bar.
          // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div
            data-testid="canvas-surface"
            onClick={handleSurfaceClick}
            ref={wrapperRef}
            style={{
              cursor: tool === 'select' ? 'default' : 'crosshair',
              display: 'inline-block',
              position: 'relative',
            }}
          >
            {url ? (
              <img
                alt={alt}
                data-testid="canvas-screenshot"
                src={url}
                style={{display: 'block', height: 'auto', maxWidth: '100%'}}
              />
            ) : (
              <Card padding={4} radius={2}>
                <Text data-testid="canvas-screenshot-placeholder" muted size={1}>
                  Screenshot: {assetRef}
                </Text>
              </Card>
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
                  elementKey={elementKeyValue}
                  hasOverride={hasMobileOverride(element)}
                  key={elementKeyValue}
                  kind={kind}
                  onDelete={() => props.onRemoveElement(elementKeyValue)}
                  onDeselect={() => props.onSelectElement(null)}
                  onDragEnd={(clientX, clientY) => handleDragEnd(elementKeyValue, clientX, clientY)}
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
    </Flex>
  )
}
