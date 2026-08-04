import {describe, expect, test} from 'bun:test'

import {guidedTours} from '../src/plugin'

interface FieldLike {
  name: string
  type: string
}

interface TypeLike {
  name: string
  type: string
  fields?: unknown
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

function isTypeLike(value: unknown): value is TypeLike {
  return isFieldLike(value)
}

function fieldList(value: unknown): FieldLike[] {
  return Array.isArray(value) ? value.filter(isFieldLike) : []
}

describe('guidedTours plugin', () => {
  test('has the expected plugin name', () => {
    const plugin = guidedTours()
    expect(plugin.name).toBe('sanity-plugin-guided-tours')
  })

  test('default schema types include the guidedTour document', () => {
    const plugin = guidedTours()
    const types = plugin.schema?.types
    const typeList = Array.isArray(types) ? types.filter(isTypeLike) : []
    const names = typeList.map((t) => t.name)
    expect(names).toContain('guidedTour')
    expect(names).toContain('guidedTourTheme')
  })

  test('theme:false drops guidedTourTheme from the registered schema types', () => {
    const plugin = guidedTours({theme: false})
    const types = plugin.schema?.types
    const typeList = Array.isArray(types) ? types.filter(isTypeLike) : []
    const names = typeList.map((t) => t.name)
    expect(names).not.toContain('guidedTourTheme')
  })

  test('extend.tour appends a field to the guidedTour document', () => {
    const extra = {name: 'customField', title: 'Custom', type: 'string'}
    const plugin = guidedTours({extend: {tour: [extra]}})
    const types = plugin.schema?.types
    const typeList = Array.isArray(types) ? types.filter(isTypeLike) : []
    const tour = typeList.find((t) => t.name === 'guidedTour')
    expect(tour).toBeDefined()
    const tourFieldNames = tour ? fieldList(tour.fields).map((f) => f.name) : []
    expect(tourFieldNames).toContain('customField')
  })
})
