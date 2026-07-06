type Locale = "en" | "ar";

/**
 * Converts a "HH:mm" or "HH:mm:ss" string (24-hour) to 12-hour display.
 * Returns "12:30 PM" in English or "12:30 م" in Arabic.
 * Western numerals always (per project convention).
 */
export function fmt12(time: string | null | undefined, locale: Locale = "en"): string {
  if (!time) return "";
  const parts = time.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  if (isNaN(h) || isNaN(m)) return time;

  const period = h < 12
    ? (locale === "ar" ? "ص" : "AM")
    : (locale === "ar" ? "م" : "PM");
  const h12 = h % 12 || 12;
  const mm  = String(m).padStart(2, "0");
  return `${h12}:${mm} ${period}`;
}

/**
 * Formats a range of "HH:mm" times as "hh:mm AM – hh:mm PM".
 */
export function fmt12Range(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: Locale = "en",
): string {
  const sep = locale === "ar" ? " – " : " – ";
  return `${fmt12(start, locale)}${sep}${fmt12(end, locale)}`;
}
