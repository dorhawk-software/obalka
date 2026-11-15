// The status bar's icons over a sheet or a menu: the theme's own, whatever the screen under it asked.
//
// The inbox asks for dark icons, because its flap is gold in both themes (031 T050: white on the gold
// measured 1.68:1 in dark). A sheet's scrim darkens that flap, and under it the theme's style reads
// (7.97:1 white in dark, 3.37:1 dark in light), so every sheet puts the theme's style back while it is
// up. React Native's StatusBar keeps a stack: the entry mounted last wins and unmounting it restores
// the one below.

import { StatusBar } from 'react-native';
import { useTheme } from './ThemeProvider';

export function SheetStatusBar() {
  const theme = useTheme();
  return <StatusBar barStyle={theme.name === 'dark' ? 'light-content' : 'dark-content'} />;
}
