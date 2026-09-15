// The transfer on iOS (025 T022).
//
// Until T022 `nativeTransport.available()` answered no on iOS whatever was installed. The iOS module
// now mirrors the Android one, and it is compiled only when the Go framework is linked
// (`ios/ObalkaTransferModule/ObalkaTransferModule.m`), so on iOS "is there a module" IS "is there a
// transfer". These pin both halves: a build with the framework offers the transfer, and a build
// without it (a developer's, with no Go on the Mac) still hides it rather than failing (FR-013).
//
// Each case loads the transport afresh, because a yes is cached for the life of the module.

jest.mock('../../src/services/telemetry/telemetry', () => ({
  reportFailure: jest.fn(),
}));

type Native = {
  available: jest.Mock;
  cancel: jest.Mock;
  send: jest.Mock;
  receive: jest.Mock;
  keepScreenOn: jest.Mock;
};

function fakeModule(): Native {
  return {
    available: jest.fn(async () => true),
    cancel: jest.fn(),
    send: jest.fn(async () => undefined),
    receive: jest.fn(async () => undefined),
    keepScreenOn: jest.fn(),
  };
}

/** The transport as an iOS build loads it, with or without the native module registered. */
function loadOnIos(native: Native | undefined) {
  let transport!: typeof import('../../src/services/transfer/nativeTransport').nativeTransport;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios },
      NativeModules: native ? { ObalkaTransfer: native } : {},
      NativeEventEmitter: class {
        addListener() {
          return { remove: () => undefined };
        }
      },
    }));
    transport = require('../../src/services/transfer/nativeTransport').nativeTransport;
  });
  return transport;
}

afterEach(() => {
  jest.dontMock('react-native');
});

describe('the transfer on iOS', () => {
  it('is available when the module is there, which on iOS means the Go framework is linked', () => {
    expect(loadOnIos(fakeModule()).available()).toBe(true);
  });

  it('stays hidden in a build without the framework, rather than failing (FR-013)', async () => {
    const transport = loadOnIos(undefined);
    expect(transport.available()).toBe(false);
    await expect(
      transport.send('/work/out/1', { secret: 'x', onlyLocal: false }),
    ).rejects.toMatchObject({ name: 'TransferUnavailableError' });
  });

  it('runs through the module with the same arguments as on Android', async () => {
    const native = fakeModule();
    const transport = loadOnIos(native);
    await transport.send('/work/out/1', { secret: '7K2M-ryba-kotva-duha-lampa', onlyLocal: false });
    await transport.receive('/work/in/2', { secret: '7K2M-ryba-kotva-duha-lampa', onlyLocal: false });
    const [sendRun, ...sendArgs] = native.send.mock.calls[0];
    expect(typeof sendRun).toBe('string');
    expect(sendArgs).toEqual(['/work/out/1', '7K2M-ryba-kotva-duha-lampa', false]);
    const [receiveRun, ...receiveArgs] = native.receive.mock.calls[0];
    expect(receiveRun).not.toBe(sendRun);
    expect(receiveArgs).toEqual(['/work/in/2', '7K2M-ryba-kotva-duha-lampa', false]);
  });

  it('keeps the display on through the module, which on iOS is the idle timer', () => {
    const native = fakeModule();
    const transport = loadOnIos(native);
    transport.keepScreenOn(true);
    transport.keepScreenOn(false);
    expect(native.keepScreenOn.mock.calls).toEqual([[true], [false]]);
  });

  it('reads the module s rejection codes as on Android', async () => {
    const native = fakeModule();
    native.send.mockRejectedValueOnce(Object.assign(new Error('phrase refused'), { code: 'phrase' }));
    native.receive.mockRejectedValueOnce(
      Object.assign(new Error('context canceled'), { code: 'cancelled' }),
    );
    const transport = loadOnIos(native);
    await expect(
      transport.send('/work/out/1', { secret: 'x', onlyLocal: false }),
    ).rejects.toMatchObject({ name: 'PhraseRefusedError' });
    await expect(
      transport.receive('/work/in/2', { secret: 'x', onlyLocal: false }),
    ).rejects.toMatchObject({ name: 'TransferCancelledError' });
  });
});
