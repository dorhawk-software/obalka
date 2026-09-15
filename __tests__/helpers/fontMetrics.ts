// How wide a string is drawn in one of the bundled fonts, and how far its ink reaches up and down,
// read from the font file itself.
//
// Jest has no text layout, so a test that needs to know whether a line wraps has to measure it. This
// reads each glyph's advance width from the .ttf's own `hmtx` table, found through its Unicode `cmap`,
// which is where a text engine starts too. Kerning (`GPOS`) is left out, as it is in the widths the
// specs quote, so a test built on this should keep a margin rather than compare to the last hundredth
// of a dp. Heights come from `hhea`, `OS/2` and each glyph's `glyf` box (`fontFace`), for the iOS
// clipping audit (`textClipping.ts`).

import { readFileSync } from 'fs';
import { join } from 'path';

const FONTS = join(__dirname, '../../assets/fonts');

/** Width in dp of `text` set at `fontSize`, spaces included. */
export type Measure = (text: string, fontSize: number) => number;

/** A bundled .ttf opened for reading: its tables by tag and its Unicode `cmap` as a lookup. */
interface FontFile {
  readonly font: Buffer;
  readonly table: (tag: string) => number;
  readonly glyphOf: (codePoint: number) => number;
  readonly unitsPerEm: number;
}

function openFont(file: string): FontFile {
  const font = readFileSync(join(FONTS, file));
  const tables = new Map<string, number>();
  const tableCount = font.readUInt16BE(4);
  for (let i = 0; i < tableCount; i += 1) {
    const record = 12 + 16 * i;
    tables.set(font.toString('latin1', record, record + 4), font.readUInt32BE(record + 8));
  }
  const table = (tag: string): number => {
    const offset = tables.get(tag);
    if (offset == null) {
      throw new Error(`${file} has no ${tag} table`);
    }
    return offset;
  };
  return {
    font,
    table,
    glyphOf: unicodeGlyphs(font, table('cmap'), file),
    unitsPerEm: font.readUInt16BE(table('head') + 18),
  };
}

/** A measure for one bundled face, by file name: `PublicSans-Medium.ttf`. */
export function fontMeasure(file: string): Measure {
  const { font, table, glyphOf, unitsPerEm } = openFont(file);
  const longMetrics = font.readUInt16BE(table('hhea') + 34);
  const hmtx = table('hmtx');

  return (text, fontSize) => {
    let units = 0;
    for (const ch of text) {
      const glyph = glyphOf(ch.codePointAt(0) ?? 0);
      if (glyph === 0) {
        // The missing-glyph box has a width too, and measuring it would pass for a measurement.
        throw new Error(`${file} has no glyph for ${JSON.stringify(ch)}`);
      }
      // Glyphs past the last long metric share its advance: the table's run-length tail.
      units += font.readUInt16BE(hmtx + 4 * Math.min(glyph, longMetrics - 1));
    }
    return (units * fontSize) / unitsPerEm;
  };
}

/** A face's vertical metrics in ems (font units / unitsPerEm): y grows UP from the baseline. */
export interface VerticalMetrics {
  readonly unitsPerEm: number;
  /** `hhea` - what CoreText (iOS) and Android both lay a line out by. Descender is negative. */
  readonly ascender: number;
  readonly descender: number;
  readonly lineGap: number;
  /** `OS/2` - recorded for the doc; both platforms read `hhea` for these fonts. */
  readonly typoAscender: number;
  readonly typoDescender: number;
  readonly typoLineGap: number;
  readonly winAscent: number;
  readonly winDescent: number;
}

/** How far one glyph's outline reaches above and below the baseline, in ems. */
export interface InkBounds {
  readonly yMin: number;
  readonly yMax: number;
}

export interface FontFace {
  readonly metrics: VerticalMetrics;
  /** The ink of the glyph `cmap` maps `ch` to; null for an outline-less glyph (a space). */
  readonly ink: (ch: string) => InkBounds | null;
  readonly has: (ch: string) => boolean;
}

/**
 * The vertical metrics and per-glyph ink bounds of one bundled face, read from `hhea`, `OS/2` and each
 * glyph's own `glyf` header (whose bounding box the font compiler writes for simple and composite
 * glyphs alike).
 */
