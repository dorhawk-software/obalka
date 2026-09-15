// The identity sub-line under a box's name: "{legal type} · ID {boxId}".
//
// The ID is the disambiguator (same-named boxes are told apart by it), so it must NEVER be truncated.
// A long legal type - "Podnikající fyzická osoba" - was pushing the ID off the end of the single-line
// label (it ellipsized to "…· ID c57mi…" or dropped the ID entirely, esp. on the active switcher row
// and the collapsed inbox header where the ✓/chevron/Testovací tag eat width). So the type run shrinks
// and ellipsizes while the ID run is pinned (flexShrink 0).

import { XStack } from '../../../theme/ui';
import { Caption } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { boxTypeLabel } from '../state/boxType';
import type { DataBoxAccount } from '../../../services/isds/types';

export function BoxIdentityLine({
  account,
  fontSize = 12,
  fontWeight,
}: {
  readonly account: Pick<DataBoxAccount, 'dbType' | 'boxId'>;
  readonly fontSize?: number;
  readonly fontWeight?: '400' | '500' | '600' | '700';
}) {
  const theme = useTheme();
  const type = boxTypeLabel(account.dbType);
  const id = `ID ${account.boxId}`;
  return (
    <XStack alignItems="center" minWidth={0}>
      {type ? (
        <Caption
          fontSize={fontSize}
          fontWeight={fontWeight}
          color={theme.textFaint}
          numberOfLines={1}
          flexShrink={1}
          minWidth={0}
        >
          {type}
        </Caption>
      ) : null}
      <Caption
        fontSize={fontSize}
        fontWeight={fontWeight}
        color={theme.textFaint}
        numberOfLines={1}
        flexShrink={0}
      >
        {type ? ` · ${id}` : id}
      </Caption>
    </XStack>
  );
}
