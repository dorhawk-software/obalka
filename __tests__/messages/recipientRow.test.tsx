// The recipient search result row (feature 015). Renders the real ComposeScreen against a stubbed
// ISDS search, using the exact result set that exposed the defect on the czebox register.
//
// The defect: three different people called Jan Novak, identical in type and cost badge, whose only
// distinguishing datum - the address - was concatenated onto the end of the name and then clipped to
// one line. All three addresses were cut; two lost the town, which is the word that separates a Brno
// Jan Novak from a Prague one. Sending to the wrong one is a legal delivery that cannot be recalled.
//
// So this suite asserts absence as much as presence: no ellipsis anywhere in a rendered address.
//
// NOTE the regexes. `toHaveTextContent('x')` matches the node's ENTIRE text exactly, so
// `not.toHaveTextContent('…')` passes for any row that is not literally the single character "…" -
// i.e. always. Written that way, the assertion this whole file exists for tested nothing. A regex
// does the substring match that was meant.

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { SnackbarProvider } from '../../src/app/Snackbar';
import type { DataBoxAccount } from '../../src/services/isds/types';
import { t } from '../../src/i18n/strings';

const mockSearch = jest.fn();
const mockGetCredit = jest.fn(async () => 250);

jest.mock('../../src/features/accounts/deps', () => ({
  sendController: {
    searchRecipients: (...args: unknown[]) => mockSearch(...args),
    send: jest.fn(),
    estimateCost: jest.fn(),
    // Picking a recipient renders the cost card, which needs a real estimate shape.
    estimate: (r: { dbType: string }) => ({
      paid: r.dbType !== 'OVM',
      approxCzk: r.dbType !== 'OVM' ? 10 : 0,
    }),
  },
  draftsStore: {
    list: jest.fn(async () => []),
    save: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
  },
  messagesController: {
    getCachedMessages: jest.fn(async () => ({
      envelopes: [],
      downloaded: [],
      syncedAt: null,
    })),
    getCredit: (...a: unknown[]) => mockGetCredit(...(a as [])),
  },
  accountsController: { recordCredit: jest.fn(async () => {}) },
}));

import { ComposeScreen } from '../../src/features/messages/screens/ComposeScreen';

const ui = (node: ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <SnackbarProvider>{node}</SnackbarProvider>
    </TamaguiProvider>,
  );

const account: DataBoxAccount = {
  id: 'a1',
  boxId: 'box1',
  loginName: 'user',
  label: 'Sender',
  dbType: null,
  alias: null,
  authMethod: 'password',
  host: 'czebox',
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
};

/** The real czebox result set, as measured 2026-08-17. */
const NOVAKS = [
  {
    boxId: 'ezfam3k',
    name: 'Jan Novak',
    address: 'Nová 1/777, 60200 Brno, CZ',
    dbType: 'FO' as const,
    acceptsPdz: true,
  },
  {
    boxId: 'irci5we',
    name: 'Jan Novak',
    address: 'Vaclavske namesti 1, 11000 Praha',
    dbType: 'FO' as const,
    acceptsPdz: true,
  },
  {
    boxId: 'vsxiu3c',
    name: 'Jan Novak',
    address: 'Ujezd 450, 11000 Praha',
    dbType: 'FO' as const,
    acceptsPdz: true,
  },
  {
    boxId: 'qnui6b4',
    name: 'Petr Novak',
    address: null,
    dbType: 'FO' as const,
    acceptsPdz: true,
  },
];

async function searchFor(results: typeof NOVAKS) {
  mockSearch.mockResolvedValue({ kind: 'recipients', recipients: results });
  const view = await ui(<ComposeScreen account={account} onBack={() => {}} onOpenSent={() => {}} />);
  fireEvent.changeText(view.getByTestId('composeRecipientQuery'), 'Novak');
  await waitFor(() => expect(mockSearch).toHaveBeenCalled(), { timeout: 3000 });
  await waitFor(() => view.getByTestId(`recipient-${results[0].boxId}`), {
    timeout: 3000,
  });
  return view;
}

beforeEach(() => {
  mockSearch.mockReset();
  mockGetCredit.mockClear();
});

