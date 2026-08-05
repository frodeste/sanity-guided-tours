'use client'

import {useEffect, useState, type ReactNode} from 'react'

import type {GuidedTourEmbedValue} from '../queries/types'
import {GuidedTour, type GuidedTourProps} from './GuidedTour'
import {GuidedTourModal} from './GuidedTourModal'
import {defaultLabels, type GuidedTourLabels} from './labels'
import {personalizeText, resolveTokens} from './personalize'

/**
 * @public
 */
export interface GuidedTourEmbedProps extends Omit<GuidedTourProps, 'tour'> {
  /** The dereferenced `guidedTourEmbed` value — `guidedTourEmbedProjection`'s result shape (`../queries`). */
  value: GuidedTourEmbedValue
}

/**
 * Renders a `guidedTourEmbed` object (design spec §14) placed on a page —
 * a Portable Text block or a page-builder section — as either an inline
 * `<GuidedTour>` or a button that opens one in a `<GuidedTourModal>`,
 * mirroring the object's own `displayMode` field.
 *
 * `value.tour` is nullable by projection contract (`guidedTourEmbedProjection`
 * dereferences a broken, unpublished, or draft-only reference to `null`
 * rather than failing the query) — this never crashes on that: it renders a
 * small neutral `.gt-embed-missing` placeholder instead, with a
 * visually-hidden "Tour unavailable" for screen readers (there is
 * deliberately no *visible* text — an editor left a dangling reference,
 * not a message a site visitor needs to read) and a dev-only
 * `console.warn`, same "silent in production, loud in development" idiom
 * `<GuidedTour>` itself uses for a missing required token
 * (`personalize.ts`'s `missingRequired`).
 *
 * Modal mode's trigger button label resolves in the same order every other
 * authored/override string in this codebase does: `value.buttonLabel` —
 * authored Studio content, so personalized via `{{token}}` substitution
 * exactly like a tour title (`personalizeText`/`resolveTokens`) — wins when
 * non-empty; otherwise `labels.startTour` (default `"Start the tour"`, the
 * one new `GuidedTourLabels` member added for this), an ordinary UI string
 * with no personalization of its own. Open state is local, uncontrolled
 * `useState` — there is no equivalent of `GuidedTourProps.step` for this,
 * since a Portable Text embed has no URL of its own to sync to.
 *
 * @public
 */
export function GuidedTourEmbed({value, ...rest}: GuidedTourEmbedProps): ReactNode {
  const {tour, displayMode, buttonLabel} = value
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (tour !== null) return
    if (process.env.NODE_ENV === 'production') return
    console.warn(
      `[GuidedTourEmbed] value.tour is null for embed "${value._key}" — the referenced tour is missing, unpublished, or draft-only.`,
    )
  }, [tour, value._key])

  if (tour === null) {
    return (
      <div className="gt-embed-missing">
        <span className="gt-visually-hidden">Tour unavailable</span>
      </div>
    )
  }

  if (displayMode === 'inline') {
    return (
      <div className="gt-embed">
        <GuidedTour tour={tour} {...rest} />
      </div>
    )
  }

  const {tokens: providedTokens, labels: labelOverrides} = rest
  const labels: GuidedTourLabels = {...defaultLabels, ...labelOverrides}
  const resolvedTokens = resolveTokens(tour.tokens, providedTokens ?? {})
  const trimmedButtonLabel = buttonLabel?.trim()
  const startLabel = trimmedButtonLabel
    ? personalizeText(trimmedButtonLabel, resolvedTokens)
    : labels.startTour

  return (
    <>
      <button type="button" className="gt-embed-start" onClick={() => setOpen(true)}>
        {startLabel}
      </button>
      <GuidedTourModal tour={tour} {...rest} open={open} onOpenChange={setOpen} />
    </>
  )
}
