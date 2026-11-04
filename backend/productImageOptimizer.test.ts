import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { optimizeProductImageForStorefront } from "./productImageOptimizer.js";

describe("storefront product image optimization", () => {
  it("resizes large product images and encodes them as WebP", async () => {
    const source = await sharp({
      create: {
        width: 1400,
        height: 900,
        channels: 3,
        background: "#247a4b",
      },
    }).png().toBuffer();
    const dataUrl = `data:image/png;base64,${source.toString("base64")}`;

    const optimized = await optimizeProductImageForStorefront(dataUrl, 960);
    const metadata = await sharp(optimized).metadata();

    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(960);
    expect(metadata.height).toBe(617);
  });

  it("rejects images that are not base64 data URLs", async () => {
    await expect(optimizeProductImageForStorefront("https://example.com/image.png", 640))
      .rejects.toThrow("Product image format is not supported");
  });

  it("only accepts supported storefront widths", async () => {
    await expect(optimizeProductImageForStorefront("data:image/png;base64,aGVsbG8=", 700))
      .rejects.toThrow("Product image width is invalid");
  });
});
