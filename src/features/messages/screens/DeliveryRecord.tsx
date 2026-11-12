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
