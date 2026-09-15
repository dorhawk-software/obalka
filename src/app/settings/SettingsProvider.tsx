// App settings (theme mode + language), loaded from and persisted to the encrypted DB's app_settings
// table. Theme mode resolves to light/dark in App (system → OS scheme) and flows through the
// ThemeProvider reactively. A language change re-localizes in place: screens subscribe via `useLocale`.
//
// THE LANGUAGE IS HELD TWICE, and the two copies must never disagree: here as React state, which
// decides what re-renders, and in the i18n module (`setActiveLocale`), which is what every `t()` reads.
// Until 2026-09-24 this provider copied its state into the module ON EVERY RENDER. That made the module
// follow whichever provider rendered last, not what the user chose: a provider rendering from its
// initial state (Czech) put Czech back under a screen still showing English, and its read of the
// table could not give the choice back while the choice's write had not landed there - on a first
// launch, into a table just created - or had failed, unreported. Every screen opened after that was
// Czech, and so was Welcome on the way back, which is what the owner saw on the first launch after
// `pm clear` with English picked on Welcome and the restore screen opened next.
//
// So the module is written only on the two real transitions - a stored language applied by the load,
// and a language chosen - and the state starts from the module rather than from Czech, so a provider
// mounted again starts where the app already is. See `__tests__/app/localeRace.test.tsx`.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo } from 'react-native';
import { settingsStore } from '../../features/accounts/deps';
import { getActiveLocale, setActiveLocale, t, type Locale } from '../../i18n/strings';
import { APP_LOCK_KEY, SCAN_ATTACHMENTS_KEY, TELEMETRY_KEY } from './settingsKeys';
import { isLocale } from './languages';
import { reportFailure, setTelemetryEnabled } from '../../services/telemetry/telemetry';
import type { AutoDownloadPrefs } from '../../features/messages/state/attachmentPrefetch';
import {
  AUTO_DOWNLOAD_DEFAULTS,
  readAutoDownload,
  writeAutoDownload,
  writeAutoDownloadWifiOnly,
} from '../../features/messages/state/autoDownloadSettings';

/** Default UI language. Czech-first - the app's audience is primarily Czech; non-Czech users can
 *  switch on the first-run Welcome screen or in Settings, and the choice is then persisted. (This
 *  said "the add-box screen" for months while no switch existed there; Welcome has one since
 *  2026-09-24.) */
const DEFAULT_LOCALE: Locale = 'cs';

/**
 * The language writes, in the order they were made. The load waits for them before it reads, so a
 * provider mounted while a choice is still on its way to the table reads the choice, not what was
 * there before it. Never rejects: a failed write is reported where it is made.
 */
let localeWrites: Promise<void> = Promise.resolve();

export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsValue {
  themeMode: ThemeMode;
  locale: Locale;
  /** Whether the biometric app-lock is enabled (the lock itself lives in `AppLock`/Keychain). */
  appLock: boolean;
  /**
   * Whether downloaded attachments may be scanned on-device for a deadline (010 US3).
   *
   * Defaults to FALSE and stays false until the user asks. The scan reads the contents of legal
   * mail, and Principle III's answer to that is opt-in: with this off, no document text is processed
   * at all - the parser is not even loaded.
   */
  scanAttachments: boolean;
  /**
   * Whether a failure may be reported off the device (see `services/telemetry`).
   *
   * Distinct from `scanAttachments` in what it protects: that one gates whether the app READS a
   * document at all, this one gates whether a technical description of a failure LEAVES. Reports
   * carry no message content, no names and no box IDs - `telemetry/scrub.ts` is what makes that
   * true - but "carries nothing of yours" is still not the same as "you were asked".
   *
   * THREE STATES, and the third is the point. `null` means the user has not been asked yet, which
   * is not the same as having said no: nothing transmits, and the app owes them the question. It
   * separates "declined" from "never offered", which a boolean cannot, and it is what lets the
   * first-run card appear exactly once and never again.
   */
  telemetry: boolean | null;
  /**
   * Automatic attachment download (026 US4). Off by default: it spends storage and, without Wi-Fi only,
   * mobile data, so it is the person's decision. `AttachmentPrefetcher` reads the same settings table.
   */
  autoDownload: AutoDownloadPrefs;
  /** `onlyNew`: the dialog's choice between messages from now on and every message already here. */
  setAutoDownload: (on: boolean, onlyNew?: boolean) => void;
  setAutoDownloadWifiOnly: (wifiOnly: boolean) => void;
  /** False until the persisted settings have been loaded (avoids a theme/language flash on launch). */
  ready: boolean;
  /**
   * Why `ready` is still false after the read ended (2026-09-24): `failed` when the settings would not
   * read, `retrying` while `retryLoad` reads them again, null otherwise.
   *
   * The settings live in the encrypted database, whose key is a Keychain item, so a Keychain that fails
   * leaves them unreadable. The app draws nothing before this read - it decides whether the lock screen
   * goes up first - and a read that rejected used to leave it drawing nothing, for good.
   */
  loadFailure: 'failed' | 'retrying' | null;
  /** Read the settings again after `loadFailure`. A call while a read is out does nothing. */
  retryLoad: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setLocale: (locale: Locale) => void;
  /**
   * Mirror the app-lock toggle. Moving the vault key and persisting the switch is the vault's job
   * (`AppLock.enable` / `disable` / `forget`); this keeps the UI in step and writes the same value.
   */
  setAppLock: (enabled: boolean) => void;
  setScanAttachments: (enabled: boolean) => void;
  setTelemetry: (enabled: boolean) => void;
}

