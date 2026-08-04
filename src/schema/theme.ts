import type {PreviewConfig} from 'sanity'
import {defineField, defineType} from 'sanity'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function colorField(name: string, title: string, initialValue: string) {
  return defineField({
    name,
    title,
    type: 'string',
    description: `Hex color, e.g. ${initialValue}.`,
    initialValue,
    validation: (rule) => rule.regex(HEX_COLOR).error('must be a 6-digit hex color, e.g. #2276fc'),
  })
}

const preview: PreviewConfig = {
  select: {name: 'name', isDefault: 'isDefault'},
  prepare(selection) {
    const name = typeof selection.name === 'string' ? selection.name : undefined
    return {
      title: name || 'Theme',
      subtitle: selection.isDefault ? 'Default' : undefined,
    }
  },
}

export default defineType({
  name: 'guidedTourTheme',
  title: 'Guided tour theme',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'isDefault',
      title: 'Default theme',
      type: 'boolean',
      description: 'Used when a tour does not reference a theme.',
      initialValue: false,
    }),
    colorField('accent', 'Accent color', '#2276fc'),
    colorField('surface', 'Surface color', '#ffffff'),
    colorField('text', 'Text color', '#1a1a1a'),
    colorField('overlay', 'Overlay color', '#0f172a'),
    defineField({
      name: 'radius',
      title: 'Corner radius',
      type: 'number',
      description: 'Corner radius in pixels.',
      initialValue: 8,
      validation: (rule) => rule.min(0).max(32),
    }),
    defineField({
      name: 'hotspotSize',
      title: 'Hotspot size',
      type: 'number',
      description: 'Hotspot diameter in pixels.',
      initialValue: 24,
      validation: (rule) => rule.min(12).max(64),
    }),
    defineField({
      name: 'fontFamily',
      title: 'Font family',
      type: 'string',
      description: 'CSS font-family value.',
    }),
    defineField({
      name: 'logo',
      title: 'Logo',
      type: 'image',
    }),
  ],
  preview,
})
