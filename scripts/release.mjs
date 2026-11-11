#!/usr/bin/env node
// Cut a release: one command sets the version where it is kept, commits, tags and pushes. The tag is
// what `.github/workflows/release.yml` builds and ships - iOS to TestFlight, Android to Google Play's
// internal testing. Setup and the rest of the story: docs/release-ci.md.
//
//   npm run release -- 0.1.0
//
// It refuses rather than guesses. A dirty tree, a branch other than main, a main behind origin, a
// version that does not go up, a tag that already exists, or a changelog with nothing under
// "Unreleased" (or Czech and English that disagree) all stop it before anything is written.
//
// Another build of the SAME version (2026-11-11, owner: "1.0.0 (1), 1.0.0 (2), 1.0.0 (3)" as Shrike had):
// `npm run release -- 1.0.0` again while 1.0.0 is the current version. That build is tagged `v1.0.0+2`, then
// `+3` - SemVer's build metadata, same version - and what "Unreleased" holds joins 1.0.0's section, which
// takes the new date; an empty Unreleased is fine for a rebuild. The build NUMBER Apple and Google see is
// the release workflow's, not this count (see its verify job).
//
// The changelog (spec 029): "## Unreleased" in CHANGELOG.md and CHANGELOG.en.md becomes
// "## <version> (<today>)", and the app's built-in copy is regenerated, in the release commit. That
// section is what the release workflow publishes on GitHub and the stores, and what the app shows.
// `npm run verify` runs first, because a tag on a red commit ships a red commit.
//
// Where the version is kept, and why each copy exists:
//   package.json, package-lock.json - the source. Android reads it for local builds (build.gradle).
//   src/app/appInfo.ts APP_VERSION  - what Settings → About shows. A constant rather than an import so
//                                     the app does not bundle package.json (see its comment);
//                                     __tests__/app/appVersion.test.ts fails when the two disagree.
// The NATIVE version numbers are not edited here. The workflow sets them from the tag at build time,
// and the build number from the run, so nothing native can drift from the tag.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  folded,
  FILES as CHANGELOG_FILES,
  GENERATED as CHANGELOG_GENERATED,
  count,
  dated,
  generated,
  mismatches,
  parse,
} from './changelog.mjs';

const APP_INFO = 'src/app/appInfo.ts';
const APP_VERSION_LINE = /export const APP_VERSION = '([^']*)';/;

/** `1.2.3` as numbers, or null. Pre-release suffixes are refused: the stores accept numbers only. */
export function parseVersion(text) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(text ?? '').trim());
  if (!m) {
    return null;
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Whether `next` is strictly greater than `current`. Both stores reject a version that does not go up. */
export function isNewer(next, current) {
  const a = parseVersion(next);
  const b = parseVersion(current);
  if (!a || !b) {
    return false;
  }
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return a[i] > b[i];
    }
  }
  return false;
}

/** appInfo.ts with APP_VERSION set to `version`. Throws when the constant is not where it is expected. */
export function withAppVersion(source, version) {
  if (!APP_VERSION_LINE.test(source)) {
    throw new Error(`APP_VERSION constant not found in ${APP_INFO}`);
  }
  return source.replace(APP_VERSION_LINE, `export const APP_VERSION = '${version}';`);
}

/**
 * Every reason not to release now, in the order a person would want to fix them. Empty = go.
 *
 * @param {{
 *   version: string | undefined, current: string, branch: string, dirty: boolean, behind: number,
 *   tagExists: boolean, rebuild?: boolean, unreleased?: { cs: number, en: number },
 *   changelogProblems?: string[],
 * }} facts
 * @returns {string[]}
 */
export function releaseProblems({
  version,
  current,
  branch,
  dirty,
  behind,
  tagExists,
  rebuild = false,
  unreleased = { cs: 1, en: 1 },
  changelogProblems = [],
}) {
  const problems = [];
  // A rebuild may carry nothing new: a build fixed for the store's sake changes nothing anyone reads.
  if (!rebuild && (unreleased.cs === 0 || unreleased.en === 0)) {
    problems.push(
      'Nothing under "## Unreleased" in ' +
        [unreleased.cs === 0 ? 'CHANGELOG.md' : null, unreleased.en === 0 ? 'CHANGELOG.en.md' : null]
          .filter(Boolean)
          .join(' and ') +
        ': say what this release changes for the people using it, in both languages.',
    );
  }
  problems.push(...changelogProblems);
  if (!parseVersion(version)) {
    problems.push(`"${version ?? ''}" is not a version like 0.1.0 (numbers only).`);
  } else if (!isNewer(version, current) && !(rebuild && version === current)) {
    problems.push(
      version === current
        ? `${version} is the current version but was never released (no tag v${version}); release a newer one.`
        : `${version} is not newer than the current ${current}.`,
    );
  }
  if (branch !== 'main') {
    problems.push(`Releases are cut from main; this is ${branch}.`);
  }
  if (dirty) {
    problems.push('The working tree has uncommitted changes.');
  }
  if (behind > 0) {
    problems.push(`main is ${behind} commit(s) behind origin/main; pull first.`);
  }
  if (tagExists) {
    problems.push(`The tag for this build already exists.`);
  }
  return problems;
}

