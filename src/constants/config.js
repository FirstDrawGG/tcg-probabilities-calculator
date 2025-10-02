/**
 * Application configuration constants
 */

export const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
export const SIMULATION_COUNT = 100000;
export const CARD_SEARCH_DEBOUNCE = 300; // milliseconds
export const MAX_SEARCH_RESULTS = 50;

export const DEFAULT_DECK_SIZE = 40;
export const DEFAULT_HAND_SIZE = 5;

export const TYPOGRAPHY = {
  h1: { fontSize: 'var(--font-h1-size)', lineHeight: 'var(--font-h1-line-height)' },
  h2: { fontSize: 'var(--font-h2-size)', lineHeight: 'var(--font-h2-line-height)' },
  h3: { fontSize: 'var(--font-h3-size)', lineHeight: 'var(--font-h3-line-height)' },
  body: { fontSize: 'var(--font-body-size)', lineHeight: 'var(--font-body-line-height)' },
  small: { fontSize: 'var(--font-small-size)', lineHeight: 'var(--font-small-line-height)' }
};