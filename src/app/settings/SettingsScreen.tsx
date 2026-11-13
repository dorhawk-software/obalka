import { useCallback, useState } from 'react';
import { ScreenHeader } from '../../theme/ScreenHeader';
import { Linking } from 'react-native';
import { useContentBottom } from '../../theme/useContentBottom';
import { ScrollView, XStack, YStack } from '../../theme/ui';
import { Small, SmallStrong } from '../../theme/Typography';
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
import { Card, CardRow, RowText, RowTitle, Section, WELL_INSET, Well } from './SettingsSection';
import { useCloseOnBackground } from '../useCloseOnBackground';

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
 * App settings: appearance (theme mode), language, security (app-lock), attachments, the scan,
 * diagnostics, backup and About - grouped cards under uppercase section labels, as boards R3 and R13
 * draw them (031).
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
  onOpenChangelog,
}: {
  readonly onBack: () => void;
  /** `focus` opens the FAQ with one answer already expanded (010 US3). */
  readonly onOpenFaq: (focus?: FaqId) => void;
  readonly onOpenBackup: () => void;
  readonly onOpenDebug: () => void;
  readonly onOpenLicences: () => void;
  /** Every release's changes (029). */
  readonly onOpenChangelog: () => void;
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
  // An RN Modal draws above the lock cover: a dialog the person opened closes as the app leaves.
  useCloseOnBackground(
    useCallback(() => {
      setNoLock(false);
      setLockStayedOn(false);
      setDownloadAsk(null);
    }, []),
  );

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
          paddingTop: 16,
          paddingBottom: contentBottom,
        }}
      >
        {/* Boards R3 and R13 (031, Cards B): every section a card with weight, a row's glyph in its
            well, the rows of one card parted by an inset hairline. */}
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
          <Card>
            <CardRow last>
              <Well name="lock" />
              <RowText title={t('settings.lock')} subtitle={t('settings.lock.desc')} />
              <Toggle
                value={appLock}
                onChange={onToggleLock}
                label={t('settings.lock')}
                disabled={lockBusy}
                testID="lock-toggle"
              />
            </CardRow>
          </Card>
        </Section>

        {/* 026 US4. Off until asked. The Wi-Fi row is always drawn - dimmed while the switch above is
            off - so turning the switch on moves nothing (constitution V). */}
        <Section label={t('settings.attachments')}>
          <Card>
            <CardRow last={false} dividerInset={WELL_INSET}>
              <Well name="download" />
              <RowText
                title={t('settings.autoDownload.title')}
                subtitle={t(
                  !autoDownload.on
                    ? 'settings.autoDownload.desc.off'
                    : autoDownload.since != null
                    ? 'settings.autoDownload.desc.new'
                    : 'settings.autoDownload.desc.all',
                )}
              />
              <Toggle
                value={autoDownload.on}
                onChange={onToggleAutoDownload}
                label={t('settings.autoDownload.title')}
                testID="auto-download-toggle"
              />
            </CardRow>
            <CardRow last indent dimmed={!autoDownload.on}>
              <RowText title={t('settings.autoDownload.wifi')} subtitle={t('settings.autoDownload.wifi.desc')} />
              <Toggle
                value={autoDownload.wifiOnly}
                onChange={next => {
                  haptics.selection();
                  setAutoDownloadWifiOnly(next);
                }}
                label={t('settings.autoDownload.wifi')}
                disabled={!autoDownload.on}
                rowDims
                testID="auto-download-wifi-toggle"
              />
            </CardRow>
          </Card>
        </Section>

        {/* 010 US3. Off until asked, and the description says plainly what the scan does and does not
            do - it reads the document on the phone, and its answer is a suggestion to check, never a
            deadline the app asserts. The switch is OFF by default, and the FAQ says so out loud: while
            off, the app does not read document contents at all. */}
        <Section label={t('settings.scan')}>
          <Card>
            <CardRow last={false} dividerInset={WELL_INSET}>
              <Well name="deadline" />
              <RowText
                title={t('settings.scan.title')}
                subtitle={t(scanAttachments ? 'settings.scan.desc' : 'settings.scan.desc.off')}
              />
              <Toggle
                value={scanAttachments}
                onChange={setScanAttachments}
                label={t('settings.scan.title')}
                testID="scan-toggle"
              />
            </CardRow>
            {/* The detail - which library, which words it keys on, what it refuses to do - lives in
                the FAQ, one tap away, on the card under the switch it explains. */}
            <XStack
              minHeight={48}
              paddingLeft={WELL_INSET}
              paddingRight={14}
              alignItems="center"
              gap={10}
              onPress={() => onOpenFaq('attachmentScan')}
              pressStyle={{ backgroundColor: theme.surfaceAlt }}
              accessibilityRole="link"
              accessibilityLabel={t('settings.scan.how')}
              testID="scan-how"
            >
              <HelpIcon size={18} color={theme.blue} />
              <SmallStrong flex={1} color={theme.blue}>
                {t('settings.scan.how')}
              </SmallStrong>
              <ChevronRightIcon size={18} color={theme.textMuted} />
            </XStack>
          </Card>
        </Section>

        {/* Diagnostics. Placed after the scan toggle on purpose - they are the same KIND of decision
            (what this app is allowed to do with your data). The description is concrete about what
            leaves and what cannot, because "helps us improve the app" is the sentence this app does not
            write. Under it, debug mode (023), which answers the same question differently: an error
            report is automatic and stripped to almost nothing; a debug bundle is a file you make
            deliberately, can read, and hand over yourself. */}
        <Section label={t('settings.diagnostics')}>
          <Card>
            <CardRow last={false}>
              <Well name="bell" />
              <RowText
                title={t('settings.telemetry.title')}
                subtitle={t(telemetry ? 'settings.telemetry.desc' : 'settings.telemetry.desc.off')}
              />
              <Toggle
                value={telemetry === true}
                onChange={setTelemetry}
                label={t('settings.telemetry.title')}
                testID="telemetry-toggle"
              />
            </CardRow>
            <CardRow last onPress={onOpenDebug}>
              <Well name="settings" />
              <RowText title={t('settings.debug')} subtitle={t('settings.debug.row.desc')} />
              <ChevronRightIcon size={18} color={theme.textMuted} />
            </CardRow>
          </Card>
        </Section>

        {/* 006. A row rather than a card of controls: backup has a password to reveal, a restore
            list and a scope statement, and cramming those beside the theme picker would bury all
            three. */}
        <Section label={t('backup')}>
          <Card>
            <CardRow last onPress={onOpenBackup}>
              <Well name="archive" />
              <RowText title={t('backup.toggle')} subtitle={t('backup.row.desc')} />
              <ChevronRightIcon size={18} color={theme.textMuted} />
            </CardRow>
          </Card>
        </Section>

        {/* The version row is a VALUE row; the rest navigate - the privacy-policy and source-code rows
            leave the app, so they carry the external-link mark rather than a chevron. */}
        <Section label={t('settings.about')}>
          <Card>
            <CardRow last={false}>
              <RowTitle flex={1}>{t('settings.version')}</RowTitle>
              <Small color={theme.textMuted}>{APP_VERSION}</Small>
            </CardRow>
            {/* Under the version it describes (029): what changed in it and before it. */}
            <CardRow last={false} onPress={onOpenChangelog}>
              <RowTitle flex={1}>{t('settings.whatsNew')}</RowTitle>
              <ChevronRightIcon size={18} color={theme.textMuted} />
            </CardRow>
            <CardRow last={false} onPress={() => onOpenFaq()}>
              <RowTitle flex={1}>{t('settings.faq')}</RowTitle>
              <ChevronRightIcon size={18} color={theme.textMuted} />
            </CardRow>
            <CardRow last={false} onPress={onOpenLicences}>
              <RowTitle flex={1}>{t('settings.licences')}</RowTitle>
              <ChevronRightIcon size={18} color={theme.textMuted} />
            </CardRow>
            {/* The policy in the app's language (2026-09-24). */}
            <CardRow last={false} onPress={() => openExternal(privacyPolicyUrl(locale))}>
              <RowTitle flex={1}>{t('settings.privacy')}</RowTitle>
              <ExternalLinkIcon size={17} color={theme.textMuted} />
            </CardRow>
            {/* The address under the title (R13), where a large font wraps it instead of pushing the
                external-link mark off the card. */}
            <CardRow last onPress={() => openExternal(REPOSITORY_URL)}>
              <RowText title={t('settings.sourceCode')} subtitle={REPOSITORY_LABEL} />
              <ExternalLinkIcon size={17} color={theme.textMuted} />
            </CardRow>
          </Card>
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
              <Small fontWeight="500" color={theme.textMuted}>
                {t('settings.autoDownload.ask.body')}
              </Small>
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
