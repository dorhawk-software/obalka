// Whether what calls this is on screen: its screen is the focused one, and the app is in front. A
// screen the stack has covered stays mounted, and so does the whole app in the background, so a
// drawing that listens to a sensor asks this before it starts listening (the window's glint, 031 I70).
//
// Outside a navigator (a test, a screen drawn before navigation exists) only the app's state counts.

import { useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContext } from '@react-navigation/native';

export function useOnScreen(): boolean {
  // `useIsFocused()` throws outside a navigator; the context is `undefined` there instead.
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  const [active, setActive] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    if (!navigation) {
      return;
    }
    setFocused(navigation.isFocused());
    const onFocus = navigation.addListener('focus', () => setFocused(true));
    const onBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      onFocus();
      onBlur();
    };
  }, [navigation]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => sub.remove();
  }, []);

  return focused && active;
}
