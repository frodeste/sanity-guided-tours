import {createContext, useContext, type RefObject} from 'react'

import type {GuidedTourLabels} from '../react/labels'
import type {GuidedTourTracker} from '../react/session'
import type {NativeTheme} from './nativeTheme'
import type {NativeStyles} from './styles'

/**
 * The native viewer's internal context — threads resolved personalization
 * tokens, merged labels, the session tracker, the resolved theme/style
 * objects and Ruling B's reduced-motion state down to `StepNative` and its
 * children (`HotspotNative`/`TooltipNative`/`OverlayNative`/`OutroNative`)
 * without prop-drilling five values through every intermediate layer.
 *
 * Deliberately a SEPARATE context from web's `../react/context.ts`
 * (`GuidedTourContext`), not a reuse of it — `context.ts` is not on
 * `test/exports.test.ts`'s `ALLOWED_REACT_IMPORTS` allow-list for
 * `src/native` (only `navigation`/`personalize`/`events`/`session`/
 * `labels`/`theme` are), and its shape wouldn't fit native anyway: web's
 * `closeOpenTooltipRef` exists ONLY to let `GuidedTour.tsx`'s root
 * `onKeyDown` close a tooltip from outside its own subtree (plan Task 8) —
 * native has no keyboard-navigation root handler in v1 (out of the brief's
 * scope) and so nothing that would ever read it, and native additionally
 * needs `theme`/`styles`/`reducedMotion` threaded, which web's components
 * get differently (CSS custom properties cascading through the DOM, and a
 * plain synchronous `prefersReducedMotion()` call at each use site) rather
 * than through context at all.
 *
 * Only `GuidedTourNative.tsx`'s `<GuidedTour>` provides a value; only
 * components rendered inside its subtree may consume one — same rule as
 * web's context, same reason (`Step`/`Hotspot`/`Tooltip`/`TextOverlay`
 * standalone would have nothing sensible to read).
 */
export interface NativeTourContextValue {
  tokens: Record<string, string>
  labels: GuidedTourLabels
  trackerRef: RefObject<GuidedTourTracker | null>
  theme: NativeTheme
  styles: NativeStyles
  /** Ruling B's resolved `AccessibilityInfo.isReduceMotionEnabled()` value — see `./reducedMotion.ts`'s `useReducedMotion` doc comment for what it gates in v1. */
  reducedMotion: boolean
}

export const NativeTourContext = createContext<NativeTourContextValue | null>(null)

/**
 * Reads {@link NativeTourContextValue}, throwing if called outside a
 * `<GuidedTour>` subtree — a programmer error (an internal native
 * component rendered standalone), not a state a well-formed tree can reach
 * at runtime. Mirrors web's `useGuidedTourContext` (`../react/context.ts`)
 * exactly, one level removed (a distinct context object — see this
 * module's own doc comment for why).
 */
export function useNativeTourContext(): NativeTourContextValue {
  const context = useContext(NativeTourContext)
  if (!context) {
    throw new Error(
      'GuidedTour native internal components must be rendered inside <GuidedTour> (sanity-plugin-guided-tours/native).',
    )
  }
  return context
}
