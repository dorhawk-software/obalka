// Biometric app-lock gate (feature 001, User Story 2). Wraps the whole signed-in app: when enabled,
// the device biometric/passcode must pass before any content shows - on cold launch and after the app
// returns from the background. Dependency-injected (`enabled` + the `AppLock`) so it is unit-testable.
//
// Since T028 the unlock is not a ceremony in front of readable secrets: what the prompt opens is the
// vault key every box password and session is sealed under, and going to the background drops it.
// The app stays mounted underneath, so anything it starts while locked - the launch refresh included
// - waits for this unlock before it can read a credential (`Vault.useKey`).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Animated, AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { XStack, YStack } from '../../theme/ui';
import { PressScale } from '../../theme/PressScale';
import { Body, BodyStrong, Caption, Title } from '../../theme/Typography';
import { fonts } from '../../theme/typography';
import { useTheme } from '../../theme/ThemeProvider';
import { BrandLockIcon } from '../../theme/artwork';
import { LockIcon } from '../../theme/icons';
import { Dialog } from '../../theme/Dialog';
import { textSlop } from '../../theme/touchTarget';
import { t } from '../../i18n/strings';
import type { AppLock, UnlockResult } from '../../services/appLock/appLock';
import { useCloseOnBackground } from '../useCloseOnBackground';

// After biometric success, hold the cover briefly so the OS success animation (iOS Face ID's
// checkmark) finishes BEFORE the app is revealed - then cross-fade the cover out. Without this the
// content flashes in mid-animation, which reads as "did it actually pass?" (the user noticed this vs
// bank apps like Revolut / George). Tunable; validated for feel on a real device.
const REVEAL_HOLD_MS = 260; // let the OS success animation settle
const REVEAL_FADE_MS = 240; // then dissolve the cover
const ENTER_FADE_MS = 250; // the design's `rfade .25s ease` entry (the panel, not the cover - below)
// How long an unlock that finished while the app was in the background waits for the app to return.
// On Android 10 and older the phone's own passcode screen ("Use PIN") is an activity of its own, so
// reaching it sends this app to the background exactly as leaving it would, and the prompt answers
// around the moment the app comes back - in either order. A return within this window belongs to the
// prompt. No return means the user really left, and the key the prompt opened is dropped rather than
// held behind the lock screen until somebody opens the app.
const UNLOCK_RETURN_MS = 1500;

/** Whether the lock screen covers the app right now. False outside a `LockGate`. */
const LockCoverContext = createContext(false);

/**
 * Whether a dialog the app opens by itself would show where it must not: over the lock screen, or
 * while the app is in the background.
 *
 * An RN `Modal` is a native window of its own, drawn above the in-tree lock cover, so the cover does
 * not hide it - and the cover is up not only while locked but through the reveal after an unlock, when
 * whatever waited behind it is already reading. `useCloseOnBackground` closes a dialog the person
 * opened; one the app raised on its own waits instead, hidden rather than dismissed, until the app is
 * back and open.
 */
export function useAppCovered(): boolean {
  const covered = useContext(LockCoverContext);
  const [background, setBackground] = useState(() => AppState.currentState === 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      setBackground(state === 'background');
    });
    return () => sub.remove();
  }, []);
  return covered || background;
}

