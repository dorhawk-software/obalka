// A monogram is part of its object's drawing (031 I135).
//
// Walked 2026-11-15 at Android's largest text (2.0): the tiles and avatars keep their size, so their
// monograms spilled out of them ("IO" past the box's avatar) or were cut to one letter ("F" for FÚ in
// the register). The name beside each one scales, and is what a screen reader says; the monogram
// keeps the size it is drawn at.

import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { Avatar } from '../../src/theme/Avatar';
import { BoxStackTile, EnvelopeTile } from '../../src/theme/objects/Envelope';

const wrap = (child: ReactElement) => (
  <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
    <AppThemeProvider isDark={false}>{child}</AppThemeProvider>
  </TamaguiProvider>
);

const OBJECTS: [string, ReactElement][] = [
  ['the avatar', <Avatar name="Finanční úřad" />],
  ['the identity avatar', <Avatar name="Finanční úřad" size={40} />],
  ['the register tile (24)', <EnvelopeTile name="Finanční úřad" color="#2563A6" size={24} />],
  ['the sender tile (42)', <EnvelopeTile name="Finanční úřad" color="#2563A6" />],
  ['the box tile', <EnvelopeTile name="Finanční úřad" color="#2563A6" size={40} box />],
  ['the merged boxes\' stack', <BoxStackTile colors={['#2563A6', '#1F7A5C']} count={4} />],
];

type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };

const texts = (root: unknown): Node[] => {
  const out: Node[] = [];
  const walk = (n: Node | string) => {
    if (typeof n === 'string') {
      return;
    }
    if (n.type === 'Text') {
      out.push(n);
    }
    (n.children ?? []).forEach(walk);
  };
  (Array.isArray(root) ? root : root ? [root] : []).forEach(walk);
  return out;
};

it.each(OBJECTS)('%s keeps its monogram at the size it is drawn', async (_name, object) => {
  const view = await render(wrap(object));
  const found = texts(view.toJSON());
  expect(found.length).toBeGreaterThan(0);
  expect(found.map(n => n.props.maxFontSizeMultiplier)).toEqual(found.map(() => 1));
});
