# /// script
# requires-python = ">=3.11"
# dependencies = ["pyjwt[crypto]>=2.8", "requests>=2.31"]
# ///
"""App Store Connect API for Obálka.

The private key never touches the disk or the repository: every run reads it from 1Password
("Obálka - Apple Auth Key for GitHub CI", the same key the release workflow uploads with) through the
`op` CLI - or, in the release workflow, from its secrets ASC_KEY_P8 / ASC_KEY_ID / ASC_ISSUER_ID. The app is found by its bundle ID, so the script works before and after the record exists.

    uv run tools/asc.py check          # what App Store Connect holds for Obálka
    uv run tools/asc.py get /v1/apps   # any GET, prints JSON
    uv run tools/asc.py builds         # the latest uploaded builds and their processing state
    uv run tools/asc.py listing [--dry]  # cs and en-US listing, links, categories and copyright, from docs/store/listing.md
    uv run tools/asc.py age            # the age rating answers below, then the rating Apple computes
    uv run tools/asc.py version <x.y.z>  # names the version being prepared (SemVer, as the tag)
    uv run tools/asc.py build <number>  # attaches that processed build to the version being prepared
    uv run tools/asc.py beta info [--dry]  # TestFlight Test Information: description, feedback, review notes
    uv run tools/asc.py beta add <number> <group>  # puts a processed build in a TestFlight group
    uv run tools/asc.py beta submit <number>  # sends a build to Beta App Review (external testers)
    uv run tools/asc.py beta release <number> [--wait <min>]  # what CI runs after an upload: waits for
                                       # processing, then What to Test, the Beta group, Beta App Review
    uv run tools/asc.py review submit   # sends the version being prepared, with its build, to App Review
    uv run tools/asc.py review demo <login>  # demo account for Beta App Review and App Review; password from ASC_DEMO_PASSWORD
    uv run tools/asc.py whatsnew <version> [--dry]  # App Store What's New + TestFlight What to Test, from the changelog
    uv run tools/asc.py screenshots <dir> cs|en-US [--dry]  # the framed iPhone 6.9" set, in file order
"""
import json
import os
import pathlib
import re
import subprocess
import sys
import time

import jwt
import requests

ISSUER_ID = os.environ.get("ASC_ISSUER_ID") or "ab8b7775-8639-4b68-a888-fee4683d0da5"
KEY_ID = os.environ.get("ASC_KEY_ID") or "57CKX9BHC6"
OP_ITEM = "Obálka - Apple Auth Key for GitHub CI"
BUNDLE_ID = "software.dorhawk.obalka"
BASE = "https://api.appstoreconnect.apple.com"
REPO = "https://github.com/dorhawk-software/obalka"
COPYRIGHT = "2026 Dorhawk Software"
CATEGORIES = ("PRODUCTIVITY", "BUSINESS")
LISTING = pathlib.Path(__file__).resolve().parents[1] / "docs" / "store" / "listing.md"
PRIVACY = {"cs": f"{REPO}/blob/main/PRIVACY.md", "en-US": f"{REPO}/blob/main/PRIVACY.en.md"}


def private_key() -> str:
    if os.environ.get("ASC_KEY_P8"):  # the release workflow's secret; 1Password everywhere else
        return os.environ["ASC_KEY_P8"]
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


def set_version(version: str):
    """Names the version being prepared: a full x.y.z (SemVer, as the tags and the builds carry it), so a
    build of `version` can be submitted under it. Nothing is sent when it already reads so."""
    assert re.fullmatch(r"\d+\.\d+\.\d+", version), f"{version} is not x.y.z"
    v = _editable("appStoreVersions", "appStoreState", ("READY_FOR_SALE", "REPLACED_WITH_NEW_VERSION"))
    have = v["attributes"]["versionString"]
    if have == version:
        print(f"  version: already {version}")
        return
    api("PATCH", f"/v1/appStoreVersions/{v['id']}", json={"data": {"type": "appStoreVersions", "id": v["id"],
                                                                   "attributes": {"versionString": version}}})
    print(f"  version: {have} -> {version}")


