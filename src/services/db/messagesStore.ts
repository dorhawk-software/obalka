// Offline archive of received messages (feature 004). The synced envelope list is cached so it is
// viewable offline; a downloaded message's full detail (incl. attachment content) is cached so that
// message + its attachments are available offline. Pure data layer - unit-tested with the in-memory
// impl; the device uses SQLite via the shared encrypted DB.

import { getDb } from './database';
import {
  MESSAGE_STATE_READ,
  type MessageAttachment,
  type MessageDetail,
  type MessageEnvelope,
} from '../isds/types';
import { reportFailure } from '../telemetry/telemetry';

/**
 * `attachmentSize` in KILOBYTES - the same unit ISDS puts in `dmAttachmentSize` on a list envelope
 * (and its "has attachments" indicator: non-zero ⇒ there are attachments). ISDS only reports it on a
 * LIST envelope, so when we synthesize an envelope from a downloaded detail we recompute it from the
 * persisted file sizes rather than writing a file COUNT into a kilobyte column (which is what this
 * used to do - the same field then meant two different things depending on how the row was created).
 * Returns null when the sizes aren't known yet, because a wrong number is worse than an absent one.
 */
function attachmentSizeKb(attachments: MessageAttachment[]): number | null {
  if (attachments.length === 0) {
    return 0;
  }
  let bytes = 0;
  for (const a of attachments) {
    if (a.size == null) {
      return null; // not persisted to disk yet → unknown, don't fabricate
    }
    bytes += a.size;
  }
  // Round UP to 1 kB so a sub-kilobyte attachment still trips the non-zero "has attachments" test.
  return Math.max(1, Math.round(bytes / 1024));
}

export interface CachedList {
  /** Cached envelopes, newest first. */
  envelopes: MessageEnvelope[];
  /** messageIds whose full detail is cached (downloaded → available offline). */
  downloaded: string[];
  /** When this folder was last successfully synced (epoch ms), or null = never. Lets the offline view
   *  show "Aktualizováno před …" from the cache instead of a blank/inconsistent status line. */
  syncedAt: number | null;
}

/** A search hit: which box the message is in + its envelope. */
/** What the merged inbox needs: the hits, plus the same two facts `getList` returns per box. */
export interface MergedList {
  hits: MessageSearchHit[];
  /** Message ids whose full detail is already cached - drives the "downloaded" mark on a row. */
  downloaded: string[];
  /** The newest sync stamp across every box, for the freshness line. */
  syncedAt: number | null;
}

/** A message without its attachments on this phone (`listUndownloaded`). */
export interface UndownloadedMessage {
  folder: MessageFolder;
  envelope: MessageEnvelope;
  /**
   * When a listing first brought it onto this phone, or null for a row from before 026, a restore or
   * a phone transfer (026 FR-004).
   */
  firstSeenAt: number | null;
}

export interface MessageSearchHit {
  boxId: string;
  /** Which folder the hit came from - the UI needs it to gate the received-only unread treatment. */
  folder: MessageFolder;
  envelope: MessageEnvelope;
}

// U+0300–U+036F (combining diacritical marks), built from an ASCII string to avoid invisible chars.
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Lower-case + strip diacritics so search is case- and accent-insensitive (Czech: "uradu"≈"úřadu"). */
export function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(DIACRITICS, '') // strip combining diacritical marks
    .toLowerCase()
    .trim();
}

/** The normalized searchable text for an envelope (subject + parties + addresses). */
export function envelopeSearchText(e: MessageEnvelope): string {
  return normalizeSearch(
    [e.subject, e.sender, e.recipient, e.senderAddress, e.recipientAddress]
      .filter(Boolean)
      .join(' '),
  );
}

/**
 * The `syncedAt` of a row no sync on this phone has seen - a restored one (2026-09-24).
 *
 * 0 rather than null because the SQLite column is NOT NULL. Every reader already treats it as "never":
 * the newest-stamp reducers only take a value above 0, and `freshnessLabel` refuses anything that
 * old. `cacheList` keeps the later of this and a row's existing stamp, so it never erases a real one.
 */
export const NEVER_SYNCED = 0;

