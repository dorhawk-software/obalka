import type { ReactNode } from 'react';
import { textSlop } from '../../../theme/touchTarget';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { useEffect, useRef } from 'react';
import { Animated, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { Button, Paragraph, Spinner, XStack, YStack } from '../../../theme/ui';
import { Body, BodyStrong, Label, Small, Title } from '../../../theme/Typography';
import { PressScale } from '../../../theme/PressScale';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import { depth } from '../../../theme/depth';
import { t } from '../../../i18n/strings';
import {
  CheckIcon,
  InfoIcon,
  SmartphoneIcon,
} from '../../../theme/icons';
import { UseLoginControllerDeps, useLoginController } from '../state/useLoginController';
import { AddBoxForm } from './AddBoxForm';
import { OtpForm } from './OtpForm';
import { ReauthForm } from './ReauthForm';
import { DebugRecordingFrame } from '../../../app/DebugRecordingStrip';
import type {
  AuthMethod,
  DataBoxAccount,
  Host,
  ServerNotice,
} from '../../../services/isds/types';
import { portalUrl } from '../../../services/isds/endpoints';
import type { Credentials } from '../state/loginController';

export interface LoginFlowProps {
  readonly deps: UseLoginControllerDeps;
  /** Fired once when a box is successfully added (the box is already persisted at this point). */
  readonly onSignedIn?: () => void;
  /** When adding an additional box, lets the user back out to the existing boxes. */
  readonly onBack?: () => void;
  /**
   * Re-authenticate an existing box (its session expired) instead of adding a new one. The idle step
   * renders the compact ReauthForm for this box, and a success refreshes its secret (no new row).
   */
  readonly reauth?: DataBoxAccount;
  /**
   * When ISDS refused the box being re-authenticated, if the flow was opened from that refusal - the
   * moment its expired-password verdict is reached at (`ReauthForm`).
   */
  readonly reauthRefusedAt?: number;
  /** Opens the FAQ from the credentials form - help has to be reachable BEFORE you can sign in. */
  readonly onOpenFaq?: () => void;
}

/** Which screen the user is on - remembered so an in-flight login can stay on it (see below). */
type Step = 'form' | 'otp' | 'mk';

/** The login flow for adding a data box. Renders the step that matches the controller's state. */

/** The brand tile on the sign-in progress screen; its pulse ring is drawn concentric with it. */
const TILE_RADIUS = 24;
export function LoginFlow(props: LoginFlowProps) {
  // A recording started before this flow opened is still recording in it, and a sign-in bug is exactly
  // what somebody records (023 FR-007). The flow is drawn outside the navigator, so there is no Debug
  // screen to open from here: the strip is a mark, not a button.
  return (
    <DebugRecordingFrame>
      <LoginFlowSteps {...props} />
    </DebugRecordingFrame>
  );
}

function LoginFlowSteps({
  deps,
  onSignedIn,
  onBack,
  reauth,
  reauthRefusedAt,
  onOpenFaq,
}: LoginFlowProps) {
  const { state, start, retryWithMethod, submitOtp, resendSms, cancel, retry } =
    useLoginController(deps);

  const signaled = useRef(false);
  useEffect(() => {
    if (state.status === 'signedIn' && !signaled.current) {
      signaled.current = true;
      onSignedIn?.();
    }
  }, [state.status, onSignedIn]);

  // The design has no full-screen "Přihlašování…" step: an in-flight attempt KEEPS the current
  // screen (credentials / OTP / re-auth / Mobile Key) and spins inside its footer button. The
  // controller's `authenticating` (and the beat after `signedIn`, before the parent navigates away)
  // therefore re-renders the screen the user submitted from - remembered here, since the state alone
  // no longer says which one that was. Same element type in the same slot ⇒ its inputs keep state.
  const step = useRef<Step>('form');
  const otpArgs = useRef<{ notice?: ServerNotice }>({});
  const mkStatus = useRef(1);
  /**
   * Has ISDS actually sent the code yet?
   *
   * Drives what the code screen SAYS while the request is still in flight, and it has to, because
   * the screen is now shown before the answer arrives (see `beginOtp`). Announcing "we sent you a
   * code" while the request has not returned would be the app stating something it does not know.
   */
  const codeSent = useRef(false);
  /**
   * Go to the code screen the moment an OTP sign-in is submitted, instead of blocking on the
   * credentials form until ISDS answers.
   *
   * Reported from an iPhone: the SMS arrives WHILE the credentials screen is still spinning, and the
   * code screen only appears afterwards - by which time the moment to offer the code has passed. It
   * is worse on Android, where the app's own SMS User Consent watch starts when the code screen
   * mounts, so a text that arrives before that is never offered at all.
   *
   * Arriving early fixes both: the field is focused (iOS offers a code above a focused field, and
   * nowhere else) and the watch is running before the message lands. It is also simply the right
   * shape - a person who just asked for a code should be looking at the box they will type it into.
   */
  const beginOtp = (method: AuthMethod): void => {
    if (method === 'otp_totp') {
      step.current = 'otp';
      otpArgs.current = {};
      codeSent.current = false;
    }
  };
  /**
   * The environment the last sign-in went to - where "Změnit v portálu" has to send someone whose
   * expired password ISDS refused (001 FR-009). A re-auth knows it from the box; adding a box only
   * from what was submitted.
   */
  const lastHost = useRef<Host | null>(reauth?.host ?? null);
  const startLogin = (input: Credentials): Promise<void> => {
    beginOtp(input.method);
    lastHost.current = input.host;
    return start(input);
  };
  /** A resend is another send - the screen should say "odesíláme", not "ověřujeme". */
  const resendOtpSms = (): Promise<void> => {
    codeSent.current = false;
    return resendSms();
  };
  const retryWithOtpMethod = (method: AuthMethod): Promise<void> => {
    beginOtp(method);
    return retryWithMethod(method);
  };
  switch (state.status) {
    case 'idle':
      step.current = 'form';
      break;
    case 'awaitingSmsCode':
      step.current = 'otp';
      otpArgs.current = { notice: state.notice };
      codeSent.current = true;
      break;
    case 'awaitingMobileKey':
      step.current = 'mk';
      mkStatus.current = state.mkStatus;
      break;
    default:
      break;
  }
  const busy = state.status === 'authenticating' || state.status === 'signedIn';
  // 001 FR-009: the fix for an expired password is on the portal, so the screen that says so offers
  // the way there - for the environment the refused sign-in went to.
  const portalHost =
    state.status === 'error' && state.code === 'passwordChangeRequired'
      ? lastHost.current
      : null;

  if (busy && step.current === 'otp') {
    return (
      <OtpForm
        // Two different waits, and the screen must not confuse them: `sending` is "we asked ISDS for
        // a code and have not heard back", `loading` is "we are checking the code you typed".
        sending={!codeSent.current}
        loading={codeSent.current}
        notice={otpArgs.current.notice}
        onSubmit={submitOtp}
        onResend={resendOtpSms}
        onCancel={cancel}
      />
    );
  }
  if (busy && step.current === 'mk') {
    return <MobileKeyWaiting status={mkStatus.current} onCancel={cancel} />;
  }

  switch (state.status) {
    case 'idle':
    case 'authenticating':
    case 'signedIn':
      return reauth ? (
        <ReauthForm
          account={reauth}
          refusedAt={reauthRefusedAt}
          loading={busy}
          onBack={onBack ?? (() => {})}
          onOpenPortal={() => openPortal(reauth.host)}
          onSubmit={(password, method) =>
            startLogin({
              loginName: reauth.loginName,
              password,
              method,
              host: reauth.host,
              reauth: true,
            })
          }
        />
      ) : (
        <AddBoxForm
          onSubmit={startLogin}
          onBack={onBack}
          loading={busy}
          onOpenFaq={onOpenFaq}
        />
      );
    case 'awaitingSmsCode':
      return (
        <OtpForm
          notice={state.notice}
          onSubmit={submitOtp}
          // The resend path that says "odesíláme": a plain `resendSms` left the screen saying the
          // code had been sent and spinning "checking" on the submit button while it asked again.
          onResend={resendOtpSms}
          onCancel={cancel}
        />
      );
    case 'awaitingMobileKey':
      return <MobileKeyWaiting status={state.mkStatus} onCancel={cancel} />;
    case 'error':
      // A password login that smells like a missing SMS code. The design puts the recovery INLINE on
      // the credentials form ("Máte SMS kód?") instead of on its own screen - the form is itself the
      // "edit credentials" affordance the old detour offered. Re-auth has no form to fall back to
      // here, so it keeps the standalone suggestion.
      if (state.suggestOtp) {
        return reauth ? (
          <OtpSuggestion
            onUseSms={() => retryWithOtpMethod('otp_totp')}
            onEdit={retry}
          />
        ) : (
          <AddBoxForm
            onSubmit={startLogin}
            onBack={onBack}
            loading={busy}
            suggestOtp
            onUseSms={() => retryWithOtpMethod('otp_totp')}
            onOpenFaq={onOpenFaq}
          />
        );
      }
      return (
        <ErrorView
          messageKey={state.messageKey}
          onRetry={retry}
          onOpenPortal={portalHost ? () => openPortal(portalHost) : undefined}
        />
      );
    case 'reauthRequired':
      return <ErrorView messageKey="login.error.serverFault" onRetry={retry} />;
    default:
      return null;
  }
}

/** The Data Boxes portal for `host`, in the OS browser. A failure to open it is inert, never a crash. */
function openPortal(host: Host): void {
  void Linking.openURL(portalUrl(host)).catch(() => {});
}

function Centered({ children, testID }: { readonly children: ReactNode; readonly testID: string }) {
  const theme = useTheme();
  return (
    <YStack
      flex={1}
      backgroundColor={theme.bg}
      alignItems="center"
      justifyContent="center"
      padding="$4"
      gap="$3"
      testID={testID}>
      {children}
    </YStack>
  );
}

/**
 * Mobile Key: waiting for the user to approve the push. Narrates the live mepWsStateUpdate2 status.
 * The screen advances on the REAL poll outcome (authService → controller OUTCOME) - there is no
 * "confirm" action here; the only user action is to cancel.
 */
function MobileKeyWaiting({
  status,
  onCancel,
}: {
  readonly status: number;
  readonly onCancel: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // Pulsing halo around the brand tile - a slow ring that scales out + fades (rpulse). Under Reduce
  // Motion the loop never starts, so the ring is a static outline (no animation).
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, pulse]);
  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0],
  });

  // 11/12/13 = push delivered (sent / shown / launched) → nudge the user to approve; else dispatching.
  const subtitle =
    status === 11 || status === 12 || status === 13
      ? t('login.mobileKey.approve')
      : t('login.mobileKey.sending');

  return (
    <YStack flex={1} backgroundColor={theme.bg} testID="mobileKeyWaiting">
      {/* The back chevron cancels the pending Mobile Key request. */}
      <ScreenHeader title={t('login.method.mobile_key')} onBack={onCancel} />

      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        paddingVertical={36}
        paddingHorizontal={32}
      >
        <YStack
          width={104}
          height={104}
          alignItems="center"
          justifyContent="center"
        >
          <Animated.View
            style={{
              position: 'absolute',
              width: 104,
              height: 104,
              // Concentric with the 84 dp tile it rings, 10 dp out: the tile's 24 plus the gap. At 30
              // the ring's corner was 4 dp short and the two outlines pinched at the corners.
              borderRadius: TILE_RADIUS + (104 - 84) / 2,
              borderWidth: 3,
              borderColor: theme.brandTile,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            }}
          />
          {/* The brand tile's glyph is two-tone (design): a pale phone with a GOLD check inside it. */}
          <YStack
            width={84}
            height={84}
            borderRadius={TILE_RADIUS}
            backgroundColor={theme.brandTile}
            alignItems="center"
            justifyContent="center"
          >
            <SmartphoneIcon size={40} color={theme.blueSoft} />
            <YStack position="absolute">
              <CheckIcon size={16} color={theme.gold} />
            </YStack>
          </YStack>
        </YStack>
        <Title fontWeight="700"
          lineHeight={27}
          color={theme.text}
          textAlign="center"
          marginTop={26}
        >
          {t('login.mobileKey.title')}
        </Title>
        <Small fontWeight="500"
          color={theme.textMuted}
          textAlign="center"
          maxWidth={280}
          marginTop={10}
        >
          {subtitle}
        </Small>
        <XStack alignItems="center" gap={8} marginTop={18}>
          <Spinner color={theme.blue} />
          <Label color={theme.textFaint}>
            {t('login.mobileKey.expiryHint')}
          </Label>
        </XStack>
      </YStack>

      {/* Footer: a full-bleed top hairline on the bar itself (design), not an inset rule inside it. */}
      <YStack
        backgroundColor={theme.surfaceAlt}
        borderTopWidth={1}
        borderTopColor={theme.border}
        paddingHorizontal={16}
        paddingTop={12}
        paddingBottom={insets.bottom + 12}
      >
        <Button
          chromeless
          width="100%"
          minHeight={48}
          fontSize={14}
          color={theme.textMuted}
          fontWeight="700"
          onPress={onCancel}
          testID="cancelMobileKey">
          {t('login.cancel')}
        </Button>
      </YStack>
    </YStack>
  );
}

