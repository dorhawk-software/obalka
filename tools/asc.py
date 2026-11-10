# /// script
# requires-python = ">=3.11"
# dependencies = ["pyjwt[crypto]>=2.8", "requests>=2.31"]
# ///
"""App Store Connect API for Obálka.

The private key never touches the disk or the repository: every run reads it from 1Password
("Obálka - Apple Auth Key for GitHub CI", the same key the release workflow uploads with) through the
`op` CLI. The app is found by its bundle ID, so the script works before and after the record exists.

    uv run tools/asc.py check          # what App Store Connect holds for Obálka
    uv run tools/asc.py get /v1/apps   # any GET, prints JSON
    uv run tools/asc.py builds         # the latest uploaded builds and their processing state
    uv run tools/asc.py listing [--dry]  # cs and en-US listing, links, categories and copyright, from docs/store/listing.md
    uv run tools/asc.py age            # the age rating answers below, then the rating Apple computes
    uv run tools/asc.py whatsnew <version> [--dry]  # App Store What's New + TestFlight What to Test, from the changelog
    uv run tools/asc.py screenshots <dir> cs|en-US [--dry]  # the framed iPhone 6.9" set, in file order
"""
import json
import pathlib
import re
import subprocess
import sys
import time

import jwt
import requests

ISSUER_ID = "ab8b7775-8639-4b68-a888-fee4683d0da5"
KEY_ID = "57CKX9BHC6"
OP_ITEM = "Obálka - Apple Auth Key for GitHub CI"
BUNDLE_ID = "software.dorhawk.obalka"
BASE = "https://api.appstoreconnect.apple.com"
REPO = "https://github.com/dorhawk-software/obalka"
COPYRIGHT = "2026 Dorhawk Software"
CATEGORIES = ("PRODUCTIVITY", "BUSINESS")
LISTING = pathlib.Path(__file__).resolve().parents[1] / "docs" / "store" / "listing.md"
PRIVACY = {"cs": f"{REPO}/blob/main/PRIVACY.md", "en-US": f"{REPO}/blob/main/PRIVACY.en.md"}


def private_key() -> str:
    item = json.loads(subprocess.run(["op", "item", "get", OP_ITEM, "--format", "json"],
                                     check=True, capture_output=True, text=True).stdout)
    for field in item.get("fields", []):
        value = field.get("value") or ""
        if "BEGIN PRIVATE KEY" in value:
            return value
    for f in item.get("files", []) or []:
        if f.get("name", "").endswith(".p8"):
            ref = f"op://{item['vault']['id']}/{item['id']}/{f['name']}"
            return subprocess.run(["op", "read", ref], check=True, capture_output=True, text=True).stdout
    sys.exit(f"No private key (.p8 file or BEGIN PRIVATE KEY field) in the 1Password item {OP_ITEM!r}.")


_token = None


def token() -> str:
    global _token
    if _token is None:
        now = int(time.time())
        _token = jwt.encode({"iss": ISSUER_ID, "iat": now, "exp": now + 19 * 60, "aud": "appstoreconnect-v1"},
                            private_key(), algorithm="ES256", headers={"kid": KEY_ID, "typ": "JWT"})
    return _token


def api(method: str, path: str, **kw):
    r = requests.request(method, BASE + path, headers={"Authorization": f"Bearer {token()}"}, timeout=60, **kw)
    if r.status_code >= 400:
        sys.exit(f"{method} {path} -> {r.status_code}\n{r.text[:2000]}")
    return r.json() if r.text else {}


def get(path: str):
    return api("GET", path)


def app_id() -> str | None:
    apps = get(f"/v1/apps?filter[bundleId]={BUNDLE_ID}")["data"]
    return apps[0]["id"] if apps else None


