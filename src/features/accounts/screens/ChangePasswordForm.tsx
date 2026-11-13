// Change a password box's password (030 US2).
//
// The person types the CURRENT password again - the owner's requirement, and what ISDS checks: the app
// sends what was typed here, never the password it has stored (`changeBoxPassword`). The new one is
// typed twice, and every rule ISDS states is listed under it from the start and ticked as it is met,
// so nothing appears or moves while the person types (constitution V). Only ISDS knows whether a
// password was used before; that one is a note, and ISDS's own refusal says so if it was.
//
// Board R11 draws the form (031, agreed 2026-11-12): the box as the sign-in screens' sheet, the rules
// on a sheet of their own, a met rule a filled green tick and an open one a ring. R8 draws its error,
// a danger tone block with no outline and no icon, and the done state, the lock at hero size (no
// postmark: ISDS certifies no time here).

import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { Input, Spinner, XStack, YStack } from '../../../theme/ui';
import { PressScale } from '../../../theme/PressScale';
import { KeyboardAwareScrollView } from '../../../theme/KeyboardAwareScrollView';
import { Body, BodyStrong, Caption, Label, Meta, Small, SmallStrong, Title } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import Svg, { Path } from 'react-native-svg';
import { EyeIcon } from '../../../theme/icons';
import { OffsetIcon } from '../../../theme/offsetIcons';
import { Card } from '../../../theme/Card';
import { textSlop, touchSlop } from '../../../theme/touchTarget';
import { space } from '../../../theme/spacing';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';
import { BoxSheet } from './BoxSheet';
import { PASSWORD_RULES, passwordRules } from '../state/passwordRules';
import type { ChangePasswordOutcome } from '../state/changePassword';
import { formatExpiryDate } from '../state/passwordExpiry';

/** The show-password toggle's drawn width - declared so its touch slop is derived, not guessed. */
const EYE_W = 40;
/** How far in from the field's right edge the show-password button sits. */
const EYE_RIGHT = space.xs;
/** A rule's mark (R11): a filled tick once it is met, a ring of the same size until then. */
const TICK = 20;
/** The check inside the filled tick. */
const CHECK = 13;

type Field = 'current' | 'new' | 'repeat';

/** Every rule's sentence, written out so the key guard can see each one (no computed keys). */
const RULE_TEXT = {
  length: 'pwdChange.rule.length',
  upper: 'pwdChange.rule.upper',
  lower: 'pwdChange.rule.lower',
  digit: 'pwdChange.rule.digit',
  allowed: 'pwdChange.rule.allowed',
  noLogin: 'pwdChange.rule.noLogin',
  noTriple: 'pwdChange.rule.noTriple',
  noWeakStart: 'pwdChange.rule.noWeakStart',
  differs: 'pwdChange.rule.differs',
  match: 'pwdChange.rule.match',
} as const;
const LISTED_RULES = [...PASSWORD_RULES, 'differs', 'match'] as const;

/** The outcome's sentence, for every outcome but success. */
function errorText(outcome: Exclude<ChangePasswordOutcome, { kind: 'changed' }>): string {
  switch (outcome.kind) {
    case 'wrongPassword':
      return t('pwdChange.error.wrongPassword');
    case 'refused':
      return outcome.message
        ? t('pwdChange.error.refused', { m: outcome.message })
        : t('pwdChange.error.refusedPlain');
    case 'network':
      return t('login.error.network');
    case 'timeout':
      return t('pwdChange.error.timeout');
    case 'notSaved':
      return t('pwdChange.error.notSaved');
    case 'serverFault':
      return t('login.error.serverFault');
  }
}

