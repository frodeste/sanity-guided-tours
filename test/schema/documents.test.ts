import {describe, expect, test} from 'bun:test'

import {GOOGLE_FONT_NAME_PATTERN, THEME_DEFAULTS} from '../../src/queries/defaults'
import chapter from '../../src/schema/chapter'
import {CSS_COLOR_VALUE_PATTERN} from '../../src/schema/cssValue'
import embed from '../../src/schema/embed'
import {guidedTourDocument} from '../../src/schema/guidedTour'
import {schemaTypes} from '../../src/schema/index'
import leadCapture from '../../src/schema/leadCapture'
import outro from '../../src/schema/outro'
import settings from '../../src/schema/settings'
import step from '../../src/schema/step'
import theme from '../../src/schema/theme'
import token from '../../src/schema/token'
import {customValidator, findCall, methodNames, runValidation} from './support/ruleSpy'

interface FieldLike {
  name: string
  type: string
  description?: string
  validation?: unknown
  initialValue?: unknown
  fields?: unknown
  hidden?: unknown
  options?: {
    list?: Array<string | {title?: string; value?: unknown}>
    layout?: string
    hotspot?: boolean
    source?: string
    maxLength?: number
    collapsible?: boolean
    collapsed?: boolean
  }
}

/** Generic `key in value` guard, usable on `unknown` without an unsafe cast. */
function has<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
  return typeof value === 'object' && value !== null && key in value
}

function isFieldLike(value: unknown): value is FieldLike {
  return (
    has(value, 'name') &&
    typeof value.name === 'string' &&
    has(value, 'type') &&
    typeof value.type === 'string'
  )
}

interface TypeLike {
  type: string
}

function isTypeLike(value: unknown): value is TypeLike {
  return has(value, 'type') && typeof value.type === 'string'
}

/** Narrows an array-ish, unknown value (an object's `.fields`/`.of`) down to `FieldLike[]`. */
function fieldList(value: unknown): FieldLike[] {
  return Array.isArray(value) ? value.filter(isFieldLike) : []
}

function fields(type: unknown): FieldLike[] {
  return fieldList(prop(type, 'fields'))
}

function fieldByName(list: FieldLike[], name: string): FieldLike {
  const field = list.find((f) => f.name === name)
  if (!field)
    throw new Error(`field "${name}" not found among [${list.map((f) => f.name).join(', ')}]`)
  return field
}

function isRequired(field: FieldLike): boolean {
  return methodNames(runValidation(field.validation)).includes('required')
}

function listValues(field: FieldLike): unknown[] {
  return (field.options?.list ?? []).map((item) => (typeof item === 'string' ? item : item.value))
}

/** Reads a single property off an `unknown` value via the `has` guard, without an unsafe cast. */
function prop(value: unknown, key: string): unknown {
  return has(value, key) ? value[key] : undefined
}

/** Extracts the `.of` member type names of an array field, without an unsafe cast. */
function ofTypeNames(field: unknown): string[] {
  const of = prop(field, 'of')
  return Array.isArray(of) ? of.filter(isTypeLike).map((m) => m.type) : []
}

/** Extracts the `.to` target type names of a reference field, without an unsafe cast. */
function toTypeNames(field: unknown): string[] {
  const to = prop(field, 'to')
  return Array.isArray(to) ? to.filter(isTypeLike).map((m) => m.type) : []
}

function callHidden(field: FieldLike, context: unknown): boolean {
  const hidden = field.hidden
  if (typeof hidden !== 'function') return false
  return Boolean(Reflect.apply(hidden, undefined, [context]))
}

