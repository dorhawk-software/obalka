// The licence screens as board R13 draws them (031 I48, agreed 2026-11-12): the app's own licence as
// a card first, then the search on the page's own tone, the bundled components, and one row per
// licence; a licence's components on a screen of their own under a link to its full text; and one
// component's licence as its text in monospace, its own copyright notice set where the licence has
// one. With nothing found, the glyph in a disc and one sentence.
//
// The texts flow as paragraphs, as R13 draws them (the owner, 2026-11-15): spec 012 kept each source
// line break, which in a phone's monospace wrapped every 80-character line a second time. Only the
// line-break whitespace inside a paragraph changes - the words are the licence's, byte for byte.

import { fireEvent, render, within } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { plural, t } from '../../src/i18n/strings';
import { APP_VERSION } from '../../src/app/appInfo';
import {
  ATTRIBUTION_GROUPS,
  BUNDLED_COMPONENTS,
  LICENCE_TEXTS,
} from '../../src/content/attributions.generated';
import { LicencesScreen } from '../../src/app/settings/LicencesScreen';
import { LicenceGroupScreen } from '../../src/app/settings/LicenceGroupScreen';
import { LicenceDetailScreen } from '../../src/app/settings/LicenceDetailScreen';
import { flowParagraphs, withNotice } from '../../src/app/settings/licenceText';
import type { ReactElement } from 'react';

const themed = (ui: ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>{ui}</AppThemeProvider>
    </TamaguiProvider>,
  );

const mountList = async () => {
  const onOpenGroup = jest.fn();
  const onOpenText = jest.fn();
  const view = await themed(
    <LicencesScreen onBack={() => {}} onOpenGroup={onOpenGroup} onOpenText={onOpenText} />,
  );
  return { view, onOpenGroup, onOpenText };
};

const words = (text: string) => text.split(/\s+/).filter(Boolean);

describe('the licence texts, flowed', () => {
  it('keeps every word of every licence, in order', () => {
    for (const [spdx, text] of Object.entries(LICENCE_TEXTS)) {
      expect({ spdx, words: words(flowParagraphs(text)) }).toEqual({ spdx, words: words(text) });
    }
  });

  it('joins a sentence s lines, and keeps the paragraphs, headings and list items apart', () => {
    for (const text of Object.values(LICENCE_TEXTS)) {
      const flowed = flowParagraphs(text);
      expect(flowed.split('\n\n')).toHaveLength(text.trim().split(/\n\s*\n/).length);
    }
    // The MIT body is two sentences' worth of hard-wrapped lines: each paragraph becomes one line.
    expect(flowParagraphs(LICENCE_TEXTS.MIT).split('\n\n').every(p => !p.includes('\n'))).toBe(true);
    // OFL's headings keep a line of their own, and so does each of Apache's lettered items.
    expect(flowParagraphs(LICENCE_TEXTS['OFL-1.1'])).toMatch(/\nPREAMBLE\n|\n\nPREAMBLE\n/);
    expect(flowParagraphs(LICENCE_TEXTS['Apache-2.0'])).toMatch(/\n\(b\) You must/);
  });

  it('sets a component s notice under the licence s title, or above a licence with none', () => {
    const notice = 'Copyright (c) Meta Platforms, Inc. and affiliates.';
    expect(withNotice(LICENCE_TEXTS.MIT, notice).split('\n\n').slice(0, 3)).toEqual([
      'MIT License',
      notice,
      expect.stringMatching(/^Permission is hereby granted/),
    ]);
    expect(withNotice(LICENCE_TEXTS.Zlib, notice).split('\n\n')[0]).toBe(notice);
  });
});