def check():
    ids = get(f"/v1/bundleIds?filter[identifier]={BUNDLE_ID}")["data"]
    print(f"bundle ID {BUNDLE_ID}: {'registered (' + ids[0]['attributes']['name'] + ')' if ids else 'NOT registered'}")
    aid = app_id()
    if not aid:
        print("app record: none yet (App Store Connect > Apps > + > New App)")
        return
    a = get(f"/v1/apps/{aid}")["data"]["attributes"]
    print(f"app record: {a['name']} (Apple ID {aid}), SKU {a.get('sku')}, primary {a.get('primaryLocale')}")
    for info in get(f"/v1/apps/{aid}/appInfos")["data"]:
        at = info["attributes"]
        print(f"  app info: state {at.get('appStoreState') or at.get('state')}, age rating {at.get('appStoreAgeRating')}")
        for loc in get(f"/v1/appInfos/{info['id']}/appInfoLocalizations")["data"]:
            la = loc["attributes"]
            print(f"    {la['locale']}: name {la.get('name')!r}, subtitle {la.get('subtitle')!r}, "
                  f"privacy {la.get('privacyPolicyUrl')!r}")
    for v in get(f"/v1/apps/{aid}/appStoreVersions")["data"]:
        va = v["attributes"]
        print(f"  version {va['versionString']}: {va['appStoreState']}, release {va.get('releaseType')}")
        for loc in get(f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations")["data"]:
            la = loc["attributes"]
            print(f"    {la['locale']}: description {len(la.get('description') or '')} chars, "
                  f"keywords {la.get('keywords')!r}")
    builds()


def builds():
    aid = app_id()
    if not aid:
        print("no app record, so no builds")
        return
    data = get(f"/v1/builds?filter[app]={aid}&sort=-uploadedDate&limit=5")["data"]
    if not data:
        print("  builds: none uploaded")
    for b in data:
        ba = b["attributes"]
        print(f"  build {ba['version']}: {ba['processingState']}, uploaded {ba['uploadedDate']}")


def cz_nbsp(s: str) -> str:
    """Czech typography: no line break after a one-letter word or after a number."""
    return re.sub(r"(?<!\w)([vkszouaiVKSZOUAI]|\d+\.?) (?=\w)", lambda m: m[1] + "\u00a0", s)


def listing_wants() -> dict:
    """Per locale, the fields under `## <locale>` / `### <field>` in docs/store/listing.md."""
    text = LISTING.read_text()
    out = {}
    for locale in ("cs", "en-US"):
        sec = text.split(f"\n## {locale}\n", 1)[1].split("\n## ", 1)[0]
        field = lambda name: sec.split(f"### {name}\n", 1)[1].split("\n### ", 1)[0].strip()
        fix = cz_nbsp if locale == "cs" else (lambda t: t)
        out[locale] = dict(
            info=dict(name=field("name"), subtitle=field("subtitle"), privacyPolicyUrl=PRIVACY[locale]),
            version=dict(description=fix(field("description")), keywords=field("keywords"),
                         promotionalText=fix(field("promotional text")),
                         supportUrl=f"{REPO}/issues", marketingUrl=REPO))
        limits = dict(name=30, subtitle=30)
        for k, n in limits.items():
            assert len(out[locale]["info"][k]) <= n, (locale, k)
        assert len(out[locale]["version"]["promotionalText"]) <= 170, (locale, "promo")
        assert len(out[locale]["version"]["keywords"].encode()) <= 100, (locale, "keywords")
        assert len(out[locale]["version"]["description"]) <= 4000, (locale, "description")
    return out


def _editable(kind_path: str, state_key: str, done: tuple):
    aid = app_id()
    items = [i for i in get(f"/v1/apps/{aid}/{kind_path}")["data"] if i["attributes"].get(state_key) not in done]
    assert len(items) == 1, [i["attributes"] for i in items]
    return items[0]


def _upsert(kind, parent_rel, parent_type, parent_id, existing, locale, want, dry):
    """existing: {locale: (id, attributes)}. Creates or patches only what differs; returns the changed fields."""
    if locale in existing:
        lid, have = existing[locale]
        diff = {k: v for k, v in want.items() if (have.get(k) or "") != v}
        if diff and not dry:
            api("PATCH", f"/v1/{kind}/{lid}", json={"data": {"type": kind, "id": lid, "attributes": diff}})
        return diff
    if not dry:
        api("POST", f"/v1/{kind}", json={"data": {"type": kind, "attributes": dict(want, locale=locale),
             "relationships": {parent_rel: {"data": {"type": parent_type, "id": parent_id}}}}})
    return dict(want, created=True)


def listing(dry: bool = False):
    """Only differences are sent: run it twice and the second run changes nothing. --dry prints what would change."""
    wants = listing_wants()
    note = " (would change)" if dry else ""
    report = lambda what, diff: print(f"  {what}: " + (", ".join(sorted(diff)) + note if diff else "already"))
    info = _editable("appInfos", "appStoreState", ("READY_FOR_DISTRIBUTION", "READY_FOR_SALE", "REPLACED_WITH_NEW_VERSION"))
    have = {l["attributes"]["locale"]: (l["id"], l["attributes"])
            for l in get(f"/v1/appInfos/{info['id']}/appInfoLocalizations")["data"]}
    for locale, w in wants.items():
        report(f"[{locale}] name/subtitle/privacy", _upsert("appInfoLocalizations", "appInfo", "appInfos", info["id"],
                                                            have, locale, w["info"], dry))
    cats = get(f"/v1/appInfos/{info['id']}?include=primaryCategory,secondaryCategory")["data"]["relationships"]
    now = tuple((cats.get(r, {}).get("data") or {}).get("id") for r in ("primaryCategory", "secondaryCategory"))
    if now != CATEGORIES:
        if not dry:
            api("PATCH", f"/v1/appInfos/{info['id']}", json={"data": {"type": "appInfos", "id": info["id"], "relationships": {
                "primaryCategory": {"data": {"type": "appCategories", "id": CATEGORIES[0]}},
                "secondaryCategory": {"data": {"type": "appCategories", "id": CATEGORIES[1]}}}}})
        report("categories", {f"{now} -> {CATEGORIES}"})
    else:
        report("categories", {})
    v = _editable("appStoreVersions", "appStoreState", ("READY_FOR_SALE", "REPLACED_WITH_NEW_VERSION"))
    if (v["attributes"].get("copyright") or "") != COPYRIGHT:
        if not dry:
            api("PATCH", f"/v1/appStoreVersions/{v['id']}", json={"data": {"type": "appStoreVersions", "id": v["id"],
                                                                           "attributes": {"copyright": COPYRIGHT}}})
        report("copyright", {COPYRIGHT})
    else:
        report("copyright", {})
    have = {l["attributes"]["locale"]: (l["id"], l["attributes"])
            for l in get(f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations")["data"]}
    for locale, w in wants.items():
        report(f"[{locale}] description/keywords/promo/links", _upsert(
            "appStoreVersionLocalizations", "appStoreVersion", "appStoreVersions", v["id"], have, locale, w["version"], dry))


# The age rating questionnaire (owner, 2026-11-10). Nothing objectionable; no ads, gambling, browser or
# public content. "Messaging and Chat" is Yes: the app sends data messages to other people's boxes. It
# is formal mail rather than chat, but it is people writing to people, and data boxes are an adult's
# tool anyway, so the honest answer costs nothing. Not "Made for Kids" (it would bar crash reporting).
AGE = dict(
    advertising=False, ageAssurance=False, gambling=False, healthOrWellnessTopics=False, lootBox=False,
    messagingAndChat=True, parentalControls=False, socialMedia=False, unrestrictedWebAccess=False,
    userGeneratedContent=False,
    alcoholTobaccoOrDrugUseOrReferences="NONE", contests="NONE", gamblingSimulated="NONE",
    gunsOrOtherWeapons="NONE", horrorOrFearThemes="NONE", matureOrSuggestiveThemes="NONE",
    medicalOrTreatmentInformation="NONE", profanityOrCrudeHumor="NONE", sexualContentGraphicAndNudity="NONE",
    sexualContentOrNudity="NONE", violenceCartoonOrFantasy="NONE", violenceRealistic="NONE",
    violenceRealisticProlongedGraphicOrSadistic="NONE",
)


def age():
    info = _editable("appInfos", "appStoreState", ("READY_FOR_DISTRIBUTION", "READY_FOR_SALE", "REPLACED_WITH_NEW_VERSION"))
    d = get(f"/v1/appInfos/{info['id']}/ageRatingDeclaration")["data"]
    diff = {k: v for k, v in AGE.items() if d["attributes"].get(k) != v}
    if diff:
        api("PATCH", f"/v1/ageRatingDeclarations/{d['id']}",
            json={"data": {"type": "ageRatingDeclarations", "id": d["id"], "attributes": diff}})
    print(f"  answers: {', '.join(sorted(diff)) if diff else 'already'}")
    rating = get(f"/v1/appInfos/{info['id']}")["data"]["attributes"]
    print(f"  rating: {rating.get('appStoreAgeRating')} (Brazil {rating.get('brazilAgeRatingV2') or rating.get('brazilAgeRating')}, "
          f"Korea {rating.get('koreaAgeRating')})")


def screenshots(folder: str, locale: str, display: str = "APP_IPHONE_67", dry: bool = False):
    """Replaces the locale's iPhone 6.9" set with folder/1-*.png, 2-*.png ... in that order (frame them
    with tools/store_screens.py). Smaller iPhones show this set scaled. A file already there with the
    same name and checksum stays, so a run cut short by a timeout picks up where it stopped, and a
    second run uploads nothing. --dry lists what the store holds and what would change."""
    import hashlib

    files = sorted(pathlib.Path(folder).glob("[0-9]-*.png"))
    assert files, f"no numbered screenshots in {folder}"
    md5 = {f.name: hashlib.md5(f.read_bytes()).hexdigest() for f in files}
    v = _editable("appStoreVersions", "appStoreState", ("READY_FOR_SALE", "REPLACED_WITH_NEW_VERSION"))
    loc = next(l for l in get(f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations")["data"]
               if l["attributes"]["locale"] == locale)
    sets = get(f"/v1/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets")["data"]
    shot_set = next((x for x in sets if x["attributes"]["screenshotDisplayType"] == display), None)
    state = lambda x: (x["attributes"].get("assetDeliveryState") or {}).get("state")
    shots = lambda: get(f"/v1/appScreenshotSets/{shot_set['id']}/appScreenshots")["data"] if shot_set else []
    # Apple fills in a file's checksum only once it has processed it, so until then there is no
    # telling whether the file there is this one. Say so rather than replace it on a guess.
    processing = [x["attributes"]["fileName"] for x in shots() if state(x) not in ("COMPLETE", "FAILED")]
    if processing:
        sys.exit(f"  [{locale}] Apple is still processing {', '.join(processing)} - run it again in a few minutes")
    if dry:
        have = {x["attributes"]["fileName"]: x["attributes"].get("sourceFileChecksum") for x in shots()}
        for f in files:
            print(f"  [{locale}] {f.name}: " + ("already" if have.get(f.name) == md5[f.name] else "would upload"))
        for name in sorted(set(have) - set(md5)):
            print(f"  [{locale}] {name}: would remove")
        return
    if shot_set is None:
        shot_set = api("POST", "/v1/appScreenshotSets", json={"data": {"type": "appScreenshotSets",
            "attributes": {"screenshotDisplayType": display},
            "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": loc["id"]}}}}})["data"]
    # Keep what is there and right; drop stuck uploads, old files and duplicates.
    keep = {}
    for x in shots():
        a = x["attributes"]
        good = md5.get(a["fileName"]) == a.get("sourceFileChecksum") and state(x) in ("COMPLETE", "UPLOAD_COMPLETE")
        if good and a["fileName"] not in keep:
            keep[a["fileName"]] = x["id"]
        else:
            api("DELETE", f"/v1/appScreenshots/{x['id']}")
            print(f"  removed {a['fileName']} ({state(x)})")
    for f in files:
        if f.name in keep:
            continue
        data = f.read_bytes()
        shot = api("POST", "/v1/appScreenshots", json={"data": {"type": "appScreenshots",
            "attributes": {"fileName": f.name, "fileSize": len(data)},
            "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": shot_set["id"]}}}}})["data"]
        for op in shot["attributes"]["uploadOperations"]:
            r = requests.request(op["method"], op["url"], data=data[op["offset"]: op["offset"] + op["length"]],
                                 headers={h["name"]: h["value"] for h in op.get("requestHeaders", [])}, timeout=120)
            r.raise_for_status()
        api("PATCH", f"/v1/appScreenshots/{shot['id']}", json={"data": {"type": "appScreenshots", "id": shot["id"],
            "attributes": {"uploaded": True, "sourceFileChecksum": md5[f.name]}}})
        keep[f.name] = shot["id"]
        print(f"  uploaded {f.name}")
    api("PATCH", f"/v1/appScreenshotSets/{shot_set['id']}/relationships/appScreenshots",
        json={"data": [{"type": "appScreenshots", "id": keep[f.name]} for f in files]})
    # Apple checks every file after the upload; wait until each is done or failed.
    for _ in range(120):
        now = shots()
        if all(state(x) in ("COMPLETE", "FAILED") for x in now):
            break
        time.sleep(5)
    for x in now:
        print(f"  [{locale}] {x['attributes']['fileName']}: {state(x)}")
    order = [x["attributes"]["fileName"] for x in now]
    assert order == [f.name for f in files], f"order is {order}"