describe('guidedTourStep', () => {
  test('type name and field set', () => {
    expect(step.name).toBe('guidedTourStep')
    expect(step.type).toBe('object')
    const names = fields(step).map((f) => f.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'title',
        'screenshot',
        'screenshotMobile',
        'elements',
        'advance',
        'duration',
        'notes',
      ]),
    )
  })

  test('title is an optional string, max 100', () => {
    const title = fieldByName(fields(step), 'title')
    expect(title.type).toBe('string')
    expect(isRequired(title)).toBe(false)
    expect(findCall(runValidation(title.validation), 'max')?.args).toEqual([100])
  })

  test('screenshot is a required image with hotspot cropping and a required alt', () => {
    const screenshot = fieldByName(fields(step), 'screenshot')
    expect(screenshot.type).toBe('image')
    expect(isRequired(screenshot)).toBe(true)
    expect(screenshot.options?.hotspot).toBe(true)
    const alt = fieldByName(fieldList(screenshot.fields), 'alt')
    expect(alt.type).toBe('string')
    expect(isRequired(alt)).toBe(true)
  })

  test('screenshotMobile is an optional image with an optional alt', () => {
    const mobile = fieldByName(fields(step), 'screenshotMobile')
    expect(mobile.type).toBe('image')
    expect(isRequired(mobile)).toBe(false)
    const alt = fieldByName(fieldList(mobile.fields), 'alt')
    expect(alt.type).toBe('string')
    expect(isRequired(alt)).toBe(false)
  })

  test('elements is an array of hotspot, tooltip, and text overlay', () => {
    const elements = fieldByName(fields(step), 'elements')
    expect(elements.type).toBe('array')
    expect(ofTypeNames(elements)).toEqual(
      expect.arrayContaining(['guidedTourHotspot', 'guidedTourTooltip', 'guidedTourTextOverlay']),
    )
  })

  test('advance is a list of hotspot/button/auto, initially hotspot', () => {
    const advance = fieldByName(fields(step), 'advance')
    expect(advance.type).toBe('string')
    expect(advance.initialValue).toBe('hotspot')
    expect(listValues(advance)).toEqual(['hotspot', 'button', 'auto'])
  })

  test('duration is a number between 3 and 300', () => {
    const duration = fieldByName(fields(step), 'duration')
    expect(duration.type).toBe('number')
    const spy = runValidation(duration.validation)
    expect(findCall(spy, 'min')?.args).toEqual([3])
    expect(findCall(spy, 'max')?.args).toEqual([300])
  })

  test('duration is hidden unless advance is "auto"', () => {
    const duration = fieldByName(fields(step), 'duration')
    expect(callHidden(duration, {parent: {advance: 'auto'}})).toBe(false)
    expect(callHidden(duration, {parent: {advance: 'hotspot'}})).toBe(true)
    expect(callHidden(duration, {parent: {advance: 'button'}})).toBe(true)
    expect(callHidden(duration, {parent: undefined})).toBe(true)
  })

  test('duration is required only when advance is "auto"', () => {
    const duration = fieldByName(fields(step), 'duration')
    const spy = runValidation(duration.validation)
    const validate = customValidator(spy)

    expect(validate(undefined, {parent: {advance: 'auto'}})).not.toBe(true)
    expect(validate(10, {parent: {advance: 'auto'}})).toBe(true)
    expect(validate(undefined, {parent: {advance: 'hotspot'}})).toBe(true)
    expect(validate(undefined, {parent: {advance: 'button'}})).toBe(true)
  })

  test('notes is a text field', () => {
    const notes = fieldByName(fields(step), 'notes')
    expect(notes.type).toBe('text')
    expect(isRequired(notes)).toBe(false)
  })

  test('prepare is defensive against undefined selections', () => {
    expect(() => step.preview?.prepare?.({})).not.toThrow()
  })
})

describe('guidedTourChapter', () => {
  test('type name and field set', () => {
    expect(chapter.name).toBe('guidedTourChapter')
    expect(chapter.type).toBe('object')
    const names = fields(chapter).map((f) => f.name)
    expect(names).toEqual(expect.arrayContaining(['title', 'description', 'steps']))
  })

  test('title is a required string, max 100', () => {
    const title = fieldByName(fields(chapter), 'title')
    expect(title.type).toBe('string')
    expect(isRequired(title)).toBe(true)
    expect(findCall(runValidation(title.validation), 'max')?.args).toEqual([100])
  })

  test('description is an optional text, max 300', () => {
    const description = fieldByName(fields(chapter), 'description')
    expect(description.type).toBe('text')
    expect(isRequired(description)).toBe(false)
    expect(findCall(runValidation(description.validation), 'max')?.args).toEqual([300])
  })

  test('steps is a required array of guidedTourStep, min 1', () => {
    const steps = fieldByName(fields(chapter), 'steps')
    expect(steps.type).toBe('array')
    expect(isRequired(steps)).toBe(true)
    expect(findCall(runValidation(steps.validation), 'min')?.args).toEqual([1])
    expect(ofTypeNames(steps)).toEqual(expect.arrayContaining(['guidedTourStep']))
  })

  test('prepare is defensive against undefined selections', () => {
    expect(() => chapter.preview?.prepare?.({})).not.toThrow()
  })
})

