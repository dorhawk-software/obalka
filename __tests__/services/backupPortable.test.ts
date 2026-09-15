// The file a user carries away, and every way it can come back wrong.
//
// This one is worth being fussy about: the file is chosen by hand, often a year later, often because
// something has already gone wrong with the phone. Every failure here has to say which of the three
// things happened - not ours, too new, damaged - because "import failed" in front of somebody's only
// backup is the worst sentence this app could print.

import {
  PORTABLE_VERSION,
  PortableFormatError,
  packPortable,
  portableFileName,
  unpackPortable,
} from '../../src/services/backup/portable';
import type { BackupManifest } from '../../src/services/backup/schema';

const manifest = (over: Partial<BackupManifest> = {}): BackupManifest => ({
  formatVersion: 1,
  schemaVersion: 1,
  appVersion: '0.0.1',
  createdAt: Date.UTC(2026, 8, 12, 9, 24),
  tiers: { metadata: true, documents: false },
  sizeBytes: 4,
  archiveName: 'obalka-1.backup',
  ...over,
});

const archive = () => new Uint8Array([1, 2, 3, 4]);

describe('a backup that leaves the phone', () => {
  it('comes back as exactly what went in', () => {
    const m = manifest();
    const a = archive();
    const { manifest: back, archive: bytes } = unpackPortable(packPortable(m, a));
    expect(back).toEqual(m);
    expect(Array.from(bytes)).toEqual(Array.from(a));
  });

  it('survives a manifest with non-ASCII in it', () => {
    // Box labels reach the manifest's appVersion field in no build today, but the encoder has to be
    // UTF-8 regardless: `decodeUtf8` exists in this app precisely because Hermes had no TextDecoder.
    const m = manifest({ appVersion: '1.0.0-příliš žluťoučký' });
    const { manifest: back } = unpackPortable(packPortable(m, archive()));
    expect(back.appVersion).toBe('1.0.0-příliš žluťoučký');
  });

  it('handles an archive far larger than the manifest', () => {
    const big = new Uint8Array(200_000).fill(7);
    const { archive: back } = unpackPortable(
      packPortable(manifest({ sizeBytes: big.length }), big),
    );
    expect(back.length).toBe(big.length);
    expect(back[199_999]).toBe(7);
  });
});

describe('a file that is not one of ours', () => {
  it('is refused by name, not by a JSON error', () => {
    const notOurs = new Uint8Array(64).fill(0x41); // "AAAA..."
    expect(() => unpackPortable(notOurs)).toThrow(PortableFormatError);
    expect(() => unpackPortable(notOurs)).toThrow(/Not an Obálka backup/);
  });

  it('is refused when it is too short to hold a header at all', () => {
    expect(() => unpackPortable(new Uint8Array([0x4f, 0x42]))).toThrow(
      /too short/,
    );
  });
});

describe('a file from a newer build', () => {
  it('says so, and says to update, rather than claiming damage', () => {
    // The failure this app will actually meet: a backup exported by a later version, imported by a
    // phone that has not updated. Telling that user their backup is corrupt would be a lie.
    const bytes = packPortable(manifest(), archive());
    bytes[8] = PORTABLE_VERSION + 1;
    expect(() => unpackPortable(bytes)).toThrow(/newer version of the app/);
    expect(() => unpackPortable(bytes)).not.toThrow(/damaged/);
  });
});

describe('a damaged file', () => {
  it('is caught at the manifest length rather than deep inside a parse', () => {
    const bytes = packPortable(manifest(), archive());
    new DataView(bytes.buffer).setUint32(9, 10_000, false);
    expect(() => unpackPortable(bytes)).toThrow(/bad manifest length/);
  });

  it('is caught when the manifest itself is not JSON', () => {
    const bytes = packPortable(manifest(), archive());
    bytes[13] = 0x7b; // '{' over the start of the real JSON, leaving it unparseable
    bytes[14] = 0x7b;
    expect(() => unpackPortable(bytes)).toThrow(/unreadable manifest/);
  });

  it('is caught when it was truncated to nothing but a manifest', () => {
    const full = packPortable(manifest(), archive());
    expect(() => unpackPortable(full.subarray(0, full.length - 4))).toThrow(
      /no archive inside/,
    );
  });

  it('is caught when the size claim and the archive disagree', () => {
    // The manifest travels in the clear, so this is the one field an edit could use to make a
    // restore look wrong. Better an honest "damaged" here than a failure deep in the restore, which
    // would read as the sealed archive being broken.
    const bytes = packPortable(manifest({ sizeBytes: 999 }), archive());
    expect(() => unpackPortable(bytes)).toThrow(/size does not match/);
  });
});

describe('the exported file name', () => {
  it('carries the date the backup was taken, not the date it was exported', () => {
    // The question asked of a folder full of these is "how old is this one?", and it should not
    // require opening anything to answer.
    const name = portableFileName(manifest({ createdAt: new Date(2026, 0, 5, 7, 3).getTime() }));
    expect(name).toBe('obalka-2026-01-05-0703.obalka');
  });
});
