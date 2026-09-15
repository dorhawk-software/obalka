// The one-line "elsewhere" notice.
//
// It replaced a card that was reported twice: for clashing with the sections around it, and for
// taking attention from the box the user had actually opened. The tests that matter are therefore
// about restraint - what it does NOT show - and about surviving a user with fifteen boxes.
//
// And about every box it reports getting words. A box whose only news was a reminder due next week
// used to render "Jinde: " and nothing after it, because the sentence knew about overdue deadlines
// and nothing else with a date (024 FR-003). Czech sentences are asserted literally where the plural
// form is the point: "za 3 dny" and "za 5 dní" are two different words, and `t()` would happily
// return the wrong one to a test that only compared it with itself.
//
// And about a narrow screen (2026-09-15), which used to cut the sentence mid-clause. jest has no
// layout engine, so those tests hand the line what native layout would report through `onLayout`:
// the room beside the dots and the chevron, and the width of each text it measures.

import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { setActiveLocale, t } from '../../src/i18n/strings';
import {
  CrossBoxLine,
  crossBoxSummary,
} from '../../src/features/messages/screens/CrossBoxLine';
import {
  crossBoxAttention,
  type BoxAttention,
  type SoonestDeadline,
} from '../../src/features/messages/state/crossBox';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';
import type { Reminder } from '../../src/features/messages/state/reminders';

const DAY = 24 * 60 * 60 * 1000;

/** `days` from NOW at `hour`, local time. Noon by default, so no day count here straddles midnight. */
const on = (days: number, hour = 12) =>
  new Date(2026, 8, 14 + days, hour, 0).getTime();

const NOW = on(0);

const box = (over: Partial<BoxAttention> = {}): BoxAttention => ({
  boxId: 'b1',
  name: 'Podnikající FO',
  unread: 0,
  soonest: null,
  deadlines: [],
  fiction: 0,
  syncError: null,
  stale: false,
  refreshing: false,
  ...over,
});

/**
 * A box with deadlines this many days from NOW, shaped the way `crossBoxAttention` shapes one: every
 * date soonest first, and the soonest of them, as read at NOW, in `soonest`.
 */
const dueIn = (days: number | readonly number[], over: Partial<BoxAttention> = {}) => {
  const sorted = (typeof days === 'number' ? [days] : [...days]).sort((a, b) => a - b);
  const soonest: SoonestDeadline = {
    reason: 'reminder',
    date: on(sorted[0]),
    daysRemaining: sorted[0],
  };
  return box({ soonest, deadlines: sorted.map(d => on(d)), ...over });
};

/** A box we could not refresh: `crossBoxAttention` always sets the error and `stale` together. */
const unreachable = (over: Partial<BoxAttention> = {}) =>
  box({ syncError: 'reauth', stale: true, ...over });

/** The sentence as the inbox draws it at `now`. */
const say = (boxes: readonly BoxAttention[], now = NOW) =>
  crossBoxSummary(boxes, now);

const tree = (boxes: BoxAttention[], onPress: () => void, now = NOW) => (
  <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
    <AppThemeProvider isDark={false}>
      <CrossBoxLine boxes={boxes} now={now} onPress={onPress} />
    </AppThemeProvider>
  </TamaguiProvider>
);

const mount = async (boxes: BoxAttention[], onPress = jest.fn()) => {
  const view = await render(tree(boxes, onPress));
  return { view, onPress };
};

