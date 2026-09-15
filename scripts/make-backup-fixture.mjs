#!/usr/bin/env node
// Make a golden backup fixture by running the app as it stood when that schema version was current
// (006 T028).
//
//   node scripts/make-backup-fixture.mjs --ref <commit> --version <n>
//
// `--ref` is any commit whose `BACKUP_SCHEMA_VERSION` equals `--version`; the script checks that and
// refuses otherwise, because the one mistake that would make the whole exercise pointless is
// generating today's bytes and filing them under an older number.
//
// WHY A WORKTREE rather than copying a few files out of git: the payload writer does not stand
// alone. It pulls in the schema, the UTF-8 codec, the envelope and whatever babel and jest config
// the repo had at the time. A worktree gives all of that at once, exactly as it was, and `git
// worktree remove` takes it away again. Only `node_modules` is borrowed from the current checkout -
// a historical install is not worth twenty minutes, and nothing the generator touches is a
// dependency that has moved.
//
// The fixture is written ONCE and committed. This script exists so that "where did these bytes come
// from" has an answer better than somebody's memory.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, symlinkSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

const ref = arg('ref');
const version = Number(arg('version'));
if (!ref || !Number.isInteger(version)) {
  console.error('usage: make-backup-fixture.mjs --ref <commit> --version <n>');
  process.exit(2);
}

// The check that makes the label trustworthy.
const schemaAtRef = git('show', `${ref}:src/services/backup/schema.ts`);
const declared = /BACKUP_SCHEMA_VERSION = (\d+)/.exec(schemaAtRef)?.[1];
if (Number(declared) !== version) {
  console.error(
    `${ref} declares BACKUP_SCHEMA_VERSION ${declared}, not ${version}. ` +
      'A fixture is only worth having if it was written by the version it claims.',
  );
  process.exit(1);
}

const worktree = join(root, '.fixture-worktree');
const out = join(root, '__tests__', 'backup', 'fixtures', `schema-v${version}.obalka`);
mkdirSync(dirname(out), { recursive: true });

if (existsSync(worktree)) {
  git('worktree', 'remove', '--force', worktree);
}
console.log(`checking out ${ref} into ${worktree}`);
git('worktree', 'add', '--detach', worktree, ref);

try {
  symlinkSync(join(root, 'node_modules'), join(worktree, 'node_modules'), 'dir');
  const dest = join(worktree, '__tests__', 'backup', 'writeFixture.test.ts');
  copyFileSync(join(root, 'scripts', 'fixtures', 'writeFixture.test.ts'), dest);
  execFileSync(
    'npx',
    ['jest', '--ci', '--runTestsByPath', dest],
    {
      cwd: worktree,
      stdio: 'inherit',
      env: { ...process.env, FIXTURE_OUT: out },
    },
  );
  console.log(`\n${out}`);
  console.log(`written by ${git('rev-parse', '--short', ref)} — record that in the README.`);
} finally {
  // unlink, not rm: this is a SYMLINK to the real node_modules, and `rmSync` on a link to a
  // directory refuses - which on the first run left the borrowed tree still attached to a worktree
  // about to be deleted.
  unlinkSync(join(worktree, 'node_modules'));
  git('worktree', 'remove', '--force', worktree);
}
