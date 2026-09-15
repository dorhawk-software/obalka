// The strip that marks every screen while Debug mode is recording (023 FR-007).
//
// FR-007 was half met: a recording did not survive a restart, but the only thing that said one was
// running was the Debug screen - which then told the person to go somewhere else and repeat the bug.
// These tests hold the other half, plus the two properties that make a strip on every screen safe:
// it never shifts the screen someone is looking at, and it never remounts the screen it sits above.

import { enableScreens } from 'react-native-screens';
enableScreens(false);

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { AppNavigator, type AppData } from '../../src/app/AppNavigator';
import { DebugRecordingFrame } from '../../src/app/DebugRecordingStrip';
import { navigationRef } from '../../src/app/navigationRef';
import { LoginFlow } from '../../src/features/accounts/screens/LoginFlow';
import { Welcome } from '../../src/features/accounts/screens/Welcome';
import { FaqScreen } from '../../src/app/settings/FaqScreen';
import type { LoginAuthService } from '../../src/features/accounts/state/loginController';
import { AccountsController } from '../../src/features/accounts/state/accountsController';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemorySecureStore } from '../../src/services/secureStore/secureStore';
import { cancelDebug, startDebug } from '../../src/services/debug/debugController';
import {
  isDebugRecording,
  startDebugRecording,
  stopDebugRecording,
} from '../../src/services/debug/debugLog';
import type { DataBoxAccount } from '../../src/services/isds/types';
import { t } from '../../src/i18n/strings';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const box: DataBoxAccount = {
  dbType: null,
  id: 'box1',
  boxId: 'box1',
  loginName: 'user',
  label: 'Alpha',
  alias: null,
  authMethod: 'password',
  host: 'production',
  secretRef: 'ref',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 0,
  updatedAt: 0,
};

const data: AppData = {
  accounts: [box],
  activeBoxId: 'box1',
  setActive: jest.fn(),
  addBox: jest.fn(),
  removeBox: jest.fn(),
  setAlias: jest.fn(),
  onReauth: jest.fn(),
  reloadAccounts: jest.fn(),
  crossBox: [],
  unified: false,
  onOpenUnified: jest.fn(),
  onRefreshAll: jest.fn(),
};

function ui(node: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {node}
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
}

async function mountNavigator() {
  let view!: Awaited<ReturnType<typeof render>>;
  await act(async () => {
    view = await ui(<AppNavigator {...data} />);
  });
  await waitFor(() => expect(navigationRef.isReady()).toBe(true));
  return view;
}

/** One strip per screen in the stack, except the Debug screen - read from the navigator itself. */
function stripsExpected(): number {
  return navigationRef.getRootState().routes.filter(r => r.name !== 'Debug').length;
}

/**
 * Every strip in the stack, the covered screens' included. Under jest the stack keeps a covered screen
 * mounted but `display: none` - the test renderer's version of being covered on a phone - and queries
 * skip hidden elements unless asked, so a count of visible strips would only ever see the top screen.
 */
function allStrips(view: Awaited<ReturnType<typeof render>>) {
  return view.queryAllByTestId('debugRecordingStrip', { includeHiddenElements: true });
}

afterEach(async () => {
  await act(async () => {
    cancelDebug();
  });
});

