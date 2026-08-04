import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'guidedTourSettings',
  title: 'Settings',
  type: 'object',
  fields: [
    defineField({
      name: 'showProgress',
      title: 'Show progress',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'showChapterMenu',
      title: 'Show chapter menu',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'showStepDots',
      title: 'Show step dots',
      type: 'boolean',
      initialValue: true,
    }),
  ],
})
