// "Upravit schránku" (027 decision 2B): the box's own name and its colour, in one sheet. Clearing the
// name and saving removes it. The colour is one of `BOX_COLORS`; one another box already has is marked
// and allowed, since telling the boxes apart is the point and the person may know better.
//
// Board R9 (031 I56, agreed 2026-11-12): a sheet over the switcher, as every question is - the title,
// the box's envelope tile at 56 beside its name and identity line (the preview: it takes the name and
// the colour as they are typed and picked), the field, the colours with the chosen one ringed 2 off its
// edge and checked, and Uložit under them. No Zrušit: the sheet closes as every sheet does - the scrim,
// a swipe, back. Until 2026-11-15 it was a card in the middle of the screen with Zrušit beside Uložit.
//
// Roundings from the board: the tile's 15 corner is 16; the 20 above Uložit is 18; the field's 15
// inset is 16; the ring's 3 off the swatch is 2, which puts its corner on the 16 step.

import { useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { XStack, YStack } from '../../../theme/ui';
import { Label, Meta, SmallStrong } from '../../../theme/Typography';
import { EnvelopeTile } from '../../../theme/objects/Envelope';
import { BottomSheet } from '../../../theme/BottomSheet';
import { InkButton } from '../../../theme/InkButton';
import { CheckIcon } from '../../../theme/icons';
import { BOX_COLORS, boxColor, boxColorKey, type BoxColor } from '../../../theme/boxColor';
import { useTheme } from '../../../theme/ThemeProvider';
import { space } from '../../../theme/spacing';
import { fonts, MAX_TEXT_SCALE } from '../../../theme/typeScale';
import { BoxIdentityLine } from './BoxIdentityLine';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';

/** R9's swatch: 40 square, the 12 corner. */
const SWATCH = { size: 40, radius: 12 } as const;
/** The chosen swatch's ring: 2 of ink, 2 off the swatch's edge, its corner concentric with the swatch's. */
const RING = { width: 2, gap: space.hair } as const;
const RING_OFFSET = RING.gap + RING.width;
/** The mark on a colour another box has: a 6 dot, 4 in from the bottom right corner. */
const DOT = { size: 6, inset: 4 } as const;
/** The preview tile, as R9 draws it. */
const PREVIEW = { size: 56, radius: 16 } as const;

export function AliasEditor({
  account,
  others = [],
  onSave,
  onClose,
}: {
  readonly account: DataBoxAccount;
  /** The other boxes, to mark the colours they already have. */
  readonly others?: readonly DataBoxAccount[];
  /** `color` only when it was changed here - an untouched one is not written back. */
  readonly onSave: (alias: string | null, color?: BoxColor) => void;
  readonly onClose: () => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState(account.alias ?? '');
  const initial = boxColor(account);
  const [color, setColor] = useState<string>(initial);
  const taken = new Set(others.filter(o => o.boxId !== account.boxId).map(o => boxColor(o)));
  // Only a colour the person picked is saved. Writing back the one the sheet opened with would, for a
  // box still on the old ID hash (not one of the ten), be refused by `setColor` - and the rename with it.
  const save = () => onSave(draft.trim() || null, color === initial ? undefined : (color as BoxColor));
  const name = draft.trim() || account.label;

  return (
    <BottomSheet
      onClose={onClose}
      title={t('alias.renameTitle')}
      testID="aliasEditor"
      footer={
        <YStack marginTop={space.gutter}>
          <InkButton label={t('alias.save')} onPress={save} testID="aliasSave" />
        </YStack>
      }
    >
      {/* The live preview: the box as it will look everywhere, in the colour picked below. */}
      <XStack alignItems="center" gap={space.xl} marginTop={space.gutter}>
        <EnvelopeTile
          name={name}
          color={color}
          size={PREVIEW.size}
          radius={PREVIEW.radius}
          box
          testID="aliasPreview"
        />
        <YStack flex={1} minWidth={0}>
          <SmallStrong color={theme.text} numberOfLines={1}>
            {name}
          </SmallStrong>
          <BoxIdentityLine account={account} />
        </YStack>
      </XStack>
      <Label marginTop={space.gutter} color={theme.textMuted}>
        {t('alias.name')}
      </Label>
      {/* Design: the rename field is empty when there's no name - no placeholder. */}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        // No autoFocus since the sheet edits the colour too (2026-10-04): a keyboard raised on open
        // covered the swatches.
        returnKeyType="done"
        // The one field that is a raw RN TextInput rather than the themed `Input`, so it needs this
        // itself: without it iOS raises a keyboard in the OS's appearance, which is a bright slab under
        // a dark sheet when the two differ. See `theme/ui.tsx`.
        keyboardAppearance={theme.name === 'dark' ? 'dark' : 'light'}
        onSubmitEditing={save}
        // What the themed Input gives every other field (031 T050): the label above it said aloud, the
        // body face rather than the system's, and the text-size cap.
        accessibilityLabel={t('alias.name')}
        maxFontSizeMultiplier={MAX_TEXT_SCALE}
        testID="aliasName"
        style={{
          marginTop: space.sm,
          minHeight: 50,
          borderWidth: 1,
          borderColor: theme.borderStrong,
          borderRadius: 14,
          paddingHorizontal: space.inset,
          fontSize: 15,
          fontFamily: fonts.bodyRegular,
          color: theme.text,
          backgroundColor: theme.surface,
        }}
      />
      <Label marginTop={space.inset} color={theme.textMuted}>
        {t('alias.color')}
      </Label>
      <XStack flexWrap="wrap" gap={space.lg} marginTop={space.base} accessibilityRole="radiogroup">
        {BOX_COLORS.map(c => (
          <Swatch
            key={c}
            color={c}
            selected={c === color}
            taken={taken.has(c)}
            onPress={() => setColor(c)}
          />
        ))}
      </XStack>
      {taken.size > 0 ? (
        <Meta marginTop={space.base} color={theme.textMuted}>
          {t('alias.color.taken')}
        </Meta>
      ) : null}
    </BottomSheet>
  );
}

/** One colour: the chosen one ringed and checked, one another box has marked with a dot. */
function Swatch({
  color,
  selected,
  taken,
  onPress,
}: {
  readonly color: BoxColor;
  readonly selected: boolean;
  readonly taken: boolean;
  readonly onPress: () => void;
}) {
  const theme = useTheme();
  const name = t(boxColorKey(color));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t(taken ? 'alias.color.option.taken' : 'alias.color.option', { name })}
      testID={`boxColor-${color}`}
      style={{
        width: SWATCH.size,
        height: SWATCH.size,
        borderRadius: SWATCH.radius,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? (
        <>
          {/* Outside the swatch, so the colour itself is never covered; the row's 12 gap holds it. */}
          <YStack
            position="absolute"
            top={-RING_OFFSET}
            left={-RING_OFFSET}
            right={-RING_OFFSET}
            bottom={-RING_OFFSET}
            borderRadius={SWATCH.radius + RING_OFFSET}
            borderWidth={RING.width}
            borderColor={theme.text}
            pointerEvents="none"
            testID="boxColor-ring"
          />
          <CheckIcon size={20} color={theme.onSolid} />
        </>
      ) : null}
      {taken ? (
        <YStack
          position="absolute"
          right={DOT.inset}
          bottom={DOT.inset}
          width={DOT.size}
          height={DOT.size}
          borderRadius={999}
          backgroundColor={theme.onSolid}
        />
      ) : null}
    </Pressable>
  );
}
