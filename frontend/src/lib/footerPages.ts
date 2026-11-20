export const footerPages = {
  "returns-refunds": {
    title: "Returns & Refunds",
    description: "Tribull supports exchanges only; refunds and returns are not available. Contact support with your order number for exchange assistance.",
    action: "support",
    actionLabel: "Ask about an exchange",
  },
  "about-us": {
    title: "About Tribull",
    description: "TRIBULL is an online custom printed T-shirt brand in India, offering unique designs, trendy oversized T-shirts and quality prints. We bring creative styles and everyday fashion together, making it easy to find T-shirts that match your style. Explore our latest collections and shop your favourite designs online.",
    action: "products",
    actionLabel: "Browse products",
  },
  "community-initiatives": {
    title: "Community Initiatives",
    description: "For community collaborations or initiatives, tell the Tribull team what you have in mind.",
    action: "support",
    actionLabel: "Discuss a collaboration",
  },
  account: {
    title: "My Account",
    description: "Sign in to view your account, orders, and saved details.",
    action: "account",
    actionLabel: "Sign in or view account",
  },
  "terms-and-conditions": {
    title: "Terms & Conditions",
    description: "Product availability, prices, payment options, and delivery details are shown during checkout and may vary by order. Please review your order details before placing it.",
    action: "support",
    actionLabel: "Ask about our terms",
  },
  "privacy-policy": {
    title: "Privacy Policy",
    description: "We use the contact and delivery details you provide to manage your account, process orders, arrange delivery, and respond to support requests. Payment details are entered through the checkout payment provider.",
    action: "support",
    actionLabel: "Ask about privacy",
  },
  "shipping-policy": {
    title: "Shipping Policy",
    description: "Shipping options and estimated delivery details are shown at checkout and in your order information. Contact support with your order number if you need help with a delivery.",
    action: "support",
    actionLabel: "Ask about shipping",
  },
  "returns-exchange-policy": {
    title: "Returns & Exchange Policy",
    description: "Tribull supports exchanges only; returns and refunds are not available. Contact support with your order number for exchange assistance.",
    action: "support",
    actionLabel: "Ask about an exchange",
  },
} as const;

export type FooterPageSlug = keyof typeof footerPages;
