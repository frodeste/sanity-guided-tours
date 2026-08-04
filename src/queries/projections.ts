// GROQ projection fragments, kept as plain strings so this entry point never
// pulls in the `groq` template-tag package or any Studio dependency. See
// test/exports.test.ts for the guard that enforces this.

export const imageProjection = /* groq */ `{
  "url": asset->url,
  "dimensions": asset->metadata.dimensions{width, height, aspectRatio},
  "lqip": asset->metadata.lqip,
  alt
}`

export const elementProjection = /* groq */ `{
  _key, _type, x, y, mobile,
  _type == "guidedTourHotspot" => {label, action, href, pulse},
  _type == "guidedTourTooltip" => {width, content, placement, trigger},
  _type == "guidedTourTextOverlay" => {width, content, background, opacity}
}`

export const tourProjection = /* groq */ `{
  _id, title, "slug": slug.current, description,
  "poster": poster${imageProjection},
  "theme": coalesce(theme->, *[_type == "guidedTourTheme" && isDefault == true][0]){
    accent, surface, text, overlay, radius, hotspotSize, fontFamily,
    "logo": logo${imageProjection}
  },
  tokens[]{_key, key, label, defaultValue, required},
  chapters[]{
    _key, title, description,
    steps[]{
      _key, title, advance, duration,
      "screenshot": screenshot${imageProjection},
      "screenshotMobile": screenshotMobile${imageProjection},
      elements[]${elementProjection}
    }
  },
  leadCapture{enabled, trigger, afterStepIndex, fields[]{_key, name, label, type, required}, consentText, submitLabel},
  outro{heading, body, ctas[]{_key, label, href, style}},
  settings{showProgress, showChapterMenu, showStepDots}
}`