describe('guidedTourToken', () => {
  test('type name and field set', () => {
    expect(token.name).toBe('guidedTourToken')
    expect(token.type).toBe('object')
    const names = fields(token).map((f) => f.name)
    expect(names).toEqual(expect.arrayContaining(['key', 'label', 'defaultValue', 'required']))
  })

  test('key is a required string restricted to lowercase letters and underscores', () => {
    const key = fieldByName(fields(token), 'key')
    expect(key.type).toBe('string')
    expect(isRequired(key)).toBe(true)
    const spy = runValidation(key.validation)
    expect(findCall(spy, 'regex')?.args[0]).toEqual(/^[a-z_]+$/)
    expect(findCall(spy, 'error')?.args).toEqual(['lowercase letters and underscores only'])
  })

  test('label is a required string', () => {
    const label = fieldByName(fields(token), 'label')
    expect(label.type).toBe('string')
    expect(isRequired(label)).toBe(true)
  })

  test('defaultValue is an optional string', () => {
    const defaultValue = fieldByName(fields(token), 'defaultValue')
    expect(defaultValue.type).toBe('string')
    expect(isRequired(defaultValue)).toBe(false)
  })

  test('required is a boolean, initially false', () => {
    const required = fieldByName(fields(token), 'required')
    expect(required.type).toBe('boolean')
    expect(required.initialValue).toBe(false)
  })

  test('preview shows label and {{key}}', () => {
    const result = token.preview?.prepare?.({label: 'Product name', key: 'product_name'})
    expect(result?.title).toBe('Product name')
    expect(result?.subtitle).toBe('{{product_name}}')
  })

  test('prepare is defensive against undefined selections', () => {
    expect(() => token.preview?.prepare?.({})).not.toThrow()
  })
})

