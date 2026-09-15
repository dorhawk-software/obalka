// The dependency-audit gate (2026-08-20).
//
// `npm audit` reports on the lockfile, and for a React Native app most of the lockfile is build
// tooling that never reaches a phone. A gate that fails on all of it trains everyone to ignore the
// audit; a gate that only matches package NAMES reports false positives on the packages that matter
// most. So the rule is "the copy that ships is the vulnerable copy", and this suite drives it with
// the real cases - including the one that made the rule necessary.
//
// The failing path is tested deliberately: a guard whose failure has never been seen is a guard
// nobody has checked.

import { classify } from '../../scripts/audit-shipped.mjs';

const advisory = (title: string) => ({ title, url: `https://x/${title}` });

/** The shape npm audit hands back, trimmed to what `classify` reads. */
const vuln = (over: Record<string, unknown> = {}) => ({
  severity: 'high',
  via: [advisory('boom')],
  nodes: ['node_modules/pkg'],
  ...over,
});

const lock = (versions: Record<string, string>) => (path: string) =>
  versions[path] ?? null;

describe('the shipped-only audit gate', () => {
  it('fails when the copy that ships is the vulnerable one', () => {
    const out = classify({
      vulnerabilities: { nanoid: vuln({ nodes: ['node_modules/nanoid'] }) },
      shipped: new Map([['nanoid', '3.3.12']]),
      lockVersion: lock({ 'node_modules/nanoid': '3.3.12' }),
    });
    expect(out.reaching.map(r => r.name)).toEqual(['nanoid']);
    expect(out.failures).toHaveLength(1);
  });

  // The case the rule was written for. This app parses ISDS SOAP with fast-xml-parser, so a name-only
  // check would scream about its most security-relevant parser - while the vulnerable copy was the
  // RN CLI's, and the copy in the app was already patched. The lockfile no longer holds that copy and
  // npm audit no longer reports the advisory; the scenario stays because the rule still has to hold.
  it('does not blame a shipped package for a vulnerable copy it does not use', () => {
    const out = classify({
      vulnerabilities: {
        'fast-xml-parser': vuln({
          severity: 'moderate',
          nodes: [
            'node_modules/@react-native-community/cli-config-android/node_modules/fast-xml-parser',
          ],
        }),
      },
      shipped: new Map([['fast-xml-parser', '5.8.0']]),
      lockVersion: lock({
        'node_modules/@react-native-community/cli-config-android/node_modules/fast-xml-parser':
          '4.5.6',
      }),
    });
    expect(out.reaching).toEqual([]);
    expect(out.failures).toEqual([]);
    expect(out.buildTimeOnly[0]).toMatchObject({
      name: 'fast-xml-parser',
      shippedVersion: '5.8.0',
      vulnerableVersions: ['4.5.6'],
    });
  });

  it('ignores build tooling the app never bundles', () => {
    const out = classify({
      vulnerabilities: { metro: vuln({ nodes: ['node_modules/metro'] }) },
      shipped: new Map([['react-native', '0.86.0']]),
      lockVersion: lock({ 'node_modules/metro': '0.84.4' }),
    });
    expect(out.reaching).toEqual([]);
    expect(out.buildTimeOnly.map(b => b.name)).toEqual(['metro']);
  });

  it('fails OPEN when npm reports no install paths', () => {
    // An audit gate that goes quiet because a field was missing is worse than no gate.
    const out = classify({
      vulnerabilities: { pkg: vuln({ nodes: [] }) },
      shipped: new Map([['pkg', '1.0.0']]),
      lockVersion: lock({}),
    });
    expect(out.failures).toHaveLength(1);
  });

  it('skips the rollup entries that only point at another package', () => {
    // npm lists "depends on something vulnerable" entries whose `via` is just a name; counting them
    // would double-report the advisory that is already attributed to the package itself.
    const out = classify({
      vulnerabilities: {
        wrapper: { severity: 'high', via: ['inner'], nodes: ['node_modules/wrapper'] },
      },
      shipped: new Map([['wrapper', '1.0.0']]),
      lockVersion: lock({ 'node_modules/wrapper': '1.0.0' }),
    });
    expect(out.reaching).toEqual([]);
    expect(out.buildTimeOnly).toEqual([]);
  });

  it('reports a low-severity shipped advisory without failing the build', () => {
    const out = classify({
      vulnerabilities: { pkg: vuln({ severity: 'low' }) },
      shipped: new Map([['pkg', '1.0.0']]),
      lockVersion: lock({ 'node_modules/pkg': '1.0.0' }),
    });
    expect(out.reaching).toHaveLength(1);
    expect(out.failures).toEqual([]);
  });
});
