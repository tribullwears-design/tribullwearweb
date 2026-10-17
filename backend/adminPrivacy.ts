export type AdminOrderWithPersonalInformation = {
  customer: { name: string; email: string; phone: string };
  shippingAddress: { address: string; apartment: string; city: string; state: string; pinCode: string; country: string };
};

export function redactAdminOrderPersonalInformation<T extends AdminOrderWithPersonalInformation>(order: T): T {
  return {
    ...order,
    customer: { name: "Restricted", email: "", phone: "" },
    shippingAddress: { address: "", apartment: "", city: "", state: "", pinCode: "", country: "" },
  };
}
