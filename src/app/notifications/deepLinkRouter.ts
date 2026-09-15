// Notification deep-link router (011, restored by 010): bridges a tapped notification (which fires
// OUTSIDE the React tree - foreground event, background event, or the cold-start initial
// notification) into the app's active-box + navigation state.
//
// A small bus decouples the Notifee events from the shell: events call `handleNotificationPayload`,
// AppShell registers the live `resolver` once the navigator + accounts are ready (`setDeepLinkResolver`).
// A tap that arrives before the resolver exists (cold start) is QUEUED and drained on registration -
// so a notification that launched the app still opens the right box + message. NEVER throws
// (Principle II): a notification must never crash the app.
//
// This is what makes a reminder worth sending. A notification that only raises the app, leaving the
// user to find the message it was about, is a nudge with the useful half removed - and the payload
// was already being attached (`notifeeNotifier.ts`), so without this the data was written and
// silently dropped.

import notifee, { EventType } from '@notifee/react-native';
import { reportFailure } from '../../services/telemetry/telemetry';
import type { NotificationPayload } from './deepLink';

type Resolver = (payload: NotificationPayload) => void | Promise<void>;

let resolver: Resolver | null = null;
let pending: NotificationPayload | null = null;

/**
 * AppShell registers (and on unmount clears) the live resolver - set active box, persist, navigate.
 * On registration any queued cold-start tap is drained immediately.
 */
export function setDeepLinkResolver(next: Resolver | null): void {
  resolver = next;
  if (next && pending) {
    const queued = pending;
    pending = null;
    void runResolver(next, queued);
  }
}

/** Hand a tapped notification's payload to the resolver, or queue it until one registers. */
export function handleNotificationPayload(
  data: NotificationPayload | null | undefined,
): void {
  if (!data || !data.boxId) {
    return; // nothing actionable (e.g. a re-auth alert with no box) - ignore
  }
  // Normalize to a plain { boxId, messageId } (Notifee data values are strings).
  const payload: NotificationPayload = {
    boxId: String(data.boxId),
    ...(data.messageId ? { messageId: String(data.messageId) } : {}),
  };
  if (resolver) {
    void runResolver(resolver, payload);
  } else {
    pending = payload; // cold start - the navigator/accounts aren't ready yet; drain on register
  }
}

async function runResolver(fn: Resolver, payload: NotificationPayload): Promise<void> {
  try {
    await fn(payload);
  } catch (e) {
    // The user tapped a reminder they set and the app did not take them to the message. They have
    // no way to report that usefully and we have no way to see it - it is a tap that did nothing.
    reportFailure('deepLink', e);
    // best-effort - a deep-link must never crash the app
  }
}

/** True only for a notification PRESS event carrying a deep-linkable payload. */
function isPress(type: EventType, notification?: { data?: unknown }): boolean {
  return type === EventType.PRESS && notification != null;
}

/**
 * Subscribe to FOREGROUND notification taps (app open). Returns an unsubscribe. Called by AppShell.
 */
export function registerForegroundNotificationHandler(): () => void {
  try {
    return notifee.onForegroundEvent(({ type, detail }) => {
      if (isPress(type, detail.notification)) {
        handleNotificationPayload(
          detail.notification?.data as NotificationPayload | undefined,
        );
      }
    });
  } catch (e) {
    // The foreground listener is how a tapped reminder reaches a screen. Failing to register it
    // makes every reminder tap do nothing, for the whole session, silently.
    reportFailure('notify.schedule', e, { stage: 'native' });
    return () => {};
  }
}

/**
 * Register the BACKGROUND notification handler - MUST be called once at the JS entry point (index.js),
 * since it can run with the app backgrounded/quit. A PRESS brings the app forward; the payload is
 * queued here and drained once the shell's resolver registers (or picked up via getInitialNotification
 * on a cold start). Never throws.
 */
export function registerBackgroundNotificationHandler(): void {
  try {
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (isPress(type, detail.notification)) {
        handleNotificationPayload(
          detail.notification?.data as NotificationPayload | undefined,
        );
      }
    });
  } catch (e) {
    // best-effort - registration failing must not break app startup, but a reminder tapped while
    // the app is quit then goes nowhere.
    reportFailure('notify.schedule', e, { stage: 'native' });
  }
}

/**
 * On cold start, pick up the notification that launched the app (if any) and route it. Called by
 * AppShell on mount; the payload is queued until the resolver is ready. Never throws.
 */
export async function consumeInitialNotification(): Promise<void> {
  try {
    const initial = await notifee.getInitialNotification();
    if (initial?.notification) {
      handleNotificationPayload(
        initial.notification.data as NotificationPayload | undefined,
      );
    }
  } catch (e) {
    // best-effort - no initial notification / API unavailable
    reportFailure('deepLink', e, { stage: 'native' });
  }
}