describe('guidedTourTheme', () => {
  test('type name and field set', () => {
    expect(theme.name).toBe('guidedTourTheme')
    expect(theme.type).toBe('document')
    const names = fields(theme).map((f) => f.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'name',
        'isDefault',
        'brand',
        'accent',
        'surface',
        'text',
        'overlay',
        'dark',
        'radius',
        'hotspotSize',
        'fontFamily',
        'googleFont',
        'logo',
      ]),
    )
  })

  test('name is a required string', () => {
    const name = fieldByName(fields(theme), 'name')
    expect(name.type).toBe('string')
    expect(isRequired(name)).toBe(true)
  })

  test('isDefault is a boolean, initially false', () => {
    const isDefault = fieldByName(fields(theme), 'isDefault')
    expect(isDefault.type).toBe('boolean')
    expect(isDefault.initialValue).toBe(false)
  })

  test('brand is an optional string', () => {
    const brand = fieldByName(fields(theme), 'brand')
    expect(brand.type).toBe('string')
    expect(isRequired(brand)).toBe(false)
  })

  test('colors accept hex or CSS variables, with the expected initial values', () => {
    const expected: Record<string, string> = {
      accent: THEME_DEFAULTS.accent,
      surface: THEME_DEFAULTS.surface,
      text: THEME_DEFAULTS.text,
      overlay: THEME_DEFAULTS.overlay,
    }
    for (const [name, initial] of Object.entries(expected)) {
      const field = fieldByName(fields(theme), name)
      expect(field.type).toBe('string')
      expect(field.initialValue).toBe(initial)
      const spy = runValidation(field.validation)
      expect(findCall(spy, 'regex')?.args[0]).toEqual(CSS_COLOR_VALUE_PATTERN)
      expect(findCall(spy, 'error')?.args[0]).toMatch(/hex color/i)
    }
  })

  test('dark is an optional, collapsible object of independently optional color overrides', () => {
    const dark = fieldByName(fields(theme), 'dark')
    expect(dark.type).toBe('object')
    expect(isRequired(dark)).toBe(false)
    expect(dark.options?.collapsible).toBe(true)
    expect(dark.options?.collapsed).toBe(true)

    const darkFields = fields(dark)
    for (const name of ['accent', 'surface', 'text', 'overlay']) {
      const field = fieldByName(darkFields, name)
      expect(field.type).toBe('string')
      expect(field.initialValue).toBeUndefined()
      expect(isRequired(field)).toBe(false)
      const spy = runValidation(field.validation)
      expect(findCall(spy, 'regex')?.args[0]).toEqual(CSS_COLOR_VALUE_PATTERN)
    }
  })

  test('radius is a number, initially THEME_DEFAULTS.radius, between 0 and 32', () => {
    const radius = fieldByName(fields(theme), 'radius')
    expect(radius.type).toBe('number')
    expect(radius.initialValue).toBe(THEME_DEFAULTS.radius)
    const spy = runValidation(radius.validation)
    expect(findCall(spy, 'min')?.args).toEqual([0])
    expect(findCall(spy, 'max')?.args).toEqual([32])
  })

  test('hotspotSize is a number, initially THEME_DEFAULTS.hotspotSize, between 12 and 64', () => {
    const hotspotSize = fieldByName(fields(theme), 'hotspotSize')
    expect(hotspotSize.type).toBe('number')
    expect(hotspotSize.initialValue).toBe(THEME_DEFAULTS.hotspotSize)
    const spy = runValidation(hotspotSize.validation)
    expect(findCall(spy, 'min')?.args).toEqual([12])
    expect(findCall(spy, 'max')?.args).toEqual([64])
  })

  test('fontFamily is an optional string documenting precedence over googleFont', () => {
    const fontFamily = fieldByName(fields(theme), 'fontFamily')
    expect(fontFamily.type).toBe('string')
    expect(isRequired(fontFamily)).toBe(false)
    expect(fontFamily.description).toMatch(/precedence/i)
  })

  test('googleFont is an optional string limited to 40 chars matching the shared name pattern', () => {
    const googleFont = fieldByName(fields(theme), 'googleFont')
    expect(googleFont.type).toBe('string')
    expect(isRequired(googleFont)).toBe(false)
    const spy = runValidation(googleFont.validation)
    expect(findCall(spy, 'max')?.args).toEqual([40])
    expect(findCall(spy, 'regex')?.args[0]).toEqual(GOOGLE_FONT_NAME_PATTERN)
  })

  test('logo is an optional image', () => {
    const logo = fieldByName(fields(theme), 'logo')
    expect(logo.type).toBe('image')
    expect(isRequired(logo)).toBe(false)
  })

  test('back-compat: none of the new fields are required', () => {
    for (const name of ['brand', 'dark', 'googleFont']) {
      expect(isRequired(fieldByName(fields(theme), name))).toBe(false)
    }
  })

  test('orders by brand, then name', () => {
    expect(theme.orderings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'brandAsc',
          by: [
            {field: 'brand', direction: 'asc'},
            {field: 'name', direction: 'asc'},
          ],
        }),
      ]),
    )
  })

  test('prepare is defensive against undefined selections', () => {
    expect(() => theme.preview?.prepare?.({})).not.toThrow()
  })

  test('prepare surfaces default status and brand in the subtitle', () => {
    const prepare = theme.preview?.prepare
    expect(prepare?.({name: 'Acme theme', isDefault: true, brand: 'Acme'})).toEqual(
      expect.objectContaining({title: 'Acme theme', subtitle: 'Default · Acme'}),
    )
    expect(prepare?.({name: 'Acme theme', brand: 'Acme'})).toEqual(
      expect.objectContaining({subtitle: 'Acme'}),
    )
    expect(prepare?.({name: 'Acme theme', isDefault: true})).toEqual(
      expect.objectContaining({subtitle: 'Default'}),
    )
    expect(prepare?.({name: 'Acme theme'})).toEqual(expect.objectContaining({subtitle: undefined}))
  })
})

