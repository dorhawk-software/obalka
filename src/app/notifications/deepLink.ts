// Notification deep-link resolution - the PURE core, unit-tested in isolation.
//
// Written for 011's new-mail notifications, removed with them in 014, and restored by 010 for the one
// notification the app now has: a deadline reminder the user set themselves. The logic did not need
// to change, which is the point - it maps a payload to a navigation target and knows nothing about
// why the notification was posted.
//
// A tapped reminder carries its owning box and message in the payload `data`. This maps that payload
// to a navigation target, given the boxes that currently exist and whether the message is still
// cached. Total + crash-safe (Principle II): every degraded case resolves to a sensible target
// instead of throwing -
//   • owning box gone/unknown → `none`    (the caller stays on / returns to the active inbox)
//   • message gone or absent  → `inbox`   (switch to the box, show its inbox)
//   • box + message present   → `message`  (switch to the box, open the message)
//
// The middle case is not hypothetical here. A reminder deliberately OUTLIVES the message content:
// ISDS erases at 90 days and the local archive keeps its own copy, so a reminder can fire on a
// message the cache no longer holds. Landing on that box's inbox is the honest degradation.

/** The `data` Notifee carries on a reminder notification (all values are strings on the wire). */
export interface NotificationPayload {
  boxId?: string;
  messageId?: string;
}

export type DeepLinkTarget =
  | { kind: 'message'; boxId: string; messageId: string }
  | { kind: 'inbox'; boxId: string }
  | { kind: 'none' };

export function resolveDeepLink(
  payload: NotificationPayload | null | undefined,
  boxIds: string[],
  messageExists: boolean,
): DeepLinkTarget {
  const boxId = payload?.boxId;
  if (!boxId || !boxIds.includes(boxId)) {
    return { kind: 'none' };
  }
  const messageId = payload?.messageId;
  if (messageId && messageExists) {
    return { kind: 'message', boxId, messageId };
  }
  return { kind: 'inbox', boxId };
}