/** Which ISDS list a cached message came from (008): the received inbox or the sent folder. */
export type MessageFolder = 'received' | 'sent';

/** How many search hits the UI will show. One more than this is fetched, to detect truncation. */
export const SEARCH_LIMIT = 100;

export interface MessagesStore {
  /**
   * Upsert the synced envelopes for a box + folder (preserves any already-cached detail).
   *
   * A row's `syncedAt` only moves forward: an existing row keeps the later of its stamp and this one.
   * A sync always writes "now", so for a sync that changes nothing; it is what lets a restore write
   * `NEVER_SYNCED` into rows this phone did sync without taking their sync time away.
   */
  cacheList(
    boxId: string,
    folder: MessageFolder,
    envelopes: MessageEnvelope[],
    syncedAt: number,
  ): Promise<void>;
  /** The cached envelopes for a box + folder (newest first) + which are downloaded. */
  getList(boxId: string, folder: MessageFolder): Promise<CachedList>;
  /** A single cached envelope (the detail view renders from this, no download needed). */
  getEnvelope(
    boxId: string,
    messageId: string,
  ): Promise<MessageEnvelope | null>;
  /** Store a downloaded message's full detail (incl. attachment content) for offline use. */
  cacheDetail(
    boxId: string,
    detail: MessageDetail,
    downloadedAt: number,
  ): Promise<void>;
  /**
   * Cache a just-SENT message: its `sent`-folder envelope + full detail, including the attachments we
   * uploaded, so opening it shows them with NO re-download. A later sent-list sync upserts the
   * envelope fields (correcting state/times) but preserves this detail - `cacheList` never touches
   * `detailJson`.
   */
  recordSent(
    boxId: string,
    envelope: MessageEnvelope,
    detail: MessageDetail,
    at: number,
  ): Promise<void>;
  /** The cached detail for a message, or null if it has not been downloaded. */
  getDetail(boxId: string, messageId: string): Promise<MessageDetail | null>;
  /** Mark a cached message read (state → PŘEČTENO) so the list drops its unread treatment. No-op if absent. */
  markRead(boxId: string, messageId: string): Promise<void>;
  /**
   * Record that the user opened this message on THIS device.
   *
   * Separate from `markRead`, deliberately. `markRead` writes the server's truth and only runs once
   * ISDS has confirmed it; this writes a local fact that needs nobody's permission. It is what lets
   * reading offline quiet the attention group, without the app ever asserting a delivery state it
   * has not been told.
   */
  markOpenedLocally(boxId: string, messageId: string, at: number): Promise<void>;
  /** Search cached messages across ALL boxes (envelope text, accent/case-insensitive), newest first. */
  /**
   * Substring search across the archive, newest first.
   *
   * Returns AT MOST `SEARCH_LIMIT + 1` hits. The extra one is a signal, not a result: the screen
   * showed "100 výsledků" as a fact while silently dropping everything past the cap, under a hint
   * promising it had searched the whole archive.
   */
  search(query: string): Promise<MessageSearchHit[]>;

  /**
   * Every box's messages in one list, newest first (024 cycle 2, the merged inbox).
   *
   * The query-less sibling of `search`, returning the same per-hit shape for the same reason - a row
   * in a merged list is meaningless without the box it came from - plus the two things `getList`
   * gives a per-box inbox, so the merged view can render through exactly the same pipeline instead
   * of a parallel one. Capped: a merged archive is the largest list this app can produce.
   */
  listAcrossBoxes(folder: MessageFolder, limit: number): Promise<MergedList>;
  /**
   * A box's messages whose detail - and so whose attachments - this phone does not hold, both folders,
   * newest first (026). What automatic download and a backup that fetches every attachment work
   * through; everything else about whether to ask ISDS for one is theirs to decide.
   */
  listUndownloaded(boxId: string): Promise<UndownloadedMessage[]>;
  /** Drop a box's cached messages (when the box is removed). */
  clearBox(boxId: string): Promise<void>;
}

// ---- In-memory (tests / reference) -----------------------------------------

