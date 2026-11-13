import { useRef, useState } from 'react';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import {
  KeyboardAvoidingView,
  Platform,
  type TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, Spinner, XStack, YStack } from '../../../theme/ui';
import { PressScale } from '../../../theme/PressScale';
import { OptionGroup } from '../../../theme/OptionGroup';
import { KeyboardAwareScrollView } from '../../../theme/KeyboardAwareScrollView';
import { BodyStrong, Label, Small, SmallStrong } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { t } from '../../../i18n/strings';
import { hasNoSession, storedReauthKey } from '../state/reauthCopy';
import { refusedForExpiredPassword } from '../state/passwordExpiry';
import { EyeIcon } from '../../../theme/icons';
import { OffsetIcon } from '../../../theme/offsetIcons';
import { EnvelopeTile } from '../../../theme/objects/Envelope';
import { Card } from '../../../theme/Card';
import { textSlop, touchSlop } from '../../../theme/touchTarget';
import { RefusedSuggestion } from './RefusedSuggestion';
import { BoxIdentityLine } from './BoxIdentityLine';
import type { AuthMethod, DataBoxAccount } from '../../../services/isds/types';
import { boxColor } from '../../../theme/boxColor';
import { space } from '../../../theme/spacing';

// The same three methods the add-box step offers (design).
const METHODS: AuthMethod[] = ['password', 'otp_totp', 'mobile_key'];

/** The show-password toggle's drawn width - declared so its touch slop is derived, not guessed. */
const EYE_W = 40;
/** How far in from the field's right edge the show-password button sits. */
const EYE_RIGHT = space.xs;

/**
 * Re-authenticate an existing box whose session expired. Identity (login name + environment) is
 * fixed, but the login METHOD is selectable (defaulting to the stored one): a user can turn OTP
 * on/off on the ISDS portal after adding the box, so re-auth is exactly where that must be corrected.
 * OTP methods then continue to the code step via the shared OTP form; the method that works is
 * persisted by the controller.
 */
