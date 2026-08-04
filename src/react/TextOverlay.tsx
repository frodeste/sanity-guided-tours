'use client'

import type {CSSProperties, ReactNode} from 'react'

import type {GuidedTourTextOverlay} from '../queries/types'
import {PortableText} from './PortableText'

export interface TextOverlayProps {
  overlay: GuidedTourTextOverlay
}

// `--gt-overlay-opacity` is a CSS custom property, not a member of
// `CSSProperties` — React's type doesn't model arbitrary custom
// properties, so this narrow extension stands in for a cast (`as` is
// banned by oxlint).
type OverlayStyle = CSSProperties & {'--gt-overlay-opacity'?: string}

/**
 * A block of rich `content` pinned at a fixed position on the screenshot
 * (design spec, plan Task 6) — top-left anchored by `x`/`y` percent
 * (unlike `Hotspot`/`Tooltip`'s centered point marker, `.gt-overlay` has
 * no `translate(-50%, -50%)`), sized by `width` percent.
 *
 * `background` selects a `gt-overlay--<background>` modifier class; each
 * one's `background` in `styles.css` is a `color-mix(in srgb, var(--gt-*)
 * var(--gt-overlay-opacity, 90%), transparent)`, so `opacity` (a 0-100
 * percentage, schema-coalesced to 90) is threaded down as the
 * `--gt-overlay-opacity` custom property here rather than applied via the
 * standalone CSS `opacity` property — the plan is explicit that opacity
 * applies to the background color only, not the text content sitting on
 * top of it. The `color-mix()` function's own fallback (`90%` when the
 * property is unset) is the "solid-color fallback" the plan calls for in
 * a browser new enough to run this at all.
 *
 * Non-interactive by design: no click handler, no `element_clicked`
 * event — there is no trigger here, just positioned content (contrast
 * `Tooltip`, whose trigger button does emit one per open).
 *
 * @public
 */
export function TextOverlay({overlay}: TextOverlayProps): ReactNode {
  const {x, y, width, background, opacity, content} = overlay

  const style: OverlayStyle = {
    'left': `${x}%`,
    'top': `${y}%`,
    'width': `${width}%`,
    '--gt-overlay-opacity': `${opacity}%`,
  }

  return (
    <div className={`gt-overlay gt-overlay--${background}`} style={style}>
      <PortableText value={content} />
    </div>
  )
}
