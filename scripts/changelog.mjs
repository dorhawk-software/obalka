#!/usr/bin/env node
// The changelog (spec 029): what changed in each release, written by hand for the people using
// Obálka, in both of its languages - CHANGELOG.md (Czech) and CHANGELOG.en.md (English), the same
// split as README and PRIVACY. Not generated from commits: those are written for developers.
//
// Every user-facing change adds an entry under "## Unreleased" in BOTH files, in the same commit.
// `npm run release` refuses an empty Unreleased and turns it into "## <version> (<date>)". From that one
// section come the GitHub release's text, the App Store's "What's New", TestFlight's "What to Test",
// Google Play's release notes, and the app's own What's new (built in, nothing fetched).
//
//   node scripts/changelog.mjs --check            both files well-formed, in step, and the app's copy current
//   node scripts/changelog.mjs --generate         write the app's copy (src/content/changelog.generated.ts)
//   node scripts/changelog.mjs --notes <version>  the GitHub release's text (Czech, then English)
//   node scripts/changelog.mjs --store <version> <cs|en> [--short]   plain text for a store; --short
//                                                 is the leads only, for Google Play's 500 characters

import { readFileSync, writeFileSync } from 'node:fs';

export const FILES = { cs: 'CHANGELOG.md', en: 'CHANGELOG.en.md' };
export const GENERATED = 'src/content/changelog.generated.ts';
export const UNRELEASED = 'Unreleased';
/** Google Play's limit for one language's release notes. */
export const PLAY_LIMIT = 500;

/**
 * The kinds of change, in the order a release lists them, and their headings in each language.
 * `underneath` is what the app is built on (a dependency's update): listed, but never a reason on its
 * own to interrupt anyone after an update.
 */
export const KINDS = [
  { key: 'new', cs: 'Nové', en: 'New' },
  { key: 'better', cs: 'Lepší', en: 'Better' },
  { key: 'changed', cs: 'Změněno', en: 'Changed' },
  { key: 'fixed', cs: 'Opraveno', en: 'Fixed' },
  { key: 'underneath', cs: 'Pod kapotou', en: 'Underneath' },
];

const VERSION_HEADING = /^## (\d+\.\d+\.\d+) \((\d{4}-\d{2}-\d{2})\)$/;
const ENTRY = /^\*\*(.+?)\*\*(?:\s+(.*))?$/s;

/**
 * One file as releases, newest first: `{ version, date, changes: { [kind]: [{ lead, body }] } }`.
 * Unreleased has `date: null`. Throws on anything a person would have to fix, saying where.
 */
