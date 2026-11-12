// The inbox header (031, board "Inbox - the envelope front"): the list hangs from the front of an
// envelope. The flap runs across the top, the box is named in the envelope's window (tap it to switch
// boxes), search sits beside it, and Přijaté | Odeslané is printed on the blue below.

import { Pressable, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { XStack, YStack } from '../../../theme/ui';
import { Caption, Heading } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { SegmentedControl } from '../../../theme/SegmentedControl';
import { ChevronDownIcon, LayersIcon } from '../../../theme/icons';
import { OffsetIcon } from '../../../theme/offsetIcons';
import { Window } from '../../../theme/objects/Window';
import { EnvelopeTile } from '../../../theme/objects/Envelope';
import { objectShadow } from '../../../theme/depth';
import { envelopeShape } from '../../../theme/print';
import { boxColor } from '../../../theme/boxColor';
import { useHeaderTop } from '../../../theme/useHeaderTop';
import { space } from '../../../theme/spacing';
import { TestTag } from '../../accounts/screens/BoxRow';
import { BoxIdentityLine } from '../../accounts/screens/BoxIdentityLine';
import type { DataBoxAccount } from '../../../services/isds/types';
import type { MessageFolder } from '../../../services/db/messagesStore';
import { t, plural } from '../../../i18n/strings';

/** The flap's outline across a `width` header whose window starts `height` from the top. */
export function headerFlapPath(width: number, height: number): string {
  const f = envelopeShape.headerFlap;
  const mid = width / 2;
  return (
    `M0 0H${width}V${height - f.side}` +
    `L${mid + f.half} ${height - f.shoulder}Q${mid} ${height - f.point} ${mid - f.half} ${height - f.shoulder}` +
    `L0 ${height - f.side}Z`
  );
}

export function InboxHeader({
  account,
  unifiedCount,
  unreadShown,
  isTestBox,
  folder,
  onFolder,
  sentNews,
  onOpenSwitcher,
  onSearch,
}: {
  readonly account: DataBoxAccount;
  /** How many boxes the merged view merges; null in one box's inbox. */
  readonly unifiedCount: number | null;
  /** The merged view's unread count, held across reloads (MessageList). */
  readonly unreadShown: number;
  readonly isTestBox: boolean;
  readonly folder: MessageFolder;
  readonly onFolder: (folder: MessageFolder) => void;
  /** Sent messages with news since Odeslané was last looked at (014 FR-009). */
  readonly sentNews: number;
  readonly onOpenSwitcher: () => void;
  readonly onSearch: () => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  // The board's window sits 16 below the status bar: the header gap and 4 more. The flap comes down
  // to meet it.
  const windowTop = useHeaderTop() + space.xs;
  const flap = envelopeShape.headerFlap;
  const unified = unifiedCount != null;
  const name = unified ? t('unified.title') : account.alias ?? account.label;
  return (
    <View
      style={{
        backgroundColor: theme.envelope,
        borderBottomLeftRadius: envelopeShape.headerRadius,
        borderBottomRightRadius: envelopeShape.headerRadius,
        boxShadow: objectShadow(theme.name, 'envelopeHeader'),
        paddingTop: windowTop,
        paddingHorizontal: 16,
        paddingBottom: 12,
        // Over the list below, so the shadow falls on it.
        zIndex: 1,
      }}
    >
      <Svg
        width={width}
        height={windowTop}
        style={{ position: 'absolute', left: 0, top: 0 }}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <LinearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={theme.onSolid} stopOpacity={flap.sheen} />
            <Stop offset={1} stopColor={theme.printShade} stopOpacity={flap.shade} />
          </LinearGradient>
        </Defs>
        <Path d={headerFlapPath(width, windowTop)} fill={theme.flap} />
        <Path d={headerFlapPath(width, windowTop)} fill="url(#sheen)" />
      </Svg>
      <XStack alignItems="center" gap={10}>
        <Pressable
          style={({ pressed }) => ({ flex: 1, minWidth: 0, opacity: pressed ? 0.85 : 1 })}
          onPress={onOpenSwitcher}
          accessibilityRole="button"
          accessibilityLabel={account.alias ?? account.label}
          testID="boxSwitcher"
        >
          <Window
            style={{
              minHeight: 68,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {unified ? (
              // An OUTLINED tile with a glyph, never an envelope: a merged view is not an identity.
              // The merged header's own design is R5's.
              <YStack
                width={40}
                height={40}
                borderRadius={11}
                borderWidth={1}
                borderColor={theme.borderStrong}
                backgroundColor={theme.surface}
                alignItems="center"
                justifyContent="center"
              >
                <LayersIcon size={18} color={theme.textMuted} />
              </YStack>
            ) : (
              <EnvelopeTile name={name} color={boxColor(account)} size={40} />
            )}
            <YStack flex={1} minWidth={0}>
              <XStack alignItems="center" gap={6}>
                <Heading
                  numberOfLines={1}
                  flexShrink={1}
                  // A zero floor so the name can give way to the "Testovací" tag, and 2 of padding
                  // because RN measures a shrunk Text a hair narrower than its ellipsis (TestTag).
                  minWidth={0}
                  paddingRight={2}
                >
                  {name}
                </Heading>
                {!unified && isTestBox ? <TestTag /> : null}
              </XStack>
              {unified ? (
                <Caption fontWeight="400" color={theme.textMuted} numberOfLines={1}>
                  {[
                    t(`unified.subtitle.${plural(unifiedCount)}`, { n: unifiedCount }),
                    unreadShown > 0 ? t(`attn.unread.${plural(unreadShown)}`, { n: unreadShown }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Caption>
              ) : (
                <BoxIdentityLine account={account} inWindow />
              )}
            </YStack>
            <ChevronDownIcon size={18} color={theme.textMuted} />
          </Window>
        </Pressable>
        <Pressable
          style={({ pressed }) => ({
            width: 52,
            height: 52,
            borderRadius: 999,
            backgroundColor: theme.envelopeButton,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
          onPress={onSearch}
          accessibilityRole="button"
          accessibilityLabel={t('search.title')}
          testID="openSearch"
        >
          <OffsetIcon name="search" size={22} color={theme.onSolid} plane="envelope" />
        </Pressable>
      </XStack>
      <YStack marginTop={8}>
        <SegmentedControl
          tone="envelope"
          segments={[
            { key: 'received' as const, label: t('messages.segment.received') },
            {
              key: 'sent' as const,
              label: t('messages.segment.sent'),
              // 014 FR-009: news since Odeslané was last looked at; never on the tab being looked at.
              dot: sentNews > 0 && folder !== 'sent',
              accessibilityLabel:
                sentNews > 0 && folder !== 'sent'
                  ? t(`messages.segment.sent.news.${plural(sentNews)}`, { n: sentNews })
                  : undefined,
            },
          ]}
          value={folder}
          onChange={onFolder}
          testID="messagesFolder"
        />
      </YStack>
    </View>
  );
}
