// A box's own notice strips in its inbox (031 I16): its sign-in refused, or its password running out.
// Out of `MessageList.tsx`, which keeps when each is known; these are what is drawn of them. The merged
// view's "could not reach" strip stays there, with the boxes it counts.

import { Linking } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import { t } from '../../../i18n/strings';
import { portalUrl } from '../../../services/isds/endpoints';
import type { DataBoxAccount, Host } from '../../../services/isds/types';
import { refusedForExpiredPassword, type PasswordExpiry } from '../../accounts/state/passwordExpiry';
import { storedReauthKey } from '../../accounts/state/reauthCopy';
import { formatTermDate } from './TermPicker';
import { InboxStrip, StripAction } from './InboxStrips';

/**
 * Hands the Data Boxes portal for this box's environment to the OS browser.
 *
 * A hand-off, not a fetch: where an EXPIRED password is changed (ISDS refuses the sign-in an in-app
 * change would need), and where a box that does not sign in with name and password changes it (030).
 * A failure is inert: the strip simply does nothing rather than raising an error nobody can act on.
 *
 * Per environment since 2026-09-14. It opened the PRODUCTION portal for every box, so a test box's
 * "Změnit v portálu" landed on a portal where that test login does not exist.
 */
function openPortal(host: Host): void {
  void Linking.openURL(portalUrl(host)).catch(() => {});
}


export function BoxStrips({
  account,
  needsReauth,
  refusedAt,
  pwd,
  onReauth,
  onChangePassword,
}: {
  readonly account: DataBoxAccount;
  /** The box's sign-in is refused: the stored verdict, then the last sync's. */
  readonly needsReauth: boolean;
  /** When that sync was refused (0 before one was). */
  readonly refusedAt: number;
  readonly pwd: PasswordExpiry;
  readonly onReauth: (refusedAt: number) => void;
  readonly onChangePassword?: () => void;
}) {
  const theme = useTheme();
  // 030 US2: changed here while it still works, by a box that signs in with name and password.
  const changeInApp =
    onChangePassword != null && account.authMethod === 'password' && pwd.kind !== 'expired';
  // 001 FR-009: a password box refused after its stored expiry date. Read at the moment of the
  // refusal (`refusedAt`, above), the same one the strip's own copy uses (`storedReauthKey` below), so
  // its words and its portal action cannot disagree. A verdict already stored for the box wins over
  // that moment (`refusedForExpiredPassword`): the switcher row shows it and the re-auth screen reads
  // it, and a box refused before its date and still unrepaired read "change it on the portal" here
  // but "sign in again" on both of those once the date had passed.
  const passwordExpired = needsReauth && refusedForExpiredPassword(account, refusedAt);
  // The two strips are ACTIONABLE and must not read as the informational gold around them.
  const reauthTone = chipTone('dangerSoft', theme);
  const pwdTone = chipTone('info', theme);
  // The re-auth strip's "Přihlásit znovu" - one element for both of that strip's shapes (below).
  const reauthAction = (
    <StripAction tone={reauthTone} glyph="key" label={t('box.reauth.action')} onPress={() => onReauth(refusedAt)} testID="reauth" />
  );
  const reauthActionBelow = (
    <StripAction tone={reauthTone} glyph="key" label={t('box.reauth.action')} below onPress={() => onReauth(refusedAt)} testID="reauth" />
  );

  return (
    <>
    {needsReauth ? (
      <InboxStrip
        tone={reauthTone}
        message={t(storedReauthKey(account, 'box.reauth.session', 'box.reauth.credentials', refusedAt))}
        action={passwordExpired ? undefined : reauthAction}
        actionsBelow={
          passwordExpired ? (
            <>
              <StripAction
                tone={reauthTone}
                label={t('pwd.action')}
                role="link"
                below
                onPress={() => openPortal(account.host)}
                testID="reauthPortal"
              />
              {reauthActionBelow}
            </>
          ) : undefined
        }
      />
    ) : null}
    {/* The box's PASSWORD is running out - a different thing from the session above, and a quieter
        one: the box still works today, so blue. Shown only when re-auth is NOT being asked for: a box
        you cannot use has one problem, not two. While the password still works, a box that signs in
        with name and password changes it here (030 US2); an expired one, or any other box, is handed
        to the portal - an in-app change of an expired password is a sign-in ISDS refuses (VI). */}
    {!needsReauth && pwd.kind !== 'none' ? (
      <InboxStrip
        tone={pwdTone}
        testID="passwordExpiry"
        message={
          pwd.kind === 'expired'
            ? t('pwd.expired')
            : pwd.kind === 'today'
              ? t('pwd.today')
              : t('pwd.soon', { d: formatTermDate(pwd.date) })
        }
        action={
          <StripAction
            tone={pwdTone} glyph={changeInApp ? 'key' : undefined}
            label={t(changeInApp ? 'pwd.change' : 'pwd.action')}
            role={changeInApp ? 'button' : 'link'}
            onPress={changeInApp ? onChangePassword : () => openPortal(account.host)}
            testID="passwordExpiryAction"
          />
        }
      />
    ) : null}
    </>
  );
}