function ErrorView({
  messageKey,
  onRetry,
  onOpenPortal,
}: {
  readonly messageKey: string;
  readonly onRetry: () => void;
  /** Offered when the fix is on the ISDS portal - an expired password (001 FR-009). */
  readonly onOpenPortal?: () => void;
}) {
  const theme = useTheme();
  const info = chipTone('info', theme);
  return (
    <Centered testID="error">
      <Paragraph color={theme.danger} textAlign="center">
        {t(messageKey)}
      </Paragraph>
      {onOpenPortal ? (
        // The same blue text link as the SMS suggestion's: a hand-off to the browser rather than the
        // screen's main button, which stays "try again" for when the password has been changed.
        <XStack
          hitSlop={textSlop('bodyStrong')}
          pressStyle={{ opacity: 0.6 }}
          onPress={onOpenPortal}
          accessibilityRole="link"
          accessibilityLabel={t('pwd.action')}
          testID="openPortal">
          <BodyStrong color={info.accent}>{t('pwd.action')} →</BodyStrong>
        </XStack>
      ) : null}
      <PressScale
        onPress={onRetry}
        accessibilityLabel={t('login.retry')}
        testID="retry">
        <XStack
          minHeight={48}
          borderRadius={14}
          paddingHorizontal={28}
          backgroundColor={theme.text}
          alignItems="center"
          justifyContent="center"
          style={{ boxShadow: depth.sm }}>
          <BodyStrong color={theme.surfaceAlt}>{t('login.retry')}</BodyStrong>
        </XStack>
      </PressScale>
    </Centered>
  );
}

