import {describe, expect, test} from 'bun:test'

import {
  filesInUploadOrder,
  partitionResults,
  stepsFromAssets,
  summarizeUploadOutcome,
  type UploadedAsset,
} from '../../src/studio/bulkUpload'

describe('filesInUploadOrder', () => {
  test('sorts files with natural numeric ordering', () => {
    const files = [{name: 'img10.png'}, {name: 'img2.png'}, {name: 'img1.png'}]
    const sorted = filesInUploadOrder(files)
    expect(sorted).toEqual([{name: 'img1.png'}, {name: 'img2.png'}, {name: 'img10.png'}])
  })

  test('handles mixed case with case-insensitive sorting', () => {
    const files = [{name: 'Screenshot.png'}, {name: 'Capture.png'}, {name: 'image.png'}]
    const sorted = filesInUploadOrder(files)
    // Should sort alphabetically, case-insensitive: Capture, image, Screenshot
    expect(sorted[0].name).toBe('Capture.png')
    expect(sorted[1].name).toBe('image.png')
    expect(sorted[2].name).toBe('Screenshot.png')
  })

  test('sorts non-numeric alphabetically', () => {
    const files = [{name: 'zebra.png'}, {name: 'apple.png'}, {name: 'banana.png'}]
    const sorted = filesInUploadOrder(files)
    expect(sorted).toEqual([{name: 'apple.png'}, {name: 'banana.png'}, {name: 'zebra.png'}])
  })

  test('handles complex mixed filenames with numbers and letters', () => {
    const files = [
      {name: 'step2a.png'},
      {name: 'step10.png'},
      {name: 'step1b.png'},
      {name: 'step2.png'},
    ]
    const sorted = filesInUploadOrder(files)
    expect(sorted.map((f) => f.name)).toEqual([
      'step1b.png',
      'step2.png',
      'step2a.png',
      'step10.png',
    ])
  })

  test('returns empty array for empty input', () => {
    expect(filesInUploadOrder([])).toEqual([])
  })

  test('handles single file', () => {
    const files = [{name: 'only.png'}]
    expect(filesInUploadOrder(files)).toEqual(files)
  })
})

describe('stepsFromAssets', () => {
  test('creates a guidedTourStep for each asset', () => {
    const assets: UploadedAsset[] = [
      {fileName: 'step1.png', assetId: 'asset-1'},
      {fileName: 'step2.png', assetId: 'asset-2'},
    ]
    let keyCount = 0
    const keyGen = () => `key-${++keyCount}`

    const steps = stepsFromAssets(assets, keyGen)

    expect(steps).toHaveLength(2)
  })

  test('step scaffold has correct shape with _type, _key, screenshot, and elements', () => {
    const assets: UploadedAsset[] = [{fileName: 'test.png', assetId: 'asset-xyz'}]
    let keyCount = 0
    const keyGen = () => `key-${++keyCount}`

    const steps = stepsFromAssets(assets, keyGen)

    expect(steps[0]).toEqual({
      _type: 'guidedTourStep',
      _key: 'key-1',
      screenshot: {
        _type: 'image',
        asset: {
          _type: 'reference',
          _ref: 'asset-xyz',
        },
      },
      elements: [],
    })
  })

  test('uses keyGen to generate unique _keys in order', () => {
    const assets: UploadedAsset[] = [
      {fileName: 'a.png', assetId: 'asset-a'},
      {fileName: 'b.png', assetId: 'asset-b'},
      {fileName: 'c.png', assetId: 'asset-c'},
    ]
    let keyCount = 0
    const keyGen = () => `key-${++keyCount}`

    const steps = stepsFromAssets(assets, keyGen)

    expect(steps[0]._key).toBe('key-1')
    expect(steps[1]._key).toBe('key-2')
    expect(steps[2]._key).toBe('key-3')
  })

  test('preserves asset order', () => {
    const assets: UploadedAsset[] = [
      {fileName: 'first.png', assetId: 'id-1'},
      {fileName: 'second.png', assetId: 'id-2'},
      {fileName: 'third.png', assetId: 'id-3'},
    ]
    let keyCount = 0
    const keyGen = () => `key-${++keyCount}`

    const steps = stepsFromAssets(assets, keyGen)

    expect(steps).toHaveLength(3)
    // Verify the asset IDs are preserved in the correct order by checking the
    // full step structure matches expected scaffolds with the right asset refs
    const expectedSteps = [
      {
        _type: 'guidedTourStep',
        _key: 'key-1',
        screenshot: {
          _type: 'image',
          asset: {_type: 'reference', _ref: 'id-1'},
        },
        elements: [],
      },
      {
        _type: 'guidedTourStep',
        _key: 'key-2',
        screenshot: {
          _type: 'image',
          asset: {_type: 'reference', _ref: 'id-2'},
        },
        elements: [],
      },
      {
        _type: 'guidedTourStep',
        _key: 'key-3',
        screenshot: {
          _type: 'image',
          asset: {_type: 'reference', _ref: 'id-3'},
        },
        elements: [],
      },
    ]
    expect(steps).toEqual(expectedSteps)
  })

  test('returns empty array for empty input', () => {
    const keyGen = () => 'key'
    expect(stepsFromAssets([], keyGen)).toEqual([])
  })
})

