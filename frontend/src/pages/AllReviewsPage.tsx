import { ArrowLeft, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import StorefrontHeader from "../components/StorefrontHeader";
import { fetchPublicReviews, type PublicReview } from "../lib/reviews";
import { fetchProducts, type StorefrontProduct } from "../lib/products";
import { getShowcaseProductImage } from "../lib/storefrontProductImage";
import "./AllReviewsPage.css";

function formatReviewDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function AllReviewsPage() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void fetchProducts().then((items) => {
      if (active) setProducts(items);
    }).catch((cause: unknown) => {
      console.error("Could not load products for customer reviews.", cause);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void fetchPublicReviews().then((items) => {
      if (active) setReviews(items);
    }).catch((cause: unknown) => {
      console.error("Could not load all customer reviews.", cause);
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load reviews right now.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadAttempt]);

  return (
    <>
      <StorefrontHeader />
      <main className="all-reviews-page">
        <header className="all-reviews-page__header">
          <Link className="all-reviews-page__back" href="/">
            <ArrowLeft size={17} /> Back to Tribull
          </Link>
          <Link className="review-primary-button" href="/review">Write a review</Link>
        </header>

        <section className="all-reviews-page__content" aria-labelledby="all-reviews-heading">
          <p className="all-reviews-page__eyebrow">CUSTOMER FEEDBACK</p>
          <h1 id="all-reviews-heading">All customer reviews</h1>
          <p className="all-reviews-page__intro">Real feedback from the Tribull community.</p>

          {loading && <p className="all-reviews-page__message" role="status">Loading reviews...</p>}
          {!loading && error && (
            <div className="all-reviews-page__message" role="alert">
              <p>{error}</p>
              <button className="review-primary-button" type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                Try again
              </button>
            </div>
          )}
          {!loading && !error && reviews.length === 0 && (
            <div className="all-reviews-page__message">
              <p>No customer reviews yet. Be the first to share your experience.</p>
              <Link className="review-primary-button" href="/review">Write a review</Link>
            </div>
          )}
          {!loading && !error && reviews.length > 0 && (
            <div className="all-reviews-page__grid">
              {reviews.map((review, index) => {
                const product = products.find((item) => item.name.trim().toLowerCase() === review.productName.trim().toLowerCase());
                return (
                  <article className="all-reviews-page__card" key={review.id}>
                    <Link
                      className="all-reviews-page__product"
                      href={product ? `/product/${encodeURIComponent(product.id)}` : "/products"}
                      aria-label={`View ${review.productName}`}
                    >
                      <img
                        className="all-reviews-page__image"
                        src={product?.image || getShowcaseProductImage(index)}
                        alt={review.productName}
                        loading="lazy"
                        decoding="async"
                      />
                    </Link>
                    <div className="all-reviews-page__details">
                      <div className="all-reviews-page__title">
                        <h2>{review.customerName}</h2>
                        <span className="all-reviews-page__date">{formatReviewDate(review.createdAt)}</span>
                      </div>
                      <div className="customer-review-card__stars" aria-label={`${review.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }, (_, starIndex) => (
                          <Star key={starIndex} size={16} fill={starIndex < review.rating ? "currentColor" : "none"} aria-hidden="true" />
                        ))}
                      </div>
                      <p className="customer-review-card__product">{review.productName}</p>
                      <p className="customer-review-card__comment">“{review.comment}”</p>
                      {review.photoUrl && (
                        <img
                          className="all-reviews-page__customer-photo"
                          src={review.photoUrl}
                          alt={`${review.customerName}'s photo with their ${review.productName} review`}
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
