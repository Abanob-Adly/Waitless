import { useState, useEffect } from "react";
import * as walletService from "../../services/walletService";
import type { WalletInfo, WalletEntry } from "../../services/walletService";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "personal" | "org";

interface Props {
  mode: Mode;
  orgId?: string; // required when mode === "org"
  accentColor?: "gold" | "navy" | "success";
}

// ── Top-Up Modal ──────────────────────────────────────────────────────────────

function TopUpModal({
  onClose,
  onConfirm,
  currency,
}: {
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
  currency: string;
}) {
  const PRESETS = [50, 100, 200, 500, 1000];
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) { setError("Enter a valid amount."); return; }
    if (num > 50_000)      { setError("Maximum top-up is 50,000 EGP per transaction."); return; }
    setLoading(true);
    setError(null);
    try {
      await onConfirm(num);
      onClose();
    } catch {
      setError("Top-up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-fade-up rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-navy">Add Funds</h2>
          <button onClick={onClose} className="text-navy-mid hover:text-navy">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick presets */}
          <div className="grid grid-cols-5 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={`rounded-lg border py-2 text-xs font-medium transition ${
                  amount === String(p)
                    ? "border-gold bg-gold-tint text-navy"
                    : "border-border text-navy-mid hover:border-gold hover:text-navy"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">
              Amount ({currency})
            </label>
            <input
              type="number"
              min="1"
              max="50000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              required
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gold py-3 text-sm font-semibold text-navy transition hover:bg-gold-light disabled:opacity-60"
          >
            {loading ? "Processing…" : `Add ${amount ? `${amount} ` : ""}${currency}`}
          </button>
        </form>

        <p className="mt-3 text-center text-xs text-navy-mid">
          Demo mode — no real payment processed.
        </p>
      </div>
    </div>
  );
}

// ── Entry row ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  topup:      "Top-Up",
  purchase:   "Session Purchase",
  earning:    "Consultation Earning",
  commission: "Organization Share",
  refund:     "Refund",
  withdrawal: "Withdrawal",
};

const TYPE_ICONS: Record<string, string> = {
  topup:      "⬆️",
  purchase:   "🛒",
  earning:    "💊",
  commission: "🏥",
  refund:     "↩️",
  withdrawal: "⬇️",
};

function EntryRow({ entry }: { entry: WalletEntry }) {
  const isCredit = entry.direction === "credit";
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-offwhite text-sm">
          {TYPE_ICONS[entry.type] ?? "💳"}
        </span>
        <div>
          <p className="text-sm font-medium text-navy">{TYPE_LABELS[entry.type] ?? entry.type}</p>
          <p className="text-xs text-navy-mid">
            {new Date(entry.createdAt).toLocaleDateString("en-EG", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold ${isCredit ? "text-success" : "text-danger"}`}>
          {isCredit ? "+" : "−"}{entry.amount.toLocaleString()} EGP
        </p>
        <p className="text-xs text-navy-mid">Bal: {entry.balanceAfter.toLocaleString()} EGP</p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WalletView({ mode, orgId }: Props) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const LIMIT = 15;
  const totalPages = Math.ceil(total / LIMIT);

  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [topUpSuccess, setTopUpSuccess] = useState<string | null>(null);

  async function loadWallet() {
    try {
      const w = mode === "org" && orgId
        ? await walletService.getOrgWallet(orgId)
        : await walletService.getMyWallet();
      setWallet(w);
    } catch {
      setWalletError("Could not load wallet.");
    } finally {
      setLoadingWallet(false);
    }
  }

  async function loadEntries() {
    setLoadingEntries(true);
    try {
      const result = mode === "org" && orgId
        ? await walletService.getOrgWalletEntries(orgId, { page, limit: LIMIT })
        : await walletService.getMyWalletEntries({ page, limit: LIMIT });
      setEntries(result.entries);
      setTotal(result.total);
    } catch {
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }

  useEffect(() => { void loadWallet(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadEntries(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTopUp(amount: number) {
    const w = mode === "org" && orgId
      ? await walletService.topUpOrgWallet(orgId, amount)
      : await walletService.topUpMyWallet(amount);
    setWallet(w);
    setTopUpSuccess(`${amount.toLocaleString()} EGP added to your wallet.`);
    setPage(1);
    void loadEntries();
    setTimeout(() => setTopUpSuccess(null), 4000);
  }

  const currency = wallet?.currency ?? "EGP";

  return (
    <div className="space-y-5">
      {/* Balance card */}
      <div className="relative overflow-hidden rounded-2xl bg-navy px-6 py-7 text-white">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -left-4 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            {mode === "org" ? "Organization Balance" : "Available Balance"}
          </p>
          {loadingWallet ? (
            <div className="mt-2 h-10 w-40 animate-pulse rounded-lg bg-white/10" />
          ) : walletError ? (
            <p className="mt-2 text-sm text-white/60">{walletError}</p>
          ) : (
            <p className="mt-1 font-heading text-4xl font-bold tracking-tight">
              {(wallet?.balance ?? 0).toLocaleString("en-EG")}
              <span className="ml-2 text-lg font-normal text-white/60">{currency}</span>
            </p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => setShowTopUp(true)}
              disabled={wallet?.status !== "active"}
              className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-navy transition hover:bg-gold-light disabled:opacity-50"
            >
              + Add Funds
            </button>
            <button
              onClick={() => { void loadWallet(); void loadEntries(); }}
              className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/40 hover:text-white"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      {topUpSuccess && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          {topUpSuccess}
        </div>
      )}

      {/* Transaction history */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-base font-bold text-navy">Transaction History</h3>
          {total > 0 && <p className="text-xs text-navy-mid">{total} transaction{total !== 1 ? "s" : ""}</p>}
        </div>

        {loadingEntries ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-offwhite" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-border bg-offwhite py-12 text-center">
            <p className="text-3xl">💳</p>
            <p className="mt-3 font-heading text-base font-bold text-navy">No transactions yet</p>
            <p className="mt-1 text-sm text-navy-mid">
              Transactions will appear here as you use your wallet.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
              {entries.map((e) => <EntryRow key={e.id} entry={e} />)}
            </div>

            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-xs text-navy-mid">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-navy-mid disabled:opacity-40 hover:border-gold hover:text-gold"
                  >
                    ← Prev
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-navy-mid disabled:opacity-40 hover:border-gold hover:text-gold"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showTopUp && (
        <TopUpModal
          currency={currency}
          onClose={() => setShowTopUp(false)}
          onConfirm={handleTopUp}
        />
      )}
    </div>
  );
}