describe('the nearest deadline (FR-003)', () => {
  it('says a deadline due today as today', () => {
    expect(say([dueIn(0)])).toBe('termín dnes');
  });

  it('treats one due earlier today as today, not as missed', () => {
    // The attention group's own whole-day rule: a deadline is missed the day after, not the hour after.
    const early = on(0, 8);
    expect(
      say([
        box({
          soonest: { reason: 'reminder', date: early, daysRemaining: 0 },
          deadlines: [early],
        }),
      ]),
    ).toBe('termín dnes');
  });

  it('says tomorrow, never "za 1 den"', () => {
    expect(say([dueIn(1)])).toBe('termín zítra');
  });

  it('counts further days in the form Czech gives the number', () => {
    expect(say([dueIn(3)])).toBe('termín za 3 dny');
    expect(say([dueIn(5)])).toBe('termín za 5 dní');
  });

  it('reports the nearest across every box, not whichever box came first', () => {
    const s = say([dueIn(6, { boxId: 'a' }), dueIn(2, { boxId: 'b' })]);
    expect(s).toBe('termín za 2 dny');
  });

  it('still names the next deadline in a box that has also missed one', () => {
    expect(say([dueIn([-3, 1])])).toBe('1 po termínu · termín zítra');
  });

  it('counts missed deadlines, not the boxes holding them', () => {
    const s = say([dueIn([-2, -1], { boxId: 'a' }), dueIn(-4, { boxId: 'b' })]);
    expect(s).toBe('3 po termínu');
  });

  it('is said as of the moment the line is drawn, not when the boxes were read', () => {
    // The aggregate is read again when the accounts or the box change, never at midnight. The inbox
    // redraws with its own clock, and the line has to move with it - or it says "zítra" on the
    // morning the deadline is due, beside chips in the rows that already say "dnes".
    const readYesterday = [dueIn(1)];
    expect(say(readYesterday, NOW)).toBe('termín zítra');
    expect(say(readYesterday, on(1))).toBe('termín dnes');
    expect(say(readYesterday, on(2))).toBe('1 po termínu');
  });

  it('is said in English at parity', () => {
    setActiveLocale('en');
    try {
      expect(say([dueIn(0)])).toBe('due today');
      expect(say([dueIn(1)])).toBe('due tomorrow');
      expect(say([dueIn(3)])).toBe('due in 3 days');
      expect(say([unreachable({ unread: 2, refreshing: true })])).toBe(
        '2 unread, last known · refreshing…',
      );
    } finally {
      setActiveLocale('cs');
    }
  });
});

describe('mail served by fiction', () => {
  it('is named, and not counted a second time as unread', () => {
    // The badge counts a state-5 message as unread too. "1 doručeno fikcí · 1 nepřečtená" would read
    // as two messages when there is one.
    expect(say([box({ unread: 1, fiction: 1 })])).toBe('1 doručeno fikcí');
  });

  it('leaves the rest of the unread mail beside it', () => {
    expect(say([box({ unread: 3, fiction: 1 })])).toBe(
      '1 doručeno fikcí · 2 nepřečtené',
    );
  });
});

describe('a box we could not reach (FR-004)', () => {
  it('still reports its unread mail, marked as the last count we know', () => {
    expect(say([unreachable({ unread: 1 })])).toBe(
      'naposledy 1 nepřečtená · 1 nenačtená',
    );
  });

  it('keeps remembered counts apart from fresh ones', () => {
    const s = say([
      box({ boxId: 'a', unread: 2 }),
      unreachable({ boxId: 'b', unread: 5 }),
    ]);
    expect(s).toBe('2 nepřečtené · naposledy 5 nepřečtených · 1 nenačtená');
  });
});

describe('a refresh still running (FR-003)', () => {
  it('is said while a reported box is being fetched', () => {
    expect(say([box({ unread: 2, refreshing: true })])).toBe(
      '2 nepřečtené · načítá se…',
    );
  });

  it('reports a box being retried as loading rather than as not refreshed', () => {
    // Its last failure is no longer the verdict while a new attempt is out; its count, though, is
    // still a memory until that attempt succeeds.
    const s = say([
      unreachable({ syncError: 'error', unread: 1, refreshing: true }),
    ]);
    expect(s).toBe('naposledy 1 nepřečtená · načítá se…');
  });

  it('is said once however many boxes are out', () => {
    const s = say([
      box({ boxId: 'a', unread: 1, refreshing: true }),
      box({ boxId: 'b', unread: 1, refreshing: true }),
    ]);
    expect(s.split(t('crossBox.refreshing'))).toHaveLength(2);
  });
});

