// A fictional archive, for screenshots.
//
// The README shows the app full of government mail, and the only mail a developer has is their own.
// This exists so those pictures can be taken from invented data instead: every name, box ID, case
// number and address below is made up, and nothing here ever talks to ISDS.
//
// DEV ONLY, twice over. `seedDemoArchive` refuses to run unless `__DEV__`, and nothing calls it
// unless `DEMO_DATA` is flipped by hand. It writes into the same encrypted archive the real app
// uses, so running it on a device that holds real boxes would add fictional mail beside them.
//
// To retake the screenshots: set `DEMO_DATA = true`, run the app on a CLEAN emulator (the seed
// refuses if any box already exists), capture, then set it back to false.

import { SqliteAccountsStore } from '../services/db/sqliteAccountsStore';
import { SqliteMessagesStore } from '../services/db/messagesStore';
import { MESSAGE_STATE_READ } from '../services/isds/types';
import { isUnread } from '../features/messages/state/messagesController';
import { attachmentFileStore } from '../services/files/attachmentFileStore';
import type {
  DataBoxAccount,
  MessageAttachment,
  MessageDetail,
  MessageEnvelope,
} from '../services/isds/types';

/** Flip by hand to seed. Never true on a branch that gets pushed. */
export const DEMO_DATA = false;

const DAY = 86_400_000;

/** Fixed clock, so a screenshot taken in March matches one taken in September. */
const NOW = Date.UTC(2026, 8, 12, 9, 24);

const account = (
  boxId: string,
  label: string,
  dbType: DataBoxAccount['dbType'],
  extra: Partial<DataBoxAccount> = {},
): DataBoxAccount => ({
  id: `demo-${boxId}`,
  boxId,
  loginName: `demo.${boxId}`,
  label,
  dbType,
  alias: null,
  authMethod: 'password',
  host: 'production',
  secretRef: `demo/${boxId}`,
  sessionValidUntil: NOW + 30 * DAY,
  passwordExpiresAt: NOW + 64 * DAY,
  lastSyncedAt: NOW - 4 * 60_000,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: NOW - 400 * DAY,
  updatedAt: NOW,
  ...extra,
});

/**
 * Three boxes, because the unified inbox is the thing worth photographing and one box cannot show
 * it. A private person, the same person's trade licence, and a company: the three shapes a Czech
 * user actually ends up holding at once.
 */
export const DEMO_ACCOUNTS: readonly DataBoxAccount[] = [
  account('k4m9xrt', 'Ondřej Dvořák', 'FO'),
  account('p7wq2bs', 'Ing. Ondřej Dvořák', 'PFO', { pdzCreditCzk: 340 }),
  account('c3zt8vn', 'DVOŘÁK STAVBY s.r.o.', 'PO'),
];

const received = (
  id: string,
  subject: string,
  sender: string,
  senderAddress: string,
  daysAgo: number,
  opts: {
    unread?: boolean;
    attachmentKb?: number;
    hours?: number;
    /**
     * Served by the ten-day fiction (§17/4) instead of by signing in.
     *
     * Worth having in the demo archive because it is the one delivery outcome with no counterpart
     * in ordinary mail, and the record draws it differently: never merged with the delivery row,
     * because the gap between the two IS the fiction.
     */
    fiction?: boolean;
  } = {},
): MessageEnvelope => {
  const delivered = NOW - daysAgo * DAY - (opts.hours ?? 0) * 3_600_000;
  if (opts.fiction) {
    return {
      id,
      subject,
      sender,
      senderAddress,
      recipient: null,
      recipientAddress: null,
      recipientBoxId: null,
      deliveryTime: delivered,
      // Exactly ten days later, which is what makes it fiction rather than a sign-in.
      acceptanceTime: delivered + 10 * DAY,
      state: 5, // MESSAGE_STATE.servedByFiction
      attachmentSize: opts.attachmentKb ?? 0,
      openedAt: null,
    };
  }
  return {
    id,
    subject,
    sender,
    senderAddress,
    recipient: null,
    recipientAddress: null,
    recipientBoxId: null,
    deliveryTime: delivered,
    // Accepted (logged in and read) a little after delivery, unless it is still unread: an unread
    // message is exactly one whose acceptance has not happened, which is what starts the 10-day
    // fiction running and puts it in "Vyžaduje pozornost".
    acceptanceTime: opts.unread ? null : delivered + 5 * 3_600_000,
    state: opts.unread ? 4 : MESSAGE_STATE_READ,
    attachmentSize: opts.attachmentKb ?? 0,
    openedAt: opts.unread ? null : delivered + 5 * 3_600_000,
  };
};

