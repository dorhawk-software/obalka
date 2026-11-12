// The lock screen as the board "Lock - sealed" draws it (031 T034, I50): the envelope sealed with wax,
// on the security tint, "Obálka je zapečetěná", and "Odemknout" at the bottom. What the lock DOES is in
// `LockGate.test.tsx`; these hold the drawing, in both themes, and the words.

import { render } from '@testing-library/react-native';
import { AppState, processColor } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { darkTheme, lightTheme } from '../../src/theme/theme';
import { objectShadow } from '../../src/theme/depth';
import { sealedEnvelope, securityTint } from '../../src/theme/print';
import { Text } from '../../src/theme/ui';
import { LockGate } from '../../src/app/lock/LockGate';
import { InMemoryVaultKeyStorage, Vault } from '../../src/services/secureStore/vault';
import { setActiveLocale } from '../../src/i18n/strings';

type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };
function nodes(root: unknown): Node[] {
  const out: Node[] = [];
  const walk = (n: Node | string) => {
    if (typeof n === 'string') {
      return;
    }
    out.push(n);
    (n.children ?? []).forEach(walk);
  };
  (Array.isArray(root) ? root : root ? [root] : []).forEach(walk);
  return out;
}
const brush = (color: string) => JSON.stringify({ type: 0, payload: processColor(color) });
const flat = (style: unknown): Record<string, unknown> =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : ((style ?? {}) as Record<string, unknown>);

// In the background the lock screen asks nothing, so the cover stays up to be looked at.
beforeEach(() => {
  (AppState as unknown as { currentState: string }).currentState = 'background';
});
afterEach(() => {
  (AppState as unknown as { currentState: string }).currentState = 'active';
  setActiveLocale('cs');
});

const mount = (isDark = false) => {
  const vault = new Vault({
    storage: new InMemoryVaultKeyStorage(),
    lockSetting: { read: async () => true, write: async () => {} },
  });
  return render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
        <AppThemeProvider isDark={isDark}>
          <LockGate enabled lock={vault}>
            <Text>SECRET-CONTENT</Text>
          </LockGate>
        </AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
};

describe.each([
  ['light', false, lightTheme],
  ['dark', true, darkTheme],
] as const)('%s', (_label, isDark, theme) => {
  it('holds up the envelope with its gold flap folded down, on the security tint', async () => {
    const view = await mount(isDark);
    const all = nodes(view.toJSON());
    expect(all.some(n => n.props.d === sealedEnvelope.flap && JSON.stringify(n.props.fill) === brush(theme.flap))).toBe(true);
    expect(all.some(n => n.props.d === securityTint.chevrons)).toBe(true);
    const tile = all.find(n => flat(n.props.style).borderRadius === sealedEnvelope.radius);
    expect(flat(tile?.props.style).backgroundColor).toBe(theme.envelope);
    expect(flat(tile?.props.style).boxShadow).toBe(objectShadow(theme.name, 'sealedEnvelope'));
  });

  it('seals it with wax lit from the top left, a padlock pressed into it', async () => {
    const view = await mount(isDark);
    const seal = flat(view.getByTestId('waxSeal', { includeHiddenElements: true }).props.style);
    expect(seal.experimental_backgroundImage).toBe(
      `radial-gradient(circle at 38% 32%, ${theme.sealLight}, ${theme.sealShade} 70%)`,
    );
    expect(seal.boxShadow).toBe(objectShadow(theme.name, 'seal'));
    const all = nodes(view.toJSON());
    expect(all.some(n => n.props.d === sealedEnvelope.seal.shackle)).toBe(true);
    expect(all.some(n => n.props.strokeDasharray != null && n.type === 'RNSVGCircle')).toBe(true);
  });
});

it('says the envelope is sealed, and what is under the lock', async () => {
  const view = await mount();
  expect(view.getByText('Obálka je zapečetěná')).toBeTruthy();
  expect(view.getByText('Zprávy i přihlášení jsou pod zámkem.')).toBeTruthy();
  expect(view.getByLabelText('Odemknout')).toBeTruthy();
  await view.unmount();
  setActiveLocale('en');
  const en = await mount();
  expect(en.getByText('Obálka is sealed')).toBeTruthy();
});

it('lets the centred words take the column, so Android keeps their last word', async () => {
  const view = await mount();
  expect(flat(view.getByText('Obálka je zapečetěná').props.style).alignSelf).toBe('stretch');
  expect(flat(view.getByText('Zprávy i přihlášení jsou pod zámkem.').props.style).alignSelf).toBe('stretch');
});

it('lays out the failure line before any attempt fails, so a failure moves nothing', async () => {
  const view = await mount();
  let host = view.getByText('Ověření se nezdařilo. Zkuste to znovu.', { includeHiddenElements: true }).parent;
  const styles: Record<string, unknown>[] = [];
  while (host) {
    styles.push(flat(host.props.style));
    host = host.parent;
  }
  // Invisible, but in the layout: hidden by opacity, never by `display: none`.
  expect(styles.some(st => st.display === 'none')).toBe(false);
  expect(styles.some(st => st.opacity === 0)).toBe(true);
});
