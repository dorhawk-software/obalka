// Login state machine (feature 001).
//
// A PURE reducer: (state, event) -> state. It models every step of the login journey so the UI
// always has a well-defined, recoverable state. There is no unhandled transition - unknown events
// return the current state unchanged - which is the structural guarantee that the final OTP step
// (and every other step) cannot crash (spec SC-002, constitution Principle II).

import type {
  LoginErrorCode,
  LoginOutcome,
  OwnerInfo,
  ServerNotice,
} from '../../../services/isds/types';

export type LoginState =
  | { status: 'idle' }
  | { status: 'authenticating' }
  | { status: 'awaitingSmsCode'; notice?: ServerNotice } // SMS code sent
  // Mobilní klíč: waiting for the user to approve the push. mkStatus = mepWsStateUpdate2 code.
  | { status: 'awaitingMobileKey'; mkStatus: number; mkDescription: string }
  | { status: 'signedIn'; ownerInfo: OwnerInfo }
  | { status: 'error'; code: LoginErrorCode; messageKey: string; suggestOtp?: boolean }
  | { status: 'reauthRequired'; boxId: string };

export type LoginEvent =
  | { type: 'SUBMIT_CREDENTIALS' } // user submitted login+password (any method) -> authenticating
  | { type: 'SUBMIT_OTP' } // user submitted an OTP code -> authenticating
  | { type: 'SUBMIT_MOBILE_KEY' } // user started Mobile Key login -> awaitingMobileKey
  | { type: 'MOBILE_KEY_STATUS'; status: number; description: string } // a poll status update
  | { type: 'RESEND_SMS' } // user asked to resend the TOTP SMS -> authenticating
  | { type: 'OUTCOME'; outcome: LoginOutcome } // a transport/AuthService result arrived
  | { type: 'CANCEL' } // user cancelled an in-flight attempt
  | { type: 'RETRY' } // user dismissed an error to try again
  | { type: 'SESSION_INVALIDATED'; boxId: string }; // later op found the session expired (US5)

export const initialLoginState: LoginState = { status: 'idle' };

function applyOutcome(outcome: LoginOutcome): LoginState {
  switch (outcome.kind) {
    case 'signedIn':
      return { status: 'signedIn', ownerInfo: outcome.ownerInfo };
    case 'needsOtpSms':
      return { status: 'awaitingSmsCode', notice: outcome.notice };
    case 'error':
      return {
        status: 'error',
        code: outcome.code,
        messageKey: outcome.messageKey,
        suggestOtp: outcome.suggestOtp,
      };
    default:
      // Exhaustiveness guard: an unforeseen outcome never throws; we stay put.
      return { status: 'idle' };
  }
}

/** Pure transition. Never throws; unknown (state, event) pairs return `state` unchanged. */
export function loginTransition(
  state: LoginState,
  event: LoginEvent,
): LoginState {
  // A session can be invalidated from almost any state (a later authenticated call fails).
  if (event.type === 'SESSION_INVALIDATED') {
    return { status: 'reauthRequired', boxId: event.boxId };
  }

  switch (state.status) {
    case 'idle':
      if (event.type === 'SUBMIT_CREDENTIALS') {
        return { status: 'authenticating' };
      }
      if (event.type === 'SUBMIT_MOBILE_KEY') {
        return { status: 'awaitingMobileKey', mkStatus: 1, mkDescription: '' };
      }
      return state;

    case 'authenticating':
      if (event.type === 'OUTCOME') {
        return applyOutcome(event.outcome);
      }
      if (event.type === 'CANCEL') {
        return { status: 'idle' };
      }
      return state;

    case 'awaitingSmsCode':
      if (event.type === 'SUBMIT_OTP' || event.type === 'RESEND_SMS') {
        return { status: 'authenticating' };
      }
      if (event.type === 'OUTCOME') {
        return applyOutcome(event.outcome);
      }
      if (event.type === 'CANCEL') {
        return { status: 'idle' };
      }
      return state;

    case 'awaitingMobileKey':
      if (event.type === 'MOBILE_KEY_STATUS') {
        return {
          status: 'awaitingMobileKey',
          mkStatus: event.status,
          mkDescription: event.description,
        };
      }
      if (event.type === 'OUTCOME') {
        return applyOutcome(event.outcome);
      }
      if (event.type === 'CANCEL') {
        return { status: 'idle' };
      }
      return state;

    case 'error':
      if (event.type === 'RETRY') {
        return { status: 'idle' };
      }
      if (event.type === 'SUBMIT_CREDENTIALS') {
        return { status: 'authenticating' };
      }
      if (event.type === 'SUBMIT_MOBILE_KEY') {
        return { status: 'awaitingMobileKey', mkStatus: 1, mkDescription: '' };
      }
      return state;

    case 'reauthRequired':
      if (event.type === 'SUBMIT_CREDENTIALS') {
        return { status: 'authenticating' };
      }
      if (event.type === 'OUTCOME') {
        return applyOutcome(event.outcome);
      }
      if (event.type === 'CANCEL') {
        return { status: 'idle' };
      }
      return state;

    case 'signedIn':
      return state;

    default:
      return state;
  }
}
