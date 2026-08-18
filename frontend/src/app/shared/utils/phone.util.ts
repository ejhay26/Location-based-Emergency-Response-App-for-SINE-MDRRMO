/**
 * Canonical Philippine mobile number handling for the frontend — mirrors
 * the backend's App\Support\PhoneNumber exactly (same accepted shapes,
 * same "63XXXXXXXXXX" canonical output) so a number validated/sent here
 * always matches what the backend will normalize it to. Keeping these two
 * in sync matters: if they ever drift, "valid on the frontend" could still
 * get rejected by the backend, or vice versa.
 */

/**
 * Normalizes any of these common input shapes to "63XXXXXXXXXX":
 *   "09171234567"    11 digits, local format, leading 0
 *   "9171234567"     10 digits, no prefix at all
 *   "+639171234567"  E.164 with a leading +
 *   "639171234567"   already canonical
 *   any of the above with spaces or dashes mixed in
 *
 * Returns null if the input can't be confidently interpreted as a valid
 * PH mobile number — callers must check for null before submitting.
 */
export function normalizePhonePH(raw: string): string | null {
  const digits = (raw || '').replace(/\D+/g, '');

  if (digits.length === 12 && digits.startsWith('63')) {
    return isValidMobileSuffix(digits) ? digits : null;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    const candidate = '63' + digits.slice(1);
    return isValidMobileSuffix(candidate) ? candidate : null;
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    const candidate = '63' + digits;
    return isValidMobileSuffix(candidate) ? candidate : null;
  }
  return null;
}

function isValidMobileSuffix(canonical: string): boolean {
  return canonical.length === 12 && canonical[2] === '9';
}

/** True if normalizePhonePH(raw) would succeed — use for form validity checks. */
export function isValidPhonePH(raw: string): boolean {
  return normalizePhonePH(raw) !== null;
}

/**
 * Formats a canonical "63XXXXXXXXXX" number for human display, e.g.
 * "+63 917 123 4567". Falls back to returning the raw input unchanged if
 * it isn't a recognizable canonical/normalizable shape (e.g. a legacy
 * pre-migration DB row that hasn't been backfilled yet) — showing the raw
 * value is more useful to an admin than silently blanking it out.
 */
export function formatPhoneDisplayPH(raw: string | null | undefined): string {
  if (!raw) return '';
  const canonical = normalizePhonePH(raw);
  if (!canonical) return raw;
  return `+${canonical.slice(0, 2)} ${canonical.slice(2, 5)} ${canonical.slice(5, 8)} ${canonical.slice(8)}`;
}

/**
 * Live-typing formatter for a bare (no-prefix) 10-digit local-part input,
 * meant to be paired with a fixed "+63" prefix shown in the UI (see
 * register.page.html / login.page.html for the prefix markup). Handles
 * the case where someone types out of habit with the leading 0
 * ("09171234567") by stripping just that leading 0 as they type, so what
 * ends up in the 10-digit field is "9171234567" — the "9" stays intact,
 * only the redundant "0" (already implied by the +63 prefix) is dropped.
 * Also strips any non-digit characters and caps length at 10.
 */
export function formatPhoneLocalPart(raw: string): string {
  let digits = (raw || '').replace(/\D+/g, '');
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}
