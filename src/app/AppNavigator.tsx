// Signed-in navigation (feature 002, re-rooted in 011): a native-stack whose ROOT is the active box's
// inbox (the message list IS the home - inbox-first). MessageDetail / Compose / Search / Settings are
// pushed on top and back to the inbox; the old box-list `Home` route is retired. Headers are hidden -
// each screen draws its own themed header. Switching boxes is a SHELL-STATE change (set + persist
// activeBoxId in AppShell): the root inbox reads the active box from context and re-renders IN PLACE -
// no push/pop, the back-stack never grows with boxes. The box-switcher bottom sheet (the sole
// multi-box surface) is mounted over the root inbox. A `navigationRef` lets the notification deep-link
// drive navigation imperatively. Live account state + actions come from AppShell via a small context.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
} from 'react';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DataBoxAccount } from '../services/isds/types';
import type { MessageFolder } from '../services/db/messagesStore';
import { BoxSwitcherSheet } from '../features/accounts/screens/BoxSwitcherSheet';
import { MessageList } from '../features/messages/screens/MessageList';
import { MessageDetail } from '../features/messages/screens/MessageDetail';
import {
  ComposeScreen,
  type ComposeHandle,
} from '../features/messages/screens/ComposeScreen';
import { SearchScreen } from '../features/messages/screens/SearchScreen';
import { SettingsScreen } from './settings/SettingsScreen';
import { FaqScreen } from './settings/FaqScreen';
import type { FaqId } from '../content/faq';
import { LicencesScreen } from './settings/LicencesScreen';
import type { BoxAttention } from '../features/messages/state/crossBox';
import { BackupScreen } from './settings/BackupScreen';
import { TransferScreen } from './settings/TransferScreen';
import { DebugScreen } from './settings/DebugScreen';
import { DebugRecordingFrame } from './DebugRecordingStrip';
import { backupController, transferController, draftsStore } from '../features/accounts/deps';
import type { BackupManifest } from '../services/backup/schema';
import { LicenceGroupScreen } from './settings/LicenceGroupScreen';
import { LicenceDetailScreen } from './settings/LicenceDetailScreen';
import { useLocale } from './settings/SettingsProvider';
import { SnackbarProvider, useSnackbar } from './Snackbar';
import { navigationRef } from './navigationRef';
import type { DraftRecord } from '../services/db/draftsStore';
import { draftsBus } from '../features/messages/state/draftsBus';
import { t } from '../i18n/strings';

export type RootStackParamList = {
  // The root inbox reads the ACTIVE box from context (in-place switch) - no per-box route param.
  Messages: undefined;
  MessageDetail: { boxId: string; messageId: string; folder?: MessageFolder };
  Compose: { boxId: string };
  Search: undefined;
  Settings: undefined;
  // About & Help (012). `Faq` is reachable from Settings AND from the pre-sign-in screens, so it just
  // goes back to whatever pushed it. The licence routes carry the SPDX id they are showing.
  // …and it optionally carries the one answer to open on arrival (010 US3: Settings links to the
  // scan explanation rather than repeating it in a row).
  Faq: { focus?: FaqId } | undefined;
  Backup: undefined;
  Transfer: undefined;
  Debug: undefined;
  Licences: undefined;
  LicenceGroup: { spdx: string };
  LicenceDetail: { spdx: string };
};

