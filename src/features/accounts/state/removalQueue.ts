// Box removals, one at a time (001 T037).
//
// The switcher closes before a removal settles, so a second box can be removed meanwhile, and two at
// once raced each other through the store: the one to settle last put back on screen, even made
// active, a box the other had already removed. A removal resumed at launch or after its dialog closed
// (`resumeRemoval`) goes through the same line. Adding a box waits for the line to empty (`idle`): a
// box added while an earlier removal of the same box was still clearing its archive would have had its
// new Keychain items and its first sync deleted from under it.
//
// A restore - the backup screen's, or a phone transfer's save - runs apart from the line (`runApart`):
// after every removal queued before it, and before any asked for while it runs. A restore that brought
// a box back while that box's removal was clearing it lost what it had just written to a purge that
// had already found the box gone, and a removal started during a restore could clear a box the restore
// was still writing (006).

export class RemovalQueue {
  private readonly queued = new Set<string>();
  private tail: Promise<void> = Promise.resolve();
  /** Every run kept apart from removals that has not ended, settled rather than rejected. */
  private readonly apart = new Set<Promise<void>>();

  /**
   * Run `work` after everything queued before it, and after any work running apart. The same box
   * asked for again while it is still queued is the same run. Never rejects: `work` failing is handed
   * to `onError`, because a rejection would stop every removal queued after it, and nobody awaits a
   * removal the switcher started.
   */
  run(
    boxId: string,
    work: () => Promise<void>,
    onError: (error: unknown) => void,
  ): Promise<void> {
    if (this.queued.has(boxId)) {
      return this.tail;
    }
    this.queued.add(boxId);
    this.tail = this.tail.then(async () => {
      try {
        while (this.apart.size > 0) {
          await Promise.all([...this.apart]);
        }
        await work();
      } catch (e) {
        onError(e);
      } finally {
        this.queued.delete(boxId);
      }
    });
    return this.tail;
  }

  /** Resolves once nothing is queued - including work queued while it waited. */
  async idle(): Promise<void> {
    while (this.queued.size > 0) {
      await this.tail;
    }
  }

  /**
   * Run `work` with no removal running: once every removal queued before it has ended, and holding
   * every removal asked for meanwhile until it has ended. Resolves or rejects as `work` does.
   */
  async runApart<T>(work: () => Promise<T>): Promise<T> {
    // `idle`, inline: nothing is queued once the loop ends, and `work` is registered in that same step,
    // so a removal asked for from here on finds it and waits.
    while (this.queued.size > 0) {
      await this.tail;
    }
    const running = work();
    const ended = running.then(
      () => undefined,
      () => undefined,
    );
    this.apart.add(ended);
    try {
      return await running;
    } finally {
      this.apart.delete(ended);
    }
  }
}