interface Row {
  envelope: MessageEnvelope;
  detail: MessageDetail | null;
  /** received | sent - so a box's two folders don't interleave (008). */
  folder: MessageFolder;
  /** When this row's folder was last synced (epoch ms), or null. */
  syncedAt: number | null;
  /** When a listing first inserted it (026), or null. */
  firstSeenAt?: number | null;
}

export class InMemoryMessagesStore implements MessagesStore {
  private boxes = new Map<string, Map<string, Row>>();

  private box(boxId: string): Map<string, Row> {
    let m = this.boxes.get(boxId);
    if (!m) {
      m = new Map();
      this.boxes.set(boxId, m);
    }
    return m;
  }

  async cacheList(
    boxId: string,
    folder: MessageFolder,
    envelopes: MessageEnvelope[],
    syncedAt?: number,
  ): Promise<void> {
    const m = this.box(boxId);
    for (const env of envelopes) {
      const existing = m.get(env.id);
      const stamps = [existing?.syncedAt, syncedAt].filter(
        (v): v is number => v != null,
      );
      m.set(env.id, {
        envelope: env,
        detail: existing?.detail ?? null,
        folder,
        syncedAt: stamps.length > 0 ? Math.max(...stamps) : null,
        // Once, on the insert - as the SQLite store does.
        firstSeenAt: existing ? existing.firstSeenAt ?? null : syncedAt ?? null,
      });
    }
  }

  async getList(boxId: string, folder: MessageFolder): Promise<CachedList> {
    const rows = [...this.box(boxId).values()].filter(r => r.folder === folder);
    const envelopes = rows
      .map(r => r.envelope)
      .sort((a, b) => (b.deliveryTime ?? 0) - (a.deliveryTime ?? 0));
    const downloaded = rows
      .filter(r => r.detail != null)
      .map(r => r.envelope.id);
    const syncedAt = rows.reduce<number | null>(
      (max, r) =>
        r.syncedAt != null && r.syncedAt > (max ?? 0) ? r.syncedAt : max,
      null,
    );
    return { envelopes, downloaded, syncedAt };
  }

  async cacheDetail(boxId: string, detail: MessageDetail): Promise<void> {
    const m = this.box(boxId);
    const existing = m.get(detail.id);
    if (existing) {
      existing.detail = detail;
    } else {
      // The message wasn't in the list cache; keep the detail anyway (envelope synthesized lazily).
      m.set(detail.id, {
        envelope: {
          id: detail.id,
          subject: detail.subject,
          sender: detail.sender,
          senderAddress: detail.senderAddress,
          recipient: detail.recipient,
          recipientAddress: detail.recipientAddress,
          recipientBoxId: null,
          deliveryTime: detail.deliveryTime,
          acceptanceTime: detail.acceptanceTime,
          state: 0,
          attachmentSize: attachmentSizeKb(detail.attachments),
        },
        detail,
        // A detail fetched without a list sync is a received message (only received are downloaded).
        folder: 'received',
        syncedAt: null,
      });
    }
  }

  async recordSent(
    boxId: string,
    envelope: MessageEnvelope,
    detail: MessageDetail,
    at: number,
  ): Promise<void> {
    this.box(boxId).set(envelope.id, {
      envelope,
      detail,
      folder: 'sent',
      syncedAt: at,
    });
  }

  async getDetail(
    boxId: string,
    messageId: string,
  ): Promise<MessageDetail | null> {
    return this.box(boxId).get(messageId)?.detail ?? null;
  }

  async getEnvelope(
    boxId: string,
    messageId: string,
  ): Promise<MessageEnvelope | null> {
    return this.box(boxId).get(messageId)?.envelope ?? null;
  }

  async markRead(boxId: string, messageId: string): Promise<void> {
    const row = this.box(boxId).get(messageId);
    if (row) {
      row.envelope = { ...row.envelope, state: MESSAGE_STATE_READ };
    }
  }

  async markOpenedLocally(
    boxId: string,
    messageId: string,
    at: number,
  ): Promise<void> {
    const row = this.box(boxId).get(messageId);
    if (row) {
      row.envelope = { ...row.envelope, openedAt: at };
    }
  }

