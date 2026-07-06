import { useState, useEffect } from "react";
import * as walletService from "../../services/walletService";
import type { WalletInfo, WalletEntry } from "../../services/walletService";
import { useLanguage } from "../../context/LanguageContext";
import { validateCardNumber, validateExpiry, validateCVV } from "../../utils/validation";

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
  const [step, setStep] = useState<"amount" | "card" | "processing" | "success">("amount");
  const [amount, setAmount] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function formatCard(v: string) {
    return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  }
  function formatExpiry(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  function handleAmountNext(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) { setError("Enter a valid amount."); return; }
    if (num > 50_000)     { setError("Maximum is 50,000 EGP per transaction."); return; }
    setError(null);
    setStep("card");
  }

  async function handleCardSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = cardNumber.replace(/\s/g, "");
    const cnResult = validateCardNumber(raw);
    if (!cnResult.valid) { setError(cnResult.error); return; }
    const expResult = validateExpiry(expiry);
    if (!expResult.valid) { setError(expResult.error); return; }
    const cvvResult = validateCVV(cvv);
    if (!cvvResult.valid) { setError(cvvResult.error); return; }
    if (!cardName.trim()) { setError("Cardholder name is required."); return; }
    setError(null);
    setStep("processing");
    try {
      await onConfirm(Number(amount));
      setStep("success");
      setTimeout(onClose, 2000);
    } catch {
      setError("Payment declined. Please check your card details.");
      setStep("card");
    }
  }

  const cardBrand = cardNumber.replace(/\s/g, "").startsWith("4")
    ? "Visa"
    : cardNumber.replace(/\s/g, "").startsWith("5")
    ? "Mastercard"
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-fade-up rounded-2xl bg-white p-6 shadow-xl">

        {/* Step: amount */}
        {step === "amount" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-navy">Add Funds</h2>
              <button onClick={onClose} className="text-navy-mid hover:text-navy">✕</button>
            </div>
            <form onSubmit={handleAmountNext} className="space-y-4">
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
                <label className="mb-1.5 block text-sm font-medium text-navy">Amount ({currency})</label>
                <input
                  type="number" min="1" max="50000"
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
                className="w-full rounded-lg bg-gold py-3 text-sm font-semibold text-navy transition hover:bg-gold-light"
              >
                Continue to Payment →
              </button>
            </form>
          </>
        )}

        {/* Step: card details */}
        {step === "card" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <button onClick={() => { setStep("amount"); setError(null); }} className="mb-1 flex items-center gap-1 text-xs text-navy-mid hover:text-navy">
                  ← Back
                </button>
                <h2 className="font-heading text-lg font-bold text-navy">Card Payment</h2>
              </div>
              <button onClick={onClose} className="self-start text-navy-mid hover:text-navy">✕</button>
            </div>

            {/* Summary banner */}
            <div className="mb-4 flex items-center justify-between rounded-xl bg-navy px-4 py-3">
              <span className="text-sm text-white/70">Charging</span>
              <span className="font-heading text-xl font-bold text-gold">{amount} {currency}</span>
            </div>

            <form onSubmit={handleCardSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-navy">Card Number</label>
                <div className="relative">
                  <input
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCard(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric"
                    className="h-11 w-full rounded-md border border-border bg-white px-3 pr-16 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    required
                  />
                  {cardBrand && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-offwhite px-1.5 py-0.5 text-[10px] font-bold text-navy-mid">
                      {cardBrand}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-navy">Expiry (MM/YY)</label>
                  <input
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    inputMode="numeric"
                    className="h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-navy">CVV</label>
                  <input
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="•••"
                    inputMode="numeric"
                    type="password"
                    className="h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-navy">Cardholder Name</label>
                <input
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="Name on card"
                  className="h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  required
                />
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <button
                type="submit"
                className="w-full rounded-lg bg-gold py-3 text-sm font-semibold text-navy transition hover:bg-gold-light"
              >
                Pay {amount} {currency}
              </button>
            </form>
            <p className="mt-2 text-center text-xs text-navy-mid">🔒 Simulated secure payment — no real charge</p>
          </>
        )}

        {/* Step: processing */}
        {step === "processing" && (
          <div className="py-10 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            <p className="font-heading text-base font-bold text-navy">Processing payment…</p>
            <p className="mt-1 text-xs text-navy-mid">Please wait</p>
          </div>
        )}

        {/* Step: success */}
        {step === "success" && (
          <div className="py-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-4xl">
              ✓
            </div>
            <p className="font-heading text-lg font-bold text-navy">Payment Successful!</p>
            <p className="mt-1 text-sm text-navy-mid">{amount} {currency} added to your wallet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Withdraw Modal ────────────────────────────────────────────────────────────

function WithdrawModal({
  maxAmount,
  currency,
  onClose,
  onConfirm,
}: {
  maxAmount: number;
  currency: string;
  onClose: () => void;
  onConfirm: (amount: number, destination: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num < 100) { setError("Minimum withdrawal is 100 EGP."); return; }
    if (num > maxAmount)   { setError(`Insufficient balance (max ${maxAmount.toLocaleString()} EGP).`); return; }
    if (destination.trim().length < 5) { setError("Enter a valid bank account or mobile number."); return; }
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(num, destination.trim());
      setDone(true);
      setTimeout(onClose, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Withdrawal failed.";
      setError(msg);
    }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-fade-up rounded-2xl bg-white p-6 shadow-xl">
        {done ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-4xl">✓</div>
            <p className="font-heading text-lg font-bold text-navy">Withdrawal Requested</p>
            <p className="mt-1 text-sm text-navy-mid">Processing within 1–3 business days.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-navy">Withdraw Funds</h2>
              <button onClick={onClose} className="text-navy-mid hover:text-navy">✕</button>
            </div>
            <div className="mb-4 rounded-xl bg-offwhite px-4 py-3">
              <p className="text-xs text-navy-mid">Available</p>
              <p className="font-heading text-2xl font-bold text-navy">{maxAmount.toLocaleString()} <span className="text-base font-normal text-navy-mid">{currency}</span></p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-navy">Amount ({currency})</label>
                <input
                  type="number" min="100" max={maxAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Minimum 100 EGP"
                  className="h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-navy">Bank Account or Mobile Wallet Number</label>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Instapay number, Vodafone Cash, IBAN"
                  className="h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  required
                />
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-navy py-3 text-sm font-semibold text-white transition hover:bg-navy/80 disabled:opacity-60"
              >
                {submitting ? "Processing…" : "Request Withdrawal"}
              </button>
            </form>
          </>
        )}
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
  penalty:    "Cancellation Penalty",
};

const TYPE_ICONS: Record<string, string> = {
  topup:      "⬆️",
  purchase:   "🛒",
  earning:    "💊",
  commission: "🏥",
  refund:     "↩️",
  withdrawal: "⬇️",
  penalty:    "⚠️",
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
  const { t } = useLanguage();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const LIMIT = 15;
  const totalPages = Math.ceil(total / LIMIT);

  const [reloadKey, setReloadKey] = useState(0);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
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
  useEffect(() => { void loadEntries(); }, [page, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTopUp(amount: number) {
    const w = mode === "org" && orgId
      ? await walletService.topUpOrgWallet(orgId, amount)
      : await walletService.topUpMyWallet(amount);
    setWallet(w);
    setTopUpSuccess(`${amount.toLocaleString()} EGP added to your wallet.`);
    setPage(1);
    setReloadKey((k) => k + 1);
    setTimeout(() => setTopUpSuccess(null), 4000);
  }

  async function handleWithdraw(amount: number, destination: string) {
    const w = await walletService.withdrawFromWallet(amount, destination);
    setWallet(w);
    setPage(1);
    setReloadKey((k) => k + 1);
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
              {t("+ Add Funds")}
            </button>
            {mode === "personal" && (
              <button
                onClick={() => setShowWithdraw(true)}
                disabled={wallet?.status !== "active" || (wallet?.balance ?? 0) < 100}
                className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/40 hover:text-white disabled:opacity-50"
              >
                {t("↓ Withdraw")}
              </button>
            )}
            <button
              onClick={() => { void loadWallet(); void loadEntries(); }}
              className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/40 hover:text-white"
            >
              ↻ {t("Refresh")}
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

      {showWithdraw && (
        <WithdrawModal
          maxAmount={wallet?.balance ?? 0}
          currency={currency}
          onClose={() => setShowWithdraw(false)}
          onConfirm={handleWithdraw}
        />
      )}
    </div>
  );
}
