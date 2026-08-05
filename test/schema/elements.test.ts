import {describe, expect, test} from 'bun:test'

import hotspot from '../../src/schema/elements/hotspot'
import {positionFields} from '../../src/schema/elements/position'
import textOverlay from '../../src/schema/elements/textOverlay'
import tooltip from '../../src/schema/elements/tooltip'
import richText from '../../src/schema/richText'
import {customValidator, findCall, methodNames, runValidation} from './support/ruleSpy'

interface FieldLike {
  name: string
  type: string
  validation?: unknown
  initialValue?: unknown
  fields?: unknown
  options?: {list?: Array<string | {title?: string; value?: unknown}>; layout?: string}
}

/** Generic `key in value` guard, usable on `unknown` without an unsafe cast. */
function has<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
  return typeof value === 'object' && value !== null && key in value
}

function isFieldLike(value: unknown): value is FieldLike {
  return (
    has(value, 'name') &&
    typeof value.name === 'string' &&
    has(value, 'type') &&
    typeof value.type === 'string'
  )
}

/** Narrows an array-ish, unknown value (an object's `.fields`/`.of`) down to `FieldLike[]`. */
function fieldList(value: unknown): FieldLike[] {
  return Array.isArray(value) ? value.filter(isFieldLike) : []
}

function fields(type: {fields?: unknown}): FieldLike[] {
  return fieldList(type.fields)
}

function fieldByName(list: FieldLike[], name: string): FieldLike {
  const field = list.find((f) => f.name === name)
  if (!field)
    throw new Error(`field "${name}" not found among [${list.map((f) => f.name).join(', ')}]`)
  return field
}

function isRequired(field: FieldLike): boolean {
  return methodNames(runValidation(field.validation)).includes('required')
}

function listValues(field: FieldLike): unknown[] {
  return (field.options?.list ?? []).map((item) => (typeof item === 'string' ? item : item.value))
}

describe('positionFields', () => {
  test('returns x, y, mobile field definitions', () => {
    const names = fieldList(positionFields()).map((f) => f.name)
    expect(names).toEqual(['x', 'y', 'mobile'])
  })

  test('x and y are required numbers between 0 and 100', () => {
    const list = fieldList(positionFields())
    for (const name of ['x', 'y']) {
      const field = fieldByName(list, name)
      expect(field.type).toBe('number')
      expect(isRequired(field)).toBe(true)
      const spy = runValidation(field.validation)
      expect(findCall(spy, 'min')?.args).toEqual([0])
      expect(findCall(spy, 'max')?.args).toEqual([100])
    }
  })

  test('mobile is an optional object with optional x, y, width', () => {
    const list = fieldList(positionFields())
    const mobile = fieldByName(list, 'mobile')
    expect(mobile.type).toBe('object')
    expect(isRequired(mobile)).toBe(false)

    const subFields = fieldList(mobile.fields)
    const subNames = subFields.map((f) => f.name)
    expect(subNames).toEqual(expect.arrayContaining(['x', 'y', 'width']))

    for (const name of ['x', 'y', 'width']) {
      const sub = fieldByName(subFields, name)
      expect(sub.type).toBe('number')
      expect(isRequired(sub)).toBe(false)
    }
    expect(findCall(runValidation(fieldByName(subFields, 'x').validation), 'max')?.args).toEqual([
      100,
    ])
    expect(findCall(runValidation(fieldByName(subFields, 'y').validation), 'max')?.args).toEqual([
      100,
    ])
    // mobile.width's range is the union of both element widths it can
    // stand in for — px 200-600 for tooltip, percent 10-100 for
    // textOverlay (`position.ts`'s doc comment) — not percent-shaped
    // [1, 100]: a mobile tooltip override needs to reach real pixel
    // widths.
    expect(
      findCall(runValidation(fieldByName(subFields, 'width').validation), 'min')?.args,
    ).toEqual([1])
    expect(
      findCall(runValidation(fieldByName(subFields, 'width').validation), 'max')?.args,
    ).toEqual([600])
  })
})

