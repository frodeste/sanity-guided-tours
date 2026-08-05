import type {PreviewConfig} from 'sanity'
import {defineField, defineType} from 'sanity'

import {GOOGLE_FONT_NAME_PATTERN, THEME_DEFAULTS} from '../queries/defaults'
import {cssColorValue} from './cssValue'

const GOOGLE_FONT_NAME_ERROR = 'letters, digits and spaces only, up to 40 characters'

function colorField(name: string, title: string, initialValue: string) {
  return defineField({
    name,
    title,
    type: 'string',
    description: 'Hex color or a CSS variable from your site, e.g. var(--brand-primary).',
    initialValue,
    validation: (rule) => cssColorValue(rule),
  })
}

/** Same validator as `colorField`, but without an initial value — used for the optional `dark` overrides. */
function darkColorField(name: string, title: string) {
  return defineField({
    name,
    title,
    type: 'string',
    description: 'Hex color or a CSS variable from your site, e.g. var(--brand-primary).',
    validation: (rule) => cssColorValue(rule),
  })
}

/** Joins the preview subtitle's parts, dropping any that are absent. */
function subtitleOf(isDefault: unknown, brand: unknown): string | undefined {
  const parts = [isDefault ? 'Default' : undefined, typeof brand === 'string' ? brand : undefined]
  const joined = parts.filter((part): part is string => Boolean(part)).join(' · ')
  return joined || undefined
}

const preview: PreviewConfig = {
  select: {name: 'name', isDefault: 'isDefault', brand: 'brand'},
  prepare(selection) {
    const name = typeof selection.name === 'string' ? selection.name : undefined
    return {
      title: name || 'Theme',
      subtitle: subtitleOf(selection.isDefault, selection.brand),
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
    defineField({
      name: 'brand',
      title: 'Brand',
      type: 'string',
      description: 'Organizational label for multi-brand setups. Shown in the theme list.',
    }),
    colorField('accent', 'Accent color', THEME_DEFAULTS.accent),
    colorField('surface', 'Surface color', THEME_DEFAULTS.surface),
    colorField('text', 'Text color', THEME_DEFAULTS.text),
    colorField('overlay', 'Overlay color', THEME_DEFAULTS.overlay),
    defineField({
      name: 'dark',
      title: 'Dark mode overrides',
      type: 'object',
      description:
        'Optional dark-mode overrides; fields left empty fall back to sensible dark defaults.',
      options: {collapsible: true, collapsed: true},
      fields: [
        darkColorField('accent', 'Accent color'),
        darkColorField('surface', 'Surface color'),
        darkColorField('text', 'Text color'),
        darkColorField('overlay', 'Overlay color'),
      ],
    }),
    defineField({
      name: 'radius',
      title: 'Corner radius',
      type: 'number',
      description: 'Corner radius in pixels.',
      initialValue: THEME_DEFAULTS.radius,
      validation: (rule) => rule.min(0).max(32),
    }),
    defineField({
      name: 'hotspotSize',
      title: 'Hotspot size',
      type: 'number',
      description: 'Hotspot diameter in pixels.',
      initialValue: THEME_DEFAULTS.hotspotSize,
      validation: (rule) => rule.min(12).max(64),
    }),
    defineField({
      name: 'fontFamily',
      title: 'Font family',
      type: 'string',
      description:
        'CSS font-family value. Takes precedence over Google Font below when both are set.',
    }),
    defineField({
      name: 'googleFont',
      title: 'Google Font',
      type: 'string',
      description:
        "Google Font family name, e.g. Inter or Manrope — loaded by the viewer unless disabled; leave empty to use the site's font stack. Ignored when Font family above is also set.",
      validation: (rule) =>
        rule.max(40).regex(GOOGLE_FONT_NAME_PATTERN).error(GOOGLE_FONT_NAME_ERROR),
    }),
    defineField({
      name: 'logo',
      title: 'Logo',
      type: 'image',
    }),
  ],
  orderings: [
    {
      name: 'brandAsc',
      title: 'Brand',
      by: [
        {field: 'brand', direction: 'asc'},
        {field: 'name', direction: 'asc'},
      ],
    },
  ],
  preview,
})