export function ChangePasswordForm({
  account,
  onSubmit,
  onBack,
  onDone,
  onOpenPortal,
}: {
  readonly account: DataBoxAccount;
  /** Change it. Never rejects (`changeBoxPassword`). */
  readonly onSubmit: (current: string, next: string) => Promise<ChangePasswordOutcome>;
  readonly onBack: () => void;
  /** Leave after a change: the box is signed in with the new password by now. */
  readonly onDone: () => void;
  /** The ISDS portal for this box's environment - where an expired password is changed. */
  readonly onOpenPortal: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const danger = chipTone('dangerSoft', theme);
  const [values, setValues] = useState<Record<Field, string>>({
    current: '',
    new: '',
    repeat: '',
  });
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ChangePasswordOutcome | null>(null);
  const refs: Record<Field, React.RefObject<TextInput | null>> = {
    current: useRef<TextInput>(null),
    new: useRef<TextInput>(null),
    repeat: useRef<TextInput>(null),
  };

  // Nothing is ticked before anything is typed: an empty field does not "avoid three in a row".
  const verdicts = useMemo(() => {
    const typed = values.new.length > 0;
    const rules = passwordRules(values.new, account.loginName);
    return {
      length: typed && rules.length,
      upper: typed && rules.upper,
      lower: typed && rules.lower,
      digit: typed && rules.digit,
      allowed: typed && rules.allowed,
      noLogin: typed && rules.noLogin,
      noTriple: typed && rules.noTriple,
      noWeakStart: typed && rules.noWeakStart,
      differs: typed && values.new !== values.current,
      match: typed && values.new === values.repeat,
    };
  }, [values, account.loginName]);
  const rulesMet = PASSWORD_RULES.every(rule => verdicts[rule]) && verdicts.differs;
  // Which field to fix, in the order the screen asks for them (019: the blocked press says why and
  // goes there).
  const blocking: { field: Field; reason: string } | null =
    values.current.length === 0
      ? { field: 'current', reason: t('pwdChange.need.current') }
      : !rulesMet
      ? { field: 'new', reason: t('pwdChange.need.rules') }
      : !verdicts.match
      ? { field: 'repeat', reason: t('pwdChange.need.match') }
      : null;

  const submit = async () => {
    setBusy(true);
    setOutcome(null);
    const result = await onSubmit(values.current, values.new);
    setBusy(false);
    setOutcome(result);
  };

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

  const footerButton = (label: string, onPress: () => void, testID: string) => (
    // R11: a surfaceAlt bar, tone and no hairline; R8's done state has no bar, only the button.
    <YStack
      backgroundColor={testID === 'done' ? undefined : theme.surfaceAlt}
      paddingHorizontal={16}
      paddingTop={12}
      paddingBottom={insets.bottom + 12}
    >
      <PressScale
        fullWidth
        busy={busy}
        blockedReason={testID === 'submit' ? blocking?.reason : undefined}
        onBlockedPress={() => (blocking ? refs[blocking.field].current?.focus() : undefined)}
        onPress={onPress}
        accessibilityLabel={label}
        testID={testID}
      >
        <XStack
          width="100%"
          minHeight={52}
          borderRadius={14}
          backgroundColor={theme.text}
          alignItems="center"
          justifyContent="center"
          gap={space.md}
        >
          {busy ? <Spinner size="small" color={theme.surfaceAlt} /> : null}
          <BodyStrong color={theme.surfaceAlt}>{busy ? t('pwdChange.busy') : label}</BodyStrong>
        </XStack>
      </PressScale>
    </YStack>
  );

  if (outcome?.kind === 'changed') {
    // R8: the lock at hero size in its sunken disc, then what happened and what follows. The board's
    // 96 above the disc rounds to 60, the top of the scale, and its 32 under it to 36.
    return (
      <YStack flex={1} backgroundColor={theme.bg} testID="pwdChangeDone">
        <ScreenHeader title={t('pwdChange.title')} onBack={onDone} />
        <YStack flex={1} alignItems="center" paddingHorizontal={28} paddingTop={60}>
          <YStack
            width={132}
            height={132}
            borderRadius={999}
            backgroundColor={theme.surfaceSunken}
            alignItems="center"
            justifyContent="center"
            testID="pwdDoneLock"
          >
            <OffsetIcon name="lock" size={72} color={theme.text} />
          </YStack>
          <Title alignSelf="stretch" textAlign="center" marginTop={36} accessibilityRole="header">
            {t('pwdChange.done.title')}
          </Title>
          <Body color={theme.bodyText} textAlign="center" marginTop={8}>
            {outcome.passwordExpiresAt != null
              ? t('pwdChange.done.until', { date: formatExpiryDate(outcome.passwordExpiresAt) })
              : t('pwdChange.done.noDate')}
          </Body>
          <Small color={theme.textMuted} textAlign="center" maxWidth={300} marginTop={8} textBreakStrategy="balanced">
            {t('pwdChange.done.everywhere')}
          </Small>
        </YStack>
        {footerButton(t('pwdChange.done.close'), onDone, 'done')}
      </YStack>
    );
  }

  const field = (key: Field, label: string, autoComplete: 'current-password' | 'new-password') => (
    <PasswordField
      key={key}
      inputRef={refs[key]}
      label={label}
      value={values[key]}
      onChange={text => setValues(v => ({ ...v, [key]: text }))}
      autoComplete={autoComplete}
      inputProps={inputProps}
      testID={`pwd-${key}`}
    />
  );

  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      <ScreenHeader title={t('pwdChange.title')} onBack={onBack} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          adjustKeyboardInsets={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 24,
          }}
        >
          <YStack gap={14}>
            <Small color={theme.bodyText}>{t('pwdChange.intro')}</Small>

            <BoxSheet account={account} />

            {/* R8: a danger tone block, the words in its ink at 14/600, no outline and no icon. */}
            {outcome != null ? (
              <YStack
                backgroundColor={danger.bg}
                borderRadius={12}
                paddingVertical={12}
                paddingHorizontal={14}
                testID="pwdChangeError"
              >
                <Small fontWeight="600" color={danger.fg}>
                  {errorText(outcome)}
                </Small>
                {outcome.kind === 'wrongPassword' ? (
                  <XStack
                    alignSelf="flex-start"
                    marginTop={2}
                    hitSlop={textSlop('smallStrong')}
                    pressStyle={{ opacity: 0.6 }}
                    onPress={onOpenPortal}
                    accessibilityRole="link"
                    accessibilityLabel={t('pwd.action')}
                    testID="pwdChangePortal"
                  >
                    <SmallStrong color={danger.fg}>{t('pwd.action')} →</SmallStrong>
                  </XStack>
                ) : null}
              </YStack>
            ) : null}

            {field('current', t('pwdChange.current'), 'current-password')}
            {field('new', t('pwdChange.new'), 'new-password')}
            {field('repeat', t('pwdChange.repeat'), 'new-password')}

            <Card paddingVertical={12} paddingHorizontal={14} testID="pwdRules">
              <Label fontWeight="700" color={theme.textMuted}>
                {t('pwdChange.rules')}
              </Label>
              <YStack marginTop={6}>
                {LISTED_RULES.map(rule => (
                  <Rule key={rule} met={verdicts[rule]} text={t(RULE_TEXT[rule])} rule={rule} />
                ))}
              </YStack>
            </Card>
            <Meta color={theme.textMuted} marginHorizontal={4}>
              {t('pwdChange.rule.history')}
            </Meta>
          </YStack>
        </KeyboardAwareScrollView>
        {footerButton(t('pwdChange.submit'), () => void submit(), 'submit')}
      </KeyboardAvoidingView>
    </YStack>
  );
}

