// The work under way for each box, which removing the box stops (001 T037, 002 FR-015).
//
// A sync already out for a box when its removal started wrote what ISDS returned into the archive
// after the removal had cleared it: `loadFolder` wrote the list without asking whether the box was
// still listed, and nothing aborted the refresh. The envelopes stayed, with the removal's mark already
// gone, so nothing would ever clear them. A download or a signed original landing late left its files
// the same way.
//
// Three rules, kept here so every caller of `MessagesController` gets them: a removal aborts every
// call of its box (`stop`), a write for a box is refused while its removal runs or once it is not
// listed (`write`), and clearing a box waits for the writes of it already under way (`settled`). A
// write that got in before the removal therefore always lands before the archive is cleared, never
// after it.

import { reportFailure } from '../../../services/telemetry/telemetry';

/** A write refused because its box is being removed, or is no longer listed. */
export class BoxGoneError extends Error {
  constructor() {
    super('The box is being removed or is no longer listed.');
    this.name = 'BoxGoneError';
  }
}

export class BoxWork {
  /** How many removals of each box are running. The removal queue keeps it to one. */
  private readonly stopped = new Map<string, number>();
  /** The signal of every call of each box that has not ended, for `stop` to abort. */
  private readonly calls = new Map<string, Set<AbortController>>();
  /** How many writes of each box are under way. */
  private readonly writing = new Map<string, number>();
  private readonly waiting = new Map<string, Array<() => void>>();

  /**
   * @param isListed Whether the store lists the box. Asked by every write, because a call that began
   *   before a removal can finish after it: by then the box is no longer being removed, only gone.
   */
  constructor(private readonly isListed?: (boxId: string) => Promise<boolean>) {}

  /**
   * Run one call of a box under a signal that aborts with `outer` and when the box's removal starts.
   * A call started while the removal runs gets a signal aborted already, so it reaches nothing.
   */
  async run<T>(
    boxId: string,
    outer: AbortSignal | undefined,
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const ctrl = new AbortController();
    const abort = () => ctrl.abort();
    if (outer?.aborted || this.isStopped(boxId)) {
      ctrl.abort();
    } else {
      outer?.addEventListener('abort', abort);
    }
    let open = this.calls.get(boxId);
    if (!open) {
      open = new Set();
      this.calls.set(boxId, open);
    }
    open.add(ctrl);
    try {
      return await work(ctrl.signal);
    } finally {
      outer?.removeEventListener('abort', abort);
      open.delete(ctrl);
      if (open.size === 0 && this.calls.get(boxId) === open) {
        this.calls.delete(boxId);
      }
    }
  }

  /** The box's removal has started: abort its calls, and refuse its writes until `resume`. */
  stop(boxId: string): void {
    this.stopped.set(boxId, (this.stopped.get(boxId) ?? 0) + 1);
    for (const ctrl of this.calls.get(boxId) ?? []) {
      ctrl.abort();
    }
  }

  /** The box's removal has ended. What is written for it from now on depends on whether it is listed. */
  resume(boxId: string): void {
    const left = (this.stopped.get(boxId) ?? 0) - 1;
    if (left > 0) {
      this.stopped.set(boxId, left);
    } else {
      this.stopped.delete(boxId);
    }
  }

  isStopped(boxId: string): boolean {
    return this.stopped.has(boxId);
  }

  /**
   * Write into the archive, or the files, of a box. Rejects with `BoxGoneError`, writing nothing,
   * while the box's removal runs or when the store does not list it - also when the store cannot say,
   * because a write for a box that may be gone is exactly what this refuses.
   */
  async write<T>(boxId: string, work: () => Promise<T>): Promise<T> {
    if (this.isStopped(boxId)) {
      throw new BoxGoneError();
    }
    // Counted from before the store is asked: a removal that starts meanwhile waits for this write
    // (`settled`) instead of clearing the box underneath it.
    this.writing.set(boxId, (this.writing.get(boxId) ?? 0) + 1);
    try {
      // A store that cannot say is reported here: the refusal itself ends as a quiet non-event
      // (`MessagesController.mapError`), and an accounts table that will not read must not go unseen.
      const listed = this.isListed
        ? await this.isListed(boxId).catch((e: unknown) => {
            reportFailure('db.read', e, { stage: 'persist' });
            return false;
          })
        : true;
      if (!listed || this.isStopped(boxId)) {
        throw new BoxGoneError();
      }
      return await work();
    } finally {
      const left = (this.writing.get(boxId) ?? 1) - 1;
      if (left > 0) {
        this.writing.set(boxId, left);
      } else {
        this.writing.delete(boxId);
        const waiting = this.waiting.get(boxId) ?? [];
        this.waiting.delete(boxId);
        for (const done of waiting) {
          done();
        }
      }
    }
  }

  /** Resolves once no write of the box is under way - what clearing its archive waits for. */
  settled(boxId: string): Promise<void> {
    if (!this.writing.has(boxId)) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const waiting = this.waiting.get(boxId) ?? [];
      waiting.push(resolve);
      this.waiting.set(boxId, waiting);
    });
  }
}
