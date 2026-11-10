// What's new (spec 029): after an update, once, what changed since the version this phone had.
//
// The decision is the part that is easy to get wrong in a way nobody notices - a sheet on a fresh
// install describing changes the person never had, the same sheet on every launch, or one interrupting
// them over a library update - so it is tested first and on its own.

import { fireEvent, render } from '@testing-library/react-native';
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
    expect(view.getByText('A deadline reminder.')).toBeTruthy();
    expect(view.getByText('Set it on a message.')).toBeTruthy();
    expect(view.getAllByText('New')).toHaveLength(1);
    fireEvent.press(view.getByTestId('whats-new-continue'));
    expect(onClose).toHaveBeenCalledTimes(1);
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
