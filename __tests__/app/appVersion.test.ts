// The version the app shows (Settings → About, debug bundles, backups) is the version it ships as.
//
// `APP_VERSION` is a constant rather than an import of package.json, so the app does not bundle the
// whole manifest - which makes it a second copy that can drift. The release command sets both
// (scripts/release.mjs), and the release workflow refuses a tag they disagree with; this catches a
// hand edit in between.

import { readFileSync } from 'fs';
import { join } from 'path';
import { APP_VERSION } from '../../src/app/appInfo';

describe('the app version', () => {
  it('is package.json’s version', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as {
      version: string;
    };
    expect(APP_VERSION).toBe(pkg.version);
  });

  it('is a version both stores accept: three numbers, nothing else', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
