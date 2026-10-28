/**
 * Shared Validation Rules & Constants across Mobile, Web Admin, and API.
 */

export const VALIDATION_RULES = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 30,
    REGEX: /^[a-zA-Z0-9_]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
  },
  ONBOARDING_INTERESTS: {
    MIN: 5, // Pick at least 5 interests
    MAX: 15,
  },
  REEL: {
    MAX_DURATION_SECONDS: 60,
    MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100 MB
    ALLOWED_MIME_TYPES: ['video/mp4', 'video/quicktime'],
    TITLE_MAX_LENGTH: 150,
    CAPTION_MAX_LENGTH: 1000,
    MAX_SECONDARY_TAGS: 5,
  },
  COMMENT: {
    MAX_LENGTH: 1000,
    MAX_THREAD_DEPTH: 2, // 2-level comment hierarchy limit
  },
  VECTOR: {
    DIMENSION: 512,
  },
};

export function isValidUsername(username: string): boolean {
  return (
    username.length >= VALIDATION_RULES.USERNAME.MIN_LENGTH &&
    username.length <= VALIDATION_RULES.USERNAME.MAX_LENGTH &&
    VALIDATION_RULES.USERNAME.REGEX.test(username)
  );
}

export function isValidOnboardingSelection(interestIds: string[]): boolean {
  return (
    interestIds.length >= VALIDATION_RULES.ONBOARDING_INTERESTS.MIN &&
    interestIds.length <= VALIDATION_RULES.ONBOARDING_INTERESTS.MAX
  );
}