describe('in the navigator', () => {
  it('marks every screen but the Debug screen while recording, and none once it stops', async () => {
    const view = await mountNavigator();
    expect(allStrips(view)).toHaveLength(0);

    await act(async () => {
      navigationRef.navigate('Settings');
    });
    await act(async () => {
      navigationRef.navigate('Debug');
    });
    // Started where the app starts it: on the Debug screen.
    await fireEvent.press(await view.findByTestId('debug-toggle'));
    expect(isDebugRecording()).toBe(true);
    // The inbox and Settings, covered by the Debug screen, carry the strip. The Debug screen does not.
    expect(stripsExpected()).toBe(2);
    await waitFor(() => expect(allStrips(view)).toHaveLength(2));
    // ...and the one in front, the Debug screen, shows none.
    expect(view.queryAllByTestId('debugRecordingStrip')).toHaveLength(0);

    // A screen opened while recording has the strip from its first frame.
    await act(async () => {
      navigationRef.navigate('Search');
    });
    expect(allStrips(view)).toHaveLength(stripsExpected());
    expect(stripsExpected()).toBe(3);
    expect(view.getByTestId('debugRecordingStrip')).toBeTruthy();

    await act(async () => {
      navigationRef.goBack();
    });
    expect(navigationRef.getCurrentRoute()?.name).toBe('Debug');
    await fireEvent.press(view.getByTestId('debug-toggle'));
    await waitFor(() => expect(view.getByTestId('debug-notice')).toBeTruthy());
    expect(isDebugRecording()).toBe(false);
    expect(allStrips(view)).toHaveLength(0);
  });

  it('opens the Debug screen when tapped', async () => {
    const view = await mountNavigator();
    await act(async () => {
      startDebug('standard');
    });
    const strip = await view.findByTestId('debugRecordingStrip');
    expect(strip).toHaveTextContent(t('debug.indicator'));
    await fireEvent.press(strip);
    expect(navigationRef.getCurrentRoute()?.name).toBe('Debug');
    expect(view.getByTestId('debug-toggle')).toHaveTextContent(t('debug.stop'));
  });

  it('can only appear or disappear under the Debug screen, because nothing else starts or stops it', () => {
    // The no-layout-jump argument rests on this (constitution V): the strip is never drawn on the
    // Debug screen, so as long as that screen is the only place a recording starts or stops, the
    // strip never comes or goes on the screen in front of the person. A second caller anywhere else
    // makes the strip jump there, and this is where that has to be argued first.
    const SRC = join(__dirname, '../../src');
    const DEBUG_SERVICES = join(SRC, 'services', 'debug');
    const CALL =
      /\b(startDebug|stopDebugAndWrite|cancelDebug|startDebugRecording|stopDebugRecording)\s*\(/;
    const withoutComments = (text: string) =>
      text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter(line => !/^\s*(\/\/|\*)/.test(line))
        .join('\n');
    const sources = (dir: string): string[] =>
      readdirSync(dir).flatMap(entry => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          return sources(full);
        }
        return /\.tsx?$/.test(entry) ? [full] : [];
      });
    const callers = sources(SRC)
      .filter(file => !file.startsWith(DEBUG_SERVICES))
      .filter(file => CALL.test(withoutComments(readFileSync(file, 'utf8'))))
      .map(file => relative(SRC, file));
    expect(callers).toEqual([join('app', 'settings', 'DebugScreen.tsx')]);
  });
});

describe('the frame around a screen', () => {
  function InsetProbe() {
    const insets = useSafeAreaInsets();
    return <Text testID="probe">{`${insets.top}/${insets.bottom}`}</Text>;
  }

  it('hands the screen a spent top inset, so its header does not clear the status bar twice', async () => {
    const view = await ui(
      <DebugRecordingFrame onOpen={() => {}}>
        <InsetProbe />
      </DebugRecordingFrame>,
    );
    expect(view.getByTestId('probe')).toHaveTextContent('47/34');
    await act(async () => {
      startDebugRecording('standard');
    });
    // The strip clears the status bar; the screen below starts under the strip.
    expect(view.getByTestId('probe')).toHaveTextContent('0/34');
    expect(view.getByTestId('debugRecordingStrip')).toHaveStyle({ paddingTop: 47 });
    await act(async () => {
      stopDebugRecording();
    });
    expect(view.getByTestId('probe')).toHaveTextContent('47/34');
    expect(view.queryByTestId('debugRecordingStrip')).toBeNull();
  });

  it('never remounts the screen under it when recording starts or stops', async () => {
    let mounts = 0;
    function HalfWrittenMessage() {
      const [text] = useState('Dobrý den, posílám');
      useEffect(() => {
        mounts += 1;
      }, []);
      return <Text>{text}</Text>;
    }
    await ui(
      <DebugRecordingFrame onOpen={() => {}}>
        <HalfWrittenMessage />
      </DebugRecordingFrame>,
    );
    await act(async () => {
      startDebugRecording('full');
    });
    await act(async () => {
      stopDebugRecording();
    });
    await act(async () => {
      startDebugRecording('standard');
    });
    expect(mounts).toBe(1);
  });

  it('stays off a screen that asks for it to be hidden', async () => {
    await act(async () => {
      startDebugRecording('standard');
    });
    const view = await ui(
      <DebugRecordingFrame hidden onOpen={() => {}}>
        <InsetProbe />
      </DebugRecordingFrame>,
    );
    expect(view.queryByTestId('debugRecordingStrip')).toBeNull();
    expect(view.getByTestId('probe')).toHaveTextContent('47/34');
  });

  it('draws one strip for a screen framed twice, and none under a hidden frame', async () => {
    // Screens drawn by the shell frame themselves, and the FAQ is one of them - which the navigator
    // frames too when it is a route. Two strips there would stack, the second clearing nothing.
    await act(async () => {
      startDebugRecording('standard');
    });
    const view = await ui(
      <DebugRecordingFrame onOpen={() => {}}>
        <DebugRecordingFrame>
          <InsetProbe />
        </DebugRecordingFrame>
      </DebugRecordingFrame>,
    );
    expect(view.getAllByTestId('debugRecordingStrip')).toHaveLength(1);
    // The outer one - the one that can open the Debug screen.
    expect(view.getByRole('button', { name: t('debug.indicator') })).toBeTruthy();
    expect(view.getByTestId('probe')).toHaveTextContent('0/34');
    await view.unmount();

    const onDebugScreen = await ui(
      <DebugRecordingFrame hidden onOpen={() => {}}>
        <DebugRecordingFrame>
          <InsetProbe />
        </DebugRecordingFrame>
      </DebugRecordingFrame>,
    );
    expect(onDebugScreen.queryByTestId('debugRecordingStrip')).toBeNull();
    expect(onDebugScreen.getByTestId('probe')).toHaveTextContent('47/34');
  });
});