export interface AppData {
  accounts: DataBoxAccount[];
  activeBoxId: string | null;
  /** Switch the active box: sets + PERSISTS activeBoxId in the shell; the inbox re-renders in place. */
  setActive: (boxId: string) => void;
  addBox: () => void;
  /** Never rejects - the shell reports a removal that did not finish (see `AppShell.handleRemove`). */
  removeBox: (boxId: string) => Promise<void>;
  setAlias: (boxId: string, alias: string | null) => void;
  /** Re-authenticate a box; `refusedAt` is when ISDS refused it, when the inbox strip knows. */
  onReauth: (boxId: string, refusedAt?: number) => void;
  /** Incremented when a re-auth succeeds - the inbox re-syncs and drops its expired-session strip. */
  resyncNonce?: number;
  /** Cheap DB-only re-read of accounts (no network) - keeps unread badges / counts fresh on focus. */
  reloadAccounts: () => void;
  /**
   * What the OTHER boxes want the user to know (023's cross-box card), or null while it is still
   * being read.
   *
   * Computed in the shell rather than in the inbox because the shell is what owns the account list
   * and what knows when it changed. One aggregate for the app, recomputed after a refresh, instead
   * of one per screen that could disagree with the switcher badge beside it.
   */
  crossBox: BoxAttention[] | null;
  /** Whether the MERGED view is on screen rather than a box (024 cycle 2). */
  unified: boolean;
  /** Enter the merged view. Only offered when at least two boxes exist. */
  onOpenUnified: () => void;
  /** Refresh every box - the same call the shell makes at launch. The merged view's pull. */
  onRefreshAll: () => void;
}

const AppDataContext = createContext<AppData | null>(null);

function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error('useAppData must be used within AppNavigator');
  }
  return ctx;
}

const Stack = createNativeStackNavigator<RootStackParamList>();

