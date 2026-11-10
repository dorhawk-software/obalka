# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow"]
# ///
"""Frames raw simulator screenshots for the App Store: headline, subline, phone.

    uv run tools/store_screens.py <raw-dir> <out-dir> cs|en

<raw-dir> holds the 1320x2868 captures named as in SHOTS (1-unified.png, ...). The output is the
same size, the iPhone 6.9" slot, which App Store Connect scales down for the smaller phones.
Colours are the app icon's; fonts are the app's own (assets/fonts).
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "assets" / "fonts"

W, H = 1320, 2868
BLUE_TOP = (44, 110, 182)
BLUE_BOTTOM = (30, 82, 140)
GOLD = (255, 195, 5)
WHITE = (255, 255, 255)
BODY = (16, 16, 18)

# name -> {lang: (headline, subline)}. The headline breaks where "\n" says, so a line never ends
# on a one-letter preposition.
SHOTS = {
    "1-unified": {
        "cs": ("Všechny schránky\nv\xa0jednom seznamu", "Zprávy zůstanou i\xa0po 90 dnech, kdy je ISDS smaže"),
        "en": ("Every data box\nin one list", "Your mail stays after ISDS deletes it at 90 days"),
    },
    "2-detail": {
        "cs": ("Fikce vás\nnepřekvapí", "Doručenka řekne, co se stalo a kdy"),
        "en": ("No surprise\ndeliveries", "The delivery record says what happened"),
    },
    "3-search": {
        "cs": ("Najdete cokoli,\ni\xa0offline", "Hledání napříč všemi schránkami"),
        "en": ("Find anything,\neven offline", "Search across every box"),
    },
    "4-backup": {
        "cs": ("Šifrovaná\nzáloha", "Heslo k ní máte jen vy"),
        "en": ("Encrypted\nbackup", "Only you hold the password"),
    },
    "5-transfer": {
        "cs": ("Nový telefon,\njeden kód", "Archiv přejde přímo z telefonu do telefonu"),
        "en": ("New phone,\none code", "The archive moves straight across"),
    },
    "6-dark": {
        "cs": ("Bez serveru,\nnic na pozadí", "Ke schránce se přihlásí jen na váš pokyn"),
        "en": ("No server,\nno silent sync", "It signs in only when you ask"),
    },
}

# Phone geometry, in output pixels.
# The whole phone shows, with a margin under it: a frame clipped just at its corners reads as a
# mistake, not as a bleed. The width follows from the room left under the text.
PHONE_TOP = 640
PHONE_BOTTOM_MARGIN = 100
BEZEL = 26
PHONE_W = round((H - PHONE_TOP - PHONE_BOTTOM_MARGIN - 2 * BEZEL) * 1320 / 2868) + 2 * BEZEL
SCREEN_RADIUS = 150
ISLAND = (370, 108, 36)  # width, height, top - at full screenshot scale


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size)


def background() -> Image.Image:
    column = Image.new("RGB", (1, H))
    for y in range(H):
        t = y / (H - 1)
        column.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(BLUE_TOP, BLUE_BOTTOM)))
    bg = column.resize((W, H))
    # The envelope's gold flap as a soft disc behind the phone's top right corner.
    disc = Image.new("L", (W, H), 0)
    ImageDraw.Draw(disc).ellipse((W - 500, PHONE_TOP - 130, W + 400, PHONE_TOP + 770), fill=255)
    bg.paste(Image.new("RGB", (W, H), GOLD), (0, 0), disc)
    return bg


def text_block(img: Image.Image, headline: str, subline: str) -> None:
    d = ImageDraw.Draw(img)
    lines = headline.split("\n")
    # One size for the whole set would be calmer, but the longest Czech line decides it; so the
    # largest that fits, capped, and the cap is what most slides get.
    size = 128
    while max(d.textlength(line, font=font("BricolageGrotesque-ExtraBold.ttf", size)) for line in lines) > W - 140:
        size -= 2
    hf = font("BricolageGrotesque-ExtraBold.ttf", size)
    sf = font("PublicSans-SemiBold.ttf", 50)
    gap = int(size * 1.02)
    total = gap * len(lines)
    top = 150 if len(lines) <= 2 else 120
    for i, line in enumerate(lines):
        d.text((W / 2, top + i * gap), line, font=hf, fill=WHITE, anchor="ma")
    # The subline wraps at spaces (a no-break space keeps "i po" together) onto at most two rows,
    # split where the two come out most even - a greedy wrap leaves one word alone on the second.
    words = subline.split(" ")
    rows = [subline]
    if d.textlength(subline, font=sf) > W - 220:
        splits = [(" ".join(words[:k]), " ".join(words[k:])) for k in range(1, len(words))]
        rows = list(min(splits, key=lambda r: max(d.textlength(x, font=sf) for x in r)))
    assert all(d.textlength(r, font=sf) <= W - 160 for r in rows), f"subline too long: {subline}"
    for i, row in enumerate(rows):
        d.text((W / 2, top + total + 36 + i * 64), row, font=sf, fill=(225, 236, 248), anchor="ma")
    for line in lines:
        assert d.textlength(line, font=hf) < W - 100, f"headline too wide: {line}"


def phone(shot: Image.Image) -> Image.Image:
    scale = (PHONE_W - 2 * BEZEL) / shot.width
    sw, sh = PHONE_W - 2 * BEZEL, round(shot.height * scale)
    screen = shot.convert("RGB").resize((sw, sh), Image.LANCZOS)
    iw, ih, it = (round(v * scale) for v in ISLAND)
    ImageDraw.Draw(screen).rounded_rectangle(
        ((sw - iw) // 2, it, (sw + iw) // 2, it + ih), radius=ih // 2, fill=(0, 0, 0)
    )
    ph = sh + 2 * BEZEL
    body = Image.new("RGBA", (PHONE_W, ph), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle(
        (0, 0, PHONE_W - 1, ph - 1), radius=SCREEN_RADIUS + BEZEL, fill=BODY + (255,)
    )
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), radius=SCREEN_RADIUS, fill=255)
    body.paste(screen, (BEZEL, BEZEL), mask)
    return body


def compose(raw: Path, lang: str) -> Image.Image:
    headline, subline = SHOTS[raw.stem][lang]
    img = background()
    device = phone(Image.open(raw))
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    alpha = device.split()[3].point(lambda a: a * 0.45)
    shadow.paste((0, 0, 0, 255), ((W - PHONE_W) // 2, PHONE_TOP + 30), alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))
    img.paste(shadow, (0, 0), shadow)
    img.paste(device, ((W - PHONE_W) // 2, PHONE_TOP), device)
    text_block(img, headline, subline)
    return img


def main() -> None:
    raw_dir, out_dir, lang = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in SHOTS:
        src = raw_dir / f"{name}.png"
        img = compose(src, lang)
        assert img.size == (W, H)
        img.save(out_dir / f"{name}.png", optimize=True)
        print(out_dir / f"{name}.png")


if __name__ == "__main__":
    main()
