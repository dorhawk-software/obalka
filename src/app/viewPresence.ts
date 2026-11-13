// Whether a stacked screen is the one in view (out of AppNavigator.tsx on 2026-11-13, when the transfer
// gained a receiving route and the navigator file reached its size limit; the routes that use it now
// live in more than one file).

import { useEffect, useState } from 'react';

/** The two focus events a stacked screen hears, and whether it is focused now. */
export interface FocusEvents {
  addListener(type: 'focus' | 'blur', listener: () => void): () => void;
  isFocused(): boolean;
}

/**
 * For a screen that stays mounted under the ones it opens: whether it is the one in view, and how
 * many times it has come BACK into view after another covered it.
 *
 * A return only, not the first focus, which the screen's own mount already reads for. Extracted from
 * `BackupRoute` so the counting has a test of its own (2026-09-15).
 */
export function useViewPresence(navigation: FocusEvents): {
  inView: boolean;
  shownAgain: number;
} {
  const [shownAgain, setShownAgain] = useState(0);
  const [inView, setInView] = useState(() => navigation.isFocused());
  useEffect(() => {
    let away = false;
    const offBlur = navigation.addListener('blur', () => {
      away = true;
      setInView(false);
    });
    const offFocus = navigation.addListener('focus', () => {
      setInView(true);
      if (away) {
        away = false;
        setShownAgain(n => n + 1);
      }
    });
    return () => {
      offBlur();
      offFocus();
    };
  }, [navigation]);
  return { inView, shownAgain };
}
