import type {FieldDefinition} from 'sanity'
import {defineField} from 'sanity'

/**
 * Percentage-based x/y coordinates shared by every step element, plus an
 * optional per-element override for narrow (mobile) viewports.
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
          description: 'Element width as a percentage of the mobile screenshot width.',
          validation: (rule) => rule.min(1).max(100),
        }),
      ],
    }),
  ]
}
