import type {DocumentDefinition, FieldDefinition, PreviewConfig} from 'sanity'
import {defineField, defineType} from 'sanity'

export interface GuidedTourDocumentOptions {
  /** Register the `theme` reference field. */
  theme: boolean
  /** Register the `leadCapture` field. */
  leadCapture: boolean
  /** Additional consumer-supplied fields appended at the end, e.g. product references. */
  extraFields: FieldDefinition[]
}

/** Reads a chapter's `steps` array length off an `unknown` value, without an unsafe cast. */
function stepCountOf(chapter: unknown): number {
  if (typeof chapter !== 'object' || chapter === null || !('steps' in chapter)) return 0
  return Array.isArray(chapter.steps) ? chapter.steps.length : 0
}

const preview: PreviewConfig = {
  select: {title: 'title', poster: 'poster', chapters: 'chapters'},
  prepare(selection) {
    const title = typeof selection.title === 'string' ? selection.title : undefined
    const chapters = Array.isArray(selection.chapters) ? selection.chapters : []
    const stepCount = chapters.reduce(
      (total: number, chapter: unknown) => total + stepCountOf(chapter),
      0,
    )
    return {
      title: title || 'Untitled tour',
      subtitle: `${chapters.length} chapter${chapters.length === 1 ? '' : 's'}, ${stepCount} step${stepCount === 1 ? '' : 's'}`,
      media: selection.poster,
    }
  },
}

/** Assembles the `guidedTour` document, conditionally including config-gated fields. */
export function guidedTourDocument(opts: GuidedTourDocumentOptions): DocumentDefinition {
  const fields: FieldDefinition[] = [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required().min(3).max(100),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      validation: (rule) => rule.max(500),
    }),
    defineField({
      name: 'poster',
      title: 'Poster',
      type: 'image',
      description: 'Used for cards and social sharing.',
    }),
  ]

  if (opts.theme) {
    fields.push(
      defineField({
        name: 'theme',
        title: 'Theme',
        type: 'reference',
        to: [{type: 'guidedTourTheme'}],
      }),
    )
  }

  fields.push(
    defineField({
      name: 'tokens',
      title: 'Tokens',
      type: 'array',
      of: [{type: 'guidedTourToken'}],
    }),
    defineField({
      name: 'chapters',
      title: 'Chapters',
      type: 'array',
      of: [{type: 'guidedTourChapter'}],
      validation: (rule) => rule.required().min(1),
    }),
  )

  if (opts.leadCapture) {
    fields.push(
      defineField({
        name: 'leadCapture',
        title: 'Lead capture',
        type: 'guidedTourLeadCapture',
      }),
    )
  }

  fields.push(
    defineField({
      name: 'outro',
      title: 'Outro',
      type: 'guidedTourOutro',
    }),
    defineField({
      name: 'settings',
      title: 'Settings',
      type: 'guidedTourSettings',
    }),
    ...opts.extraFields,
  )

  return defineType({
    name: 'guidedTour',
    title: 'Guided tour',
    type: 'document',
    fields,
    preview,
  })
}
