// Compose drafts (feature 005). A saved-but-unsent message: the chosen recipient + subject + the typed
// message body, so a half-written message survives leaving the screen / an app restart. Attachments are
// NOT persisted in v1 - they're re-added on resume (large base64 blobs don't belong in the DB). Pure
// data layer - unit-tested with the in-memory impl; the device uses SQLite via the shared encrypted DB.

import { getDb } from './database';
import type { RecipientDbType } from '../isds/types';

export interface DraftRecord {
  id: string;
  boxId: string;
  recipientBoxId: string | null;
  recipientLabel: string | null;
  /** The picked recipient's address, so reopening a draft does not silently lose it (015). */
  recipientAddress: string | null;
  recipientDbType: RecipientDbType | null;
  subject: string;
  /** The typed message body (becomes "Textová zpráva.pdf" on send). Empty if none. */
  body: string;
  updatedAt: number;
}

export interface DraftsStore {
  /** Upsert a draft (by id). */
  save(draft: DraftRecord): Promise<void>;
  /** A box's drafts, newest first. */
  list(boxId: string): Promise<DraftRecord[]>;
  /** A single draft, or null. */
  get(id: string): Promise<DraftRecord | null>;
  /** Delete a draft. */
  remove(id: string): Promise<void>;
  /** Drop a box's drafts (when the box is removed). */
  clearBox(boxId: string): Promise<void>;
}

// ---- In-memory (tests / reference) -----------------------------------------

export class InMemoryDraftsStore implements DraftsStore {
  private drafts = new Map<string, DraftRecord>();

  async save(draft: DraftRecord): Promise<void> {
    this.drafts.set(draft.id, { ...draft });
  }

  async list(boxId: string): Promise<DraftRecord[]> {
    return [...this.drafts.values()]
      .filter(d => d.boxId === boxId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<DraftRecord | null> {
    const d = this.drafts.get(id);
    return d ? { ...d } : null;
  }

  async remove(id: string): Promise<void> {
    this.drafts.delete(id);
  }

  async clearBox(boxId: string): Promise<void> {
    for (const [id, d] of this.drafts) {
      if (d.boxId === boxId) {
        this.drafts.delete(id);
      }
    }
  }
}

// ---- SQLite (device) -------------------------------------------------------

const str = (v: unknown): string | null => (v == null ? null : String(v));

function rowToDraft(r: Record<string, unknown>): DraftRecord {
  return {
    id: String(r.id),
    boxId: String(r.boxId),
    recipientBoxId: str(r.recipientBoxId),
    recipientLabel: str(r.recipientLabel),
    recipientAddress: str(r.recipientAddress),
    recipientDbType: str(r.recipientDbType) as RecipientDbType | null,
    subject: str(r.subject) ?? '',
    body: str(r.body) ?? '',
    updatedAt: r.updatedAt == null ? 0 : Number(r.updatedAt),
  };
}

export class SqliteDraftsStore implements DraftsStore {
  async save(draft: DraftRecord): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO drafts (id, boxId, recipientBoxId, recipientLabel, recipientAddress, recipientDbType, subject, body, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         recipientBoxId = excluded.recipientBoxId, recipientLabel = excluded.recipientLabel,
         recipientAddress = excluded.recipientAddress,
         recipientDbType = excluded.recipientDbType, subject = excluded.subject,
         body = excluded.body, updatedAt = excluded.updatedAt`,
      [
        draft.id,
        draft.boxId,
        draft.recipientBoxId,
        draft.recipientLabel,
        draft.recipientAddress,
        draft.recipientDbType,
        draft.subject,
        draft.body,
        draft.updatedAt,
      ],
    );
  }

  async list(boxId: string): Promise<DraftRecord[]> {
    const db = await getDb();
    const res = await db.execute(
      'SELECT * FROM drafts WHERE boxId = ? ORDER BY updatedAt DESC',
      [boxId],
    );
    return res.rows.map(rowToDraft);
  }

  async get(id: string): Promise<DraftRecord | null> {
    const db = await getDb();
    const res = await db.execute('SELECT * FROM drafts WHERE id = ? LIMIT 1', [
      id,
    ]);
    return res.rows[0] ? rowToDraft(res.rows[0]) : null;
  }

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM drafts WHERE id = ?', [id]);
  }

  async clearBox(boxId: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM drafts WHERE boxId = ?', [boxId]);
  }
}
