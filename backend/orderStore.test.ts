import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createIndex: vi.fn(),
  insertOne: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  countDocuments: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { createOrder, listOrders, updateOrderStatus, updateRazorpayPayment } from "./orderStore.js";

const order = {
  id: "TB-20261017-ORDER",
  idempotencyKey: "checkout-request-key-12345",
  customer: { name: "Test Customer", email: "customer@example.test", phone: "9876543210" },
  shippingAddress: { address: "10 Test Street", apartment: "", city: "Chennai", state: "Tamil Nadu", pinCode: "600001", country: "India" },
  items: [{ id: "shirt-1", name: "Test shirt", price: 1500, image: "/shirt.png", quantity: 2, lineTotal: 3000 }],
  subtotal: 3000,
  shipping: 0,
  discount: 0,
  total: 3000,
  payment: { method: "upi", status: "Pending" },
  paymentMode: "razorpay" as const,
  razorpayOrderId: "order_test123",
  status: "Pending" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDatabase.mockResolvedValue({
    collection: vi.fn(() => ({
      createIndex: mocks.createIndex.mockResolvedValue(undefined),
      insertOne: mocks.insertOne.mockResolvedValue({ acknowledged: true }),
      find: mocks.find,
      findOne: mocks.findOne,
      findOneAndUpdate: mocks.findOneAndUpdate,
      countDocuments: mocks.countDocuments,
    })),
  });
});

describe("order store", () => {
  it("persists server-priced line items, customer/address details, payment references and totals", async () => {
    const created = await createOrder(order);
    const stored = mocks.insertOne.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(created).toMatchObject({
      id: order.id,
      idempotencyKey: order.idempotencyKey,
      customer: order.customer,
      shippingAddress: order.shippingAddress,
      items: order.items,
      subtotal: 3000,
      shipping: 0,
      discount: 0,
      total: 3000,
      paymentMode: "razorpay",
      razorpayOrderId: "order_test123",
      status: "Pending",
    });
    expect(stored).toMatchObject(created);
    expect(stored.createdAt).toEqual(expect.any(String));
    expect(mocks.createIndex).toHaveBeenCalledWith({ idempotencyKey: 1 }, { unique: true, sparse: true });
  });

  it("persists a customer-owned immutable delivery-address snapshot", async () => {
    const orderWithSnapshot = {
      ...order,
      customerId: "customer-object-id",
      shippingAddress: {
        ...order.shippingAddress,
        recipientName: "Delivery Recipient",
        phone: "9876543210",
      },
    };

    await createOrder(orderWithSnapshot);
    expect(mocks.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      customerId: "customer-object-id",
      shippingAddress: expect.objectContaining({
        recipientName: "Delivery Recipient",
        phone: "9876543210",
        address: "10 Test Street",
      }),
    }));
  });

  it("persists the payment ID and paid status only through the matched provider order update", async () => {
    const paidOrder = {
      ...order,
      payment: { method: "upi", status: "Paid" },
      razorpayPaymentId: "pay_test123",
    };
    mocks.findOneAndUpdate.mockResolvedValue(paidOrder);

    await expect(updateRazorpayPayment("order_test123", "pay_test123", "Paid", "upi"))
      .resolves.toEqual(paidOrder);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      {
        razorpayOrderId: "order_test123",
        $or: [
          { "payment.status": "Pending" },
          { "payment.status": "Authorized", razorpayPaymentId: "pay_test123" },
        ],
      },
      {
        $set: {
          "payment.status": "Paid",
          razorpayPaymentId: "pay_test123",
          "payment.method": "upi",
        },
      },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  });

  it("persists failed payment status without ever marking it paid", async () => {
    const failedOrder = {
      ...order,
      payment: { method: "upi", status: "Failed" },
      razorpayPaymentId: "pay_test123",
    };
    mocks.findOneAndUpdate.mockResolvedValue(failedOrder);

    await expect(updateRazorpayPayment("order_test123", "pay_test123", "Failed", "upi"))
      .resolves.toEqual(failedOrder);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      {
        razorpayOrderId: "order_test123",
        $or: [
          { "payment.status": "Pending" },
          { "payment.status": "Authorized", razorpayPaymentId: "pay_test123" },
        ],
      },
      {
        $set: {
          "payment.status": "Failed",
          razorpayPaymentId: "pay_test123",
          "payment.method": "upi",
        },
      },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  });

  it("stores order status changes in the database update and returns the persisted order", async () => {
    const shippedOrder = { ...order, status: "Shipped" as const };
    mocks.findOneAndUpdate.mockResolvedValue(shippedOrder);

    await expect(updateOrderStatus(order.id, "Shipped")).resolves.toEqual(shippedOrder);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { id: order.id },
      { $set: { status: "Shipped", statusUpdatedAt: expect.any(String) } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  });

  it("lists orders using supported status filters and sorts newest first", async () => {
    const toArray = vi.fn().mockResolvedValue([order]);
    const sort = vi.fn().mockReturnValue({ toArray });
    mocks.find.mockReturnValue({ sort });

    await expect(listOrders("Delivered")).resolves.toEqual([order]);
    expect(mocks.find).toHaveBeenCalledWith({ status: "Delivered" }, { projection: { _id: 0, customerId: 0 } });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });

    await listOrders("not-a-status");
    expect(mocks.find).toHaveBeenLastCalledWith({}, { projection: { _id: 0, customerId: 0 } });
  });

  it("lists only the requested customer's orders with bounded pagination", async () => {
    const toArray = vi.fn().mockResolvedValue([order]);
    const limit = vi.fn().mockReturnValue({ toArray });
    const skip = vi.fn().mockReturnValue({ limit });
    const sort = vi.fn().mockReturnValue({ skip });
    mocks.find.mockReturnValue({ sort });
    mocks.countDocuments.mockResolvedValue(1);

    const result = await (await import("./orderStore.js")).listCustomerOrders("customer-a", 2, 20);
    expect(result).toEqual({ orders: [order], total: 1, page: 2, limit: 20 });
    expect(mocks.find).toHaveBeenCalledWith({ customerId: "customer-a" }, { projection: { _id: 0, customerId: 0 } });
    expect(mocks.countDocuments).toHaveBeenCalledWith({ customerId: "customer-a" });
    expect(skip).toHaveBeenCalledWith(20);
    expect(limit).toHaveBeenCalledWith(20);
  });

  it("exposes an admin-persisted status change in the same customer's next history refresh", async () => {
    const shipped = {
      ...order,
      customerId: "customer-a",
      status: "Shipped" as const,
      statusUpdatedAt: "2026-10-17T11:00:00.000Z",
    };
    mocks.findOneAndUpdate.mockResolvedValue(shipped);
    await updateOrderStatus(order.id, "Shipped");

    const toArray = vi.fn().mockResolvedValue([shipped]);
    const limit = vi.fn().mockReturnValue({ toArray });
    const skip = vi.fn().mockReturnValue({ limit });
    const sort = vi.fn().mockReturnValue({ skip });
    mocks.find.mockReturnValue({ sort });
    mocks.countDocuments.mockResolvedValue(1);
    const history = await (await import("./orderStore.js")).listCustomerOrders("customer-a");

    expect(history.orders[0]).toMatchObject({ id: order.id, status: "Shipped", statusUpdatedAt: expect.any(String) });
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { id: order.id },
      { $set: { status: "Shipped", statusUpdatedAt: expect.any(String) } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  });
});
