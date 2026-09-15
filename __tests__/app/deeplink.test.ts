// Notification deep-link resolution (011, restored by 010). Covers the PURE resolver (payload →
// target, incl. the missing-box / missing-message degradations - Principle II) and the router BUS
// that queues a cold-start tap until the shell's resolver is ready.
//
// The notification this routes is now a user-set deadline reminder rather than 011's new-mail alert.
// The "message gone → that box's inbox" case matters MORE than it did: a reminder deliberately
// outlives the message content ISDS erases at 90 days.

import { resolveDeepLink } from '../../src/app/notifications/deepLink';
import {
  handleNotificationPayload,
  setDeepLinkResolver,
} from '../../src/app/notifications/deepLinkRouter';

describe('resolveDeepLink', () => {
  const boxes = ['b1', 'b2'];

  it('box + message both present → open the message', () => {
    expect(resolveDeepLink({ boxId: 'b1', messageId: 'm9' }, boxes, true)).toEqual({
      kind: 'message',
      boxId: 'b1',
      messageId: 'm9',
    });
  });

  it('message gone (or absent) → the box inbox', () => {
    expect(resolveDeepLink({ boxId: 'b1', messageId: 'm9' }, boxes, false)).toEqual({
      kind: 'inbox',
      boxId: 'b1',
    });
    expect(resolveDeepLink({ boxId: 'b2' }, boxes, false)).toEqual({
      kind: 'inbox',
      boxId: 'b2',
    });
  });

  it('owning box gone/unknown → none (caller stays on the active inbox)', () => {
    expect(resolveDeepLink({ boxId: 'gone', messageId: 'm9' }, boxes, true)).toEqual({
      kind: 'none',
    });
    expect(resolveDeepLink(null, boxes, true)).toEqual({ kind: 'none' });
    expect(resolveDeepLink({}, boxes, true)).toEqual({ kind: 'none' });
  });
});

describe('deep-link router bus', () => {
  beforeEach(() => {
    // Reset module state: register a throwaway resolver (drains any queued payload) then clear it.
    setDeepLinkResolver(jest.fn());
    setDeepLinkResolver(null);
  });

  it('dispatches immediately to a registered resolver', () => {
    const resolver = jest.fn();
    setDeepLinkResolver(resolver);
    handleNotificationPayload({ boxId: 'b1', messageId: 'm1' });
    expect(resolver).toHaveBeenCalledWith({ boxId: 'b1', messageId: 'm1' });
  });

  it('queues a tap with no resolver yet (cold start) and drains it on registration', () => {
    handleNotificationPayload({ boxId: 'b7' });
    const resolver = jest.fn();
    setDeepLinkResolver(resolver); // navigator + accounts now ready
    expect(resolver).toHaveBeenCalledWith({ boxId: 'b7' });
  });

  it('ignores a payload with no box (e.g. a re-auth alert)', () => {
    const resolver = jest.fn();
    setDeepLinkResolver(resolver);
    handleNotificationPayload({ messageId: 'm1' });
    handleNotificationPayload(null);
    expect(resolver).not.toHaveBeenCalled();
  });
});