STORE_LOCALES = {"cs": "cs", "en": "en-US"}


def changelog_text(version: str, lang: str) -> str:
    """The changelog's section for `version` as a store shows it (plain text), from scripts/changelog.mjs."""
    root = pathlib.Path(__file__).resolve().parents[1]
    return subprocess.run(["node", "scripts/changelog.mjs", "--store", version, lang], cwd=root,
                          check=True, capture_output=True, text=True).stdout.strip()


def whatsnew(version: str, dry: bool = False):
    """App Store "What's New" on the version being prepared, and TestFlight "What to Test" on that
    version's newest build, in Czech and English, from the changelog (spec 029). Only differences are
    sent. Apple keeps "What's New" for updates: the very first version has none, which is reported, not
    failed."""
    texts = {STORE_LOCALES[lang]: changelog_text(version, lang) for lang in STORE_LOCALES}
    note = " (would change)" if dry else ""
    v = _editable("appStoreVersions", "appStoreState", ("READY_FOR_SALE", "REPLACED_WITH_NEW_VERSION"))
    if v["attributes"]["versionString"] != version:
        print(f"  App Store: the version being prepared is {v['attributes']['versionString']}, not {version} - left alone")
    else:
        for loc in get(f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations")["data"]:
            locale = loc["attributes"]["locale"]
            want = texts.get(locale)
            if want is None or (loc["attributes"].get("whatsNew") or "") == want:
                print(f"  [{locale}] App Store What's New: " + ("already" if want else "no changelog language"))
                continue
            if not dry:
                r = requests.patch(f"{BASE}/v1/appStoreVersionLocalizations/{loc['id']}",
                                   headers={"Authorization": f"Bearer {token()}"}, timeout=60,
                                   json={"data": {"type": "appStoreVersionLocalizations", "id": loc["id"],
                                                  "attributes": {"whatsNew": want}}})
                if r.status_code == 409:
                    print(f"  [{locale}] App Store What's New: Apple takes none on this version (the first release)")
                    continue
                if r.status_code >= 400:
                    sys.exit(f"PATCH whatsNew -> {r.status_code}\n{r.text[:2000]}")
            print(f"  [{locale}] App Store What's New: set{note}")
    builds = get(f"/v1/builds?filter[app]={app_id()}&filter[preReleaseVersion.version]={version}"
                 "&sort=-uploadedDate&limit=1")["data"]
    if not builds:
        print(f"  TestFlight: no build of {version} uploaded yet")
        return
    build = builds[0]
    have = {l["attributes"]["locale"]: (l["id"], l["attributes"])
            for l in get(f"/v1/builds/{build['id']}/betaBuildLocalizations")["data"]}
    for locale, want in texts.items():
        diff = _upsert("betaBuildLocalizations", "build", "builds", build["id"], have, locale,
                       {"whatsNew": want}, dry)
        print(f"  [{locale}] TestFlight What to Test (build {build['attributes']['version']}): "
              + ("set" + note if diff else "already"))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "check":
        check()
    elif cmd == "listing":
        listing(dry="--dry" in args)
    elif cmd == "age":
        age()
    elif cmd == "whatsnew":
        whatsnew(args[0], dry="--dry" in args)
    elif cmd == "screenshots":
        screenshots(args[0], args[1], dry="--dry" in args)
    elif cmd == "builds":
        builds()
    elif cmd == "get":
        print(json.dumps(get(args[0]), indent=2, ensure_ascii=False))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
