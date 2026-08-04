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
})
