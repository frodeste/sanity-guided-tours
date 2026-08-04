import type {PreviewConfig} from 'sanity'
import {defineField, defineType} from 'sanity'

import {positionFields} from './position'
import {firstPlainText, positionSubtitle} from './previewHelpers'

const preview: PreviewConfig = {
  select: {content: 'content', x: 'x', y: 'y'},
  prepare(selection) {
    return {
      title: firstPlainText(selection.content) || 'Tooltip',
      subtitle: positionSubtitle(selection.x, selection.y),
    }
  },
}

export default defineType({
  name: 'guidedTourTooltip',
  title: 'Tooltip',
  type: 'object',
  fields: [
    ...positionFields(),
    defineField({
      name: 'width',
      title: 'Width',
      type: 'number',
      description: 'Tooltip width in pixels.',
      initialValue: 300,
      validation: (rule) => rule.min(200).max(600),
    }),
    defineField({
      name: 'content',
      title: 'Content',
      type: 'guidedTourRichText',
      description: 'Tooltip body content.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'placement',
      title: 'Placement',
      type: 'string',
      description: 'Preferred side of the hotspot the tooltip opens toward.',
      options: {
        list: [
          {title: 'Top', value: 'top'},
          {title: 'Bottom', value: 'bottom'},
          {title: 'Left', value: 'left'},
          {title: 'Right', value: 'right'},
          {title: 'Auto', value: 'auto'},
        ],
      },
      initialValue: 'auto',
    }),
    defineField({
      name: 'trigger',
      title: 'Trigger',
      type: 'string',
      description: 'How the tooltip is opened.',
      options: {
        list: [
          {title: 'Click', value: 'click'},
          {title: 'Hover', value: 'hover'},
          {title: 'Auto', value: 'auto'},
        ],
      },
      initialValue: 'click',
    }),
  ],
  preview,
})
