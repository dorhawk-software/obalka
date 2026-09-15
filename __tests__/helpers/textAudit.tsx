// Every Text a test renders is held to the iOS clipping model (src/theme/inkClipping.ts), at render
// time.
//
// The static guard (theme/lineHeightClipping.test.ts) reads what the source says; this one reads what
// the renderer is actually handed, after the role components have derived their line heights, Tamagui
// has resolved its props and a parent Text has passed its font down. jest.setup.js swaps React
// Native's `Text` for this wrapper around the preset's own mock, so nothing else about rendering
// changes, and jest.afterEnv.js fails the test that rendered a clipping Text.
//
// It judges what iOS draws, explicitly: a Text rendered while `Platform.OS` is 'ios' - the suite's
// default (jest.config.js) - and no other. The role components lift a line for the ink on iOS alone,
// so a render a test makes as Android draws the design's line, which Android paints past; holding it
// to the iOS model would report a clip no device shows, and a pass there would say nothing about iOS.
//
// A Text with no lineHeight is checked too, on the font's own height - which Public Sans's Ů outgrows.
// A Text with no fontFamily is the system font (SF Pro on iOS), never a pass by omission; one in a face
// the model has no numbers for is reported, because nothing here can tell whether it clips.

import { createContext, forwardRef, useContext, type ComponentType, type ReactNode } from 'react';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  inkFor,
  inkSafeLineHeight,
  iosClips,
  iosInkOverflow,
  naturalLeading,
  safeLeading,
} from '../../src/theme/inkClipping';
import { BUNDLED_FACES, measureInk, type MeasuredInk } from './textClipping';

/** React Native's own default, used when neither the Text nor a parent sets one. */
const RN_DEFAULT_FONT_SIZE = 14;

interface Inherited {
  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly lineHeight?: number;
}

/** What a top-level Text inherits: nothing. Any other value means the Text is nested in another. */
const NO_PARENT: Inherited = {};
const InheritedText = createContext<Inherited>(NO_PARENT);

declare global {
  // Shared by the wrapper and the afterEach hook even across jest.resetModules().
  var __iosTextClipping: Set<string> | undefined;
}

/** Violations recorded since the last `takeTextClipping()`. */
function store(): Set<string> {
  globalThis.__iosTextClipping ??= new Set();
  return globalThis.__iosTextClipping;
}

/** Hands back, and forgets, every clipping Text rendered so far. */
export function takeTextClipping(): string[] {
  const found = [...store()];
  store().clear();
  return found;
}

function textOf(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(textOf).join('');
  }
  return '';
}

/** The component names above the render, innermost first: `Title < MessageRow < MessageList`. */
function owners(): string {
  const stack = (React as { captureOwnerStack?: () => string | null }).captureOwnerStack?.() ?? '';
  const names = [...stack.matchAll(/^\s*at ([A-Z]\w*)/gm)].map(m => m[1]);
  return names.slice(0, 6).join(' < ');
}

const measured = new Map<string, MeasuredInk>();

/** The character that reaches furthest up or down in a bundled face, for the message. */
function reach(face: string | undefined, top: boolean): string {
  if (face == null || !BUNDLED_FACES.includes(face)) {
    return top ? 'an accent' : 'a descender';
  }
  let ink = measured.get(face);
  if (ink == null) {
    ink = measureInk(face);
    measured.set(face, ink);
  }
  return `"${top ? ink.topChar : ink.bottomChar}"`;
}

/** Why this Text clips on iOS, or null. */
export function auditTextStyle(style: Inherited): string | null {
  const fontSize = style.fontSize ?? RN_DEFAULT_FONT_SIZE;
  const family = style.fontFamily ?? 'the system font';
  const ink = inkFor(style.fontFamily);
  if (ink == null) {
    return (
      `is set in "${family}", which is neither a bundled face nor the system font, so ` +
      'nothing here knows its ink'
    );
  }
  // No lineHeight: the line is the font's own height, and the model gives exactly that for L = H.
  const lineHeight = style.lineHeight ?? fontSize * naturalLeading(ink);
  if (!iosClips(ink, fontSize, lineHeight)) {
    return null;
  }
  const over = iosInkOverflow(ink, fontSize, lineHeight);
  const top = over.top >= over.bottom;
  const line = style.lineHeight == null ? `its own line (${lineHeight.toFixed(2)})` : `lineHeight ${lineHeight}`;
  return (
    `${family} ${fontSize} on ${line} cuts ${top ? 'the top' : 'the bottom'} of ` +
    `${reach(style.fontFamily, top)} by ${(top ? over.top : over.bottom).toFixed(2)}dp on iOS; ` +
    `it needs lineHeight ${inkSafeLineHeight(style.fontFamily, fontSize, lineHeight)} ` +
    `(ratio ${safeLeading(ink).toFixed(3)})`
  );
}

/** `Base` (the preset's mock Text), checking each render and passing its font to nested Texts. */
export function auditedText(Base: ComponentType<any>): ComponentType<any> {
  const Audited = forwardRef<unknown, any>(function Text(props, ref) {
    const parent = useContext(InheritedText);
    const own = (StyleSheet.flatten(props.style) ?? {}) as Inherited;
    const effective: Inherited = {
      fontFamily: own.fontFamily ?? parent.fontFamily,
      fontSize: own.fontSize ?? parent.fontSize,
      lineHeight: own.lineHeight ?? parent.lineHeight,
    };
    const nested = parent !== NO_PARENT;
    const margins = own as { marginTop?: unknown; marginBottom?: unknown };
    // A Text inside another Text is a span of the parent's paragraph: margins mean nothing there, so a
    // role that lifted its line for the ink could not take the extra back, and the paragraph's line
    // would grow instead.
    const problem =
      Platform.OS !== 'ios'
        ? null
        : auditTextStyle(effective) ??
      (nested && (margins.marginTop != null || margins.marginBottom != null)
        ? 'is a span inside another Text and sets a vertical margin, which a span cannot have - a ' +
          "role nested there that lifted its line for the ink grows the paragraph's line instead"
        : null);
    if (problem != null) {
      const where = [
        props.testID ? `testID "${props.testID}"` : null,
        `"${textOf(props.children).slice(0, 40)}"`,
        owners() || null,
      ]
        .filter(Boolean)
        .join(', ');
      store().add(`${where}: ${problem}`);
    }
    return (
      <InheritedText.Provider value={effective}>
        <Base ref={ref} {...props} />
      </InheritedText.Provider>
    );
  });
  Audited.displayName = 'Text';
  return Audited as unknown as ComponentType<any>;
}
