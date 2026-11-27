import { ArrowLeft, CheckCircle2, Star, Upload } from "lucide-react";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link } from "wouter";
import { optimizeImageForUpload } from "../lib/optimizeImage";
import { submitReview } from "../lib/reviews";
import "./ReviewPage.css";

const MAX_REVIEW_PHOTOS = 5;
const MAX_REVIEW_PHOTO_BYTES = 1_200_000;

export default function ReviewPage() {
  const [customerName, setCustomerName] = useState("");
  const [productName, setProductName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (files.some((file) => !file.type.startsWith("image/"))) {
      setError("Please choose an image file.");
      return;
    }
    if (photos.length + files.length > MAX_REVIEW_PHOTOS) {
      setError(`You can add up to ${MAX_REVIEW_PHOTOS} photos.`);
      return;
    }
    setError("");
    setProcessingPhotos(true);
    try {
      const optimizedPhotos: string[] = [];
      for (const file of files) {
        optimizedPhotos.push(await optimizeImageForUpload(file, MAX_REVIEW_PHOTO_BYTES));
      }
      setPhotos((current) => [...current, ...optimizedPhotos]);
      setPhotoNames((current) => [...current, ...files.map((file) => file.name)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The photo could not be prepared.");
    } finally {
      setProcessingPhotos(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
    setPhotoNames((current) => current.filter((_, photoIndex) => photoIndex !== index));
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
        ...(photos.length ? { photos } : {}),
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
              <div className="review-photo">
                <span>Photos <small>(optional, up to {MAX_REVIEW_PHOTOS})</small></span>
                <label className="review-photo__picker" htmlFor="review-photos">
                  <Upload size={18} />
                  {processingPhotos ? "Preparing photos..." : photoNames.length ? `${photoNames.length} photo${photoNames.length === 1 ? "" : "s"} selected` : "Choose photos"}
                </label>
                <input id="review-photos" type="file" accept="image/*" multiple disabled={processingPhotos || photos.length >= MAX_REVIEW_PHOTOS} onChange={(event) => void handlePhoto(event)} />
                {photos.length > 0 && (
                  <div className="review-photo__previews">
                    {photos.map((photo, index) => (
                      <div className="review-photo__preview-item" key={`${photoNames[index]}-${index}`}>
                        <img className="review-photo__preview" src={photo} alt={`Review upload preview ${index + 1}`} />
                        <button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => removePhoto(index)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {error && <p className="review-form__error" role="alert">{error}</p>}
              <button className="review-primary-button" type="submit" disabled={saving || processingPhotos}>
                {processingPhotos ? "Preparing photos..." : saving ? "Submitting..." : "Submit review"}
              </button>
              <p className="review-form__privacy">Your review and any photo you add may be shown on our website.</p>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
