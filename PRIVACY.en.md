# Privacy policy – Obálka

[Česká verze](PRIVACY.md)

Effective 24 September 2026. Earlier versions are in this file's history on GitHub.

## In short

- **The app has no server.** It talks directly to the Czech data-box system (ISDS), and only when
  you ask it to.
- **Your messages, attachments and passwords stay on your phone.** The app's developers have no
  access to them.
- **Error reports are sent only with your consent**, without message content, names or box IDs.
- **Moving to another phone** may go through the public server of the croc tool, encrypted – the
  server cannot see the content.
- **No ads, no tracking, no account, no selling of data.**

## Who is responsible

The data controller is Ondřej Šimon, ondrej@dorhawk.software, who publishes the app under the name
"Dorhawk Software" (not a company).

Obálka is an independent, open-source app. It is not an official app of the Digital and Information
Agency (the ISDS administrator) or of Česká pošta (the ISDS operator).

## What stays on your phone

The app's developers do not process this data and have no access to it:

- **sign-in details and sessions** – in the phone's secure storage (iOS Keychain, Android Keystore),
  encrypted;
- **the message archive** (envelopes, states, drafts, reminders, settings) – in an encrypted database;
- **downloaded attachments and signed message originals** – in the app's own storage, which other
  apps cannot reach;
- **archive backups** – encrypted with a password the app creates; kept on the phone, or wherever
  you save the file yourself;
- **the debug-mode record** – only if you turn it on; a file on your phone that only you share.

The app's data is **not included in whole-phone backups** (iCloud, Google, a computer) or in the
copy made when setting up a new phone. To move it, use the app's own backup or transfer.

The camera is used only to read a QR code off the other phone's screen; the code is read on the
phone and nothing is stored or sent. Notifications are only local reminders of deadlines you set.
Fingerprint or face is checked by the phone's system; the app only learns the result.

## Who the app talks to

### ISDS (data boxes)

That is what the app is for. It sends what ISDS needs: your sign-in details, requests for messages,
and the messages you send. Always over HTTPS, directly from the phone, only when you act (opening the
app or a box, refreshing, downloading or sending a message), never in the background. What happens
to data in ISDS is governed by the ISDS rules.

Note: under Czech law, simply loading the list of received messages counts as delivery (Section
17(3) of Act No. 300/2008 Coll.). This is true of every data-box app.

### Sentry – error reports, only with consent

The app asks whether it may send error reports. Until you answer, it sends nothing. You can change
your answer at any time in Settings → Diagnostics.

- **What a report contains:** what went wrong and where in the code, the app and system version,
  the phone model, technical details (memory, language, time zone). On Android, also a random
  identifier the Sentry library creates when the app is installed – not linked to you in any way.
- **What it never contains:** message content or subjects, names, box IDs, sign-in details,
  attachments.
- **Your IP address** is not stored by Sentry. Sentry does derive an approximate location (country,
  possibly city) from it when the report arrives.
- On Android, the first start after you consent may also send a report of an earlier freeze of the
  app.
- **Where:** Sentry (Functional Software, Inc., USA); reports are stored on servers in the EU
  (Frankfurt). Sentry is a US company, so the data may also be accessed from the USA; Sentry is
  certified under the EU-US Data Privacy Framework, and a data processing agreement with Sentry is
  in place.
- **How long:** 30 days, then the reports are deleted.
- Only the app's developers read the reports, to fix errors.

### Moving to another phone

Only when you start a transfer yourself. The phones first try to connect directly on your network.
If they cannot, they connect through the public server of the open-source croc tool
(croc.schollz.com), run by its author Zack Schollz; the server is currently in Germany. The server
sees both phones' IP addresses, the time and the amount of data. It cannot see the content, which is
encrypted between the two phones with a key from a one-time phrase only you have. Sign-in details are
never transferred. On an iPhone, the system asks for access to the local network at the first
transfer; if you do not allow it, the transfer goes through the server.

### Links and stores

Links (such as the data-box portal) open in your browser. Apple and Google process data about
downloading the app under their own policies.

## Legal basis

- **Error reports:** your consent (Art. 6(1)(a) GDPR and Section 89(3) of Czech Act No. 127/2005
  Coll.). You can withdraw it at any time in Settings.
- **E-mails you send us:** handling your request (Art. 6(1)(f) GDPR).
- **Data on your phone, and the traffic with ISDS and the croc server:** the app's developers do not
  process this data; the app on your phone does, at your instruction.

## How long

- **On the phone:** until you delete it – by removing a box or uninstalling the app.
- **Error reports:** 30 days.
- **The croc server:** only for the duration of a transfer.
- **E-mails:** only as long as needed to handle your request.

## Your rights

You have the right to access your data, to have it corrected or erased, to restrict processing, to
data portability, to object, and to withdraw consent at any time. Just write to
ondrej@dorhawk.software.

Error reports contain nothing that would tie them to you, so they usually cannot be traced back to
you; they are deleted after 30 days anyway, and you can stop them in Settings.

You can complain to the Czech data protection authority, Úřad pro ochranu osobních údajů,
Pplk. Sochora 27, 170 00 Praha 7, Czech Republic, https://uoou.gov.cz.

## Children

The app is not intended for children under 15.

## Security

The source code is public: https://github.com/dorhawk-software/obalka. Please report security issues
privately to ondrej@dorhawk.software or as described in SECURITY.md.

## Changes

Changes will be published in this file with a new effective date. The full history is on GitHub.
