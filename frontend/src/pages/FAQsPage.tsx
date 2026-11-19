import { Link } from "wouter";
import StorefrontHeader from "../components/StorefrontHeader";

const faqGroups = [
  {
    title: "Orders & payments",
    questions: [
      {
        question: "How do I place an order?",
        answer: "Choose a product, select an available size and other options, add it to your cart, and follow checkout to confirm your order.",
      },
      {
        question: "How can I check my order?",
        answer: "Open My Account and select My Orders. Sign in with the phone number used for your order to view its details.",
      },
      {
        question: "Which payment options are available?",
        answer: "The payment options available for your order are shown during checkout before you place it.",
      },
    ],
  },
  {
    title: "Shipping & delivery",
    questions: [
      {
        question: "Where can I find delivery estimates?",
        answer: "Available shipping options and estimated delivery details are shown at checkout and in your order information.",
      },
      {
        question: "How can I get help with a delivery?",
        answer: "Message Tribull support on WhatsApp and share your order number and delivery PIN code so the team can assist.",
      },
    ],
  },
  {
    title: "Returns, exchanges & products",
    questions: [
      {
        question: "What is the return and refund policy?",
        answer: "Tribull supports exchanges only; returns and refunds are not available. Contact support with your order number for exchange assistance.",
      },
      {
        question: "Where can I find product and size details?",
        answer: "Open a product page to review its available sizes and product information before adding it to your cart.",
      },
      {
        question: "Can I request a custom design?",
        answer: "Use the Customize section on the home page to contact Tribull and share what you would like to create.",
      },
    ],
  },
];

export default function FAQsPage() {
  return (
    <>
      <StorefrontHeader />
      <main className="storefront-faqs">
        <div className="storefront-faqs__content">
          <Link className="storefront-faqs__back" href="/">Back to home</Link>
          <p className="storefront-faqs__eyebrow">TRIBULL SUPPORT</p>
          <h1>Frequently Asked Questions</h1>
          <p className="storefront-faqs__intro">
            Find answers about placing orders, payments, delivery, exchanges, and products.
          </p>

          <div className="storefront-faqs__groups">
            {faqGroups.map((group) => (
              <section className="storefront-faqs__group" key={group.title} aria-label={group.title}>
                <h2>{group.title}</h2>
                <div className="storefront-faqs__questions">
                  {group.questions.map(({ question, answer }) => (
                    <details key={question}>
                      <summary>{question}</summary>
                      <p>{answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="storefront-faqs__contact">
            Still need help?{" "}
            <a href="https://wa.me/916385400605?text=Hi%20Tribull%2C%20I%20need%20help." target="_blank" rel="noopener noreferrer">
              Contact Tribull on WhatsApp
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
