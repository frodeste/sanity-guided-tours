import {Fragment, type ReactNode} from 'react'
import {Linking, Text, type StyleProp, type TextStyle} from 'react-native'

import type {GuidedTourPortableText} from '../queries/types'
import {personalizePT} from '../react/personalize'
import {useNativeTourContext} from './context'

export interface PortableTextNativeProps {
  /** Raw, unpersonalized content — this component personalizes internally, same contract as web's `PortableText`. */
  value: GuidedTourPortableText | null
  style?: StyleProp<TextStyle>
}

type PortableTextSpan = GuidedTourPortableText[number]['children'][number]
type PortableTextMarkDef = NonNullable<GuidedTourPortableText[number]['markDefs']>[number]

/**
 * Same defensiveness as web's `PortableText.tsx`'s own `sanitize`: drops
 * spans without a string `.text` before `personalizePT` (which
 * unconditionally calls `.replace()` on every span's `.text`) ever sees
 * them, so one malformed span degrades to "not rendered" rather than
 * throwing.
 */
function sanitize(value: GuidedTourPortableText): GuidedTourPortableText {
  return value.map((block) => ({
    ...block,
    children: (block.children ?? []).filter(
      (span): span is PortableTextSpan => typeof span.text === 'string',
    ),
  }))
}

/**
 * Renders one span, innermost-out — same mark vocabulary as web's
 * `renderSpan` (`strong`/`em`/a `link` markDef), RN's vocabulary standing
 * in for web's tags: nested `<Text>` for `strong`/`em` (RN has no
 * `<strong>`/`<em>`, but `<Text>` nests and composes styles the same way),
 * and a `<Text accessibilityRole="link" onPress={...}>` for a link markDef
 * — RN has no real anchor element at all, so `Linking.openURL` on press is
 * the platform-idiomatic equivalent (same "RAW href, never personalized"
 * invariant as every other link surface in this viewer — the markDef's
 * `href` is never run through `tokens`).
 */
function renderSpan(
  span: PortableTextSpan,
  markDefs: PortableTextMarkDef[],
  linkColor: string,
): ReactNode {
  let node: ReactNode = span.text

  for (const mark of span.marks ?? []) {
    if (mark === 'strong') {
      node = <Text style={{fontWeight: '700'}}>{node}</Text>
    } else if (mark === 'em') {
      node = <Text style={{fontStyle: 'italic'}}>{node}</Text>
    } else {
      const markDef = markDefs.find((def) => def._key === mark)
      if (markDef?._type === 'link' && typeof markDef.href === 'string') {
        const href = markDef.href
        node = (
          <Text
            accessibilityRole="link"
            style={{color: linkColor, textDecorationLine: 'underline'}}
            onPress={() => void Linking.openURL(href)}
          >
            {node}
          </Text>
        )
      }
    }
  }

  return node
}

/**
 * The native viewer's minimal Portable Text renderer — the RN counterpart
 * of `../react/PortableText.tsx`, not a reuse of it (that file renders real
 * DOM tags and isn't on `test/exports.test.ts`'s allow-list for `src/native`
 * imports of `../react/*`). Same narrowed vocabulary
 * (`GuidedTourPortableText` only ever admits `strong`/`em`/`link`), same
 * personalization pipeline (`personalizePT`, reused directly — it's pure
 * data transformation, no DOM).
 *
 * Not part of the public `/native` surface — `index.ts` never exports it;
 * `TooltipNative`/`OverlayNative`/`OutroNative` are the only callers.
 *
 * @public
 */
export function PortableTextNative({value, style}: PortableTextNativeProps): ReactNode {
  const {tokens, theme} = useNativeTourContext()
  if (!value) return null

  const content = personalizePT(sanitize(value), tokens) ?? []

  return (
    <>
      {content.map((block) => (
        <Text key={block._key} style={style}>
          {block.children.map((span) => (
            <Fragment key={span._key}>
              {renderSpan(span, block.markDefs ?? [], theme.accent)}
            </Fragment>
          ))}
        </Text>
      ))}
    </>
  )
}
