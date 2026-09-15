// First-run welcome (feature 009). The branded entry point shown when there are no boxes yet: the
// "Obálka" brand lockup (logo tile + Bricolage wordmark + a one-line tagline), a dark primary action
// that enters the existing add-box flow, and under it a secondary one that opens the restore screen.
// Mounted by AppShell when `accounts.length === 0` (see the 'welcome' route); the primary action routes
// to 'addBox' (LoginFlow → AddBoxForm), the secondary to 'restore'.
//
// The restore action was held back while backup (006) was not built. It shipped on 2026-09-24, when a
// new phone turned out to have no way to its archive but through a box added by hand: the transfer
// and the backup file both sat behind Settings, which a phone with no boxes cannot reach. Where this
// build can receive a transfer (`canTransfer`, from the transport, on Android and on iOS since 025
// T022) it names the phone-to-phone transfer as well; a build without the native archive says only
// what it can do.
// It shipped as a quiet text button and read as a caption, not as a way in, so the same day it became
// an outlined button: the primary's width cap, height and radius, the outline of the app's other
// secondary button (the diagnostics question's "Neodesílat"), and the lock screen's leading-icon
// spacing - no metric of its own. Its icon is the backup glyph the screens behind it use. Its words
// fit one line of it on a 360dp phone in both languages (see the strings).
//
// The language is chosen here too, top corner, for the same reason: this screen is the whole app until
// a box exists, and somebody who does not read Czech cannot find Settings from it. The corner shows the
// language in use and opens a sheet listing every language (`LanguageSheet`) - not a switch to "the
// other one", which could not survive a third.

import { useState } from 'react';
import { XStack, YStack } from '../../../theme/ui';
import { Body, BodyStrong, Display, Label } from '../../../theme/Typography';
import { PressScale } from '../../../theme/PressScale';
import { useTheme } from '../../../theme/ThemeProvider';
import { BackupIcon, ChevronDownIcon, HelpIcon } from '../../../theme/icons';
import { fonts } from '../../../theme/typography';
import { textSlop, touchSlop } from '../../../theme/touchTarget';
import { space } from '../../../theme/spacing';
import { useHeaderTop } from '../../../theme/useHeaderTop';
import { t } from '../../../i18n/strings';
import LogoMark from '../../../assets/logo.svg';
import { DebugRecordingFrame } from '../../../app/DebugRecordingStrip';
import { useLocale, useSettings } from '../../../app/settings/SettingsProvider';
import { LANGUAGES } from '../../../app/settings/languages';
import { LanguageSheet } from '../../../app/settings/LanguageSheet';

/** The help link's vertical padding - read by its touch slop too, so the two cannot drift apart. */
const FAQ_PAD = 6;
/** The language control's vertical padding, around the flag chip it is as tall as. */
const LANGUAGE_PAD = FAQ_PAD;
/** The drawn flag chip's height (`theme/artwork.tsx`). */
const FLAG_HEIGHT = 20;
/** The two actions' shared box (design: 54dp tall, radius 16, capped at 300dp) - one set, two users. */
const ACTION = { maxWidth: 300, height: 54, radius: 16 } as const;

interface WelcomeProps {
  readonly onAddBox: () => void;
  readonly onOpenFaq: () => void;
  /** Opens the restore screen: a transfer from another phone, or a backup file. */
  readonly onRestore: () => void;
  /** Whether this phone can receive a phone-to-phone transfer, which changes what the button says. */
  readonly canTransfer: boolean;
}

export function Welcome(props: WelcomeProps) {
  // Removing the last box while Debug mode records lands here, still recording (023 FR-007). The shell
  // draws this outside the navigator, so the strip is a mark: the Debug screen is not reachable from it.
  return (
    <DebugRecordingFrame>
      <WelcomeContent {...props} />
    </DebugRecordingFrame>
  );
}

