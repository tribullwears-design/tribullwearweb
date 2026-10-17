import { describe, expect, it } from "vitest";
import { filterOrders, getDashboardMetrics, paginate, type DashboardOrder } from "./adminDashboardData";

const orders: DashboardOrder[] = [
  {
    id: "paid-today",
    createdAt: "2026-10-15T08:00:00.000Z",
    status: "Delivered",
    total: 1200,
    payment: { status: "Paid" },
    customer: { email: "one@example.com" },
    items: [{ id: "shirt", name: "Tribull Tee", quantity: 2, lineTotal: 1200 }],
  },
  {
    id: "simulated-today",
    createdAt: "2026-10-15T09:00:00.000Z",
    status: "Pending",
    total: 800,
    payment: { status: "Simulated" },
    paymentMode: "test",
    customer: { email: "two@example.com" },
    items: [{ id: "hoodie", name: "Tribull Hoodie", quantity: 1, lineTotal: 800 }],
  },
  {
    id: "cancelled-today",
    createdAt: "2026-10-15T10:00:00.000Z",
    status: "Cancelled",
    total: 500,
    payment: { status: "Paid" },
    customer: { email: "one@example.com" },
    items: [{ id: "shirt", name: "Tribull Tee", quantity: 1, lineTotal: 500 }],
  },
  {
    id: "paid-yesterday",
    createdAt: "2026-10-14T08:00:00.000Z",
    status: "Delivered",
    total: 400,
    payment: { status: "Paid" },
    customer: { email: "three@example.com" },
    items: [{ id: "shirt", name: "Tribull Tee", quantity: 1, lineTotal: 400 }],
  },
];

describe("getDashboardMetrics", () => {
  it("counts the selected day but excludes test and cancelled payments from sales", () => {
    expect(getDashboardMetrics(orders, "Today", new Date("2026-10-15T12:00:00")).verifiedSales).toBe(1200);
    expect(getDashboardMetrics(orders, "Today", new Date("2026-10-15T12:00:00"))).toMatchObject({
      orderCount: 3,
      pendingOrders: 1,
      customerCount: 2,
      bestSellers: [{ id: "shirt", quantity: 2, revenue: 1200 }],
    });
  });

  it("uses the selected reporting range for order and sales summaries", () => {
    expect(getDashboardMetrics(orders, "Yesterday", new Date("2026-10-15T12:00:00"))).toMatchObject({
      orderCount: 1,
      verifiedSales: 400,
    });
    expect(getDashboardMetrics(orders, "Last 7 days", new Date("2026-10-15T12:00:00")).orderCount).toBe(4);
  });
});

describe("paginate", () => {
  it("returns bounded pages and preserves item order", () => {
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual({
      items: [3, 4],
      page: 2,
      totalPages: 3,
      totalItems: 5,
    });
    expect(paginate([1, 2, 3], 9, 2)).toEqual({
      items: [3],
      page: 2,
      totalPages: 2,
      totalItems: 3,
    });
  });

  describe("filterOrders", () => {
    const searchableOrders = orders.map((order) => ({
      ...order,
      customer: {
        name: order.customer.email === "one@example.com" ? "Asha Kumar" : "Ravi Shah",
        email: order.customer.email,
        phone: "9876543210",
      },
      payment: { ...order.payment, method: "UPI" },
    }));

    it("searches order identifiers, customer details, payment data, status, and product names", () => {
      expect(filterOrders(searchableOrders, "hoodie", "", "All time")).toHaveLength(1);
      expect(filterOrders(searchableOrders, "asha", "", "All time")).toHaveLength(2);
      expect(filterOrders(searchableOrders, "upi", "", "All time")).toHaveLength(4);
      expect(filterOrders(searchableOrders, "delivered", "", "All time")).toHaveLength(2);
    });

    it("combines status and date filters and excludes invalid dates", () => {
      const withInvalidDate = [...searchableOrders, { ...searchableOrders[0], id: "invalid-date", createdAt: "invalid" }];
      expect(filterOrders(withInvalidDate, "", "Delivered", "Last 7 days", Date.parse("2026-10-15T12:00:00Z")).map(({ id }) => id)).toEqual([
        "paid-today",
        "paid-yesterday",
      ]);
      expect(filterOrders(searchableOrders, "", "pending", "All time").map(({ id }) => id)).toEqual(["simulated-today"]);
    });

    it("routes every supported order status to its matching admin section", () => {
      const statuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"] as const;
      const statusOrders = statuses.map((status) => ({ ...searchableOrders[0], id: status, status }));

      for (const status of statuses) {
        expect(filterOrders(statusOrders, "", status.toLowerCase(), "All time").map(({ status: result }) => result))
          .toEqual([status]);
      }
    });
  });
});
