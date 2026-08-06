import {describe, expect, test} from 'bun:test'

import {computeContainRect, percentToBox, percentToPoint} from '../../src/native/layout'

describe('computeContainRect', () => {
  test('height-bound: container wider than the image letterboxes left/right', () => {
    // Container 400x200 (aspect 2), image aspect 1 (square) -> height-bound.
    const rect = computeContainRect(400, 200, 1)
    expect(rect).toEqual({x: 100, y: 0, width: 200, height: 200})
  })

  test('width-bound: container taller than the image letterboxes top/bottom', () => {
    // Container 200x400 (aspect 0.5), image aspect 2 -> width-bound.
    const rect = computeContainRect(200, 400, 2)
    expect(rect).toEqual({x: 0, y: 150, width: 200, height: 100})
  })

  test('exact aspect match: no letterboxing on either axis', () => {
    const rect = computeContainRect(400, 200, 2)
    expect(rect).toEqual({x: 0, y: 0, width: 400, height: 200})
  })

  test('unmeasured container (0x0, onLayout not fired yet) returns a zero rect, not NaN', () => {
    const rect = computeContainRect(0, 0, 2)
    expect(rect).toEqual({x: 0, y: 0, width: 0, height: 0})
  })

  test('a non-finite/zero/negative aspect ratio falls back to filling the container with no offset', () => {
    expect(computeContainRect(100, 50, 0)).toEqual({x: 0, y: 0, width: 100, height: 50})
    expect(computeContainRect(100, 50, -1)).toEqual({x: 0, y: 0, width: 100, height: 50})
    expect(computeContainRect(100, 50, Number.POSITIVE_INFINITY)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    })
    expect(computeContainRect(100, 50, Number.NaN)).toEqual({x: 0, y: 0, width: 100, height: 50})
  })
})

describe('percentToPoint', () => {
  test('resolves a percent against the contain rect, not the raw container', () => {
    // A letterboxed rect offset by (100, 0), sized 200x200 within a 400x200
    // container — a hotspot authored at (50, 50) (screenshot-relative)
    // must land at the CENTER of the letterboxed image, not the container.
    const rect = {x: 100, y: 0, width: 200, height: 200}
    expect(percentToPoint(rect, 50, 50)).toEqual({left: 200, top: 100})
    expect(percentToPoint(rect, 0, 0)).toEqual({left: 100, top: 0})
    expect(percentToPoint(rect, 100, 100)).toEqual({left: 300, top: 200})
  })
})

describe('percentToBox', () => {
  test('resolves top-left-anchored x/y/width against the contain rect', () => {
    const rect = {x: 0, y: 50, width: 200, height: 100}
    expect(percentToBox(rect, 10, 10, 40)).toEqual({left: 20, top: 60, width: 80})
  })
})
