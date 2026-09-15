// The app must not be readable from the app switcher / recents screen.
//
// Reported from a device: with the app lock ON, swiping to the iOS app switcher showed the last
// screen, unlocked and legible. Android's recents was the same, showing sender names, subjects and
// the box identity line. Anyone holding the phone could read the inbox without ever entering it.
//
// The reason the app lock did not help is worth keeping, because it is the thing that makes the fix
// look unnecessary: `LockGate` locks on `AppState === 'background'`, and BOTH systems photograph the
// app before that. iOS goes INACTIVE first, and is already on screen in the switcher at that point;
// Android captures the task snapshot on its own schedule around the activity stopping. A React
// re-render is told afterwards, so it cannot win. Both fixes therefore have to be native, and that
// is precisely why they need a test: nothing in the JS suite renders these files, RN upgrades
// rewrite them, and the failure is silent and invisible in review.
//
// This asserts the mechanism exists, not that it works. Whether the snapshot is actually blank was
// verified on a device (Android emulator: recents card solid black, before/after).

import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../..');

describe('app-switcher privacy', () => {
  describe('Android (MainActivity.kt)', () => {
    const source = readFileSync(
      join(ROOT, 'android/app/src/main/java/com/obalkadatovaschranka/MainActivity.kt'),
      'utf8',
    );
    const manifest = readFileSync(
      join(ROOT, 'android/app/src/main/AndroidManifest.xml'),
      'utf8',
    );

    it('stops the STORED snapshot being taken at all', () => {
      // Android 13's API, which unlike FLAG_SECURE leaves the user's own screenshots alone.
      expect(source).toMatch(/setRecentsScreenshotEnabled\(false\)/);
    });

    it('still has a cover for the versions with no snapshot API', () => {
      // API 32 and older get nothing from the call above, so the cover is their only protection,
      // and it has to hang on window focus: that is the one hook that runs before the preview is
      // made. Stricter than 13+ ends up being, and unavoidable there.
      expect(source).toMatch(/override fun onWindowFocusChanged/);
      expect(source).toMatch(/needsManualCover/);
      expect(source).toMatch(/showPrivacyCover\(\)/);
      expect(source).toMatch(/hidePrivacyCover\(\)/);
    });

    it('brands that cover rather than showing a blank field', () => {
      expect(source).toMatch(/setImageResource\(R\.mipmap\.ic_launcher\)/);
    });

    it('does NOT reach for FLAG_SECURE, which would cost the user their screenshots', () => {
      // The one-line answer that covers both sources, and takes screenshots of your own mail with
      // it. Deliberately rejected; if it reappears, that decision was reversed by accident.
      const code = source.replace(/\/\*\*[\s\S]*?\*\//g, ''); // prose may still discuss it
      expect(code).not.toMatch(/FLAG_SECURE/);
    });

    it('hides overlays other apps draw over it (MASTG-BEST-0040)', () => {
      expect(source).toMatch(/setHideOverlayWindows\(true\)/);
      expect(manifest).toMatch(/android\.permission\.HIDE_OVERLAY_WINDOWS/);
    });
  });

  describe('iOS (AppDelegate.swift)', () => {
    const source = readFileSync(
      join(ROOT, 'ios/ObalkaDatovaSchranka/AppDelegate.swift'),
      'utf8',
    );

    it('covers the UI once the app is backgrounded', () => {
      expect(source).toMatch(/func applicationDidEnterBackground/);
      expect(source).toMatch(/showPrivacyCover\(\)/);
    });

    it('uncovers it on return, or the app would look dead', () => {
      expect(source).toMatch(/func applicationDidBecomeActive/);
      expect(source).toMatch(/hidePrivacyCover\(\)/);
    });

    it('does NOT cover on resign-active, which is stricter than intended', () => {
      // Where this started, and stepped back from on evidence: resign-active fires as the swipe-up
      // begins, so it also blanks the app behind Control Centre, the shade and the Face ID sheet.
      // George, Revolut and Wallet were all checked on a real phone and none of them do that; they
      // protect the image iOS WRITES TO DISK, which is the one somebody else can see. Restoring
      // this would reverse that decision silently, so it fails here instead.
      expect(source).not.toMatch(/func applicationWillResignActive/);
    });

    it('is told which appearance to draw, or it follows the phone instead', () => {
      // The cover is the launch storyboard, and a storyboard resolves `LaunchBackground` from the
      // WINDOW's interface style, which reflects the phone unless something overrides it. Without
      // this call a user on Tmavý with a light iPhone gets a dark app and a light cover. Android
      // has its own path (SharedPreferences, read at Activity create); on iOS the only lever is
      // `overrideUserInterfaceStyle`, which is what `Appearance.setColorScheme` sets on every
      // window. It lives in App.tsx next to the Android call, so the two cannot drift.
      const app = readFileSync(join(ROOT, 'App.tsx'), 'utf8');
      expect(app).toMatch(/Appearance\.setColorScheme\(/);
      expect(app).toMatch(/setSystemBarsAppearance\(shownDark\)/);
      expect(app).toMatch(/Appearance\.setColorScheme\(shownDark \? 'dark' : 'light'\)/);
    });

    it('shows the launch screen itself, so the two cannot drift apart', () => {
      // Branding the launch screen has to be enough; a hand-made lookalike is a second place to
      // remember, and the one that gets forgotten.
      expect(source).toMatch(/UIStoryboard\(name: "LaunchScreen"/);
    });

    it('adds the cover to the window, so a presented modal is covered too', () => {
      // Covering only the root view leaves a share sheet or document picker in the snapshot.
      expect(source).toMatch(/window\.addSubview\(cover\)/);
      expect(source).toMatch(/window\.bringSubviewToFront\(cover\)/);
    });
  });
});
