// What compose shows around its envelope (031 I38, boards R2 and R12): the letter it carries, the line
// under the window while a search runs, the results as sheets, the drafts, and the attachments.

import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, View, type TextInput } from 'react-native';
// gesture-handler Pressable for the inline discard so it coordinates with the row's swipe/tap gestures.
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { Input, XStack, YStack } from '../../../theme/ui';
import { Body, Caption, Heading, Label, Meta, Small, SmallStrong, Value } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import { objectShadow } from '../../../theme/depth';
import { Avatar } from '../../../theme/Avatar';
import { Card } from '../../../theme/Card';
import { Well } from '../../../theme/Well';
import { ArcSpinner } from '../../../theme/ArcSpinner';
import { ProgressBar } from '../../../theme/ProgressBar';
import { OffsetIcon } from '../../../theme/offsetIcons';
import { CloseIcon, PlusIcon, TrashIcon } from '../../../theme/icons';
import { SwipeableRow } from '../../../theme/SwipeableRow';
import { textSlop, touchSlop } from '../../../theme/touchTarget';
import { type as typeScale } from '../../../theme/typeScale';
import { AddressLines } from './AddressLines';
import { formatBytes, t } from '../../../i18n/strings';
import type { OutgoingDocument, Recipient } from '../../../services/isds/types';
import type { DraftRecord } from '../../../services/db/draftsStore';

/**
 * The letter in the envelope: Předmět over a hairline, Text zprávy, and what the text becomes. Its top
 * tucked 10 under the envelope's edge, as the message's sheet is (R2: the board's 4 top corners
 * rounded to the scale's 8, as the detail's).
 */
export function ComposeLetter({
  subject,
  onSubject,
  body,
  onBody,
}: {
  readonly subject: string;
  readonly onSubject: (text: string) => void;
  readonly body: string;
  readonly onBody: (text: string) => void;
}) {
  const theme = useTheme();
  const subjectField = useRef<TextInput>(null);
  const bodyField = useRef<TextInput>(null);
  const h = typeScale.heading;
  const b = typeScale.body;
  return (
    <LetterSheet>
      {/* The whole row takes the tap, the label too: the field alone is one line of type. */}
      {/* Not an element of its own: on iOS that would make it a leaf and the field inside it
          unreachable to VoiceOver (031 T050). The tap still focuses the field. */}
      <YStack gap={2} accessible={false} onPress={() => subjectField.current?.focus()}>
        <Label color={theme.textMuted}>{t('send.subject')}</Label>
        <Input
          ref={subjectField}
          minHeight={h.lineHeight}
          height="auto"
          paddingVertical={0}
          paddingHorizontal={0}
          backgroundColor="transparent"
          borderWidth={0}
          fontFamily={subject === '' ? typeScale.body.fontFamily : h.fontFamily}
          fontSize={subject === '' ? b.fontSize : h.fontSize}
          lineHeight={h.lineHeight}
          letterSpacing={subject === '' ? 0 : h.letterSpacing}
          color={theme.text}
          placeholderTextColor={theme.textFaint}
          cursorColor={theme.blue}
          selectionColor={theme.blue}
          value={subject}
          onChangeText={onSubject}
          placeholder={t('send.subject.placeholder')}
          accessibilityLabel={t('send.subject')}
          testID="composeSubject"
        />
      </YStack>
      <YStack height={1} backgroundColor={theme.border} />
      <YStack gap={2} accessible={false} onPress={() => bodyField.current?.focus()}>
        <Label color={theme.textMuted}>{t('send.body')}</Label>
        <Input
          ref={bodyField}
          multiline
          minHeight={3 * b.lineHeight}
          height="auto"
          paddingVertical={0}
          paddingHorizontal={0}
          backgroundColor="transparent"
          borderWidth={0}
          fontFamily={b.fontFamily}
          fontSize={b.fontSize}
          lineHeight={b.lineHeight}
          textAlignVertical="top"
          color={theme.bodyText}
          placeholderTextColor={theme.textFaint}
          cursorColor={theme.blue}
          selectionColor={theme.blue}
          value={body}
          onChangeText={onBody}
          placeholder={t('send.body.placeholder')}
          accessibilityLabel={t('send.body')}
          testID="composeBody"
        />
      </YStack>
      <Meta color={theme.textMuted}>{t('send.body.hint')}</Meta>
    </LetterSheet>
  );
}

/**
 * No sender yet: the letter dimmed with only its subject's place in it (R12), not yet in the envelope -
 * at its edge rather than tucked under it, and 10 further in.
 */
