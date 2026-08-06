import type {ReactNode} from 'react'
import {Pressable, View} from 'react-native'

import type {GuidedTourTooltip} from '../queries/types'
import {useNativeTourContext} from './context'
import type {ContainRect} from './layout'
import {percentToPoint} from './layout'
import {PortableTextNative} from './PortableTextNative'

export interface TooltipNativeProps {
  tooltip: GuidedTourTooltip
  containRect: ContainRect
  /** Whether this tooltip is the one currently open — the single-open invariant lives in `StepNative`, same as web. */
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

/**
 * Resolves a tooltip's vertical placement — the v1 native subset of web's
 * `resolvePlacement` (`Tooltip.tsx`): native drops `left`/`right`
 * entirely (brief: "placement simplified to above/below midpoint") and
 * applies the SAME `y < 50` rule web's `auto` placement uses
 * UNCONDITIONALLY, not just when the author left `placement` on `'auto'`
 * — there is nothing else for an authored `'left'`/`'right'`/explicit
 * `'top'`/`'bottom'` to mean in a two-option native vocabulary, so every
 * tooltip resolves by the same midpoint rule regardless of what was
 * authored. `y < 50` (the top half of the screenshot) opens the panel
 * DOWNWARD ("below") so it doesn't run off the top edge — the same
 * reasoning web's own doc comment gives.
 *
 * Exported for direct unit testing, same convention as web's
 * `nearestTooltipKey`.
 *
 * @public
 */
export function resolveNativeTooltipPlacement(y: number): 'above' | 'below' {
  return y < 50 ? 'below' : 'above'
}

/**
 * A positioned disclosure — the native counterpart of web's `Tooltip.tsx`.
 * Press-only trigger in v1 (brief: "click-trigger only — hover doesn't
 * exist on touch"): `tooltip.trigger === 'hover'` degrades to the same
 * press-toggle behavior as `'click'` — there is no RN pointer-enter/leave
 * equivalent on a touch-primary platform, and `'auto'`'s own "open on step
 * mount" is driven by `StepNative` calling `onOpen` directly (identical to
 * web), never by anything in this component. `trigger` therefore isn't
 * even read here — every mode presses the same way once mounted.
 *
 * The panel is conditionally mounted (`isOpen && ...`), unlike web's
 * always-mounted-but-`hidden` panel (web's `aria-controls` invariant has
 * no RN equivalent requiring a persistent node) — a deliberate v1
 * simplification, not an oversight.
 *
 * `element_clicked {elementType: 'tooltip', ...}` fires only on the OPEN
 * transition (never on close, never on an already-open re-press) — same
 * guard as web's `open()`.
 *
 * @public
 */
export function TooltipNative({
  tooltip,
  containRect,
  isOpen,
  onOpen,
  onClose,
}: TooltipNativeProps): ReactNode {
  const {labels, trackerRef, styles} = useNativeTourContext()
  const {_key, x, y, width, content} = tooltip
  const point = percentToPoint(containRect, x, y)
  const placement = resolveNativeTooltipPlacement(y)
  const panelWidth = (width / 100) * containRect.width

  function handlePress(): void {
    if (isOpen) {
      onClose()
      return
    }
    trackerRef.current?.elementClicked({elementType: 'tooltip', elementKey: _key})
    onOpen()
  }

  return (
    <View style={[styles.tooltipAnchor, {left: point.left, top: point.top}]}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{expanded: isOpen}}
        accessibilityLabel={isOpen ? labels.closeTooltip : labels.hotspotReveal}
        style={styles.tooltipTrigger}
      />
      {isOpen && (
        <View
          style={[
            styles.tooltipPanel,
            placement === 'below' ? styles.tooltipPanelBelow : styles.tooltipPanelAbove,
            {width: panelWidth},
          ]}
        >
          <PortableTextNative value={content} style={styles.tooltipText} />
        </View>
      )}
    </View>
  )
}
