// The phrase one phone shows and the other one types (025 T010).
//
// This is the whole security of a transfer. The channel is PAKE-authenticated from this phrase and
// nothing else, and what travels over it is the sealed archive AND the recovery key that opens it -
// so the phrase is, for the length of one transfer, as valuable as the archive.
//
// GENERATED HERE, not taken from croc's default, and that is the point of FR-010. croc's own phrase
// is tuned for somebody typing into a terminal on a laptop they are already sitting at. This one is
// read off a screen and typed into a phone across a table, once, by a person who has just lost a
// phone - which is a different trade-off, and not one to inherit by accident.
//
// WHY A SHORT PHRASE IS SAFE HERE, when a short password never is. PAKE gives an attacker exactly
// ONE online guess per attempt: there is no transcript to take away and grind offline, and a wrong
// guess is a failed handshake somebody notices. So the question is not "how long to survive a GPU
// farm" but "how long to survive the number of guesses an attacker can actually make against a
// rendezvous that exists for a minute or two". That is a much smaller number, and it is why the
// design can afford to be readable.
//
// The words come from the ACTIVE LOCALE's list, because a phrase is read aloud or copied across a
// table and has to be in the language of the person doing the reading. Czech words in an English app
// are a string of noise to be transcribed letter by letter, which is the friction this whole feature
// exists to remove. Both lists follow the same rules: ordinary nouns, ASCII, no diacritics, all
// distinct in their first four letters.
//
// PARSING ACCEPTS EITHER LIST, and must. The two phones can be set to different languages - somebody
// helping a relative, a phone restored from a different setup - and a phrase generated on one has to
// be typeable into the other. Nothing decodes a word back to an index: the phrase is passed to the
// transport as the literal string it is, so accepting a wider set costs no entropy at all.

import { getActiveLocale } from '../../i18n/strings';

/** No I, L, O or U - the four that get miscopied. Same alphabet as the recovery key, same reason. */
const DIGITS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * The Czech list. 256 words, so one CSPRNG byte picks one with no modulo bias.
 *
 * Chosen for reading aloud: nothing that sounds like anything else on the list, nothing that changes
 * meaning with a diacritic, nothing embarrassing to say out loud in an office.
 */
export const WORDS_CS: readonly string[] = [
  'ananas', 'anglie', 'antena', 'arkada', 'atlas', 'autor', 'azurit', 'babicka',
  'balada', 'balkon', 'banan', 'barva', 'baterie', 'bavlna', 'bazen', 'berla',
  'beton', 'bizon', 'blecha', 'bobule', 'bochnik', 'bota', 'brambora', 'brana',
  'brepta', 'briza', 'brokolice', 'bublina', 'budova', 'bunda', 'burza', 'buvol',
  'cedule', 'cement', 'cesta', 'chalupa', 'chleba', 'chmel', 'chodba', 'cibule',
  'cihla', 'cirkus', 'citron', 'clovek', 'cukr', 'datel', 'delfin', 'deska',
  'destnik', 'diamant', 'divadlo', 'dlazba', 'doktor', 'dopis', 'dratek', 'drevo',
  'dudy', 'duha', 'dvere', 'dyne', 'expedice', 'fabrika', 'fazole', 'fialka',
  'figura', 'flauta', 'fontana', 'formule', 'fotka', 'garaz', 'gepard', 'globus',
  'gulas', 'hadice', 'halenka', 'harfa', 'hasic', 'hejno', 'herec', 'hlemyzd',
  'hnizdo', 'hodiny', 'holub', 'hora', 'hotel', 'houba', 'hrabe', 'hrad',
  'hranice', 'hrnek', 'hruska', 'husa', 'hvezda', 'jablko', 'jahoda', 'jantar',
  'jazyk', 'jedle', 'jehla', 'jelen', 'jeskyne', 'jezek', 'jidlo', 'kabat',
  'kachna', 'kalendar', 'kamen', 'kanoe', 'kapela', 'kapr', 'kaput', 'karta',
  'kasna', 'katedra', 'kavarna', 'kbelik', 'keramika', 'kladivo', 'klavir', 'klobouk',
  'knedlik', 'kniha', 'kobliha', 'kocka', 'kolo', 'komin', 'konev', 'kopec',
  'koral', 'kosmos', 'kostka', 'kotva', 'koza', 'kravata', 'krecek', 'kridlo',
  'krtek', 'kruh', 'kuchar', 'kufr', 'kuze', 'kvetina', 'labut', 'lampa',
  'lano', 'lavice', 'ledvina', 'legenda', 'lekar', 'letadlo', 'liska', 'listek',
  'loket', 'lopata', 'louka', 'lyze', 'macecha', 'magnet', 'majak', 'malina',
  'mandle', 'mapa', 'maska', 'medved', 'melodie', 'mesic', 'mest', 'mince',
  'mlyn', 'modrina', 'motyl', 'mrakodrap', 'mravenec', 'mrkev', 'muzeum', 'nadraz',
  'nahrdelnik', 'napoj', 'narez', 'navrat', 'nebe', 'nehet', 'nudle', 'obchod',
  'oblak', 'obraz', 'ocas', 'ohen', 'okno', 'olej', 'opice', 'orel',
  'ostrov', 'otazka', 'ovoce', 'palec', 'panev', 'papir', 'paprika', 'parek',
  'pastelka', 'pavouk', 'pecivo', 'pero', 'pes', 'pila', 'pirat', 'pistole',
  'pivo', 'placka', 'plamen', 'plot', 'pohar', 'pokoj', 'police', 'polstar',
  'pomeranc', 'pondeli', 'potok', 'prase', 'pravitko', 'prsten', 'pstruh', 'pytel',
  'rada', 'raketa', 'rameno', 'rebrik', 'recept', 'redkev', 'reka', 'rezanky',
  'rocnik', 'rohlik', 'rostlina', 'rukavice', 'ryba', 'rytir', 'sadra', 'salam',
  'sanice', 'sedlo', 'sekera', 'semafor', 'sesit', 'silnice', 'sirka', 'skala',
  'sklep', 'skrin', 'slanina', 'slunce', 'smetana', 'snih', 'sova', 'srdce',
];

