'use client'

import type {ReactNode} from 'react'

import type {GuidedTourOutro} from '../queries/types'
import {useGuidedTourContext} from './context'
import {personalizeText} from './personalize'
import {PortableText} from './PortableText'

export interface OutroProps {
  outro: GuidedTourOutro
}

/**
 * The screen `GuidedTour` swaps in for `.gt-stage` once the viewer
 * completes the last step of a tour that has an `outro` (design spec §8,
 * plan M4 Task 2): a personalized heading, the outro's rich-text `body`
 * (via the shared `PortableText` renderer, same personalization pipeline
 * every other rich-text field uses), and any CTA buttons.
 *
 * CTAs render as real `<a class="gt-cta gt-cta--<style>">` — same
 * accessibility rationale as `Hotspot`'s `action: 'link'` carve-out
 * (native anchor semantics: middle-click, context menu, status bar) —
 * with `target="_blank" rel="noopener noreferrer"`. `href` is always the
 * raw, unpersonalized value (spec §8.3 — a token must never end up
 * substituted into a URL); only the *label* is personalized, and it's the
 * personalized (displayed) text that's emitted in the `cta_clicked`
 * event's `label`, not the raw author string.
 *
 * @public
 */
export function Outro({outro}: OutroProps): ReactNode {
  const {tokens, trackerRef} = useGuidedTourContext()
  const {heading, body, ctas} = outro

  return (
    <div className="gt-outro-content">
      {/* An empty string is treated the same as `null` — absent, no
          heading element — matching `GuidedTour.tsx`'s live-region
          announcement, which already falls back to `''` for exactly this
          case (CI review, PR 101: the two must agree on what "no heading"
          means). */}
      {heading !== null && heading !== '' && (
        <h3 className="gt-outro-heading">{personalizeText(heading, tokens)}</h3>
      )}
      <PortableText value={body} />
      {ctas && ctas.length > 0 && (
        <div className="gt-outro-ctas">
          {ctas.map((cta) => {
            const label = personalizeText(cta.label, tokens)
            return (
              <a
                key={cta._key}
                className={`gt-cta gt-cta--${cta.style}`}
                href={cta.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackerRef.current?.ctaClicked({label, href: cta.href})}
              >
                {label}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
