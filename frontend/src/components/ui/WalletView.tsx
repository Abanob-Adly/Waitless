import { useState, useEffect } from "react";
import * as walletService from "../../services/walletService";
import type { WalletInfo, WalletEntry } from "../../services/walletService";
import { useLanguage } from "../../context/LanguageContext";

interface Props {
  orgId: string;
}

const TYPE_LABELS: Record<string, string> = {
  commission:   "Organization Share",
  refund:       "Refund",
  plan_purchase: "Subscription Payment",
};

const TYPE_ICONS: Record<string, string> = {
  commission:   "🏥",
  refund:       "↩️",
  plan_purchase: "📋",
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
          {entry.description && (
            <p className="text-xs text-navy-mid">{entry.description}</p>
          )}
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

export function WalletView({ orgId }: Props) {
  const { t } = useLanguage();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const LIMIT = 15;
  const totalPages = Math.ceil(total / LIMIT);

  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);

  async function loadWallet() {
    try {
      const w = await walletService.getOrgWallet(orgId);
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
      const result = await walletService.getOrgWalletEntries(orgId, { page, limit: LIMIT });
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

  return (
    <div className="space-y-5">
      {/* Balance card */}
      <div className="relative overflow-hidden rounded-2xl bg-navy px-6 py-7 text-white">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -left-4 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Organization Balance
          </p>
          {loadingWallet ? (
            <div className="mt-2 h-10 w-40 animate-pulse rounded-lg bg-white/10" />
          ) : walletError ? (
            <p className="mt-2 text-sm text-white/60">{walletError}</p>
          ) : (
            <p className="mt-1 font-heading text-4xl font-bold tracking-tight">
              {(wallet?.balance ?? 0).toLocaleString("en-EG")}
              <span className="ml-2 text-lg font-normal text-white/60">{wallet?.currency ?? "EGP"}</span>
            </p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => { void loadWallet(); void loadEntries(); }}
              className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/40 hover:text-white"
            >
              ↻ {t("Refresh")}
            </button>
          </div>
        </div>
      </div>

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
            <p className="text-3xl">💰</p>
            <p className="mt-3 font-heading text-base font-bold text-navy">No transactions yet</p>
            <p className="mt-1 text-sm text-navy-mid">
              Commission earnings from completed appointments will appear here.
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
    </div>
  );
}
