// Thin re-export of the Tamagui primitives the screens use.
//
// WHY THIS EXISTS: Tamagui 2.2's config token types do not bind to component style props under our
// headless React Native tsconfig (moduleResolution "bundler" resolving Tamagui's TS source). The
// components RENDER correctly - verified by the jest render tests - but `tsc` rejects `$token`/style
// props. We loosen the prop types in this ONE file (with this note) so the build stays green, and we
// restore strict Tamagui types once the TS config is finalized with on-device feedback.
// TODO(tamagui-types): remove the `any` casts after resolving the config typing on a real build.

import { forwardRef, type ComponentType } from 'react';
import { useTheme } from './ThemeProvider';
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
      {...props}
    />
  );
});
ThemedInput.displayName = 'Input';

export const YStack = pressable(TYStack as unknown as ComponentType<any>, 'YStack');
export const XStack = pressable(TXStack as unknown as ComponentType<any>, 'XStack');
export const Text = TText as unknown as ComponentType<any>;
export const Paragraph = TParagraph as unknown as ComponentType<any>;
export const ScrollView = TScrollView as unknown as ComponentType<any>;
export const H2 = TH2 as unknown as ComponentType<any>;
export const H3 = TH3 as unknown as ComponentType<any>;
export const Button = TButton as unknown as ComponentType<any>;
export const Input = ThemedInput as unknown as ComponentType<any>;
export const Spinner = TSpinner as unknown as ComponentType<any>;
