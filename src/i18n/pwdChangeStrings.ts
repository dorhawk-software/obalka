// The password change's strings (`pwdChange.*`, 030 US2): the form, its refusals and its done state.
// In their own file since 2026-11-13: `strings.ts` was at its size limit when the launch's waiting bar
// (031 R8) gained a spoken label, and a limit is met by splitting the file, never by trimming what it
// says. `strings.ts` spreads these into its tables.

/** Czech (primary). */
export const cs: Record<string, string> = {
  'pwdChange.title': 'Změnit heslo',
  'pwdChange.intro':
    'Nové heslo bude heslem schránky všude - v portálu ISDS i v dalších aplikacích. Změnit ho jde, jen dokud to současné platí.',
  'pwdChange.current': 'Současné heslo',
  'pwdChange.new': 'Nové heslo',
  'pwdChange.repeat': 'Nové heslo znovu',
  'pwdChange.rules': 'Nové heslo musí',
  'pwdChange.rule.length': 'mít 8 až 64 znaků',
  'pwdChange.rule.upper': 'obsahovat velké písmeno',
  'pwdChange.rule.lower': 'obsahovat malé písmeno',
  'pwdChange.rule.digit': 'obsahovat číslici',
  'pwdChange.rule.allowed':
    'mít jen písmena bez diakritiky, číslice, mezeru a znaky ! # $ % & ( ) * + , - . : = ? @ [ ] _ { | } ~',
  'pwdChange.rule.noLogin': 'neobsahovat přihlašovací jméno',
  'pwdChange.rule.noTriple': 'nemít žádný znak třikrát za sebou',
  'pwdChange.rule.noWeakStart': 'nezačínat 12345, qwert ani asdfg',
  'pwdChange.rule.differs': 'lišit se od současného',
  'pwdChange.rule.match': 'být v obou polích stejné',
  'pwdChange.rule.history': 'Heslo, které už jste někdy použili, ISDS odmítne.',
  'pwdChange.rule.met': 'splněno',
  'pwdChange.rule.unmet': 'nesplněno',
  'pwdChange.need.current': 'Zadejte současné heslo',
  'pwdChange.need.rules': 'Nové heslo ještě nesplňuje všechna pravidla',
  'pwdChange.need.match': 'Nová hesla se neshodují',
  'pwdChange.submit': 'Změnit heslo',
  'pwdChange.busy': 'Heslo se mění…',
  'pwdChange.error.wrongPassword':
    'ISDS současné heslo odmítlo. Zkontrolujte ho - po opakovaných pokusech může ISDS přístup zablokovat. Pokud mu už vypršela platnost, změňte ho v portálu ISDS.',
  'pwdChange.error.refused': 'ISDS nové heslo nepřijalo: {m}',
  'pwdChange.error.refusedPlain':
    'ISDS nové heslo nepřijalo. Zvolte jiné - heslo, které už jste někdy použili, znovu použít nejde.',
  'pwdChange.error.timeout':
    'Spojení vypršelo a není jisté, jestli ISDS heslo změnilo. Zkuste to znovu. Pokud současné heslo přestane fungovat, přihlaste se novým.',
  'pwdChange.error.notSaved':
    'Heslo je v ISDS změněné, ale aplikace ho nedokázala uložit. Až vás schránka požádá o přihlášení, použijte nové heslo.',
  'pwdChange.done.title': 'Heslo je změněné',
  'pwdChange.done.until': 'Nové heslo platí do {date}.',
  'pwdChange.done.noDate':
    'Do kdy platí, se nepodařilo zjistit - aplikace to načte při příštím přihlášení.',
  'pwdChange.done.everywhere':
    'Používejte ho i v portálu ISDS a v dalších aplikacích, kde se k této schránce přihlašujete.',
  'pwdChange.done.close': 'Hotovo',
};

/** English. */
export const en: Record<string, string> = {
  'pwdChange.title': 'Change password',
  'pwdChange.intro':
    'The new password becomes the box’s password everywhere - in the ISDS portal and in other apps too. It can be changed only while the current one still works.',
  'pwdChange.current': 'Current password',
  'pwdChange.new': 'New password',
  'pwdChange.repeat': 'New password again',
  'pwdChange.rules': 'The new password must',
  'pwdChange.rule.length': 'be 8 to 64 characters long',
  'pwdChange.rule.upper': 'contain a capital letter',
  'pwdChange.rule.lower': 'contain a small letter',
  'pwdChange.rule.digit': 'contain a digit',
  'pwdChange.rule.allowed':
    'use only letters without accents, digits, space and ! # $ % & ( ) * + , - . : = ? @ [ ] _ { | } ~',
  'pwdChange.rule.noLogin': 'not contain the login name',
  'pwdChange.rule.noTriple': 'not repeat a character three times in a row',
  'pwdChange.rule.noWeakStart': 'not start with 12345, qwert or asdfg',
  'pwdChange.rule.differs': 'differ from the current one',
  'pwdChange.rule.match': 'be the same in both fields',
  'pwdChange.rule.history': 'ISDS refuses a password you have used before.',
  'pwdChange.rule.met': 'met',
  'pwdChange.rule.unmet': 'not met',
  'pwdChange.need.current': 'Enter the current password',
  'pwdChange.need.rules': 'The new password does not meet every rule yet',
  'pwdChange.need.match': 'The new passwords do not match',
  'pwdChange.submit': 'Change password',
  'pwdChange.busy': 'Changing the password…',
  'pwdChange.error.wrongPassword':
    'ISDS refused the current password. Check it - repeated attempts can get the access blocked. If it has already expired, change it in the ISDS portal.',
  'pwdChange.error.refused': 'ISDS did not accept the new password: {m}',
  'pwdChange.error.refusedPlain':
    'ISDS did not accept the new password. Choose another - a password you have used before cannot be used again.',
  'pwdChange.error.timeout':
    'The connection timed out and it is not certain whether ISDS changed the password. Try again. If the current password stops working, sign in with the new one.',
  'pwdChange.error.notSaved':
    'The password is changed in ISDS, but the app could not save it. When the box asks you to sign in, use the new password.',
  'pwdChange.done.title': 'Password changed',
  'pwdChange.done.until': 'The new password is valid until {date}.',
  'pwdChange.done.noDate':
    'Its expiry date could not be read - the app reads it at the next sign-in.',
  'pwdChange.done.everywhere':
    'Use it in the ISDS portal too, and in any other app you sign in to this box with.',
  'pwdChange.done.close': 'Done',
};
