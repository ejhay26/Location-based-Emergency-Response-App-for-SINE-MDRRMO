import { parseServerDate } from '../pipes/utc-date.pipe';

/**
 * Shared date-filter contract used by the admin dashboard's list panels
 * (Analytics, Log Archive, Citizens, Dispatchers, ID Verifications).
 *
 * - 'single'   -> dates = [oneDay]
 * - 'multiple' -> dates = [day1, day2, ...] (individually selected, unordered days)
 * - 'range'    -> dates = [start, end] (inclusive, start <= end)
 *
 * All dates are local 'YYYY-MM-DD' keys (no time/timezone component), so
 * comparisons are plain string comparisons - zero-padded ISO date strings
 * sort lexicographically in the same order as chronologically.
 */
export type DateFilterMode = 'single' | 'multiple' | 'range';

export interface DateFilterValue {
  mode: DateFilterMode;
  dates: string[];
}

/** True when the filter carries no usable dates (defensive - should not normally occur). */
export function isEmptyDateFilter(filter: DateFilterValue | null | undefined): boolean {
  return !filter || filter.dates.length === 0;
}

/**
 * Converts a Date to a local 'YYYY-MM-DD' key using local calendar fields
 * (not UTC getters), matching how UtcDatePipe renders dates on-screen -
 * so "the record shown as Aug 3" is exactly what a filter of "Aug 3" matches.
 */
export function toLocalDateKey(date: Date): string {
  const year  = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day   = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks whether a backend timestamp (any format UtcDatePipe/parseServerDate
 * accepts) falls within the given date filter. A null/undefined/empty filter
 * always matches (i.e. "no filter applied").
 */
export function matchesDateFilter(value: string | number | Date | null | undefined, filter: DateFilterValue | null | undefined): boolean {
  if (isEmptyDateFilter(filter)) return true;

  const parsed = parseServerDate(value);
  if (!parsed) return false;
  const key = toLocalDateKey(parsed);

  if (filter!.mode === 'range') {
    const start = filter!.dates[0];
    const end = filter!.dates[1] ?? start;
    return key >= start && key <= end;
  }
  // 'single' and 'multiple' both reduce to "is this day one of the selected days".
  return filter!.dates.includes(key);
}

/** Formats a local 'YYYY-MM-DD' key as a short human-readable date (e.g. "Aug 3, 2026"). */
function formatDateKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return key;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Short label for the filter trigger button and for filter-summary chips. */
export function formatDateFilterLabel(filter: DateFilterValue | null | undefined): string {
  if (isEmptyDateFilter(filter)) return 'Select a Date';
  const { mode, dates } = filter!;
  if (mode === 'single') return formatDateKey(dates[0]);
  if (mode === 'range') return `${formatDateKey(dates[0])} - ${formatDateKey(dates[1] ?? dates[0])}`;
  return dates.length === 1 ? formatDateKey(dates[0]) : `${dates.length} dates selected`;
}
