// Every question carries what it is about (board R9, 031 I84-I105, agreed 2026-11-12): "one anatomy for
// every question: grabber, the object or glyph the question is about, title, text, the answer under
// the thumb". Until 2026-11-15 two of the 22 had a glyph and one its object; the rest opened on a bare
// title. Read from the source, so a new dialog without one fails here rather than on a device.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import ts from 'typescript';

const ROOT = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return /\.tsx$/.test(entry) ? [full] : [];
  });
}

/** Each `<Dialog …>` in a file: its line, and whether it names a glyph or an object. */
export function dialogsIn(file: string, text: string): { line: number; carries: boolean }[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: { line: number; carries: boolean }[] = [];
  const visit = (node: ts.Node) => {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening && opening.tagName.getText(sf) === 'Dialog') {
      const names = opening.attributes.properties
        .filter(ts.isJsxAttribute)
        .map(a => a.name.getText(sf));
      out.push({
        line: sf.getLineAndCharacterOfPosition(opening.getStart(sf)).line + 1,
        carries: names.includes('glyph') || names.includes('object'),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe('every dialog, as R9 draws it', () => {
  const found = sourceFiles(join(ROOT, 'src'))
    .filter(f => !f.endsWith(join('theme', 'Dialog.tsx')))
    .flatMap(f => dialogsIn(f, readFileSync(f, 'utf8')).map(d => ({ ...d, file: relative(ROOT, f) })));

  // 23 since 2026-11-15: the paid-send question (I40) is a Dialog, carrying its stamp.
  it('finds them all: 23 in the code (tasks.md I84-I105, I40)', () => {
    expect(found.length).toBe(23);
  });

  it('carries the glyph or the object it is about', () => {
    const bare = found.filter(d => !d.carries).map(d => `${d.file}:${d.line}`);
    expect(bare).toEqual([]);
  });

  it('is judged by the Dialog element itself', () => {
    // The checker proven against the case it exists to catch, so a bug in it cannot pass every dialog.
    const src = `const a = <Dialog title="x" body="y" actions={[]} onDismiss={() => {}} />;
const b = <Dialog glyph="lock" title="x" body="y" actions={[]} onDismiss={() => {}} />;`;
    expect(dialogsIn('x.tsx', src).map(d => d.carries)).toEqual([false, true]);
  });
});
