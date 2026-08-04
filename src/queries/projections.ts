// GROQ projection fragments, kept as plain strings so this entry point never
// pulls in the `groq` template-tag package or any Studio dependency. See
// test/exports.test.ts for the guard that enforces this.

export const imageProjection = /* groq */ `{
  "url": asset->url,
  "dimensions": asset->metadata.dimensions{width, height, aspectRatio},
  "lqip": asset->metadata.lqip,
  alt
}`

// Every `coalesce(field, default)` below mirrors a schema field that has an
// `initialValue` but no `validation.required()` — see src/schema/*. An
// `initialValue` only applies to documents created through the Studio UI; it
// is never enforced for documents from the seed NDJSON import, migration
// scripts, or the Content API, so GROQ can legitimately return `null` for
// these paths on a real document. Applying the schema's own initial value as
// the coalesce default here means the result types in ./types can stay
// non-null and still be true guarantees of what the query returns, rather
// than assumptions about how every document was authored. See
// test/queries.groq.test.ts, which evaluates this projection with groq-js
// against documents missing these fields to prove the defaults hold.
export const elementProjection = /* groq */ `{
  _key, _type, x, y, mobile,
  _type == "guidedTourHotspot" => {label, action, href, "pulse": coalesce(pulse, true)},
  _type == "guidedTourTooltip" => {
    "width": coalesce(width, 300),
    content,
    "placement": coalesce(placement, "auto"),
    "trigger": coalesce(trigger, "click")
  },
  _type == "guidedTourTextOverlay" => {
    "width": coalesce(width, 30),
    content,
    "background": coalesce(background, "surface"),
    "opacity": coalesce(opacity, 90)
  }
}`

export const tourProjection = /* groq */ `{
  _id, title, "slug": slug.current, description,
  "poster": poster${imageProjection},
  "theme": coalesce(theme->, *[_type == "guidedTourTheme" && isDefault == true][0]){
    "accent": coalesce(accent, "#2276fc"),
    "surface": coalesce(surface, "#ffffff"),
    "text": coalesce(text, "#1a1a1a"),
    "overlay": coalesce(overlay, "#0f172a"),
    "radius": coalesce(radius, 8),
    "hotspotSize": coalesce(hotspotSize, 24),
    fontFamily,
    "logo": logo${imageProjection}
  },
  tokens[]{_key, key, label, defaultValue, "required": coalesce(required, false)},
  chapters[]{
    _key, title, description,
    steps[]{
      _key, title, "advance": coalesce(advance, "hotspot"), duration,
      "screenshot": screenshot${imageProjection},
      "screenshotMobile": screenshotMobile${imageProjection},
      elements[]${elementProjection}
    }
  },
  leadCapture{
    "enabled": coalesce(enabled, false),
    "trigger": coalesce(trigger, "atEnd"),
    afterStepIndex,
    fields[]{
      _key, name, label,
      "type": coalesce(type, "text"),
      "required": coalesce(required, false)
    },
    consentText,
    submitLabel
  },
  outro{heading, body, ctas[]{_key, label, href, "style": coalesce(style, "primary")}},
  settings{
    "showProgress": coalesce(showProgress, true),
    "showChapterMenu": coalesce(showChapterMenu, true),
    "showStepDots": coalesce(showStepDots, true)
  }
}`
