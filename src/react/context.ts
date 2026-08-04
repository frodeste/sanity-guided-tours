import {createContext, useContext, type RefObject} from 'react'

import type {GuidedTourLabels} from './labels'
import type {GuidedTourTracker} from './session'

/**
 * Internal context threading the resolved personalization tokens, merged
 * labels and the session tracker down to the element components (Hotspot,
 * Tooltip, TextOverlay — Tasks 5-6) without prop-drilling them through
 * `Step` and every intermediate layer. Not part of the public `/react`
 * surface — `index.ts` never exports it. Only `<GuidedTour>` provides a
 * value; only components rendered inside its subtree may consume one.
 *
 * `tracker` is carried as a `RefObject`, not dereferenced to the tracker
 * itself: `<GuidedTour>` lazy-initializes it into a ref (surviving React
 * Strict Mode's dev-only effect remount), and reading a ref's `.current`
 * is only safe outside of render — in an effect or event handler.
 * Consumers (a Hotspot's click handler, say) read `.current` there, never
 * during their own render.
 */
export interface GuidedTourContextValue {
  tokens: Record<string, string>
  labels: GuidedTourLabels
  trackerRef: RefObject<GuidedTourTracker | null>
}

export const GuidedTourContext = createContext<GuidedTourContextValue | null>(null)

/**
 * Reads {@link GuidedTourContextValue}, throwing if called outside a
 * `<GuidedTour>` subtree — a programmer error (a Hotspot/Tooltip rendered
 * standalone), not a state a well-formed tree can reach at runtime.
 */
export function useGuidedTourContext(): GuidedTourContextValue {
  const context = useContext(GuidedTourContext)
  if (!context) {
    throw new Error('GuidedTour internal components must be rendered inside <GuidedTour>.')
  }
  return context
}
