/**
 * The owner's local calendar date.
 *
 * Ledger stores instants as ISO timestamps, but reporting periods and form
 * dates follow the calendar on the device displaying them. `toISOString()`
 * is UTC and can therefore advance the day and month during the local evening.
 */
export type LocalCalendar = Pick<Date, 'getFullYear' | 'getMonth' | 'getDate'>;

export const localDate = (now: LocalCalendar = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** YYYY-MM for the owner's local calendar month. */
export const localMonth = (now: LocalCalendar = new Date()): string => localDate(now).slice(0, 7);
