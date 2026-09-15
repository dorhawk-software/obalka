// A question asked from a specific control has to open at its answer.
//
// Reported from a device: "Co přesně se odesílá?" on the first-run consent card opened the FAQ at
// the top of a long page with every answer collapsed, leaving the reader to hunt for the one they
// had just asked for. On the screen where somebody is deciding whether to allow diagnostics at all,
// that is the difference between an informed answer and a shrug.
//
// The mechanism was already there and only this caller was not using it. `FaqScreen` takes a `focus`
// and both expands that answer and scrolls to it; every route that reaches the FAQ through the
// NAVIGATOR passes one. `AppShell`'s overlay held the FAQ in a BOOLEAN, so there was nowhere for the
// id to live and it rendered `<FaqScreen>` bare.
//
// Two halves, so a regression in either is caught: the screen honours `focus`, and the consent card
// is wired to a real id rather than to nothing.

import { readFileSync } from 'fs';
import { join } from 'path';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { FaqScreen } from '../../src/app/settings/FaqScreen';
import { FAQ, type FaqId } from '../../src/content/faq';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mount = async (focus?: FaqId) =>
  render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <FaqScreen onBack={() => {}} focus={focus} />
        </AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

/** The first paragraph of an answer, which is only on screen when that answer is expanded. */
const firstParagraph = (id: FaqId) => FAQ.cs[id].answer[0];

describe('FaqScreen focus', () => {
  it('opens the focused answer', async () => {
    const view = await mount('diagnostics');
    await waitFor(() => expect(view.getByTestId('faq-diagnostics')).toBeTruthy());
    expect(view.getByText(firstParagraph('diagnostics'))).toBeTruthy();
  });

  it('leaves the others closed, so focusing means something', async () => {
    const view = await mount('diagnostics');
    await waitFor(() => expect(view.getByTestId('faq-diagnostics')).toBeTruthy());
    expect(view.queryByText(firstParagraph('debugMode'))).toBeNull();
    expect(view.queryByText(firstParagraph('archive'))).toBeNull();
  });

  it('opens nothing when it was given nothing', async () => {
    // The general "Časté dotazy" row, which is a browse rather than a question.
    const view = await mount();
    await waitFor(() => expect(view.getByTestId('faq-diagnostics')).toBeTruthy());
    expect(view.queryByText(firstParagraph('diagnostics'))).toBeNull();
  });
});

describe('the consent card asks for its own answer', () => {
  // The wiring lives in AppShell, which is not mountable in isolation here; the id it passes is the
  // whole fix, and a boolean-shaped regression would put it back exactly as it was.
  const source = readFileSync(join(__dirname, '../../src/app/AppShell.tsx'), 'utf8');

  it('routes onExplain to a specific answer, not to the top of the page', () => {
    const call = /onExplain=\{\(\) => setFaq\('([a-zA-Z]+)'\)\}/.exec(source);
    expect(call).not.toBeNull();
    const id = call?.[1] as FaqId;
    expect(Object.keys(FAQ.cs)).toContain(id);
    // The answer that names what is sent, what is not, and where it goes.
    expect(id).toBe('diagnostics');
  });

  it('still lets the general help links open the FAQ at the top', () => {
    // Welcome and the sign-in flow are browsing, not asking, so they must NOT focus an answer.
    expect(source).toMatch(/onOpenFaq=\{\(\) => setFaq\('all'\)\}/);
  });
});