describe('guidedTourHotspot', () => {
  test('type name and field set', () => {
    expect(hotspot.name).toBe('guidedTourHotspot')
    expect(hotspot.type).toBe('object')
    const names = fields(hotspot).map((f) => f.name)
    expect(names).toEqual(
      expect.arrayContaining(['x', 'y', 'mobile', 'label', 'action', 'href', 'pulse']),
    )
  })

  test('x and y are required position fields', () => {
    const list = fields(hotspot)
    expect(isRequired(fieldByName(list, 'x'))).toBe(true)
    expect(isRequired(fieldByName(list, 'y'))).toBe(true)
  })

  test('label is an optional string', () => {
    const label = fieldByName(fields(hotspot), 'label')
    expect(label.type).toBe('string')
    expect(isRequired(label)).toBe(false)
  })

  test('action is a required radio list, initially advance', () => {
    const action = fieldByName(fields(hotspot), 'action')
    expect(action.type).toBe('string')
    expect(isRequired(action)).toBe(true)
    expect(action.initialValue).toBe('advance')
    expect(action.options?.layout).toBe('radio')
    expect(listValues(action)).toEqual(['advance', 'reveal', 'link'])
  })

  test('href is a url that allows http/https/mailto/tel', () => {
    const href = fieldByName(fields(hotspot), 'href')
    expect(href.type).toBe('url')
    const spy = runValidation(href.validation)
    expect(findCall(spy, 'uri')?.args).toEqual([{scheme: ['http', 'https', 'mailto', 'tel']}])
  })

  test('href is required only when action is "link"', () => {
    const href = fieldByName(fields(hotspot), 'href')
    const spy = runValidation(href.validation)
    const validate = customValidator(spy)

    expect(validate(undefined, {parent: {action: 'link'}})).not.toBe(true)
    expect(validate('https://example.com', {parent: {action: 'link'}})).toBe(true)
    expect(validate(undefined, {parent: {action: 'advance'}})).toBe(true)
    expect(validate(undefined, {parent: {action: 'reveal'}})).toBe(true)
  })

  test('pulse is a boolean, initially true', () => {
    const pulse = fieldByName(fields(hotspot), 'pulse')
    expect(pulse.type).toBe('boolean')
    expect(pulse.initialValue).toBe(true)
  })

  test('prepare is defensive against undefined selections', () => {
    expect(() => hotspot.preview?.prepare?.({})).not.toThrow()
  })
})

describe('guidedTourTooltip', () => {
  test('type name and field set', () => {
    expect(tooltip.name).toBe('guidedTourTooltip')
    expect(tooltip.type).toBe('object')
    const names = fields(tooltip).map((f) => f.name)
    expect(names).toEqual(
      expect.arrayContaining(['x', 'y', 'mobile', 'width', 'content', 'placement', 'trigger']),
    )
  })

  test('width is a number, initially 300, between 200 and 600', () => {
    const width = fieldByName(fields(tooltip), 'width')
    expect(width.type).toBe('number')
    expect(width.initialValue).toBe(300)
    const spy = runValidation(width.validation)
    expect(findCall(spy, 'min')?.args).toEqual([200])
    expect(findCall(spy, 'max')?.args).toEqual([600])
  })

  test('content is a required rich text field', () => {
    const content = fieldByName(fields(tooltip), 'content')
    expect(content.type).toBe('guidedTourRichText')
    expect(isRequired(content)).toBe(true)
  })

  test('placement is a list, initially auto', () => {
    const placement = fieldByName(fields(tooltip), 'placement')
    expect(placement.type).toBe('string')
    expect(placement.initialValue).toBe('auto')
    expect(listValues(placement)).toEqual(['top', 'bottom', 'left', 'right', 'auto'])
  })

  test('trigger is a list, initially click', () => {
    const trigger = fieldByName(fields(tooltip), 'trigger')
    expect(trigger.type).toBe('string')
    expect(trigger.initialValue).toBe('click')
    expect(listValues(trigger)).toEqual(['click', 'hover', 'auto'])
  })

  test('prepare is defensive against undefined selections', () => {
    expect(() => tooltip.preview?.prepare?.({})).not.toThrow()
  })
})

