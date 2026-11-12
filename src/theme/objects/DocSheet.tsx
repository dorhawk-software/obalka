// An attachment's icon (031, board Message): a sheet of paper with its corner folded and the file's
// type printed on it - "PDF" in the red a PDF is known by, any other type in the muted ink.

import Svg, { Path, Text } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { fonts } from '../typeScale';
import { docSheet } from '../print';

/** "PDF" for "rozhodnuti.pdf"; nothing for a name without a short extension. */
export function fileType(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1) : '';
  return ext.length > 0 && ext.length <= docSheet.label.maxLetters ? ext.toLocaleUpperCase('cs') : '';
}

export function DocSheet({ name }: { readonly name: string }) {
  const theme = useTheme();
  const d = docSheet;
  const type = fileType(name);
  return (
    <Svg
      width={d.width}
      height={d.height}
      viewBox={`0 0 ${d.width} ${d.height}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={d.sheet} fill={theme.surfaceSunken} stroke={theme.borderStrong} strokeWidth={d.stroke} strokeLinejoin="round" />
      <Path d={d.fold} fill={theme.docFold} stroke={theme.borderStrong} strokeWidth={d.stroke} strokeLinejoin="round" />
      {type ? (
        // Placed with a translate, as the postmark's lines are: TextProps.x/y are deprecated.
        <Text
          transform={[{ translateX: d.width / 2 }, { translateY: d.label.y }]}
          textAnchor="middle"
          fontFamily={fonts.bodyXBold}
          fontSize={d.label.size}
          fill={type === 'PDF' ? theme.danger : theme.textMuted}
        >
          {type}
        </Text>
      ) : null}
    </Svg>
  );
}
