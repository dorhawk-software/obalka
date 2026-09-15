// The widest the app's content is ever allowed to get (audit 2026-09-09).
//
// This app was designed for a phone in portrait and nothing in it adapted to anything else:
// `useWindowDimensions` appeared zero times in the whole tree, there were no size classes and no
// breakpoints. On iOS that was consistent - portrait-locked, iPhone-only. On Android it was not:
// no `screenOrientation` was declared, so the app rotated and resized into a layout with no
// landscape design, and **targeting SDK 36 means orientation, resizability and aspect-ratio
// restrictions are ignored outright on screens ≥600dp**, so a tablet or an unfolded foldable gets
// landscape whether the app asks for it or not. What shipped there was a stretched phone UI: inbox
// rows a thousand pixels wide, an avatar at one end and a timestamp at the other.
//
// The answer is not a second design. It is the answer print has used for centuries: past a certain
// measure, stop widening the column and let the margins take the space. A 38-character-wide message
// subject is not improved by having 200 characters of room.
//
// Applied once, around the whole app (`App.tsx`), so every screen - present and future - gets it
// without knowing about it. RN `Modal`s render outside that tree and carry the cap themselves.

import type { ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useTheme } from './ThemeProvider';

/**
 * Material's "medium" window class begins at 600dp and "expanded" at 840dp. 720 sits between them:
 * a phone in any orientation never reaches it, a small tablet in portrait only just does, and
 * everything larger gets a centred column instead of a stretched one.
 */
export const MAX_CONTENT_WIDTH = 720;

/**
 * Centre the app's content and stop it widening past {@link MAX_CONTENT_WIDTH}.
 *
 * The tree is the SAME shape at every width - a `maxWidth` that simply never binds on a phone -
 * rather than a branch on the measured width. That matters on a foldable, where unfolding crosses
 * the threshold: a conditional wrapper would remount the entire app at the moment the hinge opens,
 * losing the screen the user was on. A style that changes value remounts nothing.
 */
export function ContentColumn({ children }: { readonly children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center' }}
    >
      <View style={{ flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH }}>
        {children}
      </View>
    </View>
  );
}

/**
 * The same cap for a bottom sheet, which lives in its own `Modal` and so never sees the wrapper
 * above. Spread onto the sheet's own container; its parent supplies `alignItems: 'center'`.
 */
export const sheetWidth = {
  width: '100%',
  maxWidth: MAX_CONTENT_WIDTH,
} as const;

/**
 * Whether this window is wide enough that the cap is actually doing something.
 *
 * For the rare case where a layout needs to KNOW, rather than merely be constrained - currently
 * nothing does, and that is the point: the cap alone should be enough almost everywhere.
 */
export function useIsWideWindow(): boolean {
  return useWindowDimensions().width > MAX_CONTENT_WIDTH;
}