describe('recipient results - telling namesakes apart', () => {
  it('shows all three same-name people with their FULL, different addresses', async () => {
    const view = await searchFor(NOVAKS);
    // Every part of every address, including the towns that used to be cut off.
    for (const s of [
      'Nová 1/777',
      '60200 Brno, CZ',
      'Vaclavske namesti 1',
      '11000 Praha',
      'Ujezd 450',
    ]) {
      expect(view.queryAllByText(s).length).toBeGreaterThan(0);
    }
  });

  // Deliberately weak, and labelled as such. `numberOfLines` clips at LAYOUT time, which the test
  // renderer never performs - the full string is in the tree either way, so this cannot fail on a
  // re-truncated row. Verified: re-introducing the old clipped line leaves it green. It is a
  // tripwire for a literal ellipsis being baked into a string, nothing more.
  //
  // The real check for SC-002 is on the device (tasks T015): dump the rendered row and look for the
  // ellipsis the OS put there. A jest assertion cannot stand in for it, and pretending otherwise
  // would be worse than not having one.
  it('contains no literal ellipsis character (weak - see the note above)', async () => {
    const view = await searchFor(NOVAKS);
    for (const row of ['ezfam3k', 'irci5we', 'vsxiu3c']) {
      expect(view.getByTestId(`recipient-${row}`)).not.toHaveTextContent(/…/);
    }
  });

  // This one DOES fail on a re-truncated row: the address is a separate node, so if it is folded
  // back into the name line the exact-text lookups below stop matching.
  it('keeps the address in its own node, not glued to the name', async () => {
    const view = await searchFor(NOVAKS);
    expect(view.queryAllByText('Jan Novak')).toHaveLength(3);
    expect(view.getByText('60200 Brno, CZ')).toBeTruthy();
  });

  it('tags the namesakes, and only the namesakes', async () => {
    const view = await searchFor(NOVAKS);
    // Three Jan Novaks share a name; Petr does not.
    expect(view.queryAllByText(t('recipient.sameName'))).toHaveLength(3);
    expect(view.getByTestId('recipient-qnui6b4')).not.toHaveTextContent(
      new RegExp(t('recipient.sameName')),
    );
  });

  it('says once, for the set, that the address is the distinguisher', async () => {
    const view = await searchFor(NOVAKS);
    expect(view.getByText(t('recipient.sameNameHint'))).toBeTruthy();
  });

  it('stays silent about namesakes when there are none', async () => {
    const view = await searchFor([NOVAKS[0], NOVAKS[3]]);
    expect(view.queryByText(t('recipient.sameNameHint'))).toBeNull();
    expect(view.queryAllByText(t('recipient.sameName'))).toHaveLength(0);
  });

  it('states that the RECORD has no address, rather than leaving a gap', async () => {
    const view = await searchFor(NOVAKS);
    expect(view.getByTestId('recipient-qnui6b4')).toHaveTextContent(
      new RegExp(t('recipient.noAddress')),
    );
  });

  it('reads the whole identity to a screen reader, address included', async () => {
    const view = await searchFor(NOVAKS);
    expect(
      view.getByLabelText('Jan Novak, Nová 1/777, 60200 Brno, CZ'),
    ).toBeTruthy();
  });
});

// 020: the balance is refreshed when it starts to MATTER - once a paid recipient is picked - and
// never for a free (OVM) message, because an ISDS call nobody needs is what 014 removed.
describe('PDZ credit refresh on compose', () => {
  const OVM = {
    boxId: 'ovm1111',
    name: 'Městský úřad',
    address: 'Náměstí 1, 11000 Praha',
    dbType: 'OVM' as const,
    acceptsPdz: false,
  };

  const pick = async (r: typeof NOVAKS[number] | typeof OVM) => {
    const view = await searchFor([r as never]);
    fireEvent.press(view.getByTestId(`recipient-${r.boxId}`));
    return view;
  };

  it('asks for the balance once a PAID recipient is picked', async () => {
    await pick(NOVAKS[0]);
    await waitFor(() => expect(mockGetCredit).toHaveBeenCalled(), {
      timeout: 3000,
    });
  });

  it('does NOT ask for a free OVM message', async () => {
    await pick(OVM);
    // Give the effect a chance to fire before asserting it did not.
    await new Promise(r => setTimeout(r, 200));
    expect(mockGetCredit).not.toHaveBeenCalled();
  });
});
