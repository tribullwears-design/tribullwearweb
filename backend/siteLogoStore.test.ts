import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDatabase: vi.fn(), collection: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() }));
vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { getSiteLogoImage, getSiteLogoUrl, saveSiteLogo } from "./siteLogoStore.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collection.mockReturnValue({
    findOne: mocks.findOne,
    updateOne: mocks.updateOne,
  });
  mocks.getDatabase.mockResolvedValue({ collection: mocks.collection });
});

describe("site logo storage", () => {
  it("returns a cache-busted public URL for the saved logo", async () => {
    mocks.findOne.mockResolvedValue({ _id: "logo", image: "data:image/png;base64,aGVsbG8=", updatedAt: "2026-01-02T03:04:05.000Z" });

    await expect(getSiteLogoUrl()).resolves.toBe("/api/storefront/logo/image?v=2026-01-02T03%3A04%3A05.000Z");
  });

  it("returns the saved logo as image bytes", async () => {
    mocks.findOne.mockResolvedValue({ _id: "logo", image: "data:image/png;base64,aGVsbG8=", updatedAt: "now" });

    await expect(getSiteLogoImage()).resolves.toEqual({ mimeType: "image/png", data: Buffer.from("hello") });
  });

  it("saves the logo in the shared store branding collection", async () => {
    const image = `data:image/webp;base64,${"a".repeat(32)}`;

    await expect(saveSiteLogo(image)).resolves.toEqual({
      image: expect.stringMatching(/^\/api\/storefront\/logo\/image\?v=/),
    });
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: "logo" },
      { $set: { image, updatedAt: expect.any(String) } },
      { upsert: true },
    );
  });

  it("rejects unsupported logo values before accessing the database", async () => {
    await expect(saveSiteLogo("https://example.com/logo.png")).rejects.toThrow("Upload a JPG, PNG, or WEBP logo");
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });
});
