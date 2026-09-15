// Every overlay keeps the screen reader inside it.
//
// Each overlay in this app is a transparent RN `Modal` over live content. On Android that is
// enough: the `Modal` is a dialog WINDOW of its own (`ReactModalHostView` builds a `ComponentDialog`
// and hands its children to it), and TalkBack stays in the window that has focus. On iOS it is not:
// a transparent `Modal` is presented over-full-screen, the screen behind stays in the hierarchy, and
// VoiceOver will wander onto it unless the overlay's content says `accessibilityViewIsModal`.
//
// `theme/Dialog.tsx` had that from the start. The audit of 2026-09-09 found five sibling overlays
// without it (P2-10); two were fixed, and the alias editor, the ⋯ box menu and the reminder picker
// were still letting the cursor reach the inbox, the switcher rows and the message behind them.
//
// So this asserts the shape of containment rather than the presence of a prop:
//   1. each `Modal` holds exactly ONE container marked modal - the iOS half; the `Modal` itself is
//      the Android half,
//   2. everything a screen reader can land on inside the `Modal` is inside that container - a
//      button beside the card would sit outside the fence,
//   3. nothing between the `Modal` and the container is an accessibility element, because on iOS an
//      element is a LEAF and would swallow the whole card into one unreachable blob.
// And, because a render test only knows the overlays it renders, a source scan that every `<Modal>`
// under `src/` holds a container marked modal.
//
// What this cannot prove is VoiceOver's own behaviour. Apple documents the prop as hiding the
// receiver's SIBLINGS, and each card here is the only child of its wrappers - so whether the prop on a
// card inside a presented `Modal` really fences out the screen that presented it is the question the
// device pass has to answer, for all six overlays alike, not something a render tree can settle.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import ts from 'typescript';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { Dialog } from '../../src/theme/Dialog';
import { AliasEditor } from '../../src/features/accounts/screens/AliasEditor';
import { BoxOverflowMenu } from '../../src/features/accounts/screens/BoxOverflowMenu';
import { BoxSwitcherSheet } from '../../src/features/accounts/screens/BoxSwitcherSheet';
import { TermPicker } from '../../src/features/messages/screens/TermPicker';
import type { DataBoxAccount } from '../../src/services/isds/types';

const account = (boxId: string): DataBoxAccount => ({
  id: boxId,
  boxId,
  loginName: 'user',
  label: `Box ${boxId}`,
  dbType: null,
  alias: null,
  authMethod: 'password',
  host: 'czebox',
  secretRef: 'ref',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 0,
  updatedAt: 0,
});

function wrap(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>{ui}</AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
}

type JsonNode = {
  type: string;
  props: Record<string, unknown>;
  children: (JsonNode | string)[] | null;
};

type Json = JsonNode | JsonNode[] | null;

function roots(json: Json): JsonNode[] {
  if (json == null) {
    return [];
  }
  return Array.isArray(json) ? json : [json];
}

function elementChildren(node: JsonNode): JsonNode[] {
  return (node.children ?? []).filter((c): c is JsonNode => typeof c !== 'string');
}

/** Every `Modal` in the tree, nested ones included. */
function findModals(nodes: JsonNode[]): JsonNode[] {
  return nodes.flatMap(n => [
    ...(n.type === 'Modal' ? [n] : []),
    ...findModals(elementChildren(n)),
  ]);
}

/**
 * The nodes inside one `Modal`, each with the chain of ancestors between it and the `Modal`.
 * A nested `Modal` is not descended into: it is a window (or presentation) of its own and is checked
 * on its own turn.
 */
function inside(modal: JsonNode): { node: JsonNode; path: JsonNode[] }[] {
  const out: { node: JsonNode; path: JsonNode[] }[] = [];
  const visit = (node: JsonNode, path: JsonNode[]) => {
    for (const child of elementChildren(node)) {
      if (child.type === 'Modal') {
        continue;
      }
      out.push({ node: child, path });
      visit(child, [...path, child]);
    }
  };
  visit(modal, []);
  return out;
}

/** What a screen reader can land on: text, a field, or anything marked as an element. */
function reachable(node: JsonNode): boolean {
  return (
    node.type === 'Text' ||
    node.type === 'TextInput' ||
    node.props.accessible === true ||
    typeof node.props.accessibilityLabel === 'string' ||
    typeof node.props.accessibilityRole === 'string'
  );
}

function describeNode(node: JsonNode): string {
  const text = elementChildrenText(node);
  return String(node.props.testID ?? node.props.accessibilityLabel ?? (text || node.type));
}

function elementChildrenText(node: JsonNode): string {
  return (node.children ?? [])
    .map(c => (typeof c === 'string' ? c : elementChildrenText(c)))
    .join('');
}