/**
 * The English list, under exactly the same rules.
 *
 * A phrase is read aloud or copied across a table, so it has to be in the language of the person
 * doing the reading - Czech words in an English app are a string of noise somebody has to transcribe
 * letter by letter, which is the friction this whole feature exists to remove.
 */
export const WORDS_EN: readonly string[] = [
  'anchor', 'anvil', 'apple', 'apron', 'arrow', 'attic', 'avenue', 'bacon',
  'badge', 'bagel', 'balcony', 'ballot', 'bamboo', 'banjo', 'barrel', 'basket',
  'batch', 'beacon', 'beaker', 'beetle', 'bellow', 'bench', 'berry', 'bicycle',
  'biscuit', 'bishop', 'blanket', 'blossom', 'bobbin', 'bonnet', 'bottle', 'boulder',
  'bracket', 'branch', 'bridge', 'bronze', 'brush', 'bubble', 'bucket', 'buffalo',
  'bugle', 'bundle', 'burrow', 'butter', 'cabin', 'cactus', 'camera', 'candle',
  'canvas', 'canyon', 'carpet', 'carrot', 'castle', 'cattle', 'cavern', 'cedar',
  'cellar', 'cement', 'chapel', 'cheese', 'cherry', 'chimney', 'chisel', 'cinder',
  'circus', 'clover', 'cluster', 'cobweb', 'cocoa', 'collar', 'comet', 'compass',
  'copper', 'coral', 'cotton', 'cradle', 'crater', 'crayon', 'cricket', 'crown',
  'crystal', 'cushion', 'cymbal', 'dagger', 'daisy', 'dancer', 'dawn', 'desert',
  'diamond', 'dinner', 'dolphin', 'domino', 'donkey', 'dragon', 'drawer', 'drum',
  'dungeon', 'eagle', 'easel', 'edge', 'elbow', 'ember', 'engine', 'envelope',
  'fabric', 'falcon', 'fancy', 'farmer', 'feather', 'fence', 'fern', 'fiddle',
  'figure', 'filter', 'finger', 'flag', 'flame', 'flask', 'flint', 'flower',
  'flute', 'forest', 'fossil', 'fountain', 'fox', 'frame', 'freckle', 'frost',
  'funnel', 'galaxy', 'garden', 'garlic', 'gateway', 'gecko', 'ginger', 'glacier',
  'glass', 'glove', 'granite', 'grape', 'gravel', 'grotto', 'guitar', 'gully',
  'hamlet', 'hammer', 'hanger', 'harbour', 'hazel', 'heather', 'hedge', 'helmet',
  'herald', 'hickory', 'hollow', 'honey', 'hornet', 'hostel', 'hourglass', 'hunter',
  'igloo', 'index', 'ink', 'iris', 'ivory', 'jacket', 'jasmine', 'jelly',
  'jersey', 'jewel', 'jigsaw', 'jungle', 'kayak', 'kennel', 'kettle', 'keyboard',
  'kitten', 'knuckle', 'ladder', 'lagoon', 'lamb', 'lantern', 'lattice', 'lava',
  'ledge', 'lemon', 'lentil', 'lettuce', 'library', 'lilac', 'linen', 'lizard',
  'lobster', 'locker', 'lotus', 'lumber', 'lyric', 'magnet', 'mallet', 'mango',
  'maple', 'marble', 'marsh', 'meadow', 'melon', 'mentor', 'mirror', 'mitten',
  'monkey', 'mosaic', 'moss', 'mountain', 'muffin', 'mushroom', 'mustard', 'nectar',
  'needle', 'nest', 'nickel', 'noodle', 'notebook', 'nozzle', 'oatmeal', 'ocean',
  'olive', 'onion', 'opal', 'orbit', 'orchard', 'organ', 'otter', 'outlet',
  'oyster', 'paddle', 'pagoda', 'palace', 'pancake', 'panther', 'parcel', 'parsley',
  'pasture', 'peach', 'pebble', 'pelican', 'pencil', 'pepper', 'petal', 'pewter',
  'pigeon', 'pillar', 'pirate', 'pistol', 'planet', 'plaster', 'plum', 'pocket',
];

