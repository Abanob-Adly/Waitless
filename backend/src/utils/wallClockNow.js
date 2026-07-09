/**
 * Session start/end times are stored as literal local wall-clock digits
 * written via setUTCHours (see sessionService.generateSessions) — not
 * genuine UTC instants. The admin schedule form takes a plain <input
 * type="time"> value with no timezone conversion, so "14:00" entered by
 * staff is saved as "...T14:00:00.000Z" — the digits are local, only the
 * label says UTC.
 *
 * Comparing those stored values against a genuine `new Date()` silently
 * applies this server's real UTC offset as a timing error: sessions would
 * start/end that many hours off from the wall-clock time staff actually
 * scheduled. This returns a Date whose UTC-labeled fields equal the
 * server's current LOCAL wall-clock reading, so comparisons against stored
 * session times line up the same way the rest of the app already treats
 * them (e.g. DoctorDashboard's `isOverdue`, which compares against the
 * browser's local `new Date()` the same implicit way).
 */
export function wallClockNow() {
  const d = new Date();
  return new Date(Date.UTC(
    d.getFullYear(), d.getMonth(), d.getDate(),
    d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds(),
  ));
}
