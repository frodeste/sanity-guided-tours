import type {PreviewConfig} from 'sanity'
import {defineField, defineType} from 'sanity'

import {positionFields} from './position'
import {positionSubtitle} from './previewHelpers'

const preview: PreviewConfig = {
  select: {label: 'label', action: 'action', x: 'x', y: 'y'},
  prepare(selection) {
    const label = typeof selection.label === 'string' ? selection.label : undefined
    const action = typeof selection.action === 'string' ? selection.action : undefined
    return {
      title: label || (action ? `Hotspot (${action})` : 'Hotspot'),
      subtitle: positionSubtitle(selection.x, selection.y),
    }
  },
}

export default defineType({
  name: 'guidedTourHotspot',
  title: 'Hotspot',
  type: 'object',
  fields: [
    ...positionFields(),
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      description: 'Accessible name announced to assistive technology; not shown visually.',
    }),
    defineField({
      name: 'action',
      title: 'Action',
      type: 'string',
      description: 'What happens when a viewer activates the hotspot.',
      options: {
        layout: 'radio',
        list: [
          {title: 'Advance to next step', value: 'advance'},
          {title: 'Reveal an element', value: 'reveal'},
          {title: 'Open link', value: 'link'},
        ],
      },
      initialValue: 'advance',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'href',
      title: 'Link URL',
      type: 'url',
      description: 'Destination URL, required when the action is "Open link".',
      validation: (rule) =>
        rule.uri({scheme: ['http', 'https', 'mailto', 'tel']}).custom((value, context) => {
          const {parent} = context
          const action =
            typeof parent === 'object' && parent !== null && 'action' in parent
              ? parent.action
              : undefined
          if (action === 'link' && !value) {
            return 'Required when the action is "Open link"'
          }
          return true
        }),
    }),
    defineField({
      name: 'pulse',
      title: 'Pulse animation',
      type: 'boolean',
      description: 'Draw attention to the hotspot with a pulsing animation.',
      initialValue: true,
    }),
  ],
  preview,
})
