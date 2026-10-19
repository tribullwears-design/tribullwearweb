import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listCategories: vi.fn(),
  getProduct: vi.fn(),
  isValidCustomerEmail: vi.fn(),
  isValidCustomerMobile: vi.fn(),
  normalizeCustomerEmail: vi.fn(),
  findCustomerAddress: vi.fn(),
  findActiveCoupon: vi.fn(),
  calculateOfferDiscount: vi.fn(),
}));

vi.mock("./categoryStore.js", () => ({ listCategories: mocks.listCategories }));
vi.mock("./productStore.js", () => ({ getProduct: mocks.getProduct }));
vi.mock("./authStore.js", () => ({
  isValidCustomerEmail: mocks.isValidCustomerEmail,
  isValidCustomerMobile: mocks.isValidCustomerMobile,
  normalizeCustomerEmail: mocks.normalizeCustomerEmail,
}));
vi.mock("./customerDataStore.js", () => ({ findCustomerAddress: mocks.findCustomerAddress }));
vi.mock("./marketingStore.js", () => ({ findActiveCoupon: mocks.findActiveCoupon, calculateOfferDiscount: mocks.calculateOfferDiscount }));

import { buildCheckoutOrder, prepareCheckoutOrder } from "./checkoutOrderService.js";

const product = {
  id: "product-1",
  name: "Catalog-priced shirt",
  price: 1500,
  compareAt: 2000,
  image: "/shirt.png",
  status: "Active",
  stock: 10,
  sizes: ["M", "L"],
  colors: ["Black"],
  mainCategoryId: "shirts",
  subcategoryId: "tees",
};
const request = {
  idempotencyKey: "checkout-request-key-12345",
  customer: { name: "Test Customer", email: "customer@example.test", phone: "9876543210" },
  shippingAddress: { address: "10 Test Street", apartment: "", city: "Chennai", state: "Tamil Nadu", pinCode: "600001", country: "India" },
  items: [{ id: "product-1", quantity: 2, price: 1, variant: { size: "M", color: "Black" } }],
  total: 2,
};

