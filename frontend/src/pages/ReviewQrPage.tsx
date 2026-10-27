import { ArrowLeft, Download } from "lucide-react";
import "./ReviewPage.css";

export default function ReviewQrPage() {
  const reviewUrl = "https://tribull.in/qr-code";

  return (
    <main className="review-page">
      <a className="review-page__back" href="/" aria-label="Back to Tribull home">
        <ArrowLeft size={17} /> Tribull
      </a>
      <section className="review-card review-qr-card" aria-labelledby="review-qr-title">
        <img className="review-card__logo" src="/products/logo.png" alt="Tribull" />
        <p className="review-card__eyebrow">CUSTOMER FEEDBACK</p>
        <h1 id="review-qr-title">Review our product</h1>
        <p className="review-card__intro">Print this Tribull review card and include it with your orders. Customers can scan it with their phone camera.</p>
        <img
          className="review-qr-card__image"
          src="/tribull-review-our-product.png"
          alt="Tribull review card with a QR code that opens the customer review form"
        />
        <p className="review-qr-card__url">{reviewUrl}</p>
        <div className="review-qr-card__downloads">
          <a className="review-primary-button" href="/tribull-review-our-product.png" download>
            <Download size={18} /> Download print-ready PNG
          </a>
          <a className="review-qr-card__vector-link" href="/tribull-review-our-product.svg" download>
            Download vector SVG
          </a>
        </div>
      </section>
    </main>
  );
}
