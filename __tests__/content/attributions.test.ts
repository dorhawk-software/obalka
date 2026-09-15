import {
  ATTRIBUTION_GROUPS,
  ATTRIBUTION_TOTAL,
  BUNDLED_COMPONENTS,
  LICENCE_TEXTS,
} from '../../src/content/attributions.generated';

// The Licence screen is a compliance artifact, so the property that matters is not "it renders" but
// "nothing is missing". These cases pin the invariants a silent regression would break: a component
// without the copyright line its licence demands, a licence identifier with no text behind it, or a
// bundled non-npm component quietly dropped when a dependency moved.
//
// The list is generated (scripts/gen-attributions.mjs) from the release bundle's own source map - not
// from `npm ls --prod`, which also lists metro/typescript and would claim dev tooling as shipped.

const allComponents = [
  ...BUNDLED_COMPONENTS,
  ...ATTRIBUTION_GROUPS.flatMap((group) => group.components),
];

describe('attribution manifest', () => {
  it('accounts for every distributed component', () => {
    expect(allComponents).toHaveLength(ATTRIBUTION_TOTAL);
    expect(ATTRIBUTION_TOTAL).toBeGreaterThan(100);
  });

  it('gives every component a copyright notice - the part each licence actually requires', () => {
    const withoutNotice = allComponents.filter(
      (c) => !/copyright|©/i.test(c.copyright ?? ''),
    );
    expect(withoutNotice.map((c) => c.name)).toEqual([]);
  });

  it('gives every component a name and a version', () => {
    const incomplete = allComponents.filter((c) => !c.name?.trim() || !c.version?.trim());
    expect(incomplete.map((c) => c.name)).toEqual([]);
  });

  it('has licence text behind every identifier it references', () => {
    const referenced = new Set([
      ...ATTRIBUTION_GROUPS.map((g) => g.spdx),
      ...BUNDLED_COMPONENTS.map((c) => c.spdx),
    ]);
    for (const spdx of referenced) {
      expect(typeof LICENCE_TEXTS[spdx]).toBe('string');
      expect(LICENCE_TEXTS[spdx].length).toBeGreaterThan(200);
    }
  });

  it('ships no licence text that nothing references', () => {
    const referenced = new Set([
      ...ATTRIBUTION_GROUPS.map((g) => g.spdx),
      ...BUNDLED_COMPONENTS.map((c) => c.spdx),
    ]);
    expect(Object.keys(LICENCE_TEXTS).filter((k) => !referenced.has(k))).toEqual([]);
  });

  it("keeps each group's count equal to what it actually lists", () => {
    for (const group of ATTRIBUTION_GROUPS) {
      expect(group.components).toHaveLength(group.count);
    }
  });

  // None of these has a package.json to be read from, so a tree-walker would omit them silently. Two
  // are the typefaces that shipped with no notice at all before this feature; SQLCipher's licence
  // explicitly requires reproducing its notice in binary distributions; PDF.js (010 US3) ships
  // MINIFIED INSIDE the MIT-licensed `unpdf` package, which strips its Apache-2.0 header - so the
  // walker sees one MIT dependency and Mozilla's code would travel credited to nobody; and the two
  // Argon2 entries (006) are the code that actually derives the backup key, reached through a
  // Maven coordinate and a CocoaPod that npm cannot see at all. zxing-cpp (025, 2026-09-24) is PDF.js's
  // case again: Apache-2.0 C++ vendored inside the MIT `react-native-nitro-zxing` - the QR decoder on
  // Android since ML Kit went. Go's runtime and standard library (025 T022) are compiled into the
  // transfer's native archive on both platforms, and `go list` names modules, which they are not.
  it('includes the non-npm components a dependency scan cannot see', () => {
    expect(BUNDLED_COMPONENTS.map((c) => c.name).sort()).toEqual([
      'Argon2 (reference implementation)',
      'Argon2Swift',
      'Bricolage Grotesque',
      'Go (runtime and standard library)',
      'OpenSSL',
      'PDF.js',
      'Public Sans',
      'SQLCipher',
      'zxing-cpp',
    ]);
  });

  it('labels each bundled component in both languages', () => {
    for (const component of BUNDLED_COMPONENTS) {
      expect(component.kindCs.trim().length).toBeGreaterThan(0);
      expect(component.kindEn.trim().length).toBeGreaterThan(0);
    }
  });

  it('does not claim build-time tooling as shipped', () => {
    const names = new Set(allComponents.map((c) => c.name));
    for (const toolingOnly of ['metro', 'typescript', 'jest', 'eslint', 'react-devtools-core']) {
      expect(names.has(toolingOnly)).toBe(false);
    }
  });

  it('reproduces licence bodies rather than summarizing them', () => {
    // Spot-check the operative wording; a paraphrased licence is not the licence.
    expect(LICENCE_TEXTS.MIT).toContain('Permission is hereby granted, free of charge');
    expect(LICENCE_TEXTS['Apache-2.0']).toContain(
      'TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION',
    );
    expect(LICENCE_TEXTS['OFL-1.1']).toContain('PERMISSION & CONDITIONS');
    expect(LICENCE_TEXTS['BSD-3-Clause']).toContain('Redistributions in binary form');
  });

  it('keeps the shared licence bodies free of a single component copyright line', () => {
    // Copyright lines live per component; a body carrying one holder's notice would misattribute
    // every other component sharing that licence. The pattern matches a NOTICE - a line opening with
    // Copyright/© and carrying a year or (c) - not prose that happens to begin with the word, as the
    // ISC body's "copyright notice and this permission notice appear in all copies" legitimately does.
    const notice = /^\s*(copyright|©)\b.*?(\(c\)|©|\b(19|20)\d{2}\b)/im;
    for (const [spdx, text] of Object.entries(LICENCE_TEXTS)) {
      const firstLines = text.split('\n').slice(0, 6).join('\n');
      expect(`${spdx}: ${notice.test(firstLines)}`).toBe(`${spdx}: false`);
    }
  });
});
