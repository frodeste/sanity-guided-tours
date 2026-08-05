import {describe, expect, test} from 'bun:test'

import {
  elementAccessibleName,
  elementDefaults,
  elementKind,
  hasMobileOverride,
  isResizableKind,
  resizeWidth,
  resolvedPosition,
  resolvedWidth,
} from '../../src/studio/canvasHandlers'

// Pure logic pulled out of `Canvas.tsx`/`CanvasElement.tsx` so it's testable
// without pointer-event simulation (master plan Task 5: "Full drag
// simulation not required — smoke only for Studio UI"): the type-specific
// defaults a placed element gets, device-aware position/width resolution
// (`mobile.x ?? x`), the mobile-override badge condition, the chip's
// accessible name, and the resize handle's delta-to-width math.

describe('elementDefaults', () => {
  test('hotspot defaults: advance action, pulse on', () => {
    expect(elementDefaults('hotspot', 'k1', {x: 10, y: 20})).toEqual({
      _type: 'guidedTourHotspot',
      _key: 'k1',
      x: 10,
      y: 20,
      action: 'advance',
      pulse: true,
    })
  })

  test('tooltip defaults: width 300, auto placement, click trigger, empty content', () => {
    expect(elementDefaults('tooltip', 'k2', {x: 30, y: 40})).toEqual({
      _type: 'guidedTourTooltip',
      _key: 'k2',
      x: 30,
      y: 40,
      width: 300,
      placement: 'auto',
      trigger: 'click',
      content: [],
    })
  })

  test('textOverlay defaults: width 30, surface background, 90 opacity, empty content', () => {
    expect(elementDefaults('textOverlay', 'k3', {x: 50, y: 60})).toEqual({
      _type: 'guidedTourTextOverlay',
      _key: 'k3',
      x: 50,
      y: 60,
      width: 30,
      background: 'surface',
      opacity: 90,
      content: [],
    })
  })
})

describe('elementKind', () => {
  test('maps schema _type strings to the internal element kind', () => {
    expect(elementKind('guidedTourHotspot')).toBe('hotspot')
    expect(elementKind('guidedTourTooltip')).toBe('tooltip')
    expect(elementKind('guidedTourTextOverlay')).toBe('textOverlay')
  })

  test('returns null for an unrecognized or missing _type', () => {
    expect(elementKind('somethingElse')).toBeNull()
    expect(elementKind(undefined)).toBeNull()
    expect(elementKind(42)).toBeNull()
  })
})

describe('isResizableKind', () => {
  test('tooltip and textOverlay are resizable', () => {
    expect(isResizableKind('tooltip')).toBe(true)
    expect(isResizableKind('textOverlay')).toBe(true)
  })

  test('hotspot and null are not resizable', () => {
    expect(isResizableKind('hotspot')).toBe(false)
    expect(isResizableKind(null)).toBe(false)
  })
})

describe('resolvedPosition', () => {
  test('desktop always reads the top-level x/y', () => {
    expect(resolvedPosition({x: 10, y: 20, mobile: {x: 99, y: 98}}, 'desktop')).toEqual({
      x: 10,
      y: 20,
    })
  })

  test('mobile falls back to top-level x/y when no override is set', () => {
    expect(resolvedPosition({x: 10, y: 20}, 'mobile')).toEqual({x: 10, y: 20})
  })

  test('mobile prefers the override x/y when set', () => {
    expect(resolvedPosition({x: 10, y: 20, mobile: {x: 15, y: 25}}, 'mobile')).toEqual({
      x: 15,
      y: 25,
    })
  })

  test('mobile with a partial override falls back per-axis', () => {
    expect(resolvedPosition({x: 10, y: 20, mobile: {x: 15}}, 'mobile')).toEqual({x: 15, y: 20})
  })
})

describe('resolvedWidth', () => {
  test('desktop reads the top-level width', () => {
    expect(resolvedWidth({width: 300}, 'desktop')).toBe(300)
  })

  test('mobile falls back to the top-level width when no override is set', () => {
    expect(resolvedWidth({width: 300}, 'mobile')).toBe(300)
  })

  test('mobile prefers the override width when set', () => {
    expect(resolvedWidth({width: 300, mobile: {width: 200}}, 'mobile')).toBe(200)
  })

  test('returns undefined when there is no width at all (e.g. a hotspot)', () => {
    expect(resolvedWidth({}, 'desktop')).toBeUndefined()
  })
})

describe('hasMobileOverride', () => {
  test('false when there is no mobile object', () => {
    expect(hasMobileOverride({x: 1, y: 2})).toBe(false)
  })

  test('false when the mobile object has no numeric members', () => {
    expect(hasMobileOverride({mobile: {}})).toBe(false)
  })

  test('true when the mobile object carries an x, y, or width override', () => {
    expect(hasMobileOverride({mobile: {x: 5}})).toBe(true)
    expect(hasMobileOverride({mobile: {y: 5}})).toBe(true)
    expect(hasMobileOverride({mobile: {width: 5}})).toBe(true)
  })
})

describe('elementAccessibleName', () => {
  test('falls back to just the kind label when there is no label or content', () => {
    expect(elementAccessibleName({_type: 'guidedTourHotspot'})).toBe('Hotspot')
  })

  test('hotspot uses its label when present', () => {
    expect(elementAccessibleName({_type: 'guidedTourHotspot', label: 'Settings menu'})).toBe(
      'Hotspot: Settings menu',
    )
  })

  test('tooltip/textOverlay use the first content block’s plain text', () => {
    const content = [
      {
        _type: 'block',
        _key: 'b1',
        children: [{_type: 'span', _key: 's1', text: 'Click here to continue', marks: []}],
      },
    ]
    expect(elementAccessibleName({_type: 'guidedTourTooltip', content})).toBe(
      'Tooltip: Click here to continue',
    )
    expect(elementAccessibleName({_type: 'guidedTourTextOverlay', content})).toBe(
      'Text overlay: Click here to continue',
    )
  })

  test('an unrecognized _type falls back to "Element"', () => {
    expect(elementAccessibleName({_type: 'somethingElse'})).toBe('Element')
  })
})

describe('resizeWidth', () => {
  test('textOverlay converts a client-pixel delta into a percent-of-rect delta', () => {
    // rect is 300px wide: a 30px move is 10 percentage points.
    expect(resizeWidth('textOverlay', 30, 30, 300)).toBe(40)
  })

  test('textOverlay clamps to [10, 100]', () => {
    expect(resizeWidth('textOverlay', 30, -1000, 300)).toBe(10)
    expect(resizeWidth('textOverlay', 30, 1000, 300)).toBe(100)
  })

  test('tooltip treats the client-pixel delta as a 1:1 width-in-px delta', () => {
    expect(resizeWidth('tooltip', 300, 50, 800)).toBe(350)
  })

  test('tooltip clamps to [200, 600]', () => {
    expect(resizeWidth('tooltip', 300, -1000, 800)).toBe(200)
    expect(resizeWidth('tooltip', 300, 1000, 800)).toBe(600)
  })

  test('a zero-width rect does not throw and still clamps for textOverlay', () => {
    expect(resizeWidth('textOverlay', 30, 100, 0)).toBe(30)
  })
})
