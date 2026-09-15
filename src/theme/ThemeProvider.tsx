// Theme context: exposes the active palette (light/dark). The light/dark decision is made upstream
// (SettingsProvider: an explicit light/dark choice, or "system" → the OS scheme) and passed in as
// `isDark`. Screens call useTheme() and style with semantic tokens (theme.bg, theme.text, …).

import { createContext, useContext, type ReactNode } from 'react';
import { Theme, darkTheme, lightTheme } from './theme';

const ThemeContext = createContext<Theme>(lightTheme);

/** Active theme palette. Defaults to light if no provider is mounted (e.g. in isolated tests). */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export function AppThemeProvider({ isDark, children }: { readonly isDark: boolean; readonly children: ReactNode }) {
  return (
    <ThemeContext.Provider value={isDark ? darkTheme : lightTheme}>{children}</ThemeContext.Provider>
  );
}
