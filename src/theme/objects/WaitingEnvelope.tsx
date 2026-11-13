// The box's envelope while its sign-in waits (031 board R8, agreed 2026-11-12): the object stands
// still - its flap still sealed, the login name in the window - and the one waiting bar under it is
// the only thing that moves. It replaced a brand tile ringed by a pulse, which was any app's wait.

import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { Overline, Subheading } from '../Typography';
import { envelopeShape, waitingEnvelope } from '../print';
import { Envelope } from './Envelope';
import { Window } from './Window';

export function WaitingEnvelope({
  label,
  name,
  testID,
}: {
  /** What the window names ("Přihlašovací jméno"). */
  readonly label: string;
  /** The login name the request was sent for. */
  readonly name: string;
  readonly testID?: string;
}) {
  const theme = useTheme();
  const g = waitingEnvelope;
  return (
    <View style={{ transform: [{ rotate: g.tilt }] }} testID={testID}>
      <Envelope
        creases={g.creases}
        style={{
          width: g.width,
          minHeight: g.minHeight,
          paddingVertical: 16,
          paddingHorizontal: 18,
          justifyContent: 'flex-end',
        }}
      >
        <Svg
          width={g.flap.width}
          height={g.flap.height}
          viewBox={`0 0 ${g.flap.width} ${g.flap.height}`}
          style={{ position: 'absolute', left: 0, top: 0 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Defs>
            {/* Lit from the top, as every shut flap (the inbox header's, the sealed pose). */}
            <LinearGradient id="waitingSheen" x1="0" y1="0" x2="0" y2="1">
              <Stop offset={0} stopColor={theme.onSolid} stopOpacity={envelopeShape.headerFlap.sheen} />
              <Stop offset={1} stopColor={theme.printShade} stopOpacity={envelopeShape.headerFlap.shade} />
            </LinearGradient>
          </Defs>
          <Path d={g.flap.d} fill={theme.flap} />
          <Path d={g.flap.d} fill="url(#waitingSheen)" />
        </Svg>
        <Window
          radius={g.window.radius}
          style={{
            width: g.window.width,
            minHeight: g.window.minHeight,
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 13,
            paddingRight: 14,
            gap: 2,
          }}
        >
          <Overline color={theme.textMuted}>{label}</Overline>
          <Subheading testID="waitingEnvelopeName">{name}</Subheading>
        </Window>
      </Envelope>
    </View>
  );
}
