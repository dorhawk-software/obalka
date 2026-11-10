// Dependency advisories closed on 2026-09-14, and the lines that would quietly reopen them.
//
// GitHub reported nine open advisories before the repository went public. None was in code this app
// wrote and none needed an app change, but every one of the fixes lives somewhere a routine upgrade
// overwrites without anybody deciding to:
//
// - image-size (two high, and no patched release exists). Metro 0.84.5 replaced it with vendored
//   parsers, so the fix is its absence; a lockfile that brings it back brings back an unpatched copy.
// - decode-uri-component (moderate, then a second advisory in 2026-11). @react-navigation/core 7.24
//   parses URLs itself and no longer ships query-string or the decoder at all, which retired the
//   `overrides` entry and the query-string patch that kept 0.5.0 loadable. The parsing test below runs
//   react-navigation's own code on the same hostile input, so a regression in its parser shows here.
// - activesupport and concurrent-ruby (six, in the CocoaPods tooling). The Gemfile floors are the
//   fix, and React Native's upgrade helper copies the template's vulnerable ranges straight back.
//
// The timing budget is deliberately loose. On the hostile input below a linear decoder takes well
// under a millisecond; the vulnerable one took about 17 seconds under jest (2.8 s in plain Node) on the
// same machine, so there is no threshold in between that a slow CI runner could trip by accident.

import { readFileSync } from 'fs';
import { join } from 'path';
import { getPathFromState, getStateFromPath } from '@react-navigation/native';

const ROOT = join(__dirname, '../..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

/** Dotted release numbers compared part by part, so "7.2.3.1" sorts above "7.2.3". */
function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/** Every copy of `name` the lockfile installs, hoisted or nested under another package. */
function lockedCopies(name: string): { path: string; version: string }[] {
  const lock = JSON.parse(read('package-lock.json')) as {
    packages: Record<string, { version?: string }>;
  };
  return Object.entries(lock.packages)
    .filter(([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`))
    .map(([path, pkg]) => ({ path, version: pkg.version ?? '' }));
}

/** The requirement strings of one `gem 'name', '>= x', ...` line, or none when the gem is absent. */
function gemRequirements(gemfile: string, name: string): string[] {
  const line = gemfile.split('\n').find(l => l.trim().startsWith(`gem '${name}'`));
  if (!line) {
    return [];
  }
  return [...line.matchAll(/'([^']*)'/g)].map(m => m[1]).slice(1);
}

/**
 * The lowest version a set of RubyGems requirements admits, or null when nothing bounds it from
 * below. `<` and `!=` never do, which is exactly how the template's `'< 1.3.4'` admitted every
 * vulnerable concurrent-ruby.
 */
function lowerBound(requirements: string[]): string | null {
  let bound: string | null = null;
  for (const requirement of requirements) {
    const match = /^(?:>=|>|~>|=)?\s*(\d[\d.]*)$/.exec(requirement.trim());
    if (match && (bound === null || compareVersions(match[1], bound) > 0)) {
      bound = match[1];
    }
  }
  return bound;
}

/** Malformed percent-encoding: every `%C2` is a UTF-8 lead byte with no continuation byte. */
const HOSTILE_ESCAPES = 400;
const HOSTILE = '%C2'.repeat(HOSTILE_ESCAPES);
const LINEAR_BUDGET_MS = 1000;

function timed<T>(fn: () => T): { value: T; ms: number } {
  const start = Date.now();
  const value = fn();
  return { value, ms: Date.now() - start };
}

describe('npm advisories', () => {
  it('installs no image-size, which has no patched release', () => {
    expect(lockedCopies('image-size')).toEqual([]);
  });

  it('installs no decode-uri-component older than the patched 0.5.0', () => {
    const outdated = lockedCopies('decode-uri-component').filter(
      copy => compareVersions(copy.version, '0.5.0') < 0,
    );
    expect(outdated).toEqual([]);
  });
});

describe('URL query parsing', () => {
  // The app does not hand react-navigation a URL today (no scheme, no `linking`), but this is the
  // path one would take the day it does.
  it('reaches react-navigation path parsing, which stays fast and round-trips Czech', () => {
    const config = { screens: { Search: 'search' } };
    const { value: hostile, ms } = timed(() =>
      getStateFromPath(`search?q=${HOSTILE}`, config),
    );
    expect(ms).toBeLessThan(LINEAR_BUDGET_MS);
    // core 7.24's own parser keeps an escape it cannot decode as it was typed; query-string's decoder
    // replaced each with U+FFFD. Either is safe - what matters is the time above.
    expect(hostile?.routes[0]?.params).toEqual({ q: HOSTILE });

    const czech = getStateFromPath('search?q=%C5%BDlu%C5%A5ou%C4%8Dk%C3%BD+k%C5%AF%C5%88', config);
    expect(czech?.routes[0]).toMatchObject({ name: 'Search', params: { q: 'Žluťoučký kůň' } });
    expect(czech && getPathFromState(czech, config)).toBe(
      '/search?q=%C5%BDlu%C5%A5ou%C4%8Dk%C3%BD%20k%C5%AF%C5%88',
    );
  });
});

describe('CocoaPods tooling (Gemfile)', () => {
  const gemfile = read('Gemfile');

  it.each([
    ['activesupport', '7.2.3.1'],
    ['concurrent-ruby', '1.3.7'],
  ])('cannot resolve %s below the patched %s', (name, patched) => {
    const bound = lowerBound(gemRequirements(gemfile, name));
    expect(bound).not.toBeNull();
    expect(compareVersions(bound ?? '0', patched)).toBeGreaterThanOrEqual(0);
  });

  it('asks for a Ruby that activesupport 7.2 can run on', () => {
    const ruby = /^ruby "([^"]*)"/m.exec(gemfile)?.[1] ?? '';
    expect(compareVersions(lowerBound([ruby]) ?? '0', '3.1.0')).toBeGreaterThanOrEqual(0);
  });
});