const sent = (
  id: string,
  subject: string,
  recipient: string,
  recipientBoxId: string,
  daysAgo: number,
  attachmentKb = 0,
): MessageEnvelope => ({
  id,
  subject,
  sender: 'Ing. Ondřej Dvořák',
  senderAddress: null,
  recipient,
  recipientAddress: null,
  recipientBoxId,
  deliveryTime: NOW - daysAgo * DAY,
  acceptanceTime: NOW - daysAgo * DAY + 2 * 3_600_000,
  state: MESSAGE_STATE_READ,
  attachmentSize: attachmentKb,
  openedAt: null,
});

/**
 * The mail itself. Senders are the offices a Czech data box actually hears from, subjects are the
 * kind of thing they actually send, and the dates are spread across months so the list shows its
 * grouping rather than one undifferentiated run.
 */
export const DEMO_RECEIVED: Readonly<Record<string, readonly MessageEnvelope[]>> = {
  k4m9xrt: [
    received(
      'd1a7f0c2',
      'Výzva k prokázání příjmů za zdaňovací období 2025',
      'Finanční úřad pro hlavní město Prahu',
      'Štěpánská 619/28, 111 21 Praha 1',
      1,
      { unread: true, attachmentKb: 284, hours: 6 },
    ),
    received(
      'd2b8e1d3',
      'Rozhodnutí o přiznání starobního důchodu',
      'Česká správa sociálního zabezpečení',
      'Křížová 25, 225 08 Praha 5',
      12,
      { attachmentKb: 1_140 },
    ),
    received(
      'd7a4b628',
      'Rozhodnutí o uložení pokuty',
      'Magistrát hlavního města Prahy',
      'Mariánské náměstí 2/2, 110 01 Praha 1',
      24,
      { fiction: true, attachmentKb: 176 },
    ),
    received(
      'd3c9f2e4',
      'Oznámení o zahájení řízení ve věci přestupku',
      'Městská část Praha 4',
      'Antala Staška 2059/80b, 140 46 Praha 4',
      31,
      { attachmentKb: 96 },
    ),
    received(
      'd4d0a3f5',
      'Sdělení k žádosti o zprostředkování zaměstnání',
      'Úřad práce České republiky',
      'Dobrovského 1278/25, 170 00 Praha 7',
      58,
    ),
    received(
      'd5e1b406',
      'Informace o změně adresy Datových schránek',
      'Informační systém datových schránek',
      'Na Vápence 14, 130 00 Praha 3',
      92,
    ),
    received(
      'd6f2c517',
      'Potvrzení o bezdlužnosti',
      'Finanční úřad pro hlavní město Prahu',
      'Štěpánská 619/28, 111 21 Praha 1',
      121,
      { attachmentKb: 212 },
    ),
  ],
  p7wq2bs: [
    received(
      'e1a3d5f7',
      'Platební výměr na daň z přidané hodnoty',
      'Finanční úřad pro hlavní město Prahu',
      'Štěpánská 619/28, 111 21 Praha 1',
      2,
      { unread: true, attachmentKb: 418, hours: 3 },
    ),
    received(
      'e2b4e608',
      'Výzva k úhradě nedoplatku pojistného',
      'Všeobecná zdravotní pojišťovna ČR',
      'Orlická 2020/4, 130 00 Praha 3',
      4,
      { unread: true, attachmentKb: 74 },
    ),
    received(
      'e3c5f719',
      'Usnesení ve věci sp. zn. 42 C 118/2026',
      'Obvodní soud pro Prahu 2',
      'Francouzská 808/19, 120 00 Praha 2',
      23,
      { attachmentKb: 656 },
    ),
    received(
      'e4d6082a',
      'Rozhodnutí o přidělení dotace',
      'Ministerstvo průmyslu a obchodu',
      'Na Františku 1039/32, 110 15 Praha 1',
      47,
      { attachmentKb: 2_310 },
    ),
    received(
      'e5e7193b',
      'Oznámení o kontrole plnění povinností',
      'Česká obchodní inspekce',
      'Štěpánská 796/44, 110 00 Praha 1',
      76,
    ),
  ],
  c3zt8vn: [
    received(
      'f1a5c7e9',
      'Kolaudační souhlas s užíváním stavby',
      'Magistrát hlavního města Prahy',
      'Mariánské náměstí 2/2, 110 01 Praha 1',
      9,
      { attachmentKb: 3_840 },
    ),
    received(
      'f2b6d8fa',
      'Výzva k odstranění nedostatků podání',
      'Krajský úřad Středočeského kraje',
      'Zborovská 81/11, 150 00 Praha 5',
      19,
      { attachmentKb: 128 },
    ),
    received(
      'f3c7e90b',
      'Sdělení o zahájení daňové kontroly',
      'Specializovaný finanční úřad',
      'nábřeží Kapitána Jaroše 1000/7, 170 00 Praha 7',
      44,
      { attachmentKb: 302 },
    ),
    received(
      'f4d8fa1c',
      'Vyrozumění o provedení zápisu do obchodního rejstříku',
      'Městský soud v Praze',
      'Slezská 2000/9, 120 00 Praha 2',
      88,
      { attachmentKb: 540 },
    ),
  ],
};

