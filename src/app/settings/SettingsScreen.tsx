import { useState, type ReactNode } from 'react';
import { ScreenHeader } from '../../theme/ScreenHeader';
import { Linking } from 'react-native';
import { useContentBottom } from '../../theme/useContentBottom';
import { ScrollView, XStack, YStack } from '../../theme/ui';
import { Badge, Body, Caption, Value } from '../../theme/Typography';
import { fonts } from '../../theme/typography';
import { useTheme } from '../../theme/ThemeProvider';
import type { FaqId } from '../../content/faq';
import { OptionGroup } from '../../theme/OptionGroup';
import { Toggle } from '../../theme/Toggle';
import { Dialog } from '../../theme/Dialog';
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  HelpIcon,
} from '../../theme/icons';
import { t } from '../../i18n/strings';
import { appLock as appLockService } from '../../features/accounts/deps';
import { haptics } from '../../services/haptics';
import { reportFailure } from '../../services/telemetry/telemetry';
import {
  APP_VERSION,
  REPOSITORY_LABEL,
  REPOSITORY_URL,
  privacyPolicyUrl,
} from '../appInfo';
import { useSettings, type ThemeMode } from './SettingsProvider';
import { LanguageChoice } from './LanguageChoice';

const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system'];

/**
 * Hands a URL to the OS browser. The About area's only outbound actions - the repository and the
 * privacy policy, which lives in it - and each is a hand-off rather than a fetch: nothing in this app
 * talks to a server of ours (Principle III). A failure here is inert: the row simply does nothing
 * rather than surfacing an error the user cannot act on.
 */
function openExternal(url: string): void {
  void Linking.openURL(url).catch(() => {});
}

/**
 * App settings: appearance (theme mode), language, security (app-lock), help and the build version - laid out as the redesign's grouped cards (uppercase section
 * labels + bordered cards with radio rows / toggles), 009 §06.
 *
 * There is no background-sync section and no notifications section (014): the app performs no ISDS
 * call the user did not ask for, so there is nothing to schedule and nothing that could notify. The
 * FAQ entry `noBackgroundFetch` explains why.
 */
