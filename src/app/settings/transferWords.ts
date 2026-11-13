// What the transfer screen says, as plain functions of what happened (025, 031 I46.5): the route
// (FR-007), the counts both phones can be read against (US1), the last word on each phone (FR-011,
// T027) and the failures told apart (FR-006). Out of `TransferScreen.tsx` since 2026-11-13, when the
// end became a screen of its own and the screen file passed its size limit; the backup screen says
// the same last word and the same failures when a save ends with this screen closed.

import { plural, t } from '../../i18n/strings';
import { formatBytes } from '../../i18n/typeset';
import {
  PhraseRefusedError,
  TRANSFER_RELAY,
  TransferBackupGoneError,
  TransferBusyError,
  TransferNoAnswerError,
  TransferOfferExpiredError,
  TransferUnavailableError,
} from '../../services/transfer/transport';
import type { AppliedTransfer, TransferContents } from '../../features/transfer/state/transferController';
import type { TransferEnd } from './TransferDone';

/** Which of the three honest things to say about the route (FR-007). */
export function routeKey(relayed: boolean | null): string {
  if (relayed === null) {
    return 'transfer.route.unknown';
  }
  return relayed ? 'transfer.route.relayed' : 'transfer.route.direct';
}

/** The route sentence itself, with the relay NAMED rather than described (US3 scenario 2). */
export function routeText(relayed: boolean | null): string {
  return t(routeKey(relayed), { host: TRANSFER_RELAY.host, host6: TRANSFER_RELAY.host6 });
}

/**
 * The route once it is over, in the past tense, or nothing when it never became known (025 T027).
 *
 * The sentence during the transfer is right for a large archive and invisible for a small one: the
 * walk moved three boxes in about a second, and nobody could say afterwards which way they had gone.
 */
export function wentText(relayed: boolean | null): string | null {
  if (relayed === null) {
    return null;
  }
  return relayed
    ? t('transfer.route.went.relayed', { host: TRANSFER_RELAY.host })
    : t('transfer.route.went.direct');
}

/**
 * The last word, and the route as a paragraph of its own under it when the route is known. Run
 * on as one paragraph, "it went through the relay" read as part of "sign in to the boxes" (T027).
 * Since 031 (R8) the first sentence is the end screen's title and the rest the line under it.
 */
export function lastWord(words: Pick<TransferEnd, 'title' | 'body'>, relayed: boolean | null = null): TransferEnd {
  return { ...words, went: wentText(relayed) };
}

/**
 * Boxes, messages and documents as one counted list (US1).
 *
 * The same words in the same order on the phone that sends and the phone that receives, because the
 * point of both counts is to be read against each other.
 */
export function countList(
  boxes: number | null,
  messages: number | null,
  documents: number | null,
): string {
  return [
    boxes == null ? null : t(`backup.count.boxes.${plural(boxes)}`, { n: boxes }),
    messages == null ? null : t(`backup.count.messages.${plural(messages)}`, { n: messages }),
    documents == null
      ? null
      : t(`transfer.count.documents.${plural(documents)}`, { n: documents }),
  ]
    .filter(Boolean)
    .join(', ');
}

/** Under the phrase: what is about to go, counted where it could be counted, and the size always. */
export function contentsText(contents: TransferContents | null, sizeBytes: number): string {
  const size = formatBytes(sizeBytes);
  const counted =
    contents != null &&
    (contents.boxes != null || contents.messages != null || contents.documents != null);
  return counted
    ? t('transfer.phrase.contents', {
        what: countList(contents.boxes, contents.messages, contents.documents),
        size,
      })
    : t('transfer.phrase.size', { size });
}

/**
 * The receiving phone's last word (US1 scenarios 3 and 5, FR-011).
 *
 * Documents are counted with the rest. The ones the backup named and that did not land - not in what
 * arrived, unreadable, or with no message left to belong to - are said as a number rather than left
 * for the user to discover as a difference between the two phones.
 */
export function doneParts(restored: AppliedTransfer): Pick<TransferEnd, 'title' | 'body'> {
  const messages = restored.messagesAdded + restored.messagesMerged;
  const boxes = restored.accountsAdded + restored.accountsKept;
  const documents = restored.documents;
  const lost =
    (documents?.missing ?? 0) + (documents?.failed ?? 0) + (documents?.orphaned ?? 0);
  return {
    title: t('transfer.done', { what: countList(boxes, messages, documents?.restored ?? 0) }),
    body: [
      lost > 0 ? t(`transfer.done.missing.${plural(lost)}`, { n: lost }) : null,
      // The archive is saved either way, but the password that came with it was not kept, so backups
      // on this phone may be off. Said, so nobody believes the new phone is backing up when it is not.
      restored.keysFailed ? t('transfer.done.keyNotSaved') : null,
      t('transfer.done.signIn'),
    ]
      .filter(Boolean)
      .join(' '),
  };
}

/** The same last word as one paragraph, for the backup screen that says it when this one is closed. */
export function doneText(restored: AppliedTransfer): string {
  const { title, body } = doneParts(restored);
  return [title, body].filter(Boolean).join(' ');
}

/**
 * The sentence for a transfer that did not finish (FR-006), so the outcomes stay told apart whichever
 * way the failure reaches the screen: from a run it started, or from a save it found running.
 *
 * A refused phrase reads differently on the two phones. It was typed on the receiving one, so that is
 * where it can be fixed; the sending phone can only start again, and "ask the other phone for a new
 * one" would send its user looking for a password they are the one showing (025 T027).
 */
export function errorText(e: unknown, side: 'sending' | 'receiving' = 'receiving'): string {
  if (e instanceof PhraseRefusedError) {
    return side === 'sending' ? t('transfer.error.phrase.sender') : t('transfer.error.phrase');
  }
  if (e instanceof TransferNoAnswerError) {
    return t('transfer.error.noAnswer');
  }
  if (e instanceof TransferOfferExpiredError) {
    return t('transfer.error.expired');
  }
  if (e instanceof TransferUnavailableError) {
    return t('transfer.unavailable');
  }
  if (e instanceof TransferBusyError) {
    return t('transfer.error.busy');
  }
  if (e instanceof TransferBackupGoneError) {
    return t('transfer.error.gone');
  }
  return t('transfer.error.failed');
}
