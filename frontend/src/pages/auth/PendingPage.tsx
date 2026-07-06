import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { saveTokens, getRefreshToken } from "../../services/authService";
import * as jr from "../../services/joinRequestService";
import type { JoinRequest, PendingInvitation } from "../../services/joinRequestService";

export function PendingPage() {
  const { authUser, reloadUser, logout } = useAuth();
  const navigate = useNavigate();

  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser || authUser.role !== "staff") {
      navigate("/login", { replace: true });
      return;
    }
    Promise.all([jr.getMyJoinRequests(), jr.getMyInvitations()])
      .then(([reqs, invs]) => { setJoinRequests(reqs); setInvitations(invs); })
      .catch(() => setError("Failed to load your requests."))
      .finally(() => setIsLoading(false));
  }, [authUser, navigate]);

  async function handleAcceptInvitation(invitation: PendingInvitation) {
    setAccepting(invitation.id);
    setError(null);
    try {
      const { accessToken } = await jr.acceptInvitation(invitation.inviteToken);
      // Save new scoped token, keep existing refresh token
      saveTokens(accessToken, getRefreshToken() ?? "");
      // Reload auth state from the server using the new token
      const ok = await reloadUser();
      if (ok) {
        const dest = invitation.kind === "admin" ? "/admin"
          : invitation.kind === "doctor" ? "/doctor-dashboard"
          : "/reception";
        navigate(dest, { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    } catch {
      setError("Could not accept the invitation. It may have expired.");
    } finally {
      setAccepting(null);
    }
  }

  if (!authUser || authUser.role !== "staff") return null;

  const profile = authUser.profile as { name: string; email: string };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">

      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">Pending Approval</span>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="text-xs text-navy-mid transition hover:text-danger"
          >
            Sign Out
          </button>
        </div>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">
          Welcome, {profile.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-navy-mid">
          Your account is active but you're not yet assigned to a clinic.
          Once a clinic admin approves you, you'll get full access.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-white" />)}
        </div>
      ) : (
        <>
          {/* Clinic invitations */}
          {invitations.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 font-heading text-base font-bold text-navy">
                Clinic Invitations
              </h2>
              <div className="space-y-3">
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-4 rounded-xl border border-gold/30 bg-gold-tint p-4">
                    <div>
                      <p className="font-heading text-sm font-bold text-navy">{inv.organizationName}</p>
                      <p className="mt-0.5 text-xs capitalize text-navy-mid">
                        Role: <span className="font-medium text-navy">{inv.kind}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-navy-mid">
                        Sent {new Date(inv.createdAt).toLocaleDateString("en-EG", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAcceptInvitation(inv)}
                      disabled={accepting === inv.id}
                      className="shrink-0 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-gold-light disabled:opacity-60"
                    >
                      {accepting === inv.id ? "Joining…" : "Accept →"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Join requests */}
          <section>
            <h2 className="mb-3 font-heading text-base font-bold text-navy">
              Your Join Requests
            </h2>
            {joinRequests.length === 0 ? (
              <div className="rounded-xl border border-border bg-white px-6 py-10 text-center">
                <p className="text-2xl">🏥</p>
                <p className="mt-2 text-sm font-medium text-navy">No requests yet</p>
                <p className="mt-1 text-xs text-navy-mid">
                  You can submit a join request from the sign-up page, or ask a clinic admin to invite you directly.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {joinRequests.map((req) => (
                  <div key={req.id} className="rounded-xl border border-border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-sm font-bold text-navy capitalize">{req.organizationName}</p>
                        <p className="mt-0.5 text-xs capitalize text-navy-mid">{req.organizationType}</p>
                        <p className="mt-1 text-xs text-navy-mid/70">
                          Submitted {new Date(req.createdAt).toLocaleDateString("en-EG", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                    {req.status === "rejected" && (
                      <p className="mt-2 text-xs text-danger/80">
                        This request was declined. You may try contacting the clinic directly.
                      </p>
                    )}
                    {req.status === "approved" && (
                      <p className="mt-2 text-xs text-success">
                        Approved! Check your invitations above or sign in again to access your dashboard.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Refresh hint */}
          <div className="mt-8 rounded-xl border border-border bg-offwhite px-5 py-4 text-center">
            <p className="text-xs text-navy-mid">
              Waiting for approval?{" "}
              <button onClick={() => window.location.reload()} className="font-medium text-gold hover:text-gold-light">
                Refresh this page
              </button>{" "}
              to check for updates.
            </p>
          </div>
        </>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: JoinRequest["status"] }) {
  const map = {
    pending:   { cls: "bg-gold/15 text-gold", label: "Pending" },
    approved:  { cls: "bg-success/10 text-success", label: "Approved" },
    rejected:  { cls: "bg-danger/10 text-danger", label: "Rejected" },
    withdrawn: { cls: "bg-navy/10 text-navy-mid", label: "Withdrawn" },
  } as const;
  const { cls, label } = map[status] ?? map.pending;
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}