export function SettingsScreen({
  onBack,
  onOpenFaq,
  onOpenBackup,
  onOpenDebug,
  onOpenLicences,
}: {
  readonly onBack: () => void;
  /** `focus` opens the FAQ with one answer already expanded (010 US3). */
  readonly onOpenFaq: (focus?: FaqId) => void;
  readonly onOpenBackup: () => void;
  readonly onOpenDebug: () => void;
  readonly onOpenLicences: () => void;
}) {
  const theme = useTheme();
  const contentBottom = useContentBottom(28);
  const {
    themeMode,
    locale,
    appLock,
    scanAttachments,
    setScanAttachments,
    autoDownload,
    setAutoDownload,
    setAutoDownloadWifiOnly,
    telemetry,
    setTelemetry,
    setThemeMode,
    setLocale,
    setAppLock,
  } = useSettings();
  const [lockBusy, setLockBusy] = useState(false);
  /** The app's own dialog, not the OS alert - same reason as everywhere else (theme/Dialog). */
  const [noLock, setNoLock] = useState(false);
  /** Switching the lock off failed, so it is still on - and the switch saying so is not enough. */
  const [lockStayedOn, setLockStayedOn] = useState(false);
  /**
   * The automatic-download question, open, with the row it has selected (026 US4): only messages that
   * arrive from now on, or every message already on the phone as well.
   */
  const [downloadAsk, setDownloadAsk] = useState<'new' | 'all' | null>(null);

  // Turning it on asks which messages; turning it off does not ask anything.
  const onToggleAutoDownload = (next: boolean) => {
    haptics.selection();
    if (next) {
      setDownloadAsk('new');
    } else {
      setAutoDownload(false);
    }
  };

  // Enabling: the vault key moves behind the gate, and the user passes it once (biometric OR device
  // passcode) as the vault reads it back - so we never strand them behind a lock they can't open. A
  // cancel/failure leaves it off (the controlled toggle reverts) with the key where it was. If the
  // device has no lock at all the gate cannot exist, so we surface a hint to set one up.
  //
  // Disabling moves the key back without a prompt. If that fails the lock stays ON - the toggle
  // reverts - because a lock reported off with its key still behind the gate is the state that
  // would then ask for a fingerprint nobody expects.
  const onToggleLock = async (next: boolean) => {
    if (lockBusy) {
      return;
    }
    haptics.selection(); // a tick as the switch flips
    setLockBusy(true);
    try {
      if (next) {
        const result = await appLockService.enable(t('lock.prompt'));
        if (result === 'enabled') {
          setAppLock(true);
        } else if (
          result === 'noScreenLock' ||
          !(await appLockService.isAvailable())
        ) {
          setNoLock(true);
        }
      } else {
        try {
          await appLockService.disable();
          setAppLock(false);
        } catch (e) {
          reportFailure('appLock.arm', e, { stage: 'native' });
          setLockStayedOn(true);
        }
      }
    } finally {
      setLockBusy(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      <ScreenHeader title={t('settings.title')} onBack={onBack} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: contentBottom,
        }}
      >
        <Section label={t('settings.appearance')}>
          <OptionGroup
            value={themeMode}
            onChange={setThemeMode}
            testIDPrefix="theme"
            options={THEME_MODES.map(mode => ({
              value: mode,
              label: t(`settings.theme.${mode}`),
            }))}
          />
        </Section>

        <Section label={t('settings.language')}>
          <LanguageChoice value={locale} onChange={setLocale} />
        </Section>

        <Section label={t('settings.security')}>
          <XStack
            alignItems="center"
            gap={12}
            paddingVertical={13}
            paddingHorizontal={14}
            borderWidth={1}
            borderRadius={14}
            borderColor={theme.border}
            backgroundColor={theme.surface}
          >
            <YStack flex={1}>
              <RowTitle>{t('settings.lock')}</RowTitle>
              <Caption
                fontSize={12}
                lineHeight={15}
                marginTop={1}
                color={theme.textFaint}
              >
                {t('settings.lock.desc')}
              </Caption>
            </YStack>
            <Toggle
              value={appLock}
              onChange={onToggleLock}
              label={t('settings.lock')}
              disabled={lockBusy}
              testID="lock-toggle"
            />
          </XStack>
        </Section>

        {/* 026 US4. Off until asked. The Wi-Fi row is always drawn - disabled while the switch above
            is off - so turning the switch on moves nothing (constitution V). */}
        <Section label={t('settings.attachments')}>
          <YStack
            borderWidth={1}
            borderRadius={14}
            borderColor={theme.border}
            backgroundColor={theme.surface}
            overflow="hidden"
          >
            <AboutRow last={false}>
              <YStack flex={1}>
                <RowTitle>{t('settings.autoDownload.title')}</RowTitle>
                <Caption fontSize={12} lineHeight={15} marginTop={1} color={theme.textFaint}>
                  {t(
                    !autoDownload.on
                      ? 'settings.autoDownload.desc.off'
                      : autoDownload.since != null
                      ? 'settings.autoDownload.desc.new'
                      : 'settings.autoDownload.desc.all',
                  )}
                </Caption>
              </YStack>
              <Toggle
                value={autoDownload.on}
                onChange={onToggleAutoDownload}
                label={t('settings.autoDownload.title')}
                testID="auto-download-toggle"
              />
            </AboutRow>
            <AboutRow last>
              <YStack flex={1} opacity={autoDownload.on ? 1 : 0.55}>
                <RowTitle>{t('settings.autoDownload.wifi')}</RowTitle>
                <Caption fontSize={12} lineHeight={15} marginTop={1} color={theme.textFaint}>
                  {t('settings.autoDownload.wifi.desc')}
                </Caption>
              </YStack>
              <Toggle
                value={autoDownload.wifiOnly}
                onChange={next => {
                  haptics.selection();
                  setAutoDownloadWifiOnly(next);
                }}
                label={t('settings.autoDownload.wifi')}
                disabled={!autoDownload.on}
                testID="auto-download-wifi-toggle"
              />
            </AboutRow>
          </YStack>
        </Section>

        {/* 010 US3. Off until asked, and the description says plainly what the scan does and does not
            do - it reads the document on the phone, and its answer is a suggestion to check, never a
            deadline the app asserts. */}
        <Section label={t('settings.scan')}>
          <XStack
            alignItems="center"
            gap={12}
            paddingVertical={12}
            paddingHorizontal={14}
            borderWidth={1}
            borderRadius={14}
            borderColor={theme.border}
            backgroundColor={theme.surface}
          >
            <YStack flex={1}>
              <RowTitle>{t('settings.scan.title')}</RowTitle>
              <Caption
                fontSize={12}
                lineHeight={15}
                marginTop={1}
                color={theme.textFaint}
              >
                {/* The switch is OFF by default, and the FAQ says so out loud: while off, the app
                    does not read document contents at all. A row that describes the scan as
                    happening, next to a switch that has never been turned on, contradicts it. */}
                {t(scanAttachments ? 'settings.scan.desc' : 'settings.scan.desc.off')}
              </Caption>
            </YStack>
            <Toggle
              value={scanAttachments}
              onChange={setScanAttachments}
              label={t('settings.scan.title')}
              testID="scan-toggle"
            />
          </XStack>
          {/* The detail - which library, which words it keys on, what it refuses to do - lives in the
              FAQ, one tap away. It does not belong beside a switch: a row long enough to be complete
              is a row nobody reads, and this is a decision about letting an app read legal mail, so
              the full account has to exist SOMEWHERE and be easy to reach. */}
          <XStack
            marginTop={8}
            paddingVertical={10}
            paddingHorizontal={14}
            alignItems="center"
            gap={8}
            onPress={() => onOpenFaq('attachmentScan')}
            pressStyle={{ opacity: 0.7 }}
            accessibilityRole="link"
            accessibilityLabel={t('settings.scan.how')}
            testID="scan-how"
          >
            <HelpIcon size={15} color={theme.blue} />
            <Body flex={1} fontSize={13} fontWeight="600" color={theme.blue}>
              {t('settings.scan.how')}
            </Body>
            <ChevronRightIcon size={16} color={theme.blue} />
          </XStack>
        </Section>

        {/* Diagnostics. Placed after the scan toggle on purpose - they are the same KIND of decision
            (what this app is allowed to do with your data) and belong next to each other rather than
            buried under About. The description is concrete about what leaves and what cannot,
            because "helps us improve the app" is the sentence this app does not write. */}
        <Section label={t('settings.diagnostics')}>
          <XStack
            alignItems="center"
            gap={12}
            paddingVertical={12}
            paddingHorizontal={14}
            borderWidth={1}
            borderRadius={14}
            borderColor={theme.border}
            backgroundColor={theme.surface}
          >
            <YStack flex={1}>
              <RowTitle>{t('settings.telemetry.title')}</RowTitle>
              <Caption
                fontSize={12}
                lineHeight={15}
                marginTop={1}
                color={theme.textFaint}
              >
                {t(
                  telemetry
                    ? 'settings.telemetry.desc'
                    : 'settings.telemetry.desc.off',
                )}
              </Caption>
            </YStack>
            <Toggle
              value={telemetry === true}
              onChange={setTelemetry}
              label={t('settings.telemetry.title')}
              testID="telemetry-toggle"
            />
          </XStack>

          {/* 023, under the error-report toggle because it answers the same question differently.
              An error report is automatic and stripped to almost nothing; a debug bundle is a file
              you make deliberately, can read, and hand over yourself. Someone who has just read
              what telemetry may send is exactly the person who should find this next. */}
          <YStack
            marginTop={9}
            borderWidth={1}
            borderRadius={14}
            borderColor={theme.border}
            backgroundColor={theme.surface}
            overflow="hidden"
          >
            <AboutRow last onPress={onOpenDebug}>
              <YStack flex={1}>
                <RowTitle>{t('settings.debug')}</RowTitle>
                <Caption
                  fontSize={12}
                  lineHeight={15}
                  marginTop={1}
                  color={theme.textFaint}
                >
                  {t('settings.debug.row.desc')}
                </Caption>
              </YStack>
              {/* This row OPENS a screen, so it carries the same mark as every other row that
                  does. It was the one exception, which read as "this one does something else"
                  to anyone scanning the column of chevrons down the right-hand edge. */}
              <ChevronRightIcon size={18} color={theme.textFaint} />
            </AboutRow>
          </YStack>
        </Section>

        {/* 006. A row rather than a card of controls: backup has a password to reveal, a restore
            list and a scope statement, and cramming those beside the theme picker would bury all
            three. The row carries its state so "am I backed up?" is answerable without opening it. */}
        <Section label={t('backup')}>
          <YStack
            borderWidth={1}
            borderRadius={14}
            borderColor={theme.border}
            backgroundColor={theme.surface}
            overflow="hidden"
          >
            <AboutRow last onPress={onOpenBackup}>
              <YStack flex={1}>
                <RowTitle>{t('backup.toggle')}</RowTitle>
                <Caption
                  fontSize={12}
                  lineHeight={15}
                  marginTop={1}
                  color={theme.textFaint}
                >
                  {t('backup.row.desc')}
                </Caption>
              </YStack>
              <ChevronRightIcon size={18} color={theme.textFaint} />
            </AboutRow>
          </YStack>
        </Section>

        {/* One card, five rows, hairline-separated (design). The version row is a VALUE row; the rest
            navigate - the privacy-policy and source-code rows leave the app, so they carry the
            external-link mark rather than a chevron. */}
        <Section label={t('settings.about')}>
          <YStack
            borderWidth={1}
            borderRadius={14}
            borderColor={theme.border}
            backgroundColor={theme.surface}
            overflow="hidden"
          >
            <AboutRow last={false}>
              <RowTitle>{t('settings.version')}</RowTitle>
              <Value color={theme.textFaint}>{APP_VERSION}</Value>
            </AboutRow>
            <AboutRow last={false} onPress={() => onOpenFaq()}>
              <RowTitle>{t('settings.faq')}</RowTitle>
              <ChevronRightIcon size={18} color={theme.textFaint} />
            </AboutRow>
            <AboutRow last={false} onPress={onOpenLicences}>
              <RowTitle>{t('settings.licences')}</RowTitle>
              <ChevronRightIcon size={18} color={theme.textFaint} />
            </AboutRow>
            {/* The policy in the app's language (2026-09-24). No URL beside it, unlike the source-code
                row: the address is the repository's again, and the title is already long. */}
            <AboutRow last={false} onPress={() => openExternal(privacyPolicyUrl(locale))}>
              <RowTitle>{t('settings.privacy')}</RowTitle>
              <XStack alignItems="center" gap={8} flexShrink={0}>
                <ExternalLinkIcon size={17} color={theme.textFaint} />
              </XStack>
            </AboutRow>
            <AboutRow last onPress={() => openExternal(REPOSITORY_URL)}>
              <RowTitle>{t('settings.sourceCode')}</RowTitle>
              {/* `AboutRow` is space-between, and NEITHER side could shrink - so at a large font
                  scale this pair simply grew past the card, clipping the URL mid-word and pushing
                  the external-link mark off the edge entirely. The mark is the part that says where
                  the row goes, so it is the last thing that should be allowed to leave: the URL
                  ellipsises instead. `minWidth={0}` is what lets a flex child shrink below its
                  content at all; without it `flexShrink` does nothing here. */}
              <XStack alignItems="center" gap={8} flexShrink={1} minWidth={0}>
                <Caption color={theme.textFaint} numberOfLines={1} flexShrink={1}>
                  {REPOSITORY_LABEL}
                </Caption>
                <ExternalLinkIcon size={17} color={theme.textFaint} />
              </XStack>
            </AboutRow>
          </YStack>
        </Section>
      </ScrollView>

      {noLock ? (
        <Dialog
          title={t('lock.unavailable.title')}
          body={t('lock.unavailable.body')}
          onDismiss={() => setNoLock(false)}
          testID="lock-unavailable-dialog"
          actions={[
            {
              label: t('common.ok'),
              tone: 'primary',
              testID: 'lock-unavailable-ok',
              onPress: () => setNoLock(false),
            },
          ]}
        />
      ) : null}

      {lockStayedOn ? (
        <Dialog
          title={t('lock.disableFailed.title')}
          body={t('lock.disableFailed.body')}
          onDismiss={() => setLockStayedOn(false)}
          testID="lock-disable-failed-dialog"
          actions={[
            {
              label: t('common.ok'),
              tone: 'primary',
              testID: 'lock-disable-failed-ok',
              onPress: () => setLockStayedOn(false),
            },
          ]}
        />
      ) : null}

      {downloadAsk ? (
        <Dialog
          title={t('settings.autoDownload.ask.title')}
          body={
            <YStack gap={12}>
              <OptionGroup<'new' | 'all'>
                value={downloadAsk}
                onChange={setDownloadAsk}
                testIDPrefix="auto-download-scope"
                options={[
                  {
                    value: 'new',
                    label: t('settings.autoDownload.ask.new'),
                    description: t('settings.autoDownload.ask.new.desc'),
                  },
                  {
                    value: 'all',
                    label: t('settings.autoDownload.ask.all'),
                    description: t('settings.autoDownload.ask.all.desc'),
                  },
                ]}
              />
              <Caption fontSize={14} lineHeight={20} color={theme.textMuted}>
                {t('settings.autoDownload.ask.body')}
              </Caption>
            </YStack>
          }
          onDismiss={() => setDownloadAsk(null)}
          testID="auto-download-dialog"
          actions={[
            {
              label: t('common.cancel'),
              testID: 'auto-download-cancel',
              onPress: () => setDownloadAsk(null),
            },
            {
              label: t('settings.autoDownload.ask.confirm'),
              tone: 'primary',
              testID: 'auto-download-confirm',
              onPress: () => {
                const onlyNew = downloadAsk === 'new';
                setDownloadAsk(null);
                setAutoDownload(true, onlyNew);
              },
            },
          ]}
        />
      ) : null}
    </YStack>
  );
}