describe('guidedTourTextOverlay', () => {
  test('type name and field set', () => {
    expect(textOverlay.name).toBe('guidedTourTextOverlay')
    expect(textOverlay.type).toBe('object')
    const names = fields(textOverlay).map((f) => f.name)
    expect(names).toEqual(
      expect.arrayContaining(['x', 'y', 'mobile', 'width', 'content', 'background', 'opacity']),
    )
  })

  test('width is a percentage, initially 30, between 10 and 100', () => {
    const width = fieldByName(fields(textOverlay), 'width')
    expect(width.type).toBe('number')
    expect(width.initialValue).toBe(30)
    const spy = runValidation(width.validation)
    expect(findCall(spy, 'min')?.args).toEqual([10])
    expect(findCall(spy, 'max')?.args).toEqual([100])
  })

  test('content is a required rich text field', () => {
    const content = fieldByName(fields(textOverlay), 'content')
    expect(content.type).toBe('guidedTourRichText')
    expect(isRequired(content)).toBe(true)
  })

  test('background is a list, initially surface', () => {
    const background = fieldByName(fields(textOverlay), 'background')
    expect(background.type).toBe('string')
    expect(background.initialValue).toBe('surface')
    expect(listValues(background)).toEqual(['surface', 'contrast', 'accent', 'none'])
  })

  test('opacity is a number, initially 90, between 0 and 100', () => {
    const opacity = fieldByName(fields(textOverlay), 'opacity')
    expect(opacity.type).toBe('number')
    expect(opacity.initialValue).toBe(90)
    const spy = runValidation(opacity.validation)
    expect(findCall(spy, 'min')?.args).toEqual([0])
    expect(findCall(spy, 'max')?.args).toEqual([100])
  })

  test('prepare is defensive against undefined selections', () => {
    expect(() => textOverlay.preview?.prepare?.({})).not.toThrow()
  })
})

/** Reads a single property off an `unknown` value via the `has` guard, without an unsafe cast. */
function prop(value: unknown, key: string): unknown {
  return has(value, key) ? value[key] : undefined
}

describe('guidedTourRichText', () => {
  test('is an array of a single block type', () => {
    expect(richText.name).toBe('guidedTourRichText')
    expect(richText.type).toBe('array')
    expect(richText.of).toHaveLength(1)
    expect(richText.of[0].type).toBe('block')
  })

  test('has only the Normal style and no lists', () => {
    const block = richText.of[0]
    expect(prop(block, 'styles')).toEqual([{title: 'Normal', value: 'normal'}])
    expect(prop(block, 'lists')).toEqual([])
  })

  test('has only strong/em decorators and a link annotation', () => {
    const marks = prop(richText.of[0], 'marks')
    expect(prop(marks, 'decorators')).toEqual([
      {title: 'Strong', value: 'strong'},
      {title: 'Emphasis', value: 'em'},
    ])

    // Annotations share the same {name, type, fields} shape as regular
    // fields, so the FieldLike guard applies to them too.
    const annotations = fieldList(prop(marks, 'annotations'))
    expect(annotations).toHaveLength(1)
    const [link] = annotations
    expect(link.name).toBe('link')
    expect(link.type).toBe('object')

    const href = fieldByName(fieldList(link.fields), 'href')
    expect(href.type).toBe('url')
    const spy = runValidation(href.validation)
    expect(methodNames(spy)).toContain('required')
    expect(findCall(spy, 'uri')?.args).toEqual([{scheme: ['http', 'https', 'mailto', 'tel']}])
  })
})