describe('the sentence', () => {
  it('counts unread across every reporting box', () => {
    expect(say([box({ unread: 2 }), box({ unread: 3 })])).toContain(
      t('attn.unread.many', { n: 5 }),
    );
  });

  it('counts boxes it could not reach', () => {
    expect(say([box({ syncError: 'reauth' })])).toContain(
      t('crossBox.unreachable.one', { n: 1 }),
    );
  });

  it('omits whatever is zero rather than saying "0 unread"', () => {
    const s = say([box({ unread: 1 })]);
    expect(s).toBe(t('attn.unread.one', { n: 1 }));
  });

  it('leads with what is closest to hurting you - the order the boxes are sorted in', () => {
    // Every clause at once. The line shows whole clauses from the front, so this order is also what
    // survives a narrow screen: the refresh note is the first left out, a missed deadline the last.
    const s = say([
      dueIn([-2, 3], { boxId: 'a' }),
      box({ boxId: 'b', unread: 3, fiction: 1, refreshing: true }),
      unreachable({ boxId: 'c', unread: 1 }),
    ]);
    expect(s).toBe(
      '1 po termínu · termín za 3 dny · 1 doručeno fikcí · 2 nepřečtené · ' +
        'naposledy 1 nepřečtená · 1 nenačtená · načítá se…',
    );
  });

  it('has words for every kind of box the aggregate reports', async () => {
    // The shape of the bug, asked of the real aggregate rather than of hand-built rows: any box
    // `crossBoxAttention` lets in must produce a clause on its own.
    const account = (boxId: string, over: Partial<DataBoxAccount> = {}) =>
      ({
        boxId,
        label: boxId,
        alias: null,
        unreadCount: null,
        syncError: null,
        ...over,
      }) as DataBoxAccount;
    const envelope = (id: string, over: Partial<MessageEnvelope> = {}) =>
      ({ id, state: 6, deliveryTime: NOW - DAY, acceptanceTime: null, ...over }) as MessageEnvelope;
    const reminder = (messageId: string, date: number) =>
      ({ messageId, date, createdBy: 'user' }) as Reminder;
    const envelopes: Record<string, MessageEnvelope[]> = {
      upcoming: [envelope('u1')],
      overdue: [envelope('o1')],
      fiction: [envelope('f1', { state: 5, acceptanceTime: NOW - 3 * DAY })],
    };
    const reminders: Record<string, Reminder[]> = {
      upcoming: [reminder('u1', NOW + 4 * DAY)],
      overdue: [reminder('o1', NOW - DAY)],
    };
    const rows = await crossBoxAttention(
      [
        account('unread', { unreadCount: 2 }),
        account('upcoming'),
        account('overdue'),
        account('fiction'),
        account('failed', { syncError: 'error' }),
        account('expired', { syncError: 'reauth', unreadCount: 1 }),
      ],
      null,
      {
        cachedEnvelopes: async boxId => envelopes[boxId] ?? [],
        reminders: async boxId => reminders[boxId] ?? [],
      },
      NOW,
    );
    expect(rows).toHaveLength(6);
    expect(rows.filter(row => say([row]) === '').map(row => row.boxId)).toEqual(
      [],
    );
  });
});

describe('the line', () => {
  it('never renders the prefix with nothing after it', async () => {
    // The reported case: another box's only news is a reminder that has not come due yet.
    const { view } = await mount([dueIn(4)]);
    await waitFor(() => view.getByTestId('crossBoxLine'));
    expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(
      'Jinde: termín za 4 dny',
    );
  });

  it('renders nothing when the sentence is empty, whatever the box count', async () => {
    // The empty case, and the guard behind the bug: no words means no line, never a bare prefix.
    expect(say([])).toBe('');
    expect(say([box()])).toBe('');
    const { view } = await mount([box()]);
    expect(view.queryByTestId('crossBoxLine')).toBeNull();
  });

  it('phrases its deadline with the clock it is drawn with', async () => {
    const onPress = jest.fn();
    const boxes = [dueIn(1)];
    const view = await render(tree(boxes, onPress, NOW));
    expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(
      'Jinde: termín zítra',
    );
    await view.rerender(tree(boxes, onPress, on(1)));
    expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(
      'Jinde: termín dnes',
    );
  });

  it('keeps its one line while a refresh starts and settles', async () => {
    // Constitution V. The refresh note is the last clause of a line that stays one line however much
    // of it fits ('fitting the line', below), so it can change the words and never the height or the
    // dots.
    const onPress = jest.fn();
    const { view } = await mount([box({ unread: 2 })], onPress);
    await waitFor(() => view.getByTestId('crossBoxLine'));
    const shape = () => ({
      lines: view.getByTestId('crossBoxSummary').props.numberOfLines,
      dots: view.getByTestId('crossBoxDots').children.length,
    });
    const before = shape();
    expect(before).toEqual({ lines: 1, dots: 1 });

    await view.rerender(tree([box({ unread: 2, refreshing: true })], onPress));
    expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(
      'Jinde: 2 nepřečtené · načítá se…',
    );
    expect(shape()).toEqual(before);

    await view.rerender(tree([box({ unread: 2 })], onPress));
    expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(
      'Jinde: 2 nepřečtené',
    );
    expect(shape()).toEqual(before);
  });
});

