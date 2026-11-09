// One absolutely positioned element chip on the canvas (master plan
// Task 5): a drag handle (pointer capture + live position reported to
// `Canvas.tsx`, which owns the actual patch commit on pointerup), keyboard
// nudge/delete/escape when focused, and — for tooltip/textOverlay — a width
// resize handle. All position/width *values* are resolved by the caller
// (`Canvas.tsx`'s `resolvedPosition`/`resolvedWidth`, device-aware and
// live-drag-aware); this component only renders them and reports pointer/
// keyboard intent upward. No `sanity` import — testable with plain
// `fireEvent.pointerDown`/`keyDown`.
import {Badge, Box, Card, Text} from '@sanity/ui'
import type {KeyboardEvent, PointerEvent, ReactNode} from 'react'
import {useState} from 'react'

import type {ElementKind} from './canvasHandlers'

const KIND_LABEL: Record<ElementKind, string> = {
  hotspot: 'Hotspot',
  tooltip: 'Tooltip',
  textOverlay: 'Text overlay',
}

export interface CanvasElementProps {
  elementKey: string
  kind: ElementKind
  /** Resolved position in percent (device-aware; live drag position while this element is being dragged). */
  x: number
  y: number
  /** Resolved width (px for tooltip, percent for textOverlay); `undefined` for kinds without a width field. */
  width?: number
  resizable: boolean
  selected: boolean
  /** Whether this element carries a `mobile` position/width override — shown as a small badge. */
  hasOverride: boolean
  accessibleName: string
  describedBy?: string
  onSelect: () => void
  onDeselect: () => void
  onDragMove: (clientX: number, clientY: number) => void
  onDragEnd: (clientX: number, clientY: number) => void
  onResizeStart: (clientX: number) => void
  onResizeMove: (clientX: number) => void
  onResizeEnd: (clientX: number) => void
  onNudge: (axis: 'x' | 'y', direction: -1 | 1, big: boolean) => void
  onDelete: () => void
}

/** One positioned hotspot/tooltip/textOverlay chip: drag, keyboard nudge/delete/escape, and (resizable kinds) a width handle. */
export function CanvasElement(props: CanvasElementProps): ReactNode {
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  // Keep the editing control reachable at the image edges without changing
  // the stored anchor. Tooltip pixels are an authoring guide; overlays use
  // the screenshot's percentage width.
  const halfWidth =
    props.kind === 'hotspot'
      ? '14px'
      : props.kind === 'textOverlay'
        ? `${(props.width ?? 30) / 2}%`
        : `${(props.width ?? 300) / 2}px`
  const anchorStyle: Record<string, string> = {
    '--gt-anchor-x': `${props.x}%`,
    '--gt-anchor-y': `${props.y}%`,
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    // Stops the click from also reaching the canvas surface's
    // click-to-place handler (Canvas.tsx) — selecting/dragging an existing
    // element must never also insert a new one under the cursor.
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    props.onSelect()
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!dragging) return
    props.onDragMove(event.clientX, event.clientY)
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (!dragging) return
    setDragging(false)
    props.onDragEnd(event.clientX, event.clientY)
  }

  function handleResizePointerDown(event: PointerEvent<HTMLDivElement>): void {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizing(true)
    props.onResizeStart(event.clientX)
  }

  function handleResizePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!resizing) return
    props.onResizeMove(event.clientX)
  }

  function handleResizePointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (!resizing) return
    setResizing(false)
    props.onResizeEnd(event.clientX)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const big = event.shiftKey
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault()
        props.onSelect()
        return
      case 'ArrowUp':
        event.preventDefault()
        props.onNudge('y', -1, big)
        return
      case 'ArrowDown':
        event.preventDefault()
        props.onNudge('y', 1, big)
        return
      case 'ArrowLeft':
        event.preventDefault()
        props.onNudge('x', -1, big)
        return
      case 'ArrowRight':
        event.preventDefault()
        props.onNudge('x', 1, big)
        return
      case 'Delete':
      case 'Backspace':
        event.preventDefault()
        props.onDelete()
        return
      case 'Escape':
        event.preventDefault()
        props.onDeselect()
        return
      default:
    }
  }

  return (
    // A real `<button>` can't host this: it needs percent-based
    // `left`/`top` positioning plus pointer-capture drag handling on
    // itself, and (for resizable kinds) a second independently
    // pointer-capturing resize handle nested inside it — interactive
    // content nested inside a `<button>` is invalid HTML, so `role="button"`
    // on a `Box` (a styled `div`) is the deliberate choice here, same
    // rationale as `react/Tooltip.tsx`'s `role="group"`.
    <Card
      aria-label={props.accessibleName}
      aria-pressed={props.selected}
      aria-describedby={props.describedBy}
      tone={props.selected ? 'primary' : 'default'}
      data-testid={`canvas-element-${props.elementKey}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="button"
      style={{
        ...anchorStyle,
        alignItems: 'center',
        cursor: 'grab',
        display: 'flex',
        gap: 4,
        border:
          props.kind === 'hotspot'
            ? '2px solid var(--card-focus-ring-color, #2276fc)'
            : '2px solid var(--card-border-color, #999)',
        borderRadius: props.kind === 'hotspot' ? '50%' : 6,
        boxSizing: 'border-box',
        minHeight: props.kind === 'hotspot' ? 28 : 40,
        width:
          props.kind === 'hotspot'
            ? 28
            : props.kind === 'textOverlay'
              ? `${props.width}%`
              : props.width,
        minWidth: 28,
        maxWidth: '100%',
        padding: props.kind === 'hotspot' ? 0 : '6px 14px 6px 8px',
        justifyContent: 'center',
        left: `clamp(min(50%, ${halfWidth}), var(--gt-anchor-x), max(50%, calc(100% - ${halfWidth})))`,
        outline: props.selected ? '2px solid var(--card-focus-ring-color, #2276fc)' : undefined,
        outlineOffset: 2,
        position: 'absolute',
        top: 'clamp(20px, var(--gt-anchor-y), calc(100% - 20px))',
        transform: 'translate(-50%, -50%)',
      }}
      tabIndex={0}
    >
      <Box
        data-testid={`canvas-element-${props.elementKey}-badge`}
        style={{minWidth: 0, overflow: 'hidden'}}
      >
        {props.kind === 'hotspot' ? (
          <span aria-hidden>●</span>
        ) : (
          <Text size={1} textOverflow="ellipsis" weight="semibold">
            {props.accessibleName || KIND_LABEL[props.kind]}
          </Text>
        )}
      </Box>
      {props.hasOverride && (
        <Badge
          data-testid={`canvas-element-${props.elementKey}-override`}
          title="Has a mobile override"
          tone="caution"
          style={{position: 'absolute', top: -10, right: -8, pointerEvents: 'none'}}
        >
          M
        </Badge>
      )}
      {props.resizable &&
        props.width !== undefined && (
          // Pointer-only for now (`aria-hidden`, no keyboard handler) —
          // there's no keyboard path to resize width yet; deferred, not
          // forgotten.
          <Box
            aria-hidden
            data-testid={`canvas-element-${props.elementKey}-resize`}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            style={{
              background: 'var(--card-border-color, #999)',
              cursor: 'ew-resize',
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              borderRadius: '0 4px 4px 0',
              width: 8,
            }}
          />
        )}
    </Card>
  )
}