/**
 * One rule (R11): a filled green tick once it is met, an empty ring of the same size until then, so
 * nothing moves. A met rule's words sit back in body ink; an open one's stay in ink, to be seen.
 */
function Rule({ met, text, rule }: { readonly met: boolean; readonly text: string; readonly rule: string }) {
  const theme = useTheme();
  return (
    <XStack
      gap={10}
      paddingVertical={4}
      alignItems="flex-start"
      accessible
      accessibilityLabel={`${text}: ${t(met ? 'pwdChange.rule.met' : 'pwdChange.rule.unmet')}`}
      testID={`rule-${rule}-${met ? 'met' : 'unmet'}`}
    >
      {met ? (
        <YStack
          width={TICK}
          height={TICK}
          borderRadius={999}
          backgroundColor={theme.success}
          alignItems="center"
          justifyContent="center"
          testID={`tick-${rule}`}
        >
          <Svg width={CHECK} height={CHECK} viewBox="0 0 24 24">
            <Path
              d="M20 6 9 17l-5-5"
              fill="none"
              stroke={theme.surface}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </YStack>
      ) : (
        <YStack
          width={TICK}
          height={TICK}
          borderRadius={999}
          borderWidth={2}
          borderColor={theme.borderStrong}
          testID={`ring-${rule}`}
        />
      )}
      <Caption flex={1} color={met ? theme.bodyText : theme.text}>
        {text}
      </Caption>
    </XStack>
  );
}

function PasswordField({
  inputRef,
  label,
  value,
  onChange,
  autoComplete,
  inputProps,
  testID,
}: {
  readonly inputRef: React.RefObject<TextInput | null>;
  readonly label: string;
  readonly value: string;
  readonly onChange: (text: string) => void;
  readonly autoComplete: 'current-password' | 'new-password';
  readonly inputProps: Record<string, unknown> & { height: number };
  readonly testID: string;
}) {
  const theme = useTheme();
  const [show, setShow] = useState(false);
  return (
    <YStack gap={space.base}>
      <Label color={theme.textMuted}>{label}</Label>
      <YStack position="relative">
        <Input
          ref={inputRef}
          {...inputProps}
          paddingRight={EYE_RIGHT + EYE_W + space.xs}
          secureTextEntry={!show}
          textContentType={autoComplete === 'new-password' ? 'newPassword' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect={false}
          value={value}
          onChangeText={onChange}
          placeholder={label}
          accessibilityLabel={label}
          testID={testID}
        />
        <XStack
          position="absolute"
          right={EYE_RIGHT}
          top={0}
          bottom={0}
          width={EYE_W}
          alignItems="center"
          justifyContent="center"
          hitSlop={touchSlop({ width: EYE_W, height: inputProps.height })}
          pressStyle={{ opacity: 0.6 }}
          onPress={() => setShow(v => !v)}
          accessibilityRole="button"
          accessibilityLabel={t(show ? 'login.password.hide' : 'login.password.show')}
          testID={`${testID}-toggle`}
        >
          <EyeIcon size={20} color={theme.textFaint} off={show} />
        </XStack>
      </YStack>
    </YStack>
  );
}
