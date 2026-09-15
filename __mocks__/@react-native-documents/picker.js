// Manual jest mock — the real module binds a native TurboModule that doesn't exist under jest.
// Tests don't exercise picking; this just lets screens that import the picker render.
module.exports = {
  pick: jest.fn(async () => []),
  keepLocalCopy: jest.fn(async () => []),
  saveDocuments: jest.fn(async () => []),
  pickDirectory: jest.fn(async () => null),
  types: { allFiles: 'public.item' },
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: () => false,
};
