// The received message's delivery record - the "Doručenka" (feature 017), since 031 a slip: a record
// you keep, torn off along its perforated top (board Message).
//
// It replaces one line of grey caption that used to sit inside the sender block, in the same muted
// grey as the box ID beneath it. Every deadline a user of this app cares about runs from the moment
// that line reported, so it was the weakest presentation on the most load-bearing fact.
//
// The design deliberately did NOT return the sent side's rail. A sent message is a journey still
// moving; a received one is a receipt for a journey that ended before the user could see it - listing
// the inbox is what serves it. Hence a titled card rather than a progress rail, named after the thing
// it actually is. Each step is struck as a ring, like the postmark on the envelope above it: a check
// for the arrival, clock hands for fiction, the filled ring for a service someone signed in for.
//
// What is NOT on the rail is as considered as what is: "read" is a footnote (opening a message has no
// legal weight, and ISDS never says when it happened), and erasure/vault are annotations (they
// describe what became of the message, not how it arrived).

import { Caption, Label, Meta, BodyStrong, Overline } from '../../../theme/Typography';
import { XStack, YStack } from '../../../theme/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import { ContentErasedIcon, EyeIcon, VaultIcon } from '../../../theme/icons';
import { Slip } from '../../../theme/objects/Slip';
import { RecordRing, type RecordRingKind } from '../../../theme/objects/RecordRing';
import { t } from '../../../i18n/strings';
import type { DeliveryRecord as Record, StepKind } from '../state/deliveryRecord';
import { LineIcon } from '../../../theme/LineIcon';

const pad = (n: number) => String(n).padStart(2, '0');

