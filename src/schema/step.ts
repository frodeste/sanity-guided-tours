import type {PreviewConfig} from 'sanity'
import {defineField, defineType} from 'sanity'

const preview: PreviewConfig = {
  select: {title: 'title'},
  prepare(selection) {
    const title = typeof selection.title === 'string' ? selection.title : undefined
    return {title: title || 'Step'}
  },
}

/** Reads `parent.advance` off a validation/conditional-property context's `parent`, without an unsafe cast. */
function parentAdvance(parent: unknown): unknown {
  return typeof parent === 'object' && parent !== null && 'advance' in parent
    ? parent.advance
    : undefined
}

export default defineType({
  name: 'guidedTourStep',
  title: 'Step',
  type: 'object',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Optional heading shown to viewers.',
      validation: (rule) => rule.max(100),
    }),
    defineField({
      name: 'screenshot',
      title: 'Screenshot',
      type: 'image',
      description: 'The screenshot elements are positioned over.',
      options: {hotspot: true},
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
          validation: (rule) => rule.required(),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'screenshotMobile',
      title: 'Mobile screenshot',
      type: 'image',
      description: 'Optional narrow-viewport screenshot; falls back to the main screenshot.',
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
        }),
      ],
    }),
    defineField({
      name: 'elements',
      title: 'Elements',
      type: 'array',
      description: 'Hotspots, tooltips, and text overlays positioned on the screenshot.',
      of: [
        {type: 'guidedTourHotspot'},
        {type: 'guidedTourTooltip'},
        {type: 'guidedTourTextOverlay'},
      ],
    }),
    defineField({
      name: 'advance',
      title: 'Advance',
      type: 'string',
      description: 'How a viewer leaves this step.',
      options: {
        list: [
          {title: 'Hotspot', value: 'hotspot'},
          {title: 'Button', value: 'button'},
          {title: 'Auto', value: 'auto'},
        ],
      },
      initialValue: 'hotspot',
    }),
    defineField({
      name: 'duration',
      title: 'Duration',
      type: 'number',
      description:
        'Seconds before the step advances automatically. Only used when Advance is Auto.',
      hidden: ({parent}) => parentAdvance(parent) !== 'auto',
      validation: (rule) =>
        rule
          .min(3)
          .max(300)
          .custom((value, context) => {
            const advance = parentAdvance(context.parent)
            if (advance === 'auto' && (value === undefined || value === null)) {
              return 'Required when advance is "auto"'
            }
            return true
          }),
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
      description: 'Internal notes for authors; never shown to viewers.',
    }),
  ],
  preview,
})
