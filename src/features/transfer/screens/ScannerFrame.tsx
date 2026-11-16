// What the code scanner draws over the camera, as board R13 does (031 I51, agreed 2026-11-12): the
// picture dimmed around the envelope's window - aim the code into it - and a sheet under it with the
// hint and Zrušit, which reads in both themes. Without the camera the window goes and the sheet holds
// the camera in a well over the sentence that says what to do instead.
//
// The window's top stands 230/844 of the way down the screen, as on the board, the way the lock screen
// places its envelope. Rounding: the sheet's 22 above its words is 24; its words are 14/600, the
// smallStrong role.

import { type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from '../../../theme/ui';
import { SmallStrong } from '../../../theme/Typography';
import { NeutralButton } from '../../../theme/NeutralButton';
import { Well } from '../../../theme/Well';
import { CloseIcon, PhotoCameraIcon } from '../../../theme/icons';
import { WindowSheen } from '../../../theme/objects/Window';
import { raised } from '../../../theme/depth';
import { useTheme } from '../../../theme/ThemeProvider';
import { space } from '../../../theme/spacing';
import { t } from '../../../i18n/strings';

/** The board's window: 260 across, the 24 corner, a 2 white edge at .9. */
const WINDOW = { size: 260, radius: 24, edge: 2, edgeOpacity: 0.9, top: 230 / 844 } as const;

/** The board's sheet: the 24 corner; 24 above its words and at its sides. */
const SHEET_RADIUS = 24;
/** The longest line the board lets the sheet's words run. */
const WORDS_WIDTH = 300;

/** A rectangle's outline with round corners, clockwise, for a hole cut by the even-odd rule. */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return [
    `M${x + r} ${y}`,
    `H${x + w - r}`,
    `A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${y + h - r}`,
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

/** The dim over the picture with the window cut out of it, the window's sheen, and its edge. */
export function ScannerWindow() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const { size, radius } = WINDOW;
  const left = (width - size) / 2;
  const top = Math.round(height * WINDOW.top);
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;
  return (
    <>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none" testID="transfer-scanner-dim" {...hidden}>
        <Path
          d={`M0 0H${width}V${height}H0Z ${roundedRect(left, top, size, size, radius)}`}
          fillRule="evenodd"
          fill={theme.cameraDim}
        />
      </Svg>
      <YStack
        position="absolute"
        left={left}
        top={top}
        width={size}
        height={size}
        borderRadius={radius}
        overflow="hidden"
        pointerEvents="none"
        {...hidden}
      >
        <WindowSheen width={size} height={size} />
      </YStack>
      <YStack
        position="absolute"
        left={left}
        top={top}
        width={size}
        height={size}
        borderRadius={radius}
        borderWidth={WINDOW.edge}
        borderColor={theme.onSolid}
        opacity={WINDOW.edgeOpacity}
        pointerEvents="none"
        testID="transfer-scanner-window"
        {...hidden}
      />
    </>
  );
}

/**
 * The sheet under the picture: the camera in a well when there is no picture, the words, and Zrušit.
 * Past the home indicator: a Zrušit under the gesture bar is a button the gesture takes instead
 * (2026-10-04).
 */
export function ScannerSheet({
  words,
  noCamera,
  onCancel,
}: {
  readonly words: string;
  /** No picture to aim at: the camera may not be used, or the phone has none. */
  readonly noCamera: boolean;
  readonly onCancel: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  let well: ReactNode = null;
  if (noCamera) {
    well = (
      <YStack marginBottom={space.xl}>
        <Well large testID="transfer-scanner-well">
          <PhotoCameraIcon size={28} color={theme.text} />
        </Well>
      </YStack>
    );
  }
  return (
    <YStack
      position="absolute"
      left={0}
      right={0}
      bottom={0}
      alignItems="center"
      backgroundColor={theme.surfaceAlt}
      borderTopLeftRadius={SHEET_RADIUS}
      borderTopRightRadius={SHEET_RADIUS}
      paddingTop={space.section}
      paddingHorizontal={space.section}
      paddingBottom={insets.bottom + space.gutter}
      style={{ boxShadow: raised(theme.name, 'sheet') }}
      testID="transfer-scanner-sheet"
    >
      {well}
      {/* The board balances the lines (`text-wrap: balance`); Android can, iOS sets them greedily. */}
      <SmallStrong color={theme.text} textAlign="center" maxWidth={WORDS_WIDTH} textBreakStrategy="balanced">
        {words}
      </SmallStrong>
      <YStack alignSelf="stretch" marginTop={space.gutter}>
        <NeutralButton
          label={t('transfer.scanner.close')}
          icon={<CloseIcon size={18} color={theme.text} />}
          onPress={onCancel}
          testID="transfer-scanner-close"
        />
      </YStack>
    </YStack>
  );
}
