// A ScrollView that guarantees focused text inputs are never hidden behind the on-screen keyboard.
//
// - iOS: `automaticallyAdjustKeyboardInsets` insets the scrollable content by the keyboard height and
//   scrolls the focused field into view, so even the bottom-most input stays visible.
// - Android: MainActivity uses `windowSoftInputMode="adjustResize"`, so the window (and this
//   ScrollView) shrinks when the keyboard opens and the content scrolls above it.
//
// Use this instead of a plain ScrollView for any screen that contains inputs - new screens then get
// the keyboard-safe behaviour for free. (Modals have no scroll view to inset, so they wrap their
// content in a KeyboardAvoidingView instead.)
//
// IMPORTANT: when a screen ALSO wraps this in a `KeyboardAvoidingView` (behavior "padding" on iOS -
// needed to lift a pinned footer above the keyboard), pass `adjustKeyboardInsets={false}`. Otherwise
// the KAV padding AND these insets both compensate for the keyboard - a double-adjust that flings a
// directly-focused bottom field (e.g. the add-box "alias" input) to the very top of the screen.

import type { ReactNode } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

export function KeyboardAwareScrollView({
  children,
  adjustKeyboardInsets = true,
  ...rest
}: ScrollViewProps & { readonly children?: ReactNode; readonly adjustKeyboardInsets?: boolean }) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets={adjustKeyboardInsets}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}
