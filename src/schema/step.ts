import type {PreviewConfig} from 'sanity'
import {defineField, defineType} from 'sanity'

import {VIDEO_DEFAULTS} from '../queries/defaults'

const preview: PreviewConfig = {
  select: {title: 'title'},
  prepare(selection) {
    const title = typeof selection.title === 'string' ? selection.title : undefined
    return {title: title || 'Step'}
  },
}

/** Reads `parent.advance` off a validation/conditional-property context's `parent`, without an unsafe cast. */
function parentAdvance(parent: unknown): unknown {
  return typeof parent === 'object' && parent !== null && 'advance' in parent
    ? parent.advance
    : undefined
}

/** Reads `parent.source` off a validation/conditional-property context's `parent`, within the `video` object's own fields. */
function parentSource(parent: unknown): unknown {
  return typeof parent === 'object' && parent !== null && 'source' in parent
    ? parent.source
    : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Whether a `file` field's value carries a resolvable asset reference. */
function hasFileAsset(value: unknown): boolean {
  return isRecord(value) && isRecord(value.asset)
}

export default defineType({
  name: 'guidedTourStep',
  title: 'Step',
  type: 'object',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Optional heading shown to viewers.',
      validation: (rule) => rule.max(100),
    }),
    defineField({
      name: 'screenshot',
      title: 'Screenshot',
      type: 'image',
      description:
        'The screenshot elements are positioned over. Always required, even on a step with a video below — it doubles as the video poster, the reduced-motion fallback, and the canvas editor backdrop.',
      options: {hotspot: true},
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
          validation: (rule) => rule.required(),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'screenshotMobile',
      title: 'Mobile screenshot',
      type: 'image',
      description: 'Optional narrow-viewport screenshot; falls back to the main screenshot.',
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
        }),
      ],
    }),
    defineField({
      name: 'video',
      title: 'Video',
      type: 'object',
      description:
        'Optional short video shown instead of the screenshot in the web viewer when present. The screenshot above is still required — it remains the poster image, the reduced-motion/native fallback, and the canvas editor backdrop.',
      fields: [
        defineField({
          name: 'source',
          title: 'Source',
          type: 'string',
          description: 'Where the video comes from.',
          options: {
            list: [
              {title: 'Uploaded file', value: 'file'},
              {title: 'Direct URL', value: 'url'},
            ],
          },
          initialValue: VIDEO_DEFAULTS.source,
        }),
        defineField({
          name: 'file',
          title: 'Video file',
          type: 'file',
          description: 'An mp4 or webm file, played muted and looped in the web viewer.',
          options: {accept: 'video/mp4,video/webm'},
          hidden: ({parent}) => parentSource(parent) !== 'file',
        }),
        defineField({
          name: 'url',
          title: 'Video URL',
          type: 'url',
          description:
            'Direct link to an mp4 or webm file (https only). Embed providers such as YouTube or Vimeo are not supported.',
          hidden: ({parent}) => parentSource(parent) !== 'url',
          validation: (rule) => rule.uri({scheme: ['https']}),
        }),
      ],
      validation: (rule) =>
        rule.custom((value) => {
          if (!isRecord(value)) return true
          const source = value.source === 'url' ? 'url' : VIDEO_DEFAULTS.source
          if (source === 'url') {
            return value.url ? true : 'A video URL is required when the source is "Direct URL".'
          }
          return hasFileAsset(value.file)
            ? true
            : 'A video file is required when the source is "Uploaded file".'
        }),
    }),
    defineField({
      name: 'elements',
      title: 'Elements',
      type: 'array',
      description: 'Hotspots, tooltips, and text overlays positioned on the screenshot.',
      of: [
        {type: 'guidedTourHotspot'},
        {type: 'guidedTourTooltip'},
        {type: 'guidedTourTextOverlay'},
      ],
    }),
    defineField({
      name: 'advance',
      title: 'Advance',
      type: 'string',
      description: 'How a viewer leaves this step.',
      options: {
        list: [
          {title: 'Hotspot', value: 'hotspot'},
          {title: 'Button', value: 'button'},
          {title: 'Auto', value: 'auto'},
        ],
      },
      initialValue: 'hotspot',
    }),
    defineField({
      name: 'duration',
      title: 'Duration',
      type: 'number',
      description:
        'Seconds before the step advances automatically. Only used when Advance is Auto.',
      hidden: ({parent}) => parentAdvance(parent) !== 'auto',
      validation: (rule) =>
        rule
          .min(3)
          .max(300)
          .custom((value, context) => {
            const advance = parentAdvance(context.parent)
            if (advance === 'auto' && (value === undefined || value === null)) {
              return 'Required when advance is "auto"'
            }
            return true
          }),
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
      description: 'Internal notes for authors; never shown to viewers.',
    }),
  ],
  preview,
})