describe('partitionResults', () => {
  test('separates fulfilled results into ok array and counts failures', () => {
    const results: PromiseSettledResult<string>[] = [
      {status: 'fulfilled', value: 'success-1'},
      {status: 'rejected', reason: 'error-1'},
      {status: 'fulfilled', value: 'success-2'},
      {status: 'rejected', reason: 'error-2'},
    ]

    const {ok, failed} = partitionResults(results)

    expect(ok).toEqual(['success-1', 'success-2'])
    expect(failed).toBe(2)
  })

  test('returns all values when all promises are fulfilled', () => {
    const results: PromiseSettledResult<number>[] = [
      {status: 'fulfilled', value: 42},
      {status: 'fulfilled', value: 100},
      {status: 'fulfilled', value: 200},
    ]

    const {ok, failed} = partitionResults(results)

    expect(ok).toEqual([42, 100, 200])
    expect(failed).toBe(0)
  })

  test('counts failures correctly when all promises are rejected', () => {
    const results: PromiseSettledResult<unknown>[] = [
      {status: 'rejected', reason: 'error-1'},
      {status: 'rejected', reason: 'error-2'},
      {status: 'rejected', reason: 'error-3'},
    ]

    const {ok, failed} = partitionResults(results)

    expect(ok).toEqual([])
    expect(failed).toBe(3)
  })

  test('handles empty input', () => {
    const {ok, failed} = partitionResults([])

    expect(ok).toEqual([])
    expect(failed).toBe(0)
  })

  test('preserves order of fulfilled results', () => {
    const results: PromiseSettledResult<string>[] = [
      {status: 'fulfilled', value: 'a'},
      {status: 'rejected', reason: 'x'},
      {status: 'fulfilled', value: 'b'},
      {status: 'rejected', reason: 'y'},
      {status: 'fulfilled', value: 'c'},
    ]

    const {ok, failed} = partitionResults(results)

    expect(ok).toEqual(['a', 'b', 'c'])
    expect(failed).toBe(2)
  })
})

describe('summarizeUploadOutcome', () => {
  test('2 ok + 1 failed: a warning toast reporting both counts', () => {
    expect(summarizeUploadOutcome(2, 1)).toEqual({status: 'warning', title: '2 uploaded, 1 failed'})
  })

  test('all succeeded: a success toast, no failure count mentioned', () => {
    expect(summarizeUploadOutcome(3, 0)).toEqual({status: 'success', title: '3 uploaded'})
  })

  test('all failed: an error toast, no "uploaded" count mentioned', () => {
    expect(summarizeUploadOutcome(0, 2)).toEqual({status: 'error', title: '2 failed'})
  })

  test('zero and zero (defensive — never reached via a non-empty upload batch): a success toast with a neutral title', () => {
    expect(summarizeUploadOutcome(0, 0)).toEqual({status: 'success', title: 'No files uploaded'})
  })

  test("one ok, zero failed: singular-safe counts are the caller's job — this just formats the numbers given", () => {
    expect(summarizeUploadOutcome(1, 0)).toEqual({status: 'success', title: '1 uploaded'})
  })
})
