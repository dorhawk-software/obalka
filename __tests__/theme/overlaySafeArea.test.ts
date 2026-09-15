// Nothing drawn over the whole screen may reach under the system bars (2026-10-04).
//
// The box editor, opened with its keyboard up, rose under the status bar: it was centred with plain
// padding in a modal drawn under the bar. An audit the same day found the same gap five more times -
// every sheet padded its bottom for the home indicator and nothing capped its top, the lock screen
// ignored both bars, and the QR scanner's Cancel sat under the gesture bar. These rules hold every
// overlay to both edges, so the next one cannot forget one.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { createElement, type ReactNode } from 'react';
import { Dimensions } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSheetMaxHeight } from '../../src/theme/useSheetMaxHeight';
import { space } from '../../src/theme/spacing';

const ROOT = join(__dirname, '../..');
const SRC = join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, out);
    } else if (name.endsWith('.tsx')) {
      out.push(path);
    }
  }
  return out;
}

const files = walk(SRC).map(path => ({ path: relative(ROOT, path), text: readFileSync(path, 'utf8') }));

describe('a modal', () => {
  const modals = files.filter(f => /<Modal\b/.test(f.text));

  it('exists to be checked', () => {
    expect(modals.length).toBeGreaterThan(3);
  });

  it('clears the home indicator', () => {
    expect(modals.filter(f => !/insets\.bottom/.test(f.text)).map(f => f.path)).toEqual([]);
  });

  it('stops below the status bar - a sheet by useSheetMaxHeight, anything else by insets.top', () => {
    expect(
      modals.filter(f => !/useSheetMaxHeight\(\)|insets\.top/.test(f.text)).map(f => f.path),
    ).toEqual([]);
  });

  it('does not raise a keyboard the moment it opens', () => {
    // The box editor did: the keyboard took half the screen before anyone chose to type, and pushed the
    // dialog up into the status bar. A field in a modal is focused by the person.
    expect(
      modals
        .filter(f => /<(TextInput|Input)\b[^>]*\bautoFocus\b/.test(f.text.replace(/\/\/.*$/gm, '')))
        .map(f => f.path),
    ).toEqual([]);
  });
});

describe('a bar pinned to the bottom of the screen', () => {
  it('clears the home indicator', () => {
    // `position="absolute" … bottom={0} left={0} right={0}` without `top={0}` is a bar along the bottom
    // edge; whatever it holds sits on the gesture bar unless its padding starts past the inset.
    const offenders: string[] = [];
    for (const f of files) {
      for (const m of f.text.matchAll(/<(?:XStack|YStack|View)\b([^>]*?)>/gs)) {
        const props = m[1];
        const isBottomBar =
          /position="absolute"/.test(props) &&
          /\bbottom=\{0\}/.test(props) &&
          /\bleft=\{0\}/.test(props) &&
          /\bright=\{0\}/.test(props) &&
          !/\btop=\{/.test(props);
        if (isBottomBar && !/insets\.bottom|contentBottom|useContentBottom/.test(props)) {
          offenders.push(`${f.path}:${f.text.slice(0, m.index).split('\n').length}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('useSheetMaxHeight', () => {
  it('is the window less the status bar and a section of dim above the sheet', async () => {
    const metrics = {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    };
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(SafeAreaProvider, { initialMetrics: metrics }, children);
    const { result } = await renderHook(() => useSheetMaxHeight(), { wrapper });
    expect(result.current).toBe(Dimensions.get('window').height - 47 - space.section);
  });
});
