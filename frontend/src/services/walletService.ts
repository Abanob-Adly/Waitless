import { api } from "./api";

export type WalletInfo = {
  id: string;
  balance: number;
  currency: string;
  status: "active" | "frozen" | "closed";
  updatedAt: string;
};

export type WalletEntry = {
  id: string;
  type: "commission" | "refund" | "plan_purchase";
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

export async function getOrgWallet(orgId: string): Promise<WalletInfo> {
  const res = await api.get<{ data: { wallet: WalletInfo } }>(`/orgs/${orgId}/wallet`);
  return res.data.data.wallet;
}

export async function getOrgWalletEntries(
  orgId: string,
  params?: { page?: number; limit?: number },
): Promise<WalletEntriesPage> {
  const res = await api.get<{ data: WalletEntriesPage }>(`/orgs/${orgId}/wallet/entries`, { params });
  return res.data.data;
}

// ── Withdrawals ──────────────────────────────────────────────────────────────

export type PayoutRequest = {
  _id: string;
  amount: number;
  currency: string;
  destinationType: string;
  destinationDetails: Record<string, string>;
  status: "pending" | "processing" | "completed" | "rejected";
  notes: string;
  createdAt: string;
};

export type PayoutRequestResult = {
  payouts: PayoutRequest[];
  total: number;
  page: number;
  limit: number;
};

export async function withdrawFromWallet(
  orgId: string,
  data: { amount: number; destinationType: "bank" | "mobile_wallet"; destinationDetails: Record<string, string> },
): Promise<PayoutRequest> {
  const res = await api.post<{ data: PayoutRequest }>(`/orgs/${orgId}/wallet/withdraw`, data);
  return res.data.data;
}

export async function getOrgWithdrawals(
  orgId: string,
  params?: { page?: number; limit?: number },
): Promise<PayoutRequestResult> {
  const res = await api.get<{ data: PayoutRequestResult }>(`/orgs/${orgId}/wallet/withdrawals`, { params });
  return res.data.data;
}
