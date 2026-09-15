// The path behind a picker's cache copy - shared by the attachment picker (005) and the backup import
// (006 T014), which read picked files the same way. Each caller has its own end-to-end test; this one
// pins the contract both rely on.

import {
  fileUri,
  localCopyCleanupPath,
  localCopyPath,
} from '../../src/services/files/localCopyPath';

describe('localCopyPath', () => {
  it('decodes a percent-encoded file URI with a Czech name full of spaces', () => {
    expect(
      localCopyPath(
        'file:///data/user/0/cz.obalka/cache/Smlouva%20o%20d%C3%ADlo%20%C4%8D.%202%20%E2%80%93%20p%C5%99%C3%ADloha.pdf',
      ),
    ).toBe('/data/user/0/cz.obalka/cache/Smlouva o dílo č. 2 – příloha.pdf');
  });

  it('decodes an encoded percent sign once, not twice', () => {
    // `%25` is a literal "%" in the file name; decoding again would turn "100%20" into "100 ".
    expect(localCopyPath('file:///cache/sleva%20100%2520.pdf')).toBe('/cache/sleva 100%20.pdf');
  });

  it('leaves a value without the file scheme as it is', () => {
    // A bare path is already a real name, so it is not decoded: "100%" here is a percent sign, and
    // decoding it anyway would throw on a file that exists.
    expect(localCopyPath('/cache/Smlouva o dílo 100%.pdf')).toBe('/cache/Smlouva o dílo 100%.pdf');
  });

  it('throws on a malformed escape rather than guessing a path', () => {
    expect(() => localCopyPath('file:///cache/bad%E0%A4%A.pdf')).toThrow(URIError);
  });
});

describe('fileUri (2026-09-15)', () => {
  // The save sheet parses the URI it is handed (Android `Uri.parse`, iOS `URL(string:)`). A path pasted
  // after the scheme ended at "#" and was malformed at a bare "%", so these names could not be saved.
  const path = '/docs/attachments/box1/42/Rozhodnutí #3 100%.pdf';

  it('percent-encodes a name with a hash, a percent sign, spaces and diacritics', () => {
    expect(fileUri(path)).toBe(
      'file:///docs/attachments/box1/42/Rozhodnut%C3%AD%20%233%20100%25.pdf',
    );
  });

  it('leaves nothing a URI parser would read as a fragment, a query or a broken escape', () => {
    const uri = fileUri(path);
    expect(uri).not.toMatch(/[#? ]/);
    // Every "%" begins a complete escape.
    expect(uri.replace(/%[0-9A-F]{2}/g, '')).not.toContain('%');
  });

  it('keeps the separators, so the URI decodes back to the very same path', () => {
    expect(fileUri('/cache/obalka-2026-09-15-1200.obalka')).toBe(
      'file:///cache/obalka-2026-09-15-1200.obalka',
    );
    for (const p of [path, '/cache/Smlouva o dílo č. 2 – příloha.pdf', '/cache/sleva 100%20.pdf']) {
      expect(localCopyPath(fileUri(p))).toBe(p);
    }
  });
});

describe('localCopyCleanupPath (2026-09-15)', () => {
  it('is the decoded path whenever there is one', () => {
    expect(localCopyCleanupPath('file:///cache/moje%20z%C3%A1loha.obalka')).toBe(
      '/cache/moje záloha.obalka',
    );
  });

  it('falls back to the scheme-stripped string for a malformed escape, rather than throwing', () => {
    // The copy still has to go, and an unencoded answer is the only one that can carry this escape.
    expect(localCopyCleanupPath('file:///cache/bad%E0%A4%A.pdf')).toBe('/cache/bad%E0%A4%A.pdf');
    expect(localCopyCleanupPath('/cache/plain.pdf')).toBe('/cache/plain.pdf');
  });
});
