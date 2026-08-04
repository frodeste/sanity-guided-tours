import type {FieldDefinition} from 'sanity'

/** Public configuration for the `guidedTours()` plugin. @public */
export interface GuidedToursConfig {
  /** Register the guidedTourTheme document and the tour's theme field. Default true. */
  theme?: boolean
  /** Register lead-capture schema and UI. Default true. */
  leadCapture?: boolean
  /** Append your own fields to the tour document (e.g. product references). */
  extend?: {tour?: FieldDefinition[]}
}

/** The resolved (defaults-applied) shape of the plugin's public config. */
export interface ResolvedGuidedToursConfig {
  theme: boolean
  leadCapture: boolean
  extend: {tour: FieldDefinition[]}
}

export function resolveConfig(config: GuidedToursConfig = {}): ResolvedGuidedToursConfig {
  return {
    theme: config.theme ?? true,
    leadCapture: config.leadCapture ?? true,
    extend: {tour: config.extend?.tour ?? []},
  }
}