  async search(query: string): Promise<MessageSearchHit[]> {
    const q = normalizeSearch(query);
    if (!q) {
      return [];
    }
    const hits: MessageSearchHit[] = [];
    for (const [boxId, rows] of this.boxes) {
      for (const row of rows.values()) {
        if (envelopeSearchText(row.envelope).includes(q)) {
          hits.push({ boxId, folder: row.folder, envelope: row.envelope });
        }
      }
    }
    // Same cap as the SQLite store, so tests see the same truncation the app does.
    return hits
      .sort((a, b) => (b.envelope.deliveryTime ?? 0) - (a.envelope.deliveryTime ?? 0))
      .slice(0, SEARCH_LIMIT + 1);
  }

  async listAcrossBoxes(
    folder: MessageFolder,
    limit: number,
  ): Promise<MergedList> {
    const hits: MessageSearchHit[] = [];
    const downloaded: string[] = [];
    let syncedAt: number | null = null;
    for (const [boxId, rows] of this.boxes) {
      for (const row of rows.values()) {
        if (row.folder !== folder) {
          continue;
        }
        hits.push({ boxId, folder: row.folder, envelope: row.envelope });
        if (row.detail != null) {
          downloaded.push(row.envelope.id);
        }
        if (row.syncedAt != null && row.syncedAt > (syncedAt ?? 0)) {
          syncedAt = row.syncedAt;
        }
      }
    }
    hits.sort(
      (a, b) => (b.envelope.deliveryTime ?? 0) - (a.envelope.deliveryTime ?? 0),
    );
    return { hits: hits.slice(0, limit), downloaded, syncedAt };
  }

  async listUndownloaded(boxId: string): Promise<UndownloadedMessage[]> {
    return [...this.box(boxId).values()]
      .filter(r => r.detail == null)
      .sort((a, b) => (b.envelope.deliveryTime ?? 0) - (a.envelope.deliveryTime ?? 0))
      .map(r => ({ folder: r.folder, envelope: r.envelope, firstSeenAt: r.firstSeenAt ?? null }));
  }

  async clearBox(boxId: string): Promise<void> {
    this.boxes.delete(boxId);
  }
}

// ---- SQLite (device) -------------------------------------------------------

const num = (v: unknown): number | null => (v == null ? null : Number(v));
const str = (v: unknown): string | null => (v == null ? null : String(v));

function rowToEnvelope(r: Record<string, unknown>): MessageEnvelope {
  return {
    id: String(r.messageId),
    subject: str(r.subject) ?? '',
    sender: str(r.sender) ?? '',
    senderAddress: str(r.senderAddress),
    recipient: str(r.recipient),
    recipientAddress: str(r.recipientAddress),
    recipientBoxId: str(r.recipientBoxId),
    deliveryTime: num(r.deliveryTime),
    acceptanceTime: num(r.acceptanceTime),
    state: r.state == null ? 0 : Number(r.state),
    attachmentSize: num(r.attachmentSize),
    openedAt: num(r.openedAt),
  };
}

export class SqliteMessagesStore implements MessagesStore {
  async cacheList(
    boxId: string,
    folder: MessageFolder,
    envelopes: MessageEnvelope[],
    syncedAt: number,
  ): Promise<void> {
    const db = await getDb();
    for (const e of envelopes) {
      // Upsert envelope fields; detailJson / downloadedAt are deliberately NOT touched (preserved).
      await db.execute(
        // `firstSeenAt` only on the insert: the conflict branch below leaves it alone (026 FR-004).
        `INSERT INTO messages
           (boxId, messageId, folder, subject, sender, senderAddress, recipient, recipientAddress, deliveryTime, acceptanceTime, state, attachmentSize, searchText, syncedAt, firstSeenAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(boxId, messageId) DO UPDATE SET
           folder = excluded.folder,
           subject = excluded.subject, sender = excluded.sender, senderAddress = excluded.senderAddress,
           recipient = excluded.recipient, recipientAddress = excluded.recipientAddress,
           deliveryTime = excluded.deliveryTime, acceptanceTime = excluded.acceptanceTime,
           state = excluded.state, attachmentSize = excluded.attachmentSize,
           searchText = excluded.searchText, syncedAt = MAX(syncedAt, excluded.syncedAt)`,
        [
          boxId,
          e.id,
          folder,
          e.subject,
          e.sender,
          e.senderAddress,
          e.recipient,
          e.recipientAddress,
          e.deliveryTime,
          e.acceptanceTime,
          e.state,
          e.attachmentSize,
          envelopeSearchText(e),
          syncedAt,
          syncedAt,
        ],
      );
    }
  }