describe('the Licence screen, as R13 draws it', () => {
  it('leads with the app s own licence, which opens in full', async () => {
    const { view, onOpenText } = await mountList();
    const card = view.getByTestId('licence-app');
    expect(within(card).getByText(t('licences.appName'))).toBeTruthy();
    expect(within(card).getByText(t('licences.appSpdx'))).toBeTruthy();
    expect(within(card).getByText(t('licences.copyright'))).toBeTruthy();
    await fireEvent.press(card);
    expect(onOpenText).toHaveBeenCalledWith({
      spdx: 'MIT',
      component: { name: t('licences.appName'), version: APP_VERSION, copyright: t('licences.copyright') },
    });
  });

  it('lists each licence once, with its count, and no components under it', async () => {
    const { view, onOpenGroup } = await mountList();
    for (const group of ATTRIBUTION_GROUPS) {
      const row = view.getByTestId(`licence-group-${group.spdx}`);
      expect(
        within(row).getByText(t(`licences.groupCount.${plural(group.count)}`, { n: group.count })),
      ).toBeTruthy();
    }
    expect(view.queryByText(ATTRIBUTION_GROUPS[0].components[0].name)).toBeNull();
    await fireEvent.press(view.getByTestId(`licence-group-${ATTRIBUTION_GROUPS[0].spdx}`));
    expect(onOpenGroup).toHaveBeenCalledWith(ATTRIBUTION_GROUPS[0].spdx);
  });

  it('opens a bundled component s own text', async () => {
    const { view, onOpenText } = await mountList();
    const first = BUNDLED_COMPONENTS[0];
    await fireEvent.press(view.getByTestId(`licence-row-${first.name}`));
    expect(onOpenText).toHaveBeenCalledWith({
      spdx: first.spdx,
      component: { name: first.name, version: first.version, copyright: first.copyright },
    });
  });

  it('finds a component by name, whatever the case', async () => {
    const { view } = await mountList();
    await fireEvent.changeText(view.getByTestId('licence-search'), 'sqlcipher');
    expect(view.getByTestId('licence-row-SQLCipher')).toBeTruthy();
    expect(view.queryByTestId('licence-app')).toBeNull();
  });

  it('says nothing matched as the glyph in a disc and one sentence', async () => {
    const { view } = await mountList();
    await fireEvent.changeText(view.getByTestId('licence-search'), 'qwerty');
    const none = view.getByTestId('licence-no-results');
    expect(within(none).getByText(t('licences.noResults'))).toBeTruthy();
    expect(within(none).getByTestId('licence-no-results-disc', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('a licence group, as R13 draws it', () => {
  const group = ATTRIBUTION_GROUPS[0];

  it('heads its components with a link to the full text, and opens each one s own', async () => {
    const onOpenText = jest.fn();
    const view = await themed(
      <LicenceGroupScreen spdx={group.spdx} onBack={() => {}} onOpenText={onOpenText} />,
    );
    expect(
      view.getByText(`${group.spdx} · ${t(`licences.groupCount.${plural(group.count)}`, { n: group.count })}`),
    ).toBeTruthy();
    await fireEvent.press(view.getByTestId('licence-full-text'));
    expect(onOpenText).toHaveBeenLastCalledWith({ spdx: group.spdx });
    const first = group.components[0];
    await fireEvent.press(view.getByTestId(`licence-row-${first.name}`));
    expect(onOpenText).toHaveBeenLastCalledWith({ spdx: group.spdx, component: first });
  });

  it('searches within the group', async () => {
    const view = await themed(<LicenceGroupScreen spdx={group.spdx} onBack={() => {}} onOpenText={() => {}} />);
    const [first, second] = group.components;
    await fireEvent.changeText(view.getByTestId('licence-search'), first.name);
    expect(view.getByTestId(`licence-row-${first.name}`)).toBeTruthy();
    expect(view.queryByTestId(`licence-row-${second.name}`)).toBeNull();
  });
});

describe('one licence s text, as R13 draws it', () => {
  it('names the component, its version and licence, and reproduces its notice in the text', async () => {
    const component = { name: 'react', version: '19.2.3', copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.' };
    const view = await themed(<LicenceDetailScreen spdx="MIT" component={component} onBack={() => {}} />);
    expect(view.getByTestId('licence-text-name')).toHaveTextContent('react');
    expect(view.getByTestId('licence-text-meta')).toHaveTextContent('19.2.3 · MIT');
    expect(view.getByTestId('licence-text').props.children).toBe(
      flowParagraphs(withNotice(LICENCE_TEXTS.MIT, component.copyright)),
    );
  });

  it('shows a licence alone when no component is named', async () => {
    const view = await themed(<LicenceDetailScreen spdx="ISC" onBack={() => {}} />);
    expect(view.getByTestId('licence-text-name')).toHaveTextContent('ISC');
    expect(view.getByTestId('licence-text').props.children).toBe(flowParagraphs(LICENCE_TEXTS.ISC));
  });
});
