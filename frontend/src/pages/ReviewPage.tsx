import { ArrowLeft, CheckCircle2, Star, Upload } from "lucide-react";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link } from "wouter";
import { optimizeImageForUpload } from "../lib/optimizeImage";
import { submitReview } from "../lib/reviews";
import "./ReviewPage.css";

export default function ReviewPage() {
  const [customerName, setCustomerName] = useState("");
  const [productName, setProductName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      event.target.value = "";
      return;
    }
    setError("");
    try {
      setPhoto(await optimizeImageForUpload(file));
      setPhotoName(file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The photo could not be prepared.");
      setPhoto("");
      setPhotoName("");
      event.target.value = "";
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rating) {
      setError("Please choose a star rating.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await submitReview({
        customerName,
        productName,
        rating,
        comment,
        ...(photo ? { photo } : {}),
      });
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your review could not be submitted.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="review-page">
      <a className="review-page__back" href="/" aria-label="Back to Tribull home">
        <ArrowLeft size={17} /> Tribull
      </a>
      <section className="review-card" aria-labelledby="review-title">
        <img className="review-card__logo" src="/products/logo.png" alt="Tribull" />
        {submitted ? (
          <div className="review-success" role="status">
            <CheckCircle2 size={48} aria-hidden="true" />
            <h1 id="review-title">Thank you for sharing!</h1>
            <p>Your review has been submitted and will appear on the Tribull home page.</p>
            <Link href="/" className="review-primary-button">Continue shopping</Link>
          </div>
        ) : (
          <>
            <p className="review-card__eyebrow">YOUR FEEDBACK MATTERS</p>
            <h1 id="review-title">How did we do?</h1>
            <p className="review-card__intro">Tell us about your Tribull purchase. Your review will appear on the Tribull website.</p>
            <form className="review-form" onSubmit={(event) => void handleSubmit(event)}>
              <label>
                <span>Your name</span>
                <input
                  autoComplete="name"
                  required
                  maxLength={80}
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Enter your name"
                />
              </label>
              <label>
                <span>Product name</span>
                <input
                  required
                  maxLength={120}
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  placeholder="Which product did you buy?"
                />
              </label>
              <fieldset className="review-rating">
                <legend>Your rating</legend>
                <div className="review-rating__stars" role="group" aria-label="Choose a star rating">
                  {Array.from({ length: 5 }, (_, index) => {
                    const value = index + 1;
                    return (
                      <button
                        key={value}
                        className={value <= rating ? "is-selected" : ""}
                        type="button"
                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                        aria-pressed={rating === value}
                        onClick={() => setRating(value)}
                      >
                        <Star size={30} fill={value <= rating ? "currentColor" : "none"} />
                      </button>
                    );
                  })}
                  <span>{rating ? `${rating} out of 5` : "Tap to rate"}</span>
                </div>
              </fieldset>
              <label>
                <span>Your experience</span>
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={4}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="What did you like about the product?"
                />
              </label>
              <label className="review-photo">
                <span>Photo <small>(optional)</small></span>
                <span className="review-photo__picker">
                  <Upload size={18} />
                  {photoName || "Take or choose a photo"}
                </span>
                <input type="file" accept="image/*" capture="environment" onChange={(event) => void handlePhoto(event)} />
                {photo && <img className="review-photo__preview" src={photo} alt="Review upload preview" />}
              </label>
              {error && <p className="review-form__error" role="alert">{error}</p>}
              <button className="review-primary-button" type="submit" disabled={saving}>
                {saving ? "Submitting..." : "Submit review"}
              </button>
              <p className="review-form__privacy">Your review and any photo you add may be shown on our website.</p>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
