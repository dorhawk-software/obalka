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
import { KeyboardAwareScrollView } from '../../../theme/KeyboardAwareScrollView';
import { BodyStrong, Label, Meta, Small, Value } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { t } from '../../../i18n/strings';
import { hasNoSession, storedReauthKey } from '../state/reauthCopy';
import { refusedForExpiredPassword } from '../state/passwordExpiry';
import { EyeIcon, LockIcon } from '../../../theme/icons';
import { Avatar } from '../../../theme/Avatar';
import { chipTone } from '../../../theme/chipTone';
import { textSlop, touchSlop } from '../../../theme/touchTarget';
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
  // The same blue text link the login error screen uses for the same hand-off.
  const info = chipTone('info', theme);
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
            paddingTop: 24,
            paddingBottom: 24,
          }}
        >
        <YStack gap={18}>
          <YStack gap={8}>
            <Small fontWeight="500" color={theme.textMuted}>
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
            {passwordExpired ? (
              <XStack
                alignSelf="flex-start"
                hitSlop={textSlop('bodyStrong')}
                pressStyle={{ opacity: 0.6 }}
                onPress={onOpenPortal}
                accessibilityRole="link"
                accessibilityLabel={t('pwd.action')}
                testID="reauthPortal"
              >
                <BodyStrong color={info.accent}>{t('pwd.action')} →</BodyStrong>
              </XStack>
            ) : null}
          </YStack>

          {/* Which box is being re-authenticated (name + identity line) - locked, non-editable. */}
          <XStack
            backgroundColor={theme.surface}
            borderWidth={1}
            borderColor={theme.border}
            borderRadius={16}
            padding={14}
            gap={12}
            alignItems="center"
          >
            <Avatar
              name={account.alias ?? account.label}
              color={boxColor(account)}
              size={46}
            />
            <YStack flex={1} minWidth={0} gap={2}>
              <BodyStrong color={theme.text} numberOfLines={1}>
                {account.alias ?? account.label}
              </BodyStrong>
              <BoxIdentityLine account={account} />
            </YStack>
            <LockIcon size={17} color={theme.textFaint} />
          </XStack>

          {/* The sign-in method - the same radio cards as the add-box step (a box's method can have
              changed on the portal, so re-auth is where it gets corrected). */}
          <YStack gap={10}>
            {METHODS.map(m => {
              const selected = method === m;
              return (
                <PressScale
                  key={m}
                  fullWidth
                  onPress={() => setMethod(m)}
                  accessibilityLabel={t(`login.method.${m}.name`)}
                  testID={`reauth-method-${m}`}
                >
                  <XStack
                    alignItems="center"
                    gap={12}
                    paddingVertical={13}
                    paddingHorizontal={14}
                    backgroundColor={selected ? theme.blueSoft : theme.surface}
                    borderWidth={selected ? 1.5 : 1}
                    borderColor={selected ? theme.blue : theme.border}
                    borderRadius={14}
                  >
                    {/* Radio: empty ring resting, filled blue disc + white dot when selected. */}
                    <YStack
                      width={22}
                      height={22}
                      borderRadius={999}
                      borderWidth={selected ? 0 : 2}
                      borderColor={theme.borderStrong}
                      backgroundColor={selected ? theme.blue : theme.surface}
                      alignItems="center"
                      justifyContent="center"
                    >
                      {selected ? (
                        <YStack
                          width={8}
                          height={8}
                          borderRadius={999}
                          backgroundColor={theme.onBlue}
                        />
                      ) : null}
                    </YStack>
                    <YStack flex={1} minWidth={0}>
                      <Value fontWeight="700">
                        {t(`login.method.${m}.name`)}
                      </Value>
                      <Meta
                        marginTop={2}
                        color={theme.textMuted}
                      >
                        {t(`login.method.${m}.desc`)}
                      </Meta>
                    </YStack>
                  </XStack>
                </PressScale>
              );
            })}
          </YStack>

          <YStack gap={8}>
            <Label>
              {isMobileKey ? t('login.commCode') : t('login.password')}
            </Label>
            <YStack position="relative">
              <Input
                ref={passwordRef}
                {...inputProps}
                // Typed text stops before the show-password button: its inset, its width, and a gap.
                  paddingRight={EYE_RIGHT + EYE_W + space.xs}
                secureTextEntry={!showPassword}
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
            </YStack>
          </YStack>

        </YStack>
      </KeyboardAwareScrollView>

      {/* Pinned submit footer (design §3); the KeyboardAvoidingView above lifts it over the IME. */}
      <YStack
        backgroundColor={theme.surfaceAlt}
        borderTopWidth={1}
        borderTopColor={theme.border}
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