describe('fitting the line (2026-09-15)', () => {
  // Reported from a phone: "Jinde: 1 doručeno fikcí · naposledy 3 nepřečtené · 2 nen…". Half a clause
  // says nothing, and nothing on the line said that more had been cut.
  const HIDDEN = { includeHiddenElements: true } as const;

  type Mounted = Awaited<ReturnType<typeof render>>;

  /** A stand-in font, every character six wide. The rule only ever compares sums of widths. */
  const sixWide = (text: string) => text.length * 6;

  const layout = (width: number) => ({
    nativeEvent: { layout: { x: 0, y: 0, width, height: 16 } },
  });

  /** What a native layout pass reports: the room, when it is given, and every text measured. */
  const lay = async (
    view: Mounted,
    { room, font = sixWide }: { room?: number; font?: (text: string) => number },
  ) => {
    if (room !== undefined) {
      await fireEvent(view.getByTestId('crossBoxSlot'), 'layout', layout(room));
    }
    const count = view.getAllByTestId('crossBoxMeasured', HIDDEN).length;
    for (let i = 0; i < count; i += 1) {
      const text = view.getAllByTestId('crossBoxMeasured', HIDDEN)[i];
      await fireEvent(text, 'layout', layout(font(String(text.props.children))));
    }
  };

  /** The line as a sighted reader sees it: the sentence, then the count of what it left out. */
  const drawn = (view: Mounted) =>
    `${view.getByTestId('crossBoxSummary').props.children}${
      view.queryByTestId('crossBoxNotShown')?.props.children ?? ''
    }`;

  const label = (view: Mounted) =>
    view.getByTestId('crossBoxLine').props.accessibilityLabel as string;

  /** Every word visible on the line is held to one line: nothing can wrap into a second. */
  const expectOneLine = (view: Mounted) => {
    const words = within(view.getByTestId('crossBoxSlot')).getAllByText(/./);
    expect(words.length).toBeGreaterThan(0);
    for (const text of words) {
      expect(text.props.numberOfLines).toBe(1);
    }
  };

  /** The reported line: one box served by fiction, two that could not be refreshed. */
  const reported = () => [
    box({ boxId: 'a', unread: 1, fiction: 1 }),
    unreachable({ boxId: 'b', unread: 2 }),
    unreachable({ boxId: 'c', unread: 1 }),
  ];
  const WHOLE = 'Jinde: 1 doručeno fikcí · naposledy 3 nepřečtené · 2 nenačtené';

  it('shows every clause when all of them fit', async () => {
    const { view } = await mount(reported());
    await lay(view, { room: sixWide(WHOLE) + 2 });
    expect(drawn(view)).toBe(WHOLE);
    expect(view.queryByTestId('crossBoxNotShown')).toBeNull();
    expect(view.getByTestId('crossBoxSummary')).toHaveStyle({ opacity: 1 });
    expect(label(view)).toBe(`${WHOLE}. Schránky`);
    expectOneLine(view);
  });

  it('shows the first two whole and counts the one left out', async () => {
    const two = 'Jinde: 1 doručeno fikcí · naposledy 3 nepřečtené · +1';
    // Room for the two and their count, and not for all three.
    const { view } = await mount(reported());
    await lay(view, { room: sixWide(two) + 2 });
    expect(sixWide(two) + 2).toBeLessThan(sixWide(WHOLE));
    expect(drawn(view)).toBe(two);
    expect(label(view)).toBe(`${WHOLE}. Schránky`);
    expectOneLine(view);
  });

  it('shows only the first when that is all that fits, and counts the rest', async () => {
    const first = 'Jinde: 1 doručeno fikcí · +2';
    const { view } = await mount(reported());
    await lay(view, { room: sixWide(first) + 2 });
    expect(drawn(view)).toBe(first);
    expect(label(view)).toBe(`${WHOLE}. Schránky`);
    expectOneLine(view);

    // All seven clauses, and room for the most urgent of them.
    const everything = await mount([
      dueIn([-2, 3], { boxId: 'a' }),
      box({ boxId: 'b', unread: 3, fiction: 1, refreshing: true }),
      unreachable({ boxId: 'c', unread: 1 }),
    ]);
    const onlyOverdue = 'Jinde: 1 po termínu · +6';
    await lay(everything.view, { room: sixWide(onlyOverdue) + 2 });
    expect(drawn(everything.view)).toBe(onlyOverdue);
  });

  it('counts what it left out in English at parity', async () => {
    setActiveLocale('en');
    try {
      const first = 'Elsewhere: 1 served by fiction · +2';
      const { view } = await mount(reported());
      await lay(view, { room: sixWide(first) + 2 });
      expect(drawn(view)).toBe(first);
    } finally {
      setActiveLocale('cs');
    }
  });

  it('still shows the first clause when not even that fits, truncating it and keeping the count whole', async () => {
    const { view } = await mount(reported());
    await lay(view, { room: 60 });
    expect(drawn(view)).toBe('Jinde: 1 doručeno fikcí · +2');
    // The sentence is the part that gives way, on its one line; the count after it never does.
    const summary = view.getByTestId('crossBoxSummary');
    expect(summary.props.numberOfLines).toBe(1);
    expect(summary).toHaveStyle({ flexShrink: 1 });
    expect(view.getByTestId('crossBoxNotShown')).toHaveStyle({ flexShrink: 0 });
    // Nothing the screen could not fit is lost to a screen reader.
    expect(label(view)).toBe(`${WHOLE}. Schránky`);
    expectOneLine(view);
  });

  it('keeps three pixels spare, because every width it reads was rounded to the pixel grid', async () => {
    // jest's screen has two pixels to a point, so three pixels are 1.5 points.
    const { view } = await mount(reported());
    await lay(view, { room: sixWide(WHOLE) });
    expect(drawn(view)).toBe(
      'Jinde: 1 doručeno fikcí · naposledy 3 nepřečtené · +1',
    );
    await lay(view, { room: sixWide(WHOLE) + 1.5 });
    expect(drawn(view)).toBe(WHOLE);
  });

  it('holds its one line without words until the first measurement lands, and never draws two', async () => {
    const { view } = await mount(reported());
    const summary = () => view.getByTestId('crossBoxSummary');
    // Not measured yet: the whole sentence, transparent, in the one line it will keep - so nothing
    // cut mid-word is ever on screen to rearrange itself when the widths arrive.
    expect(summary()).toHaveStyle({ opacity: 0 });
    expect(drawn(view)).toBe(WHOLE);
    expectOneLine(view);

    // The room alone decides nothing: the words have to be measured too.
    const two = 'Jinde: 1 doručeno fikcí · naposledy 3 nepřečtené · +1';
    await fireEvent(view.getByTestId('crossBoxSlot'), 'layout', layout(sixWide(two) + 2));
    expect(summary()).toHaveStyle({ opacity: 0 });

    await lay(view, {});
    expect(summary()).toHaveStyle({ opacity: 1 });
    expect(drawn(view)).toBe(two);
    expectOneLine(view);
  });

  it('follows the widths when the text size, the screen or the sentence changes', async () => {
    const onPress = jest.fn();
    const view = await render(tree(reported(), onPress));
    await lay(view, { room: 400 });
    expect(drawn(view)).toBe(WHOLE);

    // A larger text size: native lays the same words out wider, and fewer of them fit.
    const eightWide = (text: string) => text.length * 8;
    await lay(view, { font: eightWide });
    expect(drawn(view)).toBe('Jinde: 1 doručeno fikcí · +2');

    // Turned to landscape: more room, and all of it fits again.
    await lay(view, { room: 800, font: eightWide });
    expect(drawn(view)).toBe(WHOLE);

    // A refresh starts and a clause arrives. Until its width is known it waits in the count - whole,
    // never drawn on a guess.
    await view.rerender(
      tree([...reported(), box({ boxId: 'd', refreshing: true })], onPress),
    );
    expect(drawn(view)).toBe(`${WHOLE} · +1`);
    expectOneLine(view);
    await lay(view, { font: eightWide });
    expect(drawn(view)).toBe(`${WHOLE} · načítá se…`);
    expect(label(view)).toBe(`${WHOLE} · načítá se…. Schránky`);
  });

  it('keeps its measuring words from screen readers on both platforms, and measures in the type it draws', async () => {
    const { view } = await mount(reported());
    await lay(view, { room: 400 });
    // What assistive technology can reach does not include the column at all...
    expect(view.queryByTestId('crossBoxMeasure')).toBeNull();
    expect(view.queryAllByText('Jinde: 1 doručeno fikcí')).toHaveLength(0);
    expect(view.getAllByText('Jinde: 1 doručeno fikcí', HIDDEN)).toHaveLength(1);
    const column = view.getByTestId('crossBoxMeasure', HIDDEN);
    expect(column.props.accessibilityElementsHidden).toBe(true); // iOS
    expect(column.props.importantForAccessibility).toBe('no-hide-descendants'); // Android
    // ...and it takes no room, draws nothing and takes no tap from the line.
    expect(column).toHaveStyle({ position: 'absolute', opacity: 0 });
    expect(column.props.pointerEvents).toBe('none');

    const typeOf = (style: StyleProp<TextStyle>) => {
      const flat = StyleSheet.flatten(style);
      return {
        fontFamily: flat.fontFamily,
        fontSize: flat.fontSize,
        lineHeight: flat.lineHeight,
        letterSpacing: flat.letterSpacing,
      };
    };
    const drawnType = typeOf(view.getByTestId('crossBoxSummary').props.style);
    expect(drawnType.fontSize).toBe(12);
    for (const text of view.getAllByTestId('crossBoxMeasured', HIDDEN)) {
      expect(typeOf(text.props.style)).toEqual(drawnType);
    }
  });
});

