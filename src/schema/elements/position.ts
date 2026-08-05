import type {FieldDefinition} from 'sanity'
import {defineField} from 'sanity'

/**
 * Percentage-based x/y coordinates shared by every step element, plus an
 * optional per-element override for narrow (mobile) viewports. `mobile.x`/
 * `mobile.y` are always percentages, matching the top-level `x`/`y` they
 * override. `mobile.width`, however, follows whichever unit the *element's
 * own* `width` field uses — px (200-600) for `guidedTourTooltip`, percent
 * (10-100) for `guidedTourTextOverlay` (`src/react/Step.tsx`'s
 * `mobileWidth ?? element.width` substitutes it directly, unit and all) —
 * so its validation range here is the union of both, `[1, 600]`, rather
 * than a percent-shaped `[1, 100]`.
 */
export function positionFields(): FieldDefinition[] {
  return [
    defineField({
      name: 'x',
      title: 'Horizontal position',
      type: 'number',
      description: 'Horizontal position as a percentage of the screenshot width.',
      validation: (rule) => rule.required().min(0).max(100),
    }),
    defineField({
      name: 'y',
      title: 'Vertical position',
      type: 'number',
      description: 'Vertical position as a percentage of the screenshot height.',
      validation: (rule) => rule.required().min(0).max(100),
    }),
    defineField({
      name: 'mobile',
      title: 'Mobile override',
      type: 'object',
      description: 'Optional position and width override shown on narrow viewports.',
      fields: [
        defineField({
          name: 'x',
          title: 'Horizontal position',
          type: 'number',
          description: 'Horizontal position as a percentage of the mobile screenshot width.',
          validation: (rule) => rule.min(0).max(100),
        }),
        defineField({
          name: 'y',
          title: 'Vertical position',
          type: 'number',
          description: 'Vertical position as a percentage of the mobile screenshot height.',
          validation: (rule) => rule.min(0).max(100),
        }),
        defineField({
          name: 'width',
          title: 'Width',
          type: 'number',
          description:
            "Same unit and range as this element's width field (px for tooltips, % for text overlays).",
          validation: (rule) => rule.min(1).max(600),
        }),
      ],
    }),
  ]
}
