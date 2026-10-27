import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  createIndex: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  getDatabase: vi.fn(),
  insertOne: vi.fn(),
  limit: vi.fn(),
  sort: vi.fn(),
  reviews: [] as Array<Record<string, unknown>>,
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { createReview, getReviewPhoto, listPublicReviews } from "./reviewStore.js";

describe("customer reviews", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.reviews = [];
    mocks.createIndex.mockResolvedValue(undefined);
    mocks.insertOne.mockResolvedValue(undefined);
    mocks.find.mockImplementation(() => ({ sort: mocks.sort }));
    mocks.sort.mockImplementation(() => ({ limit: mocks.limit }));
    mocks.limit.mockImplementation(() => ({ toArray: async () => mocks.reviews }));
    mocks.findOne.mockImplementation(async ({ id }: { id: string }) =>
      mocks.reviews.find((review) => review.id === id) || null);
    mocks.collection.mockReturnValue({
      createIndex: mocks.createIndex,
      find: mocks.find,
      findOne: mocks.findOne,
      insertOne: mocks.insertOne,
    });
    mocks.getDatabase.mockResolvedValue({ collection: mocks.collection });
  });

  it("saves a review without a photo and returns its public fields", async () => {
    const result = await createReview({
      customerName: "  Asha  ",
      productName: " Everyday Tee ",
      rating: 5,
      comment: "The fit is great!",
    });

    expect(result).toMatchObject({
      customerName: "Asha",
      productName: "Everyday Tee",
      rating: 5,
      comment: "The fit is great!",
    });
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result).not.toHaveProperty("photo");
    expect(mocks.insertOne).toHaveBeenCalledWith(expect.objectContaining({ id: result.id, createdAt: expect.any(String) }));
  });

  it("saves validated customer photo data without exposing it in review lists", async () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
    const result = await createReview({
      customerName: "Asha",
      productName: "Everyday Tee",
      rating: 4,
      comment: "Soft cotton and nice fit.",
      photo: `data:image/png;base64,${png.toString("base64")}`,
    });
    const savedReview = mocks.insertOne.mock.calls[0]?.[0] as Record<string, unknown>;
    mocks.reviews = [savedReview];

    await expect(listPublicReviews()).resolves.toMatchObject([{
      id: result.id,
      photoUrl: `/api/reviews/${result.id}/photo`,
    }]);
    expect(mocks.find).toHaveBeenCalledWith({}, { projection: { _id: 0, "photo.data": 0 } });
    await expect(getReviewPhoto(result.id)).resolves.toMatchObject({ mimeType: "image/png", data: png });
  });

  it.each([
    [{ customerName: "", productName: "Tee", rating: 5, comment: "Nice one" }, "Name is required"],
    [{ customerName: "Asha", productName: "", rating: 5, comment: "Nice one" }, "Product name is required"],
    [{ customerName: "Asha", productName: "Tee", rating: 0, comment: "Nice one" }, "Choose a rating"],
    [{ customerName: "Asha", productName: "Tee", rating: 6, comment: "Nice one" }, "Choose a rating"],
    [{ customerName: "Asha", productName: "Tee", rating: 5, comment: "No" }, "at least 5 characters"],
    [{ customerName: "Asha", productName: "Tee", rating: 5, comment: "Great product", photo: "data:image/svg+xml;base64,PHN2Zz4=" }, "Upload a JPG, PNG, or WEBP photo"],
  ])("rejects invalid review submissions", async (review, error) => {
    await expect(createReview(review)).rejects.toThrow(error);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it("returns no photo for missing or invalid review identifiers", async () => {
    await expect(getReviewPhoto("../not-an-id")).resolves.toBeNull();
    expect(mocks.findOne).not.toHaveBeenCalled();
    await expect(getReviewPhoto("123e4567-e89b-12d3-a456-426614174000")).resolves.toBeNull();
    expect(mocks.findOne).toHaveBeenCalledOnce();
  });
});
