// Welcome, the whole app on a phone with no boxes (2026-09-24).
//
// A new phone showed one action here: adding a box by hand. Somebody moving from an old phone had no
// way to the transfer or to their backup file - both lived behind Settings, which cannot be reached
// without a box - and somebody who does not read Czech had no way to the language either. So the two
// ways out are asserted here, and what the restore button says on a phone that cannot receive a
// transfer, where naming one would promise a screen that says it is unavailable.
//
// The restore way in is a real secondary button now (it read as a caption), and the language corner a
// picker over every language rather than a switch to "the other one" - see `welcomeLanguages.test.tsx`
// for the same picker over a list of three.

import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { Welcome } from '../../src/features/accounts/screens/Welcome';
import { SettingsProvider } from '../../src/app/settings/SettingsProvider';
import { LANGUAGES } from '../../src/app/settings/languages';
import { settingsStore } from '../../src/features/accounts/deps';
import { STRINGS_FOR_TEST, setActiveLocale } from '../../src/i18n/strings';

jest.mock('../../src/theme/icons', () => {
  const actual = jest.requireActual('../../src/theme/icons');
  const { View: MockView } = jest.requireActual('react-native');
  return { ...actual, BackupIcon: () => <MockView testID="icon-backup" /> };
});

const { cs, en } = STRINGS_FOR_TEST;

const wrap = (ui: React.ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>{ui}</AppThemeProvider>
    </TamaguiProvider>,
  );

afterEach(() => {
  jest.restoreAllMocks();
  setActiveLocale('cs');
});

type Node = ReturnType<Awaited<ReturnType<typeof render>>['getByTestId']>;

/** The box a Welcome action draws inside its press target: the first view given a height. */
function boxOf(target: Node) {
  const walk = (n: Node): Node | undefined => {
    for (const child of n.children) {
      if (typeof child === 'string') {
        continue;
      }
      if (StyleSheet.flatten(child.props.style)?.minHeight != null) {
        return child;
      }
      const found = walk(child);
      if (found) {
        return found;
      }
    }
    return undefined;
  };
  const box = walk(target);
  expect(box).toBeDefined();
  return StyleSheet.flatten(box?.props.style);
}

/** `node`'s ancestors, nearest first. */
function ancestors(node: Node): Node[] {
  const out: Node[] = [];
  for (let n = node.parent; n; n = n.parent) {
    out.push(n);
  }
  return out;
}

/** The words a press target draws. Hidden from the accessibility tree, which hears its label. */
const HIDDEN = { includeHiddenElements: true } as const;

describe('the way to an archive that is somewhere else', () => {
  it('is a button with the backup glyph, on Welcome, and opens the restore screen', async () => {
    const onRestore = jest.fn();
    const onAddBox = jest.fn();
    const view = await wrap(
      <Welcome onAddBox={onAddBox} onOpenFaq={() => {}} onRestore={onRestore} canTransfer />,
    );
    const button = view.getByTestId('welcome-restore');

    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe(cs['welcome.restore']);
    expect(within(button).getByTestId('icon-backup', HIDDEN)).toBeTruthy();
    expect(within(button).getByText(cs['welcome.restore'], HIDDEN)).toBeTruthy();

    fireEvent.press(button);
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onAddBox).not.toHaveBeenCalled();
  });

  it('is the primary button\'s box, outlined: same height, radius and width cap', async () => {
    const view = await wrap(
      <Welcome onAddBox={() => {}} onOpenFaq={() => {}} onRestore={() => {}} canTransfer />,
    );
    const primary = view.getByTestId('welcome-add-box');
    const secondary = view.getByTestId('welcome-restore');

    const p = boxOf(primary);
    const s = boxOf(secondary);
    expect(s.minHeight).toBe(p.minHeight);
    expect(s.borderTopLeftRadius).toBe(p.borderTopLeftRadius);
    expect(s.borderBottomRightRadius).toBe(p.borderBottomRightRadius);
    expect(StyleSheet.flatten(secondary.props.style).maxWidth).toBe(
      StyleSheet.flatten(primary.props.style).maxWidth,
    );
    // Outlined, not filled: the primary is the one dark shape on the screen.
    expect(s.borderTopWidth).toBe(1);
    expect(s.borderBottomWidth).toBe(1);
    expect(s.backgroundColor).toBeUndefined();
    expect(p.backgroundColor).toBeDefined();
  });

  it('names the other phone where this one can receive a transfer', async () => {
    const view = await wrap(
      <Welcome onAddBox={() => {}} onOpenFaq={() => {}} onRestore={() => {}} canTransfer />,
    );
    expect(view.getByRole('button', { name: cs['welcome.restore'] })).toBeTruthy();
  });

  it('names only the backup where it cannot (iOS, for now)', async () => {
    const view = await wrap(
      <Welcome onAddBox={() => {}} onOpenFaq={() => {}} onRestore={() => {}} canTransfer={false} />,
    );
    const button = view.getByTestId('welcome-restore');
    expect(button.props.accessibilityLabel).toBe(cs['welcome.restore.backupOnly']);
    expect(within(button).getByText(cs['welcome.restore.backupOnly'], HIDDEN)).toBeTruthy();
    expect(view.queryByText(cs['welcome.restore'], HIDDEN)).toBeNull();
    // The same glyph fits a backup alone.
    expect(within(button).getByTestId('icon-backup', HIDDEN)).toBeTruthy();
  });
});

