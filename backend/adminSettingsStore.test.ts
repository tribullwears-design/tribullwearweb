import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultGeneralSettings,
  defaultSocialSettings,
  getGeneralSettings,
  saveGeneralSettings,
  saveFeaturedProductIds,
  saveSocialSettings,
  validateFeaturedProductIds,
  validateGeneralSettings,
  validateSocialSettings,
} from "./adminSettingsStore.js";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  getDatabase: vi.fn(),
  getProduct: vi.fn(),
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("./productStore.js", () => ({ getProduct: mocks.getProduct }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDatabase.mockResolvedValue({
    collection: () => ({ findOne: mocks.findOne, updateOne: mocks.updateOne }),
  });
  mocks.findOne.mockResolvedValue(null);
});

describe("admin settings validation", () => {
  it("accepts valid general settings with the store-supported currency", () => {
    expect(validateGeneralSettings({ ...defaultGeneralSettings, storeName: "Tribull", email: "shop@example.com" })).toEqual({
      storeName: "Tribull",
      email: "shop@example.com",
      phone: "",
      currency: "INR",
    });
  });

  it("rejects unsupported currencies and unknown settings", () => {
    expect(() => validateGeneralSettings({ ...defaultGeneralSettings, currency: "USD" })).toThrow("Only INR is supported");
    expect(() => validateGeneralSettings({ ...defaultGeneralSettings, isOnline: false })).toThrow("Unsupported general setting");
  });

  it("allows only HTTPS social URLs and preserves current store links by default", () => {
    expect(validateSocialSettings(defaultSocialSettings)).toEqual(defaultSocialSettings);
    expect(() => validateSocialSettings({ ...defaultSocialSettings, instagram: "javascript:alert(1)" })).toThrow("must use HTTPS");
  });

  it("rejects malformed and duplicate featured product IDs", () => {
    expect(validateFeaturedProductIds(["abc", "product_2"])).toEqual(["abc", "product_2"]);
    expect(() => validateFeaturedProductIds(["same", "same"])).toThrow("must be unique");
    expect(() => validateFeaturedProductIds(["a", 2])).toThrow("valid product IDs");
  });

  it("reads defaults without creating or replacing saved configuration", async () => {
    await expect(getGeneralSettings()).resolves.toEqual(defaultGeneralSettings);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("persists validated settings as keyed documents", async () => {
    const social = { ...defaultSocialSettings, linkedin: "https://www.linkedin.com/company/tribull/" };
    await expect(saveSocialSettings(social)).resolves.toEqual(social);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: "social" },
      { $set: { value: social, updatedAt: expect.any(String) } },
      { upsert: true },
    );
    await saveGeneralSettings(defaultGeneralSettings);
    expect(mocks.updateOne).toHaveBeenLastCalledWith(
      { _id: "general" },
      { $set: { value: defaultGeneralSettings, updatedAt: expect.any(String) } },
      { upsert: true },
    );
  });

  it("persists featured product IDs only after every product is active", async () => {
    mocks.getProduct.mockResolvedValue({ id: "shirt-1", status: "Active" });

    await expect(saveFeaturedProductIds(["shirt-1"])).resolves.toEqual(["shirt-1"]);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: "featured" },
      { $set: { value: ["shirt-1"], updatedAt: expect.any(String) } },
      { upsert: true },
    );

    mocks.getProduct.mockResolvedValue({ id: "shirt-1", status: "Draft" });
    mocks.updateOne.mockClear();
    await expect(saveFeaturedProductIds(["shirt-1"])).rejects.toThrow("missing or inactive");
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});
