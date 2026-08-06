'use client'

import type {ReactNode} from 'react'

import type {GuidedTourTheme} from '../queries/types'
import {resolveFrame} from './theme'

/**
 * @public
 */
export interface FrameProps {
  /** The tour's theme (`GuidedTour`'s `tour.theme`) — resolved via `./theme.ts`'s `resolveFrame`; `null`, or a theme with no `frame` object authored, both fall back to mac chrome (`FRAME_DEFAULTS`, `../queries/defaults`). */
  theme: GuidedTourTheme | null
  /** The tour's already-personalized title, rendered in the mac/windows title bar. Unused for `simple`/`none`. */
  title: string
  children: ReactNode
}

/**
 * Window chrome rendered around a tour's step/outro/lead-capture area (M10
 * design spec §17, `docs/superpowers/plans/2026-08-06-m10-frames-element-
 * design.md` Task 2). Wired into `GuidedTour.tsx` around the region that
 * swaps between `.gt-stage`/`.gt-outro`/`.gt-lead` — wrapping the whole
 * swap region, not `.gt-stage` alone, so the chrome stays visually stable
 * across those transitions instead of popping in and out as a viewer
 * completes a step, opens the lead-capture interstitial, or reaches the
 * outro. Because it's wired into `GuidedTour` itself, it appears
 * automatically in every mount mode (page, `GuidedTourModal`,
 * `GuidedTourEmbed`) without either of those two components needing their
 * own copy of this logic — the same "wire once into `GuidedTour`, every
 * host inherits it" pattern theming itself already follows.
 *
 * `frame.style` (`./theme.ts`'s `resolveFrame`) picks one of four renders:
 * - `mac`: a title bar with three `aria-hidden`, `inert` traffic-light dots
 *   (red/yellow/green CSS circles, `styles.css`'s `.gt-frame__dot--*`) and
 *   the tour's title centered. The dots are decorative only — not real
 *   window controls, no click handlers, `inert` so they can never become a
 *   Tab stop or intercept a pointer event even if something in the
 *   cascade ever gave them a hit target (Global Constraint: chrome bars
 *   never introduce a focusable fake control).
 * - `windows`: a title bar with the title left-aligned and three
 *   `aria-hidden`, `inert` caption glyphs (minimize/maximize/close
 *   lookalikes — plain text characters, not `<button>`s) on the right,
 *   same "purely decorative" treatment as the mac dots.
 * - `simple`: a plain border wrapper, no title bar at all — no `title`
 *   prop is rendered anywhere for this style. `--gt-frame-border`/
 *   `--gt-frame-border-width` (`./theme.ts`'s `themeToStyle`,
 *   `styles.css`'s `.gt-frame--simple`) drive its color/width.
 * - `none`: renders `children` completely unwrapped — no `.gt-frame` div
 *   at all, so a theme with no chrome introduces zero extra DOM (plan:
 *   "no wrapper div beyond what layout needs").
 *
 * `frame.borderRadius` (plus its four independently-optional per-corner
 * overrides, composed by `./theme.ts`'s `frameRadiusShorthand`) rounds the
 * WHOLE frame — chrome bar included — for every style except `none`;
 * `styles.css`'s `.gt-frame` applies it via the `--gt-frame-radius` custom
 * property `themeToStyle` emits, not an inline style here, so dark mode
 * and the "authored vs. stylesheet default" split work the same way every
 * other themed value in this codebase does. This is independent of
 * `--gt-radius`, which stays reserved for the content the frame wraps
 * (`.gt-stage`, `.gt-tooltip`, `.gt-lead`, `.gt-outro`, ...) — see that
 * custom property's own doc comments in `styles.css`.
 *
 * Container-query note (the M6 tooltip-width lesson): this component wraps
 * OUTSIDE `.gt-stage`, never touching its `container-type: inline-size` —
 * `Tooltip.tsx`'s `100cqw` bound still resolves against `.gt-stage`'s own
 * rendered inline size, whatever that ends up being once the frame's
 * border/title-bar chrome (if any) has taken its share of the available
 * width. No `container-type`/`contain` is set anywhere in this component,
 * so it introduces no second, competing query container.
 *
 * @public
 */
export function Frame({theme, title, children}: FrameProps): ReactNode {
  const frame = resolveFrame(theme)

  if (frame.style === 'none') return children

  if (frame.style === 'simple') {
    return <div className="gt-frame gt-frame--simple">{children}</div>
  }

  // Only 'mac' | 'windows' remain — a title bar, chrome-specific
  // decorations on either side of the title, then the wrapped content.
  return (
    <div className={`gt-frame gt-frame--${frame.style}`}>
      <div className="gt-frame__bar">
        {frame.style === 'mac' && (
          <span className="gt-frame__dots" aria-hidden="true" inert>
            <span className="gt-frame__dot gt-frame__dot--red" />
            <span className="gt-frame__dot gt-frame__dot--yellow" />
            <span className="gt-frame__dot gt-frame__dot--green" />
          </span>
        )}
        <span className="gt-frame__title">{title}</span>
        {frame.style === 'windows' && (
          <span className="gt-frame__glyphs" aria-hidden="true" inert>
            <span className="gt-frame__glyph">−</span>
            <span className="gt-frame__glyph">□</span>
            <span className="gt-frame__glyph">×</span>
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
