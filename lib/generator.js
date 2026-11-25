'use strict';

/**
 * SOSUKE Checker — local handle generator.
 * Built by sosuke.
 */

const { randomInt } = require('node:crypto');

const MODE_IDS = [
  'smart4',
  'letters4',
  'alnum4',
  'pronounceable4',
  'letters3',
  'gaming',
  'leet',
  'custom',
];

const VOWELS = 'aeiou';
const CONSONANTS = 'bcdfghjklmnpqrstvwxyz';
const RARE_CONSONANTS = 'zqvxjkwy';
const CLEAN_CONSONANTS = 'bdfgklmnprstvz';

const DIGITS = '0123456789';

const END_TAGS = ['gg', 'hq', 'tv', 'ez', 'op', 'xo', 'exe', 'pro', 'god', 'ace'];
const PREFIX_TAGS = ['the', 'its', 'go', 'im', 'yo'];

const GAMING_BASES = [
  'frag',
  'clutch',
  'ace',
  'noob',
  'smurf',
  'meta',
  'buff',
  'nerf',
  'squad',
  'clan',
  'pwn',
  'rush',
  'camp',
  'spawn',
  'respawn',
  'combo',
  'loadout',
  'pixel',
  'lag',
  'ping',
  'boss',
  'raid',
  'loot',
  'crit',
  'tank',
  'healer',
  'solo',
  'duo',
  'trio',
  'esports',
  'pro',
  'tryhard',
  'sweat',
  'carry',
  'tilt',
  'gank',
  'mid',
  'jungle',
  'adc',
  'support',
  'ggwp',
  'wp',
  'streak',
  'snipe',
  'headshot',
  'revive',
  'aggro',
  'dps',
  'speedrun',
];

const OG_WORDS = [
  'hack',
  'nova',
  'zero',
  'cyber',
  'neon',
  'phantom',
  'shadow',
  'ghost',
  'blaze',
  'frost',
  'storm',
  'venom',
  'pulse',
  'vortex',
  'matrix',
  'rogue',
  'sniper',
  'legend',
  'king',
  'queen',
  'ace',
  'wolf',
  'raven',
  'onyx',
  'echo',
  'byte',
  'code',
  'pixel',
  'turbo',
  'nitro',
  'alpha',
  'omega',
  'cipher',
  'glitch',
  'raider',
  'hunter',
  'wizard',
  'knight',
  'samurai',
  'ronin',
  'titan',
  'viper',
  'cobra',
  'falcon',
  'dragon',
  'demon',
  'angel',
  'saint',
  'rebel',
  'outlaw',
  'nomad',
  'aura',
  'karma',
  'chaos',
  'cosmos',
  'orbit',
  'solar',
  'lunar',
  'astro',
  'quasar',
  'zenith',
  'apex',
  'prime',
  'elite',
  'master',
  'hyper',
  'specter',
  'wraith',
  'blade',
  'ember',
  'drift',
  'flash',
  'guard',
  'haze',
  'jolt',
  'krypt',
  'lucid',
  'mirage',
  'noble',
  'quest',
  'rune',
  'shift',
  'trace',
  'ultra',
  'volt',
  'wild',
  'xeno',
  'yield',
  'zone',
];

const LEET = {
  a: '4',
  b: '8',
  e: '3',
  g: '9',
  i: '1',
  o: '0',
  s: '5',
  t: '7',
  z: '2',
};

const BLOCKED_EXACT = new Set([
  'ass',
  'anal',
  'anus',
  'cum',
  'cock',
  'dick',
  'fag',
  'fuk',
  'gay',
  'jizz',
  'kkk',
  'nig',
  'nazi',
  'pedo',
  'porn',
  'rape',
  'sex',
  'shit',
  'slut',
  'tits',
  'twat',
  'wank',
  'whore',
  'rape',
  'cunt',
  'fuck',
  'goon',
  'simp',
]);

const BLOCKED_PARTS = [
  'nigg',
  'fagg',
  'hitl',
  '1488',
  'pedo',
  'incest',
  'porn',
  'nazi',
  'rape',
  'slut',
  'whore',
  'cunt',
  'fuks',
  'fuk',
];

