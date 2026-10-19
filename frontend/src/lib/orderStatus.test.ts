import { describe, expect, it } from "vitest";
import { getOrderStatusDisplay } from "./orderStatus";

describe("getOrderStatusDisplay", () => {
  it.each([
    ["Pending", "Order Placed", "placed"],
    ["Order Placed", "Order Placed", "placed"],
    ["Processing", "Processing", "processing"],
    ["Shipped", "Shipped", "shipped"],
    ["Delivered", "Delivered", "delivered"],
    ["Cancelled", "Cancelled", "cancelled"],
    ["Canceled", "Cancelled", "cancelled"],
  ] as const)("normalizes %s for display", (status, label, tone) => {
    expect(getOrderStatusDisplay(status)).toMatchObject({ label, tone });
  });

  it("normalizes capitalization and surrounding whitespace", () => {
    expect(getOrderStatusDisplay("  pRoCeSsInG ")).toMatchObject({ label: "Processing", tone: "processing" });
  });

  it("uses a safe neutral badge for an unknown status", () => {
    expect(getOrderStatusDisplay("Returned"))
      .toEqual({ label: "Status unavailable", tone: "unknown", progressStatus: null });
  });
});
