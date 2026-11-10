import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({ getDatabase: vi.fn(), collection: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() }));
vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { getFeatureImage, listFeatureImages, saveFeatureImage } from "./featureImageStore.js";

async function createPngDataUrl() {
  const image = await sharp({
    create: { width: 40, height: 30, channels: 3, background: { r: 45, g: 90, b: 125 } },
  }).png().toBuffer();
  return `data:image/png;base64,${image.toString("base64")}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collection.mockImplementation((name: string) => ({
    findOne: (...args: unknown[]) => mocks.findOne(name, ...args),
    updateOne: (...args: unknown[]) => mocks.updateOne(name, ...args),
  }));
  mocks.getDatabase.mockResolvedValue({ collection: mocks.collection });
});

describe("feature image storage", () => {
  it("reads the images from their separate named collections", async () => {
    mocks.findOne.mockImplementation((collection: string) =>
      Promise.resolve(collection === "customize-image"
        ? { _id: "current", imageOptimized: true, updatedAt: "2026-01-02T03:04:05.000Z" }
        : null));

    await expect(listFeatureImages()).resolves.toEqual({
      customize: "/api/storefront/feature-images/customize?v=2026-01-02T03%3A04%3A05.000Z",
      corporate: null,
    });
    expect(mocks.findOne).toHaveBeenCalledWith("customize-image", { _id: "current" }, { projection: { _id: 1, imageOptimized: 1, updatedAt: 1 } });
    expect(mocks.findOne).toHaveBeenCalledWith("corporate-image", { _id: "current" }, { projection: { _id: 1, imageOptimized: 1, updatedAt: 1 } });
  });

  it("caches image bytes after the first database read", async () => {
    const image = await createPngDataUrl();
    mocks.findOne.mockResolvedValue({ image });

    const first = await getFeatureImage("customize");
    const second = await getFeatureImage("customize");
    expect(first?.mimeType).toBe("image/png");
    expect(first?.data).toEqual(second?.data);
    expect(mocks.findOne).toHaveBeenCalledWith(
      "customize-image",
      { _id: "current" },
      { projection: { image: 1 } },
    );
    expect(mocks.findOne).toHaveBeenCalledTimes(1);
  });

  it("upserts each supported image into its matching collection", async () => {
    const image = await createPngDataUrl();

    await expect(saveFeatureImage("corporate", image)).resolves.toEqual(expect.objectContaining({
      type: "corporate",
      image: expect.stringMatching(/^\/api\/storefront\/feature-images\/corporate\?v=/),
    }));
    expect(mocks.updateOne).toHaveBeenCalledWith(
      "corporate-image",
      { _id: "current" },
      {
        $set: {
          image: expect.stringMatching(/^data:image\/webp;base64,/),
          imageOptimized: true,
          updatedAt: expect.any(String),
        },
      },
      { upsert: true },
    );
  });

  it("optimizes legacy images and changes their versioned URL", async () => {
    const image = await createPngDataUrl();
    mocks.findOne.mockImplementation((_collection: string, _filter: unknown, options?: { projection?: { image?: number } }) =>
      Promise.resolve(options?.projection?.image ? { image } : {
        _id: "current",
        imageOptimized: false,
        updatedAt: "2026-01-02T03:04:05.000Z",
      }));

    const images = await listFeatureImages();

    expect(images.customize).toMatch(/^\/api\/storefront\/feature-images\/customize\?v=/);
    expect(images.customize).not.toContain("2026-01-02");
    expect(mocks.updateOne).toHaveBeenCalledWith(
      "customize-image",
      { _id: "current" },
      {
        $set: {
          image: expect.stringMatching(/^data:image\/webp;base64,/),
          imageOptimized: true,
          updatedAt: expect.any(String),
        },
      },
    );
  });

  it("rejects non-image values before accessing MongoDB", async () => {
    await expect(saveFeatureImage("customize", "https://example.com/image.png")).rejects.toThrow("Upload a JPG, PNG, or WEBP image");
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });
});
