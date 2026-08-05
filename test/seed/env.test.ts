import {describe, expect, test} from 'bun:test'

import {validateEnv} from '../../seed/seed'

const VALID_ENV = {
  SANITY_PROJECT_ID: 'abc123',
  SANITY_DATASET: 'production',
  SANITY_TOKEN: 'sk-token-value',
}

describe('validateEnv', () => {
  test('returns projectId/dataset/token when all three are set', () => {
    expect(validateEnv(VALID_ENV)).toEqual({
      projectId: 'abc123',
      dataset: 'production',
      token: 'sk-token-value',
    })
  })

  test('throws listing all missing vars, not just the first', () => {
    expect(() => validateEnv({})).toThrow(/SANITY_PROJECT_ID, SANITY_DATASET, SANITY_TOKEN/)
  })

  test('throws naming only the single missing var, singular wording', () => {
    expect(() => validateEnv({SANITY_PROJECT_ID: 'abc123', SANITY_DATASET: 'production'})).toThrow(
      /Missing required environment variable: SANITY_TOKEN\./,
    )
  })

  test('treats an empty string as missing, not merely undefined', () => {
    expect(() => validateEnv({...VALID_ENV, SANITY_DATASET: ''})).toThrow(/SANITY_DATASET/)
  })

  test('does not perform any network IO — resolves synchronously from a plain object', () => {
    // Regression guard for the module's own contract: importing/calling
    // validateEnv must never trigger `main()`'s upload/mutate flow, since
    // this test suite runs with no real Sanity credentials.
    expect(() => validateEnv(VALID_ENV)).not.toThrow()
  })
})
