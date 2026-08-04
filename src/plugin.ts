import {definePlugin} from 'sanity'

import {resolveConfig, type GuidedToursConfig} from './config'
import {schemaTypes} from './schema'

/** Registers the guided-tours schema types in Sanity Studio. @public */
export const guidedTours = definePlugin<GuidedToursConfig | void>((config) => {
  const resolved = resolveConfig(config ?? {})
  return {
    name: 'sanity-plugin-guided-tours',
    schema: {types: schemaTypes(resolved)},
  }
})
