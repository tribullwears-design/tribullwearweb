import { ArrowLeft, CheckCircle2, Download, Minus, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "../lib/api";
import StorefrontHeader from "../components/StorefrontHeader";
import type { Product } from "../../../shared/products";
import ProductPrice from "../components/ProductPrice";
import { fetchProducts, refreshProducts } from "../lib/products";
import { resolveOriginalPrice } from "../lib/productPrice";
import { createCheckoutSubmission } from "../lib/checkout";
import { getRazorpayPaymentConfig, openRazorpayCheckout } from "../lib/razorpayCheckout";
import { checkoutPaymentMethods, getCheckoutPaymentLabel, indianStatesAndTerritories, isIndianState, normalizeIndianState, type CheckoutPaymentMethod } from "../../../shared/checkout";

type CartEntry = {
  id: string;
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  quantity: number;
  variant?: string;
  lineTotal: number;
  available: boolean;
};

type CartState = Record<string, number>;
type CartItemMeta = Partial<Product> & { productId?: string; variant?: string; size?: string; color?: string; name?: string; image?: string; price?: number; mrp?: string | number; MRP?: string | number; compareAtPrice?: string | number; compareAt?: string | number; oldPrice?: string | number };
type CheckoutSelection = { productId: string; quantity: number; metadata: CartItemMeta };
type SavedAddress = {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  apartment?: string;
  city: string;
  state: string;
  pinCode: string;
  isDefault: boolean;
};

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
  discount: number;
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

function readCheckoutSelection(): CheckoutSelection | null {
  try {
    const saved = window.sessionStorage.getItem("tribull-checkout-selection");
    if (!saved) return null;
    const selection = JSON.parse(saved) as CheckoutSelection;
    if (typeof selection.productId !== "string" || !Number.isInteger(selection.quantity) || selection.quantity < 1) return null;
    return selection;
  } catch {
    return null;
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
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("upi");
  const [placedPaymentMode, setPlacedPaymentMode] = useState<"razorpay" | "cod" | "test">("test");
  const [placedPaymentMethod, setPlacedPaymentMethod] = useState("upi");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [showTrackingInfo, setShowTrackingInfo] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [placedOrderSummary, setPlacedOrderSummary] = useState<OrderSummary | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogLoadError, setCatalogLoadError] = useState("");
  const [isDirectCheckout, setIsDirectCheckout] = useState(() => Boolean(readCheckoutSelection()));
  const [cart, setCart] = useState<CartState>(() => {
    const selection = readCheckoutSelection();
    return selection ? { [selection.productId]: selection.quantity } : readStorage("tribull-cart", {});
  });
  const [cartItems, setCartItems] = useState<Record<string, CartItemMeta>>(() => {
    const selection = readCheckoutSelection();
    return selection ? { [selection.productId]: selection.metadata } : readStorage("tribull-cart-items", {});
  });
  const [reviewMode, setReviewMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [customerAuthenticated, setCustomerAuthenticated] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [savedAddressesLoading, setSavedAddressesLoading] = useState(false);
  const [savedAddressesError, setSavedAddressesError] = useState("");
  const [savedAddressId, setSavedAddressId] = useState("");
  const [saveAddressLoading, setSaveAddressLoading] = useState(false);
  const [saveAddressMessage, setSaveAddressMessage] = useState("");
  const [saveAddressMessageIsError, setSaveAddressMessageIsError] = useState(false);
  const saveAddressRequestId = useRef<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    const syncCart = () => {
      if (isDirectCheckout) return;
      setCart(readStorage("tribull-cart", {}));
      setCartItems(readStorage("tribull-cart-items", {}));
    };
    window.addEventListener("tribull-cart-updated", syncCart);
    window.addEventListener("storage", syncCart);
    return () => {
      window.removeEventListener("tribull-cart-updated", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, [isDirectCheckout]);

  useEffect(() => {
    let active = true;
    void apiFetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as { user?: { name?: string; username?: string; email?: string; mobile?: string } };
      })
      .then((result) => {
        if (!active || !result?.user) return;
        const user = result.user;
        setCustomerAuthenticated(true);
        setForm((current) => ({
          ...current,
          fullName: current.fullName || user.name || user.username || "",
          email: current.email || user.email || "",
          phone: current.phone || user.mobile || "",
        }));
        setSavedAddressesLoading(true);
        return apiFetch("/api/customer/addresses", { cache: "no-store" })
          .then(async (response) => {
            const data = await response.json().catch(() => undefined) as SavedAddress[] | { error?: string } | undefined;
            if (!response.ok || !Array.isArray(data)) throw new Error(!Array.isArray(data) && data?.error ? data.error : "Unable to load saved addresses.");
            if (!active) return;
            setSavedAddresses(data);
            const defaultAddress = data.find((entry) => entry.isDefault);
            if (defaultAddress) {
              setSavedAddressId(defaultAddress.id);
              setForm((current) => ({
                ...current,
                fullName: defaultAddress.fullName,
                phone: defaultAddress.phone,
                address: defaultAddress.address,
                apartment: defaultAddress.apartment || "",
                city: defaultAddress.city,
                state: defaultAddress.state,
                pinCode: defaultAddress.pinCode,
              }));
            }
          })
          .catch((error: unknown) => {
            if (active) setSavedAddressesError(error instanceof Error ? error.message : "Unable to load saved addresses.");
          })
          .finally(() => { if (active) setSavedAddressesLoading(false); });
      })
      .catch((error: unknown) => console.error("Could not load the saved checkout profile.", error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const syncProducts = (refresh = false) => {
      const request = refresh ? refreshProducts() : fetchProducts();
      void request.then((nextProducts) => {
        if (active) {
          setCatalogProducts(nextProducts);
          setCatalogLoaded(true);
          setCatalogLoadError("");
        }
      }).catch((error: unknown) => {
        console.error("Failed to load checkout product prices.", error);
        if (active) setCatalogLoadError("We could not load current product prices. Please refresh and try again.");
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
    const entries: CartEntry[] = [];

    for (const [id, quantity] of Object.entries(cart)) {
      if (quantity <= 0) continue;

      const metadata = cartItems[id];
      const productId = metadata?.productId || id;
      const product = catalogProducts.find((item) => item.id === productId);
      const item = metadata || product || {};

      const price = Number(product?.price ?? 0);
      const image = product?.image ?? item.image ?? "/products/logo.png";
      const lineTotal = price * quantity;

      entries.push({
        id,
        productId,
        name: product?.name ?? item.name ?? "Unavailable product",
        price,
        originalPrice: product?.originalPrice ?? (product ? resolveOriginalPrice(item) : undefined),
        image,
        quantity,
        variant: item.variant,
        lineTotal,
        available: Boolean(product),
      });
    }

    const subtotal = entries.reduce((total, entry) => total + entry.lineTotal, 0);
    const shipping = 0;
    const discount = 0;
    const total = subtotal + shipping;

    return { entries, subtotal, discount, shipping, total };
  }, [catalogProducts, cart, cartItems, orderPlaced]);

  const updateCartQuantity = (id: string, quantity: number) => {
    const nextCart = { ...cart };
    const nextCartItems = { ...cartItems };
    if (quantity <= 0) {
      delete nextCart[id];
      delete nextCartItems[id];
    } else {
      nextCart[id] = quantity;
    }
    setCart(nextCart);
    setCartItems(nextCartItems);
    if (isDirectCheckout) {
      const productId = Object.keys(nextCart)[0];
      const metadata = productId ? nextCartItems[productId] : null;
      if (metadata) window.sessionStorage.setItem("tribull-checkout-selection", JSON.stringify({ productId, quantity: nextCart[productId], metadata }));
      else {
        window.sessionStorage.removeItem("tribull-checkout-selection");
        setIsDirectCheckout(false);
      }
    } else {
      window.localStorage.setItem("tribull-cart", JSON.stringify(nextCart));
      window.localStorage.setItem("tribull-cart-items", JSON.stringify(nextCartItems));
    }
    window.dispatchEvent(new Event("tribull-cart-updated"));
    setCheckoutError("");
    idempotencyKey.current = null;
  };

  const handleFieldChange = (field: keyof CheckoutForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    if (field !== "email") setSavedAddressId("");
    setSaveAddressMessage("");
    setSaveAddressMessageIsError(false);
  };

  const selectSavedAddress = (id: string) => {
    setSavedAddressId(id);
    setSaveAddressMessage("");
    setSaveAddressMessageIsError(false);
    const selected = savedAddresses.find((entry) => entry.id === id);
    if (!selected) return;
    setForm((current) => ({
      ...current,
      fullName: selected.fullName,
      phone: selected.phone,
      address: selected.address,
      apartment: selected.apartment || "",
      city: selected.city,
      state: selected.state,
      pinCode: selected.pinCode,
    }));
    setErrors((current) => ({ ...current, fullName: "", phone: "", address: "", city: "", state: "", pinCode: "" }));
  };

  const saveCheckoutAddress = async () => {
    if (!customerAuthenticated || saveAddressLoading) return;
    const address = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      apartment: form.apartment.trim(),
      city: form.city.trim(),
      state: normalizeIndianState(form.state),
      pinCode: form.pinCode.trim(),
    };
    if (address.fullName.length < 2 || address.fullName.length > 80
      || !/^\+?\d{10,15}$/.test(address.phone.replace(/[()\s-]/g, ""))
      || address.address.length < 5 || address.address.length > 240
      || address.city.length < 2 || address.city.length > 80
      || !address.state || !/^\d{6}$/.test(address.pinCode)) {
      setSaveAddressMessage("Complete the valid name, phone, address, city, state, and PIN code fields before saving.");
      setSaveAddressMessageIsError(true);
      return;
    }
    saveAddressRequestId.current ||= window.sessionStorage.getItem("tribull-checkout-address-request-id")
      || (window.crypto?.randomUUID ? window.crypto.randomUUID() : `checkout-address-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    window.sessionStorage.setItem("tribull-checkout-address-request-id", saveAddressRequestId.current);
    setSaveAddressLoading(true);
    setSaveAddressMessage("");
    setSaveAddressMessageIsError(false);
    try {
      const response = await apiFetch("/api/customer/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...address, requestId: saveAddressRequestId.current }),
      });
      const data = await response.json().catch(() => undefined) as SavedAddress | { error?: string } | undefined;
      if (!response.ok || !data || !("id" in data)) {
        throw new Error(data && "error" in data && data.error ? data.error : "Unable to save this address.");
      }
      setSavedAddresses((current) => current.some((entry) => entry.id === data.id)
        ? current.map((entry) => entry.id === data.id ? data : entry)
        : [...current, data]);
      setSavedAddressId(data.id);
      setForm((current) => ({
        ...current,
        fullName: data.fullName,
        phone: data.phone,
        address: data.address,
        apartment: data.apartment || "",
        city: data.city,
        state: data.state,
        pinCode: data.pinCode,
      }));
      saveAddressRequestId.current = null;
      window.sessionStorage.removeItem("tribull-checkout-address-request-id");
      setSaveAddressMessage("Address saved to your account.");
      setSaveAddressMessageIsError(false);
    } catch (error) {
      setSaveAddressMessage(error instanceof Error ? error.message : "Unable to save this address.");
      setSaveAddressMessageIsError(true);
    } finally {
      setSaveAddressLoading(false);
    }
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof CheckoutForm | "paymentMethod", string>> = {};
    if (form.fullName.trim().length < 2 || form.fullName.trim().length > 80) nextErrors.fullName = "Enter your full name (2–80 characters).";
    if (!form.email.trim()) nextErrors.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Enter a valid email address.";
    if (!form.phone.trim()) nextErrors.phone = "Phone number is required.";
    else if (!/^\+?\d{10,15}$/.test(form.phone.trim().replace(/[()\s-]/g, ""))) nextErrors.phone = "Enter a valid mobile number.";
    if (form.address.trim().length < 5) nextErrors.address = "Enter a complete street address.";
    if (!form.city.trim()) nextErrors.city = "City is required.";
    if (!isIndianState(form.state)) nextErrors.state = "Select a valid Indian state or union territory.";
    if (!/^\d{6}$/.test(form.pinCode.trim())) nextErrors.pinCode = "Enter a valid 6-digit Indian PIN code.";
    if (!paymentMethod) nextErrors.paymentMethod = "Please select a payment method.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleReviewOrder = () => {
    if (!validateForm()) return;
    if (cartDetails.entries.length === 0) return;
    setCheckoutError("");
    setReviewMode(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePlaceOrder = async () => {
    if (isSubmitting || orderPlaced || !reviewMode) return;
    setIsSubmitting(true);
    setCheckoutError("");
    try {
      const key = idempotencyKey.current || (window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      idempotencyKey.current = key;
      const submission = createCheckoutSubmission({
        idempotencyKey: key,
        ...(savedAddressId ? { savedAddressId } : {}),
        customer: { name: form.fullName, email: form.email, phone: form.phone },
        shippingAddress: {
          address: form.address,
          apartment: form.apartment,
          city: form.city,
          state: normalizeIndianState(form.state),
          pinCode: form.pinCode,
          country: "India",
        },
        paymentMethod,
        items: cartDetails.entries.map((entry) => {
          const metadata = cartItems[entry.id];
          const size = metadata?.size || metadata?.variant?.match(/Size:\s*([^/]+)/i)?.[1]?.trim();
          const color = metadata?.color || metadata?.variant?.match(/Colour:\s*([^/]+)/i)?.[1]?.trim();
          return {
            id: entry.productId,
            quantity: entry.quantity,
            variant: {
              ...(size ? { size } : {}),
              ...(color ? { color } : {}),
            },
          };
        }),
      });
      type CheckoutOrderResult = {
        error?: string;
        id?: string;
        items?: Array<{ id: string; name: string; price: number; originalPrice?: number; image: string; quantity: number; variant?: string; lineTotal: number }>;
        subtotal?: number;
        discount?: number;
        shipping?: number;
        total?: number;
        payment?: { method: string; status: string };
        paymentMode?: string;
        status?: string;
        shippingAddress?: { address: string; apartment: string; city: string; state: string; pinCode: string; country: string };
      };
      let result: CheckoutOrderResult | null = null;
      if (paymentMethod === "cod") {
        const response = await apiFetch("/api/checkout/cod-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submission),
        });
        result = await response.json() as CheckoutOrderResult;
        if (!response.ok) throw new Error(result.error || "Unable to place the COD order. Please try again.");
      } else {
        const response = await apiFetch("/api/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submission),
        });
        const gatewayOrder = await response.json() as {
          error?: string;
          key_id?: string;
          order_id?: string;
          amount?: number;
          currency?: string;
        };
        if (!response.ok) throw new Error(gatewayOrder.error || "Unable to start payment. Please try again.");
        if (!gatewayOrder.key_id || !gatewayOrder.order_id || typeof gatewayOrder.amount !== "number"
          || !Number.isSafeInteger(gatewayOrder.amount) || !gatewayOrder.currency) {
          throw new Error("The payment provider returned an incomplete order.");
        }
        const payment = await openRazorpayCheckout({
          key: gatewayOrder.key_id,
          amount: gatewayOrder.amount,
          currency: gatewayOrder.currency,
          name: "Tribull",
          description: "Tribull order payment",
          order_id: gatewayOrder.order_id,
          prefill: { name: form.fullName, email: form.email, contact: form.phone },
          theme: { color: "#111111" },
          config: getRazorpayPaymentConfig(paymentMethod),
        });
        const verifyResponse = await apiFetch("/api/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payment),
        });
        const verification = await verifyResponse.json() as { error?: string; verified?: boolean; captured?: boolean; paymentFailed?: boolean; order?: CheckoutOrderResult };
        if (!verifyResponse.ok || !verification.verified) {
          if (verification.paymentFailed) idempotencyKey.current = null;
          throw new Error(verification.error || "The payment could not be verified. Contact support before retrying.");
        }
        if (!verification.captured || !verification.order) {
          throw new Error("Payment authorization is pending capture. Your order is not yet confirmed.");
        }
        result = verification.order;
      }
      if (!result?.id || !result.items || typeof result.total !== "number" || result.status !== "Pending"
        || typeof result.payment?.method !== "string"
        || (paymentMethod === "cod"
          ? result.paymentMode !== "cod" || result.payment?.method !== "cod" || result.payment.status !== "Pending collection"
          : result.paymentMode !== "razorpay" || result.payment.status !== "Paid")) {
        throw new Error("The checkout server returned an incomplete order confirmation.");
      }
      const summary: OrderSummary = {
        entries: result.items.map((item) => ({
          id: item.id,
          productId: item.id,
          name: item.name,
          price: item.price,
          originalPrice: item.originalPrice,
          image: item.image,
          quantity: item.quantity,
          variant: item.variant,
          lineTotal: item.lineTotal,
          available: true,
        })),
        subtotal: result.subtotal || 0,
        discount: result.discount || 0,
        shipping: result.shipping || 0,
        total: result.total,
      };
      if (result.shippingAddress) {
        const savedAddress = result.shippingAddress;
        setForm((current) => ({
          ...current,
          address: savedAddress.address,
          apartment: savedAddress.apartment,
          city: savedAddress.city,
          state: savedAddress.state,
          pinCode: savedAddress.pinCode,
          country: savedAddress.country,
        }));
      }
      setPlacedOrderSummary(summary);
      setOrderNumber(result.id);
      setPlacedPaymentMode(result.paymentMode as "razorpay" | "cod" | "test");
      setPlacedPaymentMethod(result.payment.method);
      setOrderPlaced(true);
      if (!isDirectCheckout) {
        window.localStorage.setItem("tribull-cart", JSON.stringify({}));
        window.localStorage.setItem("tribull-cart-items", JSON.stringify({}));
      }
      setCart({});
      setCartItems({});
      if (isDirectCheckout) window.sessionStorage.removeItem("tribull-checkout-selection");
      window.dispatchEvent(new Event("tribull-cart-updated"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete checkout. Please try again.";
      setCheckoutError(message);
      console.error("Checkout could not be completed.", message);
    } finally {
      setIsSubmitting(false);
    }
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
      `Payment: ${getCheckoutPaymentLabel(placedPaymentMethod)}`,
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
            <p className="checkout-success__eyebrow">{placedPaymentMode === "razorpay" ? "PAYMENT CONFIRMED" : "ORDER PLACED — PAYMENT DUE ON DELIVERY"}</p>
            <h2>Thank you for your order!</h2>
            <p className="checkout-success__meta">Order #{orderNumber}</p>
            <p className="checkout-success__message">{placedPaymentMode === "razorpay" ? "Your payment was verified and confirmed by Razorpay." : "Your order is recorded as pending. Payment has not been collected; pay upon delivery."}</p>

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
              <div><span>Payment method</span><strong>{placedPaymentMode === "razorpay" ? `${getCheckoutPaymentLabel(placedPaymentMethod)} (paid)` : `${getCheckoutPaymentLabel(placedPaymentMethod)} (pending collection)`}</strong></div>
              <div><span>Total</span><strong>{formatPrice(visibleOrder.total)}</strong></div>
            </div>
            <p className="checkout-success__message">
              Delivery to: {form.address}{form.apartment ? `, ${form.apartment}` : ""}, {form.city}, {form.state} {form.pinCode}, India.
            </p>

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
                <div><span>Payment method</span><strong>{getCheckoutPaymentLabel(placedPaymentMethod)}</strong></div>
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
          <div className="checkout-test-notice" role="note">
            <strong>SECURE ONLINE PAYMENT</strong>
            <span>Online payments are processed by Razorpay Checkout. Cash on Delivery is payable upon delivery; payment is not collected at checkout.</span>
          </div>
          {catalogLoadError && <p className="checkout-inline-error" role="alert">{catalogLoadError}</p>}
          {!catalogLoaded && !catalogLoadError && <p className="checkout-inline-note" role="status">Loading current product prices…</p>}
          {reviewMode ? (
            <div className="checkout-section checkout-review">
              <h3>Review Order</h3>
              <p><strong>Deliver to</strong><br />{form.fullName}<br />{form.address}{form.apartment ? `, ${form.apartment}` : ""}<br />{form.city}, {form.state} {form.pinCode}, India<br />{form.phone} · {form.email}</p>
              <p><strong>Payment method</strong><br />{paymentMethod === "cod" ? "Cash on Delivery — payment is due upon delivery." : `${getCheckoutPaymentLabel(paymentMethod)} — payment will be processed securely by Razorpay.`}</p>
              <div className="checkout-summary__totals">
                <div><span>Items ({cartDetails.entries.reduce((sum, item) => sum + item.quantity, 0)})</span><strong>{formatPrice(cartDetails.subtotal)}</strong></div>
                <div><span>Discount</span><strong>{formatPrice(cartDetails.discount)}</strong></div>
                <div><span>Standard delivery (estimated 3–7 business days)</span><strong>{cartDetails.shipping === 0 ? "Free" : formatPrice(cartDetails.shipping)}</strong></div>
                <div><span>Tax</span><strong>Included in product prices</strong></div>
                <div className="checkout-summary__total-row"><span>Total payable</span><strong>{formatPrice(cartDetails.total)}</strong></div>
              </div>
              <div className="checkout-review__actions">
                <button type="button" className="checkout-secondary-button" onClick={() => setReviewMode(false)}>Edit details</button>
                <button type="button" className="checkout-primary-button" onClick={() => void handlePlaceOrder()} disabled={isSubmitting || !cartDetails.entries.length || !cartDetails.entries.every((item) => item.available)}>
                  {isSubmitting ? "PROCESSING…" : paymentMethod === "cod" ? "PLACE COD ORDER" : "PAY WITH RAZORPAY"}
                </button>
              </div>
              {checkoutError && <p className="checkout-inline-error" role="alert">{checkoutError}</p>}
            </div>
          ) : (
          <>
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
            {savedAddressesLoading && <p role="status">Loading your saved addresses…</p>}
            {savedAddressesError && <p className="checkout-inline-error" role="alert">{savedAddressesError}</p>}
            {savedAddresses.length > 0 && (
              <label className="checkout-field">
                <span>Saved Address</span>
                <select value={savedAddressId} onChange={(event) => selectSavedAddress(event.target.value)}>
                  <option value="">Add a new address / enter manually</option>
                  {savedAddresses.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.fullName} · {entry.phone} · {entry.address}{entry.apartment ? `, ${entry.apartment}` : ""}, {entry.city}, {entry.state} {entry.pinCode}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="checkout-grid checkout-grid--address">
              <label className="checkout-field">
                <span>Address</span>
                <input value={form.address} onChange={(event) => handleFieldChange("address", event.target.value)} placeholder="House number, street name" />
                {errors.address && <small>{errors.address}</small>}
              </label>
              <label className="checkout-field">
                <span>Apartment / Building</span>
                <input value={form.apartment} onChange={(event) => handleFieldChange("apartment", event.target.value)} placeholder="Optional" />
              </label>
              <label className="checkout-field">
                <span>City</span>
                <input value={form.city} onChange={(event) => handleFieldChange("city", event.target.value)} placeholder="City" />
                {errors.city && <small>{errors.city}</small>}
              </label>
              <label className="checkout-field">
                <span>State</span>
                <select required value={normalizeIndianState(form.state)} onChange={(event) => handleFieldChange("state", event.target.value)}>
                  <option value="">Select state or union territory</option>
                  {indianStatesAndTerritories.map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
                {errors.state && <small>{errors.state}</small>}
              </label>
              <label className="checkout-field">
                <span>PIN Code</span>
                <input inputMode="numeric" maxLength={6} value={form.pinCode} onChange={(event) => handleFieldChange("pinCode", event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Postal code" />
                {errors.pinCode && <small>{errors.pinCode}</small>}
              </label>
              <label className="checkout-field">
                <span>Country</span>
                <input value="India" readOnly />
              </label>
            </div>
            {customerAuthenticated && (
              <div>
                {!savedAddressId && <button type="button" className="checkout-secondary-button" onClick={() => void saveCheckoutAddress()} disabled={saveAddressLoading}>
                  {saveAddressLoading ? "Saving address…" : "Save this address to my account"}
                </button>}
                {saveAddressMessage && <p className={saveAddressMessageIsError ? "checkout-inline-error" : ""} role={saveAddressMessageIsError ? "alert" : "status"}>{saveAddressMessage}</p>}
              </div>
            )}
          </div>

          <div className="checkout-section">
            <h3>Payment</h3>
            <div className="checkout-payment-options">
              {checkoutPaymentMethods.map((option) => (
                <label key={option.id} className={`checkout-payment-option ${paymentMethod === option.id ? "is-selected" : ""}`}>
                  <input type="radio" name="payment" value={option.id} checked={paymentMethod === option.id} onChange={() => { setPaymentMethod(option.id); setErrors((current) => ({ ...current, paymentMethod: "" })); }} />
                  <span>{option.label} <small>{option.id === "cod" ? "Pay when your order is delivered" : "Pay securely using Razorpay Checkout"}</small></span>
                </label>
              ))}
            </div>
            {errors.paymentMethod && <small className="checkout-payment-error">{errors.paymentMethod}</small>}
          </div>

          <p className="checkout-delivery-note">Standard delivery estimate: 3–7 business days. PIN code serviceability is not verified by a courier.</p>
          <button type="button" className="checkout-primary-button checkout-primary-button--full" onClick={handleReviewOrder} disabled={!catalogLoaded || !cartDetails.entries.length || !cartDetails.entries.every((item) => item.available)}>
            REVIEW ORDER
          </button>
          {!cartDetails.entries.every((item) => item.available) && catalogLoaded && <p className="checkout-inline-error" role="alert">One or more products are unavailable or no longer listed. Remove them before continuing.</p>}
          {checkoutError && <p className="checkout-inline-error" role="alert">{checkoutError}</p>}
          </>
          )}
        </section>

        <aside className="checkout-summary">
          <h3>Order Summary</h3>

          <div className="checkout-summary__items">
            {visibleOrder.entries.map((item) => (
              <div key={item.id} className="checkout-summary__item">
                <img src={item.image} alt={item.name} />
                <div className="checkout-summary__details">
                  <strong>{item.name}</strong>
                  {item.variant && <span>{item.variant}</span>}
                  {item.available ? <ProductPrice sellingPrice={item.price} originalPrice={item.originalPrice} productName={item.name} /> : <span>Product unavailable</span>}
                  <div className="checkout-item-controls">
                    <button type="button" onClick={() => updateCartQuantity(item.id, item.quantity - 1)} aria-label={`Decrease ${item.name} quantity`}><Minus size={13} /></button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateCartQuantity(item.id, item.quantity + 1)} aria-label={`Increase ${item.name} quantity`}><Plus size={13} /></button>
                    <button type="button" className="checkout-item-remove" onClick={() => updateCartQuantity(item.id, 0)} aria-label={`Remove ${item.name}`}><Trash2 size={14} /></button>
                  </div>
                  <strong className="checkout-summary__line-total">{formatPrice(item.lineTotal)}</strong>
                </div>
              </div>
            ))}
          </div>

          <div className="checkout-summary__totals">
            <div><span>Items ({cartDetails.entries.reduce((sum, item) => sum + item.quantity, 0)})</span><strong>{formatPrice(cartDetails.subtotal)}</strong></div>
            <div><span>Discount</span><strong>{formatPrice(cartDetails.discount)}</strong></div>
            <div><span>Delivery</span><strong>{cartDetails.shipping === 0 ? "Free" : formatPrice(cartDetails.shipping)}</strong></div>
            <div><span>Tax</span><strong>Included</strong></div>
            <div className="checkout-summary__total-row"><span>Total</span><strong>{formatPrice(visibleOrder.total)}</strong></div>
          </div>
          <p className="checkout-summary__price-note">Prices are current catalog prices. Tax is included; free standard delivery.</p>

          <div className="checkout-summary__trust">
            <ShieldCheck size={16} /> Secure checkout protected
          </div>
        </aside>
      </main>
    </div>
  );
}
