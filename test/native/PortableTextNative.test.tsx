import {describe, expect, spyOn, test} from 'bun:test'

import type {ReactElement, ReactNode} from 'react'
import {Linking, Text} from 'react-native'

import {NativeTourContext, type NativeTourContextValue} from '../../src/native/context'
import {resolveNativeTheme} from '../../src/native/nativeTheme'
import {PortableTextNative} from '../../src/native/PortableTextNative'
import type {GuidedTourPortableText} from '../../src/queries/types'
import {defaultLabels} from '../../src/react/labels'
import {createTracker} from '../../src/react/session'
import {createStyles} from '../../src/native/styles'
import {actNative, renderNative} from '../support/react-native-stub/renderNative'

function buildContext(tokens: Record<string, string> = {}): NativeTourContextValue {
  const theme = resolveNativeTheme(null, 'light')
  return {
    tokens,
    labels: defaultLabels,
    trackerRef: {current: createTracker(undefined, 'tour-1')},
    theme,
    styles: createStyles(theme),
    reducedMotion: false,
  }
}

function withContext(context: NativeTourContextValue, children: ReactNode): ReactElement {
  return <NativeTourContext.Provider value={context}>{children}</NativeTourContext.Provider>
}

function span(overrides: {_key: string; text: string; marks?: string[]}): GuidedTourPortableText[number]['children'][number] {
  return {_type: 'span', ...overrides}
}

function block(overrides: {
  _key: string
  children: GuidedTourPortableText[number]['children']
  markDefs?: GuidedTourPortableText[number]['markDefs']
}): GuidedTourPortableText[number] {
  return {_type: 'block', style: 'normal', ...overrides}
}

describe('PortableTextNative', () => {
  test('a null value renders nothing', () => {
    const renderer = renderNative(withContext(buildContext(), <PortableTextNative value={null} />))
    expect(renderer.root.findAllByType(Text)).toHaveLength(0)
  })

  test('throws when rendered outside a <GuidedTour> provider (native/context.ts programmer-error guard)', () => {
    expect(() => renderNative(<PortableTextNative value={null} />)).toThrow(
      /must be rendered inside <GuidedTour>/,
    )
  })

  test('personalizes span text via the resolved tokens', () => {
    const value: GuidedTourPortableText = [
      block({_key: 'b1', children: [span({_key: 's1', text: 'Hi {{name}}!'})]}),
    ]
    const renderer = renderNative(
      withContext(buildContext({name: 'Ada'}), <PortableTextNative value={value} />),
    )
    expect(JSON.stringify(renderer.toJSON())).toContain('Hi Ada!')
  })

  test('sanitize drops a span with a non-string text before personalization ever sees it', () => {
    // `sanitize` (this module's own defensiveness) filters any span whose
    // `.text` isn't a string before `personalizePT` unconditionally calls
    // `.replace()` on every span's `.text` — a malformed span degrades to
    // "not rendered" rather than throwing. `any`, not a cast off the real
    // `GuidedTourPortableText` type (this repo bans `as`): deliberately
    // violates the type to model a malformed wire value.
    const malformedSpan: any = {_type: 'span', _key: 's2', text: 42}
    const value: GuidedTourPortableText = [
      block({
        _key: 'b1',
        children: [span({_key: 's1', text: 'kept'}), malformedSpan],
      }),
    ]
    const renderer = renderNative(withContext(buildContext(), <PortableTextNative value={value} />))
    const json = JSON.stringify(renderer.toJSON())
    expect(json).toContain('kept')
    expect(json).not.toContain('42')
  })

  test('strong and em marks nest innermost-out as separate styled Text wrappers', () => {
    const value: GuidedTourPortableText = [
      block({
        _key: 'b1',
        children: [span({_key: 's1', text: 'bold italic', marks: ['strong', 'em']})],
      }),
    ]
    const renderer = renderNative(withContext(buildContext(), <PortableTextNative value={value} />))
    const texts = renderer.root.findAllByType(Text)
    expect(texts.some((t) => t.props.style?.fontWeight === '700')).toBe(true)
    expect(texts.some((t) => t.props.style?.fontStyle === 'italic')).toBe(true)
  })

  test('a link mark renders an accessibilityRole=link Text whose onPress opens the RAW href (never personalized)', () => {
    const openURLSpy = spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve())
    const value: GuidedTourPortableText = [
      block({
        _key: 'b1',
        markDefs: [{_key: 'link-1', _type: 'link', href: 'https://example.com/{{slug}}'}],
        children: [span({_key: 's1', text: 'Hi {{name}}', marks: ['link-1']})],
      }),
    ]
    const renderer = renderNative(
      withContext(buildContext({name: 'Ada', slug: 'evil'}), <PortableTextNative value={value} />),
    )

    const link = renderer.root.findByProps({accessibilityRole: 'link'})
    // The DISPLAYED span text is personalized (personalizePT touches span
    // text only)...
    expect(JSON.stringify(renderer.toJSON())).toContain('Hi Ada')
    // ...but the href a press opens is the raw markDef value, untouched by
    // the `{{slug}}` token — same invariant `personalizePT`'s own doc
    // comment states for markDefs (spec §8.3): personalization never
    // reaches into a link's href.
    actNative(() => link.props.onPress())
    expect(openURLSpy).toHaveBeenCalledWith('https://example.com/{{slug}}')
  })

  test('a mark with no matching (or non-link) markDef falls through unchanged — no crash, plain text still renders', () => {
    const value: GuidedTourPortableText = [
      block({
        _key: 'b1',
        markDefs: [{_key: 'comment-1', _type: 'comment'}],
        children: [span({_key: 's1', text: 'plain', marks: ['comment-1']})],
      }),
    ]
    const renderer = renderNative(withContext(buildContext(), <PortableTextNative value={value} />))
    expect(renderer.root.findAllByProps({accessibilityRole: 'link'})).toHaveLength(0)
    expect(JSON.stringify(renderer.toJSON())).toContain('plain')
  })
})
