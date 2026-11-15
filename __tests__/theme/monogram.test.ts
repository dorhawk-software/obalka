// A monogram is the person's or the office's initials, not their degree (031 T050, the design review).
//
// "Ing. Ondřej Dvořák" was IO beside OD for the same person's other box; "JUDr. Jana Nová" would be JJ.

import { monogram } from '../../src/theme/avatarPalette';

it.each([
  ['Ing. Ondřej Dvořák', 'OD'],
  ['JUDr. Jana Nová', 'JN'],
  ['Mgr. et Mgr. Petr Malý', 'PM'],
  ['prof. Ing. Karel Novák, CSc.', 'KN'],
  ['MUDr. Eva Černá, Ph.D.', 'EČ'],
  ['Ing. arch. Tomáš Bílý', 'TB'],
  ['Petra Nová, MBA', 'PN'],
])('%s → %s', (name, initials) => {
  expect(monogram(name)).toBe(initials);
});

it.each([
  ['Ondřej Dvořák', 'OD'],
  ['Finanční úřad pro Středočeský kraj', 'FÚ'],
  ['Česká správa sociálního zabezpečení', 'ČS'],
  ['Dr Max s.r.o.', 'DM'],
  ['Ing.', 'IN'],
  ['', '?'],
])('leaves a name without a degree as it was: %s → %s', (name, initials) => {
  expect(monogram(name)).toBe(initials);
});
