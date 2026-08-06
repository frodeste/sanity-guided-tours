import {defineArrayMember, defineField, defineType} from 'sanity'
import {guidedTourEmbedTypeName} from 'sanity-plugin-guided-tours'

// Example-local document type — NOT part of the plugin's own schema. Named
// `examplePage` (rather than a bare `page`) to signal it belongs to this
// demo app, not something a real consumer installs. Registered in
// `sanity.config.ts` alongside the plugin's own types.
//
// `body` is the exact pattern the root README's "Embedding tours in
// Portable Text" section documents: a Portable Text array whose `of:` list
// mixes the standard `block` type with `guidedTourEmbedTypeName`, so an
// editor can drop a tour anywhere inside an article — see
// `app/pages/[slug]/page.tsx` for the matching read-side projection.
export default defineType({
  name: 'examplePage',
  title: 'Example page',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [{type: 'block'}, defineArrayMember({type: guidedTourEmbedTypeName})],
    }),
  ],
  preview: {
    select: {title: 'title', slug: 'slug.current'},
    prepare({title, slug}) {
      return {title: title || 'Untitled page', subtitle: slug ? `/pages/${slug}` : undefined}
    },
  },
})
