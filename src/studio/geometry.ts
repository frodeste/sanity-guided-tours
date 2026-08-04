// Pure module — no imports. Canvas geometry: pixel↔percent conversion,
// clamping and 1-decimal rounding (single source of truth, per master plan
// Global Constraints), keyboard nudge, and pointer hit-testing.

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Clamps a value to the 0–100 percent range, rounded to 1 decimal. */
export function clampPercent(value: number): number {
  return round1(Math.min(100, Math.max(0, value)))
}

/**
 * Converts a viewport point to a percentage position relative to `rect`
 * (the rendered screenshot's bounding rect — offset when the canvas is
 * letterboxed). Clamped to 0–100 on both axes, 1-decimal precision.
 */
export function pointToPercent(
  clientX: number,
  clientY: number,
  rect: Rect,
): {x: number; y: number} {
  const x = rect.width === 0 ? 0 : ((clientX - rect.left) / rect.width) * 100
  const y = rect.height === 0 ? 0 : ((clientY - rect.top) / rect.height) * 100
  return {x: clampPercent(x), y: clampPercent(y)}
}

/**
 * Keyboard nudge: moves `value` by 0.5 percentage points (`big: false`) or
 * 5 (`big: true`) in `direction`, clamped to 0–100.
 */
export function nudge(value: number, direction: -1 | 1, big: boolean): number {
  const step = big ? 5 : 0.5
  return clampPercent(value + direction * step)
}

/**
 * Returns the `_key` of the element nearest to (x, y) — Euclidean distance
 * in percent space — among those within `tolerancePercent`, or `null` if
 * none qualify. Ties (equal distance) resolve to whichever element comes
 * first in `elements`.
 */
export function hitTest(
  elements: {_key: string; x: number; y: number}[],
  x: number,
  y: number,
  tolerancePercent: number,
): string | null {
  let closestKey: string | null = null
  let closestDistance = Infinity

  for (const element of elements) {
    const dx = element.x - x
    const dy = element.y - y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance <= tolerancePercent && distance < closestDistance) {
      closestDistance = distance
      closestKey = element._key
    }
  }

  return closestKey
}

/**
 * Returns the `_key` of the element nearest to (x, y), with no tolerance
 * limit, or `null` for an empty list. Ties resolve to the first-in-array
 * element, matching `hitTest`.
 */
export function nearestKey(
  elements: {_key: string; x: number; y: number}[],
  x: number,
  y: number,
): string | null {
  return hitTest(elements, x, y, Infinity)
}
