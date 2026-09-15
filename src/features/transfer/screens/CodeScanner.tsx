// Reading a code off the other phone's screen (025, and 006 T012b rides on it).
//
// The camera is the app's first, and it is asked for ONE thing: pointing at another phone across a
// table. Nothing here takes a photograph, nothing is written to disk, and the preview is live only
// while this component is mounted. What leaves it is a string that `parseTransferQr` has already
// decided is one of ours — a code that is not is dropped without the caller ever seeing it, because
// a camera pointed at a table sees timetables, Wi-Fi codes and payment QRs, and PAKE gives exactly
// one guess per attempt.
//
// The PARSER IS PASSED IN, so the same viewfinder reads a transfer phrase and a recovery key without
// either knowing about the other. That matters beyond tidiness: the two codes carry different
// prefixes precisely so one cannot be mistaken for the other, and a scanner hard-wired to one of
// them would have had to grow a mode flag to serve both - which is the shape that eventually accepts
// the wrong one.
//
// The IMPORT IS DYNAMIC, and that is the whole reason this file exists separately. Loading
// `react-native-vision-camera` at module scope would make the transfer screen - and everything that
// imports it - fail on a build without the native camera, which is the failure mode `bulkCipher.ts`
// and `nativeTransport.ts` both avoid. Here, a missing camera means the scan button is not offered.
// The TYPES are imported statically (`import type` loads nothing at runtime), so what the dynamic
// require hands back is still checked - a wrong format string is a compile error, not a red box.
//
// NO ML KIT, and no other decoder that reports home (2026-09-24). The first version read codes with
// `react-native-vision-camera-barcode-scanner`, which is Google ML Kit on both platforms - and ML Kit
// sends device and app details, a device identifier, latency figures and usage events to Google, with
// no switch to turn that off (Google's own Play data-disclosure page lists the data and offers none).
// Telemetry for reading a QR code off the other phone is data to a third party the user never chose
// (constitution III). So each platform now decodes on the device, with code that has no network in it:
//
//   * iOS: Apple's own detector, `AVCaptureMetadataOutput`, which VisionCamera's core already wraps as
//     `useObjectOutput`. It is part of the OS - nothing extra is linked for it.
//   * Android: zxing-cpp (Apache-2.0) through `react-native-nitro-zxing`, run as a frame processor on
//     VisionCamera's frame output. The decoder is plain C++ reading the frame's luminance plane.
//     `react-native-vision-camera-worklets` is what lets a frame processor run at all. Neither is
//     linked on iOS (`react-native.config.js`), where there is nothing for them to do.
//
// Both hand this file the same thing - every string decoded in one frame - so everything after that
// point, the parser and the one-code-only guard, is one path on both platforms.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { scheduleOnRN } from 'react-native-worklets';
import type * as VisionCamera from 'react-native-vision-camera';
import type * as NitroZxing from 'react-native-nitro-zxing';
import { XStack, YStack } from '../../../theme/ui';
import { Body, BodyStrong } from '../../../theme/Typography';
import { PressScale } from '../../../theme/PressScale';
import { useTheme } from '../../../theme/ThemeProvider';
import { CloseIcon } from '../../../theme/icons';
import { t } from '../../../i18n/strings';
import { parseTransferQr } from '../../../services/transfer/transferQr';
import { reportFailure } from '../../../services/telemetry/telemetry';

type CameraModule = typeof VisionCamera;
type ZxingModule = typeof NitroZxing;

/**
 * A camera output that reads QR codes, whichever decoder is behind it. `onCodes` gets every value one
 * frame held, on the JS thread; `onError` gets what went wrong in the decoder.
 */
type QrOutputHook = (
  onCodes: (values: string[]) => void,
  onError: (error: unknown) => void,
) => VisionCamera.CameraOutput;

type CameraModules = {
  readonly useCameraPermission: CameraModule['useCameraPermission'];
  readonly useCameraDevice: CameraModule['useCameraDevice'];
  readonly Camera: CameraModule['Camera'];
  readonly useQrOutput: QrOutputHook;
};

// QR ONLY, on both decoders. Everything this app shows as a code is a QR code; a scanner that also
// read EAN or PDF417 would spend its time on the barcodes of whatever is lying on the table. Module
// constants, because both libraries rebuild their output whenever this array's identity changes.
const APPLE_QR: VisionCamera.ScannedObjectType[] = ['qr'];
const ZXING_QR: NitroZxing.TargetBarcodeFormat[] = ['qr-code'];

/**
 * The latest handler, behind a function whose identity never changes - so a caller passing a fresh
 * arrow each render does not rebuild the camera output (or, on Android, re-send the frame processor
 * to the camera thread) on every render.
 */
