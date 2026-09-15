// Controls smaller than a fingertip.
//
// The design draws a 48×28 switch, a 34pt segment and a 36pt day-stepper - all of them under the
// 44pt (iOS) / 48dp (Android) floor, and all of them correct as drawings. What was missing is the gap
// between what a control looks like and what it can be hit by: `hitSlop`.
//
// Asserted as "drawn size plus its slop", because that sum is the thing the guideline is about and
// the thing that silently regresses when one of the two numbers is edited alone.

import { useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { TermPicker } from '../../src/features/messages/screens/TermPicker';
import { BoxOverflowMenu } from '../../src/features/accounts/screens/BoxOverflowMenu';
import { AddBoxForm } from '../../src/features/accounts/screens/AddBoxForm';
import { ReauthForm } from '../../src/features/accounts/screens/ReauthForm';
import { Welcome } from '../../src/features/accounts/screens/Welcome';
import { Toggle } from '../../src/theme/Toggle';
import { SegmentedControl } from '../../src/theme/SegmentedControl';
import { MIN_TARGET, textSlop, touchSlop } from '../../src/theme/touchTarget';
import { metricLeading, type } from '../../src/theme/typography';
import type { DataBoxAccount } from '../../src/services/isds/types';
import { occupiedLine } from '../helpers/textClipping';

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

type Slop = { top: number; bottom: number; left: number; right: number };

describe('touchSlop', () => {
  it('lifts a short control to the minimum target', () => {
    expect(touchSlop({ height: 28 })).toMatchObject({ top: 10, bottom: 10 });
    expect(28 + 10 + 10).toBeGreaterThanOrEqual(MIN_TARGET);
  });

  it('leaves an already-large dimension alone', () => {
    expect(touchSlop({ width: 48, height: 28 })).toEqual({
      top: 10,
      bottom: 10,
      left: 0,
      right: 0,
    });
  });

  it('leaves an omitted dimension alone - a stretched segment has no width to fix', () => {
    expect(touchSlop({ height: 34 })).toEqual({
      top: 7,
      bottom: 7,
      left: 0,
      right: 0,
    });
  });

  it('rounds up, never down, so the sum clears the floor exactly once', () => {
    // 35 → 6.5 would leave 48 unreachable at 6.
    expect(touchSlop({ height: 35 }).top).toBe(7);
    expect(35 + 7 * 2).toBeGreaterThanOrEqual(MIN_TARGET);
  });
});

describe('the switch', () => {
  it('is 48×28 on screen and at least 48×48 to a finger', async () => {
    const view = await wrap(
      <Toggle value={false} onChange={() => {}} label="Zálohovat archiv" testID="sw" />,
    );
    const slop = view.getByTestId('sw').props.hitSlop as Slop;
    expect(28 + slop.top + slop.bottom).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(48 + slop.left + slop.right).toBeGreaterThanOrEqual(MIN_TARGET);
  });
});

describe('a segment', () => {
  function Harness() {
    const [value, setValue] = useState<'received' | 'sent'>('received');
    return (
      <SegmentedControl
        segments={[
          { key: 'received' as const, label: 'Přijaté' },
          { key: 'sent' as const, label: 'Odeslané' },
        ]}
        value={value}
        onChange={setValue}
        testID="seg"
      />
    );
  }

  it('reaches the target vertically - it already fills the track horizontally', async () => {
    const view = await wrap(<Harness />);
    for (const key of ['received', 'sent']) {
      const seg = view.getByTestId(`seg-${key}`);
      const slop = seg.props.hitSlop as Slop;
      // Labelled so a failure names the segment rather than only the number.
      expect([key, 34 + slop.top + slop.bottom]).toEqual([key, MIN_TARGET]);
    }
  });
});

describe('the day stepper', () => {
  it('is short on BOTH axes, and reaches the target on both', async () => {
    const view = await wrap(
      <TermPicker
        current={null}
        onPick={() => {}}
        onRemove={() => {}}
        onClose={() => {}}
        now={Date.UTC(2026, 8, 9)}
      />,
    );
    for (const id of ['term-earlier', 'term-later']) {
      const slop = view.getByTestId(id).props.hitSlop as Slop;
      expect([id, 36 + slop.top + slop.bottom]).toEqual([id, MIN_TARGET]);
      expect([id, 38 + slop.left + slop.right]).toEqual([id, MIN_TARGET]);
    }
  });

  it('keeps the two buttons\u2019 areas from overlapping', async () => {
    const view = await wrap(
      <TermPicker
        current={null}
        onPick={() => {}}
        onRemove={() => {}}
        onClose={() => {}}
        now={Date.UTC(2026, 8, 9)}
      />,
    );
    const earlier = view.getByTestId('term-earlier').props.hitSlop as Slop;
    const later = view.getByTestId('term-later').props.hitSlop as Slop;
    // The row sets gap 12 between them; two touch areas that meet in the middle would make the
    // boundary a coin toss between "a day earlier" and "a day later".
    expect(earlier.right + later.left).toBeLessThan(12);
  });
});

// ── Controls whose drawn size is a LINE OF TEXT ─────────────────────────────────────────────────
//
// `touchSlop` wants a number, and a text button has none - it is as tall as whatever it says. So
// every text button in the app typed its slop by hand, and six ended up under the floor: the
// snackbar's Undo at 41dp (on a control that leaves on a timer), "Použít SMS" at 33, "Pokročilé" at
// 36. The helper written to prevent that drift could not be applied to the controls that needed it
// most, which is why they drifted. `textSlop` derives the line box from the type scale instead.
describe('textSlop', () => {
  it('lifts a single line of body text to the floor', () => {
    const s = textSlop('body');
    expect(type.body.lineHeight + s.top + s.bottom).toBeGreaterThanOrEqual(
      MIN_TARGET,
    );
  });

  it('counts padding the control already has', () => {
    // Same label, more padding → less slop needed. The sum is what the guideline is about.
    const bare = textSlop('badge');
    const padded = textSlop('badge', { paddingVertical: 8 });
    expect(padded.top).toBeLessThan(bare.top);
    expect(type.badge.lineHeight + 16 + padded.top + padded.bottom).toBeGreaterThanOrEqual(
      MIN_TARGET,
    );
  });

  it('follows a fontSize override, so resizing the label moves the target', () => {
    const small = textSlop('bodyStrong', { fontSize: 11 });
    const large = textSlop('bodyStrong', { fontSize: 22 });
    expect(small.top).toBeGreaterThan(large.top);
  });

  it('uses the tight metric leading for a dense label', () => {
    // `dense` is what list rows pass; its line box is shorter, so it needs MORE slop.
    expect(textSlop('label', { dense: true }).top).toBeGreaterThanOrEqual(
      textSlop('label').top,
    );
  });

  it('asks for nothing once the text alone clears the floor', () => {
    expect(textSlop('display', { fontSize: 60 })).toMatchObject({
      top: 0,
      bottom: 0,
    });
  });

  it('adds uneven padding as drawn, and lets each side win over paddingVertical', () => {
    // The add-box help link is padded 20 above and 4 below. The sum is what reaches the finger.
    const uneven = textSlop('label', { paddingTop: 20, paddingBottom: 4 });
    expect(type.label.lineHeight + 24 + uneven.top + uneven.bottom).toBeGreaterThanOrEqual(
      MIN_TARGET,
    );
    expect(uneven).toEqual(textSlop('label', { paddingVertical: 12 }));
    // `paddingTop` beats `paddingVertical` on its own side only, as it does in an RN style.
    expect(textSlop('label', { paddingVertical: 2, paddingTop: 20 })).toEqual(
      textSlop('label', { paddingTop: 20, paddingBottom: 2 }),
    );
  });
});

// ── The five slops that were still typed by hand (audit P1-12, closed 2026-09-14) ────────────────
//
// Each of these cleared the floor - by luck, which is the finding: `hitSlop={10}` beside a control
// stays 10 when the control changes. Asserted as drawn size plus slop, landing EXACTLY on the
// target on a short axis (a derived slop asks for no more than it needs) and adding nothing on an
// axis the control already fills.
//
// The drawn size is read off the render rather than restated here. A test that typed `38` beside the
// slop would pass the one edit it exists to catch: the control resized, its slop left behind.

const box: DataBoxAccount = {
  id: 'box1',
  boxId: 'box1',
  loginName: 'user',
  label: 'Box box1',
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
};

/** A dense 14pt label's line box, from the scale - how tall the help links' text is. */
const DENSE_14 = Math.round(14 * metricLeading.body);

type Host = ReturnType<Awaited<ReturnType<typeof wrap>>['getByTestId']>;

/** A number a host view was actually drawn with. One that is missing, or not a number, fails. */
function px(
  node: Host,
  key: 'width' | 'height' | 'top' | 'bottom' | 'paddingTop' | 'paddingBottom',
): number {
  const value = StyleSheet.flatten(node.props.style)?.[key];
  expect([key, typeof value]).toEqual([key, 'number']);
  return value as number;
}

/** How tall a text button's line is drawn: the line its label occupies, or the icon beside it if taller. */
function lineOf(node: Host): number {
  const descendants = (n: Host): Host[] =>
    n.children.flatMap(c => (typeof c === 'string' ? [] : [c, ...descendants(c)]));
  const parts = descendants(node).filter(n => n.type === 'Text' || n.type === 'RNSVGSvgView');
  expect(parts.length).toBeGreaterThanOrEqual(2);
  return Math.max(
    ...parts.map(n => {
      const style = StyleSheet.flatten(n.props.style);
      return (n.type === 'Text' ? occupiedLine(style) : style.height) as number;
    }),
  );
}

describe('the ⋯ box menu', () => {
  it('is 38×38 on screen and 48×48 to a finger', async () => {
    const view = await wrap(
      <BoxOverflowMenu account={box} onRename={() => {}} onRemove={() => {}} />,
    );
    const trigger = view.getByTestId('boxMenu-box1');
    const slop = trigger.props.hitSlop as Slop;
    expect([px(trigger, 'width'), px(trigger, 'height')]).toEqual([38, 38]);
    expect(px(trigger, 'height') + slop.top + slop.bottom).toBe(MIN_TARGET);
    expect(px(trigger, 'width') + slop.left + slop.right).toBe(MIN_TARGET);
  });
});

describe('the show-password toggle', () => {
  // Pinned inside the input (top 0, bottom 0), so it is exactly as tall as the input - its height is
  // read off the rendered input, and a shorter input would have to bring vertical slop.
  const expectEyeTarget = (view: Awaited<ReturnType<typeof wrap>>) => {
    const toggle = view.getByTestId('togglePassword');
    const slop = toggle.props.hitSlop as Slop;
    expect([px(toggle, 'top'), px(toggle, 'bottom')]).toEqual([0, 0]);
    const width = px(toggle, 'width');
    const inputHeight = px(view.getByTestId('password'), 'height');
    expect(width + slop.left + slop.right).toBe(Math.max(width, MIN_TARGET));
    expect(inputHeight + slop.top + slop.bottom).toBe(Math.max(inputHeight, MIN_TARGET));
  };

  it('on the add-box form', async () => {
    const view = await wrap(<AddBoxForm onSubmit={() => {}} />);
    await act(async () => {
      fireEvent.press(view.getByTestId('continue'));
    });
    expectEyeTarget(view);
  });

  it('on the re-auth form', async () => {
    const view = await wrap(
      <ReauthForm
        account={box}
        onSubmit={() => {}}
        onBack={() => {}}
        onOpenPortal={() => {}}
      />,
    );
    expectEyeTarget(view);
  });
});

describe('the help links', () => {
  const expectLinkTarget = (link: Host, padding: [number, number]) => {
    const slop = link.props.hitSlop as Slop;
    // The slop was computed from the type scale's model of this line; the render has to agree.
    expect(lineOf(link)).toBe(DENSE_14);
    expect([px(link, 'paddingTop'), px(link, 'paddingBottom')]).toEqual(padding);
    const height = lineOf(link) + px(link, 'paddingTop') + px(link, 'paddingBottom');
    expect(height + slop.top + slop.bottom).toBe(Math.max(height, MIN_TARGET));
  };

  it('on Welcome: a dense line with 6 above and below reaches the target', async () => {
    const view = await wrap(<Welcome onAddBox={() => {}} onOpenFaq={() => {}} onRestore={() => {}} canTransfer={false} />);
    const link = view.getByTestId('welcome-faq');
    expectLinkTarget(link, [6, 6]);
    // It spans the screen, so its width needs nothing.
    const slop = link.props.hitSlop as Slop;
    expect(slop.left + slop.right).toBe(0);
  });

  it('on the add-box form: a dense line padded 20 above and 4 below reaches the target', async () => {
    const view = await wrap(
      <AddBoxForm onSubmit={() => {}} onBack={() => {}} onOpenFaq={() => {}} />,
    );
    expectLinkTarget(view.getByTestId('login-faq'), [20, 4]);
  });
});
