import { Heart, Search, ShoppingBag, User, X, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { products, type Product } from "../pages/ProductsPage";

type Cart = Record<string, number>;

type Overlay = "search" | "account" | "wishlist" | "cart" | null;
type LoginStep = "phone" | "otp";

const requestOtp = async (phoneNumber: string) => {
  try {
    const response = await fetch("/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });
    if (response.ok) return { ok: true, demoOtp: undefined as string | undefined };
  } catch {
    // The SMS provider is optional until the backend endpoint is configured.
  }
  return { ok: true, demoOtp: "123456" };
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function formatPrice(price: number) {
  return `₹${price.toLocaleString("en-IN")}`;
}

function GoogleLogo() {
  return (
    <svg className="google-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z" />
      <path fill="#34A853" d="M12 21.99c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.99Z" />
      <path fill="#FBBC05" d="M6.54 14.07a5.86 5.86 0 0 1 0-3.74V7.8H3.3a9.98 9.98 0 0 0 0 8.8l3.24-2.53Z" />
      <path fill="#EA4335" d="M12 6.3c1.43 0 2.72.49 3.73 1.45l2.8-2.8C16.84 3.38 14.63 2.42 12 2.42a9.74 9.74 0 0 0-8.7 5.38l3.24 2.53C7.31 8.02 9.46 6.3 12 6.3Z" />
    </svg>
  );
}

function saveCart(cart: Cart) {
  window.localStorage.setItem("tribull-cart", JSON.stringify(cart));
  window.dispatchEvent(new Event("tribull-cart-updated"));
}

export default function HeaderActions() {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [query, setQuery] = useState("");
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage("tribull-wishlist", []));
  const [cart, setCart] = useState<Cart>(() => readStorage("tribull-cart", {}));
  const [loginStep, setLoginStep] = useState<LoginStep>("phone");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [otpError, setOtpError] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | undefined>();
  const [resendSeconds, setResendSeconds] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const syncStores = () => {
      setWishlist(readStorage("tribull-wishlist", []));
      setCart(readStorage("tribull-cart", {}));
    };
    window.addEventListener("tribull-cart-updated", syncStores);
    window.addEventListener("tribull-wishlist-updated", syncStores);
    window.addEventListener("storage", syncStores);
    return () => {
      window.removeEventListener("tribull-cart-updated", syncStores);
      window.removeEventListener("tribull-wishlist-updated", syncStores);
      window.removeEventListener("storage", syncStores);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("header-overlay-open", overlay !== null);
    return () => document.body.classList.remove("header-overlay-open");
  }, [overlay]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return products.slice(0, 6);
    return products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(normalizedQuery));
  }, [query]);

  const wishlistProducts = products.filter((product) => wishlist.includes(product.id));
  const cartEntries = Object.entries(cart).filter(([, quantity]) => quantity > 0);
  const cartTotal = cartEntries.reduce((total, [id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return total + (product?.price || 0) * quantity;
  }, 0);
  const cartCount = cartEntries.reduce((total, [, quantity]) => total + quantity, 0);

  const closeOverlay = () => {
    setOverlay(null);
    setLoginStep("phone");
    setPhoneNumber("");
    setOtp(Array(6).fill(""));
    setOtpError("");
    setDemoOtp(undefined);
    setResendSeconds(0);
  };

  const openAccount = () => {
    setLoginStep("phone");
    setOtpError("");
    setOverlay("account");
  };

  const sendOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPhone = phoneNumber.replace(/\D/g, "");
    if (normalizedPhone.length !== 10 || !/^[6-9]\d{9}$/.test(normalizedPhone)) {
      setOtpError("Enter a valid 10-digit mobile number.");
      return;
    }
    const result = await requestOtp(`${countryCode}${normalizedPhone}`);
    if (!result.ok) {
      setOtpError("We could not send the OTP. Please try again.");
      return;
    }
    setDemoOtp(result.demoOtp);
    setOtp(Array(6).fill(""));
    setOtpError("");
    setLoginStep("otp");
    setResendSeconds(30);
    window.setTimeout(() => otpRefs.current[0]?.focus(), 50);
  };

  const updateOtp = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);
    setOtpError("");
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const verifyOtp = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const enteredOtp = otp.join("");
    if (enteredOtp.length !== 6) {
      setOtpError("Enter all 6 digits to continue.");
      return;
    }
    if (demoOtp && enteredOtp !== demoOtp) {
      setOtpError("That OTP is invalid or expired. Please try again.");
      return;
    }
    closeOverlay();
  };

  const resendOtp = async () => {
    if (resendSeconds > 0) return;
    const result = await requestOtp(`${countryCode}${phoneNumber.replace(/\D/g, "")}`);
    setDemoOtp(result.demoOtp);
    setOtp(Array(6).fill(""));
    setOtpError("");
    setResendSeconds(30);
    window.setTimeout(() => otpRefs.current[0]?.focus(), 50);
  };

  const updateCart = (productId: string, quantity: number) => {
    const nextCart = { ...cart };
    if (quantity <= 0) delete nextCart[productId];
    else nextCart[productId] = quantity;
    setCart(nextCart);
    saveCart(nextCart);
  };

  const toggleWishlist = (productId: string) => {
    const nextWishlist = wishlist.includes(productId)
      ? wishlist.filter((id) => id !== productId)
      : [...wishlist, productId];
    setWishlist(nextWishlist);
    window.localStorage.setItem("tribull-wishlist", JSON.stringify(nextWishlist));
    window.dispatchEvent(new Event("tribull-wishlist-updated"));
  };

  const addSearchProductToCart = (product: Product) => updateCart(product.id, (cart[product.id] || 0) + 1);

  return (
    <>
      <div className="header-actions">
        <button className="icon-button" type="button" aria-label="Search" onClick={() => setOverlay("search")}><Search size={19} strokeWidth={1.5} /></button>
        <button className="icon-button" type="button" aria-label="Account" onClick={openAccount}><User size={19} strokeWidth={1.5} /></button>
        <button className="icon-button" type="button" aria-label="Wishlist" onClick={() => setOverlay("wishlist")}><Heart size={19} strokeWidth={1.5} fill={wishlist.length ? "currentColor" : "none"} /></button>
        <button className="icon-button header-cart-button" type="button" aria-label={`${cartCount} items in cart`} onClick={() => setOverlay("cart")}><ShoppingBag size={19} strokeWidth={1.5} />{cartCount > 0 && <span>{cartCount}</span>}</button>
      </div>

      {overlay && <button className="header-overlay" type="button" aria-label="Close panel" onClick={closeOverlay} />}
      {overlay === "search" && (
        <section className="header-panel header-search-panel" aria-label="Search products">
          <div className="header-panel__heading"><h2>Search</h2><button type="button" aria-label="Close search" onClick={closeOverlay}><X size={20} /></button></div>
          <label className="header-search-field"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or categories" /></label>
          <div className="header-search-results">{searchResults.length ? searchResults.map((product) => <div className="header-search-result" key={product.id}><img src={product.image} alt="" /><div><strong>{product.name}</strong><span>{product.category} · {formatPrice(product.price)}</span></div><button type="button" onClick={() => addSearchProductToCart(product)} aria-label={`Add ${product.name} to cart`}><Plus size={16} /></button></div>) : <p className="header-empty-state">No products found.</p>}</div>
        </section>
      )}
      {overlay === "account" && (
        <section className="header-account-modal" role="dialog" aria-modal="true" aria-label="Account login">
          <button className="header-account-modal__close" type="button" aria-label="Close login" onClick={closeOverlay}><X size={20} /></button>
          <p className="eyebrow">Welcome back</p><h2>{loginStep === "phone" ? "Login" : "Verify OTP"}</h2>
          {loginStep === "phone" ? <>
            <form onSubmit={sendOtp}>
              <label>Phone number<div className="phone-input"><select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} aria-label="Country code"><option>+91</option><option>+1</option><option>+44</option><option>+971</option></select><input type="tel" inputMode="numeric" autoFocus value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Enter mobile number" /></div></label>
              {otpError && <p className="header-form-error" role="alert">{otpError}</p>}
              <button className="header-account-modal__submit" type="submit">Get OTP</button>
            </form>
            <div className="header-login-divider"><span>OR</span></div>
            <button className="google-sign-in" type="button" onClick={() => window.alert("Google Sign-In will connect when a Google client ID is configured.")}><GoogleLogo />Continue with Google</button>
          </> : <>
            <p className="otp-instruction">Enter the OTP sent to {countryCode} {phoneNumber.replace(/(\d{5})(\d{5})/, "$1 $2")}</p>
            <form onSubmit={verifyOtp}>
              <div className="otp-inputs" aria-label="One-time password">
                {otp.map((digit, index) => <input key={index} ref={(element) => { otpRefs.current[index] = element; }} value={digit} onChange={(event) => updateOtp(index, event.target.value)} onKeyDown={(event) => handleOtpKeyDown(index, event)} inputMode="numeric" maxLength={1} aria-label={`OTP digit ${index + 1}`} />)}
              </div>
              {demoOtp && <p className="otp-demo-note">SMS service is not configured. Demo OTP: {demoOtp}</p>}
              {otpError && <p className="header-form-error" role="alert">{otpError}</p>}
              <button className="header-account-modal__submit" type="submit">Verify &amp; Sign In</button>
            </form>
            <button className="resend-otp" type="button" disabled={resendSeconds > 0} onClick={resendOtp}>{resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : "Resend OTP"}</button>
          </>}
        </section>
      )}
      {overlay === "wishlist" && (
        <section className="header-panel header-side-panel" aria-label="Wishlist">
          <div className="header-panel__heading"><h2>Wishlist</h2><button type="button" aria-label="Close wishlist" onClick={closeOverlay}><X size={20} /></button></div>
          {wishlistProducts.length ? wishlistProducts.map((product) => <div className="header-list-item" key={product.id}><img src={product.image} alt="" /><div><strong>{product.name}</strong><span>{formatPrice(product.price)}</span></div><button type="button" aria-label={`Remove ${product.name} from wishlist`} onClick={() => toggleWishlist(product.id)}><Trash2 size={15} /></button></div>) : <p className="header-empty-state">Your Wishlist is Empty</p>}
        </section>
      )}
      {overlay === "cart" && (
        <section className="header-panel header-side-panel" aria-label="Shopping cart">
          <div className="header-panel__heading"><h2>Cart</h2><button type="button" aria-label="Close cart" onClick={closeOverlay}><X size={20} /></button></div>
          {cartEntries.length ? <><div className="header-cart-list">{cartEntries.map(([id, quantity]) => { const product = products.find((item) => item.id === id); if (!product) return null; return <div className="header-list-item" key={id}><img src={product.image} alt="" /><div><strong>{product.name}</strong><span>{formatPrice(product.price)} · {formatPrice(product.price * quantity)}</span><div className="header-quantity"><button type="button" onClick={() => updateCart(id, quantity - 1)} aria-label="Decrease quantity"><Minus size={13} /></button><span>{quantity}</span><button type="button" onClick={() => updateCart(id, quantity + 1)} aria-label="Increase quantity"><Plus size={13} /></button></div></div><button type="button" aria-label={`Remove ${product.name} from cart`} onClick={() => updateCart(id, 0)}><Trash2 size={15} /></button></div>; })}</div><div className="header-cart-total"><span>Total</span><strong>{formatPrice(cartTotal)}</strong></div><button className="header-checkout" type="button" onClick={() => window.alert("Checkout is coming soon.")}>Checkout</button></> : <p className="header-empty-state">Your Cart is Empty</p>}
        </section>
      )}
    </>
  );
}
