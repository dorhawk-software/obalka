import {
  MESSAGE_STATE,
  messageStateKind,
  messageStatus,
  showsListChip,
  stopReasonKey,
} from '../../src/features/messages/state/messageState';

describe('messageState - the ten ISDS states mapped onto five treatments', () => {
  it('1 and 2 are still in transit', () => {
    expect(messageStateKind(1)).toBe('sent');
    expect(messageStateKind(2)).toBe('sent');
  });

  it('4 is delivered into the box but not served', () => {
    expect(messageStateKind(4)).toBe('delivered');
  });

  // The regression this whole module exists to prevent. The previous three-state model treated
  // `state >= 5` as "Doručeno", which reported state 8 - UNDELIVERABLE - as delivered, and left
  // state 3 (failed the antivirus check, never delivered to anyone) permanently on "Odesláno".
  it('3 and 8 are TERMINAL FAILURES, never "delivered" and never "in transit"', () => {
    for (const state of [MESSAGE_STATE.antivirusFailed, MESSAGE_STATE.undeliverable]) {
      const s = messageStatus(state);
      expect(s.kind).toBe('stop');
      expect(s.terminal).toBe(true);
      expect(s.labelKey).not.toBe('detail.accepted');
      expect(s.labelKey).not.toBe('detail.delivered');
      expect(s.labelKey).not.toBe('messages.status.sent');
    }
  });

  // 5 is FIKCÍ and 6 is PŘIHLÁŠENÍM, not the other way round - the old comment had them swapped.
  // Source: docs/isds-ws-news/2179_Info_pro_vyvojare_2020_9.md §3.2.
  it('5 is served by fiction and 6 by an actual sign-in, and they are distinguishable', () => {
    expect(messageStateKind(MESSAGE_STATE.servedByFiction)).toBe('fiction');
    expect(messageStateKind(MESSAGE_STATE.servedBySignIn)).toBe('accepted');
    expect(messageStatus(5).labelKey).not.toBe(messageStatus(6).labelKey);
    expect(messageStatus(5).tone).not.toBe(messageStatus(6).tone);
  });

  it('7 (read) is legally the same outcome as 6 and shares its treatment', () => {
    expect(messageStateKind(7)).toBe('accepted');
    expect(messageStatus(7).labelKey).toBe(messageStatus(6).labelKey);
  });

  it('9 and 10 are annotations on a finished journey, not states of their own', () => {
    expect(messageStatus(9)).toMatchObject({
      kind: 'accepted',
      annotation: 'erased',
    });
    expect(messageStatus(10)).toMatchObject({
      kind: 'accepted',
      annotation: 'vault',
    });
    // Everything else carries no footnote.
    for (const state of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(messageStatus(state).annotation).toBeNull();
    }
  });

  it('only the two failures explain themselves, and they explain themselves differently', () => {
    expect(stopReasonKey(3)).toBe('status.stop.antivirus');
    expect(stopReasonKey(8)).toBe('status.stop.undeliverable');
    for (const state of [1, 2, 4, 5, 6, 7, 9, 10]) {
      expect(stopReasonKey(state)).toBeNull();
    }
  });

  it('a list chip appears only when the news is not what you would assume', () => {
    // Ordinary progress is carried by the glyph alone, so the common sent row stays two lines.
    for (const state of [1, 2, 4, 6, 7, 9, 10]) {
      expect(showsListChip(state)).toBe(false);
    }
    for (const state of [3, 5, 8]) {
      expect(showsListChip(state)).toBe(true);
    }
  });

  it('a garbled state degrades to "in transit" rather than throwing', () => {
    for (const state of [0, -1, 99, NaN]) {
      expect(() => messageStatus(state)).not.toThrow();
      expect(messageStatus(state).kind).toBe('sent');
    }
  });
});