/**
 * A settings-card row title - 15/600 (design). The SemiBold FACE has to be named: Public Sans is
 * 4-style grouped, so `fontWeight="600"` alone can't reach it from the Regular family (RN would render
 * 400). Same metrics on every card row (constitution V).
 */
function RowTitle({ children, flex }: { readonly children: ReactNode; readonly flex?: number }) {
  const theme = useTheme();
  return (
    <Body
      flex={flex}
      fontFamily={fonts.bodySemiBold}
      fontWeight="600"
      color={theme.text}
    >
      {children}
    </Body>
  );
}

/** A grouped-settings section: an uppercase faint label above its card(s). */
/**
 * A row inside the `O aplikaci` card - 13/14 padding with a hairline under every row but the last
 * (design). Rows without `onPress` are plain value rows and take no press treatment or button role.
 */
function AboutRow({
  children,
  last,
  onPress,
}: {
  readonly children: ReactNode;
  readonly last: boolean;
  readonly onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap={10}
      paddingVertical={13}
      paddingHorizontal={14}
      borderBottomWidth={last ? 0 : 1}
      borderBottomColor={theme.border}
      {...(onPress
        ? {
            onPress,
            accessibilityRole: 'button' as const,
            pressStyle: { backgroundColor: theme.surfaceAlt },
          }
        : null)}
    >
      {children}
    </XStack>
  );
}

function Section({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  const theme = useTheme();
  return (
    <YStack marginBottom={22} gap={9}>
      <Badge
        accessibilityRole="header"
        fontSize={12}
        textTransform="uppercase"
        letterSpacing={0.4}
        color={theme.textFaint}
        marginLeft={4}
      >
        {label}
      </Badge>
      {children}
    </YStack>
  );
}

