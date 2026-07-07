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
