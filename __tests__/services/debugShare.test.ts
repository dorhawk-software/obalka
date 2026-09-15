// Sharing a debug bundle (023).
//
// What a unit test can hold on to here is which door the file leaves through. On Android that is the
// app's own ACTION_SEND module, not react-native-blob-util's `actionViewIntent` - which OPENS a file,
// and on a phone with no zip viewer failed every time (found walking the emulator, 2026-09-15). A
// build without the module rejects rather than pretending, so the screen can say the sheet did not
// open. Whether the chooser really appears is the device walk's to show.

import { NativeModules, Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { shareBundle } from '../../src/services/debug/debugStore';

const PATH =
  '/data/user/0/com.obalkadatovaschranka/files/debug/obalka-debug-2026-09-15-1847-standard.zip';
const TITLE = 'Sdílet soubor z režimu ladění';

const modules = NativeModules as { ShareFile?: { shareFile: jest.Mock } };
const blob = RNBlobUtil as unknown as {
  android: { actionViewIntent: jest.Mock };
  ios?: { presentOptionsMenu: jest.Mock };
};
const originalOS = Platform.OS;
const originalIos = blob.ios;

function setOS(os: string) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });
}

beforeEach(() => {
  blob.android.actionViewIntent.mockClear();
});

afterEach(() => {
  setOS(originalOS);
  delete modules.ShareFile;
  blob.ios = originalIos;
});

describe('sharing a debug bundle', () => {
  it('sends the zip on Android through the share module, titled, and never opens it', async () => {
    setOS('android');
    const shareFile = jest.fn(async () => undefined);
    modules.ShareFile = { shareFile };

    await shareBundle(PATH, TITLE);

    expect(shareFile).toHaveBeenCalledWith(PATH, 'application/zip', TITLE);
    expect(blob.android.actionViewIntent).not.toHaveBeenCalled();
  });

  it('rejects on Android when the build has no share module, so the screen can say so', async () => {
    setOS('android');

    await expect(shareBundle(PATH, TITLE)).rejects.toThrow(/ShareFile/);
    expect(blob.android.actionViewIntent).not.toHaveBeenCalled();
  });

  it('passes on the share sheet refusing, rather than reporting it shared', async () => {
    setOS('android');
    modules.ShareFile = {
      shareFile: jest.fn(async () => {
        throw new Error('E_NO_TARGET');
      }),
    };

    await expect(shareBundle(PATH, TITLE)).rejects.toThrow('E_NO_TARGET');
  });

  it('uses the options menu on iOS, which is the share sheet there', async () => {
    setOS('ios');
    const presentOptionsMenu = jest.fn(async () => undefined);
    blob.ios = { presentOptionsMenu };

    await shareBundle(PATH, TITLE);

    expect(presentOptionsMenu).toHaveBeenCalledWith(PATH);
  });
});