export function WaitingLetter() {
  const theme = useTheme();
  return (
    <View
      style={{ opacity: 0.45, marginTop: 10, marginHorizontal: 10 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LetterSheet>
        <YStack gap={2}>
          <Label color={theme.textMuted}>{t('send.subject')}</Label>
          <Body color={theme.textFaint}>{t('send.subject.placeholder')}</Body>
        </YStack>
      </LetterSheet>
    </View>
  );
}

function LetterSheet({ children }: { readonly children: ReactNode }) {
  const theme = useTheme();
  return (
    <YStack
      marginTop={-10}
      marginHorizontal={10}
      backgroundColor={theme.surface}
      borderTopLeftRadius={8}
      borderTopRightRadius={8}
      borderBottomLeftRadius={14}
      borderBottomRightRadius={14}
      paddingVertical={14}
      paddingHorizontal={16}
      gap={12}
      style={{ boxShadow: objectShadow(theme.name, 'letter') }}
      testID="composeLetter"
    >
      {children}
    </YStack>
  );
}

/**
 * The one line under the window while nobody is picked (R12): the hint before anything is typed, the
 * small wait while it searches, nothing found, or the error - each in the same place.
 */
export type SearchState = 'hint' | 'searching' | 'none' | 'error' | 'results' | 'idle';

export function SearchLine({
  state,
  error,
}: {
  readonly state: SearchState;
  readonly error: string | null;
}) {
  const theme = useTheme();
  // Said aloud as it changes: the line appears under the field, away from a screen reader's cursor,
  // and nothing told it the search had started or found no one (031 T050).
  const spoken =
    state === 'searching'
      ? t('send.recipient.searching')
      : state === 'none'
        ? t('send.recipient.none')
        : state === 'error'
          ? error
          : null;
  useEffect(() => {
    if (spoken) {
      AccessibilityInfo.announceForAccessibility(spoken);
    }
  }, [spoken]);
  if (state === 'searching') {
    return (
      <XStack alignItems="center" gap={8} paddingTop={10} paddingHorizontal={4} testID="composeSearching">
        <ArcSpinner track={theme.surfaceSunken} ink={theme.blue} />
        <Caption color={theme.textMuted}>{t('send.recipient.searching')}</Caption>
      </XStack>
    );
  }
  if (state === 'none') {
    return (
      <Caption color={theme.textMuted} marginHorizontal={4} testID="composeNoRecipient">
        {t('send.recipient.none')}
      </Caption>
    );
  }
  if (state === 'error') {
    return (
      <Caption color={theme.danger} marginHorizontal={4} testID="composeSearchError">
        {error}
      </Caption>
    );
  }
  if (state === 'hint') {
    // Gives the task a shape: who first, then the rest.
    return (
      <Caption color={theme.textMuted} marginTop={4} marginHorizontal={4} testID="composeHint">
        {t('send.recipient.hint')}
      </Caption>
    );
  }
  return null;
}

/** "Nalezeno · 3", and - only when the set has namesakes - the line that says the address tells them apart. */
export function ResultsHead({ count, sameName }: { readonly count: number; readonly sameName: boolean }) {
  const theme = useTheme();
  return (
    <XStack flexWrap="wrap" alignItems="center" gap={8} paddingTop={2} paddingHorizontal={2}>
      <Meta fontWeight="700" color={theme.textFaint}>
        {t('recipient.found')} · {count}
      </Meta>
      {/* The user has to NOTICE two rows share a name before it occurs to them to compare addresses,
          and with a dozen results that is exactly what fails (015 FR-004a). */}
      {sameName ? <Meta color={theme.textMuted}>{t('recipient.sameNameHint')}</Meta> : null}
    </XStack>
  );
}

/**
 * One search result, a sheet below the envelope (R12; 015 reworked to the design).
 *
 * Everything here follows from one fact: a search for a common surname returns several people with
 * the SAME name, identical in type and cost badge, and the address is the only thing that separates
 * them. Nothing in this sheet truncates, and the meta line WRAPS so the cost chip can never reclaim
 * the width the address needs.
 */
export function RecipientSheet({
  recipient,
  sameName,
  onPick,
}: {
  readonly recipient: Recipient;
  /** Another result in this same search shares this owner name (015 FR-004a). */
  readonly sameName: boolean;
  readonly onPick: () => void;
}) {
  const theme = useTheme();
  const free = recipient.dbType === 'OVM';
  const tone = chipTone(free ? 'costFree' : 'costPaid', theme);
  return (
    <Card
      flexDirection="row"
      padding={12}
      gap={12}
      alignItems="flex-start"
      pressStyle={{ backgroundColor: theme.surfaceAlt }}
      onPress={onPick}
      accessibilityRole="button"
      accessibilityLabel={recipient.address ? `${recipient.name}, ${recipient.address}` : recipient.name}
      testID={`recipient-${recipient.boxId}`}
    >
      {/* Initials come from the NAME, never from a label with the address in it (FR-006). */}
      <Avatar name={recipient.name} size={38} />
      <YStack flex={1} minWidth={0}>
        <SmallStrong color={theme.text}>{recipient.name}</SmallStrong>
        <AddressLines address={recipient.address} />
        <XStack flexWrap="wrap" alignItems="center" gap={8} marginTop={8}>
          <Meta color={theme.textFaint}>
            {t(`send.dbType.${recipient.dbType}`)} · {recipient.boxId}
          </Meta>
          <Chip bg={tone.bg} fg={tone.fg} label={free ? t('send.cost.free') : t('send.cost.paid.badge')} />
          {sameName ? (
            <Chip bg={theme.surfaceSunken} fg={theme.textMuted} label={t('recipient.sameName')} />
          ) : null}
        </XStack>
      </YStack>
    </Card>
  );
}

/** R12's chip: 2/8 in, the 8 corner, 12/700. */
function Chip({ bg, fg, label }: { readonly bg: string; readonly fg: string; readonly label: string }) {
  return (
    <YStack flexShrink={0} paddingHorizontal={8} paddingVertical={2} borderRadius={8} backgroundColor={bg}>
      <Meta fontWeight="700" color={fg}>
        {label}
      </Meta>
    </YStack>
  );
}

/**
 * The drafts under the hint (R12 "Nothing typed yet"): each a sheet with the draft glyph in a well and
 * Zahodit. Swiping discards too; either way the snackbar offers Vrátit zpět.
 */
export function DraftSheets({
  drafts,
  onResume,
  onDiscard,
}: {
  readonly drafts: readonly DraftRecord[];
  readonly onResume: (d: DraftRecord) => void;
  readonly onDiscard: (d: DraftRecord) => void;
}) {
  const theme = useTheme();
  if (drafts.length === 0) {
    return null;
  }
  return (
    <YStack gap={12} marginTop={6}>
      <Label fontWeight="700" color={theme.textMuted}>
        {t('send.drafts')}
      </Label>
      {drafts.map(d => (
        <SwipeableRow
          key={d.id}
          onPress={() => onResume(d)}
          accessibilityLabel={d.recipientLabel ?? t('send.draft.empty')}
          pressTestID={`draft-${d.id}`}
          rightAction={{
            label: t('send.draft.discard'),
            icon: <TrashIcon size={20} color={theme.onBlue} />,
            color: theme.onBlue,
            background: theme.danger,
            onPress: () => onDiscard(d),
            testID: `draftSwipeDiscard-${d.id}`,
          }}
        >
          <Card flexDirection="row" alignItems="center" gap={12} paddingVertical={12} paddingHorizontal={13}>
            <YStack
              width={36}
              height={36}
              borderRadius={11}
              backgroundColor={theme.surfaceSunken}
              alignItems="center"
              justifyContent="center"
            >
              <OffsetIcon name="draft" size={22} color={theme.text} />
            </YStack>
            {/* The subject line is always drawn, "(bez předmětu)" when empty, so every row keeps one height. */}
            <YStack flex={1} minWidth={0}>
              <SmallStrong color={theme.text} numberOfLines={1}>
                {d.recipientLabel ?? t('send.draft.empty')}
              </SmallStrong>
              <Meta color={theme.textFaint} numberOfLines={1}>
                {d.subject.trim() === '' ? t('messages.noSubject') : d.subject}
              </Meta>
            </YStack>
            <GHPressable
              onPress={() => onDiscard(d)}
              accessibilityRole="button"
              accessibilityLabel={t('send.draft.discard')}
              testID={`draftDelete-${d.id}`}
              hitSlop={textSlop('label', { paddingVertical: 6 })}
              style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}
            >
              <Label fontWeight="700" color={theme.danger}>
                {t('send.draft.discard')}
              </Label>
            </GHPressable>
          </Card>
        </SwipeableRow>
      ))}
    </YStack>
  );
}

/**
 * The attachments under the letter (R2): Přílohy and the count; each file with the attach glyph in its
 * well, its size, and a 44 remove; Přidat přílohu as a blue link. While a pick reads, its sheet with
 * the bar and cancel takes the link's place (R12).
 *
 * The slot under the files is always as tall as the reading sheet - laid out invisible while idle, the
 * link drawn over it - so nothing below moves when one becomes the other, at any text size
 * (constitution V).
 */
export function AttachmentList({
  files,
  onRemove,
  reading,
  readingLabel,
  fraction,
  onCancel,
  onAdd,
  busy,
}: {
  readonly files: readonly OutgoingDocument[];
  readonly onRemove: (f: OutgoingDocument) => void;
  readonly reading: boolean;
  readonly readingLabel: string;
  readonly fraction: number;
  readonly onCancel: () => void;
  readonly onAdd: () => void;
  readonly busy: boolean;
}) {
  const theme = useTheme();
  return (
    <YStack gap={6} paddingTop={4}>
      <XStack gap={8} alignItems="baseline">
        <Heading accessibilityRole="header">{t('send.attachments')}</Heading>
        {files.length > 0 ? <Small color={theme.textMuted}>{files.length}</Small> : null}
      </XStack>
      {files.map((f, i) => (
        <XStack key={`${f.fileName}-${i}`} alignItems="center" gap={12} minHeight={48}>
          <Well name="attach" />
          <YStack flex={1} minWidth={0}>
            <SmallStrong color={theme.text} numberOfLines={1}>
              {f.fileName}
            </SmallStrong>
            <Caption color={theme.textMuted}>{formatBytes(f.sizeBytes)}</Caption>
          </YStack>
          <XStack
            width={44}
            height={44}
            alignItems="center"
            justifyContent="center"
            // To the 48 target (031 T050).
            hitSlop={touchSlop({ width: 44, height: 44 })}
            pressStyle={{ opacity: 0.5 }}
            // By the file, not by its index: a double tap runs both presses against the list as the
            // first removal left it, so removing index i twice took the file after it too.
            onPress={() => onRemove(f)}
            accessibilityRole="button"
            accessibilityLabel={t('send.attachments.remove')}
            testID={`composeRemoveFile-${i}`}
          >
            <CloseIcon size={18} color={theme.textMuted} />
          </XStack>
        </XStack>
      ))}
      <YStack width="100%" position="relative">
        <Card
          flexDirection="row"
          alignItems="center"
          gap={10}
          minHeight={46}
          paddingVertical={8}
          paddingRight={8}
          paddingLeft={12}
          opacity={reading ? 1 : 0}
          pointerEvents={reading ? 'auto' : 'none'}
          accessibilityElementsHidden={!reading}
          importantForAccessibility={reading ? 'auto' : 'no-hide-descendants'}
          testID="composeAttachReading"
        >
          <YStack flex={1} minWidth={0} gap={6}>
            <Caption color={theme.textMuted} numberOfLines={1} testID="composeAttachReadingLabel">
              {readingLabel}
            </Caption>
            <ProgressBar fraction={fraction} label={t('send.attachments.readingStart')} testID="composeAttachProgress" />
          </YStack>
          <XStack
            width={30}
            height={30}
            alignItems="center"
            justifyContent="center"
            hitSlop={touchSlop({ width: 30, height: 30 })}
            pressStyle={{ opacity: 0.5 }}
            onPress={reading ? onCancel : undefined}
            accessibilityRole="button"
            accessibilityLabel={t('send.attachments.cancel')}
            testID="composeCancelAttach"
          >
            <CloseIcon size={16} color={theme.textMuted} />
          </XStack>
        </Card>
        {reading ? null : (
          <XStack
            position="absolute"
            top={0}
            left={0}
            bottom={0}
            alignItems="center"
            gap={6}
            paddingHorizontal={4}
            opacity={busy ? 0.5 : 1}
            pressStyle={{ opacity: 0.6 }}
            onPress={busy ? undefined : onAdd}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            accessibilityLabel={t('send.attachments.add')}
            testID="composeAddAttachment"
          >
            <PlusIcon size={18} color={theme.blue} />
            <SmallStrong color={theme.blue}>{t('send.attachments.add')}</SmallStrong>
          </XStack>
        )}
      </YStack>
    </YStack>
  );
}

/** The paid stamp's caution under the letter (R12): the credit may not cover it. */
export function CreditShortStrip() {
  const theme = useTheme();
  const tone = chipTone('dangerSoft', theme);
  return (
    <XStack
      borderRadius={12}
      paddingVertical={10}
      paddingHorizontal={14}
      backgroundColor={tone.bg}
      testID="composeCredit"
    >
      <Value flex={1} color={tone.fg}>
        {t('send.credit.shortNote')}
      </Value>
    </XStack>
  );
}
