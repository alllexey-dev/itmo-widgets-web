// Invented values that more than one page shows as examples (`ExampleMark`): the same placeholder
// figure has the same value on Главная and in Статистика. They hold the place of data Backend does
// not give yet and are never read from the API.

/** The share of 5xx answers of Backend over 7 days, in percent, and its change in percentage points. */
export const EXAMPLE_SERVER_ERRORS = { share: 0.4, change: -0.2 } as const;

/** Sport sign-ups made through Backend in 7 days, and their change against the week before, in percent. */
export const EXAMPLE_SPORT_SIGNUPS = { count: 86, change: -3 } as const;
