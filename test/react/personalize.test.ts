import {describe, expect, test} from 'bun:test'

import type {GuidedTourPortableText, GuidedTourToken} from '../../src/queries/types'
import {
  missingRequired,
  personalizePT,
  personalizeText,
  resolveTokens,
} from '../../src/react/personalize'

// Minimal fixture builders — narrow hand types matching the query result
// shapes, filling every field the real query would coalesce or leave null,
// so the fixtures compile without `as` casts (oxlint bans them).

function token(overrides: Partial<GuidedTourToken> & {key: string}): GuidedTourToken {
  return {
    _key: overrides.key,
    key: overrides.key,
    label: overrides.label ?? overrides.key,
    defaultValue: overrides.defaultValue ?? null,
    required: overrides.required ?? false,
  }
}

describe('resolveTokens', () => {
  test('applies defaultValue when no value is provided', () => {
    const defs = [token({key: 'name', defaultValue: 'Friend'})]
    expect(resolveTokens(defs, {})).toEqual({name: 'Friend'})
  })

  test('trims provided values', () => {
    const defs = [token({key: 'name'})]
    expect(resolveTokens(defs, {name: '  Ada  '})).toEqual({name: 'Ada'})
  })

  test('drops keys whose value trims to empty and have no default', () => {
    const defs = [token({key: 'name'})]
    expect(resolveTokens(defs, {name: '   '})).toEqual({})
  })

  test('falls back to defaultValue when provided value trims to empty', () => {
    const defs = [token({key: 'name', defaultValue: 'Friend'})]
    expect(resolveTokens(defs, {name: '   '})).toEqual({name: 'Friend'})
  })

  test('takes the first element of a string[] value', () => {
    const defs = [token({key: 'name'})]
    expect(resolveTokens(defs, {name: ['Ada', 'Grace']})).toEqual({name: 'Ada'})
  })

  test('returns {} for null defs', () => {
    expect(resolveTokens(null, {name: 'Ada'})).toEqual({})
  })

  test('omits a key with no provided value and no default', () => {
    const defs = [token({key: 'name'})]
    expect(resolveTokens(defs, {})).toEqual({})
  })

  test('ignores provided keys that have no matching def', () => {
    const defs = [token({key: 'name', defaultValue: 'Friend'})]
    expect(resolveTokens(defs, {other: 'value'})).toEqual({name: 'Friend'})
  })

  // `__proto__` passes the token key schema's `^[a-z_]+$` regex. On a plain
  // `{}`, `resolved['__proto__'] = 'Ada'` doesn't create an own property —
  // it's silently swallowed by the inherited `__proto__` setter — so this
  // key must round-trip through a null-prototype record instead. Built
  // with a computed property (`{['__proto__']: ...}`) so the object
  // literal itself doesn't trigger the same proto-setting special case.
  test('resolves a __proto__-keyed token without prototype pollution', () => {
    const defs = [token({key: '__proto__'})]
    const provided = {['__proto__']: 'Ada'}
    const resolved = resolveTokens(defs, provided)
    expect(resolved).toEqual({['__proto__']: 'Ada'})
    expect(Object.hasOwn(resolved, '__proto__')).toBe(true)
  })

  test('falls back to defaultValue for an absent __proto__-keyed token', () => {
    const defs = [token({key: '__proto__', defaultValue: 'Friend'})]
    expect(resolveTokens(defs, {})).toEqual({['__proto__']: 'Friend'})
  })

  test('drops an absent __proto__-keyed token with no default', () => {
    const defs = [token({key: '__proto__'})]
    const resolved = resolveTokens(defs, {})
    expect(Object.hasOwn(resolved, '__proto__')).toBe(false)
  })
})

describe('personalizeText', () => {
  test('replaces a known token', () => {
    expect(personalizeText('Hello {{name}}!', {name: 'Ada'})).toBe('Hello Ada!')
  })

  test('replaces an unknown token with an empty string', () => {
    expect(personalizeText('Hello {{name}}!', {})).toBe('Hello !')
  })

  test('replaces multiple occurrences', () => {
    expect(personalizeText('{{name}} and {{name}} again', {name: 'Ada'})).toBe('Ada and Ada again')
  })

  test('leaves text with no tokens untouched', () => {
    expect(personalizeText('Plain text.', {name: 'Ada'})).toBe('Plain text.')
  })

  // `__proto__` and `constructor` both pass the token key schema's
  // `^[a-z_]+$` regex, so both must behave as ordinary token keys rather
  // than resolving through `Object.prototype` when absent from `tokens`.
  test('substitutes a provided __proto__-keyed token', () => {
    const tokens = {['__proto__']: 'Ada'}
    expect(personalizeText('Hi {{__proto__}}!', tokens)).toBe('Hi Ada!')
  })

  test('replaces an absent __proto__ token with empty string, not the prototype object', () => {
    expect(personalizeText('Hi {{__proto__}}!', {})).toBe('Hi !')
  })

  test('substitutes a provided constructor-keyed token', () => {
    const tokens = {constructor: 'Ada'}
    expect(personalizeText('Hi {{constructor}}!', tokens)).toBe('Hi Ada!')
  })

  test('replaces an absent constructor token with empty string, not the inherited constructor', () => {
    expect(personalizeText('Hi {{constructor}}!', {})).toBe('Hi !')
  })
})

describe('personalizePT', () => {
  function block(
    overrides: Partial<GuidedTourPortableText[number]> = {},
  ): GuidedTourPortableText[number] {
    return {
      _type: 'block',
      _key: 'block-1',
      style: 'normal',
      children: [{_type: 'span', _key: 'span-1', text: 'Hello {{name}}', marks: ['strong']}],
      ...overrides,
    }
  }

  test('substitutes tokens in span text while preserving marks arrays', () => {
    const content: GuidedTourPortableText = [block()]
    const result = personalizePT(content, {name: 'Ada'})

    expect(result).not.toBeNull()
    expect(result?.[0]?.children[0]?.text).toBe('Hello Ada')
    expect(result?.[0]?.children[0]?.marks).toEqual(['strong'])
  })

  test('returns null for null content', () => {
    expect(personalizePT(null, {name: 'Ada'})).toBeNull()
  })

  test('passes non-children block fields through untouched', () => {
    const content: GuidedTourPortableText = [
      block({
        style: 'h2',
        markDefs: [{_key: 'note-1', _type: 'note'}],
      }),
    ]
    const result = personalizePT(content, {name: 'Ada'})

    expect(result?.[0]?.style).toBe('h2')
    expect(result?.[0]?._key).toBe('block-1')
    expect(result?.[0]?.markDefs).toEqual([{_key: 'note-1', _type: 'note'}])
  })

  test('never substitutes tokens inside markDefs href, even when the span text also has tokens', () => {
    const content: GuidedTourPortableText = [
      {
        _type: 'block',
        _key: 'block-1',
        style: 'normal',
        markDefs: [{_key: 'link-1', _type: 'link', href: 'https://example.com?ref={{evil}}'}],
        children: [{_type: 'span', _key: 'span-1', text: 'Hi {{name}}', marks: ['link-1']}],
      },
    ]

    const result = personalizePT(content, {name: 'Ada', evil: 'INJECTED'})

    expect(result?.[0]?.markDefs).toEqual([
      {_key: 'link-1', _type: 'link', href: 'https://example.com?ref={{evil}}'},
    ])
    expect(result?.[0]?.children[0]?.text).toBe('Hi Ada')
    expect(result?.[0]?.children[0]?.marks).toEqual(['link-1'])
  })
})

describe('missingRequired', () => {
  test('lists required tokens with no resolved value', () => {
    const defs = [token({key: 'name', required: true}), token({key: 'email', required: true})]
    expect(missingRequired(defs, {name: 'Ada'})).toEqual(['email'])
  })

  test('does not list satisfied required tokens', () => {
    const defs = [token({key: 'name', required: true})]
    expect(missingRequired(defs, {name: 'Ada'})).toEqual([])
  })

  test('does not list optional tokens with no resolved value', () => {
    const defs = [token({key: 'name', required: false})]
    expect(missingRequired(defs, {})).toEqual([])
  })

  test('returns [] for null defs', () => {
    expect(missingRequired(null, {})).toEqual([])
  })

  // Same __proto__/constructor hazard as above, on the read side: a plain
  // `{}` `resolved` with no own entry for `constructor` would otherwise
  // read the inherited `Object.prototype.constructor` function (never
  // `undefined`) and wrongly report the token as satisfied.
  test('treats an absent __proto__-keyed required token as missing', () => {
    const defs = [token({key: '__proto__', required: true})]
    expect(missingRequired(defs, {})).toEqual(['__proto__'])
  })

  test('does not list a satisfied __proto__-keyed required token', () => {
    const defs = [token({key: '__proto__', required: true})]
    const resolved = {['__proto__']: 'Ada'}
    expect(missingRequired(defs, resolved)).toEqual([])
  })

  test('treats an absent constructor-keyed required token as missing', () => {
    const defs = [token({key: 'constructor', required: true})]
    expect(missingRequired(defs, {})).toEqual(['constructor'])
  })
})
