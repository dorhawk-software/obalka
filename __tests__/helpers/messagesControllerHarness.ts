// The MessagesController harness that messages.test.ts and keepingSignedOriginal.test.ts share: an account, a
// controller built from only the transport calls a test makes (the rest throw), a file store that
// writes nothing, and a downloaded detail with its content inline.

import { MessagesController } from '../../src/features/messages/state/messagesController';
import type { MessagesTransport } from '../../src/features/messages/state/messagesController';
import type { VodzAttachmentDownloader } from '../../src/services/files/vodzAttachmentDownloader';
import { InMemoryMessagesStore, type MessagesStore } from '../../src/services/db/messagesStore';
import type {
  DataBoxAccount,
  MessageDetail,
  MessageEnvelope,
} from '../../src/services/isds/types';
import type { AttachmentFileStore } from '../../src/services/files/attachmentFileStore';
import type { SecureStore } from '../../src/services/secureStore/secureStore';

export const account = (overrides: Partial<DataBoxAccount> = {}): DataBoxAccount => ({
  id: 'a1',
  boxId: 'box1',
  loginName: 'user',
  label: 'ACME',
  dbType: null,
  alias: null,
  authMethod: 'password',
  host: 'czebox',
  secretRef: 'box1',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

export const signal = () => new AbortController().signal;

export type Secrets = Pick<SecureStore, 'readPassword' | 'readSession'>;
/** A store holding the password 'pw' for every box, and no session. */
export const passwordOnly = (): Secrets => ({
  readPassword: async () => ({ status: 'found', value: 'pw' }),
  readSession: async () => ({ status: 'absent' }),
});
export const notConfigured = (name: string) => async (): Promise<never> => {
  throw new Error(`${name} not configured`);
};

// Build a controller from only the transport method(s) a test exercises; the rest throw if called.
export function makeController(
  transport: Partial<MessagesTransport>,
  secrets: Secrets = passwordOnly(),
  messagesStore: MessagesStore = new InMemoryMessagesStore(),
  vodzDownloader?: VodzAttachmentDownloader,
  attachmentFiles?: AttachmentFileStore,
): MessagesController {
  return new MessagesController({
    transport: {
      listReceivedMessages:
        transport.listReceivedMessages ?? notConfigured('listReceivedMessages'),
      getSentMessages:
        transport.getSentMessages ?? notConfigured('getSentMessages'),
      downloadMessage:
        transport.downloadMessage ?? notConfigured('downloadMessage'),
      downloadSignedMessage:
        transport.downloadSignedMessage ?? notConfigured('downloadSignedMessage'),
      markMessageAsDownloaded:
        transport.markMessageAsDownloaded ??
        notConfigured('markMessageAsDownloaded'),
      getCreditInfo: transport.getCreditInfo ?? notConfigured('getCreditInfo'),
      getPasswordInfo: transport.getPasswordInfo ?? notConfigured('getPasswordInfo'),
    },
    secureStore: secrets,
    messagesStore,
    vodzDownloader,
    attachmentFiles,
    now: () => 1000,
  });
}

// A fake file store: persist sets a localPath + size (from the base64 length) and clears the base64.
export const fakeFiles: AttachmentFileStore = {
  async persist(boxId, messageId, attachments) {
    return attachments.map((a, i) =>
      a.localPath
        ? a.size == null
          ? { ...a, size: 1 }
          : a
        : {
            ...a,
            contentBase64: '',
            localPath: `/disk/${boxId}/${messageId}/${i}`,
            size: a.contentBase64.length,
          },
    );
  },
  async persistSignedZfo(boxId, messageId, signatureBase64) {
    return {
      fileName: `DZ_${messageId}.zfo`,
      localPath: `/disk/${boxId}/${messageId}/DZ_${messageId}.zfo`,
      size: signatureBase64.length,
    };
  },
  async removeForBox() {},
  async exists() {
    return true;
  },
  async readBytes() {
    return null; // nothing in this suite reads a file back
  },
};

export const detailWithBase64 = (): MessageDetail => ({
  id: '2',
  subject: 's',
  sender: 'x',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  deliveryTime: 1000,
  acceptanceTime: null,
  attachments: [
    {
      name: 'a.pdf',
      mimeType: 'application/pdf',
      metaType: 'main',
      contentBase64: 'QUJDRA==',
    },
  ],
});

export const envelope = (
  id: string,
  atts = 0,
): MessageEnvelope => ({
  id,
  subject: `s${id}`,
  sender: 'X',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: Number(id),
  acceptanceTime: null,
  state: 6,
  attachmentSize: atts,
});
