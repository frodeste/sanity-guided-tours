import {describe, expect, test} from 'bun:test'

import {
  clampPercent,
  hitTest,
  nearestKey,
  nudge,
  pointToPercent,
  type Rect,
} from '../../src/studio/geometry'
import {randomKey} from '../../src/studio/keys'

describe('clampPercent', () => {
  test('leaves an in-range value untouched', () => {
    expect(clampPercent(42)).toBe(42)
  })

  test('clamps below 0 up to 0', () => {
    expect(clampPercent(-5)).toBe(0)
  })

  test('clamps above 100 down to 100', () => {
    expect(clampPercent(150)).toBe(100)
  })

  test('rounds to 1 decimal place', () => {
    expect(clampPercent(33.333333)).toBe(33.3)
  })
})

describe('pointToPercent', () => {
  // Letterboxed canvas: the screenshot doesn't fill its container, so the
  // image rect is offset from the viewport origin. Percent must be relative
  // to the rect, not the viewport.
  test('is relative to a rect offset from the viewport origin', () => {
    const rect: Rect = {left: 100, top: 50, width: 200, height: 100}
    expect(pointToPercent(200, 100, rect)).toEqual({x: 50, y: 50})
  })

  test('rounds the result to 1 decimal place', () => {
    const rect: Rect = {left: 0, top: 0, width: 300, height: 300}
    // 100 / 300 * 100 = 33.333...
    expect(pointToPercent(100, 100, rect)).toEqual({x: 33.3, y: 33.3})
  })

  test('clamps a pointer left of/above the rect to 0', () => {
    const rect: Rect = {left: 100, top: 50, width: 200, height: 100}
    expect(pointToPercent(0, 0, rect)).toEqual({x: 0, y: 0})
  })

  test('clamps a pointer right of/below the rect to 100', () => {
    const rect: Rect = {left: 100, top: 50, width: 200, height: 100}
    expect(pointToPercent(1000, 1000, rect)).toEqual({x: 100, y: 100})
  })
})

describe('nudge', () => {
  test('small step moves by 0.5', () => {
    expect(nudge(50, 1, false)).toBe(50.5)
    expect(nudge(50, -1, false)).toBe(49.5)
  })

  test('big step moves by 5', () => {
    expect(nudge(50, 1, true)).toBe(55)
    expect(nudge(50, -1, true)).toBe(45)
  })

  test('clamps at the upper bound (99.8 + 0.5 -> 100)', () => {
    expect(nudge(99.8, 1, false)).toBe(100)
  })

  test('clamps at the lower bound (0.3 - 0.5 -> 0)', () => {
    expect(nudge(0.3, -1, false)).toBe(0)
  })

  test('big step also clamps at the bounds', () => {
    expect(nudge(98, 1, true)).toBe(100)
    expect(nudge(2, -1, true)).toBe(0)
  })
})

describe('hitTest', () => {
  const elements = [
    {_key: 'a', x: 10, y: 10},
    {_key: 'b', x: 50, y: 50},
    {_key: 'c', x: 90, y: 90},
  ]

  test('picks the nearest element within tolerance', () => {
    expect(hitTest(elements, 51, 51, 5)).toBe('b')
  })

  test('returns null when nothing is within tolerance', () => {
    expect(hitTest(elements, 51, 51, 1)).toBeNull()
  })

  test('breaks ties by first-in-array order', () => {
    const tied = [
      {_key: 'first', x: 10, y: 10},
      {_key: 'second', x: 10, y: 10},
    ]
    expect(hitTest(tied, 10, 10, 5)).toBe('first')
  })

  test('returns null for an empty array', () => {
    expect(hitTest([], 50, 50, 100)).toBeNull()
  })
})

describe('nearestKey', () => {
  const elements = [
    {_key: 'a', x: 10, y: 10},
    {_key: 'b', x: 50, y: 50},
    {_key: 'c', x: 90, y: 90},
  ]

  test('finds the nearest element regardless of distance', () => {
    expect(nearestKey(elements, 95, 95)).toBe('c')
  })

  test('breaks ties by first-in-array order', () => {
    const tied = [
      {_key: 'first', x: 10, y: 10},
      {_key: 'second', x: 10, y: 10},
    ]
    expect(nearestKey(tied, 0, 0)).toBe('first')
  })

  test('returns null for an empty array', () => {
    expect(nearestKey([], 50, 50)).toBeNull()
  })
})

describe('randomKey', () => {
  test('is 12 characters long', () => {
    expect(randomKey()).toHaveLength(12)
  })

  test('is lowercase hex/alnum', () => {
    expect(randomKey()).toMatch(/^[a-z0-9]{12}$/)
  })

  test('generates distinct keys across calls', () => {
    const keys = new Set(Array.from({length: 50}, () => randomKey()))
    expect(keys.size).toBe(50)
  })
})
