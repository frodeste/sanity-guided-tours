import {defineArrayMember, defineField, defineType} from 'sanity'

/** Reads `parent.trigger` off a conditional-property context's `parent`, without an unsafe cast. */
function parentTrigger(parent: unknown): unknown {
  return typeof parent === 'object' && parent !== null && 'trigger' in parent
    ? parent.trigger
    : undefined
}

/** Reads a lead-capture field entry's `name`, without an unsafe cast. */
function fieldName(field: unknown): string | undefined {
  return typeof field === 'object' &&
    field !== null &&
    'name' in field &&
    typeof field.name === 'string'
    ? field.name
    : undefined
}

export default defineType({
  name: 'guidedTourLeadCapture',
  title: 'Lead capture',
  type: 'object',
  fields: [
    defineField({
      name: 'enabled',
      title: 'Enabled',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'trigger',
      title: 'Trigger',
      type: 'string',
      description: 'When the lead-capture form is shown.',
      options: {
        list: [
          {title: 'After a step', value: 'afterStep'},
          {title: 'At the end', value: 'atEnd'},
        ],
      },
      initialValue: 'atEnd',
    }),
    defineField({
      name: 'afterStepIndex',
      title: 'After step',
      type: 'number',
      description:
        "Zero-based step index that triggers the form. The form shows in place of the step at index + 1. If the index is beyond the tour's steps (index + 1 has no step), the form is skipped — use the At end trigger instead.",
      hidden: ({parent}) => parentTrigger(parent) !== 'afterStep',
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'fields',
      title: 'Fields',
      type: 'array',
      description:
        'Field names must be unique — the viewer submits values keyed by name (a duplicate silently collapses to one value).',
      validation: (rule) =>
        rule.custom((fields) => {
          if (!Array.isArray(fields)) return true
          const seen = new Set<string>()
          for (const field of fields) {
            const name = fieldName(field)
            if (!name) continue // the field's own `name` already has its own `required()` rule
            if (seen.has(name)) {
              return `Field names must be unique — "${name}" is used by more than one field.`
            }
            seen.add(name)
          }
          return true
        }),
      of: [
        defineArrayMember({
          type: 'object',
          name: 'field',
          title: 'Field',
          fields: [
            defineField({
              name: 'name',
              title: 'Name',
              type: 'string',
              description: 'Machine-readable field name, e.g. used as a form field key.',
              validation: (rule) =>
                rule
                  .required()
                  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
                  .error('must start with a letter and contain only letters, numbers, underscores'),
            }),
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'type',
              title: 'Type',
              type: 'string',
              options: {
                list: [
                  {title: 'Text', value: 'text'},
                  {title: 'Email', value: 'email'},
                  {title: 'Phone', value: 'tel'},
                  {title: 'Textarea', value: 'textarea'},
                ],
              },
              initialValue: 'text',
            }),
            defineField({
              name: 'required',
              title: 'Required',
              type: 'boolean',
              initialValue: false,
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'consentText',
      title: 'Consent text',
      type: 'text',
      description: 'Shown next to a consent checkbox, e.g. privacy policy acknowledgement.',
    }),
    defineField({
      name: 'submitLabel',
      title: 'Submit button label',
      type: 'string',
    }),
  ],
})
