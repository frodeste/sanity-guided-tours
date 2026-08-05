#!/usr/bin/env bun
// Throwaway generator for `seed/images/*.png` — run once, commit the
// generated PNGs alongside this script. Not part of the published package
// or any build step; it exists purely so the three screenshots the seed
// script (`seed/seed.ts`) uploads don't have to be sourced from outside the
// repo. No image-processing dependency: a minimal PNG encoder (uncompressed
// 8-bit RGB, one IDAT chunk) built on `node:zlib`, which Bun exposes
// natively (`deflateSync` for the compressed stream, `crc32` for each
// chunk's trailing checksum — PNG and gzip share the same CRC-32 variant,
// confirmed against the standard "123456789" -> 0xcbf43926 check value).
//
// Each image is a flat, schematic "product screenshot": a header bar plus
// one accent-colored card, different per step so the three are visibly
// distinct when placed on a canvas. The content is decorative only — seed
// data exists to exercise the schema, not to look like a real product.
import {mkdirSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {crc32, deflateSync} from 'node:zlib'

interface Rgb {
  r: number
  g: number
  b: number
}

interface ImageSpec {
  filename: string
  background: Rgb
  header: Rgb
  card: Rgb
  cardBox: {x: number; y: number; width: number; height: number}
}

const WIDTH = 640
const HEIGHT = 400
const HEADER_HEIGHT = 48

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData) >>> 0, 0)
  return Buffer.concat([length, typeAndData, crc])
}

/** Encodes raw 8-bit RGB pixel data (no filter bytes, row-major) as a PNG. */
function encodePng(width: number, height: number, pixels: Buffer): Buffer {
  const stride = width * 3
  // Every scanline is prefixed with a filter-type byte; "0" (None) keeps
  // this encoder simple since compression ratio doesn't matter for seed data.
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1)
    raw[rowStart] = 0
    pixels.copy(raw, rowStart + 1, y * stride, y * stride + stride)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor (RGB)
  ihdr[10] = 0 // compression method
  ihdr[11] = 0 // filter method
  ihdr[12] = 0 // interlace method

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function withinBox(
  x: number,
  y: number,
  box: {x: number; y: number; width: number; height: number},
): boolean {
  return x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height
}

function renderMockup(spec: ImageSpec): Buffer {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 3)
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const color =
        y < HEADER_HEIGHT
          ? spec.header
          : withinBox(x, y, spec.cardBox)
            ? spec.card
            : spec.background
      const i = (y * WIDTH + x) * 3
      pixels[i] = color.r
      pixels[i + 1] = color.g
      pixels[i + 2] = color.b
    }
  }
  return encodePng(WIDTH, HEIGHT, pixels)
}

// Palette borrowed from `guidedTourTheme`'s own defaults (src/schema/theme.ts)
// so the seeded screenshots read as "this plugin's demo", not arbitrary colors.
const ACCENT: Rgb = {r: 0x22, g: 0x76, b: 0xfc}
const OVERLAY: Rgb = {r: 0x0f, g: 0x17, b: 0x2a}
const SURFACE: Rgb = {r: 0xff, g: 0xff, b: 0xff}
const TEXT: Rgb = {r: 0x1a, g: 0x1a, b: 0x1a}

const IMAGES: ImageSpec[] = [
  {
    filename: 'step-1.png',
    background: SURFACE,
    header: OVERLAY,
    card: ACCENT,
    cardBox: {x: 48, y: 96, width: 240, height: 120},
  },
  {
    filename: 'step-2.png',
    background: SURFACE,
    header: OVERLAY,
    card: TEXT,
    cardBox: {x: 352, y: 96, width: 240, height: 200},
  },
  {
    filename: 'step-3.png',
    background: SURFACE,
    header: OVERLAY,
    card: ACCENT,
    cardBox: {x: 200, y: 160, width: 240, height: 160},
  },
]

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'images')
mkdirSync(outDir, {recursive: true})

for (const spec of IMAGES) {
  const png = renderMockup(spec)
  const outPath = join(outDir, spec.filename)
  writeFileSync(outPath, png)
  console.error(`wrote ${outPath} (${png.length} bytes)`)
}
