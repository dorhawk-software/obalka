// Jest mock for react-native-blob-util: an in-memory fs + no-op system viewers. The native module
// writes files and launches the OS viewer on-device; under jest we only need the API to resolve so
// screens that render/open attachments can mount and the file/opener services are unit-testable.
const files = new Map();

const fs = {
  dirs: { CacheDir: '/cache', DocumentDir: '/docs' },
  writeFile: jest.fn(async (path, data) => {
    // Mimic the native base64 decoder rejecting malformed input (the 'BAD' sentinel in tests).
    if (data === 'BAD') {
      throw new Error('bad base-64');
    }
    files.set(path, data);
  }),
  unlink: jest.fn(async path => {
    files.delete(path);
    // A directory unlink removes everything beneath it (react-native-blob-util is recursive).
    for (const k of [...files.keys()]) {
      if (k.startsWith(path + '/')) {
        files.delete(k);
      }
    }
  }),
  exists: jest.fn(
    async path =>
      files.has(path) || [...files.keys()].some(k => k.startsWith(path + '/')),
  ),
  mkdir: jest.fn(async () => {}),
  stat: jest.fn(async path => ({ size: (files.get(path) ?? '').length })),
  // Added for the backup's file target (006): it lists a directory and reads files back.
  ls: jest.fn(async dir =>
    [...files.keys()]
      .filter(k => k.startsWith(dir + '/'))
      .map(k => k.slice(dir.length + 1))
      // Direct children only, the way the native `ls` behaves.
      .filter(name => !name.includes('/')),
  ),
  readFile: jest.fn(async path => {
    if (!files.has(path)) {
      throw new Error(`ENOENT: ${path}`);
    }
    return files.get(path);
  }),
};

module.exports = {
  __esModule: true,
  default: {
    fs,
    android: { actionViewIntent: jest.fn(async () => {}) },
    ios: {
      openDocument: jest.fn(async () => {}),
      previewDocument: jest.fn(async () => {}),
      // Marks a path excluded from the phone's backup (2026-09-24); a no-op here, asserted by calls.
      excludeFromBackupKey: jest.fn(async () => {}),
    },
  },
};
