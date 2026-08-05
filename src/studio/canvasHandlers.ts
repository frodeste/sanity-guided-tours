// Pure module — no imports. Logic pulled out of `Canvas.tsx`/
// `CanvasElement.tsx` so it stays unit-testable without pointer-event
// simulation (master plan Task 5 note: full drag simulation isn't required
// — Studio UI gets smoke tests only): the type-specific defaults a newly
// placed element gets, device-aware position/width resolution
// (`mobile.x ?? x`, mirroring `patches.ts`'s device-aware writes), the
// mobile-override badge condition, an element chip's accessible name, and
// the resize handle's pointer-delta-to-width math.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function numberField(value: unknown, field: string): number | undefined {
  return isRecord(value) && typeof value[field] === 'number' ? value[field] : undefined
}

/** The three element types the canvas tool palette can place — the internal names; `elementKind`/`SCHEMA_TYPE` map to/from the schema's `_type` strings (`guidedTourHotspot` etc). */
export type ElementKind = 'hotspot' | 'tooltip' | 'textOverlay'

/** The subset of `ElementKind`s that carry a `width` field and get a resize handle. */
export type ResizableKind = 'tooltip' | 'textOverlay'

const SCHEMA_TYPE: Record<ElementKind, string> = {
  hotspot: 'guidedTourHotspot',
  tooltip: 'guidedTourTooltip',
  textOverlay: 'guidedTourTextOverlay',
}

const KIND_LABEL: Record<ElementKind, string> = {
  hotspot: 'Hotspot',
  tooltip: 'Tooltip',
  textOverlay: 'Text overlay',
}

/** Reverse of `SCHEMA_TYPE`: an element's schema `_type` back to its internal kind, or `null` if unrecognized. */
export function elementKind(schemaType: unknown): ElementKind | null {
  if (schemaType === SCHEMA_TYPE.hotspot) return 'hotspot'
  if (schemaType === SCHEMA_TYPE.tooltip) return 'tooltip'
  if (schemaType === SCHEMA_TYPE.textOverlay) return 'textOverlay'
  return null
}

/** Whether `kind` carries a `width` field and should get a resize handle. */
export function isResizableKind(kind: ElementKind | null): kind is ResizableKind {
  return kind === 'tooltip' || kind === 'textOverlay'
}

/**
 * Type-appropriate defaults for a newly placed element (design spec §7.2,
 * master plan Task 5): hotspot advances on activation with a pulse; tooltip
 * and textOverlay start at their schema's `initialValue`s
 * (`elements/tooltip.ts`, `elements/textOverlay.ts`) with empty Portable
 * Text content, since the real content is authored afterward via the
 * Inspector's real member input (Task 7).
 */
export function elementDefaults(
  kind: ElementKind,
  key: string,
  pos: {x: number; y: number},
): {_type: string; _key: string; x: number; y: number} & Record<string, unknown> {
  const base = {_type: SCHEMA_TYPE[kind], _key: key, x: pos.x, y: pos.y}

  if (kind === 'hotspot') {
    return {...base, action: 'advance', pulse: true}
  }

  if (kind === 'tooltip') {
    return {...base, width: 300, placement: 'auto', trigger: 'click', content: []}
  }

  return {...base, width: 30, background: 'surface', opacity: 90, content: []}
}

/**
 * An element's effective x/y (design spec §7.2's device-aware fallback,
 * mirroring `patches.ts`'s `moveElementPatch`): `mobile.x ?? x` /
 * `mobile.y ?? y` per axis when `device` is mobile, else the top-level
 * x/y always.
 */
export function resolvedPosition(
  element: Record<string, unknown>,
  device: 'desktop' | 'mobile',
): {x: number; y: number} {
  const x = typeof element.x === 'number' ? element.x : 0
  const y = typeof element.y === 'number' ? element.y : 0
  if (device !== 'mobile') return {x, y}

  return {
    x: numberField(element.mobile, 'x') ?? x,
    y: numberField(element.mobile, 'y') ?? y,
  }
}

/** An element's effective width (`mobile.width ?? width` when mobile), or `undefined` for kinds without a width field (hotspot). */
export function resolvedWidth(
  element: Record<string, unknown>,
  device: 'desktop' | 'mobile',
): number | undefined {
  const width = typeof element.width === 'number' ? element.width : undefined
  if (device !== 'mobile') return width

  return numberField(element.mobile, 'width') ?? width
}

/** Whether an element carries any mobile override at all — the small badge `CanvasElement` shows. */
export function hasMobileOverride(element: Record<string, unknown>): boolean {
  const mobile = element.mobile
  if (!isRecord(mobile)) return false
  return (
    typeof mobile.x === 'number' || typeof mobile.y === 'number' || typeof mobile.width === 'number'
  )
}

function isTextBlockWithChildren(value: unknown): value is {children: Array<{text?: unknown}>} {
  return isRecord(value) && value._type === 'block' && Array.isArray(value.children)
}

/** The first Portable Text block's plain text, if any — same extraction `schema/elements/previewHelpers.ts`'s `firstPlainText` does for the element `prepare()`s, kept local here to avoid a studio→schema import for two lines of logic. */
function plainTextSnippet(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined
  const block = content.find(isTextBlockWithChildren)
  if (!block) return undefined
  const text = block.children
    .map((child) => (isRecord(child) && typeof child.text === 'string' ? child.text : ''))
    .join('')
    .trim()
  return text || undefined
}

/**
 * The element chip's accessible name (`aria-label`): element type plus a
 * label/content snippet when one exists, e.g. `"Hotspot: Settings menu"` or
 * just `"Hotspot"` when there's nothing to distinguish it by yet.
 */
export function elementAccessibleName(element: Record<string, unknown>): string {
  const kind = elementKind(element._type)
  const kindLabel = kind ? KIND_LABEL[kind] : 'Element'
  const label =
    typeof element.label === 'string' && element.label.trim() ? element.label : undefined
  const snippet = plainTextSnippet(element.content)
  const detail = label ?? snippet
  return detail ? `${kindLabel}: ${detail}` : kindLabel
}

const WIDTH_RANGE: Record<ResizableKind, {min: number; max: number}> = {
  tooltip: {min: 200, max: 600},
  textOverlay: {min: 10, max: 100},
}

function clampWidth(kind: ResizableKind, width: number): number {
  const {min, max} = WIDTH_RANGE[kind]
  return Math.min(max, Math.max(min, Math.round(width)))
}

/**
 * The new width for a resize drag: `deltaClientX` client pixels moved since
 * the drag started, applied to `startWidth`. `textOverlay`'s width is a
 * percentage of the screenshot's rendered width, so the pixel delta is
 * first converted to a percentage of `rectWidth` (the canvas surface's
 * on-screen width); `tooltip`'s width is itself in CSS pixels, so the
 * pixel delta applies 1:1. Clamped to each kind's schema `validation`
 * range (`elements/tooltip.ts`, `elements/textOverlay.ts`).
 */
export function resizeWidth(
  kind: ResizableKind,
  startWidth: number,
  deltaClientX: number,
  rectWidth: number,
): number {
  if (kind === 'textOverlay') {
    const deltaPercent = rectWidth === 0 ? 0 : (deltaClientX / rectWidth) * 100
    return clampWidth(kind, startWidth + deltaPercent)
  }

  return clampWidth(kind, startWidth + deltaClientX)
}
