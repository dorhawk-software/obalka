// Date-grouping for the message list (the mail-app pattern): bucket the newest-first messages into
// Dnes / Včera / Tento týden / Tento měsíc, then by month ("Květen 2026") for everything older - so
// even a years-long box stays scannable by time. Pure (takes `now`) so it's unit-testable; preserves
// order and omits empty buckets. Localisation of the labels lives in the screen (sectionTitle).

import type { MessageEnvelope } from '../../../services/isds/types';

export type DateSectionLabel =
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'thisWeek' }
  | { kind: 'thisMonth' }
  | { kind: 'month'; year: number; month: number }; // month: 0–11

export interface MessageDateSection {
  /** Stable id for SectionList + React keys. */
  key: string;
  label: DateSectionLabel;
  data: MessageEnvelope[];
}

const DAY_MS = 86_400_000;

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Compact row date that pairs with the date grouping: today → time (14:32), earlier this year →
 * day.month (15.06.), older → full date (15.06.2024). So a row never repeats the year its section
 * header already implies. Pure (takes `now`).
 */
export function rowDate(epochMs: number | null, now: number): string {
  if (epochMs == null) {
    return '';
  }
  const d = new Date(epochMs);
  const n = new Date(now);
  const sameDay =
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate();
  if (sameDay) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  if (d.getFullYear() === n.getFullYear()) {
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`;
  }
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function groupByDate(
  messages: MessageEnvelope[],
  now: number,
): MessageDateSection[] {
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - DAY_MS;
  // Monday-start week (Czech weeks start Monday): days since Monday = (getDay()+6) % 7.
  const dow = new Date(todayStart).getDay(); // 0=Sun … 6=Sat
  const weekStart = todayStart - ((dow + 6) % 7) * DAY_MS;
  const monthStartD = new Date(now);
  monthStartD.setDate(1);
  monthStartD.setHours(0, 0, 0, 0);
  const monthStart = monthStartD.getTime();

  const sectionOf = (ts: number): { key: string; label: DateSectionLabel } => {
    if (ts >= todayStart) {
      return { key: 'today', label: { kind: 'today' } };
    }
    if (ts >= yesterdayStart) {
      return { key: 'yesterday', label: { kind: 'yesterday' } };
    }
    if (ts >= weekStart) {
      return { key: 'thisWeek', label: { kind: 'thisWeek' } };
    }
    if (ts >= monthStart) {
      return { key: 'thisMonth', label: { kind: 'thisMonth' } };
    }
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = d.getMonth();
    return { key: `m-${year}-${month}`, label: { kind: 'month', year, month } };
  };

  const sections: MessageDateSection[] = [];
  for (const m of messages) {
    const { key, label } = sectionOf(m.deliveryTime ?? 0);
    const last = sections[sections.length - 1];
    // Messages are newest-first, so same-section items are contiguous - just extend the last section.
    if (last && last.key === key) {
      last.data.push(m);
    } else {
      sections.push({ key, label, data: [m] });
    }
  }
  return sections;
}

/**
 * Older than any sync this app can have made: it did not exist before 2020.
 *
 * A stamp below it is a placeholder that reached the freshness line - 0, or the 1 that restores wrote
 * until 2026-09-24 and that archives restored before then still hold - and it read
 * "Aktualizováno 01.01.1970". Refused here, where every caller passes through, rather than only where
 * the one known writer was.
 */
const EARLIEST_PLAUSIBLE_SYNC = new Date(2020, 0, 1).getTime();

/**
 * How fresh the list is, in words - "právě teď", "před 5 min", "v 14:32", "13.06.".
 *
 * Returns only the TIME part; the screen supplies "Aktualizováno …" around it. Pure, so the wording
 * is testable without a device, and it deliberately gets coarser as it ages: a minute-accurate
 * timestamp from four days ago is false precision.
 *
 * This exists because the store has always computed `syncedAt`, every caller dropped it, and the
 * screen therefore could not answer "how old is this?" - which after feature 014 removed background
 * sync is the first-order question, since freshness is now entirely a consequence of what the user
 * did (2026-09-09 critique).
 */
export function freshnessLabel(syncedAt: number | null, now: number): string | null {
  if (
    syncedAt == null ||
    !Number.isFinite(syncedAt) ||
    syncedAt < EARLIEST_PLAUSIBLE_SYNC ||
    syncedAt > now + 60_000
  ) {
    // Never synced, a placeholder, or a clock that disagrees - say nothing rather than something wrong.
    return null;
  }
  const mins = Math.floor((now - syncedAt) / 60_000);
  if (mins < 1) {
    return 'now';
  }
  if (mins < 60) {
    return `min:${mins}`;
  }
  if (startOfDay(syncedAt) === startOfDay(now)) {
    const d = new Date(syncedAt);
    return `at:${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  return `on:${rowDate(syncedAt, now)}`;
}