export const DEMO_SENT: Readonly<Record<string, readonly MessageEnvelope[]>> = {
  p7wq2bs: [
    sent('s1a9b2c3', 'Odpověď na výzvu č. j. 4821/26/2001-52523', 'Finanční úřad pro hlavní město Prahu', 'wx8aq3f', 3, 640),
    sent('s2b0c3d4', 'Doplnění podání ve věci sp. zn. 42 C 118/2026', 'Obvodní soud pro Prahu 2', 'ry2mk7d', 21, 1_280),
  ],
  c3zt8vn: [
    sent('s3c1d4e5', 'Žádost o vydání kolaudačního souhlasu', 'Magistrát hlavního města Prahy', 'ab4cd5e', 14, 4_210),
  ],
};

/**
 * How many of the envelopes get their documents written to disk as real files.
 *
 * Enough to walk Tier 2 of the backup against something (006 T021-T024), which cannot be walked at
 * all on a device holding no downloaded documents - and not so many that seeding takes a minute. The
 * newest few per box, which is also what a real archive looks like: recent mail is opened, old mail
 * mostly is not.
 */
const DEMO_DOWNLOADED_PER_BOX = 3;

/**
 * A minimal but genuinely valid PDF of about `kb` kilobytes, as base64.
 *
 * ASCII ONLY, and that is not a style choice: `btoa` throws `InvalidCharacterError` on any character
 * above U+00FF, so the first version - which put the message SUBJECT in the header - died on the
 * first Czech ž and took the whole seed with it, silently, because `App.tsx` starts it with `void`.
 * The label is therefore the message id, which is generated and ASCII by construction.
 */
