// The words round a postmark's ring fill it in English as they do in Czech (031 I29, I39). The ring is
// 157 long (radius 25); measured in Public Sans Bold at the ring's 6.6 with its 1.2 spacing, the Czech
// words take 135 (received) and 145 (sent). Until 2026-11-15 the English took 104 and 79, so a third
// and a half of the English ring stood empty. Jest cannot measure a face, so the letters are counted:
// at these sizes a letter is about as wide in either language (the measured widths above agree).

import * as detail from '../../src/i18n/messageDetailStrings';
import * as sent from '../../src/i18n/sentResultStrings';

const KEYS = [
  [detail, 'detail.postmark.ring'],
  [sent, 'send.sent.postmark.ring'],
] as const;

describe('the postmark ring words', () => {
  it.each(KEYS)('fill the English ring as the Czech words do (%#)', (table, key) => {
    const ratio = table.en[key].length / table.cs[key].length;
    expect(ratio).toBeGreaterThanOrEqual(0.9);
    expect(ratio).toBeLessThanOrEqual(1.15);
  });

  it('end with the separator, so the ring closes on a dot in both languages', () => {
    for (const [table, key] of KEYS) {
      expect([table.cs[key].endsWith(' ·'), table.en[key].endsWith(' ·')]).toEqual([true, true]);
    }
  });
});
