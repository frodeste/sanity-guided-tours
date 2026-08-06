import type {ReactNode} from 'react'
import {Modal, Pressable, Text, View, useColorScheme} from 'react-native'

import {defaultLabels, type GuidedTourLabels} from '../react/labels'
import {personalizeText, resolveTokens} from '../react/personalize'
import {GuidedTour, type GuidedTourNativeProps} from './GuidedTourNative'
import type {NativeTheme} from './nativeTheme'
import {resolveNativeTheme} from './nativeTheme'
import {useReducedMotion} from './reducedMotion'
import {createStyles} from './styles'

/**
 * @public
 */
export interface GuidedTourModalNativeProps extends GuidedTourNativeProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Mounts `<GuidedTour>` inside an RN `Modal` — the native counterpart of
 * web's `GuidedTourModal.tsx`. Unmount-on-close: `open={false}` passes
 * `visible={false}` straight through to `Modal` (nothing rendered at all,
 * same as web's `open={false}` → `null` — `<GuidedTour>`'s own abandonment
 * semantics on unmount, `session.ts`, fire exactly as they would for any
 * other unmount).
 *
 * `onRequestClose` (Android hardware back button / OS-level dismiss
 * gesture) calls `onOpenChange(false)` — the dismiss-parity hook the brief
 * calls for: same effect as web's Escape handler or backdrop click, one
 * single-purpose native entry point standing in for web's several
 * (Escape, backdrop click, the close button) since RN has no keyboard/
 * click-outside equivalent to wire up in v1.
 *
 * `accessibilityViewIsModal` on the panel `View` (brief's explicit
 * accessibility requirement) — iOS VoiceOver's "trap navigation inside
 * this subtree" signal; Android has no exact equivalent RN exposes, so
 * this is a real (if platform-partial) implementation, not a placeholder.
 *
 * Independently resolves its OWN theme/tokens (like web's modal does for
 * `.gt-modal-backdrop`, its own doc comment explains why: the label has to
 * exist on the panel itself, one level above where `<GuidedTour>` renders)
 * — `theme`/`reducedMotion` are each computed a second time here rather
 * than read off the nested `<GuidedTour>`'s own internal state, mirroring
 * web's same duplication for the same reason.
 *
 * v1 does NOT close on a backdrop press (unlike web's backdrop click) —
 * RN's touch-responder model makes "tap outside the panel, but not on any
 * interactive content inside it" meaningfully harder to get right than
 * DOM event-target comparison (`event.target === event.currentTarget`)
 * without risking swallowing presses on non-interactive panel whitespace;
 * deferred rather than shipped half-correct. The explicit close button and
 * `onRequestClose` cover v1's dismissal paths.
 *
 * @public
 */
export function GuidedTourModal({
  open,
  onOpenChange,
  ...rest
}: GuidedTourModalNativeProps): ReactNode {
  const {tour, tokens: providedTokens, labels: labelOverrides, colorScheme = 'auto'} = rest

  const reducedMotion = useReducedMotion()
  const systemScheme = useColorScheme()
  const resolvedScheme: 'light' | 'dark' =
    colorScheme === 'auto' ? (systemScheme === 'dark' ? 'dark' : 'light') : colorScheme
  const theme: NativeTheme = resolveNativeTheme(tour.theme, resolvedScheme)
  const styles = createStyles(theme)

  const labels: GuidedTourLabels = {...defaultLabels, ...labelOverrides}
  const resolvedTokens = resolveTokens(tour.tokens, providedTokens ?? {})
  const title = personalizeText(tour.title, resolvedTokens)

  return (
    <Modal
      visible={open}
      transparent
      // Ruling B: reduced motion disables the modal's own open/close
      // transition — the one real motion surface v1 has (see
      // `./reducedMotion.ts`'s doc comment for the other, `HotspotNative`'s
      // pulse ring).
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={() => onOpenChange(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel} accessibilityViewIsModal accessibilityLabel={title}>
          <Pressable
            onPress={() => onOpenChange(false)}
            accessibilityRole="button"
            accessibilityLabel={labels.modalClose}
            style={styles.modalCloseButton}
          >
            <Text style={styles.modalCloseText}>×</Text>
          </Pressable>
          <GuidedTour {...rest} />
        </View>
      </View>
    </Modal>
  )
}
