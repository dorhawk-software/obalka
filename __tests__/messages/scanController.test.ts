// The scan use-case's two guarantees (010 US3): the toggle is real, and "no" is permanent.
//
// Both are the kind of rule that is easy to state in a spec and easy to lose in a refactor, because
// nothing VISIBLE breaks when they stop holding - the app just quietly starts reading documents it
// was told not to, or re-offers a date the user already refused. So they are asserted at the seam
// where the decision is actually made, not through the screen.

import { ScanController } from '../../src/features/messages/state/scanController';
import type { MessageAttachment } from '../../src/services/isds/types';

const NOW = new Date(2026, 5, 1).getTime(); // 1. 6. 2026
const DEADLINE = new Date(2026, 6, 8).getTime(); // 8. 7. 2026

const pdf = (name = 'rozhodnuti.pdf'): MessageAttachment => ({
  name,
  mimeType: 'application/pdf',
  metaType: 'main',
  contentBase64: '',
  localPath: `/disk/${name}`,
  size: 10,
});

/** An in-memory settings table + counting fakes, so each test can assert what was NOT called. */
function harness(opts: { enabled?: boolean; text?: string | null } = {}) {
  const settings = new Map<string, string>();
  if (opts.enabled !== false) {
    settings.set('scanAttachments', '1');
  }
  const calls = { readBytes: 0, extractText: 0 };
  const controller = new ScanController({
    settings: {
      async getSetting(k) {
        return settings.get(k) ?? null;
      },
      async setSetting(k, v) {
        settings.set(k, v);
      },
      async removeSettingsWithPrefix(prefix) {
        for (const k of [...settings.keys()]) {
          if (k.startsWith(prefix)) {
            settings.delete(k);
          }
        }
      },
    },
    async readBytes() {
      calls.readBytes++;
      return new Uint8Array([1, 2, 3]);
    },
    async extractText() {
      calls.extractText++;
      return opts.text === undefined
        ? 'Uhraďte prosím do 8. 7. 2026 na účet…'
        : opts.text;
    },
    enabledKey: 'scanAttachments',
    now: () => NOW,
  });
  return { controller, calls, settings };
}

describe('the on-device scan', () => {
  it('finds the deadline the document states', async () => {
    const { controller } = harness();
    const found = await controller.scan('b1', 'm1', [pdf()]);
    expect(found?.date).toBe(DEADLINE);
    expect(found?.fileName).toBe('rozhodnuti.pdf');
    expect(found?.snippet).toMatch(/8\. 7\. 2026/);
  });

  // FR-011, and the whole reason the feature is allowed to exist: with the toggle off, no document
  // content is processed AT ALL. Not "processed and discarded" - not read.
  it('reads nothing whatsoever while the toggle is off', async () => {
    const { controller, calls } = harness({ enabled: false });
    expect(await controller.scan('b1', 'm1', [pdf()])).toBeNull();
    expect(calls.readBytes).toBe(0);
    expect(calls.extractText).toBe(0);
  });

  it('does not re-offer a suggestion the user dismissed - and does not re-read the file either', async () => {
    const { controller, calls } = harness();
    expect(await controller.scan('b1', 'm1', [pdf()])).not.toBeNull();
    await controller.dismiss('b1', 'm1');
    expect(await controller.scan('b1', 'm1', [pdf()])).toBeNull();
    expect(calls.extractText).toBe(1); // the first scan only
  });

  it('keeps dismissals per message, not per box', async () => {
    const { controller } = harness();
    await controller.dismiss('b1', 'm1');
    expect(await controller.scan('b1', 'm2', [pdf()])).not.toBeNull();
  });

  // A removed box leaves nothing behind - same rule as its reminders and its cache.
  it('drops a box’s dismissals with the box, and only that box’s', async () => {
    const { controller, settings } = harness();
    await controller.dismiss('b1', 'm1');
    await controller.dismiss('b2', 'm1');
    await controller.clearBox('b1');
    expect(await controller.isDismissed('b1', 'm1')).toBe(false);
    expect(await controller.isDismissed('b2', 'm1')).toBe(true);
    expect(settings.get('scanAttachments')).toBe('1'); // the toggle is not collateral damage
  });

  it('offers nothing when the document has no text layer', async () => {
    const { controller } = harness({ text: null });
    expect(await controller.scan('b1', 'm1', [pdf()])).toBeNull();
  });
});
