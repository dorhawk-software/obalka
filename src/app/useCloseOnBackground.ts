import { useEffect } from 'react';
import { AppState } from 'react-native';

/**
 * Dismiss transient UI (dialogs, sheets, the drawer) when the app leaves the foreground. RN `Modal`s
 * render in a SEPARATE native window that sits ABOVE the in-tree biometric lock overlay - so a dialog
 * left open would be visible over the lock screen (a privacy leak) and could tangle the UI on resume.
 * Closing on `background` (the same trigger the lock uses) keeps the locked snapshot clean and the
 * resume state sane.
 */
export function useCloseOnBackground(close: () => void) {
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') {
        close();
      }
    });
    return () => sub.remove();
  }, [close]);
}