function useStableHandler<A extends unknown[]>(
  handler: (...args: A) => void,
): (...args: A) => void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  return useCallback((...args: A) => latest.current(...args), []);
}

/** iOS: `AVCaptureMetadataOutput`, the system's own code reader. */
function appleQrOutput(camera: CameraModule): QrOutputHook {
  return function useAppleQrOutput(onCodes) {
    const deliver = useStableHandler(onCodes);
    const onObjectsScanned = useCallback(
      (objects: VisionCamera.ScannedObject[]) => {
        const values: string[] = [];
        for (const object of objects) {
          if (camera.isScannedCode(object) && object.value) {
            values.push(object.value);
          }
        }
        if (values.length > 0) {
          deliver(values);
        }
      },
      [deliver],
    );
    return camera.useObjectOutput({ types: APPLE_QR, onObjectsScanned });
  };
}

/** Android: zxing-cpp, as a frame processor on VisionCamera's frame output. */
function zxingQrOutput(camera: CameraModule, zxing: ZxingModule): QrOutputHook {
  return function useZxingQrOutput(onCodes, onError) {
    const deliver = useStableHandler(onCodes);
    const fail = useStableHandler((message: string) => onError(new Error(message)));
    const scanner = zxing.useBarcodeScanner({ barcodeFormats: ZXING_QR });
    const onFrame = useCallback(
      (frame: VisionCamera.Frame) => {
        'worklet';
        // This runs on the camera's own thread, once per frame. Only strings leave it: the decoded
        // values go to the JS thread, and an error goes as its message, because a native error
        // object does not cross runtimes.
        try {
          const values: string[] = [];
          for (const code of scanner.scanCodes(frame)) {
            if (code.rawValue) {
              values.push(code.rawValue);
            }
          }
          if (values.length > 0) {
            scheduleOnRN(deliver, values);
          }
        } catch (e) {
          scheduleOnRN(fail, String(e));
        } finally {
          // A frame that is not handed back stalls the camera pipeline.
          frame.dispose();
        }
      },
      [scanner, deliver, fail],
    );
    return camera.useFrameOutput({ pixelFormat: 'yuv', onFrame, onFrameDropped: ignoreDrop });
  };
}

/**
 * Frames that arrive while the decoder is still busy are dropped, and that is the design rather than
 * a fault: the next frame holds the same code. Without a handler VisionCamera `console.warn`s every
 * one, which in a development build is a stream of warnings over the viewfinder.
 */
function ignoreDrop(): void {}

/** Resolved per call, never at import - see the file header. */
function cameraModules(): CameraModules | null {
  try {
    const camera: CameraModule | undefined = require('react-native-vision-camera');
    if (!camera?.useCameraPermission || !camera?.useCameraDevice || !camera?.Camera) {
      return null;
    }
    let useQrOutput: QrOutputHook;
    if (Platform.OS === 'ios') {
      if (!camera.useObjectOutput || !camera.isScannedCode) {
        return null;
      }
      useQrOutput = appleQrOutput(camera);
    } else {
      const zxing: ZxingModule | undefined = require('react-native-nitro-zxing');
      // Nothing is used from it here, but `useFrameOutput` cannot run a frame processor without it -
      // and would say so by throwing from inside render. Asked now, so a build without it simply
      // does not offer the button.
      const worklets: unknown = require('react-native-vision-camera-worklets');
      if (!zxing?.useBarcodeScanner || !worklets || !camera.useFrameOutput) {
        return null;
      }
      useQrOutput = zxingQrOutput(camera, zxing);
    }
    return {
      useCameraPermission: camera.useCameraPermission,
      useCameraDevice: camera.useCameraDevice,
      Camera: camera.Camera,
      useQrOutput,
    };
  } catch (e) {
    reportFailure('transfer.native', e, { stage: 'native' });
    return null;
  }
}

/** Whether this build can scan at all. The button is hidden when it cannot. */
export function scanningAvailable(): boolean {
  return cameraModules() != null;
}

/**
 * The live viewfinder. A component of its own because it calls the output hook, and that must only
 * run once there is a camera and a permission to attach it to.
 */
function QrViewfinder({
  modules,
  device,
  active,
  onCodes,
  onError,
}: {
  readonly modules: CameraModules;
  readonly device: VisionCamera.CameraDevice;
  readonly active: boolean;
  readonly onCodes: (values: string[]) => void;
  readonly onError: (error: unknown) => void;
}) {
  const { Camera, useQrOutput } = modules;
  const output = useQrOutput(onCodes, onError);
  const outputs = useMemo(() => [output], [output]);
  return (
    <Camera
      style={{ flex: 1 }}
      isActive={active}
      device={device}
      outputs={outputs}
      onError={onError}
    />
  );
}

