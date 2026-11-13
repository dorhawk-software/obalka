// Thin re-export of the Tamagui primitives the screens use.
//
// WHY THIS EXISTS: Tamagui 2.2's config token types do not bind to component style props under our
// headless React Native tsconfig (moduleResolution "bundler" resolving Tamagui's TS source). The
// components RENDER correctly - verified by the jest render tests - but `tsc` rejects `$token`/style
// props. We loosen the prop types in this ONE file (with this note) so the build stays green, and we
// restore strict Tamagui types once the TS config is finalized with on-device feedback.
// TODO(tamagui-types): remove the `any` casts after resolving the config typing on a real build.

import { forwardRef, type ComponentType } from 'react';
import { Text as RNText } from 'react-native';
import { useTheme } from './ThemeProvider';
import { fonts } from './typeScale';
import {
  Button as TButton,
  H2 as TH2,
  H3 as TH3,
  Input as TInput,
  Paragraph as TParagraph,
  ScrollView as TScrollView,
  Spinner as TSpinner,
  Text as TText,
  XStack as TXStack,
  YStack as TYStack,
} from 'tamagui';

/**
 * A Tamagui stack that is ALSO an accessibility element when it is pressable.
 *
 * Tamagui routes `onPress` through its own gesture layer and never sets RN's `accessible` prop -
 * grep `@tamagui/web`'s `createComponent.native.js` for it, there is no occurrence. On Android that
 * is survivable: `accessibilityLabel` becomes a `contentDescription`, which makes the ViewGroup
 * focusable for TalkBack. On iOS it is not: `isAccessibilityElement` comes from `accessible` ALONE,
 * so a labelled, role-tagged `XStack onPress` is invisible to VoiceOver - the label exists on a view
 * the cursor never lands on.
 *
 * That was every switch, every back chevron, inbox search and the compose ✕ - 48 press targets in 23
 * files. Fixing it here rather than at those 48 sites is the difference between a fix and a fashion:
 * the next `<XStack onPress>` anyone writes is correct without knowing any of this.
 *
 * An explicit `accessible` always wins, including `accessible={false}` for a wrapper whose children
 * should be read individually.
 */
function pressable(Base: ComponentType<any>, name: string): ComponentType<any> {
  const Wrapped = forwardRef<unknown, any>(function Accessible(props, ref) {
    const needsFlag = props.onPress !== undefined && props.accessible === undefined;
    return needsFlag ? (
      <Base ref={ref} accessible {...props} />
    ) : (
      <Base ref={ref} {...props} />
    );
  });
  Wrapped.displayName = name;
  return Wrapped as unknown as ComponentType<any>;
}

/**
 * A text field whose KEYBOARD follows the app's appearance, not the phone's.
 *
 * `keyboardAppearance` is an iOS prop and it defaulted to `'default'` at all sixteen input sites in
 * the app, which means the system appearance. This app lets the user choose light or dark
 * independently of the OS, so choosing Dark on a light phone raised a bright white keyboard under
 * the warm-dark UI, and the reverse for the opposite pairing - on compose, search, sign-in, the OTP
 * screen, the alias editor and the backup passphrase, which is most of the places anyone types.
 *
 * It is the same class of bug as the Android navigation bar (see `services/systemBars.ts`): a piece
 * of system chrome that takes its cue from the OS while the app paints itself from its own setting.
 * Fixed here rather than at those sixteen sites, so the seventeenth is right without being told.
 *
 * An explicit `keyboardAppearance` still wins, and Android ignores the prop entirely.
 */
const BaseInput = TInput as unknown as ComponentType<any>;

const ThemedInput = forwardRef<unknown, any>(function ThemedInputField(props, ref) {
  const theme = useTheme();
  return (
    <BaseInput
      ref={ref}
      keyboardAppearance={theme.name === 'dark' ? 'dark' : 'light'}
      // What anyone types, and the placeholder, in the body face: with no face set, every field fell
      // back to the system's (Roboto on Android) beside Public Sans everywhere else - seen on the
      // search field against its board (031 R4, 2026-11-13).
      fontFamily={fonts.bodyRegular}
      {...props}
    />
  );
});
ThemedInput.displayName = 'Input';

/**
 * A button's words in the body face at their weight. Tamagui's Button sets no face, so its label fell
 * back to the system's (Roboto on Android): the field's fault above, found again on the SMS code's
 * resend link against board R8 (031, 2026-11-13). Handing Tamagui the face did not hold on Android -
 * its label resolves the face from its own font tokens by weight, so the walk still showed Roboto
 * while the test passed - so the button draws its words itself, in React Native's Text, the face
 * picked by the weight (Android has no synthetic bold for a named face). An explicit `fontFamily`
 * still wins; a label with no size takes the body's 15.
 */
const BODY_FACE: Readonly<Record<string, string>> = {
  '800': fonts.bodyBold,
  '700': fonts.bodyBold,
  '600': fonts.bodySemiBold,
  '500': fonts.bodyMedium,
};
const BaseButton = TButton as unknown as ComponentType<any>;

const ThemedButton = forwardRef<unknown, any>(function ThemedButtonControl(props, ref) {
  const { children, fontFamily, fontWeight, fontSize, color, textAlign, letterSpacing, ...rest } = props;
  if (typeof children !== 'string') {
    return <BaseButton ref={ref} {...props} />;
  }
  const face = fontFamily ?? BODY_FACE[fontWeight == null ? '' : String(fontWeight)] ?? fonts.bodyRegular;
  const size: number = fontSize ?? 15;
  // The type scale's own ratio (14 → 20, 15 → 21): a bare line box cuts the top of a capital's
  // accent on iOS ("Ů", `inkClipping.ts`).
  const lineHeight = Math.ceil(size * 1.4);
  return (
    <BaseButton ref={ref} {...rest} noTextWrap>
      <RNText style={{ fontFamily: face, fontSize: size, lineHeight, color, textAlign, letterSpacing }}>
        {children}
      </RNText>
    </BaseButton>
  );
});
ThemedButton.displayName = 'Button';

export const YStack = pressable(TYStack as unknown as ComponentType<any>, 'YStack');
export const XStack = pressable(TXStack as unknown as ComponentType<any>, 'XStack');
export const Text = TText as unknown as ComponentType<any>;
export const Paragraph = TParagraph as unknown as ComponentType<any>;
export const ScrollView = TScrollView as unknown as ComponentType<any>;
export const H2 = TH2 as unknown as ComponentType<any>;
export const H3 = TH3 as unknown as ComponentType<any>;
export const Button = ThemedButton as unknown as ComponentType<any>;
export const Input = ThemedInput as unknown as ComponentType<any>;
export const Spinner = TSpinner as unknown as ComponentType<any>;