const THEME_KEY = 'themeMode';
const LOCALE_KEY = 'locale';
const SCAN_KEY = SCAN_ATTACHMENTS_KEY;

/**
 * Diagnostics start UNANSWERED, and nothing transmits until the user has answered.
 *
 * This was `true` - on by default - while the only person running the app was the person who needed
 * the reports. It stopped being defensible the moment the app pointed at a real project, for a
 * reason that is not GDPR: ePrivacy (in Czech law § 89 zák. 127/2005 Sb.) governs storing or
 * reading information on someone's device REGARDLESS of whether it is personal data, and requires
 * prior consent unless the access is strictly necessary to deliver the service asked for. The
 * Sentry SDK writes a persistent per-install id to the device; crash analytics is not strictly
 * necessary to deliver a mail client. Legitimate interest does not answer that rule, because it is
 * not a GDPR question.
 *
 * There is a plainer argument too. This app tells users that scanned text "neopouští telefon" and
 * that attachments are "nikam neodesíláme". Transmitting by default without asking would hand a
 * complainant the case in the app's own words.
 */
const TELEMETRY_DEFAULT = null;

const SettingsContext = createContext<SettingsValue | null>(null);

// Safe defaults when no provider is mounted (e.g. a screen rendered in isolation in a test).
const DEFAULTS: SettingsValue = {
  themeMode: 'system',
  locale: DEFAULT_LOCALE,
  appLock: false,
  scanAttachments: false,
  telemetry: TELEMETRY_DEFAULT,
  autoDownload: AUTO_DOWNLOAD_DEFAULTS,
  setAutoDownload: () => {},
  setAutoDownloadWifiOnly: () => {},
  ready: true,
  loadFailure: null,
  retryLoad: () => {},
  setThemeMode: () => {},
  setLocale: () => {},
  setAppLock: () => {},
  setScanAttachments: () => {},
  setTelemetry: () => {},
};

export function useSettings(): SettingsValue {
  return useContext(SettingsContext) ?? DEFAULTS;
}

/**
 * Subscribe a component to language changes so its `t()` strings re-render in place when the locale
 * switches - without remounting (which would reset navigation). Used centrally by the `localized()`
 * screen wrapper in AppNavigator (React Navigation isolates screens from ancestor re-renders, so each
 * screen must subscribe itself); screens don't call this directly. See 007 FR-005.
 */
export function useLocale(): Locale {
  return useSettings().locale;
}

