// An animated style's body runs on the UI thread, where the app's own functions do not exist. Calling
// one from there passes every test - Jest's Reanimated is a plain function - and crashes the screen on
// the phone: the sent result called `sendMoment` inside `useAnimatedStyle` and Android showed
// "[Worklets] Tried to synchronously call a Remote Function" (2026-11-12, Obalka_Demo).
//
// So every `useAnimatedStyle` / `useDerivedValue` / `useAnimatedProps` / `useFrameCallback` body in src/
// may call only Reanimated's own worklet helpers and `Math`; anything else is computed outside and
// captured as a plain value.

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const ROOT = path.join(__dirname, '..', '..', 'src');
const HOOKS = /^use(AnimatedStyle|DerivedValue|AnimatedProps|FrameCallback)$/;
const ALLOWED = new Set([
  'interpolate',
  'interpolateColor',
  'withTiming',
  'withSpring',
  'withDelay',
  'withRepeat',
  'withSequence',
  'withDecay',
]);

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      return files(full);
    }
    return /\.tsx?$/.test(e.name) ? [full] : [];
  });
}

/** Every call made inside an animated hook's body that may not run on the UI thread, as `file:line callee`. */
export function remoteCalls(fileName: string, source: string): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const allowed = (callee: ts.Expression) => {
    if (ts.isIdentifier(callee)) {
      return ALLOWED.has(callee.text);
    }
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
      return callee.expression.text === 'Math' || callee.expression.text === 'Easing';
    }
    return false;
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && HOOKS.test(node.expression.text)) {
      const body = node.arguments[0];
      const inner = (n: ts.Node) => {
        if (ts.isCallExpression(n) && !allowed(n.expression)) {
          const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
          found.push(`${path.relative(process.cwd(), fileName)}:${line} ${n.expression.getText(sf)}`);
        }
        ts.forEachChild(n, inner);
      };
      if (body) {
        inner(body);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

it('calls nothing from an animated style that does not exist on the UI thread', () => {
  const found = files(ROOT).flatMap(f => remoteCalls(f, fs.readFileSync(f, 'utf8')));
  if (found.length > 0) {
    throw new Error(
      'An animated hook calls a function the UI thread does not have; it crashes on the phone, not in ' +
        'Jest. Compute the value outside the hook and use the plain result inside it:\n  ' +
        found.join('\n  '),
    );
  }
});

it('finds the call that crashed the sent result, and lets the helpers through', () => {
  const crashed = `
    const s = useAnimatedStyle(() => {
      const m = sendMoment(reduceMotion);
      return { opacity: withTiming(m.x), transform: [{ scale: Math.max(1, interpolate(v.value, [0, 1], [0, 1])) }] };
    });`;
  expect(remoteCalls('x.tsx', crashed).map(c => c.split(' ')[1])).toEqual(['sendMoment']);
});
