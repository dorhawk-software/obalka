import {
  classifyCost,
  isPaidRecipient,
  totalAttachmentBytes,
  PRICE_CZK,
  LARGE_TIER_THRESHOLD_BYTES,
  BIG_MESSAGE_THRESHOLD_BYTES,
  VODZ_MAX_BYTES,
  type SizedAttachment,
} from '../../src/features/messages/state/costModel';

const small: SizedAttachment[] = [{ sizeBytes: 1024 }];
const large: SizedAttachment[] = [{ sizeBytes: LARGE_TIER_THRESHOLD_BYTES }];
const huge: SizedAttachment[] = [
  { sizeBytes: BIG_MESSAGE_THRESHOLD_BYTES + 1 },
];
const overVodz: SizedAttachment[] = [{ sizeBytes: VODZ_MAX_BYTES + 1 }];

describe('costModel - free vs paid (the cost model)', () => {
  it('a send to an OVM (public authority) is free regardless of size', () => {
    expect(isPaidRecipient('OVM')).toBe(false);
    expect(classifyCost('OVM', [])).toEqual({
      paid: false,
      tier: 'none',
      approxCzk: null,
      bigMessage: false,
      oversize: false,
    });
    // even with a large attachment, an OVM send stays free (only bigMessage routing flips)
    expect(classifyCost('OVM', large)).toMatchObject({
      paid: false,
      tier: 'none',
      approxCzk: null,
    });
  });

  it.each(['FO', 'PFO', 'PO'] as const)(
    'a send to a private box (%s) is a paid PDZ',
    dbType => {
      expect(isPaidRecipient(dbType)).toBe(true);
      expect(classifyCost(dbType, small).paid).toBe(true);
    },
  );
});

describe('costModel - price tiers by size', () => {
  it('a small paid message is the normal tier', () => {
    expect(classifyCost('FO', small)).toEqual({
      paid: true,
      tier: 'normal',
      approxCzk: PRICE_CZK.normal,
      bigMessage: false,
      oversize: false,
    });
  });

  it('an attachment at/above the large threshold is the large tier', () => {
    expect(classifyCost('FO', large)).toMatchObject({
      tier: 'large',
      approxCzk: PRICE_CZK.large,
    });
  });

  it('a body-only paid message (no attachments) is the normal tier', () => {
    expect(classifyCost('PO', [])).toMatchObject({
      paid: true,
      tier: 'normal',
      approxCzk: PRICE_CZK.normal,
    });
  });
});

describe('costModel - big-message routing', () => {
  it('routes oversize payloads to CreateBigMessage (paid)', () => {
    expect(classifyCost('FO', huge).bigMessage).toBe(true);
  });

  it('routes oversize payloads to CreateBigMessage even when free (OVM)', () => {
    expect(classifyCost('OVM', huge)).toMatchObject({
      paid: false,
      bigMessage: true,
    });
  });

  it('a normal-sized message is not a big message', () => {
    expect(classifyCost('FO', small).bigMessage).toBe(false);
  });

  it('a 20–100 MB message is a big message but NOT oversize (sends via VoDZ)', () => {
    expect(classifyCost('FO', huge)).toMatchObject({
      bigMessage: true,
      oversize: false,
    });
  });

  it('over the 100 MB VoDZ ceiling is oversize (genuinely unsupported)', () => {
    expect(classifyCost('FO', overVodz)).toMatchObject({
      bigMessage: true,
      oversize: true,
    });
  });
});

describe('totalAttachmentBytes', () => {
  it('sums sizes and ignores negatives', () => {
    expect(totalAttachmentBytes([{ sizeBytes: 10 }, { sizeBytes: 20 }])).toBe(
      30,
    );
    expect(totalAttachmentBytes([{ sizeBytes: -5 }, { sizeBytes: 5 }])).toBe(5);
    expect(totalAttachmentBytes([])).toBe(0);
  });
});
