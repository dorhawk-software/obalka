import { useState } from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { SegmentedControl } from '../../src/theme/SegmentedControl';

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
});
