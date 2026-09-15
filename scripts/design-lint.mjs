#!/usr/bin/env node
// The design-system lint, held to a baseline that may only shrink (spec 028).
//
//   npm run lint:design            check: fails on any new finding, and on a baseline that is stale
//   npm run lint:design -- --all   print every finding, baseline or not
//   npm run lint:design -- --update  lower the baseline to today's counts (refuses to raise it)
//
// The obalka/* rules (tools/eslint-plugin-obalka) found ~750 places on the day they were written, so
// they could not land as plain errors. Instead every file's count per rule is recorded in
// design-lint-baseline.json. A count that RISES fails - new code is held to the system from day one -
// and its findings are printed in full, each message carrying the fix. A count that FALLS also fails
// until the baseline is lowered, so the ratchet tightens itself and never quietly loosens. When the
// baseline is empty the rules move into .eslintrc.js as ordinary errors and this script goes.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { ESLint } = require('eslint');
const plugin = require('../tools/eslint-plugin-obalka');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(root, 'design-lint-baseline.json');
const args = new Set(process.argv.slice(2));

const eslint = new ESLint({
  cwd: root,
  useEslintrc: false,
  plugins: { obalka: plugin },
  overrideConfig: {
    parser: '@typescript-eslint/parser',
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    plugins: ['obalka'],
    rules: Object.fromEntries(Object.keys(plugin.rules).map(r => [`obalka/${r}`, 'error'])),
  },
});

const results = await eslint.lintFiles(['src/**/*.ts', 'src/**/*.tsx']);
const counts = {};
const findings = {};
for (const r of results) {
  const file = relative(root, r.filePath);
  for (const m of r.messages) {
    if (!m.ruleId) {
      console.error(`${file}:${m.line}: ${m.message}`); // a parse error is a broken gate, not a finding
      process.exitCode = 2;
      continue;
    }
    if (!m.ruleId.startsWith('obalka/')) {
      continue; // an eslint-disable comment naming a rule this run does not load - .eslintrc's business
    }
    const rule = m.ruleId.replace('obalka/', '');
    ((counts[file] ??= {})[rule] ??= 0);
    counts[file][rule] += 1;
    ((findings[file] ??= {})[rule] ??= []).push(m);
  }
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const print = (file, rule) => {
  for (const m of findings[file][rule]) {
    console.log(`\n${file}:${m.line}:${m.column}  obalka/${rule}\n${m.message.replace(/^/gm, '  ')}`);
  }
};

const rose = [];
const fell = [];
for (const file of new Set([...Object.keys(counts), ...Object.keys(baseline)])) {
  for (const rule of new Set([...Object.keys(counts[file] ?? {}), ...Object.keys(baseline[file] ?? {})])) {
    const now = counts[file]?.[rule] ?? 0;
    const was = baseline[file]?.[rule] ?? 0;
    if (now > was) {
      rose.push([file, rule, was, now]);
    } else if (now < was) {
      fell.push([file, rule, was, now]);
    }
  }
}

const sorted = obj =>
  Object.fromEntries(Object.keys(obj).sort().map(f => [f, Object.fromEntries(Object.keys(obj[f]).sort().map(r => [r, obj[f][r]]))]));
const total = obj => Object.values(obj).reduce((n, rules) => n + Object.values(rules).reduce((a, b) => a + b, 0), 0);

if (args.has('--all')) {
  for (const file of Object.keys(findings).sort()) {
    for (const rule of Object.keys(findings[file])) {
      print(file, rule);
    }
  }
}

if (args.has('--update')) {
  if (rose.length && !args.has('--init')) {
    console.error('Refusing to raise the baseline. These counts went up - fix the new findings instead:');
    for (const [file, rule, was, now] of rose) {
      console.error(`  ${file}  obalka/${rule}: ${was} → ${now}`);
    }
    process.exit(1);
  }
  writeFileSync(BASELINE, `${JSON.stringify(sorted(counts), null, 2)}\n`);
  console.log(`design-lint-baseline.json: ${total(counts)} findings left (was ${total(baseline)}).`);
  process.exit(process.exitCode ?? 0);
}

if (rose.length) {
  console.log('New design-system findings - each message says how to fix it:');
  for (const [file, rule] of rose) {
    print(file, rule);
  }
  console.log(`\n✗ ${rose.length} file/rule count(s) rose above design-lint-baseline.json. Fix them; the baseline only shrinks.`);
  process.exitCode = 1;
}
if (fell.length) {
  console.log('\nFewer findings than the baseline records - lower it so they cannot come back:');
  for (const [file, rule, was, now] of fell) {
    console.log(`  ${file}  obalka/${rule}: ${was} → ${now}`);
  }
  console.log('Run: npm run lint:design -- --update');
  process.exitCode = 1;
}
if (!rose.length && !fell.length) {
  console.log(`✓ design lint: no new findings (${total(counts)} left in the baseline).`);
}
