/**
 * GeoSanitizer
 * Enforces the core architectural principle of "Interest":
 * Location (GPS, IP, country, city, coordinates, regional tags) must NEVER
 * be an input to feed ranking, recommendations, or content embeddings.
 *
 * This module strips geographic named entities, coordinates, postal patterns,
 * and geo-hashtags from text before feature extraction, vectorization,
 * or taxonomy matching.
 */

// Comprehensive dictionary of ISO countries, sovereign states, and common variants
export const GEO_COUNTRIES = [
  'afghanistan', 'albania', 'algeria', 'andorra', 'angola', 'argentina', 'armenia',
  'australia', 'austria', 'azerbaijan', 'bahamas', 'bahrain', 'bangladesh', 'barbados',
  'belarus', 'belgium', 'belize', 'benin', 'bhutan', 'bolivia', 'bosnia', 'botswana',
  'brazil', 'brunei', 'bulgaria', 'burkina faso', 'burundi', 'cambodia', 'cameroon',
  'canada', 'chad', 'chile', 'china', 'colombia', 'congo', 'costa rica', 'croatia',
  'cuba', 'cyprus', 'czech republic', 'czechia', 'denmark', 'dominican republic',
  'ecuador', 'egypt', 'el salvador', 'estonia', 'ethiopia', 'fiji', 'finland', 'france',
  'georgia', 'germany', 'ghana', 'greece', 'guatemala', 'honduras', 'hungary', 'iceland',
  'india', 'indonesia', 'iran', 'iraq', 'ireland', 'israel', 'italy', 'jamaica', 'japan',
  'jordan', 'kazakhstan', 'kenya', 'kuwait', 'latvia', 'lebanon', 'libya', 'lithuania',
  'luxembourg', 'madagascar', 'malaysia', 'maldives', 'mali', 'malta', 'mexico',
  'monaco', 'mongolia', 'morocco', 'nepal', 'netherlands', 'new zealand', 'nicaragua',
  'nigeria', 'norway', 'oman', 'pakistan', 'panama', 'paraguay', 'peru', 'philippines',
  'poland', 'portugal', 'qatar', 'romania', 'russia', 'saudi arabia', 'scotland',
  'senegal', 'serbia', 'singapore', 'slovakia', 'slovenia', 'somalia', 'south africa',
  'south korea', 'spain', 'sri lanka', 'sudan', 'sweden', 'switzerland', 'taiwan',
  'thailand', 'tunisia', 'turkey', 'turkiye', 'uganda', 'ukraine', 'united arab emirates',
  'uae', 'united kingdom', 'uk', 'united states', 'usa', 'us', 'america', 'uruguay',
  'uzbekistan', 'venezuela', 'vietnam', 'wales', 'yemen', 'zambia', 'zimbabwe',
];

// Major global metropolitan centers, tech/media hubs, and recognizable cities
export const GEO_MAJOR_CITIES = [
  'amsterdam', 'athens', 'auckland', 'austin', 'bangkok', 'barcelona', 'beijing',
  'berlin', 'boston', 'brussels', 'budapest', 'buenos aires', 'cairo', 'cape town',
  'chicago', 'copenhagen', 'dallas', 'delhi', 'denver', 'dubai', 'dublin', 'frankfurt',
  'hong kong', 'houston', 'istanbul', 'jakarta', 'johannesburg', 'kyiv', 'kuala lumpur',
  'lagos', 'lisbon', 'london', 'los angeles', 'madrid', 'manila', 'melbourne',
  'mexico city', 'miami', 'milan', 'montreal', 'moscow', 'mumbai', 'munich', 'nairobi',
  'new york', 'nyc', 'osaka', 'oslo', 'paris', 'philadelphia', 'phoenix', 'prague',
  'rio de janeiro', 'rome', 'san francisco', 'sf', 'sao paulo', 'seattle', 'seoul',
  'shanghai', 'singapore', 'stockholm', 'sydney', 'taipei', 'tel aviv', 'tokyo',
  'toronto', 'vancouver', 'vienna', 'warsaw', 'washington', 'zurich',
];

// Geo-proximity trigger phrases that attempt to localize content
export const GEO_PROXIMITY_PHRASES = [
  'near me', 'in my city', 'in my area', 'local to', 'around here',
  'downtown', 'suburbs', 'neighborhood', 'metro area',
];

// Coordinate pattern: e.g. "37.7749, -122.4194" or "37.77N 122.41W"
const COORD_REGEX = /[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)/gi;

