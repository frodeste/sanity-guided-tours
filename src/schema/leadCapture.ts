import {defineArrayMember, defineField, defineType} from 'sanity'

/** Reads `parent.trigger` off a conditional-property context's `parent`, without an unsafe cast. */
function parentTrigger(parent: unknown): unknown {
  return typeof parent === 'object' && parent !== null && 'trigger' in parent
    ? parent.trigger
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
      description: 'Zero-based step index that triggers the form.',
      hidden: ({parent}) => parentTrigger(parent) !== 'afterStep',
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'fields',
      title: 'Fields',
      type: 'array',
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
