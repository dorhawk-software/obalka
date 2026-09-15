// "Testovací prostředí" banner (008, US3) - a full-bleed soft-gold strip marking a message that lives
// on the czebox TEST system, so a test box can never be mistaken for a live one.
//
// SCOPE: the MESSAGE DETAIL only (received + sent). Everywhere else the environment is already stated
// and a second marker would be noise or nonsense:
//   • message list / box switcher - the box carries a "Testovací" PILL next to its name;
//   • add-box / login / re-auth   - there is no active box yet; the form has its own Ostré|Testovací
//                                   environment toggle;
//   • compose                     - reached from the list, which already shows the pill.
// The detail is the one surface with no other environment cue, hence the banner.
//
// It is a NORMAL-FLOW element (never an overlay): it occupies real layout space and pushes the header
// down, so it can never cover content (layout jumps & overlaps are forbidden - constitution V). It is
// rendered at the top of the screen's own layout (sliding in/out WITH the screen, no navigator-wide
// shift) and the header then drops its now-redundant status-bar padding, since the banner clears the
// status bar itself (useHeaderTop). Returns null when `show` is false, taking no space at all. Styled
// with the redesign's dedicated test-env tokens (testBg/testFg/testBd, 009 §6).
//
// Drawn by `StatusStrip`, the one component both top-of-screen strips share, so this banner and the
// Debug-mode recording strip keep the same metrics and reserve the same row.

import { useTheme } from '../theme/ThemeProvider';
import { FlaskIcon } from '../theme/icons';
import {
  STATUS_STRIP_GLYPH,
  StatusStrip,
  statusStripColors,
} from '../theme/StatusStrip';
import { t } from '../i18n/strings';

export function TestEnvBanner({ show }: { readonly show: boolean }) {
  const theme = useTheme();
  if (!show) {
    return null;
  }
  return (
    <StatusStrip
      tone="test"
      label={t('testEnv.banner')}
      glyph={
        <FlaskIcon
          size={STATUS_STRIP_GLYPH}
          color={statusStripColors('test', theme).ink}
        />
      }
      testID="testEnvBanner"
    />
  );
}
