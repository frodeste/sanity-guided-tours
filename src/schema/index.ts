import type {FieldDefinition, SchemaTypeDefinition} from 'sanity'

import chapter from './chapter'
import hotspot from './elements/hotspot'
import textOverlay from './elements/textOverlay'
import tooltip from './elements/tooltip'
import {guidedTourDocument} from './guidedTour'
import leadCapture from './leadCapture'
import outro from './outro'
import richText from './richText'
import settings from './settings'
import step from './step'
import theme from './theme'
import token from './token'

/**
 * The resolved (defaults-applied) shape of the plugin's public config, as
 * consumed by `schemaTypes()`. Defined locally because Task 6's `src/config.ts`
 * — which will own `GuidedToursConfig` and `resolveConfig()` — doesn't exist
 * yet; that module's `Required<GuidedToursConfig>` is expected to satisfy this
 * shape once it lands.
 */
export interface ResolvedGuidedToursConfig {
  theme: boolean
  leadCapture: boolean
  extend: {tour: FieldDefinition[]}
}

/** Assembles the full set of schema types for the given resolved config. */
export function schemaTypes(config: ResolvedGuidedToursConfig): SchemaTypeDefinition[] {
  const types: SchemaTypeDefinition[] = [
    richText,
    hotspot,
    tooltip,
    textOverlay,
    token,
    step,
    chapter,
    settings,
    outro,
  ]

  if (config.theme) types.push(theme)
  if (config.leadCapture) types.push(leadCapture)

  types.push(
    guidedTourDocument({
      theme: config.theme,
      leadCapture: config.leadCapture,
      extraFields: config.extend.tour,
    }),
  )

  return types
}
