// First-run welcome (feature 009). The entry point shown when there are no boxes yet. Since 2026-11-15
// it is R1's (031 I04, agreed 2026-11-12): the envelope, its window empty - "Komu" over two blank
// lines, waiting for a box - then the name and the tagline, and at the foot the dark action that adds
// a box, the sunken one that restores, and the help link. Until then it was the logo badge over the
// name, the envelope's biggest moment with no envelope in it.
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
// a button of its own; R1 draws it in the sunken tone with the archive glyph. Its words fit one line
// of it on a 360dp phone in both languages (see the strings).
//
// The language is chosen here too, top corner, for the same reason: this screen is the whole app until
// a box exists, and somebody who does not read Czech cannot find Settings from it. The corner shows the
// language in use and opens a sheet listing every language (`LanguageSheet`) - not a switch to "the
// other one", which could not survive a third. R1 draws it as a sunken pill.
//
// Rounded to the scale: the pill's 9 at the flag's side to 10, the window's 9 above to 10; the
// actions' 16 labels to the 15 of `bodyStrong`.

import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from '../../../theme/ui';
import { Body, BodyStrong, Hero, Overline, SmallStrong, Value } from '../../../theme/Typography';
import { PressScale } from '../../../theme/PressScale';
import { useTheme } from '../../../theme/ThemeProvider';
import { ChevronDownIcon, HelpIcon } from '../../../theme/icons';
import { OffsetIcon } from '../../../theme/offsetIcons';
import { touchSlop } from '../../../theme/touchTarget';
import { Envelope } from '../../../theme/objects/Envelope';
import { Window, WindowBlankLine } from '../../../theme/objects/Window';
import { welcomeEnvelope } from '../../../theme/print';
import { t } from '../../../i18n/strings';
import { DebugRecordingFrame } from '../../../app/DebugRecordingStrip';
import { useLocale, useSettings } from '../../../app/settings/SettingsProvider';
import { LANGUAGES } from '../../../app/settings/languages';
import { LanguageSheet } from '../../../app/settings/LanguageSheet';
import { depth } from '../../../theme/depth';

/** R1, measured from the status bar: the language pill 4 under it, the envelope 64 under it. */
const PILL_TOP = 4;
const ENVELOPE_TOP = 64;
/** The language pill: 36 tall, the flag 22 by 15 (`theme/artwork.tsx`). */
const PILL_HEIGHT = 36;
/** R1's two actions: the dark one 54 tall, the sunken one 52, both with the 16 corner. */
const ACTION_RADIUS = 16;
/** R1's help link: 44 tall, the slop takes it to the target. */
const LINK_HEIGHT = 44;

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
  const insets = useSafeAreaInsets();
  // Subscribed here rather than trusted to a parent's re-render: the switch below changes the language
  // of this very screen, and every word on it has to follow (the navigator's `localized` does the same).
  useLocale();
  const restore = t(canTransfer ? 'welcome.restore' : 'welcome.restore.backupOnly');
  return (
    <YStack flex={1} backgroundColor={theme.bg} testID="welcome">
      {/* The envelope at the top, the actions at the foot, as R1 places them; on a short phone or at
          the largest text the two meet and the page scrolls rather than lay one over the other. */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'space-between',
          paddingTop: insets.top + ENVELOPE_TOP,
          paddingBottom: insets.bottom,
          paddingHorizontal: 24,
        }}
        bounces={false}
      >
        <YStack alignItems="center">
          <WaitingForABox />
          <Hero textAlign="center" marginTop={36} accessibilityRole="header">
            {t('app.name')}
          </Hero>
          <Body color={theme.bodyText} textAlign="center" maxWidth={300} marginTop={8} textBreakStrategy="balanced">
            {t('welcome.tagline')}
          </Body>
        </YStack>

        <YStack gap={10} marginTop={36}>
          <PressScale fullWidth onPress={onAddBox} accessibilityLabel={t('login.title')} testID="welcome-add-box">
            <XStack
              width="100%"
              minHeight={54}
              borderRadius={ACTION_RADIUS}
              backgroundColor={theme.text}
              alignItems="center"
              justifyContent="center"
              gap={10}
              style={{ boxShadow: depth.primaryButton }}
            >
              <OffsetIcon name="boxes" size={20} color={theme.surfaceAlt} plane="button" />
              <BodyStrong color={theme.surfaceAlt}>{t('login.title')}</BodyStrong>
            </XStack>
          </PressScale>
          <PressScale fullWidth onPress={onRestore} accessibilityLabel={restore} testID="welcome-restore">
            <XStack
              width="100%"
              minHeight={52}
              borderRadius={ACTION_RADIUS}
              backgroundColor={theme.surfaceSunken}
              paddingHorizontal={16}
              testID="welcome-restore-face"
              alignItems="center"
              justifyContent="center"
              gap={10}
            >
              <OffsetIcon name="archive" size={20} color={theme.text} />
              <BodyStrong color={theme.text} textAlign="center" flexShrink={1}>
                {restore}
              </BodyStrong>
            </XStack>
          </PressScale>
          {/* Help: a link under the two, quiet beside them but findable by someone who cannot get past
              this screen because they do not know where ISDS credentials come from. */}
          <XStack
            alignSelf="center"
            minHeight={LINK_HEIGHT}
            paddingHorizontal={4}
            alignItems="center"
            gap={6}
            hitSlop={touchSlop({ height: LINK_HEIGHT })}
            onPress={onOpenFaq}
            pressStyle={{ opacity: 0.5 }}
            accessibilityRole="button"
            testID="welcome-faq"
          >
            <HelpIcon size={18} color={theme.blue} />
            <SmallStrong color={theme.blue}>{t('faq.help')}</SmallStrong>
          </XStack>
        </YStack>
      </ScrollView>
      <LanguagePicker />
    </YStack>
  );
}