export function fontFace(file: string): FontFace {
  const { font, table, glyphOf, unitsPerEm } = openFont(file);
  const em = (units: number) => units / unitsPerEm;
  const hhea = table('hhea');
  const os2 = table('OS/2');
  const longLoca = font.readInt16BE(table('head') + 50) === 1;
  const loca = table('loca');
  const glyf = table('glyf');
  const glyphStart = (glyph: number) =>
    longLoca ? font.readUInt32BE(loca + 4 * glyph) : 2 * font.readUInt16BE(loca + 2 * glyph);

  const glyphFor = (ch: string) => glyphOf(ch.codePointAt(0) ?? 0);
  return {
    metrics: {
      unitsPerEm,
      ascender: em(font.readInt16BE(hhea + 4)),
      descender: em(font.readInt16BE(hhea + 6)),
      lineGap: em(font.readInt16BE(hhea + 8)),
      typoAscender: em(font.readInt16BE(os2 + 68)),
      typoDescender: em(font.readInt16BE(os2 + 70)),
      typoLineGap: em(font.readInt16BE(os2 + 72)),
      winAscent: em(font.readUInt16BE(os2 + 74)),
      winDescent: em(font.readUInt16BE(os2 + 76)),
    },
    has: ch => glyphFor(ch) !== 0,
    ink: ch => {
      const glyph = glyphFor(ch);
      if (glyph === 0) {
        throw new Error(`${file} has no glyph for ${JSON.stringify(ch)}`);
      }
      const start = glyphStart(glyph);
      if (glyphStart(glyph + 1) === start) {
        return null;
      }
      const header = glyf + start;
      return { yMin: em(font.readInt16BE(header + 4)), yMax: em(font.readInt16BE(header + 8)) };
    },
  };
}

/** The Windows Unicode BMP `cmap` subtable (platform 3, encoding 1, format 4), as a lookup. */
function unicodeGlyphs(font: Buffer, cmap: number, file: string): (codePoint: number) => number {
  let subtable = -1;
  const records = font.readUInt16BE(cmap + 2);
  for (let i = 0; i < records; i += 1) {
    const record = cmap + 4 + 8 * i;
    if (font.readUInt16BE(record) === 3 && font.readUInt16BE(record + 2) === 1) {
      subtable = cmap + font.readUInt32BE(record + 4);
    }
  }
  if (subtable < 0 || font.readUInt16BE(subtable) !== 4) {
    throw new Error(`${file} has no format 4 Unicode cmap`);
  }
  const segments = font.readUInt16BE(subtable + 6) / 2;
  const endCodes = subtable + 14;
  const startCodes = endCodes + 2 * segments + 2;
  const deltas = startCodes + 2 * segments;
  const rangeOffsets = deltas + 2 * segments;

  return codePoint => {
    for (let s = 0; s < segments; s += 1) {
      if (codePoint > font.readUInt16BE(endCodes + 2 * s)) {
        continue;
      }
      const start = font.readUInt16BE(startCodes + 2 * s);
      if (codePoint < start) {
        return 0;
      }
      const delta = font.readInt16BE(deltas + 2 * s);
      const rangeOffset = font.readUInt16BE(rangeOffsets + 2 * s);
      if (rangeOffset === 0) {
        return (codePoint + delta) & 0xffff;
      }
      const glyph = font.readUInt16BE(rangeOffsets + 2 * s + rangeOffset + 2 * (codePoint - start));
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
}

/**
 * Lines `text` takes in `width` when it is broken greedily at spaces: each word stays on the line it
 * would start on for as long as it fits there. A word wider than the whole line gets a line to itself.
 */
export function greedyLines(
  text: string,
  width: number,
  fontSize: number,
  measure: Measure,
): number {
  const gap = measure(' ', fontSize);
  let lines = 1;
  let used = -1;
  for (const word of text.split(' ')) {
    const w = measure(word, fontSize);
    if (used < 0) {
      used = w;
    } else if (used + gap + w <= width) {
      used += gap + w;
    } else {
      lines += 1;
      used = w;
    }
  }
  return lines;
}