export function SettingsProvider({ children }: { readonly children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  // From the module, not from DEFAULT_LOCALE: on a cold start the two are the same, and a provider
  // mounted again later starts in the language the app is already in instead of resetting it.
  const [locale, setLocaleState] = useState<Locale>(getActiveLocale);
  const [appLock, setAppLockState] = useState(false);
  const [scanAttachments, setScanState] = useState(false);
  const [telemetry, setTelemetryState] = useState<boolean | null>(TELEMETRY_DEFAULT);
  const [autoDownload, setAutoDownloadState] = useState<AutoDownloadPrefs>(AUTO_DOWNLOAD_DEFAULTS);
  const [ready, setReady] = useState(false);
  const [loadFailure, setLoadFailure] = useState<'failed' | 'retrying' | null>(null);
  /** Bumped by `retryLoad`, which is what runs the read below again. */
  const [attempt, setAttempt] = useState(0);
  /** Whether a read is out: the guard a retry's double tap meets before any re-render. */
  const reading = useRef(false);

  // NOT `setActiveLocale(locale)` here, which is what this was: see the header.

  useEffect(() => {
    let alive = true;
    reading.current = true;
    void (async () => {
      // A language chosen while this read was out is newer than anything it can return.
      const before = getActiveLocale();
      await localeWrites;
      let values: (string | null)[];
      let downloads: AutoDownloadPrefs;
      try {
        downloads = await readAutoDownload(settingsStore);
        values = await Promise.all([
          settingsStore.getSetting(THEME_KEY),
          settingsStore.getSetting(LOCALE_KEY),
          settingsStore.getSetting(APP_LOCK_KEY),
          settingsStore.getSetting(SCAN_KEY),
          settingsStore.getSetting(TELEMETRY_KEY),
        ]);
      } catch (e) {
        // This rejected with nothing to catch it, and `ready` never came: a blank screen for good,
        // seen when react-native-keychain failed every call and so the database key would not read.
        // Not the defaults either - they say the lock is off, and drawing the app on that guess would
        // open a locked archive the moment the database answered. The app says the boxes could not be
        // loaded - true, they are in the same database - and waits for a retry.
        reportFailure('settings.read', e, { stage: 'persist' });
        reading.current = false;
        if (alive) {
          setLoadFailure('failed');
          // Said aloud as well, as the shell's own launch failure is (`AppShell.failLoad`): the screen
          // changed without anyone touching it.
          AccessibilityInfo.announceForAccessibility(
            `${t('app.loadFailed')} ${t('app.loadFailed.retry')}`,
          );
        }
        return;
      }
      reading.current = false;
      if (!alive) {
        return;
      }
      const [tm, lc, lock, scan, telem] = values;
      if (tm === 'light' || tm === 'dark' || tm === 'system') {
        setThemeModeState(tm);
      }
      // Any language in `LANGUAGES`, so adding one is an entry there and not a condition here too.
      if (isLocale(lc) && getActiveLocale() === before) {
        setActiveLocale(lc);
        setLocaleState(lc);
      }
      if (lock === '1') {
        setAppLockState(true);
      }
      // Only an explicit '1' enables it. Anything else - absent, '0', or a value from some future
      // version - means off, because the safe reading of "we are not sure" is "do not read the
      // user's mail".
      // ABSENT means unanswered, and stays `null`: the user has not declined, they have not been
      // asked, and `TelemetryConsent` is what asks them. Only an explicit '0' or '1' is an answer.
      if (telem === '0' || telem === '1') {
        const on = telem === '1';
        setTelemetryState(on);
        setTelemetryEnabled(on);
      }
      if (scan === '1') {
        setScanState(true);
      }
      setAutoDownloadState(downloads);
      // `syncInterval`, `syncReceived`, `syncSent`, `syncCadence`, `notifPrimed` and `notifChannels`
      // are no longer read: 014 removed background sync, so none of them has anything left to switch
      // on. The rows stay in `app_settings` rather than being migrated away - they are inert, and a
      // migration that deletes user data is a migration that can go wrong for no gain.
      setLoadFailure(null);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retryLoad = useCallback(() => {
    if (reading.current) {
      return;
    }
    reading.current = true; // claimed now, so the second tap of a double tap finds it taken
    setLoadFailure('retrying');
    setAttempt(n => n + 1);
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    void settingsStore.setSetting(THEME_KEY, mode);
  };

  const setLocale = (next: Locale) => {
    setActiveLocale(next);
    setLocaleState(next);
    // Chained, so two quick choices land in the order they were made, and reported, because nothing
    // else would hear of it: the language on screen stays, only the next launch would not have it.
    localeWrites = localeWrites
      .then(() => settingsStore.setSetting(LOCALE_KEY, next))
      .catch(e => {
        reportFailure('settings.write', e, { stage: 'persist' });
      });
  };

  const setAppLock = (enabled: boolean) => {
    setAppLockState(enabled);
    // Settled here, because nobody waits for it: removing the last box calls this after the vault has
    // switched the lock off, and a write that failed there was an unhandled rejection. The vault's own
    // write is the one the lock follows (`Vault.forget`, `enable`, `disable`); this mirrors it, so a
    // failure is reported and the screen keeps what the vault did.
    settingsStore.setSetting(APP_LOCK_KEY, enabled ? '1' : '0').catch(e => {
      reportFailure('settings.write', e, { stage: 'persist' });
    });
  };

  const setTelemetry = (enabled: boolean) => {
    setTelemetryState(enabled);
    // Tell the reporter immediately: consent is checked in `beforeSend`, so this takes effect on the
    // next event rather than the next launch.
    setTelemetryEnabled(enabled);
    void settingsStore.setSetting(TELEMETRY_KEY, enabled ? '1' : '0');
  };

  const setAutoDownload = (on: boolean, onlyNew = false) => {
    const now = Date.now();
    setAutoDownloadState(current => ({
      ...current,
      on,
      since: on ? (onlyNew ? now : null) : current.since,
    }));
    writeAutoDownload(settingsStore, on, { onlyNew, now }).catch(e => {
      reportFailure('settings.write', e, { stage: 'persist' });
    });
  };

  const setAutoDownloadWifiOnly = (wifiOnly: boolean) => {
    setAutoDownloadState(current => ({ ...current, wifiOnly }));
    writeAutoDownloadWifiOnly(settingsStore, wifiOnly).catch(e => {
      reportFailure('settings.write', e, { stage: 'persist' });
    });
  };

  const setScanAttachments = (enabled: boolean) => {
    setScanState(enabled);
    void settingsStore.setSetting(SCAN_KEY, enabled ? '1' : '0');
  };

  return (
    <SettingsContext.Provider
      value={{
        themeMode,
        locale,
        appLock,
        scanAttachments,
        telemetry,
        autoDownload,
        setAutoDownload,
        setAutoDownloadWifiOnly,
        ready,
        loadFailure,
        retryLoad,
        setThemeMode,
        setLocale,
        setAppLock,
        setScanAttachments,
        setTelemetry,
      }}>
      {children}
    </SettingsContext.Provider>
  );
}
