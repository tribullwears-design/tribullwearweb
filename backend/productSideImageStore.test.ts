import { describe, expect, it } from "vitest";
import {
  MAX_PRODUCT_COLOR_IMAGES,
  MAX_PRODUCT_SIDE_IMAGES,
  ProductSideImageValidationError,
  validateProductColorImage,
  validateProductSideImage,
} from "./productSideImageStore.js";

describe("validateProductSideImage", () => {
  it("accepts supported, well-formed image data", () => {
    expect(() => validateProductSideImage(0, "data:image/webp;base64,aGVsbG8=")).not.toThrow();
  });

  it("limits the gallery to six indexed images", () => {
    expect(MAX_PRODUCT_SIDE_IMAGES).toBe(6);
    expect(() => validateProductSideImage(6, "data:image/webp;base64,aGVsbG8="))
      .toThrow(ProductSideImageValidationError);
  });

  it("rejects unsupported image types and malformed data", () => {
    expect(() => validateProductSideImage(0, "data:image/gif;base64,aGVsbG8="))
      .toThrow(ProductSideImageValidationError);
    expect(() => validateProductSideImage(0, "not-an-image"))
      .toThrow(ProductSideImageValidationError);
  });

  it("rejects invalid indices", () => {
    expect(() => validateProductSideImage(-1, "data:image/webp;base64,aGVsbG8="))
      .toThrow(ProductSideImageValidationError);
    expect(() => validateProductSideImage(1.5, "data:image/webp;base64,aGVsbG8="))
      .toThrow(ProductSideImageValidationError);
  });
});

describe("validateProductColorImage", () => {
  it("accepts a supported image in a normalized color gallery", () => {
    expect(() => validateProductColorImage("black", 4, "data:image/webp;base64,aGVsbG8=")).not.toThrow();
    expect(MAX_PRODUCT_COLOR_IMAGES).toBe(5);
  });

  it("rejects invalid colors and image slots", () => {
    expect(() => validateProductColorImage("Black", 0, "data:image/webp;base64,aGVsbG8="))
      .toThrow(ProductSideImageValidationError);
    expect(() => validateProductColorImage("black", 5, "data:image/webp;base64,aGVsbG8="))
      .toThrow(ProductSideImageValidationError);
  });
});
