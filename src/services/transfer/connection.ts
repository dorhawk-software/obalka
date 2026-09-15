// Whether this phone is on a connection the user pays by the megabyte (025 T018).
//
// Asked for one thing: to decide whether a transfer big enough to matter deserves a question before
// it starts. Nothing here watches the network, subscribes to it, or records anything - it is a
// single read at the moment somebody taps "send".
//
// Dynamic, like every other native thing in this feature: a build without NetInfo answers "unknown"
// and the transfer proceeds without the extra question, rather than the screen breaking over a
// courtesy.

import { reportFailure } from '../telemetry/telemetry';

/**
 * `true` metered, `false` not, `null` not known.
 *
 * The null is the useful one. "Not known" must not be treated as "metered" - that would put a
 * confirmation in front of every transfer on a build where the module is missing - and must not be
 * treated as "free" either, which is why it is a third value rather than a default.
 */
export async function isMetered(): Promise<boolean | null> {
  try {
    const mod = require('@react-native-community/netinfo');
    const netInfo = mod?.default ?? mod;
    if (typeof netInfo?.fetch !== 'function') {
      return null;
    }
    const state = await netInfo.fetch();
    if (typeof state?.details?.isConnectionExpensive === 'boolean') {
      // The platform's own answer, which knows about metered Wi-Fi as well as cellular.
      return state.details.isConnectionExpensive;
    }
    if (typeof state?.type === 'string') {
      return state.type === 'cellular';
    }
    return null;
  } catch (e) {
    reportFailure('transfer.native', e, { stage: 'native' });
    return null;
  }
}

/**
 * Above this, a transfer on a metered connection asks first.
 *
 * 5 MB, and the number is a judgement rather than a measurement: a metadata-only archive is about
 * 15 kB and asking about that would be noise, while an archive with documents runs to megabytes and
 * is the case somebody on a mobile plan would want to be asked about. Set low enough that the
 * documents tier always trips it, high enough that the common transfer never does.
 */
export const METERED_ASK_BYTES = 5 * 1024 * 1024;
