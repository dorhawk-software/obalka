// The language picker Welcome opens from its top corner (2026-09-24): every language, in the app's
// bottom sheet, as the same rows Settings shows.
//
// It replaced a switch that flipped to "the other language", which worked for exactly two and would
// have stopped working the day a third arrived (Ukrainian is the likely one). Picking a row switches the
// whole app at once and closes the sheet; picking the current one only closes it.

import { useCallback } from 'react';
import { BottomSheet } from '../../theme/BottomSheet';
import { t } from '../../i18n/strings';
import { useCloseOnBackground } from '../useCloseOnBackground';
import { useSettings } from './SettingsProvider';
import { LanguageChoice } from './LanguageChoice';

export function LanguageSheet({ onClose }: { readonly onClose: () => void }) {
  const { locale, setLocale } = useSettings();
  useCloseOnBackground(useCallback(() => onClose(), [onClose]));
  return (
    <BottomSheet onClose={onClose} title={t('settings.language')} testID="language-sheet">
      <LanguageChoice
        value={locale}
        // The row ticks its own selection haptic (OptionGroup), so none is added here.
        onChange={next => {
          if (next !== locale) {
            setLocale(next);
          }
          onClose();
        }}
      />
    </BottomSheet>
  );
}
