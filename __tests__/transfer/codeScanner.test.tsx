// The viewfinder hands over ONE code (audit 2026-09-23), read by a decoder that reports to nobody
// (2026-09-24).
//
// The camera delivers frames faster than React renders. The scanner stopped itself with state, which
// takes effect a render later, so two frames holding the same code both got through and `onFound`
// fired twice - a second receive started on top of the first. The native camera is replaced by a
// stand-in that lets the test deliver frames itself.
//
// Since ML Kit was removed, each platform has its own decoder: Apple's `AVCaptureMetadataOutput`
// (VisionCamera's `useObjectOutput`) on iOS, and zxing-cpp as a frame processor on Android. Both are
// driven here through the same contract - QR only, the value handed over once, the guard intact - so
// neither can drift from the other.

import { act, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import {
  TransferCodeScanner,
  scanningAvailable,
} from '../../src/features/transfer/screens/CodeScanner';
import { encodeTransferQr } from '../../src/services/transfer/transferQr';
import { encodeKeyQr, parseKeyQr } from '../../src/services/backup/keyQr';
import { generateRecoveryKey } from '../../src/services/backup/recoveryKey';
import { t } from '../../src/i18n/strings';
import { reportFailure } from '../../src/services/telemetry/telemetry';

jest.mock('../../src/services/telemetry/telemetry', () => ({
  reportFailure: jest.fn(),
}));

type ScannedObject = { type: string; value?: string };
type FakeFrame = { dispose: jest.Mock };

// What the stand-in camera was last rendered with, and the outputs attached to it.
let mockCamera: { isActive: boolean; outputs: unknown[] } | null = null;
let mockObjectOutput: {
  types: string[];
  onObjectsScanned: (objects: ScannedObject[]) => void;
} | null = null;
let mockFrameOutput: { pixelFormat: string; onFrame: (frame: FakeFrame) => void } | null = null;
let mockScannerFormats: string[] | null = null;
// What zxing "sees" in the next frame: values, or an error to throw.
let mockNextFrame: { rawValue?: string }[] | Error = [];

jest.mock('react-native-vision-camera', () => ({
  useCameraPermission: () => ({ hasPermission: true, requestPermission: async () => true }),
  useCameraDevice: () => ({ id: 'back' }),
  Camera: (props: { isActive: boolean; outputs: unknown[] }) => {
    mockCamera = props;
    return null;
  },
  isScannedCode: (object: ScannedObject) => object.type !== 'face',
  useObjectOutput: (props: NonNullable<typeof mockObjectOutput>) => {
    mockObjectOutput = props;
    return { kind: 'object-output' };
  },
  useFrameOutput: (props: NonNullable<typeof mockFrameOutput>) => {
    mockFrameOutput = props;
    return { kind: 'frame-output' };
  },
}));

const mockZxing: { useBarcodeScanner?: (options: { barcodeFormats: string[] }) => unknown } = {
  useBarcodeScanner: ({ barcodeFormats }) => {
    mockScannerFormats = barcodeFormats;
    return {
      scanCodes: () => {
        if (mockNextFrame instanceof Error) {
          throw mockNextFrame;
        }
        return mockNextFrame;
      },
    };
  },
};
jest.mock('react-native-nitro-zxing', () => mockZxing);
jest.mock('react-native-vision-camera-worklets', () => ({ provider: {} }));

const PHRASE = '7K2M-ryba-kotva-duha-lampa';
const realOS = Platform.OS;

function onPlatform(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });
}

const scanner = (
  onFound: (value: string) => void,
  parse?: (scanned: string) => string | null,
) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>
        <TransferCodeScanner onFound={onFound} onCancel={() => {}} parse={parse} />
      </AppThemeProvider>
    </TamaguiProvider>,
  );

beforeEach(() => {
  mockCamera = null;
  mockObjectOutput = null;
  mockFrameOutput = null;
  mockScannerFormats = null;
  mockNextFrame = [];
  jest.mocked(reportFailure).mockClear();
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true, writable: true });
});

// One frame, as each platform's decoder delivers it to the component.
const deliverers = {
  ios: (values: (string | undefined)[]) => {
    mockObjectOutput!.onObjectsScanned(values.map(value => ({ type: 'qr', value })));
  },
  android: (values: (string | undefined)[]) => {
    mockNextFrame = values.map(rawValue => ({ rawValue }));
    mockFrameOutput!.onFrame({ dispose: jest.fn() });
  },
};

