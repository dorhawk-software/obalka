// Dependency advisories, filtered to what actually reaches a user's phone (dev-time only).
//
// `npm audit` reports on the lockfile, and for a React Native app most of the lockfile is BUILD
// tooling: Metro, the RN CLI, their transitive tree. Those run on a developer's machine and on the CI
// runner; they are not in the APK or the IPA. Failing a build on them teaches everyone to ignore the
// audit, which is worse than not running one.
//
// So this splits the report in two, using the list the Licence screen already depends on
// (`attributions.generated.ts`, kept honest by `npm run attributions:check`): the packages that are
// genuinely bundled, counted on every run. An advisory fails the build only when a VULNERABLE COPY IS
// THE SHIPPED COPY.
//
// That distinction is not pedantry, and the case that forced it was the app's own XML parser. When
// this gate was written, `fast-xml-parser` had a moderate advisory and this app parses ISDS SOAP with
// it - but the vulnerable copy was 4.5.6, pulled in by the RN CLI, while the copy that ships was 5.8.0
// and patched. Comparing names alone would have reported a scary false positive on the app's most
// security-relevant parser; comparing the installed VERSION of each vulnerable node against the
// shipped version answers the real question. That advisory is history: the CLI's
// `cli-config-android` and `cli-platform-apple` now ask for `^5.3.6`, the lockfile holds 5.8.0 alone,
// and on 2026-09-15 `npm audit` reported no advisory records at all. The scenario stays pinned in
// __tests__/scripts/auditShipped.test.ts.
//
// WHAT THIS CANNOT SEE, and says so on every run: npm audit knows package names in a lockfile.
// It does not know about native dependencies (SQLCipher, OpenSSL, Play Services - CocoaPods and
// Gradle), and it does not know about code VENDORED INSIDE a package. `unpdf` ships pdf.js compiled
// into its own bundle; an advisory against pdf.js produces no npm audit output at all. Those
// components are listed at the end so the gap is visible rather than assumed away.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const LOCK = 'package-lock.json';
const GENERATED = 'src/content/attributions.generated.ts';

/** Severities that fail the build when they reach a shipped package. */
const FAILING = new Set(['moderate', 'high', 'critical']);

/**
 * Advisories in shipped code that are accepted, with the argument written down.
 *
 * Every audit gate meets an advisory with no fix eventually, and what happens next decides whether
 * the gate survives: silence it and it protects nothing, fail forever and someone deletes it. So an
 * exception is allowed - and each one must carry a `voidWhen` that re-checks the ARGUMENT on every
 * run, not merely restate it. When the reasoning stops holding, the build fails with the reason
 * rather than quietly staying green.
 *
 * Empty since 2026-09-14. Its one entry, decode-uri-component (GHSA-vcc3-ghjq-m6fr), was accepted
 * because the app gives react-navigation's URL parser no input; 0.5.0 then fixed it, and the fix is
 * now shipped instead (an `overrides` entry plus patches/query-string+7.1.3.patch), so the argument
 * no longer has to keep holding.
 */
const ACCEPTED = [];

function npmAudit() {
  try {
    // npm exits non-zero when it finds anything, which is not an error for us.
    return JSON.parse(
      execFileSync('npm', ['audit', '--json'], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      }),
    );
  } catch (e) {
    if (e.stdout) {
      return JSON.parse(e.stdout);
    }
    throw e;
  }
}

/** name -> version, for every npm package the app actually bundles. */
function shippedVersions() {
  const src = readFileSync(GENERATED, 'utf8');
  const groups = JSON.parse(
    src.match(/ATTRIBUTION_GROUPS[^=]*=\s*(\[.*?\]);/s)[1],
  );
  const out = new Map();
  for (const group of groups) {
    for (const c of group.components) {
      out.set(c.name, c.version);
    }
  }
  return out;
}

/** The bundled non-npm components - the ones no lockfile scanner can reach. */
function bundledComponents() {
  const src = readFileSync(GENERATED, 'utf8');
  return JSON.parse(src.match(/BUNDLED_COMPONENTS[^=]*=\s*(\[.*?\]);/s)[1]);
}

/** Installed version at a lockfile path, e.g. "node_modules/foo/node_modules/bar". */
function versionAt(lock, path) {
  return lock.packages?.[path]?.version ?? null;
}

