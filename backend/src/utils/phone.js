/**
 * Normalize a phone string to E.164 format.
 * Handles Egyptian-context inputs:
 *   01XXXXXXXXX  →  +201XXXXXXXXX
 *   201XXXXXXXXX →  +201XXXXXXXXX
 *   +201XXXXXXXX →  unchanged
 */
export function normalizePhone(phone) {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, '');
  if (phone.trimStart().startsWith('+')) return '+' + digits;
  if (digits.startsWith('20')) return '+' + digits;
  if (digits.startsWith('0'))  return '+20' + digits.slice(1);
  return '+20' + digits;
}