def set_build(number: str):
    """Attaches build `number` of the version being prepared to it: the build App Review gets, and the one
    App Store Connect takes the app's icon from. Nothing is submitted; a later build can replace it until
    the version goes to review."""
    v = _editable("appStoreVersions", "appStoreState", ("READY_FOR_SALE", "REPLACED_WITH_NEW_VERSION"))
    version = v["attributes"]["versionString"]
    found = get(f"/v1/builds?filter[app]={app_id()}&filter[version]={number}"
                f"&filter[preReleaseVersion.version]={version}")["data"]
    assert found, f"no build {number} of {version}"
    build = found[0]
    state = build["attributes"]["processingState"]
    assert state == "VALID", f"build {number} is {state}, not VALID yet"
    have = get(f"/v1/appStoreVersions/{v['id']}/relationships/build")["data"]
    if have and have["id"] == build["id"]:
        print(f"  build: {version} ({number}) already attached")
        return
    api("PATCH", f"/v1/appStoreVersions/{v['id']}/relationships/build", json={"data": {"type": "builds", "id": build["id"]}})
    print(f"  build: {version} ({number}) attached")


FEEDBACK_EMAIL = "ondrej@dorhawk.software"
BETA_DESCRIPTION = {
    "cs": (
        "Obálka je aplikace pro datové schránky: všechny schránky v jednom seznamu, šifrovaný archiv "
        "zpráv, příloh a podepsaných originálů v telefonu, který přetrvá i 90 dní, po kterých ISDS zprávy "
        "maže, a běžící lhůty a doručení fikcí na očích.\n\n"
        "Co vyzkoušet: přidání schránky, čtení a stažení zpráv a příloh, Odeslané, odeslání zprávy, "
        "hledání, zálohu a přenos do jiného telefonu. Ke schránce se aplikace připojuje jen na váš "
        "pokyn, nic se neděje na pozadí.\n\n"
        "Chyby a připomínky posílejte z TestFlightu (snímek obrazovky) nebo e-mailem."
    ),
    "en-US": (
        "Obálka is an app for Czech data boxes (ISDS): every box in one list, an encrypted archive of "
        "messages, attachments and signed originals on your phone that outlives the 90 days ISDS keeps "
        "them, and running deadlines and deemed delivery in plain sight.\n\n"
        "What to try: adding a box, reading and downloading messages and attachments, Sent, sending a "
        "message, search, backup and moving to another phone. The app contacts a box only when you ask "
        "it to; nothing happens in the background.\n\n"
        "Send bugs and ideas from TestFlight (a screenshot) or by e-mail."
    ),
}
BETA_REVIEW_NOTES = (
    "Obálka is a client for the Czech state's data box system (ISDS) and needs an ISDS login. The demo "
    "account is a box on ISDS's public TEST environment. On the sign-in screen, open \"Pokročilé\" "
    "(Advanced) and choose \"Testovací\" (Test) before signing in, with the method \"Jméno a heslo\" "
    "(name and password); left on the default production environment, the login is refused. The app "
    "starts in Czech; English is under Nastavení (Settings) > Jazyk (Language) > English."
)


