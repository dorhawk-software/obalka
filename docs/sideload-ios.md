# Run Obálka on your iPhone (build in CI → sideload with Sideloadly)

This builds the app in GitHub Actions as an **unsigned** `.ipa`, which you then install on your iPhone
with **Sideloadly** - it re-signs the app with **your own Apple ID** on your computer. **No Apple
Developer account ($99/yr) is required** (a free Apple ID works, with the limits noted at the bottom).

> First time doing this? Follow the steps in order. It takes ~15 min the first time.

## Step 1 - Build the IPA (GitHub Actions)

1. Go to the repo on GitHub → **Actions** tab.
2. In the left sidebar pick **"iOS - unsigned IPA (for Sideloadly)"**.
3. Click **Run workflow** → **Run workflow** (on `main`). It builds on a macOS runner (~10–20 min).
4. When it finishes (green ✓), open the run and download the artifact
   **`ObalkaDatovaSchranka-unsigned-ipa`** (a `.zip`). Unzip it - inside is
   `ObalkaDatovaSchranka-unsigned.ipa`. That's the file you'll install.

> If the build goes red, open the failing step's log. The most common first-run fixes are the **Xcode
> version** (change `runs-on: macos-15` in `.github/workflows/ios-sideload.yml`) or a CocoaPods hiccup
> (re-run the job). The build is unsigned on purpose - Sideloadly does the signing next.

## Step 2 - Install Sideloadly (your computer)

> **On Linux?** Sideloadly is macOS/Windows-only - use **iloader** instead and follow
> `docs/sideload-ios-linux.md` from here (Step 1's IPA is the same).

1. Download it from **https://sideloadly.io** (macOS or Windows) and install.
2. On **Windows**, also install **iTunes** (the Apple version, not the Microsoft Store one) and
   **iCloud** - Sideloadly needs Apple's drivers to talk to the phone. On **macOS** nothing extra is
   needed.

## Step 3 - Sideload onto the iPhone

1. Connect your iPhone to the computer with a **USB cable**. Unlock it and tap **Trust** if asked.
2. Open **Sideloadly**. Your device should appear at the top.
3. Drag **`ObalkaDatovaSchranka-unsigned.ipa`** onto the Sideloadly window (or use the IPA picker).
4. Enter your **Apple ID** (email). Tip: use a throwaway Apple ID, not your main one - the app gets
   signed under it.
   - If your Apple ID has **two-factor auth** (it should), Sideloadly will ask for an
     **app-specific password**. Create one at **appleid.apple.com → Sign-In & Security → App-Specific
     Passwords**, and paste it.
5. (Recommended) In Sideloadly's advanced options, set a **unique Bundle ID** like
   `com.<yourname>.obalka` so it doesn't clash with anything. (The project default is the RN template
   id `org.reactjs.native.example.ObalkaDatovaSchranka`.)
6. Click **Start**. Sideloadly signs the app and installs it. Watch the log until **"Done"**.

## Step 4 - Trust the app on the iPhone

A self-signed app won't open until you trust the certificate:

1. On the iPhone: **Settings → General → VPN & Device Management** (older iOS: *Profiles & Device
   Management*).
2. Under **Developer App**, tap your Apple ID, then **Trust "…"** → **Trust**.
3. Launch **Obálka** from the home screen. 🎉

## Important to know (free Apple ID limits)

- **It expires after 7 days.** A free Apple ID signature is valid for **7 days** - after that the app
  won't launch until you **re-run Sideloadly** (repeat Step 3) to refresh it. A **paid Apple Developer
  account** extends this to **1 year**.
- **Max 3 sideloaded apps** per free Apple ID at a time.
- **Entitlements:** local notifications (deadline reminders) generally work when sideloaded, but
  entitlement-gated features cannot — iCloud backup, for instance, needs an entitlement a free Apple ID
  signature does not carry.
- **Keep the IPA** you downloaded; you can re-sideload the same file each week without rebuilding.

## Doing this often? (optional)

- Sideloadly has a **"Sideload + AltStore/Wireless"** style refresh; pairing it with **AltStore** can
  auto-refresh the 7-day signature over Wi-Fi so you don't have to re-plug weekly.
- Long-term, the proper path is a paid Apple Developer account + a signed TestFlight build - see
  `docs/release-ci.md` for that CI direction.
