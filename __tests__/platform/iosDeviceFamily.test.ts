// This app ships to iPhone only.
//
// The Xcode template targets "1,2" - iPhone AND iPad - and the project inherited it without anyone
// choosing it. Nothing here is width-adaptive: there are no size-class branches, no regular-width
// layout, and Split View was therefore on for a UI that only knows how to be one column. The 2026-09
// native audit called it the last open P1, and the answer is that this is a phone app: shipping a
// stretched one to the iPad listing invites exactly the review it would deserve.
//
// It stays a decision rather than a default because Xcode rewrites `project.pbxproj` freely - adding
// a target, a capability or a signing change can put "1,2" back without anyone typing it. So the
// setting is asserted, and the day someone builds an iPad layout, this test is the one that says the
// decision is being reversed on purpose.
//
// The icon catalogue was already the tell: it carries iPhone and marketing idioms only. The project
// claimed a device it had never drawn an icon for.

import { readFileSync } from 'fs';
import { join } from 'path';

const IOS = join(__dirname, '../../ios');
const PBXPROJ = join(IOS, 'ObalkaDatovaSchranka.xcodeproj/project.pbxproj');
const INFO_PLIST = join(IOS, 'ObalkaDatovaSchranka/Info.plist');

describe('the iOS target', () => {
  const project = readFileSync(PBXPROJ, 'utf8');
  const families = [...project.matchAll(/TARGETED_DEVICE_FAMILY = "([^"]*)";/g)].map(
    m => m[1],
  );

  it('declares the setting at all', () => {
    // Guarding the guard: a renamed project would make every assertion below vacuously true.
    expect(families.length).toBeGreaterThanOrEqual(2); // Debug + Release
  });

  it('is iPhone only, in every build configuration', () => {
    expect(families).toEqual(families.map(() => '1'));
  });
});

describe('Info.plist', () => {
  const plist = readFileSync(INFO_PLIST, 'utf8');

  it('carries no iPad-only keys', () => {
    // `~ipad` variants are inert once the app is iPhone-only, and a stale one states the opposite of
    // what the project now means. The iPad orientation list was the one that lived here.
    const ipadKeys = [...plist.matchAll(/<key>([^<]*~ipad)<\/key>/g)].map(m => m[1]);
    expect(ipadKeys).toEqual([]);
  });

  it('is portrait - the only orientation any screen is laid out for', () => {
    const orientations = plist.match(
      /<key>UISupportedInterfaceOrientations<\/key>\s*<array>([\s\S]*?)<\/array>/,
    );
    expect(orientations?.[1]).toContain('UIInterfaceOrientationPortrait');
    expect(orientations?.[1]).not.toContain('Landscape');
  });
});
