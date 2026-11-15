// What the phone draws before any JavaScript runs, and the icon it draws the app with (031 I02, I65.1).
//
// Both are native files that no screen test sees. Until 2026-11-15 Android's system splash stood on
// AppCompat's #FAFAFA and the screen turned to paper under it; the iOS icon had no dark or tinted
// version (iOS darkened the light one itself), and Android's themed launcher showed a generic tile
// for want of a monochrome layer.

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { darkTheme, lightTheme } from '../../src/theme/theme';

const ROOT = join(__dirname, '..', '..');
const RES = join(ROOT, 'android/app/src/main/res');
const ICONS = join(ROOT, 'ios/ObalkaDatovaSchranka/Images.xcassets/AppIcon.appiconset');
const read = (path: string) => readFileSync(path, 'utf8');
const colour = (xml: string, name: string) => new RegExp(`<color name="${name}">(#[0-9A-Fa-f]{6})<`).exec(xml)?.[1];

describe('Android launch: the splash stands on the paper (031 I02)', () => {
  it('paints the window, and with it the system splash, in the paper of each appearance', () => {
    expect(read(join(RES, 'values/styles.xml'))).toMatch(/<item name="android:windowBackground">@color\/paper<\/item>/);
    expect(colour(read(join(RES, 'values/paper.xml')), 'paper')).toBe(lightTheme.bg);
    expect(colour(read(join(RES, 'values-night/paper.xml')), 'paper')).toBe(darkTheme.bg);
  });
});

describe('the app icon in dark and tinted modes (031 I65.1, board R8)', () => {
  it.each(['ic_launcher.xml', 'ic_launcher_round.xml'])('gives Android 13 a monochrome layer in %s', file => {
    expect(read(join(RES, 'mipmap-anydpi-v26', file))).toContain(
      '<monochrome android:drawable="@drawable/ic_launcher_monochrome" />',
    );
    expect(existsSync(join(RES, 'drawable/ic_launcher_monochrome.xml'))).toBe(true);
  });

  type Entry = { filename?: string; appearances?: { appearance: string; value: string }[] };
  const entries = (): Entry[] => JSON.parse(read(join(ICONS, 'Contents.json'))).images;
  const byLook = (value: string) =>
    entries().find(e => (value === 'light' ? !e.appearances : e.appearances?.some(a => a.value === value)));

  it.each(['light', 'dark', 'tinted'])('gives iOS a 1024 icon for the %s appearance, with no alpha', value => {
    const entry = byLook(value);
    expect(entry?.filename).toBeDefined();
    const png = readFileSync(join(ICONS, entry?.filename ?? ''));
    // IHDR: width and height at 16 and 20, colour type at 25 - 2 is RGB. App Store Connect refuses an
    // icon with an alpha channel.
    expect([png.readUInt32BE(16), png.readUInt32BE(20), png[25]]).toEqual([1024, 1024, 2]);
  });
});
