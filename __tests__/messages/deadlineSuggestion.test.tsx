// The suggestion card says what it is (010 US3).
//
// A date the app GUESSED, sitting on a screen where every other line is something the state
// asserted, has one job beyond being right: to be visibly refusable. These assertions are about the
// card's honesty, not its layout - the evidence is shown, the estimate is labelled, and neither
// button does anything until it is pressed.

import { act, fireEvent, render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { DeadlineSuggestionCard } from '../../src/features/messages/screens/DeadlineSuggestion';

const DATE = new Date(2026, 6, 8).getTime(); // 8. 7. 2026

const card = (props: Partial<Parameters<typeof DeadlineSuggestionCard>[0]> = {}) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DeadlineSuggestionCard
        scanning={false}
        suggestion={{ date: DATE, snippet: 'do 8. 7. 2026', fileName: 'rozhodnuti.pdf' }}
        onAccept={() => {}}
        onDismiss={() => {}}
        {...props}
      />
    </TamaguiProvider>,
  );

describe('the deadline suggestion card', () => {
  it('renders nothing when there is neither a scan nor a find', async () => {
    const view = await card({ scanning: false, suggestion: null });
    expect(view.queryByTestId('scan-suggestion')).toBeNull();
  });

  it('shows the date, the phrase it read it from, and the file', async () => {
    const view = await card();
    const box = view.getByTestId('scan-suggestion');
    expect(box).toHaveTextContent(/8\. 7\./);
    expect(box).toHaveTextContent(/do 8\. 7\. 2026/); // the evidence, verbatim
    expect(box).toHaveTextContent(/rozhodnuti\.pdf/);
  });

  // Principle VI. The user must be able to tell this line from the ones ISDS wrote.
  it('says the date is an estimate made on the phone, not a fact from ISDS', async () => {
    const view = await card();
    expect(view.getByTestId('scan-suggestion')).toHaveTextContent(
      /Odhad z dokumentu.*Ověřte/s,
    );
  });

  it('commits nothing by itself - accept and dismiss both wait for a press', async () => {
    const accepted: number[] = [];
    let dismissed = 0;
    const view = await card({
      onAccept: d => accepted.push(d),
      onDismiss: () => {
        dismissed++;
      },
    });
    expect(accepted).toEqual([]);
    expect(dismissed).toBe(0);

    await act(async () => {
      fireEvent.press(view.getByTestId('scan-accept'));
    });
    expect(accepted).toEqual([DATE]);

    await act(async () => {
      fireEvent.press(view.getByTestId('scan-dismiss'));
    });
    expect(dismissed).toBe(1);

    // Each press is wrapped in act() because it schedules work that resolves after the assertion:
    // left loose, it lands inside the NEXT test's render as an overlapping act(), which renders that
    // test's tree as null - an ordering-dependent failure that says nothing about the component.
  });

  it('shows the running indicator while a scan is in flight, with no buttons to press', async () => {
    const view = await card({ scanning: true, suggestion: null });
    expect(view.getByTestId('scan-running')).toBeTruthy();
    expect(view.queryByTestId('scan-accept')).toBeNull();
  });
});
