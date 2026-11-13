// The transfer screen at rest, as board R10 draws it (031 I46.1-I46.3, agreed 2026-11-12): what to
// send, the way to receive, and the one card a build that cannot transfer shows. Out of
// `TransferScreen.tsx`, which keeps the run and its rules; these are only what is drawn before one.
//
// Sending: the backups as one card of choices, each its date over its size and what it holds (the
// chip's words as text, so the row reads as one line), the note, and the send as the filled button.
// With no backup yet, a card that says why and links to making one.
//
// Receiving, from Settings: one row with the transfer glyph in its well, which opens the receiving
// screen - the same screen a first run opens. There: what to do, the scan as the neutral button, the
// field, the hint, and Přijmout as the filled button, dimmed until something is typed. A failure is
// the danger block in place of the words, and the hint gives way to it.
//
// Roundings: the field's 15 at the sides is the inputs' 16 everywhere else. Spacing composed of
// steps, not rounded: the 26 above the receiving half is the section's 18 and 8.

import { useRef } from 'react';
import type { TextInput } from 'react-native';
import { Input, XStack, YStack } from '../../theme/ui';
import { Caption, Heading, Meta, Small, SmallStrong } from '../../theme/Typography';
import { InkButton } from '../../theme/InkButton';
import { NeutralButton } from '../../theme/NeutralButton';
import { OptionGroup } from '../../theme/OptionGroup';
import { ChevronRightIcon, ScanIcon } from '../../theme/icons';
import { chipTone } from '../../theme/chipTone';
import { useTheme } from '../../theme/ThemeProvider';
import { formatBytes, t } from '../../i18n/strings';
import type { BackupManifest } from '../../services/backup/schema';
import { Card, CardRow, RowText, Section, Well } from './SettingsSection';
import { documentsChipText, documentsMissingText } from './BackupDocumentsChip';
import { formatDateTime } from './TransferDialogs';

/** R10's failure: a danger tone block, no outline and no icon, at the top of its half. */
export function FailureBlock({ text, side }: { readonly text: string; readonly side: 'sending' | 'receiving' }) {
  const theme = useTheme();
  const danger = chipTone('dangerSoft', theme);
  return (
    <YStack
      backgroundColor={danger.bg}
      borderRadius={12}
      paddingVertical={12}
      paddingHorizontal={14}
      testID={`transfer-error-${side}`}
    >
      <Small fontWeight="600" color={danger.fg} testID="transfer-error">
        {text}
      </Small>
    </YStack>
  );
}

/** A build without the native module (FR-013): the one card, in place of the whole screen (R10). */
export function TransferUnavailable() {
  const theme = useTheme();
  return (
    <Section label={t('transfer')}>
      <Card>
        <YStack padding={16}>
          <Small color={theme.textMuted}>{t('transfer.unavailable')}</Small>
        </YStack>
      </Card>
    </Section>
  );
}

