// Jest mock for react-native-keychain: an in-memory keystore keyed by `service`.
const store = new Map();

module.exports = {
  ACCESSIBLE: {
    WHEN_UNLOCKED: 'AccessibleWhenUnlocked',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
  },
  ACCESS_CONTROL: {
    BIOMETRY_ANY: 'BiometryAny',
    BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'BiometryAnyOrDevicePasscode',
    DEVICE_PASSCODE: 'DevicePasscode',
  },
  AUTHENTICATION_TYPE: {
    BIOMETRICS: 'Biometrics',
    DEVICE_PASSCODE_OR_BIOMETRICS: 'AuthenticationWithBiometricsDevicePasscode',
  },
  BIOMETRY_TYPE: { TOUCH_ID: 'TouchID', FACE_ID: 'FaceID' },
  STORAGE_TYPE: {
    AES_CBC: 'KeystoreAESCBC',
    AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth',
    AES_GCM: 'KeystoreAESGCM',
    RSA: 'KeystoreRSAECB',
  },
  setGenericPassword: jest.fn(async (username, password, options = {}) => {
    store.set(options.service ?? 'default', { username, password, service: options.service });
    return true;
  }),
  getGenericPassword: jest.fn(async (options = {}) => store.get(options.service ?? 'default') ?? false),
  resetGenericPassword: jest.fn(async (options = {}) => {
    store.delete(options.service ?? 'default');
    return true;
  }),
  getSupportedBiometryType: jest.fn(async () => null),
  hasGenericPassword: jest.fn(async (options = {}) => store.has(options.service ?? 'default')),
  isPasscodeAuthAvailable: jest.fn(async () => true),
};
