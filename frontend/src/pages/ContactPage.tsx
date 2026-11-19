import { Mail, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import StorefrontHeader from "../components/StorefrontHeader";

const whatsappUrl = "https://wa.me/916385400605?text=Hi%20Tribull%2C%20I%20need%20help.";

export default function ContactPage() {
  return (
    <>
      <StorefrontHeader />
      <main className="storefront-contact">
        <div className="storefront-contact__content">
          <Link className="storefront-contact__back" href="/">Back to home</Link>
          <p className="storefront-contact__eyebrow">TRIBULL SUPPORT</p>
          <h1>Contact Us</h1>
          <p className="storefront-contact__intro">
            Need help with a product or order? Get in touch with the Tribull team using either option below.
          </p>

          <div className="storefront-contact__options">
            <section className="storefront-contact__card">
              <MessageCircle size={24} aria-hidden="true" />
              <h2>Chat on WhatsApp</h2>
              <p>For order questions, include your order number so the team can assist you.</p>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">Message Tribull</a>
            </section>
            <section className="storefront-contact__card">
              <Mail size={24} aria-hidden="true" />
              <h2>Email us</h2>
              <p>Send product, order, or general enquiries to our support email.</p>
              <a href="mailto:tribullwears@gmail.com">tribullwears@gmail.com</a>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
