import { api } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WalletInfo = {
  id: string;
  balance: number;
  currency: string;
  ownerKind: "patient" | "doctor" | "organization";
  status: "active" | "frozen" | "closed";
  updatedAt: string;
};

export type WalletEntry = {
  id: string;
  type: "topup" | "purchase" | "plan_purchase" | "earning" | "commission" | "refund" | "withdrawal" | "penalty";
  direction: "credit" | "debit";
  amount: number;
  balanceAfter: number;
  description: string;
  status: "pending" | "settled" | "failed";
  createdAt: string;
  referenceKind: string | null;
};

export type WalletEntriesPage = {
  entries: WalletEntry[];
  total: number;
  page: number;
  limit: number;
};

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

// ── Personal wallet (patient / doctor) ───────────────────────────────────────

export async function getMyWallet(): Promise<WalletInfo> {
  const res = await api.get<{ data: { wallet: WalletInfo } }>("/wallet/me");
  return res.data.data.wallet;
}

export async function topUpMyWallet(amount: number): Promise<WalletInfo> {
  const res = await api.post<{ data: { wallet: WalletInfo } }>("/wallet/me/topup", { amount });
  return res.data.data.wallet;
}

export async function getMyWalletEntries(params?: { page?: number; limit?: number }): Promise<WalletEntriesPage> {
  const res = await api.get<{ data: WalletEntriesPage }>("/wallet/me/entries", { params });
  return res.data.data;
}

export async function withdrawFromWallet(amount: number, destination: string): Promise<WalletInfo> {
  const res = await api.post<{ data: { wallet: WalletInfo } }>("/wallet/me/withdraw", { amount, destination });
  return res.data.data.wallet;
}

// ── Organization wallet (admin) ───────────────────────────────────────────────

export async function getOrgWallet(orgId: string): Promise<WalletInfo> {
  const res = await api.get<{ data: { wallet: WalletInfo } }>(`/orgs/${orgId}/wallet`);
  return res.data.data.wallet;
}

export async function topUpOrgWallet(orgId: string, amount: number): Promise<WalletInfo> {
  const res = await api.post<{ data: { wallet: WalletInfo } }>(`/orgs/${orgId}/wallet/topup`, { amount });
  return res.data.data.wallet;
}

export async function getOrgWalletEntries(orgId: string, params?: { page?: number; limit?: number }): Promise<WalletEntriesPage> {
  const res = await api.get<{ data: WalletEntriesPage }>(`/orgs/${orgId}/wallet/entries`, { params });
  return res.data.data;
}