export function ReauthForm({
  account,
  onSubmit,
  onBack,
  onOpenPortal,
  loading = false,
  refusedAt,
  suggestOtp = false,
  onUseSms,
}: {
  readonly account: DataBoxAccount;
  readonly onSubmit: (password: string, method: AuthMethod) => void;
  readonly onBack: () => void;
  /**
   * The ISDS portal for this box's environment, offered when its password expired (001 FR-009). The
   * screen told the user to change the password there, and gave them no way to get there until a
   * sign-in had been tried and refused.
   */
  readonly onOpenPortal: () => void;
  /** A re-auth is in flight - the form stays put and the footer button spins (design). */
  readonly loading?: boolean;
  /** When ISDS refused this box, if the screen was opened from that refusal (the inbox strip). */
  readonly refusedAt?: number;
  /**
   * ISDS refused the password and the box may want an SMS code too: the form stays, with what was
   * typed, and R11's suggestion sheet sits under the field - as on adding a box.
   */
  readonly suggestOtp?: boolean;
  /** Sign in again with the SMS-code method, reusing the password typed. */
  readonly onUseSms?: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // 001 FR-009: did this box's refusal come from an expired password? Decided once, when the screen
  // opens, from the verdict stored with the refusal - the one the switcher row shows
  // (`refusedForExpiredPassword`). Read from the clock, it contradicted the row that brought the user
  // here; and re-read on every render, a verdict that flipped while the form is open would push the
  // form down under a link that was not there a moment ago (constitution V).
  //
  // A box with nothing stored is judged at the moment ISDS refused it (`refusedAt`), which is the moment
  // the inbox strip that sent the user here was judged at. Judged when the screen opened instead, a
  // refusal just before the password-expiry date and a tap just after it read "sign in again" on the
  // strip and "change it on the portal" here. Only when nothing says when the refusal came is it now.
  const [judgedAt] = useState(() => refusedAt ?? Date.now());
  const passwordExpired =
    hasNoSession(account) && refusedForExpiredPassword(account, judgedAt);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [method, setMethod] = useState<AuthMethod>(
    METHODS.includes(account.authMethod) ? account.authMethod : 'password',
  );
  const isMobileKey = method === 'mobile_key';
  const canSubmit = password.length > 0;
  // 019: pressing the blocked submit focuses this, which is the part that tells the user WHERE the
  // problem is. The reported failure was skimming straight past this field.
  const passwordRef = useRef<TextInput>(null);

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
  };

  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      {/* No test-env banner: re-auth is a sign-in surface, not a box context. */}
      <ScreenHeader title={t('reauth.title')} onBack={onBack} />

      {/* KeyboardAvoidingView lifts the pinned footer above the keyboard (Android 15+ no longer resizes). */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          // The KeyboardAvoidingView above handles the keyboard; a second inset here double-adjusts.
          adjustKeyboardInsets={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 24,
          }}
        >
        {/* Board R11 (agreed 2026-11-12): why, with the way to the portal; the box as a sheet; the
            methods as the one sheet of choices; the field. */}
        <YStack gap={14}>
          <YStack gap={6}>
            <Small color={theme.bodyText}>
              {t(
                storedReauthKey(
                  account,
                  'reauth.intro',
                  'reauth.intro.credentials',
                  judgedAt,
                ),
              )}
            </Small>
            {/* 001 FR-009: the intro says the fix starts on the portal, so the way there sits right
                under it, before the form - not only on the error screen after a refused attempt. A
                hand-off to the browser, so a text link rather than a second button beside the
                footer's sign-in. */}
            {/* 030 US1: a refusal before the date may be an expiry too (ISDS answers both alike), and
                the intro says so - the same link, under its own testID, since `reauthPortal` is the
                expired verdict the switcher row and the inbox strip are checked against. */}
            {hasNoSession(account) ? (
              <XStack
                alignSelf="flex-start"
                hitSlop={textSlop('smallStrong')}
                pressStyle={{ opacity: 0.6 }}
                onPress={onOpenPortal}
                accessibilityRole="link"
                accessibilityLabel={t('pwd.action')}
                testID={passwordExpired ? 'reauthPortal' : 'reauthPortalCredentials'}
              >
                <SmallStrong color={theme.blue}>{t('pwd.action')} →</SmallStrong>
              </XStack>
            ) : null}
          </YStack>

          {/* Which box is being signed in again - fixed, not editable: its own envelope at 46 with
              R11's 13 corner, the name, the identity line, and the lock. */}
          <Card
            flexDirection="row"
            paddingVertical={12}
            paddingHorizontal={14}
            gap={12}
            alignItems="center"
            testID="reauthBox"
          >
            <EnvelopeTile
              name={account.alias ?? account.label}
              color={boxColor(account)}
              size={46}
              radius={13}
              box
              testID="envelopeTile"
            />
            <YStack flex={1} minWidth={0}>
              <SmallStrong color={theme.text} numberOfLines={1}>
                {account.alias ?? account.label}
              </SmallStrong>
              <BoxIdentityLine account={account} inWindow fontWeight="500" />
            </YStack>
            <YStack testID="reauthLock">
              <OffsetIcon name="lock" size={20} color={theme.textMuted} />
            </YStack>
          </Card>

          {/* The sign-in method - the add-box step's one sheet of choices (R11; a box's method can
              have changed on the portal, so re-auth is where it gets corrected). */}
          <OptionGroup
            options={METHODS.map(m => ({
              value: m,
              label: t(`login.method.${m}.name`),
              description: t(`login.method.${m}.desc`),
            }))}
            value={method}
            onChange={setMethod}
            testIDPrefix="reauth-method"
          />

          <YStack gap={8}>
            <Label color={theme.textMuted}>
              {isMobileKey ? t('login.commCode') : t('login.password')}
            </Label>
            <YStack position="relative">
              <Input
                ref={passwordRef}
                {...inputProps}
                // Typed text stops before the show-password button: its inset, its width, and a gap. The
                // communication code has none and shows as typed (R11, as on adding a box).
                paddingRight={isMobileKey ? inputProps.paddingHorizontal : EYE_RIGHT + EYE_W + space.xs}
                secureTextEntry={!isMobileKey && !showPassword}
                // Standard secure-field hints (iOS uses its own secure keyboard + Keychain autofill).
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
                  <EyeIcon size={20} color={theme.textFaint} off={showPassword} />
                </XStack>
              )}
            </YStack>
          </YStack>

          {suggestOtp && onUseSms ? <RefusedSuggestion onUseSms={onUseSms} onOpenPortal={onOpenPortal} /> : null}
        </YStack>
      </KeyboardAwareScrollView>

      {/* Pinned submit footer (R11): a surfaceAlt bar, tone and no hairline. The KeyboardAvoidingView
          above lifts it over the IME. */}
      <YStack
        backgroundColor={theme.surfaceAlt}
        paddingHorizontal={16}
        paddingTop={12}
        paddingBottom={insets.bottom + 12}
      >
        <PressScale
          fullWidth
          // Busy and blocked are different answers: while signing in the button stays silent, but an
          // empty password now gets a refusal and sends focus to the field (019).
          busy={loading}
          blockedReason={
            canSubmit
              ? undefined
              : isMobileKey
              ? t('login.needCommCode')
              : t('login.needPassword')
          }
          onBlockedPress={() => passwordRef.current?.focus()}
          onPress={() => onSubmit(password, method)}
          accessibilityLabel={t('reauth.submit')}
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
            {loading ? <Spinner size="small" color={theme.surfaceAlt} /> : null}
            <BodyStrong color={theme.surfaceAlt}>
              {loading ? t('login.authenticating') : t('reauth.submit')}
            </BodyStrong>
          </XStack>
        </PressScale>
        </YStack>
      </KeyboardAvoidingView>
    </YStack>
  );
}