describe('guidedTourLeadCapture', () => {
  test('type name and field set', () => {
    expect(leadCapture.name).toBe('guidedTourLeadCapture')
    expect(leadCapture.type).toBe('object')
    const names = fields(leadCapture).map((f) => f.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'enabled',
        'trigger',
        'afterStepIndex',
        'fields',
        'consentText',
        'submitLabel',
      ]),
    )
  })

  test('enabled is a boolean, initially false', () => {
    const enabled = fieldByName(fields(leadCapture), 'enabled')
    expect(enabled.type).toBe('boolean')
    expect(enabled.initialValue).toBe(false)
  })

  test('trigger is a list of afterStep/atEnd, initially atEnd', () => {
    const trigger = fieldByName(fields(leadCapture), 'trigger')
    expect(trigger.type).toBe('string')
    expect(trigger.initialValue).toBe('atEnd')
    expect(listValues(trigger)).toEqual(['afterStep', 'atEnd'])
  })

  test('afterStepIndex is a number with min 0, hidden unless trigger is "afterStep"', () => {
    const afterStepIndex = fieldByName(fields(leadCapture), 'afterStepIndex')
    expect(afterStepIndex.type).toBe('number')
    expect(findCall(runValidation(afterStepIndex.validation), 'min')?.args).toEqual([0])
    expect(callHidden(afterStepIndex, {parent: {trigger: 'afterStep'}})).toBe(false)
    expect(callHidden(afterStepIndex, {parent: {trigger: 'atEnd'}})).toBe(true)
    expect(callHidden(afterStepIndex, {parent: undefined})).toBe(true)
  })

  test('fields is an array of inline objects shaped {name, label, type, required}', () => {
    const fieldsField = fieldByName(fields(leadCapture), 'fields')
    expect(fieldsField.type).toBe('array')
    const of = prop(fieldsField, 'of')
    const members = Array.isArray(of) ? of.filter(isFieldLike) : []
    expect(members).toHaveLength(1)
    const member = members[0]
    expect(member.type).toBe('object')

    const subFields = fieldList(member.fields)
    const name = fieldByName(subFields, 'name')
    expect(name.type).toBe('string')
    expect(isRequired(name)).toBe(true)
    expect(findCall(runValidation(name.validation), 'regex')?.args[0]).toEqual(
      /^[a-zA-Z][a-zA-Z0-9_]*$/,
    )

    const label = fieldByName(subFields, 'label')
    expect(label.type).toBe('string')
    expect(isRequired(label)).toBe(true)

    const type = fieldByName(subFields, 'type')
    expect(type.type).toBe('string')
    expect(type.initialValue).toBe('text')
    expect(listValues(type)).toEqual(['text', 'email', 'tel', 'textarea'])

    const required = fieldByName(subFields, 'required')
    expect(required.type).toBe('boolean')
    expect(required.initialValue).toBe(false)
  })

  // CI review fix (PR 102, thread cid 3718584942): nothing previously
  // stopped an author from giving two fields the same `name` — the viewer
  // submits values keyed by `name`, so a duplicate silently collapses to
  // one value with no error anywhere. Fixed at the schema level (not a
  // `LeadForm.tsx` runtime change — an invalid-by-validation authoring
  // error is the same posture the rest of this schema already takes, e.g.
  // `guidedTourToken.key`'s own no-collision expectation is never enforced
  // by the viewer either).
  test('fields validation rejects duplicate names and accepts unique ones', () => {
    const fieldsField = fieldByName(fields(leadCapture), 'fields')
    const validate = customValidator(runValidation(fieldsField.validation))

    expect(validate(undefined)).toBe(true)
    expect(validate([])).toBe(true)
    expect(validate([{name: 'email'}, {name: 'phone'}])).toBe(true)

    const duplicateResult = validate([{name: 'email'}, {name: 'phone'}, {name: 'email'}])
    expect(typeof duplicateResult).toBe('string')
    expect(String(duplicateResult)).toContain('email')
    expect(String(duplicateResult).toLowerCase()).toContain('unique')
  })

  test('consentText is a text field and submitLabel is a string', () => {
    const consentText = fieldByName(fields(leadCapture), 'consentText')
    expect(consentText.type).toBe('text')
    const submitLabel = fieldByName(fields(leadCapture), 'submitLabel')
    expect(submitLabel.type).toBe('string')
  })
})

