import {describe, expect, test} from 'bun:test'

import {assetRefDimensions, assetRefToUrl, fileAssetRefToUrl} from '../../src/studio/assetRef'

// `assetRefToUrl`/`assetRefDimensions` parse a Sanity image asset `_ref`
// (`image-<assetId>-<width>x<height>-<extension>`) into a CDN URL/its
// declared dimensions, purely (no network, no `sanity` client). Pulled
// forward from Task 8's PreviewView scope into Task 5 because the canvas
// and filmstrip panes both need real `<img src>` URLs now — see
// CanvasInput.tsx's module comment for where this was decided.

describe('assetRefToUrl', () => {
  test('builds a cdn.sanity.io URL from a well-formed ref', () => {
    const url = assetRefToUrl('image-Tb9Ew8CX-800x600-png', 'proj123', 'production')
    expect(url).toBe('https://cdn.sanity.io/images/proj123/production/Tb9Ew8CX-800x600.png')
  })

  test('appends params verbatim as a query string when given', () => {
    const url = assetRefToUrl('image-abc-800x600-png', 'proj123', 'production', 'w=160')
    expect(url).toBe('https://cdn.sanity.io/images/proj123/production/abc-800x600.png?w=160')
  })

  test('returns null for a malformed ref', () => {
    expect(assetRefToUrl('not-an-asset-ref', 'proj123', 'production')).toBeNull()
  })

  test('returns null for a ref missing the extension', () => {
    expect(assetRefToUrl('image-abc-800x600', 'proj123', 'production')).toBeNull()
  })

  test('returns null for a ref with a non-numeric dimension', () => {
    expect(assetRefToUrl('image-abc-800xNaN-png', 'proj123', 'production')).toBeNull()
  })

  test('returns null for an empty string', () => {
    expect(assetRefToUrl('', 'proj123', 'production')).toBeNull()
  })
})

describe('assetRefDimensions', () => {
  test('extracts width and height from a well-formed ref', () => {
    expect(assetRefDimensions('image-abc123-1200x900-jpg')).toEqual({width: 1200, height: 900})
  })

  test('returns null for a malformed ref', () => {
    expect(assetRefDimensions('garbage')).toBeNull()
  })
})

// `fileAssetRefToUrl` mirrors `assetRefToUrl` for the M11 `video.file`
// field's `_ref` — a Sanity FILE asset ref (`file-<assetId>-<extension>`,
// no `WxH` component since a file asset carries no image dimensions) —
// resolving to the `cdn.sanity.io/files/...` URL space, not `/images/...`.
describe('fileAssetRefToUrl', () => {
  test('builds a cdn.sanity.io/files URL from a well-formed file ref', () => {
    const url = fileAssetRefToUrl('file-Tb9Ew8CX-mp4', 'proj123', 'production')
    expect(url).toBe('https://cdn.sanity.io/files/proj123/production/Tb9Ew8CX.mp4')
  })

  test('returns null for a malformed ref (e.g. an image ref, which has an extra WxH component)', () => {
    expect(fileAssetRefToUrl('image-abc-800x600-png', 'proj123', 'production')).toBeNull()
  })

  test('returns null for a ref missing the extension', () => {
    expect(fileAssetRefToUrl('file-abc123', 'proj123', 'production')).toBeNull()
  })

  test('returns null for an empty string', () => {
    expect(fileAssetRefToUrl('', 'proj123', 'production')).toBeNull()
  })
})
