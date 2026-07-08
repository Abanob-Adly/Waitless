import { api } from "./api";

export type PaymentCheckoutResult = {
  checkoutUrl: string;
  paymentId: string;
};

export type PaymentResultData = {
  id: string;
  status: "pending" | "success" | "failed" | "refunded";
  purpose: "subscription" | "appointment";
  amountCents: number;
  currency: string;
  processedAt: string | null;
  failureReason?: string;
  appointment?: string;
  appointmentToken?: string;
};

export async function startAppointmentCheckout(appointmentId: string): Promise<PaymentCheckoutResult> {
  const res = await api.post<{ data: PaymentCheckoutResult }>(
    `/appointments/${appointmentId}/pay`,
  );
  return res.data.data;
}

export async function startSubscriptionCheckout(
  orgId: string,
  data: { planId: string },
): Promise<PaymentCheckoutResult> {
  const res = await api.post<{ data: PaymentCheckoutResult }>(
    `/orgs/${orgId}/billing/checkout`,
    data,
  );
  return res.data.data;
}

export async function getPaymentResult(paymentId: string): Promise<PaymentResultData> {
  const res = await api.get<{ data: PaymentResultData }>(
    `/payments/result`,
    { params: { paymentId } },
  );
  return res.data.data;
}
