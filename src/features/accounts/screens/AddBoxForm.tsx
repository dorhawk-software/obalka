import { useState, useRef } from 'react';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { textSlop, touchSlop } from '../../../theme/touchTarget';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, Paragraph, Spinner, Text, XStack, YStack } from '../../../theme/ui';
import type { TextInput } from 'react-native';
import { PressScale } from '../../../theme/PressScale';
import { SegmentedControl } from '../../../theme/SegmentedControl';
import { KeyboardAwareScrollView } from '../../../theme/KeyboardAwareScrollView';
import { BodyStrong, Caption, Heading, Label } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import { t } from '../../../i18n/strings';
import type { AuthMethod, Host } from '../../../services/isds/types';
import { Credentials } from '../state/loginController';
import {
  ChevronDownIcon,
  EyeIcon,
  HelpIcon,
  InfoIcon,
  SmartphoneIcon,
} from '../../../theme/icons';

// Every sign-in method the app supports: name and password, an SMS code, and Mobile Key.
const METHODS: AuthMethod[] = ['password', 'otp_totp', 'mobile_key'];
const ENVIRONMENTS: Host[] = ['production', 'czebox'];

// Drawn sizes their touch slop is derived from, declared once so the two cannot drift apart.
/** The show-password toggle's width. */
const EYE_W = 40;
/** The help link's padding: generous above, where it parts from the form, tight below. */
const FAQ_PAD_TOP = 20;
const FAQ_PAD_BOTTOM = 4;

/**
 * Add a data box. A method-first, two-step wizard: STEP 1 picks the sign-in method (the choice that
 * determines what the secret IS - chosen up front, never after); STEP 2 collects only that method's
 * fields, correctly labelled. OTP/Mobile Key then chain to their own downstream steps (OtpForm /
 * MobileKeyWaiting) in LoginFlow. Environment lives under an "Advanced" disclosure (most users use prod).
 */
