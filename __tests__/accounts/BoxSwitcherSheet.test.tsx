import { render, fireEvent, act } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { BoxSwitcherSheet } from '../../src/features/accounts/screens/BoxSwitcherSheet';
import type { DataBoxAccount } from '../../src/services/isds/types';
import { t } from '../../src/i18n/strings';

// 011 inbox-first IA: the box-switcher bottom sheet replaces the retired box-list home + AppDrawer as
// the SOLE multi-box surface. It lists boxes (active ✓), switches in place, and reaches add-box /
// settings; each box's ⋯ still opens Přejmenovat / Odebrat (the coverage that lived in BoxList.test).

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const account = (boxId: string, over: Partial<DataBoxAccount> = {}): DataBoxAccount => ({
  id: boxId,
  boxId,
  loginName: 'user',
  label: `Box ${boxId}`,
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
  ...over,
});

async function renderSheet(
  overrides: Partial<React.ComponentProps<typeof BoxSwitcherSheet>> = {},
) {
  const props = {
    onClose: jest.fn(),
    accounts: [account('box1'), account('box2')],
    activeBoxId: 'box1',
    onSwitch: jest.fn(),
    onAddBox: jest.fn(),
    onOpenSettings: jest.fn(),
    onSetAlias: jest.fn(),
    onRemove: jest.fn(),
    ...overrides,
  };
  const view = await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <BoxSwitcherSheet {...props} />
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
  return { view, props };
}

describe('BoxSwitcherSheet (011 inbox-first IA)', () => {
  it('lists every box plus the add-box + settings entries', async () => {
    const { view } = await renderSheet();
    expect(view.getByTestId('switchBox-box1')).toBeTruthy();
    expect(view.getByTestId('switchBox-box2')).toBeTruthy();
    expect(view.getByTestId('switcherAddBox')).toBeTruthy();
    expect(view.getByTestId('switcherSettings')).toBeTruthy();
  });

  it('tapping a non-active box switches to it; the active row just dismisses', async () => {
    const { view, props } = await renderSheet();
    await act(async () => {
      fireEvent.press(view.getByTestId('switchBox-box2'));
    });
    expect(props.onSwitch).toHaveBeenCalledWith('box2');

    await act(async () => {
      fireEvent.press(view.getByTestId('switchBox-box1')); // already active
    });
    expect(props.onSwitch).toHaveBeenCalledTimes(1); // not switched again
    expect(props.onClose).toHaveBeenCalled();
  });

  it('add-box + settings rows reach their flows', async () => {
    const { view, props } = await renderSheet();
    await act(async () => {
      fireEvent.press(view.getByTestId('switcherAddBox'));
    });
    expect(props.onAddBox).toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(view.getByTestId('switcherSettings'));
    });
    expect(props.onOpenSettings).toHaveBeenCalled();
  });

  it('per-box ⋯ opens Přejmenovat / Odebrat, routing to the alias editor / remove confirm', async () => {
    const { view, props } = await renderSheet();

    // Open the overflow sheet on box1.
    await act(async () => {
      fireEvent.press(view.getByTestId('boxMenu-box1'));
    });
    expect(view.getByTestId('boxRename-box1')).toBeTruthy();
    expect(view.getByTestId('boxRemove-box1')).toBeTruthy();

    // Odebrat → the styled remove-confirm dialog; confirming calls onRemove(boxId).
    await act(async () => {
      fireEvent.press(view.getByTestId('boxRemove-box1'));
    });
    expect(view.getByTestId('removeDelete')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('removeDelete'));
    });
    expect(props.onRemove).toHaveBeenCalledWith('box1');

    // Přejmenovat → the alias editor.
    await act(async () => {
      fireEvent.press(view.getByTestId('boxMenu-box1'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('boxRename-box1'));
    });
    expect(view.getByTestId('aliasSave')).toBeTruthy();
  });
});

