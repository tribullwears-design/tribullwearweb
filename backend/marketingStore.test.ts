import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateOfferDiscount, createOffer, findActiveDiscount, OfferConflictError, OfferValidationError, validateOffer } from "./marketingStore.js";

const mocks = vi.hoisted(() => ({
  createIndex: vi.fn(),
  findOne: vi.fn(),
  insertOne: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDatabase.mockResolvedValue({
    collection: () => ({
      createIndex: mocks.createIndex,
      findOne: mocks.findOne,
      insertOne: mocks.insertOne,
    }),
  });
  mocks.findOne.mockResolvedValue(null);
});

const coupon = {
  kind: "coupon",
  name: "Launch offer",
  code: "launch-10",
  discountType: "percentage",
  value: 10,
  minimumOrderAmount: 500,
  startsAt: "2026-10-01T00:00:00.000Z",
  endsAt: "2026-11-01T00:00:00.000Z",
  isActive: true,
};

describe("validateOffer", () => {
  it("normalizes coupons and validates amount and period", () => {
    expect(validateOffer(coupon, "coupon")).toMatchObject({ ...coupon, code: "LAUNCH-10" });
  });

  it.each([
    [{ ...coupon, value: 101 }, "Percentage"],
    [{ ...coupon, code: "bad code" }, "Coupon code"],
    [{ ...coupon, endsAt: "2026-09-01T00:00:00.000Z" }, "End date"],
    [{ ...coupon, kind: "discount" }, "does not match"],
  ])("rejects invalid offer configuration", (input, message) => {
    expect(() => validateOffer(input, "coupon")).toThrow(message);
  });

  it("does not allow coupon codes on other offer types", () => {
    expect(() => validateOffer({ ...coupon, kind: "discount" }, "discount")).toThrow("Only coupons can have a code");
  });
});

describe("createOffer", () => {
  it("persists the normalized code and rejects duplicate codes", async () => {
    const saved = await createOffer("coupon", coupon);
    expect(saved).toMatchObject({ ...coupon, code: "LAUNCH-10", codeKey: "LAUNCH-10" });
    expect(mocks.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      id: saved.id,
      codeKey: "LAUNCH-10",
      createdAt: expect.any(String),
    }));

    mocks.findOne.mockResolvedValue({ _id: "duplicate" });
    await expect(createOffer("coupon", coupon)).rejects.toBeInstanceOf(OfferConflictError);
  });

  it("rejects malformed input before writing", async () => {
    await expect(createOffer("coupon", { ...coupon, value: -1 })).rejects.toBeInstanceOf(OfferValidationError);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});

describe("discount offers", () => {
  it("calculates percentage and fixed discounts without exceeding the order amount", () => {
    expect(calculateOfferDiscount({ discountType: "percentage", value: 20 }, 1000)).toBe(200);
    expect(calculateOfferDiscount({ discountType: "fixed", value: 1500 }, 1000)).toBe(1000);
  });

  it("loads only active, currently valid discount offers", async () => {
    mocks.findOne.mockResolvedValue({ id: "discount-1", kind: "discount", isActive: true, value: 20, discountType: "percentage", startsAt: null, endsAt: null });
    await expect(findActiveDiscount("discount-1", new Date("2026-10-18T00:00:00.000Z"))).resolves.toMatchObject({ id: "discount-1", kind: "discount" });
    expect(mocks.findOne).toHaveBeenCalledWith({ id: "discount-1", kind: "discount", isActive: true }, { projection: { _id: 0 } });
  });
});