def beta_info(dry: bool = False):
    """TestFlight's Test Information, both languages, and the beta review contact and notes. The demo
    account's name and password are NOT set here: there is no czebox password in this repository or
    anywhere the script can read, so the owner types them into App Store Connect."""
    aid = app_id()
    existing = {
        l["attributes"]["locale"]: (l["id"], l["attributes"])
        for l in get(f"/v1/apps/{aid}/betaAppLocalizations")["data"]
    }
    for locale, description in BETA_DESCRIPTION.items():
        want = {
            "description": description,
            "feedbackEmail": FEEDBACK_EMAIL,
            "marketingUrl": REPO,
            "privacyPolicyUrl": PRIVACY[locale],
        }
        diff = _upsert("betaAppLocalizations", "app", "apps", aid, existing, locale, want, dry)
        print(f"  [{locale}] Test Information: {'already' if not diff else ('would set ' if dry else 'set ') + ', '.join(diff)}")
    detail = get(f"/v1/apps/{aid}/betaAppReviewDetail")["data"]
    want = {
        "contactFirstName": "Ondřej",
        "contactLastName": "Šimon",
        "contactEmail": FEEDBACK_EMAIL,
        "demoAccountRequired": True,
        "notes": BETA_REVIEW_NOTES,
    }
    have = detail["attributes"]
    diff = {k: v for k, v in want.items() if have.get(k) != v}
    if diff and not dry:
        api("PATCH", f"/v1/betaAppReviewDetails/{detail['id']}",
            json={"data": {"type": "betaAppReviewDetails", "id": detail["id"], "attributes": diff}})
    print(f"  beta review contact and notes: {'already' if not diff else ('would set ' if dry else 'set ') + ', '.join(diff)}")
    missing = [k for k in ("contactPhone", "demoAccountName", "demoAccountPassword") if not have.get(k)]
    if missing:
        print(f"  still empty, for the owner to type in App Store Connect: {', '.join(missing)}")


REVIEW_CONTACT = {"contactFirstName": "Ondřej", "contactLastName": "Šimon", "contactEmail": FEEDBACK_EMAIL}


def review_demo(login: str):
    """The demo account Apple signs in with, for Beta App Review AND App Review of the version being
    prepared. The password comes from the environment (`ASC_DEMO_PASSWORD`) and is never written to the
    repository. Apple refuses any change to these records without a contact phone: it is read from
    `ASC_CONTACT_PHONE` when App Store Connect does not hold one yet."""
    import os
    password = os.environ.get("ASC_DEMO_PASSWORD")
    assert password, "ASC_DEMO_PASSWORD is empty"
    phone = os.environ.get("ASC_CONTACT_PHONE")
    aid = app_id()

    def merged(have: dict) -> dict:
        want = {**REVIEW_CONTACT, "demoAccountName": login, "demoAccountPassword": password,
                "demoAccountRequired": True}
        if not have.get("contactPhone"):
            assert phone, "App Store Connect has no contact phone yet: set ASC_CONTACT_PHONE (+420...)"
            want["contactPhone"] = phone
        return {k: v for k, v in want.items() if have.get(k) != v}

    beta = get(f"/v1/apps/{aid}/betaAppReviewDetail")["data"]
    diff = merged(beta["attributes"])
    if diff:
        api("PATCH", f"/v1/betaAppReviewDetails/{beta['id']}",
            json={"data": {"type": "betaAppReviewDetails", "id": beta["id"], "attributes": diff}})
    print(f"  Beta App Review: {'already' if not diff else 'set ' + ', '.join(diff)}")

    v = _editable("appStoreVersions", "appStoreState", ("READY_FOR_SALE", "REPLACED_WITH_NEW_VERSION"))
    found = get(f"/v1/appStoreVersions/{v['id']}/appStoreReviewDetail").get("data")
    if found is None:
        want = merged({})
        want["notes"] = BETA_REVIEW_NOTES
        api("POST", "/v1/appStoreReviewDetails",
            json={"data": {"type": "appStoreReviewDetails", "attributes": want,
                           "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": v["id"]}}}}})
        print(f"  App Review ({v['attributes']['versionString']}): created with " + ", ".join(want))
        return
    diff = merged(found["attributes"])
    if not found["attributes"].get("notes"):
        diff["notes"] = BETA_REVIEW_NOTES
    if diff:
        api("PATCH", f"/v1/appStoreReviewDetails/{found['id']}",
            json={"data": {"type": "appStoreReviewDetails", "id": found["id"], "attributes": diff}})
    print(f"  App Review ({v['attributes']['versionString']}): {'already' if not diff else 'set ' + ', '.join(diff)}")