export function AddBoxForm({
  onSubmit,
  onBack,
  loading = false,
  suggestOtp = false,
  onUseSms,
  onOpenFaq,
}: {
  readonly onSubmit: (creds: Credentials) => void;
  readonly onBack?: () => void;
  /** Opens the FAQ. Someone stuck here often does not know where ISDS credentials come from. */
  readonly onOpenFaq?: () => void;
  /** A login is in flight - the form stays put and the footer button spins (design: no busy screen). */
  readonly loading?: boolean;
  /**
   * The last password login was rejected and the box likely also needs a one-time code. The design
   * has no separate suggestion screen: the hint is an INLINE card on the credentials step, right
   * under the password field, so the entered credentials stay on screen and editable.
   */
  readonly suggestOtp?: boolean;
  /** Retry with the SMS-code method, reusing the credentials already typed in. */
  readonly onUseSms?: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'method' | 'credentials'>('method');
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [method, setMethod] = useState<AuthMethod>('password');
  const [host, setHost] = useState<Host>('production');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showEnvHelp, setShowEnvHelp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [alias, setAlias] = useState('');
  const isMobileKey = method === 'mobile_key';
  const canSubmit = loginName.trim().length > 0 && password.length > 0;
  // 019: focus whichever field is actually missing - the login name if it is empty, otherwise the
  // password. Pointing at the wrong one would be worse than pointing at nothing.
  const loginRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const blockedReason = canSubmit
    ? undefined
    : loginName.trim().length === 0
    ? t('login.needLoginName')
    : t('login.needPassword');
  const focusBlocking = () =>
    (loginName.trim().length === 0 ? loginRef : passwordRef).current?.focus();
  const info = chipTone('info', theme);

  // Paper inputs (design §3): card fill, strong hairline, radius 14, 50px tall.
  const inputProps = {
    height: 50,
    backgroundColor: theme.surface,
    borderColor: theme.borderStrong,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 15,
    color: theme.text,
    placeholderTextColor: theme.textFaint,
    focusStyle: { borderColor: theme.blue, borderWidth: 1.5 },
  } as const;

  // STEP 1 only SELECTS the method (no auto-advance) so the user can also set the environment under
  // Advanced before continuing; a footer "Pokračovat" then advances to STEP 2.
  const selectMethod = (m: AuthMethod) => setMethod(m);
  const submit = () =>
    onSubmit({
      loginName: loginName.trim(),
      // Passwords keep significant spaces; the Mobile Key communication code is a generated token -
      // trim it so a copy-paste trailing space can't 401.
      password: isMobileKey ? password.trim() : password,
      method,
      host,
      alias: alias.trim() || undefined,
    });

  const headerBack = step === 'method' ? onBack : () => setStep('method');
  // Credentials step: the design titles it plainly "Přihlášení" - except for Mobile Key, which keeps
  // its method name (there is no password to "sign in" with, the screen is about the comm code).
  const headerTitle =
    step === 'method'
      ? t('login.title')
      : isMobileKey
        ? t('login.method.mobile_key.name')
        : t('login.creds.title');

  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      <ScreenHeader title={headerTitle} onBack={headerBack ?? undefined} />

      {/* KeyboardAvoidingView lifts the pinned footer above the keyboard - on Android 15+ (edge-to-edge)
          the window no longer resizes for adjustResize, so a sibling footer would sit behind the IME. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          // The KeyboardAvoidingView above already lifts everything over the IME; letting the scroll
          // view ALSO inset for the keyboard double-adjusts and flings a directly-tapped alias field
          // to the top.
          adjustKeyboardInsets={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 24,
          }}
        >
        {step === 'method' ? (
          <YStack gap={18}>
            <YStack>
              <Heading marginBottom={6}>{t('login.method.choose')}</Heading>
              <Caption lineHeight={18} marginBottom={18}>
                {t('login.method.chooseSub')}
              </Caption>
              <YStack gap={12}>
                {METHODS.map(m => {
                  const selected = method === m;
                  return (
                    <PressScale
                      key={m}
                      fullWidth
                      onPress={() => selectMethod(m)}
                      accessibilityLabel={t(`login.method.${m}.name`)}
                      testID={`method-${m}`}
                    >
                      <XStack
                        alignItems="center"
                        gap={13}
                        padding={15}
                        backgroundColor={selected ? theme.blueSoft : theme.surface}
                        borderWidth={selected ? 1.5 : 1}
                        borderColor={selected ? theme.blue : theme.border}
                        borderRadius={14}
                      >
                        {/* Radio: empty ring resting, filled blue dot when selected. */}
                        <YStack
                          width={22}
                          height={22}
                          borderRadius={999}
                          borderWidth={selected ? 0 : 2}
                          borderColor={theme.borderStrong}
                          backgroundColor={selected ? theme.blue : 'transparent'}
                          alignItems="center"
                          justifyContent="center"
                        >
                          {selected ? (
                            <YStack
                              width={9}
                              height={9}
                              borderRadius={999}
                              backgroundColor={theme.onBlue}
                            />
                          ) : null}
                        </YStack>
                        <YStack flex={1} gap={2}>
                          <BodyStrong>
                            {t(`login.method.${m}.name`)}
                          </BodyStrong>
                          <Caption color={theme.textMuted}>
                            {t(`login.method.${m}.desc`)}
                          </Caption>
                        </YStack>
                      </XStack>
                    </PressScale>
                  );
                })}
              </YStack>
            </YStack>

            {/* Advanced: the ISDS environment. Tucked away - almost everyone uses production. */}
            <YStack gap={10}>
              <XStack
                alignItems="center"
                gap={6}
                hitSlop={textSlop('bodyStrong', { fontSize: 14 })}
                pressStyle={{ opacity: 0.6 }}
                onPress={() => setShowAdvanced(v => !v)}
                accessibilityRole="button"
                accessibilityLabel={t('login.advanced')}
                testID="advancedToggle"
              >
                <BodyStrong fontSize={14} color={theme.textMuted}>
                  {t('login.advanced')}
                </BodyStrong>
                {/* ▾ collapsed / ▴ expanded (design) - one glyph, flipped. */}
                <YStack rotate={showAdvanced ? '180deg' : '0deg'}>
                  <ChevronDownIcon size={16} color={theme.textMuted} />
                </YStack>
              </XStack>

              {showAdvanced ? (
                <YStack
                  backgroundColor={theme.surface}
                  borderWidth={1}
                  borderColor={theme.border}
                  borderRadius={14}
                  padding={14}
                  gap={10}
                >
                  <XStack alignItems="center" gap={6}>
                    <Label>{t('login.environment')}</Label>
                    <XStack
                      width={18}
                      height={18}
                      borderRadius={999}
                      borderWidth={1.5}
                      borderColor={theme.textMuted}
                      alignItems="center"
                      justifyContent="center"
                      // Was `hitSlop={10}`, which put this 18pt "?" at a 38pt target - under the
                      // 48 both platforms ask for. Derived now, so it cannot drift again.
                      hitSlop={touchSlop({ width: 18, height: 18 })}
                      pressStyle={{ opacity: 0.6 }}
                      onPress={() => setShowEnvHelp(v => !v)}
                      accessibilityRole="button"
                      accessibilityLabel={t('login.environment.helpA11y')}
                      testID="env-help"
                    >
                      <Text
                        fontSize={12}
                        fontWeight="800"
                        color={theme.textMuted}
                        // 15 on iOS: it clips ink to the line box, and the system font's own line at
                        // 12 is 14.3 (src/theme/inkClipping.ts). Android paints past the line and keeps
                        // the design's 14, which it measures in whole pixels - 15 would be a different
                        // box and move the glyph in the 18pt dot. Centred in it on both.
                        lineHeight={Platform.OS === 'ios' ? 15 : 14}
                      >
                        i
                      </Text>
                    </XStack>
                  </XStack>
                  <SegmentedControl
                    segments={ENVIRONMENTS.map(env => ({
                      key: env,
                      label: t(`login.env.${env}`),
                    }))}
                    value={host}
                    onChange={setHost}
                    testID="env"
                  />
                  {showEnvHelp ? (
                    <YStack gap={8}>
                      <Paragraph
                        fontSize={13}
                        lineHeight={18}
                        color={theme.textMuted}
                      >
                        <Text fontSize={13} fontWeight="800" color={theme.text}>
                          {t('login.env.production')}
                        </Text>{' '}
                        {t('login.environment.help.production')}
                      </Paragraph>
                      <Paragraph
                        fontSize={13}
                        lineHeight={18}
                        color={theme.textMuted}
                      >
                        <Text fontSize={13} fontWeight="800" color={theme.text}>
                          {t('login.env.czebox')}
                        </Text>{' '}
                        {t('login.environment.help.czebox')}
                      </Paragraph>
                      <Paragraph
                        fontSize={13}
                        lineHeight={18}
                        color={theme.textMuted}
                      >
                        {t('login.environment.help.recommend')}{' '}
                        <Text fontSize={13} fontWeight="800" color={theme.text}>
                          {t('login.env.production')}
                        </Text>
                        .
                      </Paragraph>
                    </YStack>
                  ) : null}
                </YStack>
              ) : null}
            </YStack>
          </YStack>
        ) : (
          <YStack gap={16}>
            {/* Which sign-in method these credentials are for (the choice from step 1) - the design's
                13/600 brand-blue method label ("Přihlášení heslem" / "…přes SMS kód" / "…Mobilním klíčem").
                Only METHODS reach this step, and each has a `login.method.label.*` string. */}
            <XStack
              alignItems="center"
              gap={9}
              marginBottom={4}
              backgroundColor={info.bg}
              borderRadius={12}
              paddingHorizontal={13}
              paddingVertical={11}
            >
              <InfoIcon size={18} color={info.accent} />
              <Label color={info.fg}>{t(`login.method.label.${method}`)}</Label>
            </XStack>

            <YStack gap={8}>
              <Label>{t('login.loginName')}</Label>
              <Input
                ref={loginRef}
                {...inputProps}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                autoComplete="username"
                value={loginName}
                onChangeText={setLoginName}
                placeholder={t('login.loginName.placeholder')}
                accessibilityLabel={t('login.loginName')}
                testID="loginName"
              />
            </YStack>

            <YStack gap={8}>
              <Label>
                {isMobileKey ? t('login.commCode') : t('login.password')}
              </Label>
              <YStack position="relative">
                <Input
                  ref={passwordRef}
                  {...inputProps}
                  paddingRight={48}
                  secureTextEntry={!showPassword}
                  // Mark it a real password field so iOS uses its standard secure keyboard (a
                  // third-party keyboard is correctly blocked here for security) and offers Keychain
                  // autofill; the Mobile Key comm code is a one-off token, so it opts out.
                  textContentType={isMobileKey ? 'none' : 'password'}
                  autoComplete={isMobileKey ? 'off' : 'current-password'}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={
                    isMobileKey
                      ? t('login.commCode.placeholder')
                      : t('login.password')
                  }
                  accessibilityLabel={
                    isMobileKey ? t('login.commCode') : t('login.password')
                  }
                  testID="password"
                />
                <XStack
                  position="absolute"
                  right={5}
                  top={0}
                  bottom={0}
                  width={EYE_W}
                  alignItems="center"
                  justifyContent="center"
                  // As tall as the input it sits in (top/bottom 0), which already clears the floor;
                  // only its width is short.
                  hitSlop={touchSlop({ width: EYE_W, height: inputProps.height })}
                  pressStyle={{ opacity: 0.6 }}
                  onPress={() => setShowPassword(v => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    showPassword ? 'login.password.hide' : 'login.password.show',
                  )}
                  testID="togglePassword"
                >
                  <EyeIcon
                    size={20}
                    color={theme.textFaint}
                    off={showPassword}
                  />
                </XStack>
              </YStack>
              {/* Only Mobile Key gets a helper line (design) - the password/SMS fields speak for themselves. */}
              {isMobileKey ? (
                <Caption fontSize={12} lineHeight={16} color={theme.textFaint}>
                  {t('login.mobileKey.help')}
                </Caption>
              ) : null}
            </YStack>

            {/* A rejected password login that smells like "this box also wants a one-time code": the
                design keeps the user ON the form and offers the SMS method from an inline card, so the
                already-typed name/password stay visible and editable (no full-screen detour). */}
            {suggestOtp && onUseSms ? (
              <XStack
                backgroundColor={info.bg}
                borderWidth={1}
                borderColor={info.border ?? info.accent}
                borderRadius={14}
                paddingHorizontal={14}
                paddingVertical={13}
                gap={11}
                alignItems="flex-start"
                testID="otpSuggestion"
              >
                <YStack marginTop={1}>
                  <SmartphoneIcon size={20} color={info.accent} />
                </YStack>
                <YStack flex={1}>
                  <BodyStrong fontSize={13} lineHeight={17}>
                    {t('login.otpSuggest.title')}
                  </BodyStrong>
                  <Caption fontSize={12} lineHeight={16} marginTop={2}>
                    {t('login.otpSuggest.sub')}
                  </Caption>
                  <XStack
                    alignSelf="flex-start"
                    marginTop={8}
                    hitSlop={textSlop('bodyStrong', { fontSize: 13 })}
                    pressStyle={{ opacity: 0.6 }}
                    onPress={onUseSms}
                    accessibilityRole="button"
                    accessibilityLabel={t('login.otpSuggest.btn')}
                    testID="useSms"
                  >
                    <BodyStrong fontSize={13} lineHeight={17} color={info.accent}>
                      {t('login.otpSuggest.btn')} →
                    </BodyStrong>
                  </XStack>
                </YStack>
              </XStack>
            ) : null}

            <YStack gap={8}>
              {/* Two runs (design): the name in the field-label tone, "(volitelné)" a shade fainter. */}
              <Label>
                {t('alias.title')}{' '}
                <Caption color={theme.textFaint}>{t('common.optional')}</Caption>
              </Label>
              <Input
                {...inputProps}
                value={alias}
                onChangeText={setAlias}
                placeholder={t('login.alias.placeholder')}
                accessibilityLabel={t('login.alias')}
                testID="alias"
              />
            </YStack>

          </YStack>
        )}

        {/* Help sits at the END of the scroll, below the form - quiet, and never between the fields
            and the action. Returning restores this form with whatever was typed still in place. */}
        {onOpenFaq ? (
          <XStack
            alignSelf="center"
            alignItems="center"
            justifyContent="center"
            gap={6}
            paddingTop={FAQ_PAD_TOP}
            paddingBottom={FAQ_PAD_BOTTOM}
            // The dense 14pt label (its line box matches the 16pt icon beside it) plus the padding
            // actually drawn, so the target follows the type scale rather than a typed number.
            hitSlop={textSlop('label', {
              fontSize: 14,
              dense: true,
              paddingTop: FAQ_PAD_TOP,
              paddingBottom: FAQ_PAD_BOTTOM,
            })}
            onPress={onOpenFaq}
            pressStyle={{ opacity: 0.5 }}
            accessibilityRole="button"
            testID="login-faq"
          >
            <HelpIcon size={16} color={theme.textMuted} />
            <Label fontSize={14} dense color={theme.textMuted}>
              {t('faq.help')}
            </Label>
          </XStack>
        ) : null}
      </KeyboardAwareScrollView>

      {/* Pinned action footer (design §3): a surfaceAlt bar + top hairline. Continue on the method
          step, Submit on the credentials step. The KeyboardAvoidingView above lifts it over the IME. */}
      <YStack
          backgroundColor={theme.surfaceAlt}
          borderTopWidth={1}
          borderTopColor={theme.border}
          paddingHorizontal={16}
          paddingTop={12}
          paddingBottom={insets.bottom + 12}
        >
          {step === 'method' ? (
            <PressScale
              fullWidth
              onPress={() => setStep('credentials')}
              accessibilityLabel={t('common.continue')}
              testID="continue"
            >
              <XStack
                width="100%"
                minHeight={52}
                borderRadius={14}
                backgroundColor={theme.text}
                alignItems="center"
                justifyContent="center"
              >
                <BodyStrong color={theme.surfaceAlt}>
                  {t('common.continue')}
                </BodyStrong>
              </XStack>
            </PressScale>
          ) : (
            <PressScale
              fullWidth
              busy={loading}
              blockedReason={blockedReason}
              onBlockedPress={focusBlocking}
              onPress={submit}
              accessibilityLabel={t('login.submit')}
              testID="submit"
            >
              {/* Signing in spins INSIDE the button (design) - the form never swaps for a busy screen. */}
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
                  {loading ? t('login.authenticating') : t('login.submit')}
                </BodyStrong>
              </XStack>
            </PressScale>
          )}
        </YStack>
      </KeyboardAvoidingView>
    </YStack>
  );
}
