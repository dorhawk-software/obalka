// The seam the native transfer sits behind (025 T008).
//
// The same shape `BackupFs` and `PortableIo` take, and for the same reason: the implementation is a
// gomobile binding that cannot run in jest, while the part worth testing - what gets packed, what
// order things happen in, what a refused phrase means, what a cancel leaves behind - is pure. So the
// native side goes behind this interface and every rule lives on this side of it.
//
// FR-001 IS ENFORCED BY THIS SIGNATURE. `send` takes a PATH to bytes that are already sealed, not a
// payload and not an archive. There is deliberately no way to hand this a snapshot, a passphrase or
// anything the envelope has not already closed over; the transport's whole vocabulary is "this file,
// under this phrase".

/** Where a transfer has got to. Counts are real bytes, never a fraction invented by a timer. */
export interface TransferProgress {
  /**
   * `preparing` comes before a phrase exists at all.
   *
   * The walk measured 25 seconds of it for an archive with nine documents, during which the screen
   * claimed to be waiting for the other phone - which had nothing to wait for, because the phrase
   * had not been generated yet. A stage that cannot be named is a stage the interface lies about.
   */
  stage: 'preparing' | 'connecting' | 'transferring' | 'finishing';
  sent: number;
  total: number;
  /**
   * Whether the bytes are crossing a relay, as OBSERVED rather than as requested.
   *
   * This is a `boolean | null`, and the null matters: until the transport has negotiated a route,
   * the honest answer is "not known yet", and FR-007 forbids the screen claiming either way before
   * then. The spike found croc rendezvousing through a relay and then moving the bytes DIRECTLY, so
   * the requested flag is not the answer to "did my mail cross a relay" - only the observation is.
   */
  relayed: boolean | null;
}

export type TransferProgressFn = (progress: TransferProgress) => void;

/** What a caller passes to either direction. */
export interface TransferOptions {
  /** The phrase, which IS the shared secret. See `codePhrase.ts`. */
  secret: string;
  /**
   * Refuse anything but a direct connection on the local network.
   *
   * A supported mode of the transport rather than something inferred afterwards, which is what makes
   * "nothing left this network" a property of the configuration instead of a hope (SC-003).
   */
  onlyLocal: boolean;
  onProgress?: TransferProgressFn;
  signal?: { readonly cancelled: boolean };
}

/**
 * The phrase did not match.
 *
 * Its own type because PAKE gives exactly one guess per attempt, so a person WILL hit this, and the
 * remedy - read it again, ask for a fresh one - is nothing like the remedy for a transport failure.
 * Collapsing the two sends somebody hunting for a network problem they do not have (FR-006).
 */
export class PhraseRefusedError extends Error {
  constructor(message = 'That phrase did not match.') {
    super(message);
    this.name = 'PhraseRefusedError';
  }
}

/** The transfer began and did not finish. Distinct from a phrase that was never right. */
export class TransferFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransferFailedError';
  }
}

/**
 * The transfer was stopped on purpose - by the cancel button, or by the app leaving the foreground
 * (FR-014).
 *
 * Its own type so nothing downstream reads a deliberate stop as a broken transfer: the screen has
 * already said why it stopped, and "the transfer could not be completed" on top of that would be
 * both untrue and the second of two contradicting sentences.
 */
export class TransferCancelledError extends Error {
  constructor(message = 'The transfer was stopped.') {
    super(message);
    this.name = 'TransferCancelledError';
  }
}

/**
 * A transfer was asked to start while a received one is still being saved into the archive (025
 * review, 2026-09-15).
 *
 * The save reads its documents out of the receive directory, which a new receive sweeps first - and
 * the save's own sweep at the end would take the new transfer's files with it. Refused rather than
 * queued, with its own sentence, so the user is told what is being waited for.
 */
export class TransferBusyError extends Error {
  constructor(message = 'A received transfer is still being saved to the archive.') {
    super(message);
    this.name = 'TransferBusyError';
  }
}

/**
 * An offer or a receive was asked to start while another one is still running (audit 2026-09-23).
 *
 * The native module moves one transfer at a time, and each run stages into a directory of its own
 * that only it sweeps: a second run started on top of a live one - a double tap on "Odeslat z tohoto
 * telefonu", two camera frames reading the same code - would stage a second copy of the archive and
 * hand the native side a second transfer to juggle. Refused rather than joined: a second receive may
 * carry a different phrase, and a second offer's caller would be given a phrase it did not ask for. A
 * run that has been stopped no longer counts, so starting again after a cancel is never refused.
 */