describe('the dots', () => {
  it('are the boxes being REPORTED, one each while they fit', async () => {
    const { view } = await mount([
      box({ boxId: 'a', unread: 1 }),
      box({ boxId: 'b', unread: 1 }),
    ]);
    await waitFor(() => view.getByTestId('crossBoxLine'));
    expect(view.getByTestId('crossBoxDots').children).toHaveLength(2);
    expect(view.queryByTestId('crossBoxMore')).toBeNull();
  });

  it('stop at three and count the rest, so fifteen boxes cannot overflow the row', async () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      box({ boxId: `box${i}`, unread: 2 }),
    );
    const { view } = await mount(many);
    await waitFor(() => view.getByTestId('crossBoxLine'));
    // three dots plus the "+12" - a fixed width whatever the box count is
    expect(view.getByTestId('crossBoxMore')).toHaveTextContent('+12');
    // and nothing is lost: the sentence still states the real total
    expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(
      new RegExp(t('attn.unread.many', { n: 30 })),
    );
  });

  it('show exactly three with no count at the boundary', async () => {
    const { view } = await mount([
      box({ boxId: 'a', unread: 1 }),
      box({ boxId: 'b', unread: 1 }),
      box({ boxId: 'c', unread: 1 }),
    ]);
    await waitFor(() => view.getByTestId('crossBoxLine'));
    expect(view.queryByTestId('crossBoxMore')).toBeNull();
  });
});

