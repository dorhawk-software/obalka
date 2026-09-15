// The release command (scripts/release.mjs).
//
// What it gets wrong is expensive in a way few bugs are: a version that does not go up is rejected by
// both stores AFTER a twenty-minute build, and a tag pushed from the wrong branch ships code nobody
// reviewed. So the checks that run before anything is written are tested here, including the ones that
// should say no.

import {
  isNewer,
  parseVersion,
  releaseProblems,
  withAppVersion,
} from '../../scripts/release.mjs';

const ready = {
  version: '0.1.0',
  current: '0.0.1',
  branch: 'main',
  dirty: false,
  behind: 0,
  tagExists: false,
};

describe('versions', () => {
  it('reads plain three-part numbers', () => {
    expect(parseVersion('0.1.0')).toEqual([0, 1, 0]);
    expect(parseVersion(' 12.3.45 ')).toEqual([12, 3, 45]);
  });

  it('refuses what the stores would refuse', () => {
    // Suffixes and prefixes are valid semver but not valid App Store / Play versions.
    for (const bad of ['v0.1.0', '0.1', '0.1.0-beta.1', '1.2.3.4', '', 'abc', undefined]) {
      expect(parseVersion(bad as string)).toBeNull();
    }
  });

  it('compares numerically, not as text', () => {
    expect(isNewer('0.10.0', '0.9.0')).toBe(true);
    expect(isNewer('1.0.0', '0.99.99')).toBe(true);
    expect(isNewer('0.1.1', '0.1.0')).toBe(true);
  });

  it('says no to the same version and to going back', () => {
    expect(isNewer('0.1.0', '0.1.0')).toBe(false);
    expect(isNewer('0.0.9', '0.1.0')).toBe(false);
    expect(isNewer('nonsense', '0.1.0')).toBe(false);
  });
});

describe('the in-app version string', () => {
  const appInfo = "// comment\nexport const APP_VERSION = '0.0.1';\nexport const OTHER = 1;\n";

  it('is rewritten in place and nothing else changes', () => {
    expect(withAppVersion(appInfo, '0.1.0')).toBe(
      "// comment\nexport const APP_VERSION = '0.1.0';\nexport const OTHER = 1;\n",
    );
  });

  it('stops the release when the constant is not where it is expected', () => {
    expect(() => withAppVersion('export const VERSION = "0.0.1";', '0.1.0')).toThrow(/APP_VERSION/);
  });
});

describe('before anything is written', () => {
  it('lets a clean, current main with a new version through', () => {
    expect(releaseProblems(ready)).toEqual([]);
  });

  it('names every problem at once, not just the first', () => {
    const problems = releaseProblems({
      version: '0.0.1',
      current: '0.0.1',
      branch: 'feature',
      dirty: true,
      behind: 2,
      tagExists: true,
    });
    expect(problems).toHaveLength(5);
    expect(problems.join('\n')).toMatch(/not newer/);
    expect(problems.join('\n')).toMatch(/from main/);
    expect(problems.join('\n')).toMatch(/uncommitted/);
    expect(problems.join('\n')).toMatch(/behind origin/);
    expect(problems.join('\n')).toMatch(/already exists/);
  });

  it('refuses a version that is not a number, and says how to call it', () => {
    expect(releaseProblems({ ...ready, version: 'v0.1.0' })[0]).toMatch(/not a version like 0\.1\.0/);
    expect(releaseProblems({ ...ready, version: undefined as unknown as string })).toHaveLength(1);
  });
});
