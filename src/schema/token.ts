import type {PreviewConfig} from 'sanity'
import {defineField, defineType} from 'sanity'

const preview: PreviewConfig = {
  select: {label: 'label', key: 'key'},
  prepare(selection) {
    const label = typeof selection.label === 'string' ? selection.label : undefined
    const key = typeof selection.key === 'string' ? selection.key : undefined
    return {
      title: label || key || 'Token',
      subtitle: key ? `{{${key}}}` : undefined,
    }
  },
}

export default defineType({
  name: 'guidedTourToken',
  title: 'Token',
  type: 'object',
  description: 'A placeholder replaced with content when a tour is embedded, e.g. a product name.',
  fields: [
    defineField({
      name: 'key',
      title: 'Key',
      type: 'string',
      description: 'Referenced in content as {{key}}.',
      validation: (rule) =>
        rule
          .required()
          .regex(/^[a-z_]+$/)
          .error('lowercase letters and underscores only'),
    }),
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'defaultValue',
      title: 'Default value',
      type: 'string',
      description: 'Used when the consumer does not supply a value for this token.',
    }),
    defineField({
      name: 'required',
      title: 'Required',
      type: 'boolean',
      description: 'Whether the consumer must supply a value for this token.',
      initialValue: false,
    }),
  ],
  preview,
})