// Smart 4C should skip everyday words so the batch stays genuinely rare.
const COMMON_WORDS = new Set([
  'able',
  'acid',
  'aged',
  'also',
  'area',
  'army',
  'away',
  'baby',
  'back',
  'ball',
  'band',
  'bank',
  'base',
  'bath',
  'bear',
  'beat',
  'been',
  'beer',
  'bell',
  'best',
  'bike',
  'bird',
  'blue',
  'boat',
  'body',
  'bomb',
  'bond',
  'bone',
  'book',
  'boom',
  'boot',
  'born',
  'boss',
  'both',
  'bowl',
  'bulk',
  'burn',
  'bush',
  'busy',
  'cake',
  'call',
  'calm',
  'came',
  'camp',
  'card',
  'care',
  'case',
  'cash',
  'cast',
  'cell',
  'chat',
  'chip',
  'city',
  'club',
  'coal',
  'coat',
  'code',
  'cold',
  'come',
  'cook',
  'cool',
  'cope',
  'copy',
  'core',
  'cost',
  'crew',
  'crop',
  'dark',
  'data',
  'date',
  'dawn',
  'days',
  'dead',
  'deal',
  'dear',
  'death',
  'debt',
  'deep',
  'deny',
  'desk',
  'dial',
  'diet',
  'disc',
  'does',
  'done',
  'door',
  'dose',
  'down',
  'draw',
  'drew',
  'drop',
  'drum',
  'dual',
  'dust',
  'duty',
  'each',
  'earn',
  'ease',
  'east',
  'easy',
  'edge',
  'else',
  'even',
  'ever',
  'evil',
  'exit',
  'face',
  'fact',
  'fail',
  'fair',
  'fall',
  'farm',
  'fast',
  'fate',
  'fear',
  'feed',
  'feel',
  'feet',
  'fell',
  'felt',
  'file',
  'fill',
  'film',
  'find',
  'fine',
  'fire',
  'firm',
  'fish',
  'five',
  'flat',
  'flow',
  'food',
  'foot',
  'ford',
  'form',
  'fort',
  'four',
  'free',
  'from',
  'fuel',
  'full',
  'fund',
  'gain',
  'game',
  'gate',
  'gave',
  'gear',
  'gene',
  'gift',
  'girl',
  'give',
  'glad',
  'goal',
  'goes',
  'gold',
  'golf',
  'gone',
  'good',
  'gray',
  'grew',
  'grey',
  'grow',
  'gulf',
  'hair',
  'half',
  'hall',
  'hand',
  'hang',
  'hard',
  'harm',
  'hate',
  'have',
  'head',
  'hear',
  'heat',
  'held',
  'hell',
  'help',
  'here',
  'hero',
  'high',
  'hill',
  'hire',
  'hold',
  'hole',
  'holy',
  'home',
  'hope',
  'host',
  'hour',
  'huge',
  'hung',
  'hunt',
  'hurt',
  'idea',
  'inch',
  'into',
  'iron',
  'item',
  'jack',
  'jane',
  'jean',
  'john',
  'join',
  'jump',
  'jury',
  'just',
  'keen',
  'keep',
  'kent',
  'kept',
  'kick',
  'kill',
  'kind',
  'king',
  'knee',
  'knew',
  'know',
  'lack',
  'lady',
  'laid',
  'lake',
  'land',
  'lane',
  'last',
  'late',
  'lead',
  'left',
  'less',
  'life',
  'lift',
  'like',
  'line',
  'link',
  'list',
  'live',
  'load',
  'loan',
  'lock',
  'long',
  'look',
  'loss',
  'lost',
  'love',
  'luck',
  'made',
  'mail',
  'main',
  'make',
  'male',
  'many',
  'mark',
  'mass',
  'matt',
  'meal',
  'mean',
  'meat',
  'meet',
  'menu',
  'mere',
  'mike',
  'mile',
  'milk',
  'mill',
  'mind',
  'mine',
  'miss',
  'mode',
  'mood',
  'moon',
  'more',
  'most',
  'move',
  'much',
  'must',
  'name',
  'navy',
  'near',
  'neck',
  'need',
  'news',
  'next',
  'nice',
  'nick',
  'nine',
  'none',
  'nose',
  'note',
  'okay',
  'once',
  'only',
  'onto',
  'open',
  'oral',
  'over',
  'pace',
  'pack',
  'page',
  'paid',
  'pain',
  'pair',
  'palm',
  'park',
  'part',
  'pass',
  'past',
  'path',
  'peak',
  'pick',
  'pink',
  'pipe',
  'plan',
  'play',
  'plot',
  'plug',
  'plus',
  'poem',
  'poet',
  'pole',
  'poll',
  'pool',
  'poor',
  'port',
  'post',
  'pull',
  'pure',
  'push',
  'race',
  'rail',
  'rain',
  'rank',
  'rare',
  'rate',
  'read',
  'real',
  'rear',
  'rely',
  'rent',
  'rest',
  'rice',
  'rich',
  'ride',
  'ring',
  'rise',
  'risk',
  'road',
  'rock',
  'role',
  'roll',
  'roof',
  'room',
  'root',
  'rose',
  'rule',
  'rush',
  'safe',
  'said',
  'sale',
  'salt',
  'same',
  'sand',
  'sane',
  'save',
  'seat',
  'seed',
  'seek',
  'seem',
  'seen',
  'self',
  'sell',
  'send',
  'sent',
  'sept',
  'ship',
  'shop',
  'shot',
  'show',
  'shut',
  'sick',
  'side',
  'sign',
  'silk',
  'sing',
  'sink',
  'site',
  'size',
  'skin',
  'slip',
  'slow',
  'snow',
  'soft',
  'soil',
  'sold',
  'sole',
  'solo',
  'some',
  'song',
  'soon',
  'sort',
  'soul',
  'spot',
  'star',
  'stay',
  'step',
  'stop',
  'such',
  'suit',
  'sure',
  'take',
  'tale',
  'talk',
  'tall',
  'tank',
  'tape',
  'task',
  'team',
  'tech',
  'tell',
  'tend',
  'term',
  'test',
  'than',
  'that',
  'them',
  'then',
  'they',
  'thin',
  'this',
  'thus',
  'till',
  'time',
  'tiny',
  'told',
  'toll',
  'tone',
  'took',
  'tool',
  'tops',
  'tour',
  'town',
  'tree',
  'trip',
  'true',
  'tube',
  'turn',
  'twin',
  'type',
  'unit',
  'upon',
  'used',
  'user',
  'vary',
  'vast',
  'very',
  'vice',
  'view',
  'vote',
  'wage',
  'wait',
  'wake',
  'walk',
  'wall',
  'want',
  'ward',
  'warm',
  'warn',
  'wash',
  'wave',
  'ways',
  'weak',
  'wear',
  'week',
  'well',
  'went',
  'were',
  'west',
  'what',
  'when',
  'whom',
  'wide',
  'wife',
  'wild',
  'will',
  'wind',
  'wine',
  'wing',
  'wire',
  'wise',
  'wish',
  'with',
  'wood',
  'word',
  'wore',
  'work',
  'yard',
  'yeah',
  'year',
  'your',
  'zero',
  'zone',
]);

