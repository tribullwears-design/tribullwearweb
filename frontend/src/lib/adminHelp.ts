export type AdminHelpFaq = { id: string; question: string; answer: string };

export const adminHelpFaqs: AdminHelpFaq[] = [
  {
    id: "products",
    question: "How do I add or edit a product?",
    answer: "Open Products → Add Product to create a catalog item, or choose Edit from All Products. Complete the product details and save. Product changes require product edit permission.",
  },
  {
    id: "categories",
    question: "How do main categories and subcategories work?",
    answer: "Use Products → Categories to manage the main category hierarchy and its subcategories. Select the appropriate category and subcategory when creating or editing a product.",
  },
  {
    id: "product-pricing",
    question: "Where do product images, prices, original prices, and offer prices come from?",
    answer: "The product editor stores the product image, selling price, and optional compare-at price. Discounts, coupons, and promotions are managed separately under Marketing; their actual eligibility and totals are calculated during checkout.",
  },
  {
    id: "inventory",
    question: "How do I update inventory?",
    answer: "Open Products → Inventory, find the product, and choose Adjust. Enter a non-zero whole-number adjustment; the saved stock value is updated by the backend.",
  },
  {
    id: "banners",
    question: "How do I manage hero and category banners?",
    answer: "Products → Banners manages category banners and their images. Existing hero artwork for some categories is seeded as a category banner; this dashboard does not provide a separate hero-slide editor.",
  },
  {
    id: "orders",
    question: "Where can I review customer orders and their statuses?",
    answer: "Open Orders → All Orders, or use the status-specific order pages. Select an order to review its persisted payment and delivery details. Available fulfilment statuses are Pending, Processing, Shipped, Delivered, and Cancelled.",
  },
  {
    id: "payments",
    question: "How are COD and Razorpay payments shown?",
    answer: "The order record is the source of truth for payment method and payment status. COD orders are not treated as paid automatically. Razorpay payments are confirmed by the backend verification flow; a pending payment should remain pending until verified.",
  },
  {
    id: "admin-users",
    question: "How do admin users, roles, and permissions work?",
    answer: "Open Settings → Admin Users to manage accounts you are authorized to administer. Role permissions control which dashboard sections can be viewed or edited. Only an authorized Super Admin can manage Super Admin access and dedicated admin accounts.",
  },
  {
    id: "account-settings",
    question: "How do I update my account name or password?",
    answer: "Open your profile menu → Account settings. You can update your own name or change your password after providing the current password. Password changes require confirmation and a password of at least 8 bytes that includes a letter and a number.",
  },
  {
    id: "login",
    question: "What should I do if admin login or a dashboard page fails?",
    answer: "Confirm you are using the authorized admin email and password, then reload and sign in again. If your password is unavailable, use the existing password recovery flow for the account. A role or permission denial must be resolved by an authorized Super Admin; it should not be bypassed.",
  },
];

export function filterAdminHelpFaqs(query: string, faqs: AdminHelpFaq[] = adminHelpFaqs) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return faqs;
  return faqs.filter(({ question, answer }) =>
    `${question} ${answer}`.toLocaleLowerCase().includes(normalizedQuery));
}
