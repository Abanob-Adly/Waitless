import { api } from "./api";

export type PaymobInitiateResult = {
  iframeUrl: string;
  orderId: string;
  amountCents: number;
  fee: number;
};

/**
 * Initiate a Paymob card payment for an appointment.
 * Returns the hosted iframe URL to redirect the patient to.
 */
export async function initiatePaymobPayment(appointmentId: string): Promise<PaymobInitiateResult> {
  const res = await api.post<{ data: PaymobInitiateResult }>("/payment/paymob/initiate", { appointmentId });
  return res.data.data;
}