def _build(number: str) -> dict:
    found = get(f"/v1/builds?filter[app]={app_id()}&filter[version]={number}")["data"]
    assert found, f"no build {number}"
    state = found[0]["attributes"]["processingState"]
    assert state == "VALID", f"build {number} is {state}, not VALID yet"
    return found[0]


def beta_add(number: str, group: str):
    """Puts a processed build in a TestFlight group by the group's name. An external group's testers get
    it once Beta App Review has passed it (`beta submit`)."""
    build = _build(number)
    groups = [g for g in get(f"/v1/apps/{app_id()}/betaGroups")["data"] if g["attributes"]["name"] == group]
    assert groups, f"no TestFlight group named {group!r}"
    gid = groups[0]["id"]
    have = {b["id"] for b in get(f"/v1/betaGroups/{gid}/relationships/builds")["data"]}
    if build["id"] in have:
        print(f"  build {number}: already in {group}")
        return
    api("POST", f"/v1/betaGroups/{gid}/relationships/builds", json={"data": [{"type": "builds", "id": build["id"]}]})
    print(f"  build {number}: added to {group}")


def beta_submit(number: str):
    """Sends a build to Beta App Review - what external testers wait on. Apple refuses it while the Test
    Information or the review details are incomplete, and says which; that refusal is printed."""
    build = _build(number)
    state = get(f"/v1/builds/{build['id']}/buildBetaDetail")["data"]["attributes"].get("externalBuildState")
    if state in ("WAITING_FOR_BETA_REVIEW", "IN_BETA_REVIEW", "BETA_APPROVED", "IN_BETA_TESTING"):
        print(f"  build {number}: already {state}")
        return
    api("POST", "/v1/betaAppReviewSubmissions",
        json={"data": {"type": "betaAppReviewSubmissions",
                       "relationships": {"build": {"data": {"type": "builds", "id": build["id"]}}}}})
    print(f"  build {number}: sent to Beta App Review")


def review_submit():
    """Sends the version being prepared to App Review: a review submission for the app, the version as
    its one item, then submitted. Refuses without a VALID build attached. Apple names whatever else is
    missing (screenshots, privacy answers, review details) in its refusal, which is printed. An open
    submission left by an earlier attempt is reused rather than duplicated."""
    v = _editable("appStoreVersions", "appStoreState", ("READY_FOR_SALE", "REPLACED_WITH_NEW_VERSION"))
    version, state = v["attributes"]["versionString"], v["attributes"]["appStoreState"]
    if state != "PREPARE_FOR_SUBMISSION":
        print(f"  {version}: already {state}")
        return
    build = get(f"/v1/appStoreVersions/{v['id']}/build")["data"]
    assert build, f"no build attached to {version} - run `build <number>` first"
    assert build["attributes"]["processingState"] == "VALID", build["attributes"]["processingState"]
    aid = app_id()
    open_subs = [r for r in get(f"/v1/reviewSubmissions?filter[app]={aid}&filter[platform]=IOS")["data"]
                 if r["attributes"].get("state") == "READY_FOR_REVIEW"]
    if open_subs:
        sub_id = open_subs[0]["id"]
    else:
        sub_id = api("POST", "/v1/reviewSubmissions", json={"data": {
            "type": "reviewSubmissions", "attributes": {"platform": "IOS"},
            "relationships": {"app": {"data": {"type": "apps", "id": aid}}}}})["data"]["id"]
    items = get(f"/v1/reviewSubmissions/{sub_id}/items")["data"]
    if not items:
        api("POST", "/v1/reviewSubmissionItems", json={"data": {
            "type": "reviewSubmissionItems",
            "relationships": {"reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sub_id}},
                              "appStoreVersion": {"data": {"type": "appStoreVersions", "id": v["id"]}}}}})
    api("PATCH", f"/v1/reviewSubmissions/{sub_id}", json={"data": {
        "type": "reviewSubmissions", "id": sub_id, "attributes": {"submitted": True}}})
    print(f"  {version} ({build['attributes']['version']}): submitted to App Review")


