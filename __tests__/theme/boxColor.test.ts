// A box's own colour (027 US3): ten of them, handed out distinct, read through one function.

import { BOX_COLORS, boxColor, isBoxColor, nextBoxColor } from '../../src/theme/boxColor';
import { avatarColor } from '../../src/theme/avatar';

describe('the box palette', () => {
  it('has ten colours, none twice', () => {
    expect(BOX_COLORS).toHaveLength(10);
    expect(new Set(BOX_COLORS).size).toBe(10);
  });

  it('knows its own colours and nothing else', () => {
    expect(isBoxColor(BOX_COLORS[3])).toBe(true);
    expect(isBoxColor('#000000')).toBe(false);
    expect(isBoxColor(null)).toBe(false);
  });
});

describe('nextBoxColor', () => {
  it('starts at the first colour', () => {
    expect(nextBoxColor([])).toBe(BOX_COLORS[0]);
  });

  it('takes the first colour no other box has', () => {
    expect(nextBoxColor([BOX_COLORS[0], BOX_COLORS[2]])).toBe(BOX_COLORS[1]);
  });

  it('ignores what is not a palette colour', () => {
    expect(nextBoxColor([null, undefined, '#123456'])).toBe(BOX_COLORS[0]);
  });

  it('with all ten taken, reuses the least used one', () => {
    const taken = [...BOX_COLORS, BOX_COLORS[0], BOX_COLORS[1]];
    expect(nextBoxColor(taken)).toBe(BOX_COLORS[2]);
  });

  it('gives ten boxes ten different colours', () => {
    const given: string[] = [];
    for (let i = 0; i < 10; i++) {
      given.push(nextBoxColor(given));
    }
    expect(new Set(given).size).toBe(10);
  });
});

describe('boxColor', () => {
  it('is the stored colour', () => {
    expect(boxColor({ boxId: 'abc', color: BOX_COLORS[5] })).toBe(BOX_COLORS[5]);
  });

  it('falls back to the old hash for a box without one, so nothing renders colourless', () => {
    expect(boxColor({ boxId: 'abc', color: null })).toBe(avatarColor('abc'));
    expect(boxColor({ boxId: 'abc' })).toBe(avatarColor('abc'));
    expect(boxColor({ boxId: 'abc', color: 'not-a-colour' })).toBe(avatarColor('abc'));
  });
});
