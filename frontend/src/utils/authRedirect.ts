// Route prefixes that only make sense for staff roles. A patient (or anyone
// else) landing on /login or /signup with e.g. ?next=/admin — because they
// clicked a stale link, or ProtectedRoute bounced them off a staff-only page
// before they authenticated — must never be sent there after logging in as a
// patient. Without this check, "starts with /" alone treats any staff route
// as a valid patient redirect target, so a patient login could briefly route
// to /admin before ProtectedRoute immediately bounces them back.
const STAFF_ONLY_PREFIXES = ["/admin", "/doctor-dashboard", "/reception"];

/**
 * Returns `next` only if it's a safe redirect target for a patient — i.e. it
 * points somewhere other than a staff-only route (and isn't the auth page
 * itself). Otherwise returns `fallback`.
 */
export function getPatientRedirect(
  next: string | null | undefined,
  fallback: string,
  authPath: string,
): string {
  if (!next || !next.startsWith("/") || next === authPath) return fallback;
  if (STAFF_ONLY_PREFIXES.some((prefix) => next.startsWith(prefix))) return fallback;
  return next;
}
