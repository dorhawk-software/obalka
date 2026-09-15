// The received message's delivery record - the "Doručenka" card (feature 017).
//
// It replaces one line of grey caption that used to sit inside the sender block, in the same muted
// grey as the box ID beneath it. Every deadline a user of this app cares about runs from the moment
// that line reported, so it was the weakest presentation on the most load-bearing fact.
//
// The design deliberately did NOT return the sent side's rail. A sent message is a journey still
// moving; a received one is a receipt for a journey that ended before the user could see it - listing
// the inbox is what serves it. Hence a titled card rather than a progress rail, named after the thing
// it actually is.
//
// What is NOT on the rail is as considered as what is: "read" is a footnote (opening a message has no
// legal weight, and ISDS never says when it happened), and erasure/vault are annotations (they
// describe what became of the message, not how it arrived).

import { Badge, Body, Caption } from '../../../theme/Typography';
import { XStack, YStack } from '../../../theme/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import { ContentErasedIcon, EyeIcon, VaultIcon } from '../../../theme/icons';
import { DeliveryStateIcon } from './DeliveryStateIcon';
import { DottedRail } from '../../../theme/DottedRail';
import { t } from '../../../i18n/strings';
import {
  stepStateKind,
  type DeliveryRecord as Record,
  type StepKind,
} from '../state/deliveryRecord';

/** A step's tone. `delivered` is the quiet blue; service - however reached - is the loud one. */
function stepTone(kind: StepKind) {
  if (kind === 'fiction') {
    return 'statusFiction' as const;
  }
  return kind === 'delivered'
    ? ('statusDelivered' as const)
    : ('statusRead' as const);
}

export function DeliveryRecordCard({ record }: { readonly record: Record }) {
  const theme = useTheme();
  const fiction = record.headKey === 'recv.head.fiction';
  const head = chipTone(fiction ? 'statusFiction' : 'statusRead', theme);

  if (record.steps.length === 0 && !record.showRead) {
    return null; // nothing ISDS told us - a card saying nothing is worse than no card
  }

  return (
    <YStack
      marginTop={20}
      backgroundColor={theme.surface}
      borderWidth={1}
      borderColor={theme.border}
      borderRadius={16}
      overflow="hidden"
      testID="deliveryRecord"
    >
      <YStack backgroundColor={head.bg} paddingVertical={9} paddingHorizontal={16}>
        <Badge
          fontSize={11}
          letterSpacing={0.5}
          textTransform="uppercase"
          color={head.fg}
        >
          {t(record.headKey)}
        </Badge>
      </YStack>

      <YStack paddingTop={14} paddingHorizontal={16} paddingBottom={15}>
        {record.steps.map((step, i) => {
          const last = i === record.steps.length - 1;
          const tone = chipTone(stepTone(step.kind), theme);
          return (
            <XStack key={step.kind} gap={12}>
              <YStack width={18} alignItems="center" flexShrink={0}>
                {/* The SAME component the sent rail uses, so "dodáno" and "doručeno" cannot drift
                    into wearing the same mark - a bare check for arrival, a filled disc for
                    service (Principle V). */}
                <DeliveryStateIcon
                  kind={stepStateKind(step.kind)}
                  color={tone.fg}
                  knockout={theme.surface}
                  label={t(step.labelKey)}
                />
                {/* The connector only ever joins steps that BOTH happened, so it can never imply
                    something still to come (013's rule). */}
                {/* Dotted, in the step's own colour - the SENT rail's connector, prop for prop.
                    The design drew this one solid, and that distinction turns out to carry no
                    meaning: the sent rail stays dotted even on a fully completed message, so solid
                    here was not "finished" against "in progress", just a second style for the same
                    idea. Two rails of ISDS moments now look like two rails of ISDS moments.
                    Drawn with SVG rather than a dotted border: a one-sided `borderStyle: 'dotted'`
                    comes out SOLID on iOS (see `DottedRail`). */}
                {last ? null : <DottedRail color={tone.fg} />}
              </YStack>
              <YStack flex={1} minWidth={0} paddingBottom={last ? 0 : 12}>
                <XStack
                  flexWrap="wrap"
                  alignItems="baseline"
                  justifyContent="space-between"
                  gap={10}
                >
                  <Body fontSize={14} fontWeight="700" color={theme.text}>
                    {t(step.labelKey)}
                  </Body>
                  <Body fontSize={13} fontWeight="600" color={theme.textMuted}>
                    {step.time}
                  </Body>
                </XStack>
                {step.noteKey ? (
                  <Caption
                    fontSize={12}
                    lineHeight={17}
                    color={theme.textMuted}
                    marginTop={3}
                  >
                    {t(step.noteKey)}
                  </Caption>
                ) : null}
              </YStack>
            </XStack>
          );
        })}

        {record.showRead ? (
          <XStack
            gap={12}
            marginTop={13}
            paddingTop={12}
            borderTopWidth={1}
            borderColor={theme.border}
            alignItems="flex-start"
          >
            <YStack marginTop={1} flexShrink={0}>
              <EyeIcon size={16} color={theme.textFaint} />
            </YStack>
            <Caption
              flex={1}
              fontSize={12}
              lineHeight={17}
              color={theme.textFaint}
            >
              {t('recv.read.note')}
            </Caption>
          </XStack>
        ) : null}

        {record.annotations.length > 0 ? (
          <YStack
            marginTop={13}
            paddingTop={12}
            borderTopWidth={1}
            borderColor={theme.border}
            gap={8}
          >
            {record.annotations.map(a => (
              <XStack key={a} gap={8} alignItems="flex-start">
                <YStack marginTop={1} flexShrink={0}>
                  {a === 'erased' ? (
                    <ContentErasedIcon size={15} color={theme.textFaint} />
                  ) : (
                    <VaultIcon size={15} color={theme.textFaint} />
                  )}
                </YStack>
                <Caption
                  flex={1}
                  fontSize={12}
                  fontWeight="600"
                  lineHeight={17}
                  color={theme.textMuted}
                >
                  {t(a === 'erased' ? 'status.note.erased' : 'status.note.vault')}
                </Caption>
              </XStack>
            ))}
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  );
}