// 020: the box's PDZ credit, where you pick which box to send FROM.
//
// The assertion that carries this block is the negative one. `pdzCreditCzk` is null until a refresh
// has successfully asked ISDS, and rendering that as "0 Kč" would tell someone who has just bought
// credit that they have none - a false statement about their money, produced by treating "we have
// not asked" and "you have nothing" as one value.
describe('PDZ credit in the switcher', () => {
  it('shows a known balance', async () => {
    const { view } = await renderSheet({
      accounts: [account('box1', { pdzCreditCzk: 1234 })],
    });
    expect(view.getByTestId('credit-box1')).toHaveTextContent(/1.234/);
  });

  it('shows a genuine ZERO - that is a fact the app does know', async () => {
    const { view } = await renderSheet({
      accounts: [account('box1', { pdzCreditCzk: 0 })],
    });
    expect(view.getByTestId('credit-box1')).toHaveTextContent(/0/);
  });

  it('shows NOTHING when the balance was never learned', async () => {
    const { view } = await renderSheet({
      accounts: [account('box1', { pdzCreditCzk: null })],
    });
    expect(view.queryByTestId('credit-box1')).toBeNull();
  });
});

// A box that has stopped syncing used to look exactly like one that had not. Reported directly:
// "there is no icon to indicate sync for the given box is broken, because the session has expired",
// and alongside it that a box with unread mail said nothing until you switched to it. Both are the
// same failure of the switcher: it is the surface whose entire job is answering "what is going on
// across my boxes" without opening each one.
describe('a box that is not syncing', () => {
  it('carries a mark on the avatar and says why, when its session expired', async () => {
    const { view } = await renderSheet({
      accounts: [account('box1', { syncError: 'reauth' }), account('box2')],
    });
    expect(view.getByTestId('syncError-box1')).toBeTruthy();
    expect(view.getByTestId('syncState-box1')).toHaveTextContent(
      new RegExp(t('box.sync.reauth')),
    );
    // and the healthy box says nothing at all
    expect(view.queryByTestId('syncError-box2')).toBeNull();
  });

  it('distinguishes a transient failure from an expired sign-in', async () => {
    // Different answers to "what do I do now": one needs the user, the other fixes itself.
    const { view } = await renderSheet({ accounts: [account('box1', { syncError: 'error' })] });
    expect(view.getByTestId('syncState-box1')).toHaveTextContent(
      new RegExp(t('box.sync.error')),
    );
  });

  it('says the PASSWORD expired, which is a different fix again (001 FR-009)', async () => {
    // The fix starts on the portal rather than with signing in, so the row must read like neither of
    // the other two - while carrying the same urgency as a sign-in that expired.
    const { view } = await renderSheet({
      accounts: [account('box1', { syncError: 'passwordExpired' })],
    });
    expect(view.getByTestId('syncError-box1')).toBeTruthy();
    expect(view.getByTestId('syncState-box1')).toHaveTextContent(
      new RegExp(t('box.sync.passwordExpired')),
    );
    expect(view.getByTestId('syncState-box1')).not.toHaveTextContent(
      new RegExp(t('box.sync.error')),
    );
    const label = view.getByTestId('switchBox-box1').props.accessibilityLabel as string;
    expect(label).toContain(t('box.sync.passwordExpired'));
  });

  it('keeps the unread count but marks it as the last KNOWN one', async () => {
    // Dropping the badge would hide the very thing the user wants to see; showing it bare would
    // claim a number we cannot currently verify. So: keep it, and say what it is.
    const { view } = await renderSheet({
      accounts: [account('box1', { syncError: 'reauth', unreadCount: 1 })],
    });
    expect(view.getByTestId('unread-box1')).toHaveTextContent('1');
    // The row says both: what broke, and that the number beside it is a memory.
    expect(view.getByTestId('syncState-box1')).toHaveTextContent(
      new RegExp(t('box.sync.stale')),
    );
  });

  it('says the same thing for a broken box with NOTHING unread', async () => {
    // It used to depend on the badge, so two boxes in the same state read differently and nothing
    // told the reader the difference was about a number. Everything on this row is from the last
    // refresh that worked, so the sentence is true with or without unread mail.
    const { view } = await renderSheet({
      accounts: [account('box1', { syncError: 'reauth', unreadCount: 0 })],
    });
    expect(view.getByTestId('syncState-box1')).toHaveTextContent(
      new RegExp(t('box.sync.stale')),
    );
  });

  it('replaces the credit line, which is a fact from the refresh that failed', async () => {
    const { view } = await renderSheet({
      accounts: [account('box1', { syncError: 'reauth', pdzCreditCzk: 120 })],
    });
    expect(view.queryByTestId('credit-box1')).toBeNull();
    expect(view.getByTestId('syncState-box1')).toBeTruthy();
  });

  it('tells a screen reader, which cannot see either mark', async () => {
    const { view } = await renderSheet({
      accounts: [account('box1', { syncError: 'reauth', unreadCount: 2 })],
    });
    const label = view.getByTestId('switchBox-box1').props.accessibilityLabel as string;
    expect(label).toContain(t('box.sync.reauth'));
    expect(label).toContain('2');
  });
});

