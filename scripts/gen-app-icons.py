#!/usr/bin/env python3
"""Generate the app icon for BOTH platforms from src/assets/logo.svg.

One source, one proportion. The logo is a rounded blue tile with the envelope cut out of it; used as a
launcher icon whole, the envelope filled only 43% of the icon's width - the rest was blue - and the
Android flood-fill left a faint ghost of the tile's rounded edge. So the icon is built from the logo's
own envelope paths (the body is the hole in the blue path, the flap is the gold path) on a full-bleed
blue square, with the envelope at ENVELOPE_SHARE of the VISIBLE icon width on each platform:

  * iOS: the whole 1024 square is visible (the system masks it to its own rounded shape), no alpha.
  * Android adaptive icon: the launcher shows the middle 72 of the 108 dp foreground, masked to a circle
    or a squircle, so the envelope is ENVELOPE_SHARE of 72 dp. Its diagonal must stay inside the 66 dp
    safe circle, which the script checks. The background layer is the solid brand blue
    (res/values/ic_launcher_background.xml).
  * Android legacy (API 24-25): the full-bleed square, and a circle cut from it.

Writes src/assets/app-icon.svg (the iOS artwork, for reference and the store listings), the iOS
AppIcon set (light, dark and tinted) and every Android density. The Android monochrome layer is a
vector, drawn by hand: res/drawable/ic_launcher_monochrome.xml.

Requires: Chrome (google-chrome-stable, the macOS app, or $CHROME) + Pillow. Run from the repo root:
    python3 scripts/gen-app-icons.py
"""
import os
import re
import subprocess
import tempfile

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, 'src/assets/logo.svg')
ICON_SVG = os.path.join(ROOT, 'src/assets/app-icon.svg')
RES = os.path.join(ROOT, 'android/app/src/main/res')
IOS = os.path.join(ROOT, 'ios/ObalkaDatovaSchranka/Images.xcassets/AppIcon.appiconset')
BLUE = '#2563A6'

# Linux names Chrome on the PATH; macOS keeps it in the app bundle.
_MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
CHROME = os.environ.get('CHROME') or (_MAC_CHROME if os.path.exists(_MAC_CHROME) else 'google-chrome-stable')

# The envelope's width as a share of the visible icon, on both platforms. 62% is where a system Mail
# icon sits; the old icon was 43%.
ENVELOPE_SHARE = 0.62

# The envelope's bounds in the logo's 1024 viewBox (body 294.6-730.9 wide, flap top 360 to body
# bottom 667.5), read off logo.svg's paths.
ENV_X0, ENV_X1, ENV_Y0, ENV_Y1 = 294.6, 730.9, 360.0, 667.5
ENV_W, ENV_H = ENV_X1 - ENV_X0, ENV_Y1 - ENV_Y0
ENV_CX, ENV_CY = (ENV_X0 + ENV_X1) / 2, (ENV_Y0 + ENV_Y1) / 2


def envelope_paths():
    svg = open(LOGO, encoding='utf-8').read()
    blue, gold = re.findall(r'<path fill="(#[0-9A-Fa-f]{6})" d="([^"]+)"', svg)
    assert blue[0].upper() == BLUE and gold[0].upper() == '#FFC305', 'logo.svg changed shape'
    # The blue path is the tile, then - after its first `Z` - the envelope body cut out of it.
    body = 'M' + blue[1].split('ZM', 1)[1]
    return body, gold[1]


# The iOS 18 appearances (031 I65.1, board R8 "The app icon in dark and tinted modes", agreed
# 2026-11-12): the same envelope, recoloured. Dark is the app's own envelope - blue body, gold flap,
# the two folds the dark envelope draws - on the dark paper; tinted is greyscale on black for the
# system to tint. Each: (ground, body, flap, folds or None).
LIGHT = (BLUE, '#FFFFFF', '#FFC305', None)
DARK = ('#17140F', BLUE, '#FFC305', 'rgba(9,30,64,.35)')
TINTED = ('#000000', '#9A9A9A', '#E6E6E6', None)


