import type {ReactNode} from 'react'
import {Linking, Pressable, Text, View} from 'react-native'

import type {GuidedTourOutro} from '../queries/types'
import {personalizeText} from '../react/personalize'
import {useNativeTourContext} from './context'
import {PortableTextNative} from './PortableTextNative'

export interface OutroNativeProps {
  outro: GuidedTourOutro
}

/**
 * The screen `GuidedTourNative` swaps in for the step stage once the
 * viewer completes the last step of a tour with an `outro` — the native
 * counterpart of web's `Outro.tsx`. Same "empty string treated like
 * `null`" heading rule, same rich-text `body` rendering (via
 * `PortableTextNative`), same CTA semantics: `href` is ALWAYS the raw,
 * unpersonalized value (only the *label* is personalized), opened via
 * `Linking.openURL` (RN's real-anchor-equivalent, same as every other link
 * surface in this viewer) with `cta_clicked` emitting the DISPLAYED
 * (personalized) label alongside the raw `href` — identical event payload
 * shape to web.
 *
 * @public
 */
export function OutroNative({outro}: OutroNativeProps): ReactNode {
  const {tokens, trackerRef, styles} = useNativeTourContext()
  const {heading, body, ctas} = outro

  return (
    <View style={styles.outroContainer}>
      {heading !== null && heading !== '' && (
        <Text style={styles.outroHeading}>{personalizeText(heading, tokens)}</Text>
      )}
      <PortableTextNative value={body} style={styles.outroBody} />
      {ctas && ctas.length > 0 && (
        <View style={styles.ctaRow}>
          {ctas.map((cta) => {
            const label = personalizeText(cta.label, tokens)
            return (
              <Pressable
                key={cta._key}
                accessibilityRole="link"
                accessibilityLabel={label}
                style={cta.style === 'primary' ? styles.ctaPrimary : styles.ctaSecondary}
                onPress={() => {
                  trackerRef.current?.ctaClicked({label, href: cta.href})
                  void Linking.openURL(cta.href)
                }}
              >
                <Text style={styles.ctaText}>{label}</Text>
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}