function rand(max) {
  return randomInt(max);
}

function pick(list) {
  return list[rand(list.length)];
}

function chance(probability) {
  return randomInt(1_000_000) < probability * 1_000_000;
}

function digits(length = 1) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += DIGITS[rand(DIGITS.length)];
  return out;
}

function letters(length, alphabet = 'abcdefghijklmnopqrstuvwxyz') {
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[rand(alphabet.length)];
  return out;
}

function cvcv(consonants = CLEAN_CONSONANTS) {
  return (
    consonants[rand(consonants.length)] +
    VOWELS[rand(VOWELS.length)] +
    consonants[rand(consonants.length)] +
    VOWELS[rand(VOWELS.length)]
  );
}

function smart4() {
  const roll = rand(100);
  const onset = 'zvjkqx';
  const coda = 'zxkvj';

  if (roll < 72) {
    // Pronounceable CVCV with exactly one uncommon consonant: zuro, qiva, vexo.
    if (rand(100) < 62) {
      return (
        onset[rand(onset.length)] +
        VOWELS[rand(VOWELS.length)] +
        CLEAN_CONSONANTS[rand(CLEAN_CONSONANTS.length)] +
        VOWELS[rand(VOWELS.length)]
      );
    }
    return (
      CLEAN_CONSONANTS[rand(CLEAN_CONSONANTS.length)] +
      VOWELS[rand(VOWELS.length)] +
      coda[rand(coda.length)] +
      VOWELS[rand(VOWELS.length)]
    );
  }

  if (roll < 90) {
    // CCVC with a clean, readable onset: zrax, vrok, klyx.
    const blend = ['zr', 'vr', 'kr', 'zv', 'kv', 'sk', 'sl', 'dr'];
    return (
      blend[rand(blend.length)] +
      VOWELS[rand(VOWELS.length)] +
      coda[rand(coda.length)]
    );
  }

  // CVCC: zurk, vint, qelk.
  return (
    onset[rand(onset.length)] +
    VOWELS[rand(VOWELS.length)] +
    CLEAN_CONSONANTS[rand(CLEAN_CONSONANTS.length)] +
    coda[rand(coda.length)]
  );
}

function letters4() {
  return letters(4);
}

function alnum4() {
  let out = '';
  do {
    out = letters(4, 'abcdefghijklmnopqrstuvwxyz' + DIGITS);
  } while (!/[a-z]/.test(out) || !/[0-9]/.test(out) || !/^[a-z]/.test(out));
  return out;
}

function pronounceable4() {
  return cvcv();
}

function letters3() {
  return letters(3);
}

function leetify(word, swaps = 1) {
  const positions = [];
  for (let i = 0; i < word.length; i += 1) {
    if (LEET[word[i]]) positions.push(i);
  }
  if (!positions.length) return word;

  let out = word;
  let remaining = Math.min(swaps, positions.length);
  const pool = positions.slice();

  while (remaining > 0 && pool.length) {
    const index = pool.splice(rand(pool.length), 1)[0];
    out = `${out.slice(0, index)}${LEET[out[index]]}${out.slice(index + 1)}`;
    remaining -= 1;
  }
  return out;
}