export function LockGate({
  enabled,
  lock,
  children,
}: {
  readonly enabled: boolean;
  readonly lock: AppLock;
  readonly children: ReactNode;
}) {
  // Locked from the first frame on a cold launch when enabled (no flash of content). Enabling the
  // lock mid-session does NOT lock immediately - it takes effect on the next time the app backgrounds.
  const [unlocked, setUnlocked] = useState(() => !enabled);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  // Whether the lock screen has an unlock out right now (the 'background' listener below).
  const unlocking = useRef(false);
  const onUnlocking = useCallback((inFlight: boolean) => {
    unlocking.current = inFlight;
  }, []);
  // The vault can need ONE unlock with the lock switched off: its key found only behind the gate,
  // because a toggle was interrupted (a restore no longer brings the lock setting - it stays on its
  // phone). Showing this screen once is the honest repair - a new key would orphan every stored secret.
  const subscribe = useCallback(
    (listener: () => void) => lock.subscribe(listener),
    [lock],
  );
  const recovering = useSyncExternalStore(subscribe, () => lock.needsRecovery());
  // Held until the cover has faded, like any unlock - the vault clears `recovering` the moment it has
  // the key, and dropping the overlay then would cut instead of dissolving.
  const [recoveryLock, setRecoveryLock] = useState(false);
  useEffect(() => {
    if (recovering) {
      setRecoveryLock(true);
      setUnlocked(false);
    }
  }, [recovering]);

  useEffect(() => {
    // Lock when the app leaves the foreground, so returning to it re-prompts.
    //
    // This does NOT protect the app-switcher snapshot, and used to claim it did. Both systems
    // photograph the app before `background` is delivered: iOS goes inactive first and is already on
    // screen in the switcher by then, Android captures the task snapshot around the activity
    // stopping. React hears about it afterwards, so no state change here can be early enough. The
    // switcher is handled natively instead (`AppDelegate.swift`, `MainActivity.kt`), and
    // `__tests__/security/appSwitcherPrivacy.test.ts` keeps it that way.
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' && enabledRef.current) {
        // The key first: the overlay alone would leave every sealed secret readable behind it.
        //
        // Except while an unlock is out. The key is not held then anyway, and dropping it here would
        // void that unlock - which is every unlock made through the phone's own passcode screen on
        // Android 10 and older, because that screen sends the app to the background. The attempt
        // decides instead, by whether the app comes back (`UNLOCK_RETURN_MS`), and drops the key
        // itself when it does not.
        if (!unlocking.current) {
          lock.lock();
        }
        setUnlocked(false);
      }
    });
    return () => sub.remove();
  }, [lock]);

  // Keep the app MOUNTED and OVERLAY the lock screen on top while locked (opaque, full-screen) - rather
  // than swapping it out - so unlocking returns to the exact screen you were on (navigation state is
  // preserved). The overlay is what the user sees on RESUME; the app-switcher image is a separate
  // problem solved natively, for the timing reason above.
  const covered = (enabled || recoveryLock) && !unlocked;
  return (
    <LockCoverContext.Provider value={covered}>
      <YStack flex={1}>
        {children}
        {covered ? (
          <YStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            zIndex={1000}
          >
            <LockScreen
              lock={lock}
              onUnlocking={onUnlocking}
              onUnlock={() => {
                setUnlocked(true);
                setRecoveryLock(false);
              }}
            />
          </YStack>
        ) : null}
      </YStack>
    </LockCoverContext.Provider>
  );
}

/**
 * Resolves true once the app is in the foreground - at once unless it is in the background now - or
 * false when it has not come back within `ms`.
 *
 * Only 'background' waits. iOS keeps the app 'inactive' while its own Face ID or passcode sheet is up,
 * and the unlock can land before that sheet has gone; waiting for 'active' there could run out and cost
 * a second prompt. A user who really leaves passes through 'background' afterwards, and that locks
 * again through the gate and `cancelReveal`.
 */
function returnsToForeground(ms: number): Promise<boolean> {
  if (AppState.currentState !== 'background') {
    return Promise.resolve(true);
  }
  return new Promise(resolve => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let sub: { remove: () => void } | null = null;
    const finish = (back: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
      sub?.remove();
      resolve(back);
    };
    timer = setTimeout(() => finish(false), ms);
    sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        finish(true);
      }
    });
  });
}

