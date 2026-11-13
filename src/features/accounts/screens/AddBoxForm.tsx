import { useState, useRef } from 'react';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { textSlop, touchSlop } from '../../../theme/touchTarget';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, Spinner, XStack, YStack } from '../../../theme/ui';
import type { TextInput } from 'react-native';
import { PressScale } from '../../../theme/PressScale';
import { SegmentedControl } from '../../../theme/SegmentedControl';
import { KeyboardAwareScrollView } from '../../../theme/KeyboardAwareScrollView';
import { BodyStrong, Caption, Heading, Label, Meta, SmallStrong } from '../../../theme/Typography';
import { RefusedSuggestion } from './RefusedSuggestion';
import { useTheme } from '../../../theme/ThemeProvider';
import { t } from '../../../i18n/strings';
import type { AuthMethod, Host } from '../../../services/isds/types';
import { Credentials } from '../state/loginController';
import {
  ChevronDownIcon,
  EyeIcon,
  HelpIcon,
  InfoIcon,
} from '../../../theme/icons';
import { Card } from '../../../theme/Card';
import { OptionGroup } from '../../../theme/OptionGroup';
import { space } from '../../../theme/spacing';

// Every sign-in method the app supports: name and password, an SMS code, and Mobile Key.
const METHODS: AuthMethod[] = ['password', 'otp_totp', 'mobile_key'];
const ENVIRONMENTS: Host[] = ['production', 'czebox'];

