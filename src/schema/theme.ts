import type {PreviewConfig} from 'sanity'
import {defineField, defineType} from 'sanity'

import {FRAME_DEFAULTS, GOOGLE_FONT_NAME_PATTERN, THEME_DEFAULTS} from '../queries/defaults'
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

/** Same validator as `colorField`, but without an initial value — used for the optional `dark` overrides and the M10 element-style fields (`elements.button`/`elements.bubble`), neither of which has a schema default; both fall back at consumption time instead (M10 plan, Tasks 2–3). */
function darkColorField(name: string, title: string) {
  return defineField({
    name,
    title,
    type: 'string',
    description: 'Hex color or a CSS variable from your site, e.g. var(--brand-primary).',
    validation: (rule) => cssColorValue(rule),
  })
}

/** Reads `parent.style` off a validation/conditional-property context's `parent` within the `frame` object, without an unsafe cast. */
function parentFrameStyle(parent: unknown): unknown {
  return typeof parent === 'object' && parent !== null && 'style' in parent
    ? parent.style
    : undefined
}

/**
 * The border-only fields of `frame` — `borderWidth`, `borderColor`,
 * `borderRadius` and the four per-corner radius overrides — only have an
 * effect when `frame.style` is `"simple"` (the other styles draw their own
 * chrome, or none). Hidden rather than removed when another style is
 * selected, matching the `step.duration`/`leadCapture` field's
 * `hidden: ({parent}) => ...` convention elsewhere in this codebase rather
 * than introducing a new UX pattern for a single field group.
 */
function hiddenUnlessSimpleFrame({parent}: {parent: unknown}): boolean {
  return parentFrameStyle(parent) !== 'simple'
}

/** One frame per-corner radius override — independently optional, no `initialValue` (mirrors `borderRadius` for that one corner only when set). */
function frameCornerRadiusField(name: string, title: string) {
  return defineField({
    name,
    title,
    type: 'number',
    description: 'Overrides "Border radius" for this corner only. Leave empty to use it as-is.',
    hidden: hiddenUnlessSimpleFrame,
    validation: (rule) => rule.min(0).max(48),
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
        darkColorField('frameBorder', 'Frame border color'),
        darkColorField('buttonBackground', 'Button background'),
        darkColorField('buttonText', 'Button text color'),
        darkColorField('bubbleBackground', 'Tooltip bubble background'),
        darkColorField('bubbleText', 'Tooltip bubble text color'),
      ],
    }),
    defineField({
      name: 'frame',
      title: 'Frame',
      type: 'object',
      description:
        'Window chrome rendered around the tour stage in the web viewer. Native apps ignore this (see the plugin docs).',
      options: {collapsible: true, collapsed: false},
      fields: [
        defineField({
          name: 'style',
          title: 'Style',
          type: 'string',
          description: 'The window chrome drawn around the tour stage.',
          options: {
            list: [
              {title: 'Mac', value: 'mac'},
              {title: 'Windows', value: 'windows'},
              {title: 'Simple border', value: 'simple'},
              {title: 'None', value: 'none'},
            ],
          },
          initialValue: FRAME_DEFAULTS.style,
        }),
        defineField({
          name: 'borderWidth',
          title: 'Border width',
          type: 'number',
          description: 'Border width in pixels.',
          initialValue: FRAME_DEFAULTS.borderWidth,
          hidden: hiddenUnlessSimpleFrame,
          validation: (rule) => rule.min(0).max(12),
        }),
        defineField({
          name: 'borderColor',
          title: 'Border color',
          type: 'string',
          description: 'Hex color or a CSS variable from your site, e.g. var(--brand-primary).',
          initialValue: FRAME_DEFAULTS.borderColor,
          hidden: hiddenUnlessSimpleFrame,
          validation: (rule) => cssColorValue(rule),
        }),
        defineField({
          name: 'borderRadius',
          title: 'Border radius',
          type: 'number',
          description:
            'Corner radius in pixels, applied to all four corners unless overridden below.',
          initialValue: FRAME_DEFAULTS.borderRadius,
          hidden: hiddenUnlessSimpleFrame,
          validation: (rule) => rule.min(0).max(48),
        }),
        frameCornerRadiusField('radiusTopLeft', 'Top-left radius override'),
        frameCornerRadiusField('radiusTopRight', 'Top-right radius override'),
        frameCornerRadiusField('radiusBottomRight', 'Bottom-right radius override'),
        frameCornerRadiusField('radiusBottomLeft', 'Bottom-left radius override'),
      ],
    }),
    defineField({
      name: 'elements',
      title: 'Element design',
      type: 'object',
      description:
        'Per-element styling for buttons and tooltip bubbles. Leave a field empty to use the theme default.',
      options: {collapsible: true, collapsed: true},
      fields: [
        defineField({
          name: 'button',
          title: 'Buttons',
          type: 'object',
          fields: [
            darkColorField('background', 'Background color'),
            darkColorField('textColor', 'Text color'),
            defineField({
              name: 'radius',
              title: 'Corner radius',
              type: 'number',
              description: 'Corner radius in pixels. Leave empty to use the theme default.',
              validation: (rule) => rule.min(0).max(32),
            }),
          ],
        }),
        defineField({
          name: 'bubble',
          title: 'Tooltip bubbles',
          type: 'object',
          fields: [
            darkColorField('background', 'Background color'),
            darkColorField('textColor', 'Text color'),
            defineField({
              name: 'radius',
              title: 'Corner radius',
              type: 'number',
              description: 'Corner radius in pixels. Leave empty to use the theme default.',
              validation: (rule) => rule.min(0).max(32),
            }),
          ],
        }),
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
