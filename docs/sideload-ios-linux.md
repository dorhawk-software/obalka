# Run Obálka on your iPhone from **Linux** (iloader)

Sideloadly is macOS/Windows-only. On Linux the tool for this is **[iloader](https://github.com/nab138/iloader)** -
a desktop app that re-signs the unsigned IPA with your Apple ID and installs it over USB. It does the whole
job in a GUI: Apple-ID sign-in, Apple auth (anisette), code-signing, install. No Docker, no command-line
anisette server, no separate signer to wire up. Input is the IPA from the `iOS - unsigned IPA` GitHub Action
(see `docs/sideload-ios.md`, Step 1, for building and downloading it).

> A **free** Apple ID works (7-day expiry - re-run weekly). A paid Apple Developer account lasts a year.

> [!WARNING]
> **Ignore the AltServer-Linux guides you will find elsewhere.** Searching for "sideload iOS on Linux"
> turns up **AltServer-Linux** and **SideStore's Linux installer**, and on **iOS 26.4+** both produce an
> app that installs cleanly and then **crashes the instant you tap it** - blank icon, no error, and no
> crash report, so it reads as a broken app rather than a broken signature. It is not an app bug and
> there is nothing to debug in it. Both sign with `ldid`; iOS 26 rejects that signature in the kernel.
> iloader signs with a different signer and is unaffected. The [background section](#background-the-ios-26-launch-crash)
> explains the failure, because a silent crash with no report is worth being able to recognise.

## 1. Install usbmuxd (one-time)

iloader talks to the iPhone over USB via `usbmuxd` - usually already present; install it if not:

```bash
sudo apt install -y usbmuxd
# (socket-activated; if the device isn't seen later: sudo systemctl start usbmuxd)
```

## 2. Get iloader

Download the Linux build from the [releases page](https://github.com/nab138/iloader/releases). For a normal
x86_64 PC that is **`iloader-linux-amd64.AppImage`**:

```bash
# AppImage (x86_64), always the newest release:
wget -O iloader.AppImage \
  https://github.com/nab138/iloader/releases/latest/download/iloader-linux-amd64.AppImage
chmod +x iloader.AppImage
./iloader.AppImage
```

Other routes, same release: `.deb` (`iloader-linux-amd64.deb` / `-arm64`), `.rpm`
(`iloader-linux-x86_64.rpm` / `-aarch64`), an `aarch64` AppImage, a community **AUR** package, a Fedora
**COPR**, and a **NixOS** flake (`github:nab138/iloader`).

```bash
# .deb instead of the AppImage:
sudo apt install ./iloader-linux-amd64.deb   # then launch: iloader
```

## 3. Plug in the iPhone

Connect it by **USB cable**, unlock it, and tap **Trust** on the phone if prompted. iloader manages the
pairing for you (no manual `idevicepair`).

## 4. Install the IPA in iloader

1. Open iloader - your device appears once it is connected and trusted.
2. **Sign in with your Apple ID.** iloader handles Apple's auth itself, so use your **normal Apple ID
   password** (not an app-specific password) and enter the **6-digit two-factor code** if asked.
   - Tip: use a **throwaway Apple ID** - the app is signed under it.
3. Choose **Import any IPA** and pick **`ObalkaDatovaSchranka-unsigned.ipa`**.
4. iloader generates the certificate, signs, and installs. Wait for it to report success.

## 5. Trust the app on the iPhone

1. **Settings → General → VPN & Device Management** → under *Developer App* tap your Apple ID → **Trust**.
2. Launch **Obálka**. 🎉

## Keeping it alive (free Apple ID = 7-day signature)

A free Apple ID signs for **7 days**; after that the app will not launch until you refresh it. Either:

- **Re-run step 4** every 7 days or less. It re-signs and reinstalls the same IPA, so there is no rebuild,
  and the app's data survives.
- **Or** use iloader's **Install SideStore** action once. SideStore refreshes signatures from the phone,
  so a weekly refresh stops needing the computer. iloader places the pairing files SideStore needs as part
  of that install.

iloader does not yet refresh apps by itself - it is on the project's roadmap, not in it. Plan for one of the
two options above.

A free Apple ID allows only **3 sideloaded apps** at a time. iloader can **view and revoke** your
development certificates and app IDs from its UI to clear space.

## Troubleshooting

- **Device not detected** → unlock the phone, replug, `sudo systemctl restart usbmuxd`, re-open iloader and
  re-tap **Trust** on the phone.
- **Apple-ID / auth errors** → check the password (normal, not app-specific) and the 2FA code; iloader shows
  error suggestions inline. Logs: `~/.local/share/me.nabdev.iloader/logs/` (set log level to *Debug* in the
  app).
- **"Maximum number of apps"** → a free Apple ID allows only 3 sideloaded apps; revoke one in iloader's
  certificate manager or delete an app from the phone.
- **App installs, then crashes instantly with no crash report** → it was signed with `ldid`, which means it
  was not installed by iloader. See below.

## Background: the iOS-26 launch crash

Worth recognising, because it produces no error message anywhere.

On **iOS 26.4+**, an app signed by a tool that uses `ldid` - **AltServer-Linux** v0.0.5, and **SideStore's**
Linux installer, which downloads the same AltServer - **installs fine but crashes the instant you tap it**.
A blank icon, a brief flash, no error, **no crash report**.

iOS 26 enforces code signatures in the kernel via **TXM (Trusted Execution Monitor)**, and `ldid`'s signature
encoding (DER entitlements, CodeDirectory hash, designated requirements, CodeResources) diverges from what
modern `codesign` produces, so the kernel kills the process at `exec` before any code runs. That is why
nothing is logged by the app: no app code ever ran. Notably **AMFI (user space) accepts the provisioning
profile** - only the kernel rejects the **signature encoding**, which is why the install itself succeeds and
the failure only appears at launch.

Apple fixed this in AltServer for Windows/macOS (v1.7.4). It has not been ported to AltServer-Linux
(tracking: <https://github.com/NyaMisty/AltServer-Linux/issues/131>).

iloader avoids it by signing with a fork of [`apple-platform-rs`](https://github.com/indygreg/apple-platform-rs)
(the library behind `rcodesign`), whose signature iOS 26 accepts. Confirmed launching on iOS 26.

To confirm a TXM rejection on a misbuilt install, watch the device log while tapping the icon:

```bash
idevicesyslog | grep -iE "TXM|Bootstrap failed|ObalkaDatovaSchranka"
# kernel  TXM [Error]: CodeSignature: …  +  SpringBoard … pid -1 … Bootstrap failed  = signature rejected
```