function gaming() {
  const base = pick(GAMING_BASES);
  const roll = rand(100);

  if (roll < 42) return base;
  if (roll < 62) return base + digits(rand(100) < 60 ? 2 : 1);
  if (roll < 80) return base + pick(END_TAGS);
  if (roll < 90) return pick(PREFIX_TAGS) + base;
  return leetify(base, 1);
}

function leet() {
  const base = pick(OG_WORDS);
  const swaps = rand(100) < 25 ? 2 : 1;
  const variant = leetify(base, swaps);
  if (variant === base) return base + pick(END_TAGS);
  return chance(0.16) ? variant + digits(1) : variant;
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 25);
}

function leetNormalize(value) {
  return value
    .toLowerCase()
    .replace(/4/g, 'a')
    .replace(/8/g, 'b')
    .replace(/3/g, 'e')
    .replace(/9/g, 'g')
    .replace(/1/g, 'i')
    .replace(/0/g, 'o')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/2/g, 'z');
}

function isSafe(value) {
  const lower = value.toLowerCase();
  const plain = leetNormalize(lower);

  if (BLOCKED_EXACT.has(lower) || BLOCKED_EXACT.has(plain)) return false;
  for (const part of BLOCKED_PARTS) {
    if (lower.includes(part) || plain.includes(part)) return false;
  }
  return true;
}

function isValid(value) {
  return /^[A-Za-z0-9_-]{3,25}$/.test(value);
}

function customBases(seed) {
  const pieces = String(seed || '')
    .split(/[\s,;|]+/)
    .map(normalizeName)
    .filter(Boolean);
  return Array.from(new Set(pieces));
}

function custom(seed) {
  return customBases(seed);
}

function makeOne(mode) {
  switch (mode) {
    case 'smart4':
      return smart4();
    case 'letters4':
      return letters4();
    case 'alnum4':
      return alnum4();
    case 'pronounceable4':
      return pronounceable4();
    case 'letters3':
      return letters3();
    case 'gaming':
      return gaming();
    case 'leet':
      return leet();
    default:
      return '';
  }
}

function rarityFor(name, mode) {
  if (mode === 'letters3') return 'ULTRA RARE';
  if (mode === 'gaming') return 'CULT';
  if (mode === 'leet') return 'OG';
  if (mode === 'custom') return 'MANUAL';
  if (mode === 'smart4') return 'RARE+';
  if (name.length <= 4) return 'RARE';
  return 'SCARCE';
}

function clampCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 12;
  return Math.min(100, Math.max(1, parsed));
}

/**
 * Generate candidate handles.
 * @param {{mode?: string, count?: number, seed?: string, exclude?: string[]}} [payload]
 */
function generateNames(payload = {}) {
  const mode = MODE_IDS.includes(payload.mode) ? payload.mode : 'smart4';
  const count = clampCount(payload.count);
  const exclude = Array.isArray(payload.exclude) ? payload.exclude.slice(0, 600) : [];
  const used = new Set(
    exclude.map((item) => normalizeName(item).toLowerCase()).filter(Boolean)
  );

  const names = [];
  let index = 0;

  if (mode === 'custom') {
    const bases = custom(payload.seed);
    if (!bases.length) {
      return {
        mode,
        names: [],
        requested: count,
        warning: 'Type at least one base word.',
      };
    }

    const queue = [];
    for (const base of bases) {
      queue.push(base);
      queue.push(leetify(base, 1));
      queue.push(base + digits(1));
      queue.push(base + pick(END_TAGS));
    }

    while (index < queue.length && names.length < count) {
      const name = normalizeName(queue[index]);
      index += 1;
      if (!name || !isValid(name) || !isSafe(name)) continue;
      const key = name.toLowerCase();
      if (used.has(key)) continue;
      used.add(key);
      names.push({
        name,
        mode,
        rarity: rarityFor(name, mode),
      });
    }

    return { mode, names, requested: count };
  }

  const maxAttempts = count * 500 + 1000;
  let attempts = 0;

  while (names.length < count && attempts < maxAttempts) {
    attempts += 1;
    const name = normalizeName(makeOne(mode));
    if (!name || !isValid(name) || !isSafe(name)) continue;
    if (mode === 'smart4') {
      if (!/[zqvxjkwyf]/.test(name.toLowerCase())) continue;
      if (COMMON_WORDS.has(name.toLowerCase())) continue;
    }
    const key = name.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    names.push({
      name,
      mode,
      rarity: rarityFor(name, mode),
    });
  }

  return {
    mode,
    names,
    requested: count,
    exhausted: names.length < count,
  };
}

module.exports = {
  MODE_IDS,
  generateNames,
  normalizeName,
  isSafe,
  leetify,
};
