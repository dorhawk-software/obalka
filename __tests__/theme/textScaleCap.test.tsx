// Text grows with the reader's setting up to twice its size, and no further (031 I135).
//
// Walked 2026-11-15: Android's largest text is 2.0, and every screen was walked and fixed at it. iOS's
// largest accessibility size is about 3x; there, on the first screen, the segmented labels and the
// Compose stamp were cut in their drawn frames and the password strip's words were squeezed to
// nothing beside its action. The app stops at Android's largest on both platforms: the size it is
// walked at. Growing every drawn part to 3x is not now (docs/engineering/not-now.md).

import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { Body, Caption, Day, Overline, Title } from '../../src/theme/Typography';
import { Button, Input } from '../../src/theme/ui';
import { MAX_TEXT_SCALE } from '../../src/theme/typeScale';

const wrap = (child: ReactElement) => (
  <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
    <AppThemeProvider isDark={false}>{child}</AppThemeProvider>
  </TamaguiProvider>
);

it('stops at Android\'s largest text, twice the size', () => {
  expect(MAX_TEXT_SCALE).toBe(2);
});

it.each([
  ['a type role', <Body>Zpráva</Body>],
  ['a title', <Title>Zpráva</Title>],
  ['a caption', <Caption>Zpráva</Caption>],
  ['an overline', <Overline>Zpráva</Overline>],
  ['the day', <Day>10</Day>],
  ['a button\'s words', <Button>Zpráva</Button>],
])('%s grows no further than that', async (_name, element) => {
  const view = await render(wrap(element));
  expect(view.getByText(/Zpráva|10/)).toHaveProp('maxFontSizeMultiplier', MAX_TEXT_SCALE);
});

it('a field grows no further than that', async () => {
  const view = await render(wrap(<Input testID="field" placeholder="Jméno" />));
  expect(view.getByTestId('field')).toHaveProp('maxFontSizeMultiplier', MAX_TEXT_SCALE);
});

it('a part of a drawing keeps the cap it asks for', async () => {
  const view = await render(wrap(<Body maxFontSizeMultiplier={1}>OD</Body>));
  expect(view.getByText('OD')).toHaveProp('maxFontSizeMultiplier', 1);
});

// Walked 2026-11-15: the cap first went in as a wrapper around Tamagui's Text, and on Android the text
// set inside other text went blank - the message envelope's recipient read "Ing. Ondřej", its surname
// and box ID missing with their space kept. The cap lives in the roles; the Text is Tamagui's own.
it('leaves the Text the roles draw with as Tamagui\'s own component', () => {
  const { Text: Tamagui } = jest.requireActual<typeof import('tamagui')>('tamagui');
  expect(require('../../src/theme/ui').Text).toBe(Tamagui);
});
