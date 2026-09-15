// Reusable box row (feature 011): one data-box line - avatar + name (+ a "Testovací" tag on czebox) +
// an unread badge + an active ✓ + a per-box ⋯ (rename/remove), over a "{owner} · {id}" identity line.
// Extracted from the retired BoxList home so the box-switcher sheet (the sole multi-box surface) and
// any future surface render boxes identically. Visuals reuse the 009 tokens/Typography - no restyle.

import { Text, XStack, YStack } from '../../../theme/ui';
import { BodyStrong, Caption } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { fonts } from '../../../theme/typography';
import { AlertIcon, CheckIcon } from '../../../theme/icons';
import { Avatar } from '../../../theme/Avatar';
import { BoxOverflowMenu } from './BoxOverflowMenu';
import { BoxIdentityLine } from './BoxIdentityLine';
import { plural, t } from '../../../i18n/strings';
import { creditState } from '../../messages/state/credit';
import { needsSignIn } from '../../messages/state/messagesController';
import { chipTone } from '../../../theme/chipTone';
import type { DataBoxAccount } from '../../../services/isds/types';

/** Count text capped at 99+ (matches the official app's badge cap). */
const cap = (n: number) => (n > 99 ? '99+' : String(n));

/** A small "Testovací" tag for a test-environment (czebox) box - soft-gold tokens (009 row idiom). */
export function TestTag() {
  const theme = useTheme();
  return (
    <XStack
      flexShrink={0}
      paddingHorizontal={6}
      paddingVertical={1}
      borderRadius={6}
      borderWidth={1}
      borderColor={theme.testBd}
      backgroundColor={theme.testBg}
    >
      {/* No letterSpacing: at this size/weight RN clips the last glyph ("Testovac[í]"). */}
      {/* The FACE, not just the weight: Public Sans ships as a 4-style group, so ExtraBold is a
          separate family that `fontWeight` alone cannot reach - this rendered at the base weight
          while claiming 800 (DESIGN.md's Face-Per-Weight Rule, found by the 2026-09-09 critique). */}
      <Text
        fontSize={10}
        fontFamily={fonts.bodyXBold}
        color={theme.testFg}
        lineHeight={15}
      >
        {t('box.testEnv')}
      </Text>
    </XStack>
  );
}

