// The relay named on screen is the relay the binary uses (025 US3 scenario 2).
//
// The screen says WHICH relay a transfer crosses, and that sentence is only true for as long as it
// matches two files nothing in the JS suite otherwise reads: the croc version the Go wrapper builds
// against, and the relay options it hands croc. A croc bump or a wrapper pointed at another relay
// would leave the screen naming a host the transfer no longer touches - silently, on the one line the
// user was promised would say where their mail goes. So this reads both files.

import { readFileSync } from 'fs';
import { join } from 'path';
import { TRANSFER_RELAY } from '../../src/services/transfer/transport';
import { routeText } from '../../src/app/settings/TransferScreen';
import { STRINGS_FOR_TEST } from '../../src/i18n/strings';

const NATIVE = join(__dirname, '../../native/transfer');

describe('the relay the transfer names', () => {
  it('is croc s default relay, read from the version the wrapper actually builds against', () => {
    // Re-read `models.DEFAULT_RELAY` and `DEFAULT_RELAY6` in the new version, then move this pin.
    const goMod = readFileSync(join(NATIVE, 'go.mod'), 'utf8');
    const croc = /github\.com\/schollz\/croc\/v10 (v\d+\.\d+\.\d+)/.exec(goMod);
    expect(croc?.[1]).toBe(TRANSFER_RELAY.crocVersion);
    // And the defaults are what the wrapper hands croc. A relay of its own here would make every
    // name on the screen wrong at once.
    const wrapper = readFileSync(join(NATIVE, 'transfer.go'), 'utf8');
    expect(wrapper).toMatch(/RelayAddress:\s+relayAddress\(models\.DEFAULT_RELAY\),/);
    expect(wrapper).toMatch(/RelayAddress6:\s+relayAddress\(models\.DEFAULT_RELAY6\),/);
    // Since 025 T022 the builds keep croc from resolving those names while the library loads, so
    // they reach croc as the bare names plus the port. The Go test both builds run before binding
    // pins them, and it has to pin the hosts this screen names.
    const goTest = readFileSync(join(NATIVE, 'transfer_test.go'), 'utf8');
    expect(goTest).toContain(`"${TRANSFER_RELAY.host}:9009"`);
    expect(goTest).toContain(`"${TRANSFER_RELAY.host6}:9009"`);
  });

  it('names both hosts in both languages, because croc tries the IPv6 one first', () => {
    for (const locale of ['cs', 'en'] as const) {
      const sentence = STRINGS_FOR_TEST[locale]['transfer.route.relayed'];
      expect({ locale, sentence }).toEqual({
        locale,
        sentence: expect.stringContaining('{host}'),
      });
      expect(sentence).toContain('{host6}');
    }
    const shown = routeText(true);
    expect(shown).toContain('croc.schollz.com');
    expect(shown).toContain('croc6.schollz.com');
    expect(shown).not.toContain('{');
  });
});
