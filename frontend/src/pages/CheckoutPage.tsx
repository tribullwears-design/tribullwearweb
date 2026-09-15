import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { products, type Product } from "./ProductsPage";

type CartEntry = {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  variant?: string;
  lineTotal: number;
};

type CartState = Record<string, number>;
type CartItemMeta = Partial<Product> & { variant?: string; name?: string; image?: string; price?: number };

type CheckoutForm = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
};

type OrderSummary = {
  entries: CartEntry[];
  subtotal: number;
  shipping: number;
  total: number;
};

const formatPrice = (value: number) => `₹${value.toLocaleString("en-IN")}`;

function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<CheckoutForm>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    apartment: "",
    city: "",
    state: "",
    pinCode: "",
    country: "India",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutForm | "paymentMethod", string>>>({});
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [placedOrderSummary, setPlacedOrderSummary] = useState<OrderSummary | null>(null);

  const cartDetails = useMemo(() => {
    const cart = readStorage<CartState>("tribull-cart", {});
    const cartItems = readStorage<Record<string, CartItemMeta>>("tribull-cart-items", {});

    const entries: CartEntry[] = [];

    for (const [id, quantity] of Object.entries(cart)) {
      if (quantity <= 0) continue;

      const product = products.find((item) => item.id === id);
      const item = cartItems[id] || product;
      if (!item) continue;

      const price = Number(item.price ?? product?.price ?? 0);
      const image = item.image ?? product?.image ?? "/products/logo.png";
      const lineTotal = price * quantity;

      entries.push({
        id,
        name: item.name ?? product?.name ?? "Tribull Product",
        price,
        image,
        quantity,
        variant: item.variant,
        lineTotal,
      });
    }

    const subtotal = entries.reduce((total, entry) => total + entry.lineTotal, 0);
    const shipping = subtotal > 0 ? 0 : 0;
    const total = subtotal + shipping;

    return { entries, subtotal, shipping, total };
  }, [orderPlaced]);

  const handleFieldChange = (field: keyof CheckoutForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof CheckoutForm | "paymentMethod", string>> = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Full name is required.";
    if (!form.email.trim()) nextErrors.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Enter a valid email address.";
    if (!form.phone.trim()) nextErrors.phone = "Phone number is required.";
    else if (form.phone.replace(/\D/g, "").length < 10) nextErrors.phone = "Enter a valid 10-digit phone number.";
    if (!form.address.trim()) nextErrors.address = "Street address is required.";
    if (!form.city.trim()) nextErrors.city = "City is required.";
    if (!form.state.trim()) nextErrors.state = "State is required.";
    if (!form.pinCode.trim()) nextErrors.pinCode = "PIN code is required.";
    if (!form.country.trim()) nextErrors.country = "Country is required.";
    if (!paymentMethod) nextErrors.paymentMethod = "Please select a payment method.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePlaceOrder = () => {
    if (!validateForm()) return;
    if (cartDetails.entries.length === 0) return;

    const generatedOrderNumber = `TW-${Math.floor(100000 + Math.random() * 900000)}`;
    const summary: OrderSummary = {
      entries: cartDetails.entries,
      subtotal: cartDetails.subtotal,
      shipping: cartDetails.shipping,
      total: cartDetails.total,
    };

    setPlacedOrderSummary(summary);
    setOrderNumber(generatedOrderNumber);
    setOrderPlaced(true);

    window.localStorage.setItem("tribull-cart", JSON.stringify({}));
    window.localStorage.setItem("tribull-cart-items", JSON.stringify({}));
    window.dispatchEvent(new Event("tribull-cart-updated"));
  };

  const continueShopping = () => setLocation("/");
  const goBackToCart = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation("/");
  };

  const visibleOrder = placedOrderSummary ?? cartDetails;

  if (!orderPlaced && cartDetails.entries.length === 0) {
    return (
      <div className="checkout-page checkout-page--empty">
        <header className="checkout-header">
          <a className="wordmark" href="/" aria-label="Tribull home">
            <img src="/products/logo.png" alt="TRIBULL" />
          </a>
          <div className="checkout-header__title-wrap">
            <span className="checkout-header__eyebrow">Checkout</span>
            <button type="button" className="checkout-header__back" onClick={goBackToCart}>
              <ArrowLeft size={16} /> Back to Cart
            </button>
          </div>
        </header>

        <main className="checkout-empty-state">
          <div className="checkout-empty-state__card">
            <h2>Your cart is empty.</h2>
            <button type="button" className="checkout-primary-button" onClick={continueShopping}>
              Continue Shopping
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="checkout-page checkout-page--success">
        <header className="checkout-header">
          <a className="wordmark" href="/" aria-label="Tribull home">
            <img src="/products/logo.png" alt="TRIBULL" />
          </a>
          <div className="checkout-header__title-wrap">
            <span className="checkout-header__eyebrow">Checkout</span>
            <button type="button" className="checkout-header__back" onClick={goBackToCart}>
              <ArrowLeft size={16} /> Back to Cart
            </button>
          </div>
        </header>

        <main className="checkout-success">
          <div className="checkout-success__panel">
            <div className="checkout-success__icon"><CheckCircle2 size={58} /></div>
            <p className="checkout-success__eyebrow">Order Placed Successfully</p>
            <h2>Thank you for your order!</h2>
            <p className="checkout-success__meta">Order #{orderNumber}</p>
            <p className="checkout-success__message">Your order has been successfully placed.</p>

            <div className="checkout-success__items">
              {visibleOrder.entries.map((item) => (
                <div key={item.id} className="checkout-success__item">
                  <img src={item.image} alt={item.name} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.quantity} × {formatPrice(item.price)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="checkout-summary__totals checkout-summary__totals--success">
              <div><span>Total</span><strong>{formatPrice(visibleOrder.total)}</strong></div>
            </div>

            <div className="checkout-success__actions">
              <button type="button" className="checkout-primary-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>View Order</button>
              <button type="button" className="checkout-secondary-button" onClick={continueShopping}>Continue Shopping</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <header className="checkout-header">
        <a className="wordmark" href="/" aria-label="Tribull home">
          <img src="/products/logo.png" alt="TRIBULL" />
        </a>
        <div className="checkout-header__title-wrap">
          <span className="checkout-header__eyebrow">Checkout</span>
          <button type="button" className="checkout-header__back" onClick={goBackToCart}>
            <ArrowLeft size={16} /> Back to Cart
          </button>
        </div>
      </header>

      <main className="checkout-layout">
        <section className="checkout-form-area">
          <div className="checkout-section">
            <h3>Contact Information</h3>
            <div className="checkout-grid checkout-grid--two">
              <label className="checkout-field">
                <span>Full Name</span>
                <input value={form.fullName} onChange={(event) => handleFieldChange("fullName", event.target.value)} placeholder="Enter your full name" />
                {errors.fullName && <small>{errors.fullName}</small>}
              </label>
              <label className="checkout-field">
                <span>Email Address</span>
                <input type="email" value={form.email} onChange={(event) => handleFieldChange("email", event.target.value)} placeholder="you@example.com" />
                {errors.email && <small>{errors.email}</small>}
              </label>
            </div>

            <div className="checkout-grid checkout-grid--one">
              <label className="checkout-field">
                <span>Phone Number</span>
                <input type="tel" value={form.phone} onChange={(event) => handleFieldChange("phone", event.target.value)} placeholder="Enter mobile number" />
                {errors.phone && <small>{errors.phone}</small>}
              </label>
            </div>
          </div>

          <div className="checkout-section">
            <h3>Shipping Address</h3>
            <div className="checkout-grid checkout-grid--one">
              <label className="checkout-field">
                <span>Address</span>
                <input value={form.address} onChange={(event) => handleFieldChange("address", event.target.value)} placeholder="House number, street name" />
                {errors.address && <small>{errors.address}</small>}
              </label>
            </div>

            <div className="checkout-grid checkout-grid--two">
              <label className="checkout-field">
                <span>Apartment / Building</span>
                <input value={form.apartment} onChange={(event) => handleFieldChange("apartment", event.target.value)} placeholder="Optional" />
              </label>
              <label className="checkout-field">
                <span>City</span>
                <input value={form.city} onChange={(event) => handleFieldChange("city", event.target.value)} placeholder="City" />
                {errors.city && <small>{errors.city}</small>}
              </label>
            </div>

            <div className="checkout-grid checkout-grid--three">
              <label className="checkout-field">
                <span>State</span>
                <input value={form.state} onChange={(event) => handleFieldChange("state", event.target.value)} placeholder="State" />
                {errors.state && <small>{errors.state}</small>}
              </label>
              <label className="checkout-field">
                <span>PIN Code</span>
                <input value={form.pinCode} onChange={(event) => handleFieldChange("pinCode", event.target.value)} placeholder="Postal code" />
                {errors.pinCode && <small>{errors.pinCode}</small>}
              </label>
              <label className="checkout-field">
                <span>Country</span>
                <input value={form.country} onChange={(event) => handleFieldChange("country", event.target.value)} placeholder="Country" />
                {errors.country && <small>{errors.country}</small>}
              </label>
            </div>
          </div>

          <div className="checkout-section">
            <h3>Payment</h3>
            <div className="checkout-payment-options">
              {[
                { id: "cod", label: "Cash on Delivery" },
                { id: "upi", label: "UPI" },
                { id: "card", label: "Credit / Debit Card" },
              ].map((option) => (
                <label key={option.id} className={`checkout-payment-option ${paymentMethod === option.id ? "is-selected" : ""}`}>
                  <input type="radio" name="payment" value={option.id} checked={paymentMethod === option.id} onChange={() => setPaymentMethod(option.id)} />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {errors.paymentMethod && <small className="checkout-payment-error">{errors.paymentMethod}</small>}
          </div>

          <button type="button" className="checkout-primary-button checkout-primary-button--full" onClick={handlePlaceOrder}>
            PLACE ORDER
          </button>
        </section>

        <aside className="checkout-summary">
          <h3>Order Summary</h3>

          <div className="checkout-summary__items">
            {visibleOrder.entries.map((item) => (
              <div key={item.id} className="checkout-summary__item">
                <img src={item.image} alt={item.name} />
                <div className="checkout-summary__details">
                  <strong>{item.name}</strong>
                  <span>{item.variant ? `${item.variant}` : "Premium tee"}</span>
                  <span>{formatPrice(item.price)}</span>
                  <span>Quantity: {item.quantity}</span>
                  <strong className="checkout-summary__line-total">{formatPrice(item.lineTotal)}</strong>
                </div>
              </div>
            ))}
          </div>

          <div className="checkout-summary__totals">
            <div><span>Subtotal</span><strong>{formatPrice(visibleOrder.subtotal)}</strong></div>
            <div><span>Shipping</span><strong>{formatPrice(visibleOrder.shipping)}</strong></div>
            <div className="checkout-summary__total-row"><span>Total</span><strong>{formatPrice(visibleOrder.total)}</strong></div>
          </div>

          <div className="checkout-summary__trust">
            <ShieldCheck size={16} /> Secure checkout protected
          </div>
        </aside>
      </main>
    </div>
  );
}
