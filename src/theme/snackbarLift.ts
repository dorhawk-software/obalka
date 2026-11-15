// What the snackbar has to stand above (board R9, 031 I60): "ink with the gold action, above the
// stamp". The compose stamp floats at the bottom of the inbox, where the snackbar would otherwise lie
// over it; while the stamp is on screen it tells the snackbar how high it reaches, and the snackbar
// stands 6 over it. A screen the stack has covered keeps its stamp mounted, so only one on screen
// counts: the backup screen's snackbar sits at the bottom, not over a stamp nobody can see.
//
// Here, beside the stamp, and not in `app/Snackbar`: the theme does not reach into the app.

import { createContext, useContext, useEffect } from 'react';

/** Set by the snackbar's provider: how far above the safe area's bottom edge the stamp reaches. */
export const SnackbarLiftContext = createContext<((height: number) => void) | null>(null);

/** While `active`, the snackbar stands over something `height` tall above the safe area's edge. */
export function useSnackbarLift(height: number, active: boolean): void {
  const setLift = useContext(SnackbarLiftContext);
  useEffect(() => {
    if (!setLift || !active) {
      return;
    }
    setLift(height);
    return () => setLift(0);
  }, [setLift, height, active]);
}
