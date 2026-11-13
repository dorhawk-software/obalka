// A button's words are in the body face at their weight (031, 2026-11-13). Tamagui's Button sets no
// face, so its label fell back to the system's - Roboto on Android - beside Public Sans everywhere
// else: seen on the SMS code's "Poslat SMS znovu" against board R8, and true of every Button in the
// app (the Mobile Key wait's "Zrušit", the term picker, compose). The field had the same fault and
// the same fix (`ui.tsx`, ThemedInput).

import { render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { Button } from '../../src/theme/ui';
import { fonts } from '../../src/theme/typeScale';

async function face(fontWeight?: string) {
  const view = await render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <Button chromeless fontWeight={fontWeight}>
        Zkusit znovu
      </Button>
    </TamaguiProvider>,
  );
  return JSON.stringify(view.getByText('Zkusit znovu').props.style);
}

describe('a button label', () => {
  it.each([
    ['700', fonts.bodyBold],
    ['600', fonts.bodySemiBold],
    ['500', fonts.bodyMedium],
    [undefined, fonts.bodyRegular],
  ])('at weight %s is in %s', async (weight, family) => {
    expect(await face(weight)).toContain(`"fontFamily":"${family}"`);
  });
});
