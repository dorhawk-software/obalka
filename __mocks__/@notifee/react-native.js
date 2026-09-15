// Jest mock for Notifee (no native side in tests).
//
// Reminder-only surface. 014 removed this library entirely; it returns for feature 010's user-set
// deadlines, which are permissible because the timer belongs to the OS and involves no ISDS call.
// If a test ever needs `displayNotification` back, ask what is calling it — the app has no code path
// that learns something worth announcing on its own.
module.exports = {
  __esModule: true,
  default: {
    requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    /** Read-only permission state (2026-09-24): the "notifications are off" line on a reminder. */
    getNotificationSettings: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    isChannelBlocked: jest.fn(() => Promise.resolve(false)),
    openNotificationSettings: jest.fn(() => Promise.resolve()),
    createChannel: jest.fn(() => Promise.resolve('channel')),
    deleteChannel: jest.fn(() => Promise.resolve()),
    setNotificationCategories: jest.fn(() => Promise.resolve()),
    /** Scheduled ("trigger") notifications — the whole point of the reminder feature. */
    createTriggerNotification: jest.fn(() => Promise.resolve('id')),
    cancelTriggerNotification: jest.fn(() => Promise.resolve()),
    getTriggerNotificationIds: jest.fn(() => Promise.resolve([])),
    onForegroundEvent: jest.fn(() => () => {}),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  AndroidVisibility: { PRIVATE: 0, PUBLIC: 1, SECRET: -1 },
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
  TriggerType: { TIMESTAMP: 0, INTERVAL: 1 },
  EventType: { DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3 },
};
