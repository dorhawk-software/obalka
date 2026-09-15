// Handing a file to the user, and taking one back (006 T014).
//
// The seam exists for the same reason `BackupFs` does: the implementation is a native document
// picker and cannot run in jest, while the part worth testing - what gets packed, what happens when
// the file is not one of ours, what a cancelled sheet means - is pure. So the picker goes behind an
// interface and the logic sits on this side of it.
//
// Cancelling is NOT an error. A user who opens the system sheet and changes their mind has done
// nothing wrong, and an app that shows them a red message for it is an app that treats a shrug as a
// fault. Both calls answer with "nothing happened" instead.

/** What the controller needs from the platform to move a backup in or out. */
export interface PortableIo {
  /**
   * Offer `bytes` to the user as a file to keep, under a suggested name.
   *
   * Resolves `true` when a destination was chosen, `false` when the sheet was dismissed. It does NOT
   * resolve the path: where the file went is the user's business, and on both platforms the answer
   * may be a cloud provider this app cannot read back.
   */
  save(fileName: string, bytes: Uint8Array): Promise<boolean>;

  /** Let the user choose a file. Resolves its bytes, or `null` when they cancelled. */
  open(): Promise<Uint8Array | null>;
}

/** MIME type for an exported backup. Opaque on purpose: nothing should offer to preview it. */
export const PORTABLE_MIME = 'application/octet-stream';
