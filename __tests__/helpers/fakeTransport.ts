// Shared test double for the ISDS transport. NOT a test suite (lives under __tests__/helpers/,
// excluded via jest.config testPathIgnorePatterns).

import type { IsdsTransport } from '../../src/services/isds/transport';
import type { OwnerInfo } from '../../src/services/isds/types';

export function ownerInfo(overrides: Partial<OwnerInfo> = {}): OwnerInfo {
  return {
    boxId: 'box123',
    label: 'Jan Novák',
    dbType: null,
    passwordExpiresAt: null,
    ...overrides,
  };
}

const unconfigured = (name: string) => async (): Promise<never> => {
  throw new Error(`FakeTransport.${name} was called but not configured`);
};

/** Build an IsdsTransport with only the methods a test needs; others throw if unexpectedly called. */
export function makeTransport(
  impl: Partial<IsdsTransport> = {},
): IsdsTransport {
  return {
    passwordLogin: impl.passwordLogin ?? unconfigured('passwordLogin'),
    otpBegin: impl.otpBegin ?? unconfigured('otpBegin'),
    otpSubmit: impl.otpSubmit ?? unconfigured('otpSubmit'),
    resendSms: impl.resendSms ?? unconfigured('resendSms'),
    mepBegin: impl.mepBegin ?? unconfigured('mepBegin'),
    mepPoll: impl.mepPoll ?? unconfigured('mepPoll'),
    mepConfirm: impl.mepConfirm ?? unconfigured('mepConfirm'),
    // Cleanup that every sign-in stopping short calls, so not an unexpected call; a test about the
    // jar passes its own.
    abandonLogin: impl.abandonLogin ?? (async () => {}),
    listReceivedMessages:
      impl.listReceivedMessages ?? unconfigured('listReceivedMessages'),
    downloadMessage: impl.downloadMessage ?? unconfigured('downloadMessage'),
    downloadSignedMessage:
      impl.downloadSignedMessage ?? unconfigured('downloadSignedMessage'),
    markMessageAsDownloaded:
      impl.markMessageAsDownloaded ?? unconfigured('markMessageAsDownloaded'),
    findRecipients: impl.findRecipients ?? unconfigured('findRecipients'),
    sendMessage: impl.sendMessage ?? unconfigured('sendMessage'),
    sendBigMessage: impl.sendBigMessage ?? unconfigured('sendBigMessage'),
    getCreditInfo: impl.getCreditInfo ?? unconfigured('getCreditInfo'),
    getSentMessages: impl.getSentMessages ?? unconfigured('getSentMessages'),
  };
}

/** A never-aborted signal for tests that don't exercise cancellation. */
export function liveSignal(): AbortSignal {
  return new AbortController().signal;
}
