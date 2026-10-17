import { once } from "node:events";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null as null | {
    _id: { toString: () => string };
    adminRole: "admin";
    adminTitle: "Super Admin" | "Admin" | "Manager" | "Staff";
    adminStatus: "Active" | "Inactive";
    adminPermissions?: Record<string, { view: boolean; edit: boolean }>;
  },
  getSessionAdmin: vi.fn(),
  listOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

vi.mock("./authService.js", () => ({
  adminCookieName: "tribull_admin",
  getSessionAdmin: mocks.getSessionAdmin.mockImplementation(async (request: { headers: { cookie?: string } }) =>
    request.headers.cookie?.includes("tribull_admin=valid") ? mocks.session : null),
}));
vi.mock("./orderStore.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./orderStore.js")>();
  return {
    ...actual,
    listOrders: mocks.listOrders,
    updateOrderStatus: mocks.updateOrderStatus,
  };
});

import { createAdminOrderRouter } from "./orderRoutes.js";

const sampleOrder = {
  id: "TB-20261017-ORDER",
  customer: { name: "Test Customer", email: "customer@example.test", phone: "9876543210" },
  shippingAddress: { address: "10 Test Street", apartment: "", city: "Chennai", state: "Tamil Nadu", pinCode: "600001", country: "India" },
  items: [{ id: "shirt-1", name: "Test shirt", price: 1500, image: "/shirt.png", quantity: 2, lineTotal: 3000 }],
  subtotal: 3000,
  shipping: 0,
  discount: 0,
  total: 3000,
  payment: { method: "upi", status: "Paid" },
  paymentMode: "razorpay" as const,
  razorpayOrderId: "order_test123",
  razorpayPaymentId: "pay_test123",
  status: "Pending" as const,
  createdAt: "2026-10-17T10:00:00.000Z",
};

let server: ReturnType<express.Application["listen"]>;
let baseUrl = "";

beforeEach(async () => {
  mocks.session = null;
  mocks.listOrders.mockReset().mockResolvedValue([sampleOrder]);
  mocks.updateOrderStatus.mockReset().mockImplementation(async (_id: string, status: string) => ({
    ...sampleOrder,
    status,
  }));
  const app = express();
  app.use(express.json());
  app.use(createAdminOrderRouter());
  server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function admin(role: "Super Admin" | "Admin" | "Manager" | "Staff" = "Super Admin") {
  mocks.session = {
    _id: { toString: () => "507f1f77bcf86cd799439011" },
    adminRole: "admin",
    adminTitle: role,
    adminStatus: "Active",
  };
}

describe("admin order routes", () => {
  it("requires an authenticated order-view permission to list orders", async () => {
    const denied = await fetch(`${baseUrl}/api/orders`);
    expect(denied.status).toBe(401);
    expect(mocks.listOrders).not.toHaveBeenCalled();

    admin("Staff");
    const forbidden = await fetch(`${baseUrl}/api/orders`, { headers: { cookie: "tribull_admin=valid" } });
    expect(forbidden.status).toBe(403);
    expect(mocks.listOrders).not.toHaveBeenCalled();

    admin("Super Admin");
    const allowed = await fetch(`${baseUrl}/api/orders`, { headers: { cookie: "tribull_admin=valid" } });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual([sampleOrder]);
  });

  it("redacts customer information for Manager order-view responses", async () => {
    admin("Manager");
    const response = await fetch(`${baseUrl}/api/orders`, { headers: { cookie: "tribull_admin=valid" } });
    const [order] = await response.json() as typeof sampleOrder[];

    expect(order?.customer).toEqual({ name: "Restricted", email: "", phone: "" });
    expect(order?.shippingAddress).toEqual({ address: "", apartment: "", city: "", state: "", pinCode: "", country: "" });
    expect(order?.razorpayOrderId).toBe("order_test123");
    expect(order?.razorpayPaymentId).toBe("pay_test123");
  });

  it("requires order-edit permission and validates persisted status changes", async () => {
    admin("Staff");
    const denied = await fetch(`${baseUrl}/api/orders/${sampleOrder.id}`, {
      method: "PATCH",
      headers: { cookie: "tribull_admin=valid", "content-type": "application/json" },
      body: JSON.stringify({ status: "Shipped" }),
    });
    expect(denied.status).toBe(403);
    expect(mocks.updateOrderStatus).not.toHaveBeenCalled();

    admin("Super Admin");
    const invalid = await fetch(`${baseUrl}/api/orders/${sampleOrder.id}`, {
      method: "PATCH",
      headers: { cookie: "tribull_admin=valid", "content-type": "application/json" },
      body: JSON.stringify({ status: "Paid" }),
    });
    expect(invalid.status).toBe(400);
    expect(mocks.updateOrderStatus).not.toHaveBeenCalled();

    const updated = await fetch(`${baseUrl}/api/orders/${sampleOrder.id}`, {
      method: "PATCH",
      headers: { cookie: "tribull_admin=valid", "content-type": "application/json" },
      body: JSON.stringify({ status: "Shipped" }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ id: sampleOrder.id, status: "Shipped" });
    expect(mocks.updateOrderStatus).toHaveBeenCalledWith(sampleOrder.id, "Shipped");
  });
});