/**
 * Shown when a username+password login was rejected and the box likely requires a one-time code.
 * Guides the user to the OTP methods, reusing the credentials they already entered.
 */
function OtpSuggestion({
  onUseSms,
  onEdit,
}: {
  readonly onUseSms: () => void;
  readonly onEdit: () => void;
}) {
  const theme = useTheme();
  const info = chipTone('info', theme);
  return (
    <Centered testID="otpSuggestion">
      <YStack width="100%" maxWidth={360} gap={14}>
        {/* Blue info card with the SMS-method link (the existing one-time-code recovery). */}
        <XStack
          backgroundColor={info.bg}
          borderRadius={14}
          padding={14}
          gap={12}
          alignItems="flex-start">
          <YStack marginTop={1}>
            <InfoIcon size={20} color={info.accent} />
          </YStack>
          <YStack flex={1} gap={8}>
            <Body color={theme.text}>{t('login.otpSuggested.hint')}</Body>
            <XStack
              alignSelf="flex-start"
              hitSlop={textSlop('bodyStrong')}
              pressStyle={{ opacity: 0.6 }}
              onPress={onUseSms}
              accessibilityRole="button"
              accessibilityLabel={t('login.otpSuggested.useSms')}
              testID="useSms">
              <BodyStrong color={info.accent}>
                {t('login.otpSuggested.useSms')} →
              </BodyStrong>
            </XStack>
          </YStack>
        </XStack>
        <Button
          chromeless
          alignSelf="center"
          color={theme.textMuted}
          fontWeight="700"
          onPress={onEdit}
          testID="editCreds">
          {t('login.otpSuggested.checkPassword')}
        </Button>
      </YStack>
    </Centered>
  );
}