/** The containment report for every `Modal` currently rendered - see the header for the three rules. */
function containment(json: Json) {
  return findModals(roots(json)).map(modal => {
    const all = inside(modal);
    const containers = all.filter(e => e.node.props.accessibilityViewIsModal === true);
    const container = containers[0]?.node;
    const outside = container
      ? all
          .filter(e => e.node !== container && !e.path.includes(container))
          .filter(e => reachable(e.node))
          .map(e => describeNode(e.node))
      : [];
    const swallowing = container
      ? (containers[0]?.path ?? [])
          .filter(n => n.props.accessible === true)
          .map(describeNode)
      : [];
    return { containers: containers.length, outside, swallowing };
  });
}

const CONTAINED = { containers: 1, outside: [], swallowing: [] };

describe('overlays contain the screen reader', () => {
  it('the dialog - the one that always did', async () => {
    const view = await wrap(
      <Dialog
        title="Odebrat schránku?"
        body="Zprávy zůstanou v archivu."
        onDismiss={() => {}}
        actions={[
          { label: 'Ponechat', onPress: () => {}, testID: 'keep' },
          { label: 'Smazat', onPress: () => {}, tone: 'danger', testID: 'del' },
        ]}
      />,
    );
    expect(containment(view.toJSON() as Json)).toEqual([CONTAINED]);
  });

  it('the alias editor', async () => {
    const view = await wrap(
      <AliasEditor account={account('box1')} onSave={() => {}} onClose={() => {}} />,
    );
    expect(containment(view.toJSON() as Json)).toEqual([CONTAINED]);
  });

  it('the ⋯ box menu, once it is open', async () => {
    const view = await wrap(
      <BoxOverflowMenu account={account('box1')} onRename={() => {}} onRemove={() => {}} />,
    );
    // Closed, there is no overlay to contain - only the trigger.
    expect(containment(view.toJSON() as Json)).toEqual([]);
    await act(async () => {
      fireEvent.press(view.getByTestId('boxMenu-box1'));
    });
    expect(containment(view.toJSON() as Json)).toEqual([CONTAINED]);
  });

  it('the reminder picker', async () => {
    const view = await wrap(
      <TermPicker
        current={Date.UTC(2026, 8, 20)}
        onPick={() => {}}
        onRemove={() => {}}
        onClose={() => {}}
        now={Date.UTC(2026, 8, 14)}
      />,
    );
    expect(containment(view.toJSON() as Json)).toEqual([CONTAINED]);
  });

  it('the box switcher, and the menu and editor that open on top of it', async () => {
    const view = await wrap(
      <BoxSwitcherSheet
        onClose={() => {}}
        accounts={[account('box1'), account('box2')]}
        activeBoxId="box1"
        onSwitch={() => {}}
        onAddBox={() => {}}
        onOpenSettings={() => {}}
        onSetAlias={() => {}}
        onRemove={async () => {}}
      />,
    );
    expect(containment(view.toJSON() as Json)).toEqual([CONTAINED]);

    // The ⋯ menu is a second Modal nested inside the sheet: each must hold its own fence.
    await act(async () => {
      fireEvent.press(view.getByTestId('boxMenu-box1'));
    });
    expect(containment(view.toJSON() as Json)).toEqual([CONTAINED, CONTAINED]);

    // Přejmenovat closes the menu and opens the editor over the sheet.
    await act(async () => {
      fireEvent.press(view.getByTestId('boxRename-box1'));
    });
    expect(containment(view.toJSON() as Json)).toEqual([CONTAINED, CONTAINED]);
    expect(view.getByTestId('aliasSave')).toBeTruthy();
  });

  it('reports a button left outside the fence, and a wrapper that swallows the card', () => {
    // The checker proven against the two failures it exists to name, so a bug in it cannot pass
    // every overlay by accident.
    const text = (s: string): JsonNode => ({ type: 'Text', props: {}, children: [s] });
    const leaky: JsonNode = {
      type: 'Modal',
      props: {},
      children: [
        {
          type: 'View',
          props: { accessible: true, testID: 'scrim' },
          children: [
            { type: 'View', props: { accessibilityViewIsModal: true }, children: [text('Uložit')] },
            { type: 'View', props: { accessibilityRole: 'button', testID: 'stray' }, children: [] },
          ],
        },
      ],
    };
    expect(containment(leaky)).toEqual([
      { containers: 1, outside: ['scrim', 'stray'], swallowing: ['scrim'] },
    ]);
    const unmarked: JsonNode = { type: 'Modal', props: {}, children: [text('Uložit')] };
    expect(containment(unmarked)).toEqual([{ containers: 0, outside: [], swallowing: [] }]);
  });
});