/** Generation draws from the ACTIVE locale; parsing accepts either (see `parseCodePhrase`). */
export const WORDS_BY_LOCALE: Record<string, readonly string[]> = {
  cs: WORDS_CS,
  en: WORDS_EN,
};

/** How many words the phrase carries. */
export const PHRASE_WORDS = 4;
/**
 * A leading number, so two transfers running in the same room cannot collide on the same rendezvous
 * and so the phrase LOOKS like a code rather than a sentence somebody might paraphrase.
 */
export const PHRASE_DIGITS = 4;

/**
 * The entropy this phrase carries, written down rather than left to be inferred.
 *
 * 4 words from 256 = 32 bits, plus 4 symbols from a 32-character alphabet = 20 bits. **52 bits.**
 *
 * Against an OFFLINE attack that would be poor, and it is meant to be: PAKE does not leak a
 * transcript to attack offline. Against the online attack that is actually available - one guess per
 * handshake, against a rendezvous open for a minute or two - 52 bits is many orders of magnitude
 * more than anybody can spend. The number is here so that a future change which shortens the phrase
 * has to argue with it.
 */
export const PHRASE_ENTROPY_BITS = 52;

export class CodePhraseError extends Error {}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/**
 * A new phrase: `7K2M-ryba-kotva-duha-lampa`.
 *
 * The digits lead because that is the part the eye uses to tell two phrases apart, and the words
 * follow because they are the part a person can say out loud without spelling.
 */
export function generateCodePhrase(): string {
  // 256 words and a 32-symbol alphabet both divide 256, so every byte maps with no modulo bias -
  // the same property `recoveryKey.ts` relies on, and the reason each list is exactly 256 long.
  const list = WORDS_BY_LOCALE[getActiveLocale()] ?? WORDS_CS;
  const digitBytes = randomBytes(PHRASE_DIGITS);
  const wordBytes = randomBytes(PHRASE_WORDS);
  const digits = Array.from(digitBytes, b => DIGITS[b % DIGITS.length]).join('');
  const words = Array.from(wordBytes, b => list[b % list.length]);
  return [digits, ...words].join('-');
}

/**
 * Read a phrase back the way somebody actually typed it.
 *
 * Forgiving on purpose, and for the same reason `parseRecoveryKey` is: the phrase is proved by
 * whether the handshake succeeds, so refusing a capital letter or a stray space up front only means
 * refusing to try. What it will NOT do is guess at a word that is not on the list - a near-miss
 * silently corrected is how somebody ends up connected to a stranger's phone.
 */
export function parseCodePhrase(input: string): string | null {
  const parts = input
    .trim()
    .toLowerCase()
    // Spaces, dashes and the comma somebody adds when reading aloud all separate.
    .split(/[\s,._-]+/)
    .filter(Boolean);
  if (parts.length !== PHRASE_WORDS + 1) {
    return null;
  }
  const digits = parts[0]
    .toUpperCase()
    // The substitutions people make reading their own handwriting, as in `recoveryKey.ts`.
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
  if (digits.length !== PHRASE_DIGITS) {
    return null;
  }
  for (const c of digits) {
    if (!DIGITS.includes(c)) {
      return null;
    }
  }
  const words = parts.slice(1);
  for (const w of words) {
    // Either list. The phones may be set to different languages, and a phrase is a string passed
    // straight to the transport - nothing here decodes a word back to an index.
    if (!WORDS_CS.includes(w) && !WORDS_EN.includes(w)) {
      return null;
    }
  }
  return [digits, ...words].join('-');
}

/** What the transport is handed. The phrase IS the shared secret; there is nothing else. */
export const sharedSecretOf = (phrase: string): string => phrase;
