import {defineArrayMember, defineField, defineType} from 'sanity'

export default defineType({
  name: 'guidedTourOutro',
  title: 'Outro',
  type: 'object',
  description: 'Shown after the last step.',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'guidedTourRichText',
    }),
    defineField({
      name: 'ctas',
      title: 'Calls to action',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'cta',
          title: 'Call to action',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'href',
              title: 'Link URL',
              type: 'url',
              validation: (rule) =>
                rule.required().uri({scheme: ['http', 'https', 'mailto', 'tel']}),
            }),
            defineField({
              name: 'style',
              title: 'Style',
              type: 'string',
              options: {
                list: [
                  {title: 'Primary', value: 'primary'},
                  {title: 'Secondary', value: 'secondary'},
                ],
              },
              initialValue: 'primary',
            }),
          ],
        }),
      ],
    }),
  ],
})
