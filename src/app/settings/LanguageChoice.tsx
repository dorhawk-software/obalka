// Every language the app speaks, as the grouped radio list Settings draws: flag, the language's own
// name, the current one's radio filled. Settings and Welcome's language sheet both draw THIS, so the
// two are the same rows from the same list (`LANGUAGES`) and a language added there appears in both.

import { OptionGroup } from '../../theme/OptionGroup';
import { LANGUAGES, type Locale } from './languages';

export function LanguageChoice({
  value,
  onChange,
}: {
  readonly value: Locale;
  readonly onChange: (locale: Locale) => void;
}) {
  return (
    <OptionGroup
      value={value}
      onChange={onChange}
      testIDPrefix="lang"
      options={LANGUAGES.map(({ code, name, flag }) => ({
        value: code,
        label: name,
        leading: flag,
      }))}
    />
  );
}