function MessagesScreen({
  navigation,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'Messages'>>) {
  const {
    accounts,
    activeBoxId,
    setActive,
    addBox,
    removeBox,
    setAlias,
    onReauth,
    crossBox,
    unified,
    onOpenUnified,
    onRefreshAll,
    resyncNonce,
    reloadAccounts,
  } = useAppData();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Re-read accounts (DB-only, no network) whenever the inbox regains focus, so an unread count changed
  // elsewhere - e.g. after reading a message - is reflected on the switcher badges without a refresh.
  useFocusEffect(
    useCallback(() => {
      reloadAccounts();
    }, [reloadAccounts]),
  );

  const account = accounts.find(a => a.boxId === activeBoxId);
  // Zero boxes → the shell shows Welcome (this navigator isn't mounted). A transient null (mid-switch /
  // mid-removal) renders nothing rather than crashing (Principle II).
  if (!account) {
    return null;
  }
  return (
    <>
      <MessageList
        // Remount on box switch → a fresh inbox (Přijaté tab, top of list) for the newly-active box.
        // Remounts when the box changes AND when entering or leaving the merged view: both are a
        // different list, and a fresh one (Přijaté, top) is the right starting point for each.
        key={unified ? 'unified' : account.boxId}
        account={account}
        onOpenSwitcher={() => {
          reloadAccounts();
          setSwitcherOpen(true);
        }}
        onSearch={() => navigation.navigate('Search')}
        onOpenMessage={(messageId, folder, boxId) =>
          navigation.navigate('MessageDetail', { boxId, messageId, folder })
        }
        onCompose={() => navigation.navigate('Compose', { boxId: account.boxId })}
        onReauth={refusedAt => onReauth(account.boxId, refusedAt)}
        onOpenFaq={focus => navigation.navigate('Faq', { focus })}
        resyncNonce={resyncNonce}
        crossBox={crossBox}
        // 024 cycle 2: the SAME list, showing every box. A mode rather than a second screen - the
        // first attempt built a separate one and it drifted immediately (no avatars, no month
        // sections, different metrics), because two components drawing "an inbox" is two places for
        // the design to live. The only real difference is whether a row says which box it is from.
        unified={
          unified
            ? {
                accounts,
                onRefreshAll,
                onReauthBox: onReauth,
              }
            : null
        }
      />
      {/* Mounted ONLY while open, so it fully unmounts on close (no residual sheet state) and every
          open is a fresh slide-in. */}
      {switcherOpen ? (
        <BoxSwitcherSheet
          onClose={() => setSwitcherOpen(false)}
          accounts={accounts}
          activeBoxId={activeBoxId}
          unified={unified}
          onOpenUnified={() => {
            setSwitcherOpen(false);
            onOpenUnified();
          }}
          onSwitch={boxId => {
            setActive(boxId); // set + persist in the shell → the root inbox swaps in place
            setSwitcherOpen(false);
          }}
          onAddBox={addBox}
          onOpenSettings={() => navigation.navigate('Settings')}
          onSetAlias={setAlias}
          onRemove={removeBox}
        />
      ) : null}
    </>
  );
}

function SearchRoute({
  navigation,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'Search'>>) {
  const { accounts } = useAppData();
  return (
    <SearchScreen
      accounts={accounts}
      onBack={() => navigation.goBack()}
      onOpenMessage={(boxId, messageId, folder) =>
        navigation.navigate('MessageDetail', { boxId, messageId, folder })
      }
    />
  );
}

function SettingsRoute({
  navigation,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'Settings'>>) {
  return (
    <SettingsScreen
      onBack={() => navigation.goBack()}
      onOpenFaq={focus => navigation.navigate('Faq', focus ? { focus } : {})}
      onOpenBackup={() => navigation.navigate('Backup')}
      onOpenDebug={() => navigation.navigate('Debug')}
      onOpenLicences={() => navigation.navigate('Licences')}
    />
  );
}

function FaqRoute({
  navigation,
  route,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'Faq'>>) {
  return (
    <FaqScreen onBack={() => navigation.goBack()} focus={route.params?.focus} />
  );
}

/** The two focus events a stacked screen hears, and whether it is focused now. */
export interface FocusEvents {
  addListener(type: 'focus' | 'blur', listener: () => void): () => void;
  isFocused(): boolean;
}

/**
 * For a screen that stays mounted under the ones it opens: whether it is the one in view, and how
 * many times it has come BACK into view after another covered it.
 *
 * A return only, not the first focus, which the screen's own mount already reads for. Extracted from
 * `BackupRoute` so the counting has a test of its own (2026-09-15).
 */
export function useViewPresence(navigation: FocusEvents): {
  inView: boolean;
  shownAgain: number;
} {
  const [shownAgain, setShownAgain] = useState(0);
  const [inView, setInView] = useState(() => navigation.isFocused());
  useEffect(() => {
    let away = false;
    const offBlur = navigation.addListener('blur', () => {
      away = true;
      setInView(false);
    });
    const offFocus = navigation.addListener('focus', () => {
      setInView(true);
      if (away) {
        away = false;
        setShownAgain(n => n + 1);
      }
    });
    return () => {
      offBlur();
      offFocus();
    };
  }, [navigation]);
  return { inView, shownAgain };
}

function BackupRoute({
  navigation,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'Backup'>>) {
  // The screen stays mounted under the transfer it opens (025). It reads its status again each time it
  // comes back into view, because the transfer can turn backups on by keeping the key that arrived,
  // and without a fresh read the switch went on saying "off" (025 review, 2026-09-15). While it is the
  // screen in view, it also says how a transfer's save ended that no transfer screen was open to say.
  const { inView, shownAgain } = useViewPresence(navigation);
  return (
    <BackupScreen
      onBack={() => navigation.goBack()}
      controller={backupController}
      onOpenFaq={focus => navigation.navigate('Faq', { focus })}
      onOpenTransfer={() => navigation.navigate('Transfer')}
      shownAgain={shownAgain}
      inView={inView}
      transferOutcomes={transferController}
    />
  );
}

function TransferRoute({
  navigation,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'Transfer'>>) {
  const [backups, setBackups] = useState<BackupManifest[] | null>(null);
  // The backups this phone holds, read here rather than passed in so the screen cannot be opened
  // holding a stale list - and read again when the chosen one turned out to be gone (026 US3).
  const readBackups = useCallback(() => {
    void backupController
      .list()
      .then(list => setBackups(list.map(item => item.manifest)))
      .catch(() => setBackups([]));
  }, []);
  useEffect(readBackups, [readBackups]);
  // Going back takes this screen out of view at once, while it stays mounted until the transition has
  // finished. A save that ends in that moment belongs to the backup screen now in view (2026-09-15).
  const { inView } = useViewPresence(navigation);
  return (
    <TransferScreen
      onBack={() => navigation.goBack()}
      controller={transferController}
      backups={backups}
      // Opened from the backup screen, which is where a backup is made.
      onOpenBackup={() => navigation.goBack()}
      onBackupsStale={readBackups}
      inView={inView}
    />
  );
}

function DebugRoute({
  navigation,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'Debug'>>) {
  return <DebugScreen onBack={() => navigation.goBack()} />;
}

function LicencesRoute({
  navigation,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'Licences'>>) {
  return (
    <LicencesScreen
      onBack={() => navigation.goBack()}
      onOpenGroup={spdx => navigation.navigate('LicenceGroup', { spdx })}
      onOpenText={spdx => navigation.navigate('LicenceDetail', { spdx })}
    />
  );
}

function LicenceGroupRoute({
  navigation,
  route,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'LicenceGroup'>>) {
  return (
    <LicenceGroupScreen
      spdx={route.params.spdx}
      onBack={() => navigation.goBack()}
      onOpenText={() =>
        navigation.navigate('LicenceDetail', { spdx: route.params.spdx })
      }
    />
  );
}

function LicenceDetailRoute({
  navigation,
  route,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'LicenceDetail'>>) {
  return (
    <LicenceDetailScreen
      spdx={route.params.spdx}
      onBack={() => navigation.goBack()}
    />
  );
}

function ComposeRoute({
  route,
  navigation,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'Compose'>>) {
  const { accounts } = useAppData();
  const account = accounts.find(a => a.boxId === route.params.boxId);
  const composeRef = useRef<ComposeHandle>(null);
  const snackbar = useSnackbar();

  // discard → flip the snackbar to an undoable "Koncept zahozen" (re-saves the captured record).
  // emit AFTER the write so the message-list draft count re-reads the updated state (not the stale one).
  const offerUndo = useCallback(
    (d: DraftRecord) => {
      snackbar.show({
        message: t('send.draft.discarded'),
        action: {
          label: t('common.undo'),
          onPress: () => void draftsStore.save(d).then(() => draftsBus.emit()),
        },
      });
    },
    [snackbar],
  );

  // auto-save on exit → "Koncept uložen" with an inline discard.
  const offerDiscard = useCallback(
    (d: DraftRecord) => {
      snackbar.show({
        message: t('send.draft.saved'),
        action: {
          label: t('send.draft.discard'),
          onPress: () => {
            void draftsStore.remove(d.id).then(() => draftsBus.emit());
            offerUndo(d);
          },
        },
      });
    },
    [snackbar, offerUndo],
  );

  // Leaving compose by ANY path (back chevron, swipe-back, hardware back) auto-saves the draft.
  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      const saved = composeRef.current?.persistOnExit();
      if (saved) {
        offerDiscard(saved);
      }
    });
  }, [navigation, offerDiscard]);

  if (!account) {
    navigation.goBack();
    return null;
  }
  return (
    <ComposeScreen
      ref={composeRef}
      account={account}
      onBack={() => navigation.goBack()}
      // REPLACE, not navigate: the send is over, and pushing the detail on top of a spent compose
      // screen would make the back gesture land on "Zpráva odeslána" instead of the list the reader
      // started from. `persistOnExit` already returns null once a message has gone out, so the
      // `beforeRemove` draft save this fires has nothing to save.
      onOpenSent={messageId =>
        navigation.replace('MessageDetail', {
          boxId: account.boxId,
          messageId,
          folder: 'sent',
        })
      }
    />
  );
}

function MessageDetailScreen({
  route,
  navigation,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'MessageDetail'>>) {
  const { accounts } = useAppData();
  const account = accounts.find(a => a.boxId === route.params.boxId);
  if (!account) {
    navigation.goBack();
    return null;
  }
  return (
    <MessageDetail
      account={account}
      messageId={route.params.messageId}
      folder={route.params.folder ?? 'received'}
      onBack={() => navigation.goBack()}
    />
  );
}

/**
 * Wrap a navigator screen so it re-localizes in place on a language change. React Navigation isolates
 * each screen from ancestor re-renders, so the screen itself must subscribe to the locale (via
 * `useLocale`) - otherwise it keeps stale strings until refocused. Centralizing it here, applied once
 * to every entry in `screens`, means a new screen inherits language reactivity for free and a
 * contributor can't forget the per-screen call. (Components nested inside a screen don't need this:
 * they re-render together with their screen.)
 */
function localized<P extends object>(
  Screen: ComponentType<P>,
): ComponentType<P> {
  const Wrapped = (props: Readonly<P>) => {
    useLocale();
    return <Screen {...props} />;
  };
  Wrapped.displayName = `Localized(${Screen.displayName ?? Screen.name})`;
  return Wrapped;
}

// The single registry of navigator screens - every one auto-wrapped with `localized`. Add new
// screens here (and to RootStackParamList) and they re-localize on a language switch automatically.
//
// Its type is a MAPPED type over RootStackParamList, so a route declared there and forgotten here is a
// compile error; the navigator below renders straight from this object, so a route here and forgotten
// in the navigator is impossible; and `__tests__/app/routeRegistry.test.tsx` asserts the navigator's
// own `routeNames` equals these keys, which catches anyone going back to a hand-written list.
export const screens: {
  [N in keyof RootStackParamList]: ComponentType<
    NativeStackScreenProps<RootStackParamList, N>
  >;
} = {
  Messages: localized(MessagesScreen),
  MessageDetail: localized(MessageDetailScreen),
  Compose: localized(ComposeRoute),
  Search: localized(SearchRoute),
  Settings: localized(SettingsRoute),
  Faq: localized(FaqRoute),
  Backup: localized(BackupRoute),
  Transfer: localized(TransferRoute),
  Debug: localized(DebugRoute),
  Licences: localized(LicencesRoute),
  LicenceGroup: localized(LicenceGroupRoute),
  LicenceDetail: localized(LicenceDetailRoute),
};

/**
 * Every screen's frame: the Debug-mode recording strip above it while a recording runs (023 FR-007).
 *
 * Applied once, here, for the same reason `localized` is: a screen added later gets it without anyone
 * remembering to. The Debug screen is the one exception, and the exception is what keeps the strip from
 * ever shifting the screen in front of the person - `DebugRecordingStrip.tsx` explains why.
 */
const withRecordingStrip: NonNullable<
  ComponentProps<typeof Stack.Navigator>['screenLayout']
> = ({ route, navigation, children }) => (
  <DebugRecordingFrame
    hidden={route.name === 'Debug'}
    onOpen={() => navigation.navigate('Debug')}
  >
    {children}
  </DebugRecordingFrame>
);

export function AppNavigator(data: Readonly<AppData>) {
  return (
    <AppDataContext.Provider value={data}>
      <SnackbarProvider>
        <NavigationContainer ref={navigationRef}>
          {/* Root = the active box's inbox; the rest are pushed on top and back to it. */}
          <Stack.Navigator
            initialRouteName="Messages"
            screenOptions={{ headerShown: false }}
            screenLayout={withRecordingStrip}
          >
            {/* Rendered FROM the registry rather than listed again by hand. The hand-written list
                used to be a second place to remember, and a screen present in the registry but
                missing from it was invisible: `navigate()` to an unregistered name does nothing at
                all - no crash, no message, just a tap that goes nowhere. That is how the backup
                screen shipped unreachable. The registry's type requires every route, so a new one
                cannot be half-added now. */}
            {(Object.keys(screens) as (keyof RootStackParamList)[]).map(name => (
              <Stack.Screen
                key={name}
                name={name}
                component={
                  screens[name] as ComponentType<
                    NativeStackScreenProps<RootStackParamList, typeof name>
                  >
                }
              />
            ))}
          </Stack.Navigator>
        </NavigationContainer>
      </SnackbarProvider>
    </AppDataContext.Provider>
  );
}
