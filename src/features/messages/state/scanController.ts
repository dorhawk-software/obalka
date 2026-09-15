// The on-device deadline scan, as a use-case (010 US3, cycle 2).
//
// Composes three things the screen should not have to know about individually: reading the
// downloaded file, parsing its text layer, and remembering that the user said no.
//
// TWO RULES LIVE HERE, and both are the feature's whole point:
//
//   * **The toggle is checked here, not only in the UI.** `scan()` reads the setting itself and
//     returns null when it is off, so no code path can start a scan by forgetting to ask. With it
//     off, `extractText` is never called and pdf.js is never even imported (FR-011).
//   * **A dismissal is permanent for that message.** It is written to storage, not held in state, so
//     the suggestion does not come back on the next launch (US3 scenario 3). It is keyed per message
//     rather than per box, because "no, not this one" is not "never scan anything".
//
// The suggestion is never committed on its own. Accepting it is a separate call the USER makes, and
// what it creates is an ordinary US2 reminder - the screen does that through `remindersController`,
// which is why there is no `accept()` here to get it subtly wrong.

import type { MessageAttachment } from '../../../services/isds/types';
import {
  scanAttachmentsForDeadline,
  type ScanSuggestion,
} from '../../../services/scan/attachmentScan';

/** Per-message dismissals live in the app's key/value settings - see `removeSettingsWithPrefix`. */
const DISMISS_PREFIX = 'scanDismiss:';

const dismissKey = (boxId: string, messageId: string): string =>
  `${DISMISS_PREFIX}${boxId}:${messageId}`;

export interface ScanControllerDeps {
  /** The opt-in toggle + the dismissal record. */
  settings: {
    getSetting(key: string): Promise<string | null>;
    setSetting(key: string, value: string): Promise<void>;
    removeSettingsWithPrefix(prefix: string): Promise<void>;
  };
  /** Reads a downloaded attachment off disk. */
  readBytes(localPath: string): Promise<Uint8Array | null>;
  /** Pulls the text layer out of a document. Injected so tests never load a PDF parser. */
  extractText(bytes: Uint8Array): Promise<string | null>;
  /** The key the Settings toggle is stored under, so both sides cannot drift. */
  enabledKey: string;
  now?: () => number;
}

export class ScanController {
  constructor(private readonly deps: ScanControllerDeps) {}

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  /** Whether the user has turned scanning on. Only an explicit "1" counts. */
  async enabled(): Promise<boolean> {
    return (await this.deps.settings.getSetting(this.deps.enabledKey)) === '1';
  }

  /**
   * Scan a freshly downloaded message, or return null.
   *
   * Null covers every "nothing to offer" case and they are deliberately indistinguishable to the
   * caller: scanning is off, the user dismissed this message before, no attachment is readable, or
   * the document states no unambiguous deadline.
   */
  async scan(
    boxId: string,
    messageId: string,
    attachments: readonly MessageAttachment[],
  ): Promise<ScanSuggestion | null> {
    if (!(await this.enabled())) {
      return null;
    }
    if (await this.isDismissed(boxId, messageId)) {
      return null;
    }
    return scanAttachmentsForDeadline(attachments, {
      readBytes: p => this.deps.readBytes(p),
      extractText: b => this.deps.extractText(b),
      now: () => this.now(),
    });
  }

  async isDismissed(boxId: string, messageId: string): Promise<boolean> {
    return (
      (await this.deps.settings.getSetting(dismissKey(boxId, messageId))) === '1'
    );
  }

  /** Record that this message's suggestion was refused. Never expires. */
  async dismiss(boxId: string, messageId: string): Promise<void> {
    await this.deps.settings.setSetting(dismissKey(boxId, messageId), '1');
  }

  /** Drop a removed box's dismissals, like its reminders and its cache. */
  async clearBox(boxId: string): Promise<void> {
    await this.deps.settings.removeSettingsWithPrefix(
      `${DISMISS_PREFIX}${boxId}:`,
    );
  }
}
