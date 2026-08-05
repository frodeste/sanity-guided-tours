import {describe, expect, test} from 'bun:test'

import {CSS_COLOR_VALUE_PATTERN, cssColorValue} from '../../src/schema/cssValue'
import {createRuleSpy, findCall} from './support/ruleSpy'

describe('CSS_COLOR_VALUE_PATTERN', () => {
  test.each([
    ['#7c3aed', true],
    ['#7C3AED', true],
    ['#ABCDEF', true],
    ['#abc', false],
    ['2276fc', false],
    ['var(--brand-primary)', true],
    ['var(--brand-primary, #7c3aed)', true],
    ['var(--brand-primary,#7c3aed)', true],
    ['var(--Brand_Primary-2)', true],
    ['var(foo)', false],
    ['var(brand-primary)', false],
    ['var(--brand-primary, var(--fallback))', false],
    ['rgb(124, 58, 237)', false],
    ['rgba(124, 58, 237, 0.5)', false],
    ['', false],
  ])('%p -> %p', (value, expected) => {
    expect(CSS_COLOR_VALUE_PATTERN.test(value)).toBe(expected)
  })
})

describe('cssColorValue', () => {
  test('applies the shared regex with an error explaining both accepted forms', () => {
    const spy = createRuleSpy()
    Reflect.apply(cssColorValue, undefined, [spy])
    expect(findCall(spy, 'regex')?.args[0]).toEqual(CSS_COLOR_VALUE_PATTERN)
    const errorMessage = findCall(spy, 'error')?.args[0]
    expect(errorMessage).toMatch(/hex color/i)
    expect(errorMessage).toMatch(/var\(/)
  })
})