export function parse(text, lang) {
  const releases = [];
  let release = null;
  let kind = null;
  let entry = null;
  const lines = text.split('\n');
  const fail = (n, why) => {
    throw new Error(`${FILES[lang]}:${n + 1}: ${why}`);
  };
  const close = () => {
    if (entry) {
      const m = ENTRY.exec(entry.text.trim());
      if (!m) {
        fail(entry.line, 'an entry starts with its point in bold: "- **What changed.** Why it matters."');
      }
      release.changes[kind].push({ lead: m[1].trim(), body: (m[2] ?? '').replace(/\s+/g, ' ').trim() });
      entry = null;
    }
  };
  let inComment = false;
  lines.forEach((line, n) => {
    if (inComment || line.startsWith('<!--')) {
      inComment = !line.includes('-->');
      return;
    }
    if (line.startsWith('## ')) {
      close();
      kind = null;
      if (line === `## ${UNRELEASED}`) {
        if (releases.length > 0) {
          fail(n, `"## ${UNRELEASED}" comes first, above every release`);
        }
        release = { version: UNRELEASED, date: null, changes: {} };
      } else {
        const m = VERSION_HEADING.exec(line);
        if (!m) {
          fail(n, `a release heading reads "## 1.2.3 (2026-11-10)" or "## ${UNRELEASED}"`);
        }
        release = { version: m[1], date: m[2], changes: {} };
      }
      releases.push(release);
      return;
    }
    if (line.startsWith('### ')) {
      close();
      if (!release) {
        fail(n, 'a kind of change belongs under a release heading');
      }
      const name = line.slice(4).trim();
      const found = KINDS.find(k => k[lang] === name);
      if (!found) {
        fail(n, `"${name}" is not a kind of change; use ${KINDS.map(k => `"${k[lang]}"`).join(', ')}`);
      }
      if (release.changes[found.key]) {
        fail(n, `"${name}" twice in ${release.version}`);
      }
      const order = Object.keys(release.changes).map(k => KINDS.findIndex(x => x.key === k));
      if (order.some(i => i > KINDS.indexOf(found))) {
        fail(n, `the kinds go in this order: ${KINDS.map(k => k[lang]).join(', ')}`);
      }
      kind = found.key;
      release.changes[kind] = [];
      return;
    }
    if (line.startsWith('- ')) {
      close();
      if (!kind) {
        fail(n, 'an entry belongs under a kind of change ("### ...")');
      }
      entry = { line: n, text: line.slice(2) };
      return;
    }
    if (entry && /^\s+\S/.test(line)) {
      entry.text += ` ${line.trim()}`;
      return;
    }
    close();
    if (release && line.trim() !== '') {
      fail(n, 'only kinds ("### ...") and entries ("- **...**") go inside a release');
    }
  });
  close();
  if (releases[0]?.version !== UNRELEASED) {
    throw new Error(`${FILES[lang]}: "## ${UNRELEASED}" is missing (it heads the file, even when empty)`);
  }
  for (const r of releases) {
    for (const [k, list] of Object.entries(r.changes)) {
      if (list.length === 0) {
        throw new Error(`${FILES[lang]}: ${r.version} has a "${KINDS.find(x => x.key === k)[lang]}" with nothing under it`);
      }
    }
  }
  const versions = releases.slice(1).map(r => r.version);
  for (let i = 1; i < versions.length; i++) {
    if (!isNewer(versions[i - 1], versions[i])) {
      throw new Error(`${FILES[lang]}: ${versions[i - 1]} is listed above ${versions[i]}; newest first`);
    }
  }
  return releases;
}

/** How many entries a release holds. */
export function count(release) {
  return Object.values(release?.changes ?? {}).reduce((n, list) => n + list.length, 0);
}

/**
 * Every way the two languages disagree. They must hold the same releases, on the same dates, with the
 * same kinds and the same number of entries in each: a person reading English is told exactly what a
 * person reading Czech is.
 */
export function mismatches(cs, en) {
  const problems = [];
  const shape = r => `${r.version} ${r.date ?? ''} ` + KINDS.map(k => `${k.key}:${r.changes[k.key]?.length ?? 0}`).join(' ');
  const a = cs.map(shape);
  const b = en.map(shape);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      problems.push(`${FILES.cs} has "${a[i] ?? 'nothing'}", ${FILES.en} "${b[i] ?? 'nothing'}"`);
    }
  }
  return problems;
}

/** `a` is newer than `b` (plain 1.2.3 versions). */
export function isNewer(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) {
      return x[i] > y[i];
    }
  }
  return false;
}

/** The file with "## Unreleased" turned into "## <version> (<date>)" and a fresh, empty one above it. */
export function dated(text, version, date) {
  const heading = `## ${UNRELEASED}\n`;
  if (!text.includes(heading)) {
    throw new Error(`no "## ${UNRELEASED}" to date`);
  }
  return text.replace(heading, `${heading}\n## ${version} (${date})\n`);
}

/** A release in Markdown, its kinds as headings at `level`. */
export function markdown(release, lang, level = '###') {
  return KINDS.filter(k => release.changes[k.key])
    .map(k => [`${level} ${k[lang]}`, '', ...release.changes[k.key].map(e => `- **${e.lead}**${e.body ? ` ${e.body}` : ''}`)].join('\n'))
    .join('\n\n');
}

/** The GitHub release's text: Czech, then English. */
export function notes(cs, en, version) {
  const a = cs.find(r => r.version === version);
  const b = en.find(r => r.version === version);
  if (!a || !b) {
    throw new Error(`no "## ${version} (<date>)" in ${!a ? FILES.cs : FILES.en}; every release is described before it is tagged`);
  }
  return `## Čeština\n\n${markdown(a, 'cs', '###')}\n\n---\n\n## English\n\n${markdown(b, 'en', '###')}\n`;
}

