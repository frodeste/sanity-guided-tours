import type {PreviewConfig} from 'sanity'
import {defineField, defineType} from 'sanity'

import {EMBED_DEFAULTS} from '../queries/defaults'

/** Reads `parent.displayMode` off a conditional-property context's `parent`, without an unsafe cast. */
function parentDisplayMode(parent: unknown): unknown {
  return typeof parent === 'object' && parent !== null && 'displayMode' in parent
    ? parent.displayMode
    : undefined
}

const preview: PreviewConfig = {
  select: {title: 'tour.title', displayMode: 'displayMode'},
  prepare(selection) {
    const title = typeof selection.title === 'string' ? selection.title : undefined
    const displayMode =
      typeof selection.displayMode === 'string' ? selection.displayMode : undefined
    return {
      title: title || 'Guided tour embed',
      subtitle: displayMode === 'modal' ? 'Button + modal' : 'Inline',
    }
  },
}

export default defineType({
  name: 'guidedTourEmbed',
  title: 'Guided tour embed',
  type: 'object',
  description:
    'Places a guided tour on a page, either inline or behind a button that opens a modal.',
  fields: [
    defineField({
      name: 'tour',
      title: 'Tour',
      type: 'reference',
      to: [{type: 'guidedTour'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'displayMode',
      title: 'Display mode',
      type: 'string',
      options: {
        list: [
          {title: 'Inline', value: 'inline'},
          {title: 'Button + modal', value: 'modal'},
        ],
        layout: 'radio',
      },
      initialValue: EMBED_DEFAULTS.displayMode,
    }),
    defineField({
      name: 'buttonLabel',
      title: 'Button label',
      type: 'string',
      description:
        'Shown on the button that opens the tour modal. Leave empty to use the default label.',
      hidden: ({parent}) => parentDisplayMode(parent) !== 'modal',
      validation: (rule) => rule.max(60),
    }),
  ],
  preview,
})