describe('guidedTourOutro', () => {
  test('type name and field set', () => {
    expect(outro.name).toBe('guidedTourOutro')
    expect(outro.type).toBe('object')
    const names = fields(outro).map((f) => f.name)
    expect(names).toEqual(expect.arrayContaining(['heading', 'body', 'ctas']))
  })

  test('heading is a string and body is rich text', () => {
    const heading = fieldByName(fields(outro), 'heading')
    expect(heading.type).toBe('string')
    const body = fieldByName(fields(outro), 'body')
    expect(body.type).toBe('guidedTourRichText')
  })

  test('ctas is an array of inline objects shaped {label, href, style}', () => {
    const ctas = fieldByName(fields(outro), 'ctas')
    expect(ctas.type).toBe('array')
    const of = prop(ctas, 'of')
    const members = Array.isArray(of) ? of.filter(isFieldLike) : []
    expect(members).toHaveLength(1)
    const member = members[0]
    expect(member.type).toBe('object')

    const subFields = fieldList(member.fields)
    const label = fieldByName(subFields, 'label')
    expect(label.type).toBe('string')
    expect(isRequired(label)).toBe(true)

    const href = fieldByName(subFields, 'href')
    expect(href.type).toBe('url')
    expect(isRequired(href)).toBe(true)
    expect(findCall(runValidation(href.validation), 'uri')?.args).toEqual([
      {scheme: ['http', 'https', 'mailto', 'tel']},
    ])

    const style = fieldByName(subFields, 'style')
    expect(style.type).toBe('string')
    expect(style.initialValue).toBe('primary')
    expect(listValues(style)).toEqual(['primary', 'secondary'])
  })
})

describe('guidedTourSettings', () => {
  test('type name and field set', () => {
    expect(settings.name).toBe('guidedTourSettings')
    expect(settings.type).toBe('object')
    const names = fields(settings).map((f) => f.name)
    expect(names).toEqual(
      expect.arrayContaining(['showProgress', 'showChapterMenu', 'showStepDots']),
    )
  })

  test('all three toggles are booleans, initially true', () => {
    for (const name of ['showProgress', 'showChapterMenu', 'showStepDots']) {
      const field = fieldByName(fields(settings), name)
      expect(field.type).toBe('boolean')
      expect(field.initialValue).toBe(true)
    }
  })
})

describe('guidedTourEmbed', () => {
  test('type name and field set', () => {
    expect(embed.name).toBe('guidedTourEmbed')
    expect(embed.type).toBe('object')
    const names = fields(embed).map((f) => f.name)
    expect(names).toEqual(expect.arrayContaining(['tour', 'displayMode', 'buttonLabel']))
  })

  test('tour is a required reference to guidedTour', () => {
    const tour = fieldByName(fields(embed), 'tour')
    expect(tour.type).toBe('reference')
    expect(isRequired(tour)).toBe(true)
    expect(toTypeNames(tour)).toEqual(expect.arrayContaining(['guidedTour']))
  })

  test('displayMode is a radio list of inline/modal, initially inline', () => {
    const displayMode = fieldByName(fields(embed), 'displayMode')
    expect(displayMode.type).toBe('string')
    expect(displayMode.initialValue).toBe('inline')
    expect(displayMode.options?.layout).toBe('radio')
    expect(listValues(displayMode)).toEqual(['inline', 'modal'])
  })

  test('buttonLabel is a string, max 60', () => {
    const buttonLabel = fieldByName(fields(embed), 'buttonLabel')
    expect(buttonLabel.type).toBe('string')
    expect(findCall(runValidation(buttonLabel.validation), 'max')?.args).toEqual([60])
  })

  test('buttonLabel is hidden unless displayMode is "modal"', () => {
    const buttonLabel = fieldByName(fields(embed), 'buttonLabel')
    expect(callHidden(buttonLabel, {parent: {displayMode: 'modal'}})).toBe(false)
    expect(callHidden(buttonLabel, {parent: {displayMode: 'inline'}})).toBe(true)
    expect(callHidden(buttonLabel, {parent: undefined})).toBe(true)
  })

  test('preview selects tour.title and a displayMode subtitle', () => {
    const inline = embed.preview?.prepare?.({title: 'Onboarding', displayMode: 'inline'})
    expect(inline?.title).toBe('Onboarding')
    expect(inline?.subtitle).toBe('Inline')

    const modal = embed.preview?.prepare?.({title: 'Onboarding', displayMode: 'modal'})
    expect(modal?.subtitle).toBe('Button + modal')
  })

  test('prepare is defensive against undefined selections', () => {
    expect(() => embed.preview?.prepare?.({})).not.toThrow()
    expect(embed.preview?.prepare?.({})?.title).toBe('Guided tour embed')
  })
})