/**
 * The scanner, as a full-screen overlay.
 *
 * `onFound` fires at most once: the first code that parses as one of ours wins, and the camera stops
 * immediately. A scanner that kept firing would hand the caller a second phrase while it was already
 * acting on the first.
 */
export function TransferCodeScanner({
  onFound,
  onCancel,
  parse = parseTransferQr,
  hint,
}: {
  readonly onFound: (value: string) => void;
  readonly onCancel: () => void;
  /** Decides whether a scanned code is one of ours. Defaults to the transfer phrase. */
  readonly parse?: (scanned: string) => string | null;
  /** What to aim at, in the caller's own words. */
  readonly hint?: string;
}) {
  const theme = useTheme();
  const modules = cameraModules();
  // `done` stops the camera, but it is state: it takes effect on the next render, and the camera
  // delivers frames faster than that. Two frames holding the same code both saw `done === false`, and
  // `onFound` fired twice - a second receive started on top of the first (audit 2026-09-23). The ref
  // is what decides; the state only turns the preview off.
  const found = useRef(false);
  const [done, setDone] = useState(false);
  const [denied, setDenied] = useState(false);

  // Hooks must not be called conditionally, and `modules` is null only on a build where this
  // component is never rendered - `scanningAvailable` gates it at the call site.
  const permission = modules?.useCameraPermission() ?? {
    hasPermission: false,
    requestPermission: async () => false,
  };
  const { hasPermission, requestPermission } = permission;
  // A phone without a back camera (or an emulator configured without one) has no device to attach
  // an output to. Asking first turns that into the same graceful answer a declined permission gets,
  // rather than a camera that errors out from inside render.
  const device = modules?.useCameraDevice('back') ?? null;

  useEffect(() => {
    if (hasPermission || denied) {
      return;
    }
    let alive = true;
    void requestPermission().then(granted => {
      if (alive && !granted) {
        // Declining is a decision, not a fault. The screen says what is now unavailable and leaves
        // typing - which has always worked - as the way through.
        setDenied(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [hasPermission, denied, requestPermission]);

  if (!modules) {
    return null;
  }

  const onCodes = (values: string[]) => {
    if (found.current) {
      return;
    }
    for (const value of values) {
      const phrase = parse(value);
      if (phrase) {
        // First match wins and the camera stops. Everything else in view is somebody's bus
        // timetable and is dropped without the caller ever hearing about it.
        found.current = true;
        setDone(true);
        onFound(phrase);
        return;
      }
    }
  };

  const onError = (e: unknown) => {
    reportFailure('transfer.native', e, { stage: 'native' });
    setDenied(true);
  };

  const frame = (children: React.ReactNode) => (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      // The opaque scrim rather than a hand-written black: a viewfinder wants the darkest ground the
      // palette has, and the palette is where colours come from (constitution V). `scrimOpaque` is
      // also the one the design already uses when a backdrop must not be translucent.
      backgroundColor={theme.scrimOpaque}
      testID="transfer-scanner"
    >
      {children}
      <YStack position="absolute" bottom={0} left={0} right={0} padding={20} gap={12}>
        <Body fontSize={13} color={theme.surfaceAlt} textAlign="center">
          {hint ?? t('transfer.scan.hint')}
        </Body>
        <PressScale
          fullWidth
          onPress={onCancel}
          accessibilityLabel={t('common.cancel')}
          testID="transfer-scanner-close"
        >
          <XStack
            width="100%"
            minHeight={48}
            borderRadius={14}
            backgroundColor={theme.surface}
            alignItems="center"
            justifyContent="center"
            gap={8}
          >
            <CloseIcon size={16} color={theme.text} />
            <BodyStrong fontSize={15} color={theme.text}>
              {t('common.cancel')}
            </BodyStrong>
          </XStack>
        </PressScale>
      </YStack>
    </YStack>
  );

  if (denied || !hasPermission || !device) {
    return frame(
      <YStack flex={1} alignItems="center" justifyContent="center" padding={24}>
        <Body fontSize={14} color={theme.surfaceAlt} textAlign="center">
          {device ? t('transfer.scan.denied') : t('transfer.scan.noCamera')}
        </Body>
      </YStack>,
    );
  }

  return frame(
    <QrViewfinder
      modules={modules}
      device={device}
      active={!done}
      onCodes={onCodes}
      onError={onError}
    />,
  );
}
