import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import type {GuidedTourTextOverlay} from '../queries/types'
import {useNativeTourContext} from './context'
import type {ContainRect} from './layout'
import {percentToBox} from './layout'
import {PortableTextNative} from './PortableTextNative'

export interface OverlayNativeProps {
  overlay: GuidedTourTextOverlay
  containRect: ContainRect
}

const BACKGROUND_STYLE_KEY = {
  surface: 'overlaySurfaceBackground',
  contrast: 'overlayContrastBackground',
  accent: 'overlayAccentBackground',
  none: 'overlayNoneBackground',
} as const

/**
 * A block of rich `content` pinned at a fixed TOP-LEFT position on the
 * screenshot — the native counterpart of web's `TextOverlay.tsx`.
 * Deliberately top-left anchored, no centering (unlike
 * `HotspotNative`/`TooltipNative`'s point-centered markers) — same
 * `percentToBox`/`percentToPoint` split as web's own "no
 * `translate(-50%,-50%)` on `.gt-overlay`" distinction, ported to
 * `./layout.ts`'s two resolver functions.
 *
 * `opacity` applies to the BACKGROUND ONLY, never the text sitting on top
 * of it — same invariant web's doc comment states (a `color-mix()`
 * background there; here, a separate absolutely-filled background `View`
 * BEHIND the text `View`, so `opacity` on that one layer never touches the
 * text's own full-opacity render).
 *
 * @public
 */
export function OverlayNative({overlay, containRect}: OverlayNativeProps): ReactNode {
  const {styles} = useNativeTourContext()
  const {x, y, width, background, opacity, content} = overlay
  const box = percentToBox(containRect, x, y, width)

  return (
    <View style={[styles.overlayBase, {left: box.left, top: box.top, width: box.width}]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          styles[BACKGROUND_STYLE_KEY[background]],
          {opacity: opacity / 100},
        ]}
      />
      <PortableTextNative value={content} style={styles.overlayText} />
    </View>
  )
}