// ── Overlays no render test above knows about ───────────────────────────────────────────────────
//
// The compose screen's paid-send confirmation is a sixth `Modal`, reachable only after a full send
// flow; the next overlay someone writes will be a seventh. So every `<Modal>` element under `src/` is
// read from the syntax tree, and its OWN content - not a nested `Modal`'s, not the rest of the file -
// has to set `accessibilityViewIsModal` to true. A per-file count of the two words, the first version
// of this, passed a file whose one prop said `={false}`, or sat beside the `Modal` instead of in it.

const ROOT = join(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return /\.[jt]sx?$/.test(entry) ? [full] : [];
  });
}

function isModalElement(node: ts.Node): node is ts.JsxElement | ts.JsxSelfClosingElement {
  const tag = ts.isJsxElement(node)
    ? node.openingElement.tagName
    : ts.isJsxSelfClosingElement(node)
      ? node.tagName
      : undefined;
  return tag !== undefined && ts.isIdentifier(tag) && tag.text === 'Modal';
}

/** `accessibilityViewIsModal`, `={true}` - and not `={false}` or `={maybe}`. */
function marksModal(node: ts.Node): boolean {
  if (!ts.isJsxAttribute(node) || !ts.isIdentifier(node.name)) {
    return false;
  }
  if (node.name.text !== 'accessibilityViewIsModal') {
    return false;
  }
  const init = node.initializer;
  return (
    init === undefined ||
    (ts.isJsxExpression(init) && init.expression?.kind === ts.SyntaxKind.TrueKeyword)
  );
}

/** Every `<Modal>` in a source file, and whether its own children mark a container modal. */
function modalsIn(fileName: string, text: string): { line: number; contained: boolean }[] {
  const sf = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    /\.[jt]sx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const holdsMarked = (modal: ts.JsxElement | ts.JsxSelfClosingElement): boolean => {
    let found = false;
    const walk = (node: ts.Node) => {
      // A nested `Modal` answers for itself on its own turn.
      if (found || isModalElement(node)) {
        return;
      }
      if (marksModal(node)) {
        found = true;
        return;
      }
      ts.forEachChild(node, walk);
    };
    // The children only: the prop means nothing on the `Modal` itself, which renders no view for it.
    if (ts.isJsxElement(modal)) {
      modal.children.forEach(walk);
    }
    return found;
  };
  const out: { line: number; contained: boolean }[] = [];
  const visit = (node: ts.Node) => {
    if (isModalElement(node)) {
      out.push({
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        contained: holdsMarked(node),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe('every Modal in the app', () => {
  const found = sourceFiles(join(ROOT, 'src')).flatMap(f =>
    modalsIn(f, readFileSync(f, 'utf8')).map(m => ({ ...m, file: relative(ROOT, f) })),
  );

  it('is found - the scan covers the overlays the render tests cover, and more', () => {
    expect(found.length).toBeGreaterThanOrEqual(6);
    expect(found.map(m => m.file)).toEqual(
      expect.arrayContaining([
        'src/theme/Dialog.tsx',
        'src/features/accounts/screens/AliasEditor.tsx',
        'src/features/accounts/screens/BoxOverflowMenu.tsx',
        'src/features/accounts/screens/BoxSwitcherSheet.tsx',
        // The Termín picker's Modal and the language picker's are this one (2026-09-24).
        'src/theme/BottomSheet.tsx',
        'src/features/messages/screens/ComposeScreen.tsx',
      ]),
    );
  });

  it('marks its content modal', () => {
    const offenders = found
      .filter(m => !m.contained)
      .map(m => `${m.file}:${m.line} - nothing inside this Modal sets accessibilityViewIsModal`);
    expect(offenders).toEqual([]);
  });

  it('is judged by what the Modal holds, not by what the file mentions', () => {
    const contained = (src: string) => modalsIn('snippet.tsx', src).map(m => m.contained);
    expect(contained('<Modal><View accessibilityViewIsModal><Text>a</Text></View></Modal>')).toEqual(
      [true],
    );
    expect(contained('<Modal><View accessibilityViewIsModal={true} /></Modal>')).toEqual([true]);
    expect(contained('<Modal><View accessibilityViewIsModal={false} /></Modal>')).toEqual([false]);
    expect(contained('<Modal><View accessibilityViewIsModal={open} /></Modal>')).toEqual([false]);
    expect(contained('<Modal accessibilityViewIsModal><View /></Modal>')).toEqual([false]);
    expect(
      contained('<>\n  <View accessibilityViewIsModal />\n  <Modal><View /></Modal>\n</>'),
    ).toEqual([false]);
    // The switcher's shape: a marked sheet, with a second Modal inside that must hold its own.
    expect(
      contained('<Modal><View accessibilityViewIsModal /><Modal><View /></Modal></Modal>'),
    ).toEqual([true, false]);
    expect(contained('// <Modal> in prose\nconst s = "<Modal>";')).toEqual([]);
  });
});
