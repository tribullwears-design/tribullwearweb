import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { getAdminAnalytics, isDashboardRange } from "./adminAnalyticsStore.js";
import { getDashboardRangeBounds } from "../shared/adminAnalytics.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDatabase.mockResolvedValue({
    collection: vi.fn(() => ({ find: mocks.find })),
  });
});

describe("isDashboardRange", () => {
  it.each(["Today", "Yesterday", "Last 7 days", "Last 30 days"])("accepts %s", (range) => {
    expect(isDashboardRange(range)).toBe(true);
  });

  it.each(["All time", "", null, 7])("rejects invalid range %s", (range) => {
    expect(isDashboardRange(range)).toBe(false);
  });
});

describe("getAdminAnalytics", () => {
  it("queries the orders collection for the selected window and returns verified metrics", async () => {
    const orders = [
      {
        id: "paid",
        createdAt: "2026-10-15T08:00:00.000Z",
        status: "Delivered",
        total: 1200,
        payment: { status: "Paid" },
        customer: { email: "buyer@example.com" },
        items: [{ id: "tee", name: "Tribull Tee", quantity: 2, lineTotal: 1200 }],
      },
      {
        id: "test",
        createdAt: "2026-10-15T09:00:00.000Z",
        status: "Pending",
        total: 800,
        payment: { status: "Simulated" },
        paymentMode: "test",
        customer: { email: "test@example.com" },
        items: [{ id: "hoodie", name: "Tribull Hoodie", quantity: 1, lineTotal: 800 }],
      },
    ];
    mocks.find.mockReturnValue({ toArray: vi.fn().mockResolvedValue(orders) });

    const metrics = await getAdminAnalytics("Today", new Date("2026-10-15T12:00:00.000Z"));
    const bounds = getDashboardRangeBounds("Today", new Date("2026-10-15T12:00:00.000Z"));

    expect(mocks.getDatabase).toHaveBeenCalledOnce();
    expect(mocks.find).toHaveBeenCalledWith(
      { createdAt: { $gte: bounds.start.toISOString(), $lte: bounds.end.toISOString() } },
      expect.objectContaining({ projection: expect.objectContaining({ "customer.email": 1, items: 1 }) }),
    );
    expect(metrics).toMatchObject({
      orderCount: 2,
      pendingOrders: 1,
      customerCount: 2,
      verifiedSales: 1200,
      bestSellers: [{ id: "tee", quantity: 2, revenue: 1200 }],
    });
  });
});
