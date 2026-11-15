// What's new (spec 029): after an update, once, what changed since the version this phone had.
//
// The decision is the part that is easy to get wrong in a way nobody notices - a sheet on a fresh
// install describing changes the person never had, the same sheet on every launch, or one interrupting
// them over a library update - so it is tested first and on its own.

import { fireEvent, render, within } from '@testing-library/react-native';
import { Dimensions, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { type as typeScale } from '../../src/theme/typeScale';
import { lightTheme } from '../../src/theme/theme';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { setActiveLocale, t } from '../../src/i18n/strings';
import type { ChangelogRelease } from '../../src/content/changelog.generated';
import {
  decideWhatsNew,
  isNewerVersion,
  noticeableChanges,
  releaseDate,
  releasesSince,
} from '../../src/app/whatsNew/whatsNew';

const RELEASES: ChangelogRelease[] = [
  {
    version: '0.4.0',
    date: '2026-12-10',
    changes: { underneath: [{ lead: 'Libraries brought up to date.', body: '' }] },
  },
  {
    version: '0.3.0',
    date: '2026-12-01',
    changes: {
      new: [{ lead: 'A deadline reminder.', body: 'Set it on a message.' }],
      fixed: [{ lead: 'Search finds attachments too.', body: '' }],
    },
  },
  {
    version: '0.2.0',
    date: '2026-11-20',
    changes: { better: [{ lead: 'Faster sign-in.', body: '' }] },
  },
  { version: '0.1.0', date: '2026-11-12', changes: { new: [{ lead: 'The first release.', body: '' }] } },
];

// `mock`-prefixed so jest allows the factory below to close over it.
let mockLocale: 'cs' | 'en' = 'en';
jest.mock('../../src/app/settings/SettingsProvider', () => ({
  ...jest.requireActual('../../src/app/settings/SettingsProvider'),
  useLocale: () => mockLocale,
}));
jest.mock('../../src/app/appInfo', () => ({
  ...jest.requireActual('../../src/app/appInfo'),
  APP_VERSION: '0.3.0',
}));
const mockChangelog: { cs: ChangelogRelease[]; en: ChangelogRelease[] } = { cs: [], en: [] };
jest.mock('../../src/content/changelog.generated', () => ({
  ...jest.requireActual('../../src/content/changelog.generated'),
  get CHANGELOG() {
    return mockChangelog;
  },
}));

const { WhatsNewSheet } = require('../../src/app/whatsNew/WhatsNewSheet') as typeof import('../../src/app/whatsNew/WhatsNewSheet');
const { ChangelogScreen } = require('../../src/app/whatsNew/ChangelogScreen') as typeof import('../../src/app/whatsNew/ChangelogScreen');

const themed = (node: React.ReactNode) => (
  <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
    <AppThemeProvider isDark={false}>{node}</AppThemeProvider>
  </TamaguiProvider>
);

afterEach(() => {
  setActiveLocale('cs');
  mockLocale = 'en';
  mockChangelog.cs = [];
  mockChangelog.en = [];
});

describe('versions', () => {
  it('compares numerically, not as text', () => {
    expect(isNewerVersion('0.10.0', '0.9.0')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('0.1.0', 'Unreleased')).toBe(false);
  });

  it('writes a release date the way the app writes dates', () => {
    expect(releaseDate('2026-11-12')).toBe('12.11.2026');
  });
});

describe('at launch', () => {
  it('says nothing on a fresh install, and remembers the version from then on', () => {
    expect(decideWhatsNew(RELEASES, '0.3.0', null)).toEqual({ show: false, remember: true });
  });

  it('says nothing on the version already seen, and writes nothing', () => {
    expect(decideWhatsNew(RELEASES, '0.3.0', '0.3.0')).toEqual({ show: false, remember: false });
  });

  it('says nothing when the phone saw a newer version than this one, and keeps that one', () => {
    expect(decideWhatsNew(RELEASES, '0.2.0', '0.3.0')).toEqual({ show: false, remember: false });
  });

  it('shows every release since the version the phone had, up to this one, newest first', () => {
    const decision = decideWhatsNew(RELEASES, '0.3.0', '0.1.0');
    expect(decision.show).toBe(true);
    if (decision.show) {
      expect(decision.since).toBe('0.1.0');
      expect(decision.releases.map(r => r.version)).toEqual(['0.3.0', '0.2.0']);
    }
  });

  it('interrupts nobody over an update to what the app is built on, and remembers it quietly', () => {
    expect(decideWhatsNew(RELEASES, '0.4.0', '0.3.0')).toEqual({ show: false, remember: true });
  });

  it('counts only what a person would notice', () => {
    expect(noticeableChanges(releasesSince(RELEASES, '0.4.0', '0.1.0'))).toBe(3);
  });
});

describe('the sheet', () => {
  it('names the new version, the one the phone had and how many changes lie between', async () => {
    setActiveLocale('en');
    const onClose = jest.fn();
    const view = await render(
      themed(<WhatsNewSheet releases={releasesSince(RELEASES, '0.3.0', '0.1.0')} since="0.1.0" onClose={onClose} />),
    );
    expect(view.getByText(t('whatsNew.title', { version: '0.3.0' }))).toBeTruthy();
    expect(view.getByText('Since 0.1.0, the version you had: 3 changes')).toBeTruthy();
    // Two releases: each under its own heading, its kinds under it.
    expect(view.getByText('Version 0.3.0 · 01.12.2026')).toBeTruthy();
    expect(view.getByText('Version 0.2.0 · 20.11.2026')).toBeTruthy();
    expect(view.getByTestId('change-0.3.0-new-0')).toHaveTextContent('A deadline reminder. Set it on a message.');
    expect(view.getAllByText('New')).toHaveLength(1);
    fireEvent.press(view.getByTestId('whats-new-continue'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Walked 2026-11-15 at Android's largest text (2.0, 031 I135): the dot's box was the first line's
  // height at 100 %, so at a larger text the dot sat above the middle of its line.
  it('centres each dot on its first line at the reader s text size', async () => {
    setActiveLocale('en');
    const { fontScale } = Dimensions.get('window');
    expect(fontScale).not.toBe(1);
    const view = await render(
      themed(<WhatsNewSheet releases={releasesSince(RELEASES, '0.3.0', '0.1.0')} since="0.1.0" onClose={() => {}} />),
    );
    const dot = view.getByTestId('change-0.3.0-new-0-dot', { includeHiddenElements: true });
    expect(StyleSheet.flatten(dot.props.style).height).toBe(typeScale.small.lineHeight * fontScale);
  });

  it('leaves out the release heading when there is one release, and counts in Czech', async () => {
    setActiveLocale('cs');
    const view = await render(
      themed(<WhatsNewSheet releases={releasesSince(RELEASES, '0.3.0', '0.2.0')} since="0.2.0" onClose={() => {}} />),
    );
    expect(view.getByText('Od verze 0.2.0, kterou jste měli: 2 změny')).toBeTruthy();
    expect(view.queryByText(/^Verze 0\.3\.0/)).toBeNull();
    expect(view.getByText('Nové')).toBeTruthy();
    expect(view.getByText('Opraveno')).toBeTruthy();
  });
});

describe('Settings → Co je nového', () => {
  it('lists every release in the app’s language, newest first', async () => {
    setActiveLocale('cs');
    mockLocale = 'cs';
    mockChangelog.cs = RELEASES;
    const view = await render(themed(<ChangelogScreen onBack={() => {}} />));
    const order = ['0.4.0', '0.3.0', '0.2.0', '0.1.0'].map(v => view.getByTestId(`release-${v}`));
    expect(order).toHaveLength(4);
    expect(view.getByText('Verze 0.1.0 · 12.11.2026')).toBeTruthy();
    expect(view.getByText('Pod kapotou')).toBeTruthy();
  });

  it('says so before the first release', async () => {
    setActiveLocale('cs');
    mockLocale = 'cs';
    const view = await render(themed(<ChangelogScreen onBack={() => {}} />));
    expect(view.getByTestId('changelog-empty')).toBeTruthy();
  });
});

const styleOf = (node: { props: Record<string, unknown> }) =>
  (StyleSheet.flatten(node.props.style as StyleProp<TextStyle>) ?? {}) as Record<string, unknown>;

// R9 (031 I49, agreed 2026-11-12): the sheet's title in the title role, each kind an overline over a
// list, each change one paragraph - its sentence in bold ink, the rest after it - behind a faint dot,
// on the sheet itself rather than on cards.
describe('as R9 draws it', () => {
  const sheet = async () => {
    setActiveLocale('en');
    return render(
      themed(<WhatsNewSheet releases={releasesSince(RELEASES, '0.3.0', '0.2.0')} since="0.2.0" onClose={() => {}} />),
    );
  };

  it('titles the sheet in the title role', async () => {
    const view = await sheet();
    const title = styleOf(view.getByText(t('whatsNew.title', { version: '0.3.0' })));
    expect([title.fontSize, title.lineHeight]).toEqual([typeScale.title.fontSize, typeScale.title.lineHeight]);
  });

  it('sets each change as one paragraph, its sentence in bold ink, behind a dot', async () => {
    const view = await sheet();
    const change = view.getByTestId('change-0.3.0-new-0');
    expect(change).toHaveTextContent('A deadline reminder. Set it on a message.');
    const lead = styleOf(within(change).getByText('A deadline reminder.'));
    expect([lead.fontFamily, lead.color]).toEqual([typeScale.smallStrong.fontFamily, lightTheme.text]);
    expect(view.getByTestId('change-0.3.0-new-0-dot', { includeHiddenElements: true })).toBeTruthy();
  });

  it('lists the changes on the sheet, not on cards', async () => {
    const view = await sheet();
    type Node = { props: Record<string, unknown>; children: (Node | string)[] | null };
    const find = (node: Node, testID: string): Node | null =>
      node.props.testID === testID
        ? node
        : (node.children ?? []).reduce<Node | null>(
            (hit, child) => hit ?? (typeof child === 'string' ? null : find(child, testID)),
            null,
          );
    const shadows = (node: Node): number =>
      (styleOf(node).boxShadow != null ? 1 : 0) +
      (node.children ?? []).reduce((n, child) => n + (typeof child === 'string' ? 0 : shadows(child)), 0);
    const roots = ([] as Node[]).concat((view.toJSON() as Node | Node[] | null) ?? []);
    const release = roots.map(root => find(root, 'release-0.3.0')).find(Boolean);
    expect(release).toBeTruthy();
    expect(shadows(release as Node)).toBe(0);
  });
});

// Found on Obalka_Demo (2026-11-15): the Language sheet's card lost the shadow under it - a scroll view
// clips what it holds, and the card's resting shadow reaches 14 under it and 6 beside it. Every sheet's
// content scrolls in that view, so the view reaches past the content as far as it pads it back in.
describe('a sheet s cards keep their shadow', () => {
  it('lets the scrolling content reach past its edge as far as it pads it back', async () => {
    setActiveLocale('en');
    const view = await render(
      themed(<WhatsNewSheet releases={releasesSince(RELEASES, '0.3.0', '0.2.0')} since="0.2.0" onClose={() => {}} />),
    );
    type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };
    const find = (node: Node): Node | null =>
      node.type === 'RCTScrollView'
        ? node
        : (node.children ?? []).reduce<Node | null>(
            (hit, child) => hit ?? (typeof child === 'string' ? null : find(child)),
            null,
          );
    const roots = ([] as Node[]).concat((view.toJSON() as Node | Node[] | null) ?? []);
    const scroll = roots.map(find).find(Boolean) as Node;
    const outer = styleOf(scroll);
    const inner = (StyleSheet.flatten(scroll.props.contentContainerStyle as StyleProp<TextStyle>) ?? {}) as Record<
      string,
      unknown
    >;
    expect(inner.paddingBottom).toBeGreaterThanOrEqual(14);
    expect(inner.paddingHorizontal).toBeGreaterThanOrEqual(6);
    expect([outer.marginBottom, outer.marginHorizontal]).toEqual([
      -(inner.paddingBottom as number),
      -(inner.paddingHorizontal as number),
    ]);
  });
});