  async getList(boxId: string, folder: MessageFolder): Promise<CachedList> {
    const db = await getDb();
    // Legacy rows (pre-008) have NULL folder → treat as 'received'.
    const res = await db.execute(
      "SELECT * FROM messages WHERE boxId = ? AND COALESCE(folder, 'received') = ? ORDER BY deliveryTime DESC",
      [boxId, folder],
    );
    const envelopes = res.rows.map(rowToEnvelope);
    const downloaded = res.rows
      .filter(r => r.detailJson != null)
      .map(r => String(r.messageId));
    const syncedAt = res.rows.reduce<number | null>((max, r) => {
      const v = Number(r.syncedAt);
      return Number.isFinite(v) && v > (max ?? 0) ? v : max;
    }, null);
    return { envelopes, downloaded, syncedAt };
  }

  async cacheDetail(
    boxId: string,
    detail: MessageDetail,
    downloadedAt: number,
  ): Promise<void> {
    const db = await getDb();
    const json = JSON.stringify(detail);
    const upd = await db.execute(
      'UPDATE messages SET detailJson = ?, downloadedAt = ? WHERE boxId = ? AND messageId = ?',
      [json, downloadedAt, boxId, detail.id],
    );
    if (!upd.rowsAffected) {
      // No envelope row yet (detail fetched without a list sync) - insert a self-sufficient row.
      // A downloaded detail is a received message, so folder='received'.
      await db.execute(
        `INSERT OR REPLACE INTO messages
           (boxId, messageId, folder, subject, sender, senderAddress, recipient, recipientAddress, deliveryTime, acceptanceTime, state, attachmentSize, detailJson, downloadedAt, syncedAt)
         VALUES (?, ?, 'received', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          boxId,
          detail.id,
          detail.subject,
          detail.sender,
          detail.senderAddress,
          detail.recipient,
          detail.recipientAddress,
          detail.deliveryTime,
          detail.acceptanceTime,
          0,
          detail.attachments.length,
          json,
          downloadedAt,
          downloadedAt,
        ],
      );
    }
  }

  async recordSent(
    boxId: string,
    envelope: MessageEnvelope,
    detail: MessageDetail,
    at: number,
  ): Promise<void> {
    const db = await getDb();
    const json = JSON.stringify(detail);
    // Insert the sent envelope + detail together. If a row somehow exists already, keep its (freshly
    // synced) envelope fields and just attach our detail - the point is only to carry the attachments.
    await db.execute(
      `INSERT INTO messages
         (boxId, messageId, folder, subject, sender, senderAddress, recipient, recipientAddress, deliveryTime, acceptanceTime, state, attachmentSize, searchText, detailJson, downloadedAt, syncedAt)
       VALUES (?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(boxId, messageId) DO UPDATE SET
         detailJson = excluded.detailJson, downloadedAt = excluded.downloadedAt`,
      [
        boxId,
        envelope.id,
        envelope.subject,
        envelope.sender,
        envelope.senderAddress,
        envelope.recipient,
        envelope.recipientAddress,
        envelope.deliveryTime,
        envelope.acceptanceTime,
        envelope.state,
        envelope.attachmentSize,
        envelopeSearchText(envelope),
        json,
        at,
        at,
      ],
    );
  }

  async getEnvelope(
    boxId: string,
    messageId: string,
  ): Promise<MessageEnvelope | null> {
    const db = await getDb();
    const res = await db.execute(
      'SELECT * FROM messages WHERE boxId = ? AND messageId = ? LIMIT 1',
      [boxId, messageId],
    );
    return res.rows[0] ? rowToEnvelope(res.rows[0]) : null;
  }

  async getDetail(
    boxId: string,
    messageId: string,
  ): Promise<MessageDetail | null> {
    const db = await getDb();
    const res = await db.execute(
      'SELECT detailJson FROM messages WHERE boxId = ? AND messageId = ?',
      [boxId, messageId],
    );
    const json = res.rows[0]?.detailJson;
    if (json == null) {
      return null;
    }
    try {
      return JSON.parse(String(json)) as MessageDetail;
    } catch (e) {
      // Principle IV: the archive is sacred. A cached detail that will not parse is a message the
      // user believes they still have, and re-downloading it is not always possible - ISDS keeps a
      // message for 90 days.
      reportFailure('db.read', e, { stage: 'parse' });
      return null;
    }
  }

  async markRead(boxId: string, messageId: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      'UPDATE messages SET state = ? WHERE boxId = ? AND messageId = ?',
      [MESSAGE_STATE_READ, boxId, messageId],
    );
  }

  async markOpenedLocally(
    boxId: string,
    messageId: string,
    at: number,
  ): Promise<void> {
    const db = await getDb();
    await db.execute(
      'UPDATE messages SET openedAt = ? WHERE boxId = ? AND messageId = ? AND openedAt IS NULL',
      [at, boxId, messageId],
    );
  }

  async search(query: string): Promise<MessageSearchHit[]> {
    const q = normalizeSearch(query);
    if (!q) {
      return [];
    }
    const db = await getDb();
    // Substring match on the normalized column; `\` escapes LIKE's % and _ so a typed % isn't a wildcard.
    const pattern = `%${q.replace(/[\\%_]/g, c => '\\' + c)}%`;
    const res = await db.execute(
      // One MORE than the cap, deliberately: the extra row is how the screen knows there were more
      // results than it is showing, instead of stating a capped number as a fact.
      `SELECT * FROM messages WHERE searchText LIKE ? ESCAPE '\\' ORDER BY deliveryTime DESC LIMIT ${SEARCH_LIMIT + 1}`,
      [pattern],
    );
    return res.rows.map(r => ({
      boxId: String(r.boxId),
      folder: str(r.folder) === 'sent' ? 'sent' : 'received',
      envelope: rowToEnvelope(r),
    }));
  }

  async listAcrossBoxes(
    folder: MessageFolder,
    limit: number,
  ): Promise<MergedList> {
    const db = await getDb();
    // No boxId predicate, and the same COALESCE as `getList` for pre-008 rows whose folder is NULL.
    // `deliveryTime DESC` is the whole point of the merged view: chronology across every box is the
    // one ordering the per-box lists cannot give you.
    const res = await db.execute(
      `SELECT * FROM messages WHERE COALESCE(folder, 'received') = ? ORDER BY deliveryTime DESC LIMIT ${Math.max(
        1,
        Math.floor(limit),
      )}`,
      [folder],
    );
    return {
      hits: res.rows.map(r => ({
        boxId: String(r.boxId),
        folder: str(r.folder) === 'sent' ? 'sent' : ('received' as MessageFolder),
        envelope: rowToEnvelope(r),
      })),
      downloaded: res.rows
        .filter(r => r.detailJson != null)
        .map(r => String(r.messageId)),
      syncedAt: res.rows.reduce<number | null>((max, r) => {
        const v = Number(r.syncedAt);
        return Number.isFinite(v) && v > (max ?? 0) ? v : max;
      }, null),
    };
  }

  async listUndownloaded(boxId: string): Promise<UndownloadedMessage[]> {
    const db = await getDb();
    const res = await db.execute(
      'SELECT * FROM messages WHERE boxId = ? AND detailJson IS NULL ORDER BY deliveryTime DESC',
      [boxId],
    );
    return res.rows.map(r => ({
      folder: str(r.folder) === 'sent' ? 'sent' : ('received' as MessageFolder),
      envelope: rowToEnvelope(r),
      firstSeenAt: num(r.firstSeenAt),
    }));
  }

  async clearBox(boxId: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM messages WHERE boxId = ?', [boxId]);
  }
}
