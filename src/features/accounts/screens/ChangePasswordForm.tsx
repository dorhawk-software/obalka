// Change a password box's password (030 US2).
//
// The person types the CURRENT password again - the owner's requirement, and what ISDS checks: the app
// sends what was typed here, never the password it has stored (`changeBoxPassword`). The new one is
// typed twice, and every rule ISDS states is listed under it from the start and ticked as it is met,
// so nothing appears or moves while the person types (constitution V). Only ISDS knows whether a
// password was used before; that one is a note, and ISDS's own refusal says so if it was.

import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { Input, Spinner, XStack, YStack } from '../../../theme/ui';
import { PressScale } from '../../../theme/PressScale';
import { KeyboardAwareScrollView } from '../../../theme/KeyboardAwareScrollView';
import { Body, BodyStrong, Heading, Label, Meta, Small } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import { AlertIcon, CheckIcon, EyeIcon, LockIcon } from '../../../theme/icons';
import { Avatar } from '../../../theme/Avatar';
import { boxColor } from '../../../theme/boxColor';
import { textSlop, touchSlop } from '../../../theme/touchTarget';
import { space } from '../../../theme/spacing';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';
import { BoxIdentityLine } from './BoxIdentityLine';
import { PASSWORD_RULES, passwordRules } from '../state/passwordRules';
import type { ChangePasswordOutcome } from '../state/changePassword';
import { formatExpiryDate } from '../state/passwordExpiry';

/** The show-password toggle's drawn width - declared so its touch slop is derived, not guessed. */
const EYE_W = 40;
/** How far in from the field's right edge the show-password button sits. */
const EYE_RIGHT = space.xs;
/** The drawn size of a rule's tick, and of the ring that stands in for it until the rule is met. */
const TICK = 16;

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
  const info = chipTone('info', theme);
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
    <YStack
      backgroundColor={theme.surfaceAlt}
      borderTopWidth={1}
      borderTopColor={theme.border}
      paddingHorizontal={space.inset}
      paddingTop={space.lg}
      paddingBottom={insets.bottom + space.lg}
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
    return (
      <YStack flex={1} backgroundColor={theme.bg} testID="pwdChangeDone">
        <ScreenHeader title={t('pwdChange.title')} onBack={onDone} />
        <YStack flex={1} paddingHorizontal={space.inset} paddingTop={space.section} gap={space.lg}>
          <XStack gap={space.md} alignItems="center">
            <CheckIcon size={24} color={theme.success} />
            <Heading color={theme.text}>{t('pwdChange.done.title')}</Heading>
          </XStack>
          <Body color={theme.text}>
            {outcome.passwordExpiresAt != null
              ? t('pwdChange.done.until', { date: formatExpiryDate(outcome.passwordExpiresAt) })
              : t('pwdChange.done.noDate')}
          </Body>
          <Small color={theme.textMuted}>{t('pwdChange.done.everywhere')}</Small>
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
            paddingHorizontal: space.inset,
            paddingTop: space.section,
            paddingBottom: space.section,
          }}
        >
          <YStack gap={space.gutter}>
            <Small fontWeight="500" color={theme.textMuted}>
              {t('pwdChange.intro')}
            </Small>

            {/* Which box - locked, as on the re-auth screen. */}
            <XStack
              backgroundColor={theme.surface}
              borderWidth={1}
              borderColor={theme.border}
              borderRadius={16}
              padding={space.xl}
              gap={space.lg}
              alignItems="center"
            >
              <Avatar name={account.alias ?? account.label} color={boxColor(account)} size={46} />
              <YStack flex={1} minWidth={0} gap={space.hair}>
                <BodyStrong color={theme.text} numberOfLines={1}>
                  {account.alias ?? account.label}
                </BodyStrong>
                <BoxIdentityLine account={account} />
              </YStack>
              <LockIcon size={17} color={theme.textFaint} />
            </XStack>

            {outcome != null ? (
              <XStack
                backgroundColor={danger.bg}
                borderRadius={14}
                padding={space.xl}
                gap={space.md}
                alignItems="flex-start"
                testID="pwdChangeError"
              >
                <AlertIcon size={17} color={danger.fg} />
                <YStack flex={1} gap={space.base}>
                  <Small color={danger.fg}>{errorText(outcome)}</Small>
                  {outcome.kind === 'wrongPassword' ? (
                    <XStack
                      alignSelf="flex-start"
                      hitSlop={textSlop('bodyStrong')}
                      pressStyle={{ opacity: 0.6 }}
                      onPress={onOpenPortal}
                      accessibilityRole="link"
                      accessibilityLabel={t('pwd.action')}
                      testID="pwdChangePortal"
                    >
                      <BodyStrong color={info.accent}>{t('pwd.action')} →</BodyStrong>
                    </XStack>
                  ) : null}
                </YStack>
              </XStack>
            ) : null}

            {field('current', t('pwdChange.current'), 'current-password')}
            {field('new', t('pwdChange.new'), 'new-password')}
            {field('repeat', t('pwdChange.repeat'), 'new-password')}

            <YStack gap={space.sm} testID="pwdRules">
              <Label>{t('pwdChange.rules')}</Label>
              {LISTED_RULES.map(rule => (
                <Rule key={rule} met={verdicts[rule]} text={t(RULE_TEXT[rule])} rule={rule} />
              ))}
              <Meta color={theme.textFaint} marginTop={space.xs}>
                {t('pwdChange.rule.history')}
              </Meta>
            </YStack>
          </YStack>
        </KeyboardAwareScrollView>
        {footerButton(t('pwdChange.submit'), () => void submit(), 'submit')}
      </KeyboardAvoidingView>
    </YStack>
  );
}

/** One rule: a tick once it is met, an empty ring until then - the same size, so nothing moves. */
function Rule({ met, text, rule }: { readonly met: boolean; readonly text: string; readonly rule: string }) {
  const theme = useTheme();
  return (
    <XStack
      gap={space.base}
      alignItems="flex-start"
      accessible
      accessibilityLabel={`${text}: ${t(met ? 'pwdChange.rule.met' : 'pwdChange.rule.unmet')}`}
      testID={`rule-${rule}-${met ? 'met' : 'unmet'}`}
    >
      <YStack width={TICK} height={TICK} alignItems="center" justifyContent="center" marginTop={space.hair}>
        {met ? (
          <CheckIcon size={TICK} color={theme.success} />
        ) : (
          <YStack
            width={TICK - space.xs}
            height={TICK - space.xs}
            borderRadius={999}
            borderWidth={1.5}
            borderColor={theme.borderStrong}
          />
        )}
      </YStack>
      <Meta flex={1} color={met ? theme.text : theme.textMuted}>
        {text}
      </Meta>
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
      <Label>{label}</Label>
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