// DMS Coordinate pattern: e.g. "40° 26' 46" N 79° 58' 56" W"
const DMS_COORD_REGEX = /\d{1,3}°\s*\d{1,2}['′]?\s*(\d{1,2}["″]?\s*)?[NSEW]/gi;

// Postal / Zip codes (e.g. "94103", "SW1A 1AA")
const POSTAL_REGEX = /\b\d{5}(-\d{4})?\b|\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;

/**
 * Strips all geographic entities, coordinates, country/city names,
 * and geo-hashtags from a text corpus before vector embedding generation.
 */
export function stripGeoEntities(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // 1. Strip exact GPS / coordinate numbers
  sanitized = sanitized.replace(COORD_REGEX, ' ');
  sanitized = sanitized.replace(DMS_COORD_REGEX, ' ');
  sanitized = sanitized.replace(POSTAL_REGEX, ' ');

  // 2. Strip proximity keywords
  for (const phrase of GEO_PROXIMITY_PHRASES) {
    const phraseRegex = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
    sanitized = sanitized.replace(phraseRegex, ' ');
  }

  // 3. Strip country names (words and hashtags like #japan, #france)
  for (const country of GEO_COUNTRIES) {
    const wordRegex = new RegExp(`(#${escapeRegExp(country)}\\w*|\\b${escapeRegExp(country)}\\b)`, 'gi');
    sanitized = sanitized.replace(wordRegex, ' ');
  }

  // 4. Strip city names (words and hashtags like #tokyo, #nyc, #TokyoCoffee)
  for (const city of GEO_MAJOR_CITIES) {
    const wordRegex = new RegExp(`(#${escapeRegExp(city)}\\w*|\\b${escapeRegExp(city)}\\b)`, 'gi');
    sanitized = sanitized.replace(wordRegex, ' ');
  }

  // 5. Clean up redundant whitespace and punctuation artifacts
  return sanitized
    .replace(/[^\w\s#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a string contains any location entity or coordinate.
 */
export function containsGeoEntity(text: string): boolean {
  if (!text) return false;

  if (COORD_REGEX.test(text) || DMS_COORD_REGEX.test(text) || POSTAL_REGEX.test(text)) {
    return true;
  }

  const lower = text.toLowerCase();
  for (const phrase of GEO_PROXIMITY_PHRASES) {
    if (new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i').test(lower)) return true;
  }

  for (const country of GEO_COUNTRIES) {
    if (new RegExp(`(#${escapeRegExp(country)}\\w*|\\b${escapeRegExp(country)}\\b)`, 'i').test(lower)) return true;
  }

  for (const city of GEO_MAJOR_CITIES) {
    if (new RegExp(`(#${escapeRegExp(city)}\\w*|\\b${escapeRegExp(city)}\\b)`, 'i').test(lower)) return true;
  }

  return false;
}

/**
 * Prepares caption text for recommendation ranking / embedding extraction
 * by ensuring complete geo-sterilization while preserving interest tokens.
 */
export function sanitizeCaptionForRanking(
  caption: string,
  title?: string,
  hashtags?: string[],
): {
  sanitizedCorpus: string;
  detectedGeoEntities: string[];
} {
  const rawParts = [title || '', caption || '', ...(hashtags || [])].join(' ');
  const detectedGeoEntities: string[] = [];

  const lower = rawParts.toLowerCase();
  for (const c of GEO_COUNTRIES) {
    if (new RegExp(`(#${escapeRegExp(c)}\\w*|\\b${escapeRegExp(c)}\\b)`, 'i').test(lower)) {
      detectedGeoEntities.push(c);
    }
  }
  for (const city of GEO_MAJOR_CITIES) {
    if (new RegExp(`(#${escapeRegExp(city)}\\w*|\\b${escapeRegExp(city)}\\b)`, 'i').test(lower)) {
      detectedGeoEntities.push(city);
    }
  }

  const sanitizedCorpus = stripGeoEntities(rawParts);

  return {
    sanitizedCorpus,
    detectedGeoEntities: Array.from(new Set(detectedGeoEntities)),
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const GeoSanitizer = {
  stripGeoEntities,
  containsGeoEntity,
  sanitizeCaptionForRanking,
  sanitizeSearchQuery: (query: string): string => {
    const stripped = stripGeoEntities(query);
    return stripped
      .replace(/\b(DROP|SELECT|INSERT|UPDATE|DELETE|ALTER|TRUNCATE|EXEC|UNION|CREATE|TABLE)\b/gi, '')
      .replace(/['";\-\-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },
  sanitizeCaption: (caption: string) => {
    const res = sanitizeCaptionForRanking(caption);
    return {
      sanitizedText: res.sanitizedCorpus,
      detectedGeoTokens: res.detectedGeoEntities,
    };
  },
};
