import { freshnessLabel, groupByDate, rowDate } from '../../src/features/messages/state/groupByDate';
import type { MessageEnvelope } from '../../src/services/isds/types';

function msg(id: string, deliveryTime: number | null): MessageEnvelope {
  return {
    id,
    subject: '',
    sender: '',
    senderAddress: null,
    recipient: null,
    recipientAddress: null,
    recipientBoxId: null,
    deliveryTime,
    acceptanceTime: null,
    state: 0,
    attachmentSize: null,
  };
}

// Fixed "now" = Wednesday 17 June 2026, 12:00 local (month is 0-indexed → 5). Week starts Monday 15.
const NOW = new Date(2026, 5, 17, 12, 0, 0).getTime();
const at = (y: number, mo: number, d: number, h = 9) =>
  new Date(y, mo, d, h).getTime();

describe('groupByDate', () => {
  it('buckets recent into today/yesterday/thisWeek/thisMonth, older by month', () => {
    const sections = groupByDate(
      [
        msg('a', at(2026, 5, 17)), // today (Wed 17)
        msg('b', at(2026, 5, 16)), // yesterday (Tue 16)
        msg('c', at(2026, 5, 15)), // this week (Mon 15)
        msg('d', at(2026, 5, 3)), // this month (3 June, before this week)
        msg('e', at(2026, 4, 20)), // May 2026 → month group
      ],
      NOW,
    );
    expect(sections.map(s => s.key)).toEqual([
      'today',
      'yesterday',
      'thisWeek',
      'thisMonth',
      'm-2026-4',
    ]);
    expect(sections[4].label).toEqual({ kind: 'month', year: 2026, month: 4 });
  });

  it('splits older messages into separate month groups', () => {
    const sections = groupByDate(
      [
        msg('a', at(2026, 4, 20)), // May 2026
        msg('b', at(2026, 4, 2)), // May 2026
        msg('c', at(2026, 3, 15)), // April 2026
        msg('d', at(2025, 11, 5)), // December 2025
      ],
      NOW,
    );
    expect(sections.map(s => s.key)).toEqual([
      'm-2026-4',
      'm-2026-3',
      'm-2025-11',
    ]);
    expect(sections[0].data.map(m => m.id)).toEqual(['a', 'b']);
    expect(sections[2].label).toEqual({ kind: 'month', year: 2025, month: 11 });
  });

  it('merges contiguous same-section messages and omits empty buckets', () => {
    const sections = groupByDate(
      [
        msg('a', at(2026, 5, 17, 10)),
        msg('b', at(2026, 5, 17, 8)),
        msg('e', at(2026, 4, 20)),
      ],
      NOW,
    );
    expect(sections.map(s => s.key)).toEqual(['today', 'm-2026-4']);
    expect(sections[0].data.map(m => m.id)).toEqual(['a', 'b']);
  });

  it('treats a null delivery time as a (very old) month group', () => {
    expect(groupByDate([msg('x', null)], NOW)[0].label.kind).toBe('month');
  });

  it('returns no sections for an empty list', () => {
    expect(groupByDate([], NOW)).toEqual([]);
  });
});

describe('rowDate', () => {
  it('today → time, this year → day.month, older → full date', () => {
    expect(rowDate(new Date(2026, 5, 17, 14, 32).getTime(), NOW)).toBe('14:32');
    expect(rowDate(at(2026, 5, 15), NOW)).toBe('15.06.');
    expect(rowDate(at(2024, 4, 20), NOW)).toBe('20.05.2024');
  });

  it('returns empty for a null date', () => {
    expect(rowDate(null, NOW)).toBe('');
  });
});

// ── How fresh the list is ───────────────────────────────────────────────────────────────────────
//
// The app syncs only when the user asks it to, so freshness is entirely a consequence of their own
// last action - and the screen declined to report it while the store had computed it all along.
// Coarsens with age on purpose: a minute-accurate timestamp from four days ago is false precision.
describe('freshnessLabel', () => {
  const now = Date.UTC(2026, 7, 22, 14, 32, 0);
  const MIN = 60_000;

  it('says nothing when the folder has never synced', () => {
    expect(freshnessLabel(null, now)).toBeNull();
  });

  it('refuses a timestamp from the future rather than inventing one', () => {
    // A device clock that disagrees with the server should produce silence, not "in -3 minutes".
    expect(freshnessLabel(now + 10 * MIN, now)).toBeNull();
  });

  it('refuses a stamp from before this app could have synced anything', () => {
    // 2026-09-24: a restored archive carried 1 ms past the epoch and the inbox said
    // "Aktualizováno 01.01.1970". A stamp that old is a placeholder, whatever wrote it.
    expect(freshnessLabel(0, now)).toBeNull();
    expect(freshnessLabel(1, now)).toBeNull();
    expect(freshnessLabel(-5 * MIN, now)).toBeNull();
    expect(freshnessLabel(Date.UTC(2019, 11, 31, 12), now)).toBeNull();
    expect(freshnessLabel(Date.UTC(2020, 0, 2, 12), now)).toBe('on:02.01.2020');
  });

  it('is "now" inside the first minute', () => {
    expect(freshnessLabel(now - 30_000, now)).toBe('now');
  });

  it('counts minutes for the first hour', () => {
    expect(freshnessLabel(now - 5 * MIN, now)).toBe('min:5');
    expect(freshnessLabel(now - 59 * MIN, now)).toBe('min:59');
  });

  it('switches to a clock time later the same day', () => {
    expect(freshnessLabel(now - 3 * 60 * MIN, now)).toMatch(/^at:\d\d:\d\d$/);
  });

  it('switches to a date once it is no longer today', () => {
    expect(freshnessLabel(now - 3 * 24 * 60 * MIN, now)).toMatch(/^on:/);
  });
});
