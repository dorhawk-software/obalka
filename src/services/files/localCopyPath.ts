// The filesystem path behind a document-picker copy, and the file URI that names a path, shared by
// everything that reads one or hands one out.
//
// Two callers take a file from the system picker and read it from a cache copy: attaching a document
// (005, `attachmentPicker.ts`) and importing a backup (006 T014, `portableIo` in the accounts deps).
// The attachment path learned on 2026-09-14 that the copy's URI is percent-encoded; the backup import
// still stripped only the scheme until 2026-09-15 and failed on the same file names. One function, so
// the two cannot drift apart again.
//
// The other direction has the same trap and two callers of its own: saving a signed original (004,
// `attachmentOpener.save`) and exporting a backup (006 T014, `portableIo.save`) both hand the system
// save sheet a `file://` URI. Until 2026-09-15 both built it by pasting the path after the scheme, so
// the encoding lives here too, beside the decoding it has to undo.

const FILE_SCHEME = 'file://';

/**
 * The filesystem path behind a `keepLocalCopy` result. Both platforms hand back a PERCENT-ENCODED
 * `file://` URI (Android `Uri.fromFile(…).toString()`, iOS `URL.absoluteString`), so a copy of
 * "Smlouva o dílo.pdf" comes back as `…/Smlouva%20o%20d%C3%ADlo.pdf`. Stripping only the scheme leaves
 * that encoding in the path, which names no file: the read fails, and so does every file whose name
 * has a space or a diacritic - most Czech file names. A malformed escape throws (`URIError`); both
 * callers already turn a throw into their own recoverable failure, like any other unreadable copy.
 */
export function localCopyPath(localUri: string): string {
  return localUri.startsWith(FILE_SCHEME)
    ? decodeURIComponent(localUri.slice(FILE_SCHEME.length))
    : localUri;
}

/**
 * The path `localCopyPath` would read, for cleaning a copy up when that read cannot even start.
 *
 * A URI whose escape is malformed has no decoded path, yet the copy it names still sits in the cache
 * - and it is the user's file. The only native answer that can carry a malformed escape is one that
 * was never encoded, and for that the scheme-stripped string IS the path; for anything else it names
 * no file, and removing it is a no-op.
 */
export function localCopyCleanupPath(localUri: string): string {
  try {
    return localCopyPath(localUri);
  } catch {
    return localUri.startsWith(FILE_SCHEME) ? localUri.slice(FILE_SCHEME.length) : localUri;
  }
}

/**
 * A `file://` URI for a filesystem path, each segment percent-encoded - the inverse of `localCopyPath`.
 *
 * The native save sheet PARSES what it is given: Android `Uri.parse`, iOS `URL(string:)`. Pasted in
 * raw, "Rozhodnutí #3 100%.pdf" breaks both: `#` starts a fragment, so the path ends at "Rozhodnutí ",
 * and a `%` that does not begin an escape is malformed - `URL(string:)` answers nil and the picker
 * drops the file, as it does on older iOS for a bare space. Encoding the segments and keeping the
 * slashes gives both parsers the path back exactly.
 */
export function fileUri(path: string): string {
  return FILE_SCHEME + path.split('/').map(encodeURIComponent).join('/');
}
