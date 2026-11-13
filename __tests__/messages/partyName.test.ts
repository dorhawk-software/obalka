// A party's name, its legal form split off (031, the owner 2026-11-13): the name leads, the form waits
// on a quieter line. Seen on the owner's test box: the sent envelope's sender ran three lines,
// "Jan Novák / - podnikající / fyzická osoba".

import { partyName } from '../../src/features/messages/state/partyName';

describe('partyName', () => {
  it('splits the self-employed suffix ISDS appends, whatever the dash', () => {
    expect(partyName('Jan Novák - podnikající fyzická osoba')).toEqual({ name: 'Jan Novák', form: 'PFO' });
    expect(partyName('Jana Nováková – Podnikající fyzická osoba')).toEqual({ name: 'Jana Nováková', form: 'PFO' });
  });

  it('leaves a name with a dash of its own whole', () => {
    expect(partyName('Jana Nováková - Dvořáková')).toEqual({ name: 'Jana Nováková - Dvořáková', form: null });
    expect(partyName('Finanční úřad pro hlavní město Prahu')).toEqual({
      name: 'Finanční úřad pro hlavní město Prahu',
      form: null,
    });
  });

  it('is empty for no name', () => {
    expect(partyName(null)).toEqual({ name: '', form: null });
  });
});