describe("prepareCheckoutOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCategories.mockResolvedValue([{
      value: "shirts",
      label: "Shirts",
      isVisible: true,
      subcategories: [{ value: "tees", label: "Tees", isVisible: true }],
    }]);
    mocks.getProduct.mockResolvedValue({ ...product });
    mocks.isValidCustomerEmail.mockReturnValue(true);
    mocks.isValidCustomerMobile.mockReturnValue(true);
    mocks.normalizeCustomerEmail.mockImplementation((email: string) => email.trim().toLowerCase());
    mocks.findCustomerAddress.mockResolvedValue(null);
    mocks.findActiveCoupon.mockResolvedValue(null);
    mocks.calculateOfferDiscount.mockImplementation((_offer: unknown, amount: number) => amount * 0.1);
  });

  it("uses current catalog prices rather than client-submitted price or totals", async () => {
    const checkout = await prepareCheckoutOrder(request);

    expect(checkout.total).toBe(3000);
    expect(checkout.orderItems).toMatchObject([{ price: 1500, quantity: 2, lineTotal: 3000 }]);
    expect(checkout.customer.email).toBe("customer@example.test");
    expect(checkout.shippingAddress.state).toBe("Tamil Nadu");
  });

  it("rejects a hidden category instead of charging for unavailable merchandise", async () => {
    mocks.listCategories.mockResolvedValue([{
      value: "shirts",
      label: "Shirts",
      isVisible: false,
      subcategories: [{ value: "tees", label: "Tees", isVisible: true }],
    }]);

    await expect(prepareCheckoutOrder(request)).rejects.toMatchObject({ status: 409 });
  });

  it("accepts an in-stock product at its current server price and selected variant", async () => {
    const checkout = await prepareCheckoutOrder(request);
    expect(checkout.orderItems).toEqual([expect.objectContaining({
      id: "product-1",
      price: 1500,
      quantity: 2,
      variant: "Size: M / Colour: Black",
      lineTotal: 3000,
    })]);
  });

  it("rejects an out-of-stock product even when the client requests one unit", async () => {
    mocks.getProduct.mockResolvedValue({ ...product, stock: 0 });
    await expect(prepareCheckoutOrder({
      ...request,
      items: [{ id: "product-1", quantity: 1, variant: { size: "M", color: "Black" } }],
    })).rejects.toMatchObject({ status: 409, message: "Only 0 units of Catalog-priced shirt are available" });
  });

  it("revalidates an active coupon and stores the calculated discount", async () => {
    mocks.findActiveCoupon.mockResolvedValue({ code: "SAVE10", minimumOrderAmount: 500, discountType: "percentage", value: 10 });
    mocks.calculateOfferDiscount.mockReturnValue(300);
    const checkout = await prepareCheckoutOrder({ ...request, couponCode: "save10" });
    expect(mocks.findActiveCoupon).toHaveBeenCalledWith("save10");
    expect(checkout).toMatchObject({ couponCode: "SAVE10", subtotal: 3000, discount: 300, total: 2700 });
    expect(buildCheckoutOrder(checkout, { method: "upi", status: "Pending" }, "razorpay", "order_test123"))
      .toMatchObject({ couponCode: "SAVE10", discount: 300, total: 2700 });
  });

  it("rejects an invalid coupon rather than accepting a client discount", async () => {
    mocks.findActiveCoupon.mockResolvedValue(null);
    await expect(prepareCheckoutOrder({ ...request, couponCode: "NOTREAL" }))
      .rejects.toMatchObject({ status: 400, message: "Coupon is invalid, inactive, or expired" });
  });

  it("rejects an invalid state before it can be persisted to an order", async () => {
    await expect(prepareCheckoutOrder({
      ...request,
      shippingAddress: { ...request.shippingAddress, state: "Not an Indian state" },
    })).rejects.toMatchObject({ status: 400 });
  });

  it("uses an owned saved address and saves an immutable recipient snapshot on the order", async () => {
    mocks.findCustomerAddress.mockResolvedValue({
      id: "address-identifier-0001",
      fullName: "Delivery Recipient",
      phone: "9876543210",
      address: "20 Saved Road",
      city: "Mumbai",
      state: "Maharashtra",
      pinCode: "400001",
      isDefault: true,
      createdAt: "2026-10-17T10:00:00.000Z",
      updatedAt: "2026-10-17T10:00:00.000Z",
    });
    const checkout = await prepareCheckoutOrder({
      ...request,
      savedAddressId: "address-identifier-0001",
      shippingAddress: { ...request.shippingAddress, address: "Client supplied address" },
    }, { id: "customer-object-id", email: "account@example.test" });
    const order = buildCheckoutOrder(checkout, { method: "cod", status: "Pending collection" }, "cod");

    expect(mocks.findCustomerAddress).toHaveBeenCalledWith("customer-object-id", "address-identifier-0001");
    expect(checkout.customer).toMatchObject({ email: "account@example.test", name: "Delivery Recipient" });
    expect(order).toMatchObject({
      customerId: "customer-object-id",
      shippingAddress: {
        address: "20 Saved Road",
        city: "Mumbai",
        recipientName: "Delivery Recipient",
        phone: "9876543210",
      },
    });
  });

  it("stores the authenticated customer ID for a Razorpay Test Mode order without marking payment successful", async () => {
    const checkout = await prepareCheckoutOrder(request, {
      id: "customer-object-id",
      email: "account@example.test",
    });
    const order = buildCheckoutOrder(
      checkout,
      { method: "upi", status: "Pending" },
      "razorpay",
      "order_test123",
    );

    expect(checkout.customerId).toBe("customer-object-id");
    expect(order).toMatchObject({
      customerId: "customer-object-id",
      paymentMode: "razorpay",
      payment: { method: "upi", status: "Pending" },
      razorpayOrderId: "order_test123",
    });
  });

  it("rejects a saved address that does not belong to the authenticated customer", async () => {
    await expect(prepareCheckoutOrder({
      ...request,
      savedAddressId: "address-identifier-0001",
    }, { id: "another-customer", email: "customer@example.test" })).rejects.toMatchObject({ status: 404 });
  });
});