describe('guidedTourDocument factory', () => {
  test('type name and base field set', () => {
    const tour = guidedTourDocument({theme: true, leadCapture: true, extraFields: []})
    expect(tour.name).toBe('guidedTour')
    expect(tour.type).toBe('document')
    const names = fields(tour).map((f) => f.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'title',
        'slug',
        'description',
        'poster',
        'theme',
        'tokens',
        'chapters',
        'leadCapture',
        'outro',
        'settings',
      ]),
    )
  })

  test('title is a required string, min 3 max 100', () => {
    const tour = guidedTourDocument({theme: true, leadCapture: true, extraFields: []})
    const title = fieldByName(fields(tour), 'title')
    expect(title.type).toBe('string')
    expect(isRequired(title)).toBe(true)
    const spy = runValidation(title.validation)
    expect(findCall(spy, 'min')?.args).toEqual([3])
    expect(findCall(spy, 'max')?.args).toEqual([100])
  })

  test('slug is required, sourced from title, max length 96', () => {
    const tour = guidedTourDocument({theme: true, leadCapture: true, extraFields: []})
    const slug = fieldByName(fields(tour), 'slug')
    expect(slug.type).toBe('slug')
    expect(isRequired(slug)).toBe(true)
    expect(slug.options?.source).toBe('title')
    expect(slug.options?.maxLength).toBe(96)
  })

  test('description is text, max 500', () => {
    const tour = guidedTourDocument({theme: true, leadCapture: true, extraFields: []})
    const description = fieldByName(fields(tour), 'description')
    expect(description.type).toBe('text')
    expect(findCall(runValidation(description.validation), 'max')?.args).toEqual([500])
  })

  test('poster is an optional image', () => {
    const tour = guidedTourDocument({theme: true, leadCapture: true, extraFields: []})
    const poster = fieldByName(fields(tour), 'poster')
    expect(poster.type).toBe('image')
    expect(isRequired(poster)).toBe(false)
  })

  test('tokens is an array of guidedTourToken', () => {
    const tour = guidedTourDocument({theme: true, leadCapture: true, extraFields: []})
    const tokens = fieldByName(fields(tour), 'tokens')
    expect(tokens.type).toBe('array')
    expect(ofTypeNames(tokens)).toEqual(expect.arrayContaining(['guidedTourToken']))
  })

  test('chapters is a required array of guidedTourChapter, min 1', () => {
    const tour = guidedTourDocument({theme: true, leadCapture: true, extraFields: []})
    const chapters = fieldByName(fields(tour), 'chapters')
    expect(chapters.type).toBe('array')
    expect(isRequired(chapters)).toBe(true)
    expect(findCall(runValidation(chapters.validation), 'min')?.args).toEqual([1])
    expect(ofTypeNames(chapters)).toEqual(expect.arrayContaining(['guidedTourChapter']))
  })

  test('theme is a reference to guidedTourTheme when enabled', () => {
    const tour = guidedTourDocument({theme: true, leadCapture: true, extraFields: []})
    const themeField = fieldByName(fields(tour), 'theme')
    expect(themeField.type).toBe('reference')
  })

  test('theme field is omitted when theme is disabled', () => {
    const tour = guidedTourDocument({theme: false, leadCapture: true, extraFields: []})
    const names = fields(tour).map((f) => f.name)
    expect(names).not.toContain('theme')
  })

  test('leadCapture field is guidedTourLeadCapture when enabled', () => {
    const tour = guidedTourDocument({theme: true, leadCapture: true, extraFields: []})
    const leadCaptureField = fieldByName(fields(tour), 'leadCapture')
    expect(leadCaptureField.type).toBe('guidedTourLeadCapture')
  })

  test('leadCapture field is omitted when leadCapture is disabled', () => {
    const tour = guidedTourDocument({theme: true, leadCapture: false, extraFields: []})
    const names = fields(tour).map((f) => f.name)
    expect(names).not.toContain('leadCapture')
  })

  test('outro and settings are always present', () => {
    const tour = guidedTourDocument({theme: false, leadCapture: false, extraFields: []})
    const outroField = fieldByName(fields(tour), 'outro')
    expect(outroField.type).toBe('guidedTourOutro')
    const settingsField = fieldByName(fields(tour), 'settings')
    expect(settingsField.type).toBe('guidedTourSettings')
  })

  test('extraFields are appended to the tour document', () => {
    const extra = {
      name: 'productRef',
      title: 'Product',
      type: 'reference',
      to: [{type: 'product'}],
    }
    const tour = guidedTourDocument({theme: true, leadCapture: true, extraFields: [extra]})
    const names = fields(tour).map((f) => f.name)
    expect(names).toContain('productRef')
  })

  test('prepare is defensive against undefined selections', () => {
    const tour = guidedTourDocument({theme: true, leadCapture: true, extraFields: []})
    expect(() => tour.preview?.prepare?.({})).not.toThrow()
  })
})

