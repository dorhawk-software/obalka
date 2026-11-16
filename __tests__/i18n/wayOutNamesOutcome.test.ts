// Every button names its outcome (practices 1.6, visual-craft.md): until 2026-11-16 ten dialogs ended
// in a bare "Zrušit" and the transfer form in a bare "Přijmout". The owner picked "name what stays"
// (T050.1): each way out says what stays as it is.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { STRINGS_FOR_TEST } from '../../src/i18n/strings';

const AGREED: Record<string, [string, string]> = {
  'backup.off.keep': ['Nechat zapnuté', 'Keep it on'],
  'backup.docs.keep': ['Nechat jak je', 'Leave as it is'],
  'settings.autoDownload.ask.keep': ['Nechat vypnuté', 'Keep it off'],
  'transfer.metered.wait': ['Počkat na Wi-Fi', 'Wait for Wi-Fi'],
  'transfer.got.decline': ['Neukládat', "Don't save"],
  'common.keep': ['Ponechat', 'Keep'],
  'lock.reset.keep': ['Nechat zámek', 'Keep the lock'],
  'send.confirm.cancel': ['Neodesílat', "Don't send"],
  'transfer.scanner.close': ['Zavřít fotoaparát', 'Close the camera'],
  'login.mobileKey.cancel': ['Zrušit přihlášení', 'Stop signing in'],
  'transfer.start': ['Přijmout zálohu', 'Receive the backup'],
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

it('says what each way out leaves as it is, in both languages', () => {
  for (const [key, [cs, en]] of Object.entries(AGREED)) {
    expect([key, STRINGS_FOR_TEST.cs[key], STRINGS_FOR_TEST.en[key]]).toEqual([key, cs, en]);
  }
});

it('has no button that says only "Zrušit" or "Cancel"', () => {
  for (const locale of ['cs', 'en'] as const) {
    const bare = Object.entries(STRINGS_FOR_TEST[locale]).filter(([, v]) => /^(Zrušit|Cancel)$/.test(v));
    expect(bare).toEqual([]);
  }
  const using = sources(join(__dirname, '../../src')).filter(f =>
    /t\('(common|login)\.cancel'\)/.test(readFileSync(f, 'utf8')),
  );
  expect(using).toEqual([]);
});
