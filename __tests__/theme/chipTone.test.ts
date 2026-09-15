import { chipTone } from '../../src/theme/chipTone';
import { lightTheme, darkTheme } from '../../src/theme/theme';

describe('chipTone', () => {
  it('returns the light tone in the light theme', () => {
    expect(chipTone('fikceRed', lightTheme)).toEqual({
      bg: '#F7E4E1',
      fg: '#B5362F',
      accent: '#B5362F',
    });
  });

  it('returns a DIFFERENT (derived) tone in the dark theme - no light surface leaks', () => {
    const light = chipTone('fikceRed', lightTheme);
    const dark = chipTone('fikceRed', darkTheme);
    expect(dark.bg).not.toBe(light.bg);
    expect(dark.fg).not.toBe(light.fg);
    expect(dark.bg).toBe('#3A211E');
  });

  it('estSoft falls back to neutral theme tokens (themed automatically)', () => {
    expect(chipTone('estSoft', lightTheme)).toEqual({
      bg: lightTheme.surfaceSunken,
      fg: lightTheme.textMuted,
      accent: lightTheme.borderStrong,
    });
    expect(chipTone('estSoft', darkTheme).bg).toBe(darkTheme.surfaceSunken);
  });

  // The sent-status green was deepened (#2A744B -> #1B6E52) when Doručeno gained a SOLID glyph: the
  // lighter green went muddy as a filled disc. The design deepened ONLY this tone, so costFree - which
  // used to share the exact same literal - must not be dragged along with it.
  it('statusRead carries the deepened green, and costFree keeps the original', () => {
    expect(chipTone('statusRead', lightTheme).fg).toBe('#1B6E52');
    expect(chipTone('statusRead', lightTheme).accent).toBe('#1B6E52');
    expect(chipTone('costFree', lightTheme).fg).toBe('#2A744B');
    expect(chipTone('statusRead', lightTheme).fg).not.toBe(
      chipTone('costFree', lightTheme).fg,
    );
  });

  it('every chip kind resolves to a complete {bg,fg,accent} in both themes', () => {
    const kinds = [
      'fikceRed', 'fikceAmber', 'userBlue', 'estSoft', 'costFree', 'costPaid',
      'statusSent', 'statusDelivered', 'statusRead', 'info', 'dangerSoft',
    ] as const;
    for (const theme of [lightTheme, darkTheme]) {
      for (const k of kinds) {
        const t = chipTone(k, theme);
        expect(typeof t.bg).toBe('string');
        expect(typeof t.fg).toBe('string');
        expect(typeof t.accent).toBe('string');
      }
    }
  });
});
