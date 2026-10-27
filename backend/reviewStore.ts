import { randomUUID } from "node:crypto";
import type { Collection } from "mongodb";
import { getDatabase } from "./database.js";

const MAX_REVIEW_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PUBLIC_REVIEWS = 20;

export type ReviewDocument = {
  id: string;
  customerName: string;
  productName: string;
  rating: number;
  comment: string;
  photo?: { mimeType: string; data: string };
  createdAt: string;
};

export class ReviewValidationError extends Error {}

async function getCollection(): Promise<Collection<ReviewDocument>> {
  const collection = (await getDatabase()).collection<ReviewDocument>("reviews");
  await Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ createdAt: -1 }),
  ]);
  return collection;
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maxLength) {
    throw new ReviewValidationError(`${label} is required and must be ${maxLength} characters or fewer`);
  }
  return text;
}

function readPhoto(value: unknown): ReviewDocument["photo"] {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > Math.ceil(MAX_REVIEW_PHOTO_BYTES * 4 / 3) + 128) {
    throw new ReviewValidationError("Photo must be smaller than 5 MB");
  }

  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match?.[1] || !match[2]) {
    throw new ReviewValidationError("Upload a JPG, PNG, or WEBP photo");
  }
  const encoded = match[2];
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 1 || bytes.length > MAX_REVIEW_PHOTO_BYTES || bytes.toString("base64") !== encoded) {
    throw new ReviewValidationError("Photo must be smaller than 5 MB and use a valid image format");
  }

  const mimeType = `image/${match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase()}`;
  const isJpeg = mimeType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = mimeType === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = mimeType === "image/webp"
    && bytes.toString("ascii", 0, 4) === "RIFF"
    && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) {
    throw new ReviewValidationError("The uploaded file is not a valid JPG, PNG, or WEBP image");
  }
  return { mimeType, data: encoded };
}

function validateReview(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReviewValidationError("Review details are required");
  }
  const input = value as Record<string, unknown>;
  const rating = input.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewValidationError("Choose a rating from 1 to 5 stars");
  }
  const comment = requiredText(input.comment, "Review", 1000);
  if (comment.length < 5) throw new ReviewValidationError("Review must be at least 5 characters long");
  const photo = readPhoto(input.photo);
  return {
    customerName: requiredText(input.customerName, "Name", 80),
    productName: requiredText(input.productName, "Product name", 120),
    rating,
    comment,
    ...(photo ? { photo } : {}),
  };
}

export async function createReview(value: unknown) {
  const review: ReviewDocument = {
    id: randomUUID(),
    ...validateReview(value),
    createdAt: new Date().toISOString(),
  };
  await (await getCollection()).insertOne(review);
  const { photo: _photo, ...publicReview } = review;
  return {
    ...publicReview,
    ...(review.photo ? { photoUrl: `/api/reviews/${review.id}/photo` } : {}),
  };
}

export async function listPublicReviews() {
  const reviews = await (await getCollection())
    .find({}, { projection: { _id: 0, "photo.data": 0 } })
    .sort({ createdAt: -1 })
    .limit(MAX_PUBLIC_REVIEWS)
    .toArray();
  return reviews.map(({ id, photo, ...review }) => ({
    id,
    ...review,
    ...(photo ? { photoUrl: `/api/reviews/${id}/photo` } : {}),
  }));
}

export async function getReviewPhoto(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
  const review = await (await getCollection()).findOne({ id }, { projection: { _id: 0, photo: 1 } });
  if (!review?.photo) return null;
  return { mimeType: review.photo.mimeType, data: Buffer.from(review.photo.data, "base64") };
}
