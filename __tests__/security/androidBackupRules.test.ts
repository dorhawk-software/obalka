// Nothing of this app goes into Android's own backups or its phone-to-phone migration (owner
// decision, 2026-09-24).
//
// The archive's SQLCipher key and the vault key are this-device-only Keystore items, so a copy that
// lands on another phone cannot be opened there. What such a copy carries READABLY is the plain files
// beside the database - attachments, signed originals, debug ZIPs, backup files - and those would
// sit in Google's cloud. Moving an archive is the app's own encrypted backup (006) and transfer (025).
//
// `allowBackup="false"` was already there and was believed to be the whole answer. It is not: for an
// app targeting Android 12 or newer it stops the cloud backup and leaves the device-to-device transfer
// running. So this asserts the three attributes together, and parses the two rule files rather than
// matching text, because a rule that is present but commented out, or excludes one domain in one
// section, reads the same to a grep.
//
// This asserts the configuration, not the behaviour. What a real migration copies is the device
// walk's to show (`adb shell bmgr` / a transfer to a second phone).

import { readFileSync } from 'fs';
import { join } from 'path';
import { XMLParser } from 'fast-xml-parser';

const MAIN = join(__dirname, '../../android/app/src/main');

/** Every domain the platform defines for these files (Auto Backup docs, and lint's own list). */
const DOMAINS = [
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  // Comments are dropped by default, which is the point: a rule inside `<!-- -->` must not count.
  isArray: name => ['exclude', 'include', 'cloud-backup', 'device-transfer'].includes(name),
});

interface Rule {
  domain?: string;
  path?: string;
}
interface Section {
  exclude?: Rule[];
  include?: Rule[];
}

function parse(file: string): Record<string, unknown> {
  return parser.parse(readFileSync(join(MAIN, file), 'utf8')) as Record<string, unknown>;
}

/** The domains a section excludes WHOLE - its own directory, not a file or folder inside it. */
function wholeDomainsExcluded(section: Section): string[] {
  return (section.exclude ?? [])
    .filter(rule => rule.path === '.')
    .map(rule => rule.domain ?? '')
    .sort();
}

describe('the Android manifest', () => {
  const manifest = parse('AndroidManifest.xml') as {
    manifest: { application: Record<string, string> };
  };
  const app = manifest.manifest.application;

  it('keeps cloud backup off AND points Android 12+ at the rules that also govern transfer', () => {
    // The flag alone was the state before 2026-09-24, and it was not enough; the two together are
    // the requirement.
    expect(app['android:allowBackup']).toBe('false');
    expect(app['android:dataExtractionRules']).toBe('@xml/data_extraction_rules');
  });

  it('points Android 11 and older at the full-backup rules', () => {
    expect(app['android:fullBackupContent']).toBe('@xml/backup_rules');
  });
});

describe('res/xml/data_extraction_rules.xml (Android 12+)', () => {
  const root = parse('res/xml/data_extraction_rules.xml')['data-extraction-rules'] as {
    'cloud-backup'?: Section[];
    'device-transfer'?: Section[];
    'cross-platform-transfer'?: unknown;
  };

  it.each(['cloud-backup', 'device-transfer'] as const)(
    'excludes every domain from <%s>, and includes nothing',
    name => {
      const sections = root[name] ?? [];
      expect(sections).toHaveLength(1);
      expect(wholeDomainsExcluded(sections[0])).toEqual([...DOMAINS].sort());
      // One `<include>` flips the section to "only what is listed" - and a later edit adding one
      // for a harmless file would read as narrowing, which is not what it does.
      expect(sections[0].include ?? []).toEqual([]);
    },
  );

  it('does not opt in to the transfer to an iPhone', () => {
    expect(root['cross-platform-transfer']).toBeUndefined();
  });
});

describe('res/xml/backup_rules.xml (Android 11 and older)', () => {
  const root = parse('res/xml/backup_rules.xml')['full-backup-content'] as Section;

  it('excludes every domain, and includes nothing', () => {
    expect(wholeDomainsExcluded(root)).toEqual([...DOMAINS].sort());
    expect(root.include ?? []).toEqual([]);
  });
});
