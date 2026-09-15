import { useEffect, useRef, useState } from 'react';
import { useAutoFocus } from '../../../theme/useAutoFocus';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { Platform, type TextInput } from 'react-native';
import { Button, Input, Spinner, XStack, YStack } from '../../../theme/ui';
import { PressScale } from '../../../theme/PressScale';
import { KeyboardAwareScrollView } from '../../../theme/KeyboardAwareScrollView';
import { BodyStrong, Caption, Title } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { t } from '../../../i18n/strings';
import { serverNoticeKey } from '../../../i18n/serverMessages';
import { useContentBottom } from '../../../theme/useContentBottom';
import type { ServerNotice } from '../../../services/isds/types';
import { listenForSmsCode } from '../../../services/sms/smsUserConsent';
import { useSingleFlight } from '../../../app/useSingleFlight';

export interface OtpFormProps {
  /** Optional ISDS confirmation (e.g. "code sent"), shown above the code field. */
  readonly notice?: ServerNotice;
  /** The code is being verified - the screen stays put and the submit button spins (design). */
  readonly loading?: boolean;
  /**
   * The code has been ASKED for and ISDS has not answered yet.
   *
   * This screen is shown from the moment the user submits their credentials, so that the field is
   * focused and listening before the SMS lands (the code used to arrive while the previous screen
   * was still spinning). Which means it can be on screen before the code exists - and it must not
   * claim otherwise, nor accept a code it has nowhere to send yet.
   */
  readonly sending?: boolean;
  readonly onSubmit: (code: string) => void;
  /** Ask for another SMS. Returns the request, so the link stays taken until it has answered. */
  readonly onResend?: () => void | Promise<void>;
  readonly onCancel: () => void;
}

