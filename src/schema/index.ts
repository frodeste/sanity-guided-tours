import type {SchemaTypeDefinition} from 'sanity'

import type {ResolvedGuidedToursConfig} from '../config'
import chapter from './chapter'
import hotspot from './elements/hotspot'
import textOverlay from './elements/textOverlay'
import tooltip from './elements/tooltip'
import embed from './embed'
import {guidedTourDocument} from './guidedTour'
import leadCapture from './leadCapture'
import outro from './outro'
import richText from './richText'
import settings from './settings'
import step from './step'
import theme from './theme'
import token from './token'

export type {ResolvedGuidedToursConfig}

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
    embed,
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
