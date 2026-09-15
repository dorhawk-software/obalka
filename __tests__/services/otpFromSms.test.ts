// Reading the code out of the SMS (021).
//
// The real message is the first fixture; everything else exists because an OTP field is a bad place
// to guess. A wrong code spends one of a small number of attempts and can lock a box, so "nothing"
// has to beat "probably".

import { otpFromSms } from '../../src/services/sms/otpFromSms';

const REAL =
  'Dobry den. Autentizacni kod pro pristup k ISDS je 35124603. Ceska posta, s.p.';

describe('otpFromSms', () => {
  it('reads the code out of the message ISDS actually sends', () => {
    expect(otpFromSms(REAL)).toBe('35124603');
    expect(
      otpFromSms(
        'Dobry den. Autentizacni kod pro pristup k ISDS je 40982360. Ceska posta, s.p.',
      ),
    ).toBe('40982360');
  });

  it('still reads it if the wording gains diacritics', () => {
    expect(
      otpFromSms('Dobrý den. Autentizační kód pro přístup k ISDS je 48548485.'),
    ).toBe('48548485');
  });

  it('prefers the number the sentence points at over one that just happens to be there', () => {
    // A reference number and a code in the same message: the cue decides, not the order.
    expect(
      otpFromSms('Zprava 20260819 - autentizacni kod je 12345678. Ceska posta'),
    ).toBe('12345678');
  });

  it('offers nothing when two different numbers are equally plausible', () => {
    expect(otpFromSms('Kod je 11111111, nebo kod je 22222222.')).toBeNull();
  });

  it('offers nothing for a message with no code at all', () => {
    expect(otpFromSms('Vase zasilka byla dorucena. Ceska posta')).toBeNull();
    expect(otpFromSms('')).toBeNull();
    expect(otpFromSms(undefined as unknown as string)).toBeNull();
  });

  it('ignores digits embedded in a longer number', () => {
    // A law reference is not a code - "300/2008" must not become "2008" plus a shrug.
    expect(otpFromSms('podle zakona c. 300/2008 Sb. neni zadny kod')).toBeNull();
  });

  it('reads another sender’s code too - deciding WHOSE message this is is not its job', () => {
    // Worth being explicit about, because it looks like a gap and is not. The consent prompt names
    // the sender and the user is the one who taps yes; by the time text reaches this function, they
    // have already decided. A second filter here ("only messages mentioning ISDS") would break the
    // moment Česká pošta rewords the SMS, and would protect nobody who had not already consented.
    expect(otpFromSms('Vas overovaci kod: 654321')).toBe('654321');
    // The cue still does its work: a reference number alongside a cued code does not create doubt.
    expect(otpFromSms('Platba 4500 Kc, kod 654321, ref 987654')).toBe('654321');
  });

  it('offers nothing when nothing is cued and the numbers disagree', () => {
    expect(otpFromSms('Zprava 20260819 doruc. 987654 uzavreno')).toBeNull();
  });

  it('accepts the same code repeated, which is not ambiguity', () => {
    expect(otpFromSms('Kod 35124603. Zadejte kod 35124603 do aplikace.')).toBe(
      '35124603',
    );
  });
});