BETA_GROUP = "Beta"


def beta_release(number: str, wait_minutes: int = 0):
    """What the release workflow runs once a build is uploaded (owner, 2026-11-11: "a release warrants a
    beta version"): wait for Apple to process build `number`, set its What to Test from the changelog,
    put it in the external Beta group - the public link's - and send it to Beta App Review.

    Apple reviews one build of a version at a time: while an earlier build waits, it refuses the next
    with ANOTHER_BUILD_IN_REVIEW. That is reported as a warning, not a failure - the build is in the
    group and goes to testers once it is sent (`beta submit <number>`) after the earlier one clears."""
    deadline = time.time() + wait_minutes * 60
    while True:
        found = get(f"/v1/builds?filter[app]={app_id()}&filter[version]={number}&include=preReleaseVersion")
        state = found["data"][0]["attributes"]["processingState"] if found["data"] else "NOT_UPLOADED_YET"
        if state == "VALID":
            break
        if state in ("FAILED", "INVALID") or time.time() > deadline:
            sys.exit(f"build {number}: {state}")
        print(f"  build {number}: {state}, waiting", flush=True)
        time.sleep(60)
    build = found["data"][0]
    version = next(i["attributes"]["version"] for i in found.get("included", [])
                   if i["type"] == "preReleaseVersions")
    have = {l["attributes"]["locale"]: (l["id"], l["attributes"])
            for l in get(f"/v1/builds/{build['id']}/betaBuildLocalizations")["data"]}
    for lang, locale in STORE_LOCALES.items():
        _upsert("betaBuildLocalizations", "build", "builds", build["id"], have, locale,
                {"whatsNew": changelog_text(version, lang)}, False)
    print(f"  build {number} ({version}): What to Test set")
    beta_add(number, BETA_GROUP)
    detail = get(f"/v1/builds/{build['id']}/buildBetaDetail")["data"]["attributes"].get("externalBuildState")
    if detail in ("WAITING_FOR_BETA_REVIEW", "IN_BETA_REVIEW", "BETA_APPROVED", "IN_BETA_TESTING"):
        print(f"  build {number}: already {detail}")
        return
    r = requests.post(f"{BASE}/v1/betaAppReviewSubmissions", headers={"Authorization": f"Bearer {token()}"},
                      timeout=60, json={"data": {"type": "betaAppReviewSubmissions", "relationships": {
                          "build": {"data": {"type": "builds", "id": build["id"]}}}}})
    if r.status_code == 422 and "ANOTHER_BUILD_IN_REVIEW" in r.text:
        print(f"::warning::Build {number} is in the {BETA_GROUP} group but not in Beta App Review: an earlier "
              f"build of {version} is still waiting there. Once it clears: uv run tools/asc.py beta submit {number}")
        return
    if r.status_code >= 400:
        sys.exit(f"POST /v1/betaAppReviewSubmissions -> {r.status_code}\n{r.text[:2000]}")
    print(f"  build {number}: sent to Beta App Review")


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
    elif cmd == "version":
        set_version(args[0])
    elif cmd == "build":
        set_build(args[0])
    elif cmd == "beta" and args and args[0] == "info":
        beta_info(dry="--dry" in args)
    elif cmd == "beta" and args and args[0] == "add":
        beta_add(args[1], args[2])
    elif cmd == "beta" and args and args[0] == "release":
        wait = int(args[args.index("--wait") + 1]) if "--wait" in args else 0
        beta_release(args[1], wait)
    elif cmd == "beta" and args and args[0] == "submit":
        beta_submit(args[1])
    elif cmd == "review" and args and args[0] == "submit":
        review_submit()
    elif cmd == "review" and args and args[0] == "demo":
        review_demo(args[1])
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