describe('the language picker', () => {
  /** The settings table, as far as this screen reaches it. */
  function stubStore() {
    const stored = new Map<string, string>();
    jest.spyOn(settingsStore, 'getSetting').mockImplementation(async k => stored.get(k) ?? null);
    jest.spyOn(settingsStore, 'setSetting').mockImplementation(async (k, v) => {
      stored.set(k, v);
    });
    return stored;
  }

  const mount = async () => {
    const view = await wrap(
      <SettingsProvider>
        <Welcome onAddBox={() => {}} onOpenFaq={() => {}} onRestore={() => {}} canTransfer />
      </SettingsProvider>,
    );
    await waitFor(() => expect(view.getByTestId('welcome-language')).toBeTruthy());
    return view;
  };

  const open = async (view: Awaited<ReturnType<typeof mount>>) => {
    await act(async () => {
      fireEvent.press(view.getByTestId('welcome-language'));
    });
    return view.getByTestId('language-sheet');
  };

  it('shows the language in use, by its own name, as a button a screen reader names', async () => {
    stubStore();
    const view = await mount();
    const corner = view.getByTestId('welcome-language');

    expect(within(corner).getByText('Čeština')).toBeTruthy();
    expect(within(corner).queryByText('English')).toBeNull();
    expect(corner.props.accessibilityRole).toBe('button');
    expect(corner.props.accessibilityLabel).toBe(`${cs['settings.language']}: Čeština`);
    // Nothing is open until it is asked for.
    expect(view.queryByTestId('language-sheet')).toBeNull();
  });

  it('opens a sheet listing every language, with the one in use selected', async () => {
    stubStore();
    const view = await mount();
    const sheet = await open(view);

    const rows = within(sheet).getAllByRole('radio');
    expect(rows).toHaveLength(LANGUAGES.length);
    for (const { code, name } of LANGUAGES) {
      const row = within(sheet).getByTestId(`lang-${code}`);
      expect(within(row).getByText(name)).toBeTruthy();
      expect(row.props.accessibilityState).toEqual({ selected: code === 'cs' });
    }
  });

  it('switches the whole screen at once, keeps the choice, and closes', async () => {
    const stored = stubStore();
    const view = await mount();
    const sheet = await open(view);

    await act(async () => {
      fireEvent.press(within(sheet).getByTestId('lang-en'));
    });

    expect(view.queryByTestId('language-sheet')).toBeNull();
    expect(view.getByText(en['welcome.tagline'])).toBeTruthy();
    expect(view.getByRole('button', { name: en['welcome.restore'] })).toBeTruthy();
    const corner = view.getByTestId('welcome-language');
    expect(within(corner).getByText('English')).toBeTruthy();
    expect(corner.props.accessibilityLabel).toBe(`${en['settings.language']}: English`);
    // Kept, so the next launch opens in it too.
    expect(stored.get('locale')).toBe('en');
  });

  it('picking the language already in use only closes the sheet', async () => {
    const stored = stubStore();
    const view = await mount();
    const sheet = await open(view);

    await act(async () => {
      fireEvent.press(within(sheet).getByTestId('lang-cs'));
    });

    expect(view.queryByTestId('language-sheet')).toBeNull();
    expect(view.getByText(cs['welcome.tagline'])).toBeTruthy();
    expect(stored.has('locale')).toBe(false);
  });

  it('closes on Android back and on the scrim, changing nothing', async () => {
    const stored = stubStore();
    const view = await mount();

    // Android's back reaches a sheet as its Modal's onRequestClose.
    const modal = ancestors(await open(view)).find(n => n.props.onRequestClose);
    await act(async () => {
      modal?.props.onRequestClose();
    });
    expect(view.queryByTestId('language-sheet')).toBeNull();

    // The scrim is the outer of the two views that are not accessibility elements: the inner one
    // is the sheet's press-eater, which must NOT close it.
    const [eater, scrim] = ancestors(await open(view)).filter(n => n.props.accessible === false);
    await act(async () => {
      fireEvent.press(eater);
    });
    expect(view.getByTestId('language-sheet')).toBeTruthy();
    await act(async () => {
      fireEvent.press(scrim);
    });
    expect(view.queryByTestId('language-sheet')).toBeNull();

    expect(view.getByText(cs['welcome.tagline'])).toBeTruthy();
    expect(stored.has('locale')).toBe(false);
  });

  it('opens in the language chosen before', async () => {
    const stored = stubStore();
    stored.set('locale', 'en');
    const view = await mount();
    await waitFor(() => expect(view.getByText(en['welcome.tagline'])).toBeTruthy());
    expect(within(view.getByTestId('welcome-language')).getByText('English')).toBeTruthy();
  });
});
