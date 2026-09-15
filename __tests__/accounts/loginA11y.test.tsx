// The login path is usable without sight (001 T042).
//
// This is the path where a person types a password and a one-time code under a clock, and it is the
// one screen set a screen-reader user cannot skip. The audit that produced this file found the
// labelling already sound - 009/013/016 did that work - so most of what is here PINS what is true
// rather than fixing what was not.
//
// Two things it did change: the screen titles now carry `accessibilityRole="header"` (there were
// none in the whole app, so a screen reader had nothing to jump between), and the primary buttons
// took `minHeight` in place of `height`, which keeps the design's metric at the default font scale
// and stops the label being cropped by its own container at large ones.

import { readFileSync } from 'fs';
import { render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { AddBoxForm } from '../../src/features/accounts/screens/AddBoxForm';
import { OtpForm } from '../../src/features/accounts/screens/OtpForm';
import { Welcome } from '../../src/features/accounts/screens/Welcome';

jest.mock('../../src/services/sms/smsUserConsent', () => ({
  listenForSmsCode: jest.fn(() => () => {}),
  smsAutofillAvailable: jest.fn(() => false),
}));

const wrap = (node: React.ReactElement) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {node}
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

type Node = { props?: Record<string, unknown>; children?: unknown[] };

function walk(json: unknown, visit: (props: Record<string, unknown>) => void): void {
  if (json == null || typeof json !== 'object') {
    return;
  }
  const n = json as Node;
  if (n.props) {
    visit(n.props);
  }
  for (const child of n.children ?? []) {
    walk(child, visit);
  }
}

const screens: [string, () => React.ReactElement][] = [
  ['Welcome', () => <Welcome onAddBox={() => {}} onOpenFaq={() => {}} onRestore={() => {}} canTransfer={false} />],
  [
    'AddBoxForm',
    () => <AddBoxForm onSubmit={async () => {}} onBack={() => {}} onOpenFaq={() => {}} />,
  ],
  ['OtpForm', () => <OtpForm onSubmit={() => {}} onCancel={() => {}} onResend={() => {}} />],
];

describe.each(screens)('%s', (_name, build) => {
  it('gives every control something a screen reader can announce', async () => {
    const view = await wrap(build());
    const unlabelled: string[] = [];
    walk(view.toJSON(), p => {
      if (typeof p.onPress !== 'function') {
        return;
      }
      const named =
        typeof p.accessibilityLabel === 'string' ||
        typeof p.accessibilityRole === 'string';
      if (!named) {
        unlabelled.push(String(p.testID ?? '(no testID)'));
      }
    });
    expect(unlabelled).toEqual([]);
  });

});

describe('screen titles', () => {
  it('are announced as headings, so they can be jumped to', async () => {
    const view = await wrap(
      <OtpForm onSubmit={() => {}} onCancel={() => {}} onResend={() => {}} />,
    );
    let headers = 0;
    walk(view.toJSON(), p => {
      if (p.accessibilityRole === 'header') {
        headers++;
      }
    });
    expect(headers).toBeGreaterThan(0);
  });
});

/**
 * A fixed `height` on a box whose child is text is how a label gets cropped once the OS font scale
 * goes up - the setting the person most likely to need this screen is most likely to be using.
 *
 * Checked in the SOURCE rather than the rendered tree: an earlier version of this walked the tree
 * looking for pressables with a tall style, passed happily, and caught nothing - the height sits on
 * the visual CHILD of the pressable, not on the element carrying `onPress`. A test that cannot fail
 * is worse than no test, so this asserts the thing that is actually written down.
 */
describe('no screen caps a text box height', () => {
  // Extended app-wide 2026-09-08 after the login pass proved it finds real defects: fourteen more
  // containers across compose, the message detail, the shared screen header and three dialogs were
  // capping their own labels.
  const SCREENS = [
    'src/theme/ScreenHeader.tsx',
    ...[
      'AddBoxForm', 'OtpForm', 'ReauthForm', 'Welcome', 'AliasEditor',
      'RemoveBoxDialog', 'LoginFlow', 'BoxSwitcherSheet',
    ].map(n => `src/features/accounts/screens/${n}.tsx`),
    ...['MessageList', 'MessageDetail', 'ComposeScreen', 'SearchScreen', 'TermPicker'].map(
      n => `src/features/messages/screens/${n}.tsx`,
    ),
  ];

  /**
   * Fixed heights that hold no text, so nothing can be cropped. Each one is a graphic:
   *   Welcome / LoginFlow  the brand tile and the Mobile Key pulse ring
   *   MessageDetail        a loading Skeleton
   *   ComposeScreen        the multiline body input - a text AREA scrolls rather than clipping, and
   *                        120 is its opening size, not a lid on its content
   * Anything new has to argue its way in here rather than pass silently.
   */
  const ALLOWED = new Set([
    'Welcome.tsx:120',
    'LoginFlow.tsx:104',
    'LoginFlow.tsx:84',
    'MessageDetail.tsx:48',
    'ComposeScreen.tsx:120',
  ]);

  it.each(SCREENS)('%s', file => {
    const src = readFileSync(file, 'utf8');
    const name = file.split('/').pop() as string;
    const offenders = [...src.matchAll(/\bheight=\{(\d+)\}/g)]
      .map(m => Number(m[1]))
      // Under 48 is an icon target, a hairline or a dot; none of them carries a label.
      .filter(h => h >= 48)
      .map(h => `${name}:${h}`)
      .filter(k => !ALLOWED.has(k));
    expect(offenders).toEqual([]);
  });
});