// Drawn sizes their touch slop is derived from, declared once so the two cannot drift apart.
/** The show-password toggle's width. */
const EYE_W = 40;
/** How far in from the field's right edge the show-password button sits. */
const EYE_RIGHT = space.xs;
/** The help link's padding (R11): the column's 14 and its own 6 above, 6 below. */
const FAQ_PAD_TOP = 20;
const FAQ_PAD_BOTTOM = 6;

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
  onOpenPortal,
  initial = null,
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
  /** The ISDS portal of an environment - where an expired password is changed (030 US1). */
  readonly onOpenPortal?: (host: Host) => void;
  /**
   * What the last attempt sent, when the flow comes back here after it: the refusal's "Upravit jméno
   * nebo heslo", Zkusit znovu, a cancelled wait. The form opens on the fields, filled, instead of the
   * method choice the person already made.
   */
  readonly initial?: Credentials | null;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'method' | 'credentials'>(initial ? 'credentials' : 'method');
  const [loginName, setLoginName] = useState(initial?.loginName ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [method, setMethod] = useState<AuthMethod>(initial?.method ?? 'password');
  const [host, setHost] = useState<Host>(initial?.host ?? 'production');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [alias, setAlias] = useState(initial?.alias ?? '');
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

  // Paper inputs (design §3): card fill, strong hairline, radius 14, 50px tall.
  const inputProps = {
    height: 50,
    backgroundColor: theme.surface,
    borderColor: theme.borderStrong,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
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
            // R11 starts the method step 20 down, rounded to 18, and the fields 16 down.
            paddingTop: step === 'method' ? 18 : 16,
            paddingBottom: 24,
          }}
        >
        {step === 'method' ? (
          <YStack gap={14}>
            {/* Board R11 (agreed 2026-11-12): the question and its line, then the methods as one
                sheet, a row each, the radio on the right - the anatomy of Settings' Vzhled. */}
            <YStack gap={4}>
              <Heading>{t('login.method.choose')}</Heading>
              <Caption>{t('login.method.chooseSub')}</Caption>
            </YStack>
            <OptionGroup
              options={METHODS.map(m => ({
                value: m,
                label: t(`login.method.${m}.name`),
                description: t(`login.method.${m}.desc`),
              }))}
              value={method}
              onChange={selectMethod}
              testIDPrefix="method"
            />

            {/* Advanced: the ISDS environment. Tucked away - almost everyone uses production. */}
            <YStack gap={14}>
              <XStack
                alignSelf="flex-start"
                alignItems="center"
                gap={6}
                paddingVertical={4}
                paddingHorizontal={2}
                hitSlop={textSlop('label', { paddingTop: 4, paddingBottom: 4 })}
                pressStyle={{ opacity: 0.6 }}
                onPress={() => setShowAdvanced(v => !v)}
                accessibilityRole="button"
                accessibilityLabel={t('login.advanced')}
                testID="advancedToggle"
              >
                <Label fontWeight="700" color={theme.textMuted}>
                  {t('login.advanced')}
                </Label>
                {/* ▾ collapsed / ▴ expanded (design) - one glyph, flipped. */}
                <YStack rotate={showAdvanced ? '180deg' : '0deg'}>
                  <ChevronDownIcon size={16} color={theme.textMuted} />
                </YStack>
              </XStack>

              {showAdvanced ? (
                <Card
                  padding={14}
                  gap={10}
                >
                  {/* The glyph marks the help under the switch, which stays open (R11). */}
                  <XStack alignItems="center" gap={6}>
                    <Label color={theme.textMuted}>{t('login.environment')}</Label>
                    <InfoIcon size={16} color={theme.textFaint} />
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
                  <Meta color={theme.textMuted}>
                    <Meta fontWeight="700" color={theme.textMuted}>
                      {t('login.env.production')}
                    </Meta>{' '}
                    {t('login.environment.help.production')}
                  </Meta>
                  <Meta color={theme.textMuted}>
                    <Meta fontWeight="700" color={theme.textMuted}>
                      {t('login.env.czebox')}
                    </Meta>{' '}
                    {t('login.environment.help.czebox')}
                  </Meta>
                  <Meta color={theme.textMuted}>
                    {t('login.environment.help.recommend')}{' '}
                    <Meta fontWeight="700" color={theme.textMuted}>
                      {t('login.env.production')}
                    </Meta>
                    .
                  </Meta>
                </Card>
              ) : null}
            </YStack>
          </YStack>
        ) : (
          <YStack gap={14}>
            {/* Which method these fields are for (step 1's choice): R11's chip, as small as its words,
                the info glyph and the label in the dark brand blue on the soft one. Only METHODS reach
                this step, and each has a `login.method.label.*` string. */}
            <XStack
              alignSelf="flex-start"
              alignItems="center"
              gap={6}
              backgroundColor={theme.blueSoft}
              borderRadius={8}
              paddingTop={4}
              paddingBottom={4}
              paddingLeft={8}
              paddingRight={10}
              testID="methodChip"
            >
              <InfoIcon size={15} color={theme.blueDark} />
              <Label color={theme.blueDark}>{t(`login.method.label.${method}`)}</Label>
            </XStack>

            <YStack gap={8}>
              <Label color={theme.textMuted}>{t('login.loginName')}</Label>
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
              <Label color={theme.textMuted}>
                {isMobileKey ? t('login.commCode') : t('login.password')}
              </Label>
              <YStack position="relative">
                <Input
                  ref={passwordRef}
                  {...inputProps}
                  // Typed text stops before the show-password button: its inset, its width, and a gap.
                  // The communication code has no button (R11): a one-off token from the portal, shown
                  // as typed so a pasted one can be checked, and useless without the Mobile Key's own
                  // approval.
                  paddingRight={isMobileKey ? inputProps.paddingHorizontal : EYE_RIGHT + EYE_W + space.xs}
                  secureTextEntry={!isMobileKey && !showPassword}
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
                {isMobileKey ? null : (
                  <XStack
                    position="absolute"
                    right={EYE_RIGHT}
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
                )}
              </YStack>
              {/* Only Mobile Key gets a helper line (design) - the password/SMS fields speak for themselves. */}
              {isMobileKey ? (
                <Meta color={theme.textFaint}>
                  {t('login.mobileKey.help')}
                </Meta>
              ) : null}
            </YStack>

            {/* A rejected password login that smells like "this box also wants a one-time code": the
                design keeps the user ON the form and offers the SMS method from an inline card, so the
                already-typed name/password stay visible and editable (no full-screen detour). */}
            {suggestOtp && onUseSms ? (
              <RefusedSuggestion onUseSms={onUseSms} onOpenPortal={onOpenPortal ? () => onOpenPortal(host) : undefined} />
            ) : null}

            <YStack gap={8}>
              {/* One run in the field labels' muted tone (R11). */}
              <Label color={theme.textMuted}>
                {t('alias.title')} {t('common.optional')}
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
            alignSelf="flex-start"
            alignItems="center"
            gap={6}
            paddingTop={FAQ_PAD_TOP}
            paddingBottom={FAQ_PAD_BOTTOM}
            paddingHorizontal={2}
            // The 14/20 line plus the padding actually drawn, so the target follows the type scale.
            hitSlop={textSlop('smallStrong', { paddingTop: FAQ_PAD_TOP, paddingBottom: FAQ_PAD_BOTTOM })}
            onPress={onOpenFaq}
            pressStyle={{ opacity: 0.5 }}
            accessibilityRole="button"
            testID="login-faq"
          >
            {/* R11: the link in blue at the left, under the form, with the help glyph. */}
            <HelpIcon size={18} color={theme.blue} />
            <SmallStrong color={theme.blue}>{t('faq.help')}</SmallStrong>
          </XStack>
        ) : null}
      </KeyboardAwareScrollView>

      {/* Pinned action footer (R11): a surfaceAlt bar, tone and no hairline. Continue on the method
          step, Submit on the credentials step. The KeyboardAvoidingView above lifts it over the IME. */}
      <YStack
          backgroundColor={theme.surfaceAlt}
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