/**
 * Split advisories into "the copy that ships is affected" and "build tooling only".
 *
 * Pure, and exported, so the FAILING path can be tested - a guard whose failure mode is never
 * exercised is a guard nobody has checked. `lockVersion` resolves an install path to its version.
 */
export function classify({ vulnerabilities, shipped, lockVersion }) {
  const reaching = [];
  const buildTimeOnly = [];
  for (const [name, v] of Object.entries(vulnerabilities ?? {})) {
    // Only advisories against the package itself; the rest are "depends on a vulnerable thing"
    // rollups that double-count what is already listed under the package that has the advisory.
    const direct = (v.via ?? []).filter(x => typeof x === 'object');
    if (direct.length === 0) {
      continue;
    }
    const shippedVersion = shipped.get(name);
    const vulnerableVersions = [
      ...new Set((v.nodes ?? []).map(lockVersion).filter(Boolean)),
    ];
    // No node versions at all (npm sometimes omits them) is treated as "assume it reaches" - an
    // audit gate that fails open is not a gate.
    const shippedCopyIsVulnerable =
      shippedVersion != null &&
      (vulnerableVersions.length === 0 ||
        vulnerableVersions.includes(shippedVersion));

    const entry = {
      name,
      severity: v.severity,
      shippedVersion,
      vulnerableVersions,
      advisories: direct.map(a => ({ title: a.title, url: a.url })),
    };
    (shippedCopyIsVulnerable ? reaching : buildTimeOnly).push(entry);
  }
  return {
    reaching,
    buildTimeOnly,
    failures: reaching.filter(r => FAILING.has(r.severity)),
  };
}

// --- CLI ---------------------------------------------------------------------------------------
// Importing this module for the tests must not run npm; only the direct invocation does.
if (process.argv[1]?.endsWith('audit-shipped.mjs')) {
  main();
}

function main() {
const audit = npmAudit();
const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
const shipped = shippedVersions();
const { reaching, buildTimeOnly, failures } = classify({
  vulnerabilities: audit.vulnerabilities,
  shipped,
  lockVersion: path => versionAt(lock, path),
});

console.log(
  `audit-shipped: ${
    Object.keys(audit.vulnerabilities ?? {}).length
  } advisory records; ${shipped.size} packages ship in the app.`,
);

if (reaching.length > 0) {
  console.log('\nREACHES THE APP:');
  for (const r of reaching) {
    console.log(`  ${r.name}@${r.shippedVersion}  [${r.severity}]`);
    for (const a of r.advisories) {
      console.log(`    ${a.title}\n      ${a.url}`);
    }
  }
} else {
  console.log('\nNothing that ships is affected.');
}

if (buildTimeOnly.length > 0) {
  console.log('\nBuild tooling only (not in the APK/IPA):');
  for (const b of buildTimeOnly) {
    const where =
      b.shippedVersion != null
        ? `ships ${b.shippedVersion}, vulnerable copy ${b.vulnerableVersions.join(', ')}`
        : b.severity;
    console.log(`  ${b.name} - ${where}`);
  }
}

console.log('\nNOT COVERED by npm audit - check these by hand when an advisory lands:');
for (const c of bundledComponents()) {
  console.log(`  ${c.name} ${c.version} (${c.kindEn})`);
}

// An accepted advisory still has to justify itself on every run.
const accepted = [];
const unresolved = [];
for (const f of failures) {
  const entry = ACCEPTED.find(a => a.name === f.name);
  if (!entry) {
    unresolved.push(f);
    continue;
  }
  const voided = entry.voidWhen();
  if (voided) {
    console.error(
      `\naudit-shipped: the acceptance for ${f.name} NO LONGER HOLDS - ${voided}`,
    );
    unresolved.push(f);
  } else {
    accepted.push({ ...f, why: entry.why, url: entry.url });
  }
}

if (accepted.length > 0) {
  console.log('\nAccepted, argument re-checked this run:');
  for (const a of accepted) {
    console.log(`  ${a.name}@${a.shippedVersion} [${a.severity}] - ${a.url}`);
    console.log(`    ${a.why}`);
  }
}

if (unresolved.length > 0) {
  console.error(
    `\naudit-shipped: FAIL - ${unresolved.length} advisory(ies) at ${[...FAILING].join('/')} in shipped code.`,
  );
  process.exit(1);
}
console.log('\naudit-shipped: OK');
}