/** "19.08.2026" over "11:24", as the board sets a step's moment. */
export function dateAndTime(epochMs: number): [string, string] {
  const d = new Date(epochMs);
  return [
    `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`,
    `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  ];
}

/** A step's ring: an arrival is checked, fiction is the clock, a signed-for service is filled. */
export function ringKind(kind: StepKind): RecordRingKind {
  if (kind === 'fiction') {
    return 'fiction';
  }
  return kind === 'delivered' ? 'arrived' : 'signed';
}

export function DeliveryRecordSlip({ record }: { readonly record: Record }) {
  const theme = useTheme();
  const fiction = record.headKey === 'recv.head.fiction';

  if (record.steps.length === 0 && !record.showRead) {
    return null; // nothing ISDS told us - a slip saying nothing is worse than none
  }

  const ink = (kind: StepKind) => {
    if (kind === 'fiction') {
      return theme.goldInk;
    }
    return kind === 'delivered' ? theme.bodyText : chipTone('statusRead', theme).fg;
  };

  return (
    <YStack paddingTop={16} testID="deliveryRecord">
      <Slip style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14, gap: 10 }}>
        <XStack justifyContent="space-between" alignItems="center" gap={10}>
          {/* Gold names fiction, the one way of being served that nobody chose. It takes the row's
              width: measured to its own words, Android cut the last one ("DORUČENKA ·" for
              "Doručenka · fikcí", seen on the emulator), as it did the empty inbox's title. */}
          <Overline flex={1} color={fiction ? chipTone('statusFiction', theme).fg : theme.textMuted}>
            {t(record.headKey)}
          </Overline>
          <Meta fontWeight="400" color={theme.textFaint}>
            {t('recv.head.source')}
          </Meta>
        </XStack>

        {record.steps.map(step => {
          const [date, time] = dateAndTime(step.at);
          return (
            <XStack key={step.kind} alignItems="center" gap={12} testID={`recordStep-${step.kind}`}>
              <RecordRing kind={ringKind(step.kind)} color={ink(step.kind)} knockout={theme.surface} />
              <YStack flex={1} minWidth={0}>
                <BodyStrong color={theme.text}>{t(step.labelKey)}</BodyStrong>
                {step.noteKey ? (
                  <Caption fontWeight="400" color={theme.textMuted}>
                    {t(step.noteKey)}
                  </Caption>
                ) : null}
              </YStack>
              <YStack alignItems="flex-end" flexShrink={0}>
                <Label color={theme.bodyText}>{date}</Label>
                <Caption color={theme.textMuted}>{time}</Caption>
              </YStack>
            </XStack>
          );
        })}

        {/* Off the steps, under them: opening a message is not a delivery event (017), and nor is
            what became of it afterwards. */}
        {record.showRead ? (
          <XStack gap={12} marginTop={2} alignItems="flex-start">
            <LineIcon role="meta">
              <EyeIcon size={16} color={theme.textFaint} />
            </LineIcon>
            <Meta flex={1} color={theme.textFaint}>
              {t('recv.read.note')}
            </Meta>
          </XStack>
        ) : null}

        {record.annotations.map(a => (
          <XStack key={a} gap={8} alignItems="flex-start">
            <LineIcon role="meta">
              {a === 'erased' ? (
                <ContentErasedIcon size={15} color={theme.textFaint} />
              ) : (
                <VaultIcon size={15} color={theme.textFaint} />
              )}
            </LineIcon>
            <Meta fontWeight="600" flex={1} color={theme.textMuted}>
              {t(a === 'erased' ? 'status.note.erased' : 'status.note.vault')}
            </Meta>
          </XStack>
        ))}
      </Slip>
    </YStack>
  );
}

/** One step of a sent message's journey, as the detail works it out from the listing. */
export interface SentStep {
  readonly kind: 'sent' | 'delivered' | 'accepted' | 'fiction' | 'stop';
  readonly labelKey: string;
  readonly noteKey?: string;
  readonly time: number | null | undefined;
  readonly done: boolean;
}

/** A sent step's ring: struck once it happened, dashed while it is still to come. */
export function sentRingKind(step: SentStep): RecordRingKind {
  if (!step.done) {
    return 'pending';
  }
  if (step.kind === 'fiction') {
    return 'fiction';
  }
  if (step.kind === 'stop') {
    return 'stopped';
  }
  return step.kind === 'accepted' ? 'signed' : 'arrived';
}

/**
 * A sent message's delivery record (031 R7): the Sent board's slip under its envelope - the message's
 * ID beside the heading, a ring per step, the moment on the right or "zatím ne". What used to hang
 * under the old rail stays, as lines under the steps: how old the state is while it can still change,
 * why a journey stopped, and what became of the message.
 */
export function SentRecordSlip({
  messageId,
  steps,
  stateAsOf,
  stopWhyKey,
  annotation,
}: {
  readonly messageId: string;
  readonly steps: readonly SentStep[];
  /** When the listing last said it, while the state can still change; else null. */
  readonly stateAsOf: string | null;
  readonly stopWhyKey: string | null;
  readonly annotation: 'erased' | 'vault' | null;
}) {
  const theme = useTheme();
  const fiction = steps.some(s => s.kind === 'fiction' && s.done);
  const ink = (step: SentStep) => {
    const ring = sentRingKind(step);
    if (ring === 'fiction') {
      return theme.goldInk;
    }
    if (ring === 'signed') {
      return chipTone('statusRead', theme).fg;
    }
    if (ring === 'stopped') {
      return theme.danger;
    }
    return ring === 'pending' ? theme.slipMark : theme.bodyText;
  };
  return (
    <YStack paddingTop={16} testID="deliveryRecord">
      <Slip style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14, gap: 10 }}>
        <XStack justifyContent="space-between" alignItems="center" gap={10}>
          <Overline flex={1} color={fiction ? chipTone('statusFiction', theme).fg : theme.textMuted}>
            {t(fiction ? 'recv.head.fiction' : 'recv.head')}
          </Overline>
          <Meta fontWeight="400" color={theme.textFaint}>
            {t('send.sent.record.id', { id: messageId })}
          </Meta>
        </XStack>
        {steps.map(step => {
          const at = step.time ?? null;
          const [date, time] = at != null ? dateAndTime(at) : ['', ''];
          return (
            <XStack key={step.kind} alignItems="center" gap={12} testID={`sentStep-${step.kind}`}>
              <RecordRing kind={sentRingKind(step)} color={ink(step)} knockout={theme.surface} size={30} />
              <YStack flex={1} minWidth={0}>
                <BodyStrong fontWeight={step.done ? '700' : '600'} color={step.done ? theme.text : theme.textMuted}>
                  {t(step.labelKey)}
                </BodyStrong>
                {step.noteKey ? (
                  <Caption fontWeight="400" color={theme.textMuted}>
                    {t(step.noteKey)}
                  </Caption>
                ) : null}
              </YStack>
              {step.done && at != null ? (
                <YStack alignItems="flex-end" flexShrink={0}>
                  <Label color={theme.bodyText}>{date}</Label>
                  <Caption color={theme.textMuted}>{time}</Caption>
                </YStack>
              ) : (
                // ISDS gives no moment for a stop; a step still ahead is not yet.
                <Label color={theme.textMuted} flexShrink={0}>
                  {step.done ? '—' : t('send.sent.notYet')}
                </Label>
              )}
            </XStack>
          );
        })}
        {stopWhyKey ? (
          <Caption color={theme.textMuted} testID="sentStopWhy">
            {t(stopWhyKey)}
          </Caption>
        ) : null}
        {annotation ? (
          <XStack gap={8} alignItems="flex-start">
            <LineIcon role="meta">
              {annotation === 'erased' ? (
                <ContentErasedIcon size={15} color={theme.textFaint} />
              ) : (
                <VaultIcon size={15} color={theme.textFaint} />
              )}
            </LineIcon>
            <Meta fontWeight="600" flex={1} color={theme.textMuted}>
              {t(annotation === 'erased' ? 'status.note.erased' : 'status.note.vault')}
            </Meta>
          </XStack>
        ) : null}
        {stateAsOf != null ? (
          <Meta color={theme.textFaint} testID="state-as-of">
            {t('detail.stateAsOf', { d: stateAsOf })}
          </Meta>
        ) : null}
      </Slip>
    </YStack>
  );
}