describe('outside the navigator', () => {
  const auth: LoginAuthService = {
    beginLogin: async () => ({ kind: 'needsOtpSms' }),
    submitOtp: async () => ({ kind: 'needsOtpSms' }),
    resendSms: async () => ({ kind: 'needsOtpSms' }),
    mobileKeyLogin: async () => ({ kind: 'needsOtpSms' }),
    abandon: async () => {},
  };
  const deps = {
    authService: auth,
    accountsController: new AccountsController({
      accounts: new InMemoryAccountsStore(),
      secureStore: new InMemorySecureStore(),
    }),
    host: 'czebox' as const,
  };

  it('marks the sign-in flow too, as a label rather than a button that could lead nowhere', async () => {
    // Adding or re-authorising a box is drawn by the shell, not the navigator, and a sign-in bug is
    // exactly the kind of thing somebody records. There is no Debug screen to open from there.
    await act(async () => {
      startDebugRecording('standard');
    });
    const view = await ui(<LoginFlow deps={deps} />);
    expect(view.getByTestId('debugRecordingStrip')).toHaveTextContent(t('debug.indicator'));
    expect(view.queryByRole('button', { name: t('debug.indicator') })).toBeNull();
    expect(view.getByText(t('login.title'))).toBeTruthy();
  });

  it('marks Welcome, where removing the last box during a recording lands', async () => {
    await act(async () => {
      startDebugRecording('standard');
    });
    const view = await ui(<Welcome onAddBox={() => {}} onOpenFaq={() => {}} onRestore={() => {}} canTransfer={false} />);
    expect(view.getByTestId('debugRecordingStrip')).toHaveTextContent(t('debug.indicator'));
    expect(view.queryByRole('button', { name: t('debug.indicator') })).toBeNull();
    expect(view.getByTestId('welcome-add-box')).toBeTruthy();
  });

  it('marks help wherever it is drawn: over the sign-in flow, and once as a navigator route', async () => {
    // The shell draws help OVER the sign-in flow and Welcome, covering their strips, so it carries
    // its own - a label, like theirs.
    await act(async () => {
      startDebugRecording('standard');
    });
    const overlay = await ui(<FaqScreen onBack={() => {}} />);
    expect(overlay.getByTestId('debugRecordingStrip')).toHaveTextContent(t('debug.indicator'));
    expect(overlay.queryByRole('button', { name: t('debug.indicator') })).toBeNull();
    await overlay.unmount();

    // Reached through the navigator it is framed there already: one strip, the one that opens Debug.
    const view = await mountNavigator();
    await act(async () => {
      navigationRef.navigate('Faq');
    });
    expect(navigationRef.getCurrentRoute()?.name).toBe('Faq');
    expect(view.getAllByTestId('debugRecordingStrip')).toHaveLength(1);
    expect(view.getByRole('button', { name: t('debug.indicator') })).toBeTruthy();
  });
});
