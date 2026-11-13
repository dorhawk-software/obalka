import type { ReactNode } from 'react';
import { textSlop } from '../../../theme/touchTarget';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, XStack, YStack } from '../../../theme/ui';
import { Body, BodyStrong, Heading, Label, Small, SmallStrong, Title } from '../../../theme/Typography';
import { WaitingBar } from '../../../theme/ProgressBar';
import { WaitingEnvelope } from '../../../theme/objects/WaitingEnvelope';
import { PressScale } from '../../../theme/PressScale';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import { t } from '../../../i18n/strings';
import { ExternalLinkIcon, InfoIcon } from '../../../theme/icons';
import { Card } from '../../../theme/Card';
import { Well } from '../../../theme/Well';
import { NeutralButton } from '../../../theme/NeutralButton';
import { EnvelopePose } from '../../../theme/objects/Envelope';
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
import { LineIcon } from '../../../theme/LineIcon';

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
  /** The login name the request went out for: the waiting envelope's window shows it (R8). */
  const lastLogin = useRef<string>(reauth?.loginName ?? '');
  /** What the last attempt sent: coming back to the form after it lands on the filled fields. */
  const lastInput = useRef<Credentials | null>(null);
  const startLogin = (input: Credentials): Promise<void> => {
    beginOtp(input.method);
    lastInput.current = input;
    lastHost.current = input.host;
    lastLogin.current = input.loginName;
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
  // A wrong name or password may be an expired one too, as the refusal itself says; a re-auth knows the
  // box's date, and a refusal while it is still ahead is not that (ReauthForm).
  const refused =
    state.status === 'error' && (state.code === 'passwordChangeRequired' || state.code === 'invalidCredentials');
  const portalHost =
    state.status === 'error' && (state.code === 'passwordChangeRequired' || (refused && !reauth))
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
    return <MobileKeyWaiting status={mkStatus.current} loginName={lastLogin.current} onCancel={cancel} />;
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
          initial={lastInput.current}
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
      return <MobileKeyWaiting status={state.mkStatus} loginName={lastLogin.current} onCancel={cancel} />;
    case 'error':
      // A password login that smells like a missing SMS code. The design puts the recovery INLINE on
      // the credentials form ("Máte SMS kód?") instead of on its own screen - the form is itself the
      // "edit credentials" affordance the old detour offered. Re-auth has no form to fall back to
      // here, so it keeps the standalone suggestion.
      if (state.suggestOtp) {
        return reauth ? (
          <OtpSuggestion
            onUseSms={() => retryWithOtpMethod('otp_totp')}
            onOpenPortal={() => openPortal(reauth.host)}
            onEdit={retry}
          />
        ) : (
          <AddBoxForm
            onSubmit={startLogin}
            onBack={onBack}
            initial={lastInput.current}
            loading={busy}
            suggestOtp
            onUseSms={() => retryWithOtpMethod('otp_totp')}
            onOpenPortal={openPortal}
            onOpenFaq={onOpenFaq}
          />
        );
      }
      return refused ? (
        <SignInRefused
          title={reauth ? t('reauth.title') : t('login.title')}
          messageKey={state.messageKey}
          onEdit={retry}
          onOpenPortal={portalHost ? () => openPortal(portalHost) : undefined}
        />
      ) : (
        <SignInError messageKey={state.messageKey} onRetry={retry} />
      );
    case 'reauthRequired':
      return <SignInError messageKey="login.error.serverFault" onRetry={retry} />;
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
 *
 * Board R8 (031, agreed 2026-11-12): the box's envelope stands still, its flap sealed and the login
 * name in the window; the one waiting bar is the only motion, as transfer and backup wait. It replaced
 * a brand tile in a pulsing ring and a platform spinner. Under Reduce Motion the bar is an empty track
 * and the line under the title says what is happening.
 */
function MobileKeyWaiting({
  status,
  loginName,
  onCancel,
}: {
  readonly status: number;
  readonly loginName: string;
  readonly onCancel: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // 11/12/13 = push delivered (sent / shown / launched) → nudge the user to approve; else dispatching.
  const subtitle =
    status === 11 || status === 12 || status === 13
      ? t('login.mobileKey.approve')
      : t('login.mobileKey.sending');

  return (
    <YStack flex={1} backgroundColor={theme.bg} testID="mobileKeyWaiting">
      {/* The back chevron cancels the pending Mobile Key request. */}
      <ScreenHeader title={t('login.method.mobile_key')} onBack={onCancel} />

      <YStack flex={1} alignItems="center" paddingTop={36} paddingHorizontal={24}>
        <WaitingEnvelope label={t('login.loginName')} name={loginName} testID="mobileKeyEnvelope" />
        <Title fontWeight="700" textAlign="center" maxWidth={300} marginTop={36} textBreakStrategy="balanced">
          {t('login.mobileKey.title')}
        </Title>
        <Small color={theme.textMuted} textAlign="center" maxWidth={290} marginTop={10} textBreakStrategy="balanced">
          {subtitle}
        </Small>
        <YStack width={220} marginTop={28}>
          <WaitingBar label={subtitle} testID="mobileKeyBar" />
        </YStack>
        <Label fontWeight="500" color={theme.textFaint} marginTop={10}>
          {t('login.mobileKey.expiryHint')}
        </Label>
      </YStack>

      <YStack
        backgroundColor={theme.surfaceAlt}
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
/**
 * ISDS refused the sign-in: the name, the password, or its expiry (031 board R8, agreed 2026-11-12).
 * One card on the flow's own page: the lock in its well, what ISDS said, the way back to the fields
 * and - where the fix may be there - the portal. Before: red centred words over a shadowed button.
 */
function SignInRefused({
  title,
  messageKey,
  onEdit,
  onOpenPortal,
}: {
  /** The flow's own name, so the header says where the person still is. */
  readonly title: string;
  readonly messageKey: string;
  readonly onEdit: () => void;
  /** Offered when the fix may be on the ISDS portal - an expired password (001 FR-009). */
  readonly onOpenPortal?: () => void;
}) {
  const theme = useTheme();
  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      <ScreenHeader title={title} onBack={onEdit} />
      <YStack paddingTop={16} paddingHorizontal={16}>
        <Card padding={16} gap={10} testID="signInRefused">
          <XStack gap={12} alignItems="flex-start">
            <Well name="lock" />
            <YStack flex={1} gap={4}>
              <Heading accessibilityRole="header">{t('login.refused.title')}</Heading>
              <Small color={theme.bodyText}>{t(messageKey)}</Small>
            </YStack>
          </XStack>
          <PressScale fullWidth onPress={onEdit} accessibilityLabel={t('login.refused.edit')} testID="retry">
            <XStack
              width="100%"
              minHeight={48}
              borderRadius={14}
              paddingHorizontal={12}
              backgroundColor={theme.text}
              alignItems="center"
              justifyContent="center"
            >
              <BodyStrong color={theme.surfaceAlt} textAlign="center">
                {t('login.refused.edit')}
              </BodyStrong>
            </XStack>
          </PressScale>
          {onOpenPortal ? (
            // A hand-off to the browser, not the card's main action: the password is changed there,
            // then the fields are tried again.
            <XStack
              alignSelf="flex-start"
              minHeight={44}
              paddingHorizontal={4}
              gap={6}
              alignItems="center"
              pressStyle={{ opacity: 0.6 }}
              onPress={onOpenPortal}
              accessibilityRole="link"
              accessibilityLabel={t('pwd.action')}
              testID="openPortal"
            >
              <SmallStrong color={theme.blue}>{t('pwd.action')}</SmallStrong>
              <ExternalLinkIcon size={16} color={theme.blue} />
            </XStack>
          ) : null}
        </Card>
      </YStack>
    </YStack>
  );
}

/**
 * Where the flow cannot go on for any other reason - the network, a timeout, ISDS itself (031 board
 * R11, agreed 2026-11-12): the sealed envelope of the list's agreed "could not load", the reason, and
 * Zkusit znovu. The board's 120 above the envelope rounds to 60, the top of the scale, and its 32 at the sides to 36; its 46 / 13 / 14
 * button is the neutral button's compact 48 / 14 / 15.
 */
function SignInError({ messageKey, onRetry }: { readonly messageKey: string; readonly onRetry: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <YStack
      flex={1}
      backgroundColor={theme.bg}
      alignItems="center"
      paddingTop={insets.top + 60}
      paddingHorizontal={36}
      testID="signInError"
    >
      <EnvelopePose pose="sealed" />
      <Body
        alignSelf="stretch"
        fontWeight="600"
        color={theme.danger}
        textAlign="center"
        marginTop={36}
        textBreakStrategy="balanced"
      >
        {t(messageKey)}
      </Body>
      <YStack marginTop={24}>
        <NeutralButton compact inline label={t('login.retry')} onPress={onRetry} testID="retry" />
      </YStack>
    </YStack>
  );
}

/**
 * Shown when a username+password login was rejected and the box likely requires a one-time code.
 * Guides the user to the OTP methods, reusing the credentials they already entered.
 */
function OtpSuggestion({
  onUseSms,
  onOpenPortal,
  onEdit,
}: {
  readonly onUseSms: () => void;
  /** Where an expired password is changed - the refusal may be one (030 US1). */
  readonly onOpenPortal: () => void;
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
          <LineIcon role="body">
            <InfoIcon size={20} color={info.accent} />
          </LineIcon>
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
            <XStack
              alignSelf="flex-start"
              hitSlop={textSlop('bodyStrong')}
              pressStyle={{ opacity: 0.6 }}
              onPress={onOpenPortal}
              accessibilityRole="link"
              accessibilityLabel={t('pwd.action')}
              testID="refusedPortal">
              <BodyStrong color={info.accent}>{t('pwd.action')} →</BodyStrong>
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
