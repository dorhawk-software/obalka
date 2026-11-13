// Czech typesetting (031 I82, I83): a one-letter preposition or conjunction never ends a line, and a
// number never parts from its unit. Seen on the Settings walk beside board R13: "nastavení v" ended a
// line with "tomto telefonu" under it, which the board does not do and a Czech reader sees at once.
//
// The guard below reads every Czech string the app speaks through `t()`, and what the FAQ and the
// in-app changelog render, so a new string cannot bring the fault back.

import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { STRINGS_FOR_TEST, setActiveLocale, t } from '../../src/i18n/strings';
import { formatBytes, typesetCs, typesetFor } from '../../src/i18n/typeset';
import { FaqScreen } from '../../src/app/settings/FaqScreen';
import { ReleaseChanges } from '../../src/app/whatsNew/ReleaseChanges';
import { FAQ } from '../../src/content/faq';

const NBSP = ' ';

/** A one-letter Czech word followed by a plain space: the line may break after it. */
const LOOSE = /(^|[\s(„"'])([vkszouaiVKSZOUAI]) /;

/** Every string a rendered tree draws. */
function texts(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') {
    out.push(node);
  } else if (Array.isArray(node)) {
    node.forEach(child => texts(child, out));
  } else if (node && typeof node === 'object') {
    texts((node as { children?: unknown }).children ?? null, out);
  }
  return out;
}

const themed = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>{ui}</AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

afterEach(() => setActiveLocale('cs'));

describe('typesetCs', () => {
  it('holds a one-letter word to the word after it', () => {
    expect(typesetCs('nastavení v tomto telefonu')).toBe(`nastavení v${NBSP}tomto telefonu`);
    expect(typesetCs('V ostatních schránkách')).toBe(`V${NBSP}ostatních schránkách`);
    expect(typesetCs('(a také „k nim")')).toBe(`(a${NBSP}také „k${NBSP}nim")`);
  });

  it('holds two in a row, though the first takes the space the second matches after', () => {
    expect(typesetCs('soubory a v tomto')).toBe(`soubory a${NBSP}v${NBSP}tomto`);
  });

  it('leaves a letter that ends a longer word, and English, alone', () => {
    expect(typesetCs('jako s tím')).toBe(`jako s${NBSP}tím`);
    expect(typesetCs('ok tak')).toBe('ok tak');
    expect(typesetFor('en', 'a box in a phone')).toBe('a box in a phone');
  });
});

describe('formatBytes', () => {
  it('writes a size with the decimal comma, the number held to its unit', () => {
    expect(formatBytes(512)).toBe(`512${NBSP}B`);
    expect(formatBytes(1536)).toBe(`2${NBSP}kB`);
    expect(formatBytes(Math.round(1.4 * 1024 * 1024))).toBe(`1,4${NBSP}MB`);
  });
});

describe('what the app says in Czech', () => {
  it('never ends a line on a one-letter word, in any string', () => {
    setActiveLocale('cs');
    const loose = Object.keys(STRINGS_FOR_TEST.cs)
      .map(key => [key, t(key)] as const)
      .filter(([, said]) => LOOSE.test(said))
      .map(([key]) => key);
    expect(loose).toEqual([]);
  });

  it('nor in the FAQ', async () => {
    setActiveLocale('cs');
    const view = await themed(<FaqScreen onBack={() => {}} focus="diagnostics" />);
    await waitFor(() => expect(view.getByTestId('faq-diagnostics')).toBeTruthy());
    const drawn = texts(view.toJSON());
    expect(drawn).toContain(typesetCs(FAQ.cs.diagnostics.answer[0]));
    expect(drawn.filter(said => LOOSE.test(said))).toEqual([]);
  });

  it('nor in what a release changed', async () => {
    setActiveLocale('cs');
    const view = await themed(
      <ReleaseChanges
        withHeading={false}
        release={{
          version: '1.2.0',
          date: '2026-11-13',
          changes: { better: [{ lead: 'Záloha v telefonu', body: 'Uloží se k ostatním a zůstane i po aktualizaci.' }] },
        }}
      />,
    );
    expect(texts(view.toJSON()).filter(said => LOOSE.test(said))).toEqual([]);
    expect(view.getByText('Záloha v telefonu')).toBeTruthy();
  });
});
