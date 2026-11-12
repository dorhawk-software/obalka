// No dialog, sheet or modal stays over the lock screen (2026-11-12).
//
// An RN `Modal` is a native window of its own, drawn ABOVE the in-tree lock cover. A dialog left open
// when the app goes to the background is still there, over the lock screen, when it comes back. The
// app has two answers: a dialog the person opened closes as the app leaves (`useCloseOnBackground`);
// one the app raised by itself waits, hidden, while the app is covered (`useAppCovered`).
//
// The identity pass's second inventory found seven places with neither: the Settings, Transfer and
// Debug dialogs, the attachment and signed-original dialogs on a message, the paid-send confirmation
// and the sender sheet. Each file that renders a `Dialog`, `BottomSheet` or `Modal` therefore uses one
// of the two, or is rendered only inside a parent that does (NESTED, checked below).

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');

/** The components themselves: they draw the window, their callers decide when it closes. */
const DEFINITIONS = new Set(['src/theme/Dialog.tsx', 'src/theme/BottomSheet.tsx']);

/** Rendered only inside a parent that closes them on background: child -> parent. */
const NESTED: Record<string, { parent: string; tag: string }> = {
  'src/features/accounts/screens/AliasEditor.tsx': {
    parent: 'src/features/accounts/screens/BoxSwitcherSheet.tsx',
    tag: '<AliasEditor',
  },
  'src/features/accounts/screens/RemoveBoxDialog.tsx': {
    parent: 'src/features/accounts/screens/BoxSwitcherSheet.tsx',
    tag: '<RemoveBoxDialog',
  },
  // Raised by the app itself after an update; AppShell holds it while covered.
  'src/app/whatsNew/WhatsNewSheet.tsx': { parent: 'src/app/AppShell.tsx', tag: '<WhatsNewSheet' },
};

const MODAL = /<(Dialog|BottomSheet|Modal)\b/;
const GUARDED = /\buse(CloseOnBackground|AppCovered)\(/;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return tsxFiles(path);
    }
    return path.endsWith('.tsx') ? [path] : [];
  });
}

const source = (file: string) => readFileSync(join(ROOT, file), 'utf8');

const modalFiles = tsxFiles(SRC)
  .map(path => relative(ROOT, path))
  .filter(file => !DEFINITIONS.has(file) && MODAL.test(source(file)));

describe('every dialog, sheet and modal leaves with the app', () => {
  it('finds the files that render one (the sweep cannot pass by finding nothing)', () => {
    expect(modalFiles.length).toBeGreaterThanOrEqual(15);
  });

  it.each(modalFiles)('%s closes on background or waits while covered', file => {
    const nested = NESTED[file];
    if (nested) {
      // Only safe while its parent closes it and is where it is rendered.
      expect(source(nested.parent)).toMatch(GUARDED);
      const renderedIn = tsxFiles(SRC)
        .map(path => relative(ROOT, path))
        .filter(other => other !== file && source(other).includes(nested.tag));
      expect(renderedIn).toEqual([nested.parent]);
      return;
    }
    if (!GUARDED.test(source(file))) {
      throw new Error(
        `${file} renders a Dialog, BottomSheet or Modal but neither closes it when the app goes to ` +
          'the background (useCloseOnBackground, for one the person opened) nor holds it while the ' +
          'app is covered (useAppCovered, for one the app raised). An RN Modal draws above the lock ' +
          'cover, so it would stay over the lock screen.',
      );
    }
  });
});