describe.each(['ios', 'android'] as const)('the code scanner on %s', os => {
  const frame = deliverers[os];

  beforeEach(() => onPlatform(os));

  it('is offered, and attaches exactly one decoder output to the camera', async () => {
    expect(scanningAvailable()).toBe(true);
    await scanner(jest.fn());
    expect(mockCamera).not.toBeNull();
    expect(mockCamera!.outputs).toHaveLength(1);
    // The decoder that belongs to this platform, and only that one.
    expect(mockObjectOutput != null).toBe(os === 'ios');
    expect(mockFrameOutput != null).toBe(os === 'android');
  });

  it('asks its decoder for QR codes and nothing else', async () => {
    await scanner(jest.fn());
    if (os === 'ios') {
      expect(mockObjectOutput!.types).toEqual(['qr']);
    } else {
      expect(mockScannerFormats).toEqual(['qr-code']);
      // The luminance plane is what zxing reads; YUV hands it over without a conversion.
      expect(mockFrameOutput!.pixelFormat).toBe('yuv');
    }
  });

  it('hands over the code once when two frames hold it before the screen re-renders', async () => {
    const onFound = jest.fn();
    await scanner(onFound);

    await act(async () => {
      frame([encodeTransferQr(PHRASE)]);
      frame([encodeTransferQr(PHRASE)]);
    });

    expect(onFound).toHaveBeenCalledTimes(1);
    expect(onFound).toHaveBeenCalledWith(PHRASE);
    // …and the preview is turned off.
    expect(mockCamera!.isActive).toBe(false);
  });

  it('ignores what is not one of ours, and still takes ours after it', async () => {
    const onFound = jest.fn();
    await scanner(onFound);

    await act(async () => {
      frame(['WIFI:S:kavarna;T:WPA;P:heslo;;']);
      frame([undefined, 'https://example.org/jizdni-rad', encodeTransferQr(PHRASE)]);
    });

    expect(onFound).toHaveBeenCalledTimes(1);
    expect(onFound).toHaveBeenCalledWith(PHRASE);
  });

  it('reads a recovery key with the parser it is given, and refuses a transfer phrase there', async () => {
    const onFound = jest.fn();
    const key = generateRecoveryKey();
    await scanner(onFound, parseKeyQr);

    await act(async () => {
      frame([encodeTransferQr(PHRASE)]);
      frame([encodeKeyQr(key)]);
    });

    expect(onFound).toHaveBeenCalledTimes(1);
    expect(onFound).toHaveBeenCalledWith(key);
  });
});

describe('the code scanner on iOS', () => {
  beforeEach(() => onPlatform('ios'));

  it('passes over what the system detector found that is not a code', async () => {
    const onFound = jest.fn();
    await scanner(onFound);

    await act(async () => {
      mockObjectOutput!.onObjectsScanned([{ type: 'face' }]);
    });

    expect(onFound).not.toHaveBeenCalled();
    expect(mockCamera!.isActive).toBe(true);
  });
});

describe('the code scanner on Android', () => {
  beforeEach(() => onPlatform('android'));

  it('hands every frame back to the camera, including one the decoder choked on', async () => {
    await scanner(jest.fn());
    const quiet = { dispose: jest.fn() };
    const broken = { dispose: jest.fn() };

    mockNextFrame = [];
    await act(async () => {
      mockFrameOutput!.onFrame(quiet);
    });
    mockNextFrame = new Error('decoder failed');
    await act(async () => {
      mockFrameOutput!.onFrame(broken);
    });

    expect(quiet.dispose).toHaveBeenCalledTimes(1);
    expect(broken.dispose).toHaveBeenCalledTimes(1);
    // A decoder failure is reported and ends the scan in the same place a camera failure does.
    expect(reportFailure).toHaveBeenCalledWith(
      'transfer.native',
      expect.any(Error),
      { stage: 'native' },
    );
    expect(screen.getByText(t('transfer.scan.denied'))).toBeTruthy();
  });

  it('is not offered on a build without the decoder', () => {
    const useBarcodeScanner = mockZxing.useBarcodeScanner;
    delete mockZxing.useBarcodeScanner;
    try {
      expect(scanningAvailable()).toBe(false);
    } finally {
      mockZxing.useBarcodeScanner = useBarcodeScanner;
    }
  });
});