export function OtpForm({
  notice,
  loading = false,
  sending = false,
  onSubmit,
  onResend,
  onCancel,
}: OtpFormProps) {
  const theme = useTheme();
  const contentBottom = useContentBottom(28);
  const [code, setCode] = useState('');
  const canSubmit = code.trim().length > 0;
  const codeRef = useRef<TextInput>(null); // 019: a blocked press focuses the code field
  // Whether the field currently holds something the user typed. An arriving code must not overwrite
  // it - they may well be reading the SMS off a second device and typing faster than the prompt
  // appears. It goes false again when they clear the field, so a resent code can still fill it.
  const typed = useRef(false);
  /**
   * "Poslat SMS znovu" is its own request to ISDS and a real SMS to the box owner's phone, so a
   * double tap must not make it two (audit 2026-09-23). Disabled while anything is in flight - but a
   * disabled prop lands a render late, and the second tap of a double tap arrives before it; the
   * guard is decided in the tap itself.
   */
  const resendOnce = useSingleFlight();
  const inFlight = sending || loading;

  // Focus the code field on arrival. This screen is where that matters most: iOS offers a Security
  // Code AutoFill suggestion above a FOCUSED field, so without it there was nowhere for the code to
  // appear (reported from an iPhone, 2026-08-19). The two reasons `autoFocus` cannot do this - and
  // the reason a bare timeout was only half of the answer - live in `useAutoFocus`.
  useAutoFocus(codeRef);

  // 021: offer the code from the incoming SMS. Listening starts when this screen mounts and stops
  // when it goes away, which is the ONLY window in which this app ever asks about SMS at all. The
  // code is placed in the field and NOT submitted: a misread code that submits itself spends one of
  // a small number of attempts and can lock the box, while one sitting in the field is visible and
  // correctable. Android-only; on iOS the field's `textContentType` already does this.
  useEffect(() => {
    return listenForSmsCode(received => {
      if (typed.current) {
        return;
      }
      setCode(received);
      codeRef.current?.focus();
    });
  }, []);
  // The SMS screen always confirms "code sent" in the app's language. ISDS's own message enriches it
  // only when available - RN's fetch follows the 302 redirect and usually drops that header, and the
  // server text is Czech-only, so we never depend on it.
  const noticeKey = serverNoticeKey(notice?.code);
  const serverText = noticeKey ? t(noticeKey) : notice?.text;
  // While the request is in flight there is nothing to report yet: saying "we sent you a code"
  // before ISDS has said so would be the app asserting something it does not know (Principle VI).
  const noticeText = sending
    ? t('login.otp.notice.smsSending')
    : serverText ?? t('login.otp.notice.smsSent');

  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      {/* Paper header - back chevron cancels the OTP step (returns to the add-box form). */}
      <ScreenHeader
        title={t('login.otp.verify')}
        onBack={onCancel}
        testID="otpCancel"
      />

      <KeyboardAwareScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 28,
          paddingBottom: contentBottom,
        }}
      >
        <YStack>
          {/* Centered title + subtitle (design): the header reads "Ověření"; the body names the step
              and the SMS confirmation is a plain centered subtitle, not a chip. No field label. */}
          <Title fontWeight="700" accessibilityRole="header" textAlign="center">
            {t('login.otp.smsTitle')}
          </Title>
          {noticeText ? (
            <Caption
              color={theme.textMuted}
              textAlign="center"
              alignSelf="center"
              maxWidth={250}
              marginTop={8}
              testID="otpNotice"
            >
              {noticeText}
            </Caption>
          ) : null}

          <Input
            ref={codeRef}
            minHeight={64}
            marginTop={28}
            backgroundColor={theme.surface}
            borderColor={theme.borderStrong}
            borderWidth={1.5}
            borderRadius={14}
            color={theme.text}
            placeholderTextColor={theme.textFaint}
            placeholder="••••••"
            textAlign="center"
            fontSize={30}
            fontWeight="700"
            letterSpacing={14}
            keyboardType="number-pad"
            // OTP autofill from the incoming SMS - no SMS-read permission needed:
            // iOS Security Code AutoFill suggestion + Android keyboard/autofill OTP suggestion.
            // `autoComplete` is per platform because its vocabularies are: `sms-otp` is an Android
            // value and means nothing on iOS, where the equivalent is `one-time-code`. (RN only maps
            // it to `textContentType` when `textContentType` is absent, so this was never breaking
            // the iOS hint - but naming the wrong platform's value was misleading either way.)
            textContentType="oneTimeCode"
            autoComplete={Platform.OS === 'ios' ? 'one-time-code' : 'sms-otp'}
            value={code}
            onChangeText={(next: string) => {
              typed.current = next.trim().length > 0;
              setCode(next);
            }}
            focusStyle={{ borderColor: theme.blue, borderWidth: 1.5 }}
            accessibilityLabel={t('login.otp.code')}
            testID="otpCode"
          />

          <PressScale
            fullWidth
            busy={loading}
            blockedReason={
              sending
                ? t('login.otp.stillSending')
                : canSubmit
                ? undefined
                : t('login.needCode')
            }
            onBlockedPress={() => codeRef.current?.focus()}
            onPress={() => onSubmit(code.trim())}
            accessibilityLabel={t('login.otp.submit')}
            testID="otpSubmit"
            style={{ marginTop: 24 }}
          >
            {/* Verifying spins INSIDE the button (design) - the code screen never swaps for a spinner. */}
            <XStack
              width="100%"
              minHeight={52}
              borderRadius={14}
              backgroundColor={theme.text}
              alignItems="center"
              justifyContent="center"
              gap={10}
            >
              {loading ? (
                <Spinner size="small" color={theme.surfaceAlt} />
              ) : null}
              <BodyStrong color={theme.surfaceAlt}>
                {t('login.otp.submit')}
              </BodyStrong>
            </XStack>
          </PressScale>

          {onResend ? (
            <Button
              chromeless
              width="100%"
              fontSize={14}
              color={theme.warningInk}
              fontWeight="700"
              marginTop={18}
              // Dimmed rather than removed or resized while a request runs: nothing below may move
              // (constitution V), and a second request while a code is being checked or an SMS sent
              // would be the controller's to refuse anyway.
              disabled={inFlight}
              opacity={inFlight ? 0.45 : 1}
              onPress={() => {
                void resendOnce(onResend);
              }}
              testID="otpResend"
            >
              {t('login.otp.resend')}
            </Button>
          ) : null}
        </YStack>
      </KeyboardAwareScrollView>
    </YStack>
  );
}
