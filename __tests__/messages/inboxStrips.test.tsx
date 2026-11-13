// The inbox's strips (031 I16, board R14): a tone card inset under the envelope, no hairline - they
// were full-width bars with a coloured rule under them. What they say and do is held by the inbox's
// own tests (reauth, password expiry, the merged view); this holds the shape.

import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { lightTheme } from '../../src/theme/theme';
import { chipTone } from '../../src/theme/chipTone';
import { InboxStrip, StaleLine, StripAction, SyncBar } from '../../src/features/messages/screens/InboxStrips';
import { RegisterSkeleton } from '../../src/features/messages/screens/InboxRows';

const tone = chipTone('dangerSoft', lightTheme);

const inLight = (node: React.ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {node}
    </TamaguiProvider>,
  );

const style = (el: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(el.props.style as never) ?? {}) as Record<string, unknown>;

it('is a tone card inset from the edges, rounded, with no rule under it', async () => {
  const view = await inLight(
    <InboxStrip
      tone={tone}
      message="Platnost přihlášení vypršela."
      action={<StripAction tone={tone} label="Přihlásit znovu" onPress={() => {}} />}
      testID="strip"
    />,
  );
  const s = style(view.getByTestId('strip'));
  expect(s).toMatchObject({ marginLeft: 16, marginRight: 16, borderTopLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: tone.bg });
  expect(s.borderBottomWidth ?? 0).toBe(0);
  expect(s.minHeight).toBe(44);
});

it('puts an expired password\'s two ways out under the message, in order', async () => {
  const view = await inLight(
    <InboxStrip
      tone={tone}
      message="Platnost hesla vypršela."
      actionsBelow={
        <>
          <StripAction tone={tone} label="Změnit v portálu" role="link" below onPress={() => {}} testID="a1" />
          <StripAction tone={tone} label="Přihlásit znovu" below onPress={() => {}} testID="a2" />
        </>
      }
      testID="strip"
    />,
  );
  const strip = view.getByTestId('strip');
  expect(strip).toHaveTextContent('Platnost hesla vypršela.Změnit v portáluPřihlásit znovu');
  expect(view.getByTestId('a1').props.accessibilityRole).toBe('link');
});

it('keeps the stale line quieter: sunken, centred, inset, and closer under a strip', async () => {
  const alone = style((await inLight(<StaleLine kind="offline" afterStrip={false} />)).getByTestId('staleLine'));
  expect(alone).toMatchObject({
    marginLeft: 16,
    marginRight: 16,
    marginTop: 12,
    borderTopLeftRadius: 11,
    borderBottomRightRadius: 11,
    backgroundColor: lightTheme.surfaceSunken,
    justifyContent: 'center',
  });
  expect(alone.borderBottomWidth ?? 0).toBe(0);
  const under = style((await inLight(<StaleLine kind="failed" afterStrip />)).getByTestId('staleLine'));
  expect(under.marginTop).toBe(8);
});

it('draws the sync bar only while syncing, as an inset track that takes no room (I20)', async () => {
  expect((await inLight(<SyncBar active={false} />)).queryByTestId('syncBar', { includeHiddenElements: true })).toBeNull();
  const view = await inLight(<SyncBar active />);
  const track = view.getByTestId('syncBar', { includeHiddenElements: true });
  expect(style(track)).toMatchObject({ position: 'absolute', left: 16, right: 16, height: 3 });
  // Its holder is 0 high: the list under it does not move when a sync starts or ends.
  expect(style(track.parent as never).height).toBe(0);
});

it('loads as the register\'s shape: five rows of a day and two lines', async () => {
  const view = await inLight(<RegisterSkeleton />);
  const blocks = (view.toJSON() as { children: { children: unknown[] }[] }).children;
  expect(blocks).toHaveLength(5);
});
