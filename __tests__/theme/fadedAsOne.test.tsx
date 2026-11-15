// A faded part is faded as one picture (031 I38, raised for T050).
//
// Android applies a View's opacity to each child on its own unless the View is composited off-screen:
// faded words then sit on faded ink and sink into it. Odeslat showed it on the device (I38); NeutralButton,
// a dimmed settings row and the SMS code's button were composited since. These are the rest.

import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { InkButton } from '../../src/theme/InkButton';
import { DownloadButton } from '../../src/features/messages/screens/AttachmentCards';
import { WaitingWindow } from '../../src/features/messages/screens/ComposeEnvelope';

const wrap = (child: ReactElement) => (
  <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
    <AppThemeProvider isDark={false}>{child}</AppThemeProvider>
  </TamaguiProvider>
);

type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };
const faded = (root: unknown): Node[] => {
  const out: Node[] = [];
  const walk = (n: Node | string) => {
    if (typeof n === 'string') {
      return;
    }
    if ((StyleSheet.flatten(n.props.style as never) as { opacity?: number } | undefined)?.opacity === 0.55) {
      out.push(n);
    }
    (n.children ?? []).forEach(walk);
  };
  (Array.isArray(root) ? root : root ? [root] : []).forEach(walk);
  return out;
};

it.each<[string, ReactElement]>([
  ['a blocked ink button', <InkButton label="Uložit" onPress={() => {}} blockedReason="Chybí heslo" />],
  ['the busy download', <DownloadButton label="Stáhnout" busyLabel="Stahuje se" busy onPress={() => {}} />],
  ['compose\'s waiting window', <WaitingWindow />],
])('%s fades as one picture', async (_name, element) => {
  const view = await render(wrap(element));
  const layers = faded(view.toJSON());
  expect(layers.length).toBeGreaterThan(0);
  expect(layers.map(l => l.props.needsOffscreenAlphaCompositing)).toEqual(layers.map(() => true));
});
