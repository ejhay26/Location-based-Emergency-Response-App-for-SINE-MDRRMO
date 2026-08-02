import { Pipe, PipeTransform } from '@angular/core';
import { formatDate } from '@angular/common';

/**
 * Parses a backend timestamp, treating any string with no explicit timezone
 * marker (no trailing 'Z' and no '+hh:mm'/'-hh:mm' offset) as UTC — which is
 * what Laravel's APP_TIMEZONE=UTC actually produces for columns that aren't
 * Carbon-cast (e.g. 'request_time', or any $timestamps=false model's
 * 'created_at'). Strings that already carry a timezone marker (proper
 * Carbon::toJSON() output) are parsed as-is.
 */
export function parseServerDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return new Date(value);

  const hasTimezoneMarker = /(Z|[+-]\d{2}:?\d{2})$/.test(value.trim());
  const normalized = hasTimezoneMarker
    ? value
    : `${value.trim().replace(' ', 'T')}Z`;

  const date = new Date(normalized);
  return isNaN(date.getTime()) ? null : date;
}

@Pipe({
  name: 'utcDate',
  standalone: true,
  pure: true,
})
export class UtcDatePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined, format: string = 'medium', locale: string = 'en-US'): string | null {
    const date = parseServerDate(value);
    return date ? formatDate(date, format, locale) : null;
  }
}
