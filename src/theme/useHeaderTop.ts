import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from './spacing';

/**
 * Between whatever is above a screen's own header - the status bar, or a strip that has cleared it -
 * and the header. DESIGN.md spacing `lg`.
 */
export const HEADER_GAP = space.lg;

/**
 * Top padding for a screen's own header / first content row. Clears the status-bar + notch / Dynamic
 * Island **safe-area inset** (never a hardcoded guess - that overlapped the system icons on iPhone) plus
 * one consistent gap, so every screen shares the same top rhythm (constitution V).
 *
 * When a `TestEnvBanner` is rendered ABOVE the header it already consumes the inset (its own
 * `paddingTop: insets.top`), so the header just needs the gap - pass `bannerAbove`.
 *
 * ONE GAP, WHATEVER IS ABOVE. With a banner above, this returned 14 where it gave 12 under a bare
 * status bar, and 12 under Debug mode's recording strip too, which hands the screen a spent inset
 * instead of passing `bannerAbove`. Both strips reserve the same row precisely so that a screen under
 * either lays its content out in the same place (`StatusStrip.tsx`); the message detail's header still
 * sat 2dp lower under one of them than under the other (review, 2026-09-15).
 */
export function useHeaderTop(bannerAbove = false): number {
  const insets = useSafeAreaInsets();
  return bannerAbove ? HEADER_GAP : insets.top + HEADER_GAP;
}