/** What to send: the backups, the note and the send; or, with none, the way to make one. */
export function SendHalf({
  backups,
  chosen,
  onChoose,
  onSend,
  onOpenBackup,
  failure,
}: {
  /** Newest first; null while they are read. */
  readonly backups: readonly BackupManifest[] | null;
  readonly chosen: BackupManifest | null;
  readonly onChoose: (archiveName: string) => void;
  readonly onSend: () => void;
  readonly onOpenBackup?: () => void;
  readonly failure: string | null;
}) {
  const theme = useTheme();
  return (
    <Section label={t('transfer.pick')}>
      {failure ? <FailureBlock text={failure} side="sending" /> : null}
      {backups === null ? null : backups.length === 0 ? (
        // Nothing to send: a transfer always sends a finished backup (026 US3).
        <Card testID="transfer-no-backup">
          <YStack padding={16} gap={6}>
            <Heading>{t('transfer.pick.none.title')}</Heading>
            <Small color={theme.textMuted}>{t('transfer.pick.none.body')}</Small>
            <XStack
              alignSelf="flex-start"
              alignItems="center"
              gap={6}
              minHeight={44}
              pressStyle={{ opacity: 0.6 }}
              onPress={onOpenBackup}
              accessibilityRole="link"
              accessibilityLabel={t('transfer.pick.create')}
              testID="transfer-create-backup"
            >
              <SmallStrong color={theme.blue}>{t('transfer.pick.create')}</SmallStrong>
              <ChevronRightIcon size={16} color={theme.blue} />
            </XStack>
          </YStack>
        </Card>
      ) : (
        <YStack>
          <OptionGroup<string>
            value={chosen?.archiveName ?? ''}
            onChange={onChoose}
            testIDPrefix="transfer-backup"
            options={backups.map(manifest => ({
              value: manifest.archiveName,
              label: formatDateTime(manifest.createdAt),
              description: [
                formatBytes(manifest.sizeBytes + (manifest.documentBytes ?? 0)),
                documentsChipText(manifest),
                documentsMissingText(manifest),
              ]
                .filter(Boolean)
                .join(' · '),
            }))}
          />
          <Caption color={theme.textMuted} marginTop={10} marginHorizontal={4}>
            {t('transfer.pick.note')}
          </Caption>
          <YStack marginTop={16}>
            <InkButton label={t('transfer.pick.send')} onPress={onSend} testID="transfer-send" />
          </YStack>
        </YStack>
      )}
    </Section>
  );
}

/** Receiving, from the sending screen: the row that opens the receiving one (R10). */
export function ReceiveRow({ onPress }: { readonly onPress: () => void }) {
  const theme = useTheme();
  return (
    <Section label={t('transfer.receive')}>
      <Card>
        <CardRow
          last
          onPress={onPress}
          accessibilityLabel={t('transfer.receiveFrom')}
          testID="transfer-open-receive"
        >
          <Well name="transfer" />
          <RowText title={t('transfer.receiveFrom')} subtitle={t('transfer.receive.row')} />
          <ChevronRightIcon size={18} color={theme.textMuted} />
        </CardRow>
      </Card>
    </Section>
  );
}

/** The receiving form (R10): what to do, scan, the field, the hint, Přijmout. */
export function ReceiveForm({
  typed,
  onType,
  onScan,
  onReceive,
  failure,
}: {
  readonly typed: string;
  readonly onType: (text: string) => void;
  /** Absent where the camera cannot read a code; the field is the way in then. */
  readonly onScan?: () => void;
  readonly onReceive: () => void;
  readonly failure: string | null;
}) {
  const theme = useTheme();
  const field = useRef<TextInput>(null);
  return (
    <YStack gap={10}>
      {failure ? (
        <FailureBlock text={failure} side="receiving" />
      ) : (
        <Small color={theme.bodyText} marginHorizontal={4}>
          {t('transfer.receive.desc')}
        </Small>
      )}
      {onScan ? (
        <YStack marginTop={6}>
          <NeutralButton
            label={t('transfer.scan')}
            icon={<ScanIcon size={20} color={theme.text} />}
            onPress={onScan}
            testID="transfer-scan"
          />
        </YStack>
      ) : null}
      <Input
        ref={field}
        minHeight={50}
        backgroundColor={theme.surface}
        borderColor={theme.borderStrong}
        borderWidth={1}
        borderRadius={14}
        paddingHorizontal={16}
        fontSize={15}
        color={theme.text}
        placeholderTextColor={theme.textFaint}
        focusStyle={{ borderColor: theme.blue, borderWidth: 1.5 }}
        value={typed}
        onChangeText={onType}
        placeholder={t('transfer.phrase.placeholder')}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={t('transfer.phrase.placeholder')}
        testID="transfer-phrase-input"
      />
      {failure ? null : (
        <Meta color={theme.textMuted} testID="transfer-receive-hint">
          {t('transfer.phrase.hint')}
        </Meta>
      )}
      <YStack marginTop={8}>
        <InkButton
          label={t('transfer.start')}
          onPress={onReceive}
          blockedReason={typed.trim() ? undefined : t('transfer.needPhrase')}
          onBlockedPress={() => field.current?.focus()}
          testID="transfer-receive"
        />
      </YStack>
    </YStack>
  );
}
