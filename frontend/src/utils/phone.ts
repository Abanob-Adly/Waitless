/**
 * Normalizes Egyptian phone numbers to E.164 format.
 * 01XXXXXXXXX  → +201XXXXXXXXX
 * 201XXXXXXXXX → +201XXXXXXXXX
 */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("002")) return `+${digits.slice(2)}`;
  if (digits.startsWith("20")) return `+${digits}`;
  if (digits.startsWith("0")) return `+2${digits}`;
  return `+${digits}`;
}

/** Returns true if the input looks like a phone number (mostly digits). */
export function looksLikePhone(input: string): boolean {
  return /^[0-9+()\-\s]{7,}$/.test(input.trim());
}
