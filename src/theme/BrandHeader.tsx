// The "Obálka" brand lockup (logo + wordmark), shared so every screen renders it identically. It can
// carry a right-aligned app-level action (e.g. the settings gear). Kept on the standard content
// margins so the logo aligns with the heading below and the action aligns with the section action
// (refresh). The negative margin pulls the logo's visible badge (the SVG has ~14% internal padding)
// flush with the content edge.
//
// TODO(header-separation): give the app header a proper visual separation from the content (a tonal
// "header bar"). The first attempt - a full-bleed rounded band - looked bad (rounded corners jammed
// against the screen edges). Revisit: e.g. an inset rounded panel whose content still aligns with the
// page margins, or a subtle non-full-bleed treatment. The `theme.surfaceSunken` token is ready for it.

import type { ReactNode } from 'react';
import { Text, XStack } from './ui';
import { useTheme } from './ThemeProvider';
import { t } from '../i18n/strings';
import LogoMark from '../assets/logo.svg';

export function BrandHeader({
  right,
  marginBottom = 16,
}: {
  /** Optional right-aligned app-level action (e.g. the settings gear). */
  readonly right?: ReactNode;
  readonly marginBottom?: number;
}) {
  const theme = useTheme();
  return (
    <XStack alignItems="center" justifyContent="space-between" marginBottom={marginBottom}>
      <XStack alignItems="center" gap={8}>
        <LogoMark width={44} height={44} style={{ marginLeft: -6 }} />
        <Text fontSize={22} fontWeight="800" color={theme.blueDark} letterSpacing={-0.4}>
          {t('app.name')}
        </Text>
      </XStack>
      {right ?? null}
    </XStack>
  );
}
