import type {PreviewConfig} from 'sanity'
import {defineField, defineType} from 'sanity'

import {positionFields} from './position'
import {firstPlainText, positionSubtitle} from './previewHelpers'

const preview: PreviewConfig = {
  select: {content: 'content', x: 'x', y: 'y'},
  prepare(selection) {
    return {
      title: firstPlainText(selection.content) || 'Text overlay',
      subtitle: positionSubtitle(selection.x, selection.y),
    }
  },
}

export default defineType({
  name: 'guidedTourTextOverlay',
  title: 'Text overlay',
  type: 'object',
  fields: [
    ...positionFields(),
    defineField({
      name: 'width',
      title: 'Width',
      type: 'number',
      description: 'Text overlay width as a percentage of the screenshot width.',
      initialValue: 30,
      validation: (rule) => rule.min(10).max(100),
    }),
    defineField({
      name: 'content',
      title: 'Content',
      type: 'guidedTourRichText',
      description: 'Text overlay body content.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'background',
      title: 'Background',
      type: 'string',
      description: 'Background treatment behind the text.',
      options: {
        list: [
          {title: 'Surface', value: 'surface'},
          {title: 'Contrast', value: 'contrast'},
          {title: 'Accent', value: 'accent'},
          {title: 'None', value: 'none'},
        ],
      },
      initialValue: 'surface',
    }),
    defineField({
      name: 'opacity',
      title: 'Background opacity',
      type: 'number',
      description: 'Background opacity as a percentage.',
      initialValue: 90,
      validation: (rule) => rule.min(0).max(100),
    }),
  ],
  preview,
})