function LockScreen({
  lock,
  onUnlock,
  onUnlocking,
}: {
  readonly lock: AppLock;
  readonly onUnlock: () => void;
  /** Told when an unlock goes out and when it has been decided, so the gate holds its lock meanwhile. */
  readonly onUnlocking: (inFlight: boolean) => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState(true);
  /** Why the last attempt did not unlock, or null. */
  const [failure, setFailure] = useState<Exclude<UnlockResult, 'unlocked'> | null>(null);
  const failed = failure !== null;
  /** The key behind the gate keeps failing to read: the hint's slot offers to set the lock up again. */
  const unreadable = failure === 'keyUnreadable';
  const [confirmingReset, setConfirmingReset] = useState(false);
  // For the 'active' listener below, which must not start an unlock under the open question.
  const confirmingResetRef = useRef(confirmingReset);
  confirmingResetRef.current = confirmingReset;
  const closeResetDialog = useCallback(() => setConfirmingReset(false), []);
  // A confirmation answers the moment it was asked in, not a return to the app later.
  useCloseOnBackground(closeResetDialog);
  const inFlight = useRef(false);
  /** Between a successful unlock and `onUnlock`: the hold, then the fade. */
  const revealing = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverOpacity = useRef(new Animated.Value(1)).current;
  const panelOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  // The design fades the lock in (`animation: rfade .25s ease`). Only the PANEL fades - the opaque
  // cover is at full opacity from the very first frame, because fading the cover itself in would show
  // the app underneath for a quarter of a second, which is exactly what this gate exists to prevent.
  useEffect(() => {
    if (reduceMotion) {
      panelOpacity.setValue(1);
      return;
    }
    Animated.timing(panelOpacity, {
      toValue: 1,
      duration: ENTER_FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, panelOpacity]);

  // Reveal the app only AFTER the OS biometric success animation has finished: hold briefly, then
  // dissolve the cover (or, under Reduce Motion, hold then cut). So content never flashes in while
  // Face ID is still animating.
  const revealAfterAuth = useCallback(() => {
    revealing.current = true;
    revealTimer.current = setTimeout(() => {
      revealTimer.current = null;
      if (reduceMotion) {
        revealing.current = false;
        onUnlock();
        return;
      }
      Animated.timing(coverOpacity, {
        toValue: 0,
        duration: REVEAL_FADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        // Not when `cancelReveal` stopped it: the app went to the background and is locked again.
        if (finished && revealing.current) {
          revealing.current = false;
          onUnlock();
        }
      });
    }, REVEAL_HOLD_MS);
  }, [reduceMotion, coverOpacity, onUnlock]);

  // The app went to the background between the unlock and the reveal. The gate has dropped the key by
  // then, so finishing the reveal would open the app on return without the prompt a return owes - and
  // with no key behind it, so every refresh would wait for an unlock no screen was asking for. The
  // cover goes back up instead, and the return prompts.
  const cancelReveal = useCallback(() => {
    if (!revealing.current) {
      return;
    }
    revealing.current = false;
    if (revealTimer.current !== null) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    coverOpacity.stopAnimation();
    coverOpacity.setValue(1);
    setBusy(false);
  }, [coverOpacity]);

  /** One attempt at opening the app - `unlock`, or `resetKey` once confirmed - and what follows it. */
  const run = useCallback(
    async (open: (appLock: AppLock) => Promise<UnlockResult>) => {
      if (inFlight.current || revealing.current) {
        return;
      }
      inFlight.current = true;
      onUnlocking(true);
      setBusy(true);
      setFailure(null);
      const result = await open(lock);
      // An unlock that finished with the app in the background stands only when the app comes
      // straight back: that was the phone's own passcode screen, not the user leaving
      // (`UNLOCK_RETURN_MS`).
      const back = result === 'unlocked' && (await returnsToForeground(UNLOCK_RETURN_MS));
      inFlight.current = false;
      onUnlocking(false);
      if (back) {
        revealAfterAuth(); // hold for the OS success animation, then fade the cover out
      } else if (result === 'unlocked') {
        // The user left while the prompt was out. Nothing is kept, and no failure is shown: coming
        // back simply asks again.
        lock.lock();
        setBusy(false);
      } else {
        setBusy(false);
        setFailure(result);
      }
    },
    [lock, revealAfterAuth, onUnlocking],
  );
  // Reads the vault key behind the gate - or, the first time after an update or after the phone
  // invalidated it, puts one there and reads that back. Either way one prompt, and a cancel never
  // costs a key.
  const attempt = useCallback(() => run(appLock => appLock.unlock(t('lock.prompt'))), [run]);
  // After `keyUnreadable` and the dialog's yes, never without both: the key behind the gate is
  // replaced, and one prompt reads the new one back (`Vault.resetKey`).
  const resetLock = useCallback(() => run(appLock => appLock.resetKey(t('lock.prompt'))), [run]);

  // Auto-prompt only while the app is in the FOREGROUND. The lock screen can mount while the app is
  // backgrounding (we lock on 'background'), where a biometric prompt can't show and would instantly
  // "fail" - so prompt on mount only if already active, and otherwise wait for the next 'active'.
  useEffect(() => {
    if (AppState.currentState === 'active') {
      void attempt();
    }
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        // Not under the reset's open confirmation. iOS says 'active' again after Control Center or a
        // system sheet without the app having left, so the dialog is still up - and an attempt started
        // now would still be out when the person answers, which drops their yes (`run` refuses a
        // second attempt). Closing the dialog asks nothing; the unlock button is there again.
        if (!confirmingResetRef.current) {
          void attempt();
        }
      } else if (state === 'background') {
        cancelReveal();
      }
    });
    return () => sub.remove();
  }, [attempt, cancelReveal]);

  // A lock screen that goes away with an unlock still out must not leave the gate holding its lock.
  useEffect(() => () => onUnlocking(false), [onUnlocking]);

  // Animated.View (not a Tamagui YStack) so the whole opaque cover can cross-fade out on unlock.
  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 36,
        opacity: coverOpacity,
      }}
    >
      <Animated.View style={{ opacity: panelOpacity }}>
        <YStack alignItems="center">
          <YStack
            width={104}
            height={104}
            borderRadius={30}
            backgroundColor={theme.brandTile}
            alignItems="center"
            justifyContent="center"
            style={{ boxShadow: '0 14px 34px rgba(33,50,90,0.32)' }}
          >
            {/* The brand lock: pale-blue padlock + a GOLD keyhole (not the plain lucide glyph). Its
                colours are fixed like the tile it sits on, so they live in theme/artwork. */}
            <BrandLockIcon size={46} />
          </YStack>
          <YStack alignItems="center" gap={8} marginTop={26}>
            <Title color={theme.text} fontSize={22}>
              {t('lock.title')}
            </Title>
            <Body
              color={theme.textMuted}
              textAlign="center"
              fontSize={14}
              fontFamily={fonts.bodyMedium}
              fontWeight="500"
              lineHeight={20}
              maxWidth={250}
            >
              {t('lock.subtitle')}
            </Body>
          </YStack>
          {/* The failure message has NO slot in the design, but it is real app state - so it gets a
              fixed-height slot that is always laid out and only fades in: nothing below it may move
              (constitution V, no layout jumps). */}
          <YStack
            minHeight={17}
            marginTop={20}
            justifyContent="center"
            opacity={failed ? 1 : 0}
            accessibilityElementsHidden={!failed}
            importantForAccessibility={failed ? 'auto' : 'no-hide-descendants'}
          >
            <Caption color={theme.danger} textAlign="center" numberOfLines={1}>
              {/* A phone without a screen lock cannot hold the gated key at all, so "try again" would
                  be a loop; it is told what to set instead. A key that keeps failing to read says so,
                  and the hint's slot below offers the way out. Same one-line slot, so nothing moves. */}
              {t(
                failure === 'noScreenLock'
                  ? 'lock.noScreenLock'
                  : unreadable
                  ? 'lock.keyUnreadable'
                  : 'lock.failed',
              )}
            </Caption>
          </YStack>
          <PressScale
            busy={busy}
            onPress={attempt}
            accessibilityLabel={t('lock.unlock')}
            testID="unlock"
            style={{ marginTop: 34 }}
          >
            {/* One solid state (design): ink fill, no dimmed/disabled variant. A leading 18px lock
                glyph sits 10px before the Public Sans 16/700 label. */}
            <XStack
              // minHeight + real vertical padding: the label scales with the system font size and a
              // fixed 54 cropped it. At the default size the button is still exactly 54 tall.
              minHeight={54}
              borderRadius={16}
              paddingHorizontal={40}
              paddingVertical={10}
              alignItems="center"
              justifyContent="center"
              gap={10}
              backgroundColor={theme.text}
              style={{ boxShadow: '0 6px 16px rgba(33,27,18,0.25)' }}
            >
              <LockIcon size={18} color={theme.surfaceAlt} />
              <BodyStrong fontSize={16} color={theme.surfaceAlt}>
                {t('lock.unlock')}
              </BodyStrong>
            </XStack>
          </PressScale>
          {/* The hint's slot, which also holds the way out of a key that keeps failing to read. The
              hint stays laid out underneath, only invisible, and the link is drawn over it in the
              same type, so the link appearing moves nothing (constitution V). Brand Blue, as every
              link is (DESIGN.md). */}
          <YStack marginTop={14}>
            <Caption
              color={theme.textFaint}
              fontSize={12}
              fontFamily={fonts.bodySemiBold}
              fontWeight="600"
              opacity={unreadable ? 0 : 1}
              accessibilityElementsHidden={unreadable}
              importantForAccessibility={unreadable ? 'no-hide-descendants' : 'auto'}
            >
              {t('lock.hint')}
            </Caption>
            {unreadable ? (
              <XStack
                position="absolute"
                top={0}
                left={0}
                right={0}
                justifyContent="center"
                hitSlop={textSlop('caption', { fontSize: 12 })}
                onPress={() => setConfirmingReset(true)}
                pressStyle={{ opacity: 0.5 }}
                accessibilityRole="button"
                accessibilityLabel={t('lock.reset.link')}
                testID="lock-reset"
              >
                <Caption
                  color={theme.blue}
                  fontSize={12}
                  fontFamily={fonts.bodySemiBold}
                  fontWeight="600"
                  numberOfLines={1}
                >
                  {t('lock.reset.link')}
                </Caption>
              </XStack>
            ) : null}
          </YStack>
        </YStack>
      </Animated.View>
      {confirmingReset ? (
        <Dialog
          testID="lock-reset-dialog"
          title={t('lock.reset.title')}
          body={t('lock.reset.body')}
          // Dismissing is the safe outcome: the key stays, and so does the lock screen.
          onDismiss={closeResetDialog}
          actions={[
            {
              label: t('common.cancel'),
              onPress: closeResetDialog,
              testID: 'lock-reset-cancel',
            },
            {
              label: t('lock.reset.confirm'),
              tone: 'danger',
              testID: 'lock-reset-confirm',
              onPress: () => {
                setConfirmingReset(false);
                void resetLock();
              },
            },
          ]}
        />
      ) : null}
    </Animated.View>
  );
}