export class TransferRunningError extends Error {
  constructor(message = 'Another transfer is already running on this phone.') {
    super(message);
    this.name = 'TransferRunningError';
  }
}

/**
 * The backup chosen to send is no longer on this phone (026 FR-007) - retention deleted it after a newer
 * one was made, or it was deleted by hand, between choosing it and sending.
 *
 * Its own type because the remedy is to choose again, and because the send must not quietly go out
 * with a different backup in its place: which backup travels is the person's choice now.
 */
export class TransferBackupGoneError extends Error {
  constructor(message = 'The chosen backup is no longer on this phone.') {
    super(message);
    this.name = 'TransferBackupGoneError';
  }
}

/**
 * This build cannot transfer at all.
 *
 * Thrown rather than returned so a caller cannot forget it, and caught by the controller so the
 * FEATURE disappears rather than the screen breaking - the rule `bulkCipher.ts` follows for its own
 * missing native module (FR-013).
 */
export class TransferUnavailableError extends Error {
  constructor(message = 'This build cannot transfer between phones.') {
    super(message);
    this.name = 'TransferUnavailableError';
  }
}

/** The native transfer, as everything above it sees it. */
export interface Transport {
  /**
   * Whether the native side is actually there.
   *
   * Resolved per call, never cached at module scope: a throwing import takes the screen with it,
   * while a missing module should only ever mean "this phone cannot do this".
   */
  available(): boolean;

  /** Send one directory of already-sealed files. Resolves when the far side has all of it. */
  send(dir: string, options: TransferOptions): Promise<void>;

  /** Receive into `dir`. Resolves the names written, so the caller need not guess at them. */
  receive(dir: string, options: TransferOptions): Promise<string[]>;

  /**
   * Tell the run in flight to stop NOW, rather than whenever its `signal` is next polled.
   *
   * The signal alone is not enough for FR-014. It reaches the native side through a JS timer, and
   * Android pauses JS timers while the app is in the background - which is exactly when a stop for
   * leaving the app is issued. Left to the timer, the stop would reach croc only once the user came
   * back, and the bytes would have moved in the background in the meantime. A no-op when nothing is
   * running, and it stops only the run in flight: a run that starts afterwards is not reached by it.
   */
  cancel(): void;

  /**
   * Keep the display on while a transfer is live, or let it time out again (FR-014, 2026-09-15).
   *
   * Android pauses the app when the display times out, and a paused app stops its transfer - so
   * without this every transfer longer than the screen timeout ended the same way as leaving the app.
   * Best effort and never throws: where the platform cannot do it, the stop is still explained.
   */
  keepScreenOn(on: boolean): void;
}

/**
 * The two names inside a transfer, fixed rather than discovered.
 *
 * A receiver that globbed for "whatever arrived" would be trusting the sender to have sent the right
 * shape, and the sender is the one party a transfer cannot verify before it has finished.
 */
export const TRANSFER_BACKUP_FILE = 'backup.obalka';
export const TRANSFER_KEY_FILE = 'recovery.key';

/**
 * The relay a transfer crosses when it cannot go direct, NAMED rather than described (US3 scenario 2).
 *
 * "A public relay" told the user that a third party was involved and not which one, which is the
 * half of the answer they could actually look up. These are croc's own defaults - `DEFAULT_RELAY`
 * and `DEFAULT_RELAY6` in `src/models/constants.go` - which `native/transfer/transfer.go` passes as
 * `RelayAddress` / `RelayAddress6`. BOTH are named, because croc tries the IPv6 relay first and falls
 * back to the IPv4 one (the relay loops in `src/croc/croc.go`, sender and receiver alike): on a
 * network with IPv6 the bytes go through the second host, and naming only the first would be wrong
 * exactly there. croc resolves both names to addresses at start-up, so the hostnames are what the
 * binary actually connects to, just spelled the way a person can look them up.
 *
 * Pinned to the croc version the hosts were read from. `__tests__/transfer/relayHost.test.ts` holds
 * this against `native/transfer/go.mod` and `transfer.go`, so bumping croc - or pointing the wrapper
 * at another relay - fails the suite until somebody re-reads the constants, rather than letting the
 * screen go on naming a relay the binary no longer uses.
 */
export const TRANSFER_RELAY = {
  crocVersion: 'v10.7.0',
  host: 'croc.schollz.com',
  host6: 'croc6.schollz.com',
} as const;