/**
 * The tag for the next build of `version`, given the tags that exist: `v1.0.0` for the first, then
 * `v1.0.0+2`, `v1.0.0+3`.
 */
export function nextTag(version, tags) {
  const base = `v${version}`;
  if (!tags.includes(base)) {
    return base;
  }
  const builds = tags
    .filter(tag => tag.startsWith(`${base}+`))
    .map(tag => Number(tag.slice(base.length + 1)))
    .filter(n => Number.isInteger(n) && n > 1);
  return `${base}+${Math.max(1, ...builds) + 1}`;
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function main() {
  const version = process.argv[2];
  const current = JSON.parse(readFileSync('package.json', 'utf8')).version;
  let changelog = null;
  const changelogProblems = [];
  try {
    changelog = {
      cs: parse(readFileSync(CHANGELOG_FILES.cs, 'utf8'), 'cs'),
      en: parse(readFileSync(CHANGELOG_FILES.en, 'utf8'), 'en'),
    };
    changelogProblems.push(...mismatches(changelog.cs, changelog.en).map(p => `The changelogs disagree: ${p}.`));
  } catch (err) {
    changelogProblems.push(`The changelog does not read: ${err.message}`);
  }

  git('fetch', '--quiet', '--tags', 'origin', 'main');
  const remoteTags = git('ls-remote', '--tags', 'origin', `refs/tags/v${version}*`)
    .split('\n')
    .map(line => line.split('refs/tags/')[1]?.replace(/\^\{\}$/, ''))
    .filter(Boolean);
  const tags = [...new Set([...git('tag', '--list', `v${version}*`).split('\n').filter(Boolean), ...remoteTags])];
  const rebuild = version === current && tags.includes(`v${version}`);
  const tag = nextTag(version, tags);
  const problems = releaseProblems({
    version,
    current,
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
    behind: Number(git('rev-list', '--count', 'HEAD..origin/main')),
    tagExists: false,
    rebuild,
    unreleased: { cs: count(changelog?.cs[0]), en: count(changelog?.en[0]) },
    changelogProblems,
  });
  if (problems.length > 0) {
    console.error('release: not releasing.');
    for (const p of problems) {
      console.error(`  - ${p}`);
    }
    console.error('\nUsage: npm run release -- <version>   (for example: npm run release -- 0.1.0)');
    process.exit(1);
  }

  console.log(
    rebuild
      ? `release: another build of ${version} (${tag}). Running npm run verify first…\n`
      : `release: ${current} → ${version}. Running npm run verify first…\n`,
  );
  execFileSync('npm', ['run', 'verify'], { stdio: 'inherit' });

  const today = new Date().toISOString().slice(0, 10);
  if (!rebuild) {
    execFileSync('npm', ['version', version, '--no-git-tag-version'], { stdio: 'inherit' });
    writeFileSync(APP_INFO, withAppVersion(readFileSync(APP_INFO, 'utf8'), version));
  }
  for (const lang of ['cs', 'en']) {
    const file = CHANGELOG_FILES[lang];
    const text = readFileSync(file, 'utf8');
    writeFileSync(file, rebuild ? folded(text, lang, version, today) : dated(text, version, today));
  }
  writeFileSync(
    CHANGELOG_GENERATED,
    generated(
      parse(readFileSync(CHANGELOG_FILES.cs, 'utf8'), 'cs'),
      parse(readFileSync(CHANGELOG_FILES.en, 'utf8'), 'en'),
    ),
  );

  git(
    'add',
    'package.json',
    'package-lock.json',
    APP_INFO,
    CHANGELOG_FILES.cs,
    CHANGELOG_FILES.en,
    CHANGELOG_GENERATED,
  );
  // A rebuild with nothing in Unreleased changes no file but the changelog's date - still a commit, so
  // the tag points at one that says what it is.
  git('commit', '--allow-empty', '-m', `Release ${tag}`);
  git('tag', '-a', tag, '-m', `Obálka ${version}`);
  // Atomic: the commit and the tag land together or not at all, so a tag can never point at a
  // commit that is missing from main.
  execFileSync('git', ['push', '--atomic', 'origin', 'HEAD:main', tag], { stdio: 'inherit' });

  console.log(`\nrelease: ${tag} pushed. The build runs at`);
  console.log('  https://github.com/dorhawk-software/obalka/actions/workflows/release.yml');
  console.log('TestFlight shows the iOS build once Apple has processed it, usually within half an hour.');
}

if (process.argv[1]?.endsWith('release.mjs')) {
  main();
}
