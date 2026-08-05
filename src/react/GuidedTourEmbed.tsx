'use client'

import {useEffect, useState, type ReactNode} from 'react'

import type {GuidedTourEmbedValue} from '../queries/types'
import {GuidedTour, type GuidedTourProps} from './GuidedTour'
import {GuidedTourModal} from './GuidedTourModal'
import {defaultLabels, type GuidedTourLabels} from './labels'
import {personalizeText, resolveTokens} from './personalize'
import {schemeAttr, themeToStyle} from './theme'

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
 * The `.gt-embed` wrapper (inline mode's existing div; modal mode gains one
 * too, around the trigger button + `<GuidedTourModal>`) carries
 * `themeToStyle(tour.theme)` and `data-gt-scheme` directly (M7 review fix):
 * `.gt-embed-start` is a SIBLING of `<GuidedTourModal>`, not a descendant
 * of the `.gt-tour` it opens, so it can't inherit that tour's resolved
 * `--gt-accent` etc — CSS custom properties only inherit downward. Inline
 * mode's wrapper doesn't strictly need this today (nothing on `.gt-embed`
 * itself references a `--gt-*` custom property; the nested `.gt-tour`
 * resolves its own), but carries it too for consistency with modal mode
 * and so a future `.gt-embed`-scoped style doesn't silently regress.
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

  // See the doc comment above: both modes' wrapper needs its own copy of
  // the theme's custom properties and scheme attribute — `.gt-embed`
  // isn't a descendant of the `.gt-tour` a nested `<GuidedTour>`/
  // `<GuidedTourModal>` renders, so it can't inherit theirs.
  const embedStyle = themeToStyle(tour.theme)
  const embedScheme = schemeAttr(rest.colorScheme)

  if (displayMode === 'inline') {
    return (
      <div className="gt-embed" style={embedStyle} data-gt-scheme={embedScheme}>
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
    <div className="gt-embed" style={embedStyle} data-gt-scheme={embedScheme}>
      <button type="button" className="gt-embed-start" onClick={() => setOpen(true)}>
        {startLabel}
      </button>
      <GuidedTourModal tour={tour} {...rest} open={open} onOpenChange={setOpen} />
    </div>
  )
}
