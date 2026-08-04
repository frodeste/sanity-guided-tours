import {defineArrayMember, defineField, defineType} from 'sanity'

// Deliberately minimal: a single paragraph style, no lists, and only the
// decorators/annotations a screenshot-overlay tooltip or text box needs.
// Richer formatting (headings, lists, images) is out of scope — see the
// design spec's rejected-alternatives section.
export default defineType({
  name: 'guidedTourRichText',
  title: 'Rich text',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [{title: 'Normal', value: 'normal'}],
      lists: [],
      marks: {
        decorators: [
          {title: 'Strong', value: 'strong'},
          {title: 'Emphasis', value: 'em'},
        ],
        annotations: [
          {
            name: 'link',
            type: 'object',
            title: 'Link',
            fields: [
              defineField({
                name: 'href',
                title: 'URL',
                type: 'url',
                description: 'Destination URL.',
                validation: (rule) =>
                  rule.required().uri({scheme: ['http', 'https', 'mailto', 'tel']}),
              }),
            ],
          },
        ],
      },
    }),
  ],
})