describe('a box with unread mail', () => {
  it('shows the count in the switcher, without opening the box', async () => {
    const { view } = await renderSheet({
      accounts: [account('box1'), account('box2', { unreadCount: 3 })],
    });
    expect(view.getByTestId('unread-box2')).toHaveTextContent('3');
    expect(view.queryByTestId('unread-box1')).toBeNull();
  });
});

// 024 cycle 2. "The Vse section should look slightly different in the boxes selector, as not to
// confuse it with a box if a person named their box Vse" - so the difference cannot be the label.
// These assert the structural ones, each of which survives an exact name collision.
describe('the merged-view entry', () => {
  it('is absent for a single-box user', async () => {
    // With one box it and that box are the same list. A choice whose branches render identically is
    // worse than no choice: the user has to work out that it does not matter.
    const { view } = await renderSheet({ accounts: [account('only')] });
    expect(view.queryByTestId('switchUnified')).toBeNull();
  });

  it('appears once a second box exists', async () => {
    const { view } = await renderSheet({ accounts: [account('a'), account('b')] });
    expect(view.getByTestId('switchUnified')).toBeTruthy();
  });

  it('carries no per-box overflow menu, which every box row does', async () => {
    // Structural signal 4: nothing to rename, nothing to remove, so the affordance is absent rather
    // than present-and-disabled. Still true if a box is literally named "Vse".
    const { view } = await renderSheet({
      accounts: [account('a', { label: 'Vše' }), account('b')],
    });
    expect(view.getByTestId('switchUnified')).toBeTruthy();
    expect(view.queryAllByTestId(/^boxMenu-/).length).toBe(2); // one per BOX, none for the entry
  });

  it('says what it IS and how many boxes it merges, in a grammar no box can produce', async () => {
    const { view } = await renderSheet({ accounts: [account('a'), account('b'), account('c')] });
    const row = view.getByTestId('switchUnified');
    expect(row).toHaveTextContent(new RegExp(t('unified.kind'))); // "Sloučený archiv"
    expect(row).toHaveTextContent(/3/);
  });

  it('sums unread across every box, in the badge a box row uses for its own', async () => {
    const { view } = await renderSheet({
      accounts: [account('a', { unreadCount: 2 }), account('b', { unreadCount: 3 })],
    });
    expect(view.getByTestId('unifiedUnread')).toHaveTextContent('5');
  });

  it('caps the badge the way a box row caps its own', async () => {
    const { view } = await renderSheet({
      accounts: [account('a', { unreadCount: 120 }), account('b')],
    });
    expect(view.getByTestId('unifiedUnread')).toHaveTextContent('99+');
  });

  it('enters the merged view, and no box is shown active while it is on', async () => {
    const onOpenUnified = jest.fn();
    const { view } = await renderSheet({
      accounts: [account('box1'), account('box2')],
      activeBoxId: 'box1',
      unified: true,
      onOpenUnified,
    });
    const label = view.getByTestId('switchBox-box1').props.accessibilityState;
    expect(label?.selected).toBe(false);
    expect(view.getByTestId('switchUnified').props.accessibilityState?.selected).toBe(true);
  });
});
