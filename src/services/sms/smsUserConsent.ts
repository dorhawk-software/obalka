// The JS face of Android's SMS User Consent API (021).
//
// Guarded exactly like `haptics.ts`: if the native module is not registered - an iOS build, or a JS
// bundle running on an app binary that predates this feature - every call is a silent no-op. A
// convenience must never throw inside a login screen.
//
// What this can and cannot see is worth stating plainly, because "the app reads your SMS" is what a
// user will assume: it cannot read anything. It asks the SYSTEM to watch for one incoming message;
// the system shows a prompt naming the sender; only if the user taps yes does one message's text
// arrive here, once. There is no SMS permission in the manifest and no way to ask for a second
// message without the user agreeing again.

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { otpFromSms } from './otpFromSms';

interface SmsUserConsentNative {
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
}

/**
 * Looked up per call, not once at import.
 *
 * Module registration and JS module evaluation order are not something a screen should depend on,
 * and a value captured at import time is exactly the kind of thing that works in the app and is
 * invisible under a test (or the reverse).
 */
function getNative(): SmsUserConsentNative | undefined {
  if (Platform.OS !== 'android') {
    return undefined;
  }
  return NativeModules.SmsUserConsent as SmsUserConsentNative | undefined;
}

const EVENT = 'SmsUserConsent:message';

/** Whether this build/device can offer the feature at all. */
export function smsAutofillAvailable(): boolean {
  return getNative() != null;
}

/**
 * Listen for the next one-time code until the returned function is called.
 *
 * `onCode` fires at most once, with digits only - the message text never leaves this module. A
 * message that does not clearly state one code produces nothing at all (`otpFromSms`).
 *
 * Returns a stop function in every case, including when there is no native module, so callers need
 * no platform branch and no null check in their cleanup.
 */
export function listenForSmsCode(onCode: (code: string) => void): () => void {
  const native = getNative();
  if (!native) {
    return () => {};
  }
  let live = true;
  const emitter = new NativeEventEmitter(
    NativeModules.SmsUserConsent as never,
  );
  const sub = emitter.addListener(EVENT, (e: { message?: string }) => {
    if (!live) {
      return;
    }
    const code = otpFromSms(e?.message ?? '');
    if (code) {
      onCode(code);
    }
  });
  void native.start().catch(() => {
    // Play services absent or refusing: nothing to tell the user, whose screen is unchanged.
  });
  return () => {
    live = false;
    sub.remove();
    void native.stop().catch(() => {});
  };
}
