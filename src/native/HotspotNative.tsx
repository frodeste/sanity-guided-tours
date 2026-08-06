import type {ReactNode} from 'react'
import {Linking, Pressable} from 'react-native'

import type {GuidedTourHotspot} from '../queries/types'
import {personalizeText} from '../react/personalize'
import {useNativeTourContext} from './context'
import type {ContainRect} from './layout'
import {percentToPoint} from './layout'

export interface HotspotNativeProps {
  hotspot: GuidedTourHotspot
  /** The screenshot's computed contain-fit rect (`./layout.ts`) — `x`/`y` percentages resolve against this, not the raw stage container. */
  containRect: ContainRect
  /** Called on press when `hotspot.action` is `'advance'` or `'reveal'` — never for `'link'`, where `Linking.openURL` handles activation. Same contract as web's `Hotspot` `onActivate`. */
  onActivate: () => void
}

/**
 * A pressable marker positioned on a step's screenshot — the native
 * counterpart of web's `Hotspot.tsx`. Renders a `Pressable` for every
 * `action`; the spec §8.6 accessibility carve-out (native anchor semantics
 * on web: middle-click, context menu, status bar) has no RN equivalent to
 * preserve verbatim, so it's re-expressed in RN's OWN accessibility
 * vocabulary instead (brief's own wording): `accessibilityRole="link"` for
 * `action === 'link'`, `"button"` otherwise — a screen reader announces
 * "link" vs "button" either way, which is the carve-out's actual
 * observable intent, even though the underlying element is a `Pressable`
 * in both cases (RN has no distinct anchor primitive).
 *
 * Every press emits `element_clicked` regardless of `action` — including
 * `'link'`, where `Linking.openURL` additionally opens the RAW
 * (never-personalized) `href`, same invariant as every other link surface
 * in this viewer.
 *
 * @public
 */
export function HotspotNative({hotspot, containRect, onActivate}: HotspotNativeProps): ReactNode {
  const {tokens, labels, trackerRef, styles, reducedMotion} = useNativeTourContext()
  const {_key, action, href, label, pulse, x, y} = hotspot

  const defaultLabel =
    action === 'advance'
      ? labels.hotspotAdvance
      : action === 'reveal'
        ? labels.hotspotReveal
        : labels.hotspotLink
  const accessibleName = label !== null ? personalizeText(label, tokens) : defaultLabel

  const point = percentToPoint(containRect, x, y)

  function handlePress(): void {
    trackerRef.current?.elementClicked({elementType: 'hotspot', elementKey: _key})
    if (action === 'link') {
      if (href !== null) void Linking.openURL(href)
      return
    }
    onActivate()
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole={action === 'link' ? 'link' : 'button'}
      accessibilityLabel={accessibleName}
      style={[
        styles.hotspot,
        {left: point.left, top: point.top},
        pulse && !reducedMotion ? styles.hotspotPulseRing : null,
      ]}
    />
  )
}
