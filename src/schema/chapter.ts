import type {PreviewConfig} from 'sanity'
import {defineField, defineType} from 'sanity'

const preview: PreviewConfig = {
  select: {title: 'title', steps: 'steps'},
  prepare(selection) {
    const title = typeof selection.title === 'string' ? selection.title : undefined
    const steps = Array.isArray(selection.steps) ? selection.steps : undefined
    return {
      title: title || 'Chapter',
      subtitle: steps ? `${steps.length} step${steps.length === 1 ? '' : 's'}` : undefined,
    }
  },
}

export default defineType({
  name: 'guidedTourChapter',
  title: 'Chapter',
  type: 'object',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required().max(100),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      validation: (rule) => rule.max(300),
    }),
    defineField({
      name: 'steps',
      title: 'Steps',
      type: 'array',
      of: [{type: 'guidedTourStep'}],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview,
})