it('renders nothing when nothing is happening elsewhere', async () => {
  // Not a line saying "nothing to report" - that is the chrome this replaced.
  const { view } = await mount([]);
  expect(view.queryByTestId('crossBoxLine')).toBeNull();
});

it('opens the switcher, where each box already shows its own state', async () => {
  const { view, onPress } = await mount([box({ unread: 1 })]);
  await waitFor(() => view.getByTestId('crossBoxLine'));
  fireEvent.press(view.getByTestId('crossBoxLine'));
  expect(onPress).toHaveBeenCalled();
});

it('tells a screen reader the sentence and where the tap goes', async () => {
  // The dots say nothing assistive technology can use.
  const { view } = await mount([box({ unread: 2, syncError: 'reauth' })]);
  await waitFor(() => view.getByTestId('crossBoxLine'));
  const label = view.getByTestId('crossBoxLine').props.accessibilityLabel as string;
  expect(label).toContain(t('crossBox.prefix'));
  expect(label).toContain(t('attn.unread.few', { n: 2 }));
  expect(label).toContain(t('home.title'));
});

it('reads the nearest deadline to a screen reader too', async () => {
  const { view } = await mount([dueIn(1)]);
  await waitFor(() => view.getByTestId('crossBoxLine'));
  const label = view.getByTestId('crossBoxLine').props.accessibilityLabel as string;
  expect(label).toContain('Jinde: termín zítra');
});