describe('schemaTypes', () => {
  const allNames = [
    'guidedTourRichText',
    'guidedTourHotspot',
    'guidedTourTooltip',
    'guidedTourTextOverlay',
    'guidedTourToken',
    'guidedTourStep',
    'guidedTourChapter',
    'guidedTourSettings',
    'guidedTourOutro',
    'guidedTourTheme',
    'guidedTourLeadCapture',
    'guidedTourEmbed',
    'guidedTour',
  ]

  test('defaults register every type', () => {
    const types = schemaTypes({theme: true, leadCapture: true, extend: {tour: []}})
    const names = types.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(allNames))
  })

  test('guidedTourEmbed is registered for every theme/leadCapture permutation', () => {
    for (const theme of [true, false]) {
      for (const leadCapture of [true, false]) {
        const types = schemaTypes({theme, leadCapture, extend: {tour: []}})
        const names = types.map((t) => t.name)
        expect(names).toContain('guidedTourEmbed')
      }
    }
  })

  test('theme:false drops guidedTourTheme and the tour has no theme field', () => {
    const types = schemaTypes({theme: false, leadCapture: true, extend: {tour: []}})
    const names = types.map((t) => t.name)
    expect(names).not.toContain('guidedTourTheme')
    const tour = types.find((t) => t.name === 'guidedTour')
    expect(tour).toBeDefined()
    const tourNames = tour ? fields(tour).map((f) => f.name) : []
    expect(tourNames).not.toContain('theme')
  })

  test('leadCapture:false drops guidedTourLeadCapture and the tour has no leadCapture field', () => {
    const types = schemaTypes({theme: true, leadCapture: false, extend: {tour: []}})
    const names = types.map((t) => t.name)
    expect(names).not.toContain('guidedTourLeadCapture')
    const tour = types.find((t) => t.name === 'guidedTour')
    expect(tour).toBeDefined()
    const tourNames = tour ? fields(tour).map((f) => f.name) : []
    expect(tourNames).not.toContain('leadCapture')
  })

  test('extend.tour fields appear on the tour document', () => {
    const extra = {name: 'customField', title: 'Custom', type: 'string'}
    const types = schemaTypes({theme: true, leadCapture: true, extend: {tour: [extra]}})
    const tour = types.find((t) => t.name === 'guidedTour')
    expect(tour).toBeDefined()
    const tourNames = tour ? fields(tour).map((f) => f.name) : []
    expect(tourNames).toContain('customField')
  })
})
