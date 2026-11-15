import { useState } from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { SegmentedControl } from '../../src/theme/SegmentedControl';
import { type as typeScale } from '../../src/theme/typeScale';
import { lightTheme } from '../../src/theme/theme';

function Harness() {
  const [value, setValue] = useState<'received' | 'sent'>('received');
  return (
    <SegmentedControl
      segments={[
        { key: 'received' as const, label: 'Přijaté' },
        { key: 'sent' as const, label: 'Odeslané' },
      ]}
      value={value}
      onChange={setValue}
      testID="seg"
    />
  );
}

describe('SegmentedControl', () => {
  it('renders both segments and switches the selection on press', async () => {
    const view = await render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Harness />
      </TamaguiProvider>,
    );
    const received = view.getByTestId('seg-received');
    const sent = view.getByTestId('seg-sent');
    expect(view.getByText('Přijaté')).toBeTruthy();
    expect(view.getByText('Odeslané')).toBeTruthy();
    // starts on received
    expect(received.props.accessibilityState).toMatchObject({ selected: true });
    expect(sent.props.accessibilityState).toMatchObject({ selected: false });

    await act(async () => {
      fireEvent.press(sent);
    });
    expect(view.getByTestId('seg-sent').props.accessibilityState).toMatchObject(
      {
        selected: true,
      },
    );
    expect(
      view.getByTestId('seg-received').props.accessibilityState,
    ).toMatchObject({ selected: false });
  });

  it('sets its words in Public Sans Bold 14, the boards\' 14/700 (031 I107)', async () => {
    // Until 2026-11-15 the words named a weight and no face, so Android drew them in Roboto beside
    // Public Sans everywhere else (the inbox walk at full resolution, InboxA's "Přijaté").
    const view = await render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Harness />
      </TamaguiProvider>,
    );
    for (const label of ['Přijaté', 'Odeslané']) {
      const style = StyleSheet.flatten(view.getByText(label).props.style as StyleProp<TextStyle>) ?? {};
      expect([style.fontFamily, style.fontSize]).toEqual([typeScale.smallStrong.fontFamily, 14]);
    }
  });

  it('draws the selected fill on the first frame, before the track is measured (031 I107)', async () => {
    // The sliding fill needs the track's width; until 2026-11-15 the selected tab showed bare words
    // for the frame before it (a cold start's flash). Jest never lays out, so this is that frame.
    const view = await render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Harness />
      </TamaguiProvider>,
    );
    const style = (id: string) => {
      const { style: s } = view.getByTestId(id).props as { style: StyleProp<TextStyle> };
      return StyleSheet.flatten(s) ?? {};
    };
    expect(style('seg-received').backgroundColor).toBe(lightTheme.surface);
    expect(style('seg-sent').backgroundColor).toBeUndefined();
  });
});