export function BoxRow({
  account,
  active,
  onPress,
  onRename,
  onRemove,
}: {
  readonly account: DataBoxAccount;
  /** The current box → shows a ✓ and is non-switching (tap just closes the sheet). */
  readonly active: boolean;
  readonly onPress: () => void;
  readonly onRename: () => void;
  readonly onRemove: () => void;
}) {
  const creditLine = (() => {
    const c = creditState(account.pdzCreditCzk, null);
    return c.kind === 'unknown'
      ? null
      : t('send.credit.balance', { amount: c.balance });
  })();
  const theme = useTheme();
  const unread = account.unreadCount ?? 0;
  // A box whose last refresh failed. Until now the switcher rendered it identically to a healthy
  // one, so the only way to discover that a box had stopped syncing was to switch to it and read the
  // strip - which is the one thing the switcher exists to save you from. Reported exactly that way:
  // "no icon to indicate sync for the given box is broken".
  //
  // Two marks rather than one, because they answer different questions. The glyph on the avatar is
  // for SCANNING a list ("which one is broken"); the line under the identity is for READING a row
  // ("broken how"). Neither replaces the unread badge - see below for why that matters.
  const broken = account.syncError;
  // `dangerSoft` for a box that needs the user to DO something - sign in again, or first change an
  // expired password on the portal; `info` for a transient refresh failure, which will most likely
  // fix itself on the next pull.
  const brokenTone = chipTone(needsSignIn(broken) ? 'dangerSoft' : 'info', theme);
  // Broken how, in the row's short words. Every key written out, so each one is greppable.
  const brokenLabel =
    broken === 'passwordExpired'
      ? t('box.sync.passwordExpired')
      : broken === 'reauth'
      ? t('box.sync.reauth')
      : t('box.sync.error');
  return (
    // Design: row is gap 4 / padding 6 6 6 12 / margin-bottom 6, radius 14, filled `sunken` when
    // active. The avatar+identity+check are ONE press area (inner gap 12); the ⋯ sits outside it.
    <XStack
      alignItems="center"
      gap={4}
      paddingTop={6}
      paddingRight={6}
      paddingBottom={6}
      paddingLeft={12}
      marginBottom={6}
      borderRadius={14}
      backgroundColor={active ? theme.surfaceSunken : 'transparent'}
    >
      <XStack
        flex={1}
        minWidth={0}
        alignItems="center"
        gap={12}
        paddingVertical={6}
        pressStyle={{ opacity: 0.65 }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={[
          account.alias ?? account.label,
          // The app's existing phrasing for a count of unread mail, so the switcher and the
          // attention group say the same thing. Czech needs the plural form, not a bare number.
          unread > 0 ? t(`attn.unread.${plural(unread)}`, { n: unread }) : null,
          broken ? brokenLabel : null,
        ]
          .filter(Boolean)
          .join(', ')}
        testID={`switchBox-${account.boxId}`}
      >
        {/* Design: the unread count OVERLAYS the avatar's top-right corner (not an inline pill). */}
        <YStack position="relative">
          <Avatar
            name={account.alias ?? account.label}
            colorSeed={account.boxId}
            size={42}
          />
          {unread > 0 ? (
            <XStack
              position="absolute"
              top={-5}
              right={-5}
              minWidth={20}
              minHeight={20}
              paddingHorizontal={5}
              borderRadius={10}
              backgroundColor={theme.gold}
              borderWidth={2}
              borderColor={theme.surfaceAlt}
              alignItems="center"
              justifyContent="center"
              testID={`unread-${account.boxId}`}
            >
              <Text
                fontSize={11}
                fontWeight="800"
                color={theme.onGold}
                lineHeight={14}
              >
                {cap(unread)}
              </Text>
            </XStack>
          ) : null}
          {/* Bottom-left, so it never collides with the unread badge at top-right: a box can be
              both unread and unreachable, and that combination is precisely the one worth seeing. */}
          {broken ? (
            <XStack
              position="absolute"
              bottom={-3}
              left={-3}
              width={18}
              height={18}
              borderRadius={9}
              backgroundColor={brokenTone.bg}
              borderWidth={2}
              borderColor={theme.surfaceAlt}
              alignItems="center"
              justifyContent="center"
              testID={`syncError-${account.boxId}`}
            >
              <AlertIcon size={10} color={brokenTone.fg} />
            </XStack>
          ) : null}
        </YStack>
        <YStack flex={1} minWidth={0} gap={3}>
          <XStack alignItems="center" gap={6} minWidth={0}>
            {/* `minWidth={0}` for the same reason as the inbox header: without it the name will
                not shrink past its content and runs into the "Testovací" chip beside it. */}
            <BodyStrong
              fontSize={15}
              numberOfLines={1}
              flexShrink={1}
              minWidth={0}
              // …and 2dp of padding, because the box then clips its own ellipsis: RN measures
              // the shrunk Text a hair narrower than the glyph it draws, so the third dot of
              // "Ondřej Ši…" was sliced vertically at the box edge. `TestTag` in this same
              // file hit the identical clipping on "Testovac[í]" and notes it there.
              paddingRight={2}
            >
              {account.alias ?? account.label}
            </BodyStrong>
            {account.host === 'czebox' ? <TestTag /> : null}
          </XStack>
          {/* "{legal type} · ID {boxId}" - the ID (which tells same-named boxes apart) is never
              truncated; a long type ellipsizes instead. */}
          <BoxIdentityLine account={account} />
          {/* 020: the box's PDZ credit, where you choose which box to send FROM. Shown only when it
              is actually known - a box whose balance has never been fetched says nothing rather than
              claiming zero. */}
          {broken ? (
            // Takes the credit line's place rather than sitting beside it. Both are facts from the
            // last successful refresh, and when that refresh is the thing that failed, "why this box
            // is not updating" outranks "what it could afford last time we looked". The unread badge
            // above stays for the same reason it is honest to keep it: it is the last count we know,
            // and this line is what tells the user it is a memory rather than a reading.
            //
            // "Poslední známý stav" is shown for EVERY broken box, not only one with unread mail.
            // It used to be conditional on the badge, on the reasoning that it qualified a number
            // and there was nothing to qualify without one. Reported as confusing, and rightly: two
            // boxes in the same state read differently, and the reader has no way to know the
            // difference is about the badge. Everything on this row comes from the last refresh that
            // worked - the counts, the credit, the lot - so the sentence is true either way.
            <Caption
              fontSize={12}
              color={brokenTone.fg}
              marginTop={2}
              testID={`syncState-${account.boxId}`}
            >
              {`${brokenLabel} · ${t('box.sync.stale')}`}
            </Caption>
          ) : creditLine ? (
            <Caption
              fontSize={12}
              color={theme.textFaint}
              marginTop={2}
              testID={`credit-${account.boxId}`}
            >
              {creditLine}
            </Caption>
          ) : null}
        </YStack>
        {active ? <CheckIcon size={20} color={theme.gold} /> : null}
      </XStack>
      <BoxOverflowMenu account={account} onRename={onRename} onRemove={onRemove} />
    </XStack>
  );
}
