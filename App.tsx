/**
 * Obálka — datová schránka. App entry: settings (theme + language) → Tamagui + theme provider →
 * the app shell. A language change re-localizes in place (screens subscribe via useLocale); the tree
 * is not remounted, so the user stays on their current screen.
 *
 * @format
 */

import { useEffect } from 'react';
import { Appearance, StatusBar, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from './tamagui.config';
import { AppThemeProvider } from './src/theme/ThemeProvider';
import { ContentColumn } from './src/theme/ContentColumn';
import { AppShell } from './src/app/AppShell';
import { LaunchScreen } from './src/app/LaunchScreen';
import { DEMO_DATA, seedDemoArchive } from './src/dev/demoData';
import { LockGate } from './src/app/lock/LockGate';
import { VaultLostNotice } from './src/app/lock/VaultLostNotice';
import {
  SettingsProvider,
  useSettings,
} from './src/app/settings/SettingsProvider';
import {
  appLock as appLockService,
  endSignInsLeftOver,
  excludeAppDataFromDeviceBackup,
  transferController,
  vaultSecrets,
} from './src/features/accounts/deps';
import { darkTheme, lightTheme } from './src/theme/theme';
import {
  lastAppearanceIsDark,
  setSystemBarsAppearance,
} from './src/services/systemBars';
import { startTelemetry } from './src/services/telemetry/telemetry';
import { SENTRY_ENVIRONMENT } from './src/services/telemetry/dsn';
import { APP_VERSION } from './src/app/appInfo';

function AppInner() {
  const { themeMode, appLock, ready, telemetry, loadFailure, retryLoad } = useSettings();
  const systemDark = useColorScheme() === 'dark';
  const isDark = themeMode === 'system' ? systemDark : themeMode === 'dark';

  // The appearance actually on screen right now.
  //
  // Before the settings read resolves, `themeMode` is still its 'system' default, so this used to
  // follow the phone rather than the user's choice — a user who picked Light on a dark phone got
  // dark window → dark blank frame → light app, on every cold start. The last resolved appearance is
  // written natively whenever it changes and read back synchronously at import, so the frame before
  // the database answers is already right. With nothing stored (a first launch) the OS is still the
  // only honest guess. iOS has no equivalent read, because its launch screen is drawn before any
  // code runs; what it does get is the WRITE below, which is what the privacy cover reads.
  const shownDark = ready ? isDark : lastAppearanceIsDark ?? systemDark;

  // The bottom edge of the screen. `StatusBar` below re-applies the TOP edge on every render, but
  // React Native points the navigation bar at the OS appearance once, at Activity create, and never
  // again — so an app theme differing from the phone's left a light gesture pill on the warm paper,
  // and an OS theme flipped mid-session never reached it at all (`configChanges` includes `uiMode`,
  // so nothing is re-created). Driven here by the same value the app is painting with, which is also
  // what persists it for the next launch.
  useEffect(() => {
    setSystemBarsAppearance(shownDark);
    // The same fact, told to UIKit. iOS decides `LaunchBackground` (and every other named colour)
    // from the WINDOW's interface style, which otherwise only ever reflects the phone - so a user
    // who picks Tmavý on a light iPhone got the app in dark and its privacy cover in light paper,
    // because the cover is the launch storyboard and the storyboard asks UIKit, not us. This sets
    // `overrideUserInterfaceStyle` on every window (see RCTAppearance), which the cover inherits
    // like any other subview. Android has its own path for this, one line above; on iOS there was
    // no path at all, which is why the comment above used to write iOS off.
    Appearance.setColorScheme(shownDark ? 'dark' : 'light');
  }, [shownDark]);

  // Keep the app's files out of the phone's own backup - iCloud or a computer backup (2026-09-24).
  // iOS backs up `Documents` by default, and that is where attachments, signed originals, backup
  // files and debug ZIPs live; the keys that open the rest never leave this phone anyway. At every
  // launch rather than once, because a mark can be lost with the item it was set on - see
  // `deviceBackupExclusion.ts`. Nothing waits on it and it never rejects. Android needs no step: its
  // manifest says the same.
  useEffect(() => {
    void excludeAppDataFromDeviceBackup();
  }, []);

  // Fictional mail for the README's screenshots. Inert: `DEMO_DATA` is committed false and the seed
  // itself refuses outside `__DEV__` and on any device that already holds a box. It writes to the
  // archive rather than faking a render, so the pictures are of the real screens reading real
  // storage. Seeds on one launch and shows on the next, because the shell has already read the
  // (empty) account list by the time this runs.
  useEffect(() => {
    if (__DEV__ && DEMO_DATA) {
      void seedDemoArchive();
    }
  }, []);

  // Clear what a previous RUN left staged for a phone-to-phone transfer (025).
  //
  // Cancelling sweeps, and starting the next transfer sweeps - but a process that is simply KILLED
  // does neither, and Android kills processes without asking. Walked on the device: a send waiting
  // for a receiver, force-stopped, left 6.9 MB of sealed archive and `recovery.key` sitting in the
  // cache, and relaunching did not touch them.
  //
  // The key is the half that matters. It opens the whole backup, it belongs in the Keystore, and it
  // is written to disk only for the seconds a transfer needs it - so a kill quietly turned "seconds"
  // into "until somebody happens to start another transfer". Here, at start-up, nothing is in
  // flight, so there is nothing to sweep that anybody is still using.
  useEffect(() => {
    void transferController.sweepStale();
  }, []);

  // And what a previous run left of a sign-in in the shared cookie jar (018 FR-003): a process killed
  // mid-sign-in, or a response that landed after its cancel, kept a half-finished handshake there
  // until the next sign-in. The same reasoning as the sweep above: at start-up no sign-in is running.
  useEffect(() => {
    void endSignInsLeftOver();
  }, []);

  // Seal what earlier builds stored in plain - box passwords, and the session cookies 018 kept in the
  // accounts table - under the vault key (001 T028). At launch rather than at the first secret read,
  // so that a phone with no box discards a key an earlier install left in the Keychain before a new
  // box could find it. With the app lock on this waits for the unlock, and it never rejects.
  useEffect(() => {
    void vaultSecrets.prepare();
  }, []);

  // Start the reporter once the persisted consent is known, and again with every later answer: a yes
  // starts the SDK, a no closes it. Nothing is started before a yes (2026-09-24).
  //
  // Gated on `ready` deliberately: starting earlier would mean starting with the DEFAULT rather than
  // the user's answer, and a diagnostic tool that transmits before reading the switch is not a
  // diagnostic tool, it is the bug. The cost is that a crash in the few hundred milliseconds before
  // the settings row is read goes unreported — which is the right trade, and worth knowing.
  useEffect(() => {
    if (ready) {
      startTelemetry({
        // `null` is "not asked yet", and it transmits nothing - the same as a decline, until the
        // consent card turns it into a real answer.
        enabled: telemetry === true,
        release: APP_VERSION,
        environment: SENTRY_ENVIRONMENT,
      });
    }
  }, [ready, telemetry]);

  return (
    <TamaguiProvider
      config={tamaguiConfig}
      defaultTheme={shownDark ? 'dark' : 'light'}
    >
      <AppThemeProvider isDark={shownDark}>
        <SafeAreaProvider>
          <StatusBar barStyle={shownDark ? 'light-content' : 'dark-content'} />
          {ready ? (
            // The biometric lock (if enabled) gates everything; inside, no key on AppShell so a
            // language change re-localizes in place rather than remounting (the user stays put).
            // ContentColumn is the app's only concession to a screen wider than a phone, and it is
            // applied HERE so every screen inherits it — see the component for why that is enough.
            <ContentColumn>
              <LockGate enabled={appLock} lock={appLockService}>
                <AppShell />
                {/* Why every box asks to sign in again when the phone invalidated the vault key. */}
                <VaultLostNotice source={vaultSecrets} />
              </LockGate>
            </ContentColumn>
          ) : loadFailure !== null ? (
            // The settings would not read - the database key is a Keychain item, and the Keychain
            // failed. This used to stay the blank view below for good (2026-09-24). Nothing behind
            // the lock is drawn: whether it is on is exactly what could not be read.
            <LaunchScreen failed={loadFailure === 'failed'} onRetry={retryLoad} />
          ) : (
            <View
              style={{
                flex: 1,
                backgroundColor: (shownDark ? darkTheme : lightTheme).bg,
              }}
            />
          )}
        </SafeAreaProvider>
      </AppThemeProvider>
    </TamaguiProvider>
  );
}

function App() {
  return (
    // Root for react-native-gesture-handler — must wrap the whole app and fill the screen.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <AppInner />
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}

// NOT `Sentry.wrap`, and the warning it produced is why.
//
// The wizard wraps the root component to measure app start and time-to-initial-display. The previous
// comment here said that wrapper was "inert until something has called `Sentry.init`". It is not:
// it OPENS an app-start span the moment the component mounts, and then - because `Sentry.init` is
// deliberately deferred until the persisted consent has been read - it can never close it. Every
// launch logged:
//
//     App Start Span could not be finished. `Sentry.wrap` was called before `Sentry.init`.
//
// That warning was correct, and the arrangement behind it could not be fixed by reordering. App-start
// tracing needs the SDK running before the first render; this app will not start the SDK before it
// knows whether the user agreed, because a diagnostic tool that transmits before reading the switch
// is not a diagnostic tool, it is the bug. The two requirements are genuinely incompatible, so the
// metric is given up rather than the principle - and the console stops carrying a warning nobody can
// act on, which is how warnings come to be ignored.
//
// THE WIZARD'S OWN `Sentry.init` WAS ALSO REMOVED, and it is worth saying why rather than leaving a
// silent deletion. It sat at module scope, so it ran at import time - before the settings read,
// which is the whole point of `startTelemetry` being gated on `ready`. It set `sendDefaultPii: true`
// (IP address, cookies, user) where this app sets false. It installed no `beforeSend`, so nothing
// passed the consent check or `scrub.ts`; no `beforeSendTransaction`, which is the hole 42ad3f6
// closed; and no tracing override, which is how ISDS request lines became span descriptions.
//
// None of that is the wizard being wrong - it is the correct default for an app whose events are not
// legally privileged correspondence. It is wrong HERE.
export default App;
