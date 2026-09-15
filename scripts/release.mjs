#!/usr/bin/env node
// Cut a release: one command sets the version where it is kept, commits, tags and pushes. The tag is
// what `.github/workflows/release.yml` builds and ships - iOS to TestFlight, Android to Google Play's
// internal testing. Setup and the rest of the story: docs/release-ci.md.
//
//   npm run release -- 0.1.0
//
// It refuses rather than guesses. A dirty tree, a branch other than main, a main behind origin, a
// version that does not go up, or a tag that already exists all stop it before anything is written.
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

/** Every reason not to release now, in the order a person would want to fix them. Empty = go. */
export function releaseProblems({ version, current, branch, dirty, behind, tagExists }) {
  const problems = [];
  if (!parseVersion(version)) {
    problems.push(`"${version ?? ''}" is not a version like 0.1.0 (numbers only).`);
  } else if (!isNewer(version, current)) {
    problems.push(`${version} is not newer than the current ${current}.`);
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
    problems.push(`The tag v${version} already exists.`);
  }
  return problems;
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function main() {
  const version = process.argv[2];
  const current = JSON.parse(readFileSync('package.json', 'utf8')).version;

  git('fetch', '--quiet', '--tags', 'origin', 'main');
  const problems = releaseProblems({
    version,
    current,
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
    behind: Number(git('rev-list', '--count', 'HEAD..origin/main')),
    tagExists:
      git('tag', '--list', `v${version}`) !== '' ||
      git('ls-remote', '--tags', 'origin', `refs/tags/v${version}`) !== '',
  });
  if (problems.length > 0) {
    console.error('release: not releasing.');
    for (const p of problems) {
      console.error(`  - ${p}`);
    }
    console.error('\nUsage: npm run release -- <version>   (for example: npm run release -- 0.1.0)');
    process.exit(1);
  }

  console.log(`release: ${current} → ${version}. Running npm run verify first…\n`);
  execFileSync('npm', ['run', 'verify'], { stdio: 'inherit' });

  execFileSync('npm', ['version', version, '--no-git-tag-version'], { stdio: 'inherit' });
  writeFileSync(APP_INFO, withAppVersion(readFileSync(APP_INFO, 'utf8'), version));

  git('add', 'package.json', 'package-lock.json', APP_INFO);
  git('commit', '-m', `Release v${version}`);
  git('tag', '-a', `v${version}`, '-m', `Obálka ${version}`);
  // Atomic: the commit and the tag land together or not at all, so a tag can never point at a
  // commit that is missing from main.
  execFileSync('git', ['push', '--atomic', 'origin', 'HEAD:main', `v${version}`], { stdio: 'inherit' });

  console.log(`\nrelease: v${version} pushed. The build runs at`);
  console.log('  https://github.com/dorhawk-software/obalka/actions/workflows/release.yml');
  console.log('TestFlight shows the iOS build once Apple has processed it, usually within half an hour.');
}

if (process.argv[1]?.endsWith('release.mjs')) {
  main();
}
