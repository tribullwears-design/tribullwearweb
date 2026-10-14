import { ArrowLeft, CheckCircle2, Download, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "../lib/api";
import { products, type Product } from "./ProductsPage";
import StorefrontHeader from "../components/StorefrontHeader";
import ProductPrice from "../components/ProductPrice";
import { fetchProducts, refreshProducts } from "../lib/products";
import { resolveOriginalPrice } from "../lib/productPrice";

type CartEntry = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  quantity: number;
  variant?: string;
  lineTotal: number;
};

type CartState = Record<string, number>;
type CartItemMeta = Partial<Product> & { variant?: string; name?: string; image?: string; price?: number; mrp?: string | number; MRP?: string | number; compareAtPrice?: string | number; compareAt?: string | number; oldPrice?: string | number };

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

async function loadInvoiceLogo() {
  const image = new Image();
  image.src = "/products/logo.png";
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the Tribull logo for the bill.");
  context.drawImage(image, 0, 0);
  const jpeg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not convert the Tribull logo for the bill."));
    }, "image/jpeg", 0.92);
  });
  return {
    data: new Uint8Array(await jpeg.arrayBuffer()),
    width: canvas.width,
    height: canvas.height,
  };
}

function createInvoicePdf(lines: string[], logo: Awaited<ReturnType<typeof loadInvoiceLogo>>) {
  const printableLines = lines.map((line) => line
    .replace(/₹/g, "INR ")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7E]/g, "?"));
  const linesPerPage = 38;
  const pages: string[][] = [];
  for (let index = 0; index < printableLines.length; index += linesPerPage) {
    pages.push(printableLines.slice(index, index + linesPerPage));
  }

  const objects: (string | Uint8Array)[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const logoObjectId = objects.length + 1;
  const logoHeader = new TextEncoder().encode(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.data.length} >>\nstream\n`);
  const logoFooter = new TextEncoder().encode("\nendstream");
  const logoObject = new Uint8Array(logoHeader.length + logo.data.length + logoFooter.length);
  logoObject.set(logoHeader);
  logoObject.set(logo.data, logoHeader.length);
  logoObject.set(logoFooter, logoHeader.length + logo.data.length);
  objects.push(logoObject);
  const pageReferences: number[] = [];

  pages.forEach((pageLines) => {
    const pageObjectId = objects.length + 1;
    const contentObjectId = pageObjectId + 1;
    pageReferences.push(pageObjectId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> /XObject << /Logo ${logoObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`);

    const logoScale = Math.min(110 / logo.width, 54 / logo.height);
    const logoWidth = logo.width * logoScale;
    const logoHeight = logo.height * logoScale;
    const commands = pageReferences.length === 1
      ? [`q ${logoWidth.toFixed(2)} 0 0 ${logoHeight.toFixed(2)} ${((595 - logoWidth) / 2).toFixed(2)} 770 cm /Logo Do Q`, "BT", "/F1 11 Tf"]
      : ["BT", "/F1 11 Tf"];
    let y = pageReferences.length === 1 ? 748 : 790;
    pageLines.forEach((line, index) => {
      const escapedLine = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      const textWidth = Math.min(line.length * 5.5, 495);
      const x = Math.max(50, (595 - textWidth) / 2);
      commands.push(`1 0 0 1 ${x.toFixed(2)} ${y} Tm (${escapedLine}) Tj`);
      y -= index === 0 ? 24 : 16;
    });
    if (pageReferences.length === pages.length) {
      y -= 16;
      commands.push(`1 0 0 1 220 ${y} Tm (Thank you for shopping with Tribull!) Tj`);
    }
    commands.push("ET");
    const stream = commands.join("\n");
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageReferences.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageReferences.length} >>`;

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [encoder.encode("%PDF-1.4\n")];
  const offsets = [0];
  let byteLength = parts[0].length;
  objects.forEach((object, index) => {
    offsets.push(byteLength);
    const objectBytes = typeof object === "string" ? encoder.encode(object) : object;
    const objectStart = encoder.encode(`${index + 1} 0 obj\n`);
    const objectEnd = encoder.encode("\nendobj\n");
    parts.push(objectStart, objectBytes, objectEnd);
    byteLength += objectStart.length + objectBytes.length + objectEnd.length;
  });
  const xrefOffset = byteLength;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(encoder.encode(xref));
  const pdf = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    pdf.set(part, offset);
    offset += part.length;
  });
  return new Blob([pdf], { type: "application/pdf" });
}

function CheckoutStorefrontHeader({ onBack }: { onBack: () => void }) {
  return (
    <>
      <StorefrontHeader />
      <div className="checkout-context-bar">
        <button type="button" className="checkout-header__back" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Cart
        </button>
        <span className="checkout-header__eyebrow">Checkout</span>
      </div>
    </>
  );
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
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [showTrackingInfo, setShowTrackingInfo] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [placedOrderSummary, setPlacedOrderSummary] = useState<OrderSummary | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(products);

  useEffect(() => {
    let active = true;
    const syncProducts = (refresh = false) => {
      const request = refresh ? refreshProducts() : fetchProducts();
      void request.then((nextProducts) => {
        if (active) setCatalogProducts(nextProducts);
      }).catch((error: unknown) => {
        console.error("Failed to load checkout product prices.", error);
      });
    };
    syncProducts();
    const refreshCatalog = () => syncProducts(true);
    window.addEventListener("tribull-products-updated", refreshCatalog);
    return () => {
      active = false;
      window.removeEventListener("tribull-products-updated", refreshCatalog);
    };
  }, []);

  const cartDetails = useMemo(() => {
    const cart = readStorage<CartState>("tribull-cart", {});
    const cartItems = readStorage<Record<string, CartItemMeta>>("tribull-cart-items", {});

    const entries: CartEntry[] = [];

    for (const [id, quantity] of Object.entries(cart)) {
      if (quantity <= 0) continue;

      const product = catalogProducts.find((item) => item.id === id)
        ?? catalogProducts.find((item) => item.name.trim().toLowerCase() === cartItems[id]?.name?.trim().toLowerCase());
      const item = cartItems[id] || product;
      if (!item) continue;

      const price = Number(product?.price ?? item.price ?? 0);
      const image = item.image ?? product?.image ?? "/products/logo.png";
      const lineTotal = price * quantity;

      entries.push({
        id,
        name: item.name ?? product?.name ?? "Tribull Product",
        price,
        originalPrice: product?.originalPrice ?? resolveOriginalPrice(item),
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
  }, [catalogProducts, orderPlaced]);

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

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;
    if (cartDetails.entries.length === 0) return;

    const generatedOrderNumber = `TW-${Math.floor(100000 + Math.random() * 900000)}`;
    const summary: OrderSummary = {
      entries: cartDetails.entries,
      subtotal: cartDetails.subtotal,
      shipping: cartDetails.shipping,
      total: cartDetails.total,
    };

    const response = await apiFetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: generatedOrderNumber,
        customer: { name: form.fullName, email: form.email, phone: form.phone },
        shippingAddress: { address: form.address, apartment: form.apartment, city: form.city, state: form.state, pinCode: form.pinCode, country: form.country },
        items: summary.entries,
        subtotal: summary.subtotal,
        shipping: summary.shipping,
        discount: 0,
        total: summary.total,
        payment: { method: paymentMethod, status: paymentMethod === "cod" ? "Pending" : "Paid" },
      }),
    });
    if (!response.ok) {
      setErrors((current) => ({ ...current, paymentMethod: "Unable to place order. Please try again." }));
      return;
    }

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
  const downloadBill = async () => {
    const invoiceLines = [
      "TRIBULL - ORDER BILL",
      `Order Number: ${orderNumber}`,
      `Date: ${new Date().toLocaleDateString("en-IN")}`,
      "",
      "CUSTOMER",
      `Name: ${form.fullName}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      `Address: ${form.address}${form.apartment ? `, ${form.apartment}` : ""}`,
      `${form.city}, ${form.state} ${form.pinCode}, ${form.country}`,
      "",
      "ORDER ITEMS",
      ...visibleOrder.entries.flatMap((item) => [
        `${item.name}${item.variant ? ` (${item.variant})` : ""}`,
        `  ${item.quantity} x ${formatPrice(item.price)} = ${formatPrice(item.lineTotal)}`,
      ]),
      "",
      `Subtotal: ${formatPrice(visibleOrder.subtotal)}`,
      `Shipping: ${formatPrice(visibleOrder.shipping)}`,
      `Total: ${formatPrice(visibleOrder.total)}`,
      `Payment: ${paymentMethod === "upi" ? "UPI" : "Credit / Debit Card"}`,
    ];
    try {
      setInvoiceError("");
      const logo = await loadInvoiceLogo();
      const pdf = createInvoicePdf(invoiceLines, logo);
      const downloadUrl = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Tribull-Bill-${orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error) {
      console.error("Could not create the order bill PDF.", error);
      setInvoiceError("Could not download the bill. Please try again.");
    }
  };

  if (!orderPlaced && cartDetails.entries.length === 0) {
    return (
      <div className="checkout-page checkout-page--empty">
        <CheckoutStorefrontHeader onBack={goBackToCart} />

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
        <CheckoutStorefrontHeader onBack={goBackToCart} />

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
                    <span>{item.quantity} ×</span><ProductPrice sellingPrice={item.price} originalPrice={item.originalPrice} productName={item.name} />
                  </div>
                </div>
              ))}
            </div>

            <div className="checkout-summary__totals checkout-summary__totals--success">
              <div><span>Total</span><strong>{formatPrice(visibleOrder.total)}</strong></div>
            </div>

            <div className="checkout-success__actions">
              <button
                type="button"
                className="checkout-primary-button"
                aria-expanded={showInvoice}
                aria-controls="checkout-invoice"
                onClick={() => setShowInvoice((visible) => !visible)}
              >
                {showInvoice ? "Hide Bill" : "View Order"}
              </button>
              <button
                type="button"
                className="checkout-secondary-button"
                aria-expanded={showTrackingInfo}
                aria-controls="checkout-tracking-info"
                onClick={() => setShowTrackingInfo((visible) => !visible)}
              >
                Track Order
              </button>
              <button type="button" className="checkout-secondary-button" onClick={continueShopping}>Continue Shopping</button>
            </div>
            {showTrackingInfo && (
              <p className="checkout-tracking-info" id="checkout-tracking-info" role="status">
                Order #{orderNumber} is confirmed. Tracking details will be available once your order has shipped.
              </p>
            )}
            {showInvoice && (
              <section className="checkout-invoice" id="checkout-invoice" aria-label="Order bill">
              <div className="checkout-invoice__header">
                <div>
                  <p>TRIBULL</p>
                  <h3>Order Bill</h3>
                </div>
                <div>
                  <strong>Order #{orderNumber}</strong>
                  <span>{new Date().toLocaleDateString("en-IN")}</span>
                </div>
              </div>
              <div className="checkout-invoice__customer">
                <strong>Bill to</strong>
                <span>{form.fullName}</span>
                <span>{form.phone} / {form.email}</span>
                <span>{form.address}{form.apartment ? `, ${form.apartment}` : ""}, {form.city}, {form.state} {form.pinCode}, {form.country}</span>
              </div>
              <div className="checkout-invoice__items">
                <div className="checkout-invoice__item checkout-invoice__item--heading">
                  <span>Item</span><span>Qty</span><span>Amount</span>
                </div>
                {visibleOrder.entries.map((item) => (
                  <div className="checkout-invoice__item" key={`invoice-${item.id}`}>
                    <span>{item.name}{item.variant ? <small>{item.variant}</small> : null}</span>
                    <span>{item.quantity}</span>
                    <span>{formatPrice(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="checkout-invoice__totals">
                <div><span>Subtotal</span><strong>{formatPrice(visibleOrder.subtotal)}</strong></div>
                <div><span>Shipping</span><strong>{formatPrice(visibleOrder.shipping)}</strong></div>
                <div><span>Total</span><strong>{formatPrice(visibleOrder.total)}</strong></div>
                <div><span>Payment method</span><strong>{paymentMethod === "upi" ? "UPI" : "Credit / Debit Card"}</strong></div>
              </div>
              <button type="button" className="checkout-primary-button checkout-invoice__download" onClick={downloadBill}>
                <Download size={15} /> Download PDF
              </button>
              {invoiceError && <p className="checkout-payment-error" role="alert">{invoiceError}</p>}
              </section>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <CheckoutStorefrontHeader onBack={goBackToCart} />

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
                  <ProductPrice sellingPrice={item.price} originalPrice={item.originalPrice} productName={item.name} />
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
