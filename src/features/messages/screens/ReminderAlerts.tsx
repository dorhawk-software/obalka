// "Notifications are off" beside a reminder (2026-09-24, 010 FR-006 amendment).
//
// A reminder the OS will not announce still works: the chip and the attention group are the primary
// signal, and that stays true. What was wrong is that nothing SAID so. The sheet promised an alert
// and the Termín row showed a date, while a denied permission, a switch turned off later in the
// system settings, or a blocked reminders channel meant no alert would ever come. The owner's call:
// tell the user, and offer the one thing that changes it.
//
// State is read, never asked for: `alertsFor` reads the permission without prompting. It is read on
// mount, after a reminder is saved or removed, after the "turn on" action, and whenever the app comes
// back to the foreground - which is how the line goes away after the user switches notifications on
// in the system settings and returns.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { XStack } from '../../../theme/ui';
import { Badge, Caption } from '../../../theme/Typography';
import { fonts } from '../../../theme/typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import { AlertIcon } from '../../../theme/icons';
import { textSlop } from '../../../theme/touchTarget';
import { t } from '../../../i18n/strings';
import { remindersController } from '../../accounts/deps';
import type { ReminderAlerts } from '../state/remindersController';

/**
 * What a reminder on this box will do, kept current. `null` until the first read lands: unknown is
 * not "off", so nothing is shown for it.
 */
export function useReminderAlerts(boxId: string): {
  readonly alerts: ReminderAlerts | null;
  /** Read the state again - after a save, a removal, or anything else that may have changed it. */
  readonly refresh: () => void;
  /** Ask the OS while it can still ask; otherwise open the system settings. Then read again. */
  readonly turnOn: () => void;
} {
  const [alerts, setAlerts] = useState<ReminderAlerts | null>(null);
  // Reads can overlap (a save and a foreground return together); only the newest may land.
  const latest = useRef(0);
  const mounted = useRef(true);

  const refresh = useCallback(() => {
    latest.current += 1;
    const mine = latest.current;
    void remindersController
      .alertsFor(boxId)
      .then(next => {
        if (mounted.current && mine === latest.current) {
          setAlerts(next);
        }
      })
      .catch(() => {}); // `alertsFor` does not reject; nothing to show if it ever did
  }, [boxId]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    // The user turns notifications on in the SYSTEM settings, outside the app. Coming back is the
    // only moment the app can notice, so that is when it looks again.
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => {
      mounted.current = false;
      sub.remove();
    };
  }, [refresh]);

  const turnOn = useCallback(() => {
    // Opening the settings resolves at once, and the read that follows still says "off" - the
    // foreground listener above is what picks up the change when the user comes back.
    void remindersController.turnOnAlerts().then(refresh, refresh);
  }, [refresh]);

  return { alerts, refresh, turnOn };
}

/**
 * The line under the Termín row when its reminder will not alert. Rendered only when that is so - it
 * reserves no space otherwise.
 *
 * It sits INSIDE the Termín card, under a hairline, so it reads as part of that reminder and moves
 * nothing above it. It changes at three moments, none of them while the user is working below it:
 * when the screen opens, as the date sheet closes after a save (under the sheet's own fade), and
 * when the app returns to the foreground - after the user has gone to the settings from this very
 * line.
 */
export function AlertsOffLine({ onTurnOn }: { readonly onTurnOn: () => void }) {
  const theme = useTheme();
  const blue = chipTone('userBlue', theme);
  return (
    <XStack
      alignItems="center"
      gap={12}
      paddingHorizontal={14}
      borderTopWidth={1}
      borderTopColor={theme.border}
      testID="term-alerts-off"
    >
      <AlertIcon size={18} color={theme.textFaint} />
      <Caption
        flex={1}
        minWidth={0}
        fontSize={12}
        paddingVertical={10}
        color={theme.textMuted}
      >
        {t('term.alertsOff')}
      </Caption>
      <XStack
        flexShrink={0}
        paddingVertical={10}
        pressStyle={{ opacity: 0.6 }}
        onPress={onTurnOn}
        accessibilityRole="button"
        accessibilityLabel={t('term.alertsOff.action')}
        hitSlop={textSlop('badge', { paddingVertical: 10 })}
        testID="term-alerts-on"
      >
        <Badge fontFamily={fonts.bodyXBold} fontWeight="800" color={blue.fg}>
          {t('term.alertsOff.action')}
        </Badge>
      </XStack>
    </XStack>
  );
}
