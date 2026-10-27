import { apiFetch } from "./api";

export type PublicReview = {
  id: string;
  customerName: string;
  productName: string;
  rating: number;
  comment: string;
  photoUrl?: string;
  createdAt: string;
};

export type ReviewSubmission = Omit<PublicReview, "id" | "createdAt" | "photoUrl"> & {
  photo?: string;
};

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
  return body?.error || fallback;
}

export async function fetchPublicReviews() {
  const response = await apiFetch("/api/reviews", { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response, "Unable to load reviews"));
  return await response.json() as PublicReview[];
}

export async function submitReview(review: ReviewSubmission) {
  const response = await apiFetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(review),
  });
  if (!response.ok) throw new Error(await readError(response, "Unable to submit your review"));
  return await response.json() as PublicReview;
}