function demoPdf(kb: number, label: string): string {
  // A real header and trailer, because the app runs a PDF text scan over attachments and a file that
  // is not a PDF at all would exercise the failure path rather than the one being walked. The bulk
  // is a comment stream: valid, ignorable, and exactly as compressible as this needs to be (which is
  // to say the sealed size is what the arithmetic predicts either way).
  const head = `%PDF-1.4\n% ${label}\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n`;
  const tail = '\ntrailer<</Root 1 0 R>>\n%%EOF\n';
  const target = Math.max(1, kb) * 1024;
  const filler: string[] = [];
  let size = head.length + tail.length;
  let n = 0;
  while (size < target) {
    const line = `% ${n} demonstracni priloha, nejde o skutecnou pisemnost\n`;
    filler.push(line);
    size += line.length;
    n += 1;
  }
  return btoa(head + filler.join('') + tail);
}

/**
 * Write the fictional archive.
 *
 * Refuses on a device that already has a box, because the alternative is quietly mixing invented
 * mail into somebody's real one. Returns false when it declined, so a caller can say so.
 */
export async function seedDemoArchive(): Promise<boolean> {
  if (!__DEV__) {
    return false;
  }
  const accounts = new SqliteAccountsStore();
  const messages = new SqliteMessagesStore();

  const existing = await accounts.list();
  if (existing.length > 0) {
    return false;
  }

  for (const acc of DEMO_ACCOUNTS) {
    await accounts.add(acc);
  }
  await accounts.setActive(DEMO_ACCOUNTS[0].boxId);

  // COUNTED, never typed in. These were hand-written numbers and one of them was wrong the moment a
  // message was added: the box showed a badge of 1 beside an attention group of 2, because a
  // fiction-served message is `state` 5 and `isUnread` is `state < 7`, so it is unread too. In the
  // real app `recordSync` counts exactly this way over the same list, so deriving it here is not a
  // shortcut - it is the demo agreeing with production instead of guessing at it.
  for (const [boxId, envelopes] of Object.entries(DEMO_RECEIVED)) {
    await accounts.setSyncResult(
      boxId,
      NOW - 4 * 60_000,
      envelopes.length,
      envelopes.reduce((n, m) => n + (isUnread(m.state) ? 1 : 0), 0),
    );
  }

  for (const [boxId, envelopes] of Object.entries(DEMO_RECEIVED)) {
    await messages.cacheList(boxId, 'received', [...envelopes], NOW - 4 * 60_000);
  }
  for (const [boxId, envelopes] of Object.entries(DEMO_SENT)) {
    await messages.cacheList(boxId, 'sent', [...envelopes], NOW - 4 * 60_000);
  }

  // Documents on disk for the newest few per box. Written through `attachmentFileStore.persist`,
  // the same call a real download makes, so the files land exactly where the app expects them and
  // `detailJson` gets the same `localPath` shape - which is what Tier 2 of the backup reads.
  for (const [boxId, envelopes] of Object.entries(DEMO_RECEIVED)) {
    const withFiles = envelopes
      .filter(e => (e.attachmentSize ?? 0) > 0)
      .slice(0, DEMO_DOWNLOADED_PER_BOX);
    for (const envelope of withFiles) {
      const attachments: MessageAttachment[] = [
        {
          name: `${envelope.id}-pisemnost.pdf`,
          mimeType: 'application/pdf',
          metaType: 'main',
          contentBase64: demoPdf(envelope.attachmentSize ?? 1, envelope.id),
        },
      ];
      const detail: MessageDetail = {
        id: envelope.id,
        subject: envelope.subject,
        sender: envelope.sender,
        senderAddress: envelope.senderAddress,
        recipient: envelope.recipient,
        recipientAddress: envelope.recipientAddress,
        deliveryTime: envelope.deliveryTime,
        acceptanceTime: envelope.acceptanceTime,
        attachments: await attachmentFileStore.persist(
          boxId,
          envelope.id,
          attachments,
        ),
      };
      await messages.cacheDetail(boxId, detail, NOW - 4 * 60_000);
    }
  }
  return true;
}
