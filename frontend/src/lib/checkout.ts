import { isCheckoutPaymentMethod, normalizeIndianState, type CheckoutPaymentMethod } from "../../../shared/checkout";

export type CheckoutSubmission = {
  idempotencyKey: string;
  customer: { name: string; email: string; phone: string };
  shippingAddress: {
    address: string;
    apartment: string;
    city: string;
    state: string;
    pinCode: string;
    country: "India";
  };
  paymentMethod: CheckoutPaymentMethod;
  items: Array<{ id: string; quantity: number; variant: { size?: string; color?: string } }>;
};

export function createCheckoutSubmission(submission: CheckoutSubmission): CheckoutSubmission {
  const state = normalizeIndianState(submission.shippingAddress.state);
  if (!state) throw new Error("Select a valid Indian state or union territory.");
  if (!isCheckoutPaymentMethod(submission.paymentMethod)) throw new Error("Choose a valid test payment method.");
  return {
    ...submission,
    shippingAddress: { ...submission.shippingAddress, state },
  };
}