function WelcomeContent({ onAddBox, onOpenFaq, onRestore, canTransfer }: WelcomeProps) {
  const theme = useTheme();
  // Subscribed here rather than trusted to a parent's re-render: the switch below changes the language
  // of this very screen, and every word on it has to follow (the navigator's `localized` does the same).
  useLocale();
  return (
    <YStack flex={1} backgroundColor={theme.bg} testID="welcome">
      <LanguagePicker />
      {/* ONE centered column (design: padding 36/32, everything - logo, wordmark, tagline AND the
          primary action - is a centered child; the button is NOT pinned to the bottom). Our logo.svg
          is already a rounded-square app-icon badge (blue body + gold flap), so it's shown on its own
          - NOT inside another blue tile (that made the blue body read blue-on-blue). */}
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        paddingVertical={36}
        paddingHorizontal={32}
      >
        {/* Bare badge (no tile) with the design's soft brand-blue drop shadow. */}
        <YStack
          width={120}
          height={120}
          borderRadius={26}
          marginBottom={34}
          style={{ boxShadow: '0 18px 42px rgba(33,50,90,0.35)' }}
        >
          <LogoMark width={120} height={120} />
        </YStack>
        <Display
          fontSize={34}
          lineHeight={41}
          letterSpacing={-1}
          color={theme.text}
          textAlign="center"
        >
          {t('app.name')}
        </Display>
        {/* Public Sans is a per-face family: the Medium face has to be named explicitly (a fontWeight
            override alone can't reach it). */}
        <Body
          fontSize={16}
          lineHeight={23}
          fontFamily={fonts.bodyMedium}
          fontWeight="500"
          color={theme.textMuted}
          textAlign="center"
          maxWidth={280}
          marginTop={12}
        >
          {t('welcome.tagline')}
        </Body>

        {/* Single dark, high-contrast primary action → enters the add-box flow (design: 54dp tall,
            radius 16, `text` fill / `surfaceAlt` label, capped at 300dp, one soft warm-ink shadow). */}
        <PressScale
          fullWidth
          onPress={onAddBox}
          accessibilityLabel={t('login.title')}
          testID="welcome-add-box"
          style={{ maxWidth: ACTION.maxWidth, marginTop: 40 }}
        >
          <XStack
            width="100%"
            minHeight={ACTION.height}
            borderRadius={ACTION.radius}
            backgroundColor={theme.text}
            alignItems="center"
            justifyContent="center"
            style={{ boxShadow: '0 6px 16px rgba(33,27,18,0.25)' }}
          >
            <BodyStrong fontSize={16} color={theme.surfaceAlt}>{t('login.title')}</BodyStrong>
          </XStack>
        </PressScale>

        {/* The second way in, and visibly the second: the same box, outlined rather than filled and
            with no shadow - the app's secondary button (TelemetryConsent's "Neodesílat": a 1px
            `borderStrong` outline, `text` label). The gap is the pair's there too (space.md). The
            icon leads the label as on the lock screen's Odemknout: 18dp, space.md before the words.
            `minHeight`, so a large system font grows the button instead of cropping the label. */}
        <PressScale
          fullWidth
          onPress={onRestore}
          accessibilityLabel={t(canTransfer ? 'welcome.restore' : 'welcome.restore.backupOnly')}
          testID="welcome-restore"
          style={{ maxWidth: ACTION.maxWidth, marginTop: space.md }}
        >
          <XStack
            width="100%"
            minHeight={ACTION.height}
            borderRadius={ACTION.radius}
            borderWidth={1}
            borderColor={theme.borderStrong}
            paddingHorizontal={space.xl}
            alignItems="center"
            justifyContent="center"
            gap={space.md}
          >
            <BackupIcon size={18} color={theme.text} />
            <BodyStrong fontSize={16} color={theme.text} textAlign="center" flexShrink={1}>
              {t(canTransfer ? 'welcome.restore' : 'welcome.restore.backupOnly')}
            </BodyStrong>
          </XStack>
        </PressScale>
      </YStack>

      {/* Help, pinned to the bottom and deliberately quiet (design): it must not compete with the
          single primary action, but it has to be findable by someone who cannot get past this screen
          because they do not know where ISDS credentials come from. */}
      <XStack
        position="absolute"
        left={0}
        right={0}
        bottom={24}
        alignItems="center"
        justifyContent="center"
        gap={6}
        paddingVertical={FAQ_PAD}
        // The line is the dense 14pt label (its box matches the 16pt icon beside it) plus this
        // padding - a text button, so its height comes from the type scale, not from a number.
        hitSlop={textSlop('label', { fontSize: 14, dense: true, paddingVertical: FAQ_PAD })}
        onPress={onOpenFaq}
        pressStyle={{ opacity: 0.5 }}
        accessibilityRole="button"
        testID="welcome-faq"
      >
        <HelpIcon size={16} color={theme.textMuted} />
        <Label fontSize={14} dense color={theme.textMuted}>
          {t('faq.help')}
        </Label>
      </XStack>
    </YStack>
  );
}

/**
 * The language in use - its flag, its own name and a chevron saying there is a choice behind it - and,
 * on a tap, the sheet listing every language. Pinned to the top corner, out of the centred column, so
 * changing the language moves nothing but its own label.
 */
function LanguagePicker() {
  const theme = useTheme();
  const top = useHeaderTop();
  const { locale } = useSettings();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === locale) ?? LANGUAGES[0];
  return (
    <>
      <XStack
        position="absolute"
        top={top}
        right={space.gutter}
        zIndex={1}
        alignItems="center"
        gap={space.base}
        paddingVertical={LANGUAGE_PAD}
        hitSlop={touchSlop({ height: FLAG_HEIGHT + LANGUAGE_PAD * 2 })}
        onPress={() => setOpen(true)}
        pressStyle={{ opacity: 0.5 }}
        accessibilityRole="button"
        accessibilityLabel={`${t('settings.language')}: ${current.name}`}
        accessibilityState={{ expanded: open }}
        testID="welcome-language"
      >
        {current.flag}
        {/* Label and chevron as the add-box form's "Pokročilé" disclosure draws them: 14pt, a 16dp
            chevron 6dp after it, both muted. */}
        <XStack alignItems="center" gap={space.sm}>
          <Label fontSize={14} dense color={theme.textMuted}>
            {current.name}
          </Label>
          <ChevronDownIcon size={16} color={theme.textMuted} />
        </XStack>
      </XStack>
      {open ? <LanguageSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}
