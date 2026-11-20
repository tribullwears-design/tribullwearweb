import { Link, useParams } from "wouter";
import StorefrontHeader from "../components/StorefrontHeader";
import { footerPages, type FooterPageSlug } from "../lib/footerPages";

function isFooterPageSlug(slug: string): slug is FooterPageSlug {
  return Object.prototype.hasOwnProperty.call(footerPages, slug);
}

export default function FooterInfoPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const page = isFooterPageSlug(slug) ? footerPages[slug] : null;
  const supportHref = page
    ? `https://wa.me/916385400605?text=${encodeURIComponent(`Hi Tribull, I have a question about ${page.title}.`)}`
    : undefined;

  return (
    <>
      <StorefrontHeader />
      <main className="storefront-faqs footer-info-page">
        <div className="storefront-faqs__content">
          <Link className="storefront-faqs__back" href="/">Back to home</Link>
          {page ? (
            <>
              <p className="storefront-faqs__eyebrow">TRIBULL INFORMATION</p>
              <h1>{page.title}</h1>
              <p className="storefront-faqs__intro">{page.description}</p>
              {page.action === "products" ? (
                <Link className="footer-info-page__action" href="/products">{page.actionLabel}</Link>
              ) : page.action === "account" ? (
                <button
                  type="button"
                  className="footer-info-page__action"
                  onClick={() => window.dispatchEvent(new CustomEvent("tribull-open-login"))}
                >
                  {page.actionLabel}
                </button>
              ) : (
                <a className="footer-info-page__action" href={supportHref} target="_blank" rel="noopener noreferrer">
                  {page.actionLabel}
                </a>
              )}
            </>
          ) : (
            <>
              <p className="storefront-faqs__eyebrow">TRIBULL INFORMATION</p>
              <h1>Page not found</h1>
              <p className="storefront-faqs__intro">This information page is unavailable.</p>
            </>
          )}
        </div>
      </main>
    </>
  );
}
