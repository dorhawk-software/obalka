// Attachment opener (feature 002). Persists a downloaded attachment's base64 content to a temp file
// and hands it to the OS to open with whatever app handles its MIME type. The native write + intent
// run off the JS thread (constitution Principle I). Abstracted behind an interface so screens depend
// on a fake in tests; the device impl wraps react-native-blob-util.

import { Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import {
  errorCodes,
  isErrorWithCode,
  saveDocuments,
} from '@react-native-documents/picker';
import {
  ZFO_MIME_TYPE,
  type MessageAttachment,
  type SignedOriginal,
} from '../isds/types';
import { fileUri } from './localCopyPath';

export interface AttachmentOpener {
  /** Write the attachment to a temp file and open it with the system viewer. May throw. */
  open(attachment: MessageAttachment): Promise<void>;
  /**
   * Hand a file on disk to the system "save to" sheet (004 amendment) - the way a message's signed
   * original leaves the phone where no installed app claims a .zfo. Resolves false when the user
   * dismissed the sheet. May throw.
   */
  save(localPath: string, fileName: string, mimeType: string): Promise<boolean>;
}

/** Thrown when no installed app can open the attachment's MIME type (Android: no ACTION_VIEW match). */
export class NoViewerError extends Error {
  constructor(message = 'no viewer for mime type') {
    super(message);
    this.name = 'NoViewerError';
  }
}

// Keep the name filesystem-safe (ISDS dmFileDescr can contain spaces/diacritics, which are fine, but
// path separators and reserved chars are not). Falls back when the description is empty.
const RESERVED = /[\\/:*?"<>|]/g;
function safeFileName(name: string, fallback: string): string {
  const cleaned = name.replace(RESERVED, '_').trim();
  return cleaned || fallback;
}

class BlobUtilAttachmentOpener implements AttachmentOpener {
  async open(attachment: MessageAttachment): Promise<void> {
    const { fs } = RNBlobUtil;
    const mime = attachment.mimeType || 'application/octet-stream';

    // Large-volume (VoDZ) enclosures are already streamed to a file on disk (never held as base64) -
    // open that file directly. Everything else is written from its inline base64 to a temp file.
    let path: string;
    if (attachment.localPath != null && (await fs.exists(attachment.localPath))) {
      path = attachment.localPath;
    } else {
      const name = safeFileName(attachment.name, `priloha-${Date.now()}`);
      path = `${fs.dirs.CacheDir}/${name}`;
      await fs.writeFile(path, attachment.contentBase64, 'base64');
    }

    if (Platform.OS === 'android') {
      try {
        await RNBlobUtil.android.actionViewIntent(path, mime);
      } catch (e) {
        // No app registered for the MIME type -> a recoverable, user-facing condition.
        throw new NoViewerError(e instanceof Error ? e.message : undefined);
      }
    } else {
      // iOS: prefer the IN-APP QuickLook preview (presentPreview), falling back to the options /
      // "Open in…" sheet only for types QuickLook cannot render (presentPreview rejects "document is
      // not supported") - e.g. a .zfo envelope.
      //
      // Closing an attachment used to leave the app rendering but deaf to touches, force-quit only.
      // That was NOT a property of either path: react-native-blob-util presented from
      // `keyWindow.rootViewController` (deprecated, and not the topmost controller) and implemented
      // none of the UIDocumentInteractionController dismissal callbacks, so UIKit put the preview in a
      // window it then failed to tear down. Fixed in patches/react-native-blob-util+0.24.9.patch - if
      // this ever regresses, check that patch still applies before suspecting anything here.
      //
      // CAREFUL: react-native-blob-util's LEGACY ALIASES ARE INVERTED - `ios.previewDocument` is
      // presentOptionsMenu (the share sheet!) and `ios.openDocument` is presentPreview. Calling the
      // "preview" alias therefore opened the share menu instead of the document. Always use the
      // unambiguous modern names below. (The JS wrapper prepends `file://`, so pass a bare path.)
      // Its .d.ts types these as returning void; they really return a Promise, hence the casts.
      try {
        await (RNBlobUtil.ios.presentPreview(path) as unknown as Promise<void>);
      } catch {
        await (RNBlobUtil.ios.presentOptionsMenu(path) as unknown as Promise<void>);
      }
    }
  }

  async save(localPath: string, fileName: string, mimeType: string): Promise<boolean> {
    try {
      // `copy: true`: the archive keeps its own file, and the user gets a copy wherever they chose.
      // Encoded (2026-09-15): the sheet parses the URI, and a raw "#" or "%" in the name breaks it.
      await saveDocuments({
        sourceUris: [fileUri(localPath)],
        fileName,
        mimeType,
        copy: true,
      });
      return true;
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
        return false;
      }
      throw e;
    }
  }
}

/**
 * Hand a message's signed original to the user (004 amendment): open it where an app can, save it
 * where none can.
 *
 * The existing path first, because it already does the right thing on iOS - QuickLook cannot render a
 * .zfo, so the options sheet (Files, AirDrop, mail) opens instead, which is saving and sharing both.
 * Android throws `NoViewerError` unless a ZFO reader is installed, and "no app can open this" is the
 * wrong answer for a file whose point is to be kept or passed on, so the system save sheet takes over.
 */
export async function openSignedOriginal(
  opener: AttachmentOpener,
  original: SignedOriginal,
): Promise<'opened' | 'saved' | 'dismissed'> {
  try {
    await opener.open({
      name: original.fileName,
      mimeType: ZFO_MIME_TYPE,
      metaType: 'meta',
      contentBase64: '',
      localPath: original.localPath,
      size: original.size,
    });
    return 'opened';
  } catch (e) {
    if (!(e instanceof NoViewerError)) {
      throw e;
    }
    return (await opener.save(original.localPath, original.fileName, ZFO_MIME_TYPE))
      ? 'saved'
      : 'dismissed';
  }
}

/** The device attachment opener (singleton). */
export const attachmentOpener: AttachmentOpener = new BlobUtilAttachmentOpener();