/** R1's envelope, its window empty: who it will be addressed to is the box the user adds. */
function WaitingForABox() {
  const theme = useTheme();
  const w = welcomeEnvelope;
  return (
    <Envelope
      creases={w.creases}
      style={{
        width: w.width,
        maxWidth: '100%',
        minHeight: w.minHeight,
        paddingVertical: 16,
        paddingHorizontal: 18,
        justifyContent: 'flex-end',
        transform: [{ rotate: w.tilt }],
      }}
    >
      <Window
        style={{
          width: w.window.width,
          maxWidth: '100%',
          minHeight: w.window.minHeight,
          paddingTop: 10,
          paddingRight: 14,
          paddingBottom: 12,
          paddingLeft: 13,
          gap: 2,
        }}
      >
        {/* A picture of what the actions below say: nothing in it to read out. */}
        <YStack gap={2} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="welcome-window">
          <Overline color={theme.textMuted}>{t('detail.to')}</Overline>
          {/* R1's rows are 14 with the 2 dotted rule under them: 16. */}
          <WindowBlankLine width="84%" height={16} />
          <WindowBlankLine width="58%" height={16} />
        </YStack>
      </Window>
    </Envelope>
  );
}

/**
 * The language in use - its flag, its own name and a chevron saying there is a choice behind it - and,
 * on a tap, the sheet listing every language. R1's sunken pill in the top corner, out of the column,
 * so changing the language moves nothing but its own label.
 */
function LanguagePicker() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { locale } = useSettings();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === locale) ?? LANGUAGES[0];
  return (
    <>
      <XStack
        position="absolute"
        top={insets.top + PILL_TOP}
        right={16}
        zIndex={1}
        minHeight={PILL_HEIGHT}
        paddingLeft={10}
        paddingRight={10}
        borderRadius={999}
        backgroundColor={theme.surfaceSunken}
        alignItems="center"
        gap={8}
        hitSlop={touchSlop({ height: PILL_HEIGHT })}
        onPress={() => setOpen(true)}
        pressStyle={{ opacity: 0.5 }}
        accessibilityRole="button"
        accessibilityLabel={`${t('settings.language')}: ${current.name}`}
        accessibilityState={{ expanded: open }}
        testID="welcome-language"
      >
        {current.flag}
        <Value color={theme.text}>{current.name}</Value>
        <ChevronDownIcon size={16} color={theme.text} />
      </XStack>
      {open ? <LanguageSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}
