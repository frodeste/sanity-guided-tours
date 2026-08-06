import {describe, expect, test} from 'bun:test'

import {firstPlainText, positionSubtitle} from '../../../src/schema/elements/previewHelpers'

// Both helpers back `prepare()` functions for hotspot/textOverlay/tooltip
// element previews (see element schema files' own imports), which Studio
// calls with whatever the current draft happens to contain — including
// empty/partial/malformed values while a document is still being filled in.
// Every case here exercises that "must not throw, must degrade gracefully"
// contract directly, the same way `previewHelpers.ts`'s own module comment
// documents the intent.

describe('positionSubtitle', () => {
  test('formats a numeric x/y pair as a percentage subtitle', () => {
    expect(positionSubtitle(50, 30)).toBe('50%, 30%')
  })

  test('formats decimal coordinates without rounding', () => {
    expect(positionSubtitle(12.5, 87.25)).toBe('12.5%, 87.25%')
  })

  test('formats 0 (falsy but valid) coordinates', () => {
    expect(positionSubtitle(0, 0)).toBe('0%, 0%')
  })

  test('returns undefined when x is missing', () => {
    expect(positionSubtitle(undefined, 30)).toBeUndefined()
  })

  test('returns undefined when y is missing', () => {
    expect(positionSubtitle(50, undefined)).toBeUndefined()
  })

  test('returns undefined when x is a non-numeric type (e.g. a stringified number)', () => {
    expect(positionSubtitle('50', 30)).toBeUndefined()
  })

  test('returns undefined when both coordinates are missing', () => {
    expect(positionSubtitle(undefined, undefined)).toBeUndefined()
  })
})

describe('firstPlainText', () => {
  test('returns undefined when blocks is not an array', () => {
    expect(firstPlainText(undefined)).toBeUndefined()
    expect(firstPlainText('not an array')).toBeUndefined()
    expect(firstPlainText({_type: 'block', children: []})).toBeUndefined()
  })

  test('returns undefined for an empty array', () => {
    expect(firstPlainText([])).toBeUndefined()
  })

  test('extracts and joins plain text from the first text block', () => {
    const blocks = [
      {
        _type: 'block',
        children: [{_type: 'span', text: 'Hello '}, {_type: 'span', text: 'world'}],
      },
    ]
    expect(firstPlainText(blocks)).toBe('Hello world')
  })

  test('trims leading/trailing whitespace off the joined text', () => {
    const blocks = [{_type: 'block', children: [{_type: 'span', text: '  padded  '}]}]
    expect(firstPlainText(blocks)).toBe('padded')
  })

  test('skips non-block array entries (e.g. an image block) to find the first real text block', () => {
    const blocks = [
      {_type: 'image', asset: {_ref: 'image-abc'}},
      {_type: 'block', children: [{_type: 'span', text: 'first text block'}]},
    ]
    expect(firstPlainText(blocks)).toBe('first text block')
  })

  test('only reads the FIRST matching block, ignoring later blocks entirely', () => {
    const blocks = [
      {_type: 'block', children: [{_type: 'span', text: 'first'}]},
      {_type: 'block', children: [{_type: 'span', text: 'second'}]},
    ]
    expect(firstPlainText(blocks)).toBe('first')
  })

  test('treats a child with a missing/non-string text field as empty rather than throwing', () => {
    const blocks = [
      {
        _type: 'block',
        children: [{_type: 'span'}, {_type: 'span', text: 42}, {_type: 'span', text: 'real'}],
      },
    ]
    expect(firstPlainText(blocks)).toBe('real')
  })

  test('returns undefined when every block fails the block/children shape check', () => {
    const blocks = [
      null,
      42,
      {_type: 'span', children: [{text: 'not a block type'}]},
      {_type: 'block'},
      {_type: 'block', children: 'not-an-array'},
    ]
    expect(firstPlainText(blocks)).toBeUndefined()
  })

  test('returns undefined when the matched block resolves to only whitespace', () => {
    const blocks = [{_type: 'block', children: [{_type: 'span', text: '   '}]}]
    expect(firstPlainText(blocks)).toBeUndefined()
  })

  test('returns undefined when the matched block has no children content at all', () => {
    const blocks = [{_type: 'block', children: []}]
    expect(firstPlainText(blocks)).toBeUndefined()
  })
})