def icon_svg(envelope_width, background, colours=LIGHT):
    """A 1024 square with the envelope centred at `envelope_width` px wide."""
    ground, body_fill, flap_fill, folds = colours
    body, flap = envelope_paths()
    k = envelope_width / ENV_W
    bg = f'<rect width="1024" height="1024" fill="{ground}"/>' if background else ''
    fold = ''
    if folds:
        # R8 draws them from the body's bottom corners to just short of its middle, 54% down it, 2 of
        # its 66 wide; clipped to the body so the rounded corners stay round.
        tip_y = ENV_Y0 + 0.54 * ENV_H
        gap = ENV_W / 66
        fold = (
            f'<clipPath id="b"><path d="{body}"/></clipPath>'
            f'<path clip-path="url(#b)" fill="none" stroke="{folds}" stroke-width="{2 * gap:.1f}" '
            f'd="M{ENV_X0} {ENV_Y1}L{ENV_CX - gap:.1f} {tip_y:.1f}M{ENV_X1} {ENV_Y1}L{ENV_CX + gap:.1f} {tip_y:.1f}"/>'
        )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">'
        f'{bg}<g transform="translate(512 512) scale({k:.5f}) translate({-ENV_CX:.2f} {-ENV_CY:.2f})">'
        f'<path fill="{body_fill}" d="{body}"/>{fold}<path fill="{flap_fill}" d="{flap}"/></g></svg>'
    )


def render(svg, transparent):
    # A private directory rather than `tempfile.mktemp`, which only names a path (CodeQL
    # py/insecure-temporary-file); it goes away afterwards.
    with tempfile.TemporaryDirectory() as tmp:
        src, out = os.path.join(tmp, 'icon.svg'), os.path.join(tmp, 'icon.png')
        open(src, 'w', encoding='utf-8').write(svg)
        subprocess.run(
            [
                CHROME, '--headless=new', f'--screenshot={out}',
                '--window-size=1024,1024',
                f'--default-background-color={"00000000" if transparent else "ffffffff"}',
                '--force-device-scale-factor=1', '--force-color-profile=srgb',
                '--hide-scrollbars', f'file://{src}',
            ],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        return Image.open(out).convert('RGBA')


def circle_crop(im):
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).ellipse([0, 0, im.size[0] - 1, im.size[1] - 1], fill=255)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


# iOS and the Android legacy icons: the envelope at ENVELOPE_SHARE of the whole square.
full_svg = icon_svg(ENVELOPE_SHARE * 1024, background=True)
open(ICON_SVG, 'w', encoding='utf-8').write(full_svg + '\n')
full = render(full_svg, transparent=False).convert('RGB')

# Android adaptive foreground: the envelope at ENVELOPE_SHARE of the visible 72 of 108 dp.
fg_width = ENVELOPE_SHARE * 72 / 108 * 1024
diagonal_dp = (fg_width / ENV_W) * (ENV_W ** 2 + ENV_H ** 2) ** 0.5 * 108 / 1024
assert diagonal_dp <= 66, f'envelope diagonal {diagonal_dp:.1f} dp leaves the 66 dp safe zone'
foreground = render(icon_svg(fg_width, background=False), transparent=True)

# One 1024 per appearance; Xcode draws every smaller size from it (a single-size set, 2026-11-15).
# No alpha channel: App Store Connect rejects an icon that has one.
full.save(f'{IOS}/icon-1024.png')
for name, colours in (('dark', DARK), ('tinted', TINTED)):
    render(icon_svg(ENVELOPE_SHARE * 1024, True, colours), transparent=False).convert('RGB').save(
        f'{IOS}/icon-1024-{name}.png'
    )

LEGACY = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
FOREGROUND = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
for d, sz in LEGACY.items():
    small = full.resize((sz, sz), Image.LANCZOS)
    small.save(f'{RES}/mipmap-{d}/ic_launcher.png')
    circle_crop(small.convert('RGBA')).save(f'{RES}/mipmap-{d}/ic_launcher_round.png')
for d, sz in FOREGROUND.items():
    foreground.resize((sz, sz), Image.LANCZOS).save(f'{RES}/mipmap-{d}/ic_launcher_foreground.png')
print(f'app icons written (envelope {ENVELOPE_SHARE:.0%} of the visible icon, '
      f'Android diagonal {diagonal_dp:.1f} of 66 dp)')
