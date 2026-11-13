import { useEffect, useRef, useState } from 'react';
import { useAutoFocus } from '../../../theme/useAutoFocus';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { Button, Spinner, XStack, YStack } from '../../../theme/ui';
import { PressScale } from '../../../theme/PressScale';
import { KeyboardAwareScrollView } from '../../../theme/KeyboardAwareScrollView';
import { BodyStrong, Code, Display, Label, Value } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { BellIcon } from '../../../theme/icons';
import { t } from '../../../i18n/strings';
import { serverNoticeKey } from '../../../i18n/serverMessages';
import { useContentBottom } from '../../../theme/useContentBottom';
import type { ServerNotice } from '../../../services/isds/types';
import { listenForSmsCode } from '../../../services/sms/smsUserConsent';
import { useSingleFlight } from '../../../app/useSingleFlight';

/**
 * ISDS's SMS code is eight digits: `otpFromSms.ts` quotes one message, and the owner checked the rest
 * of theirs (2026-11-13), all eight. Board R8 draws a box for each, and Confirm waits for all eight: a
 * shorter code can only be refused, and a refusal spends one of the few attempts before ISDS blocks
 * the box.
 */
export const OTP_LENGTH = 8;

/** What the field keeps of what was typed or pasted: the digits, at most eight. */
export function otpDigits(text: string): string {
  return text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
}

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
  const [focused, setFocused] = useState(false);
  const canSubmit = code.length === OTP_LENGTH;
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
      setCode(otpDigits(received));
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
          paddingHorizontal: 16,
          paddingTop: 24,
          paddingBottom: contentBottom,
        }}
      >
        {/* Board R8 "SMS code": the step's name, the notice as a blue tone strip, the field's label,
            a box per digit, Confirm (dimmed until all eight are in) and the resend link. */}
        <YStack gap={14}>
          <Display accessibilityRole="header">{t('login.otp.smsTitle')}</Display>
          <XStack
            minHeight={44}
            alignItems="center"
            gap={10}
            paddingVertical={12}
            paddingLeft={14}
            paddingRight={6}
            borderRadius={12}
            backgroundColor={theme.blueSoft}
            testID="otpNotice"
          >
            <View testID="otpNoticeBell">
              <BellIcon size={18} color={theme.blueDark} />
            </View>
            <Value flex={1} color={theme.blueDark}>
              {noticeText}
            </Value>
          </XStack>

          <Label color={theme.textMuted} marginTop={6}>
            {t('login.otp.code')}
          </Label>
          <View>
            <XStack gap={8} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {Array.from({ length: OTP_LENGTH }, (_, i) => {
                // The box the next digit goes into carries the focus line while the field has focus.
                // The boxes share the column's width, edge to edge with the strip and the button: the
                // board's 34s left a ragged gap on the right (the owner, 2026-11-13). Each grows with its
                // digit at a large text size rather than crop it.
                const next = focused && i === Math.min(code.length, OTP_LENGTH - 1);
                return (
                  <YStack
                    key={i}
                    flex={1}
                    minWidth={34}
                    minHeight={48}
                    borderRadius={11}
                    backgroundColor={theme.surface}
                    borderWidth={next ? 1.5 : 1}
                    borderColor={next ? theme.blue : theme.borderStrong}
                    alignItems="center"
                    justifyContent="center"
                    testID={`otpCell-${i}`}
                  >
                    <Code>{code[i] ?? ''}</Code>
                  </YStack>
                );
              })}
            </XStack>
            {/* The real field lies over the boxes, its own text unseen: it is what the keyboard, the
                OS's code suggestion, a paste and a screen reader all talk to. */}
            {/* React Native's own input: Tamagui's dropped the transparent ink, and the typed digits
                showed through the first boxes on the walk. */}
            <TextInput
              ref={codeRef}
              style={styles.hiddenField}
              // What `Input` gives every other field: the keyboard in the app's theme, not the OS's (iOS).
              keyboardAppearance={theme.name === 'dark' ? 'dark' : 'light'}
              caretHidden
              maxLength={OTP_LENGTH}
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
                const digits = otpDigits(next);
                typed.current = digits.length > 0;
                setCode(digits);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              accessibilityLabel={t('login.otp.code')}
              testID="otpCode"
            />
          </View>

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
            onPress={() => onSubmit(code)}
            accessibilityLabel={t('login.otp.submit')}
            testID="otpSubmit"
            style={{ marginTop: 14 }}
          >
            {/* Verifying spins INSIDE the button (design) - the code screen never swaps for a spinner. */}
            <XStack
              width="100%"
              minHeight={52}
              borderRadius={14}
              backgroundColor={theme.text}
              opacity={canSubmit && !sending ? 1 : 0.55}
              // Dimmed as one piece, as the board's button is: Android otherwise fades the label over
              // the already faded fill, and the walk showed it grey on grey.
              needsOffscreenAlphaCompositing
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
              alignSelf="center"
              minHeight={44}
              paddingHorizontal={4}
              fontSize={14}
              color={theme.blue}
              fontWeight="700"
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

const styles = StyleSheet.create({
  // Over the whole row of boxes, so a tap on any box focuses it; its own text never drawn.
  // Not opacity 0, which iOS treats as gone and offers no code to; at 0.011 its 1 px text cannot show
  // through the boxes either (the walk saw the digits faintly at full size).
  hiddenField: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: 'transparent',
    fontSize: 1,
    opacity: 0.011,
  },
});