/**
 * Plain text for a store field, which shows no Markdown. Full: each kind in capitals and its entries
 * as bullets. Short (Google Play, 500 characters): the leads only.
 */
export function storeText(release, lang, short = false) {
  return KINDS.filter(k => release.changes[k.key])
    .map(k => {
      const lines = release.changes[k.key].map(e => `• ${e.lead}${!short && e.body ? ` ${e.body}` : ''}`);
      return short ? lines.join('\n') : `${k[lang].toUpperCase()}\n${lines.join('\n')}`;
    })
    .join(short ? '\n' : '\n\n');
}

/** The app's copy: every release (not Unreleased), both languages. */
export function generated(cs, en) {
  const released = list => list.filter(r => r.version !== UNRELEASED);
  const data = { cs: released(cs), en: released(en) };
  return `// GENERATED by scripts/changelog.mjs from CHANGELOG.md and CHANGELOG.en.md - DO NOT EDIT BY HAND.
// \`npm run release\` regenerates it; \`npm run changelog:check\` fails CI when it has drifted (spec 029).
//
// Released versions only: what is still under "Unreleased" has not reached anyone yet.

import type { Locale } from '../i18n/strings';

export type ChangeKind = ${KINDS.map(k => `'${k.key}'`).join(' | ')};

export interface ChangelogEntry {
  /** The point, in a sentence (bold in the changelog). */
  readonly lead: string;
  /** Why it matters, or how it works; may be empty. */
  readonly body: string;
}

export interface ChangelogRelease {
  readonly version: string;
  /** YYYY-MM-DD. */
  readonly date: string;
  readonly changes: Readonly<Partial<Record<ChangeKind, readonly ChangelogEntry[]>>>;
}

/** The kinds in the order a release lists them. */
export const CHANGE_KINDS: readonly ChangeKind[] = [${KINDS.map(k => `'${k.key}'`).join(', ')}];

/** Newest first, per language. */
export const CHANGELOG: Readonly<Record<Locale, readonly ChangelogRelease[]>> = ${JSON.stringify(data, null, 2)};
`;
}

function read() {
  return {
    cs: parse(readFileSync(FILES.cs, 'utf8'), 'cs'),
    en: parse(readFileSync(FILES.en, 'utf8'), 'en'),
  };
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const { cs, en } = read();
  const problems = mismatches(cs, en);
  if (problems.length > 0) {
    console.error('changelog: the two languages disagree.');
    problems.forEach(p => console.error(`  - ${p}`));
    process.exit(1);
  }
  if (cmd === '--check') {
    let current = '';
    try {
      current = readFileSync(GENERATED, 'utf8');
    } catch {
      // Reported below as drift.
    }
    if (current !== generated(cs, en)) {
      console.error(`changelog: ${GENERATED} is out of date. Run: npm run changelog`);
      process.exit(1);
    }
    for (const release of cs.slice(1)) {
      for (const [lang, list] of Object.entries({ cs, en })) {
        const text = storeText(list.find(r => r.version === release.version), lang, true);
        if (text.length > PLAY_LIMIT) {
          console.error(`changelog: ${release.version}'s leads in ${FILES[lang]} run to ${text.length} characters; Google Play takes ${PLAY_LIMIT}.`);
          process.exit(1);
        }
      }
    }
    console.log(`changelog: both languages in step, ${cs.length - 1} release(s), ${count(cs[0])} change(s) unreleased.`);
  } else if (cmd === '--generate') {
    writeFileSync(GENERATED, generated(cs, en));
    console.log(`changelog: wrote ${GENERATED}`);
  } else if (cmd === '--notes') {
    process.stdout.write(notes(cs, en, args[0]));
  } else if (cmd === '--store') {
    const [version, lang] = args;
    const release = { cs, en }[lang]?.find(r => r.version === version);
    if (!release) {
      console.error(`changelog: no ${version} in ${FILES[lang] ?? `"${lang}" (cs or en)`}`);
      process.exit(1);
    }
    process.stdout.write(`${storeText(release, lang, args.includes('--short'))}\n`);
  } else {
    console.error('usage: node scripts/changelog.mjs --check | --generate | --notes <version> | --store <version> <cs|en> [--short]');
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('changelog.mjs')) {
  main();
}
