// The received message's envelope (031, board "Message - the envelope it came in"): who sent it on
// the envelope's blue, struck with a postmark of the moment ISDS delivered it; who it is for in the
// window; the subject on the sheet sliding out of it. These hold that each fact lands on its object,
// that the window falls back to the box it arrived in, and that the sheet only counts the attachments
// once it knows them.

import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { darkTheme, lightTheme } from '../../src/theme/theme';
import { objectShadow } from '../../src/theme/depth';
import { setActiveLocale } from '../../src/i18n/strings';
import { DetailEnvelope, dayMonth } from '../../src/features/messages/screens/DetailEnvelope';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';

const DELIVERED = new Date(2026, 7, 19, 9, 41).getTime();

const envelope: MessageEnvelope = {
  id: '1234567',
  subject: 'Výzva k doplnění podání',
  sender: 'Magistrát města Kotlina',
  senderAddress: 'Náměstí Míru 1, 100 00 Kotlina',
  recipient: 'Jana Nováková',
  recipientAddress: null,
  recipientBoxId: 'ab12cd3',
  deliveryTime: DELIVERED,
  acceptanceTime: null,
  state: 5,
  attachmentSize: 1,
};

const account = {
  id: 'b1',
  boxId: 'zz98yx7',
  loginName: 'user',
  label: 'Domácí schránka',
  dbType: null,
  alias: null,
  authMethod: 'password',
  host: 'production',
  secretRef: 'ref',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 0,
  updatedAt: 0,
} as DataBoxAccount;

type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };
function strings(root: unknown): string[] {
  const out: string[] = [];
  const walk = (n: Node | string) => {
    if (typeof n === 'string') {
      out.push(n);
      return;
    }
    (n.children ?? []).forEach(walk);
  };
  (Array.isArray(root) ? root : root ? [root] : []).forEach(walk);
  return out;
}
const style = (n: unknown) =>
  (StyleSheet.flatten((n as Node).props.style as never) ?? {}) as Record<string, unknown>;

const mount = (
  props: { envelope?: MessageEnvelope; attachmentCount?: number | null } = {},
  isDark = false,
) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
      <AppThemeProvider isDark={isDark}>
        <DetailEnvelope
          envelope={props.envelope ?? envelope}
          account={account}
          attachmentCount={props.attachmentCount === undefined ? 2 : props.attachmentCount}
        />
      </AppThemeProvider>
    </TamaguiProvider>,
  );

afterEach(() => setActiveLocale('cs'));

describe.each([
  ['light', false, lightTheme],
  ['dark', true, darkTheme],
] as const)('%s', (_label, isDark, theme) => {
  it('prints the sender on the envelope in its white ink, with the address under it', async () => {
    const view = await mount({}, isDark);
    expect(style(view.getByTestId('detailSender')).color).toBe(theme.onSolid);
    expect(view.getByText('Magistrát města Kotlina')).toBeTruthy();
    expect(view.getByText('Náměstí Míru 1, 100 00 Kotlina')).toBeTruthy();
  });

  it('lays the subject on the letter rising out of the envelope, shading its lip', async () => {
    const view = await mount({}, isDark);
    const sheet = view.getByTestId('detailSubject');
    expect(style(sheet).backgroundColor).toBe(theme.surface);
    expect(style(sheet).boxShadow).toBe(objectShadow(theme.name, 'letter'));
    expect(view.getByRole('header').props.children).toBe('Výzva k doplnění podání');
  });
});

it('strikes the postmark with the day and the minute ISDS delivered it', async () => {
  const view = await mount();
  const said = JSON.stringify(view.toJSON());
  expect(said).toContain('19.08.');
  expect(said).toContain('09:41');
  expect(said).toContain('DODÁNO · DATOVÁ SCHRÁNKA ·');
  // A picture of the record below, not a second reading of it.
  expect(view.getByTestId('detailPostmark', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
  expect(dayMonth(new Date(2026, 0, 3, 23, 59).getTime())).toBe('03.01.');
});

it('strikes no postmark on a message ISDS has not delivered', async () => {
  const view = await mount({ envelope: { ...envelope, deliveryTime: null } });
  expect(view.queryByTestId('detailPostmark', { includeHiddenElements: true })).toBeNull();
});

it('names the recipient in the window, and the box it arrived in when the message does not', async () => {
  const named = await mount();
  expect(named.getByText('Jana Nováková')).toBeTruthy();
  expect(named.getByText(' · ab12cd3')).toBeTruthy();
  await named.unmount();
  const unnamed = await mount({ envelope: { ...envelope, recipient: null, recipientBoxId: null } });
  expect(unnamed.getByText('Domácí schránka')).toBeTruthy();
  expect(unnamed.getByText(' · zz98yx7')).toBeTruthy();
});

it('counts the attachments on the sheet only once it knows them, in Czech plurals', async () => {
  for (const [n, said] of [[2, '2 přílohy'], [1, '1 příloha'], [5, '5 příloh']] as const) {
    const view = await mount({ attachmentCount: n });
    expect(strings(view.toJSON()).join('|')).toContain(said);
    await view.unmount();
  }
  const unknown = await mount({ attachmentCount: null });
  expect(unknown.queryByText(/příloh/)).toBeNull();
});

it('says it in English', async () => {
  setActiveLocale('en');
  const view = await mount({ attachmentCount: 3 });
  expect(view.getByText('3 attachments')).toBeTruthy();
  expect(JSON.stringify(view.toJSON())).toContain('DELIVERED · DATA BOX ·');
});
