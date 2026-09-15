import { Camera, Heart, Search, ShoppingBag, User, X, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { products, type Product } from "../pages/ProductsPage";
import { categoryProducts } from "../pages/CategoryPage";
import { animateAddToCart } from "../lib/cartAnimation";

type Cart = Record<string, number>;
type CartItem = { name: string; price: number; image: string; variant?: string };
type CartItems = Record<string, CartItem>;

type Overlay = "search" | "account" | "wishlist" | "cart" | null;
type LoginStep = "phone" | "otp" | "username" | "profile";
type AccountSection = "main" | "profile" | "orders" | "wishlist" | "addresses";
type AuthUser = {
  username: string;
  isAuthenticated: boolean;
  phone?: string;
  email?: string;
  profileImage?: string;
};
type AddressEntry = {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  isDefault?: boolean;
};
type OrderEntry = {
  id: string;
  orderNumber: string;
  date: string;
  total: number;
  status: string;
  items: { name: string; quantity: number }[];
};

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

function saveCartItems(items: CartItems) {
  window.localStorage.setItem("tribull-cart-items", JSON.stringify(items));
}

function normalizeUsername(value: string) {
  const normalized = value.trim();
  if (!normalized) return { valid: false, value: "", message: "Please enter a valid username." };
  if (!/^[a-zA-Z0-9_]+$/.test(normalized)) return { valid: false, value: "", message: "Please enter a valid username." };
  if (normalized.length < 3) return { valid: false, value: "", message: "Please enter a valid username." };
  return { valid: true, value: normalized, message: "" };
}

export default function HeaderActions() {
  const [, setLocation] = useLocation();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [query, setQuery] = useState("");
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage("tribull-wishlist", []));
  const [cart, setCart] = useState<Cart>(() => readStorage("tribull-cart", {}));
  const [cartItems, setCartItems] = useState<CartItems>(() => readStorage("tribull-cart-items", {}));
  const [authUser, setAuthUser] = useState<AuthUser>(() => readStorage("tribull-user", { username: "", isAuthenticated: false }));
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [accountSection, setAccountSection] = useState<AccountSection>("main");
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ username: authUser.username, phone: authUser.phone || "", email: authUser.email || "", profileImage: authUser.profileImage });
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);
  const [addressForm, setAddressForm] = useState({ fullName: "", phone: "", address: "", city: "", state: "", pinCode: "" });
  const [addressEditId, setAddressEditId] = useState<string | null>(null);
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
      setCartItems(readStorage("tribull-cart-items", {}));
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

  const categoryWishlistProducts = Object.entries(categoryProducts).flatMap(([category, entries]) =>
    Object.entries(entries).flatMap(([entry, items]) => items.map((item) => ({
      id: `${category}-${entry}-${item.name}`,
      name: item.name,
      price: Number(item.price.replace(/[^0-9]/g, "")),
      image: item.image,
    }))),
  );
  const wishlistProducts = [...products, ...categoryWishlistProducts].filter((product) => wishlist.includes(product.id));
  const cartEntries = Object.entries(cart).filter(([, quantity]) => quantity > 0);
  const cartTotal = cartEntries.reduce((total, [id, quantity]) => {
    const product = products.find((item) => item.id === id);
    const item = cartItems[id] || product;
    return total + (item?.price || 0) * quantity;
  }, 0);
  const cartCount = cartEntries.reduce((total, [, quantity]) => total + quantity, 0);

  const closeOverlay = () => {
    setOverlay(null);
    setLoginStep("phone");
    setAccountSection("main");
    setPhoneNumber("");
    setOtp(Array(6).fill(""));
    setOtpError("");
    setDemoOtp(undefined);
    setResendSeconds(0);
  };

  const persistUser = (nextUser: AuthUser) => {
    setAuthUser(nextUser);
    window.localStorage.setItem("tribull-user", JSON.stringify(nextUser));
  };

  const openAccount = () => {
    if (authUser.isAuthenticated && authUser.username) {
      setLoginStep("profile");
      setAccountSection("main");
      setOverlay("account");
      return;
    }
    setLoginStep("phone");
    setAccountSection("main");
    setOtpError("");
    setOverlay("account");
  };

  const beginProfileEdit = () => {
    setProfileDraft({ username: authUser.username, phone: authUser.phone || "", email: authUser.email || "", profileImage: authUser.profileImage });
    setProfileError("");
    setProfileSuccess("");
    setProfileEditing(true);
  };

  const cancelProfileEdit = () => {
    setProfileDraft({ username: authUser.username, phone: authUser.phone || "", email: authUser.email || "", profileImage: authUser.profileImage });
    setProfileError("");
    setProfileSuccess("");
    setProfileEditing(false);
  };

  const saveProfile = () => {
    const normalizedUsername = normalizeUsername(profileDraft.username);
    const normalizedPhone = profileDraft.phone.trim();
    const normalizedEmail = profileDraft.email.trim();
    const phoneDigits = normalizedPhone.replace(/\D/g, "");

    if (!normalizedUsername.valid) {
      setProfileError("Username must be at least 3 characters and use only letters, numbers, or underscores.");
      return;
    }
    if (normalizedPhone && (phoneDigits.length < 7 || phoneDigits.length > 15 || !/^[+\d\s()-]+$/.test(normalizedPhone))) {
      setProfileError("Enter a valid phone number.");
      return;
    }
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setProfileError("Enter a valid email address.");
      return;
    }

    const nextUser: AuthUser = {
      ...authUser,
      username: normalizedUsername.value,
      phone: normalizedPhone,
      email: normalizedEmail,
      profileImage: profileDraft.profileImage,
    };
    persistUser(nextUser);
    setProfileDraft({ username: normalizedUsername.value, phone: normalizedPhone, email: normalizedEmail, profileImage: profileDraft.profileImage });
    setProfileError("");
    setProfileSuccess("Profile updated successfully.");
    setProfileEditing(false);
    window.setTimeout(() => setProfileSuccess(""), 3000);
  };

  const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setProfileDraft((current) => ({ ...current, profileImage: reader.result as string }));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const removeProfileImage = () => {
    setProfileDraft((current) => ({ ...current, profileImage: undefined }));
  };

  const openProfileImagePicker = () => {
    if (!profileEditing) beginProfileEdit();
    profileImageInputRef.current?.click();
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

    const savedUser = readStorage<AuthUser>("tribull-user", { username: "", isAuthenticated: false });
    if (savedUser.isAuthenticated && savedUser.username) {
      setAuthUser(savedUser);
      setLoginStep("profile");
      setAccountSection("main");
      return;
    }

    setLoginStep("username");
    setAccountSection("main");
    setUsernameError("");
    setUsernameDraft("");
  };

  const handleUsernameSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeUsername(usernameDraft);
    if (!normalized.valid) {
      setUsernameError(normalized.message);
      return;
    }

    const nextUser: AuthUser = {
      username: normalized.value,
      isAuthenticated: true,
      phone: phoneNumber || "",
      email: "",
    };
    persistUser(nextUser);
    setLoginStep("profile");
    setAccountSection("main");
    setUsernameError("");
    setUsernameDraft("");
  };

  const handleSignOut = () => {
    persistUser({ ...authUser, isAuthenticated: false });
    setLoginStep("phone");
    setAccountSection("main");
    setOverlay("account");
    setUsernameError("");
    setUsernameDraft("");
    setOtp(Array(6).fill(""));
    setOtpError("");
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

  const orders = readStorage<OrderEntry[]>("tribull-orders", []);
  const addresses = readStorage<AddressEntry[]>("tribull-addresses", []);

  const saveAddresses = (nextAddresses: AddressEntry[]) => {
    window.localStorage.setItem("tribull-addresses", JSON.stringify(nextAddresses));
  };

  const submitAddress = () => {
    const normalizedAddress = {
      fullName: addressForm.fullName.trim(),
      phone: addressForm.phone.trim(),
      address: addressForm.address.trim(),
      city: addressForm.city.trim(),
      state: addressForm.state.trim(),
      pinCode: addressForm.pinCode.trim(),
    };

    if (!normalizedAddress.fullName || !normalizedAddress.phone || !normalizedAddress.address || !normalizedAddress.city || !normalizedAddress.state || !normalizedAddress.pinCode) {
      return;
    }

    const nextAddresses = [...addresses];
    if (addressEditId) {
      const index = nextAddresses.findIndex((entry) => entry.id === addressEditId);
      if (index >= 0) {
        nextAddresses[index] = { ...nextAddresses[index], ...normalizedAddress };
      }
    } else {
      nextAddresses.push({ id: crypto.randomUUID ? crypto.randomUUID() : `address-${Date.now()}`, ...normalizedAddress, isDefault: nextAddresses.length === 0 });
    }

    saveAddresses(nextAddresses);
    setAddressForm({ fullName: "", phone: "", address: "", city: "", state: "", pinCode: "" });
    setAddressEditId(null);
  };

  const deleteAddress = (id: string) => {
    const nextAddresses = addresses.filter((entry) => entry.id !== id);
    const defaultEntry = nextAddresses[0];
    if (defaultEntry) defaultEntry.isDefault = true;
    saveAddresses(nextAddresses);
  };

  const setDefaultAddress = (id: string) => {
    const nextAddresses = addresses.map((entry) => ({ ...entry, isDefault: entry.id === id }));
    saveAddresses(nextAddresses);
  };

  const updateCart = (productId: string, quantity: number, item?: CartItem, source?: HTMLElement) => {
    const nextCart = { ...cart };
    const nextCartItems = { ...cartItems };
    if (quantity <= 0) delete nextCart[productId];
    else {
      nextCart[productId] = quantity;
      if (item) nextCartItems[productId] = item;
    }
    if (quantity <= 0) delete nextCartItems[productId];
    setCart(nextCart);
    setCartItems(nextCartItems);
    saveCart(nextCart);
    saveCartItems(nextCartItems);
    if (item && source) animateAddToCart(source, item.image);
  };

  const toggleWishlist = (productId: string) => {
    const nextWishlist = wishlist.includes(productId)
      ? wishlist.filter((id) => id !== productId)
      : [...wishlist, productId];
    setWishlist(nextWishlist);
    window.localStorage.setItem("tribull-wishlist", JSON.stringify(nextWishlist));
    window.dispatchEvent(new Event("tribull-wishlist-updated"));
  };

  const addSearchProductToCart = (product: Product, source?: HTMLElement) => updateCart(product.id, (cart[product.id] || 0) + 1, product, source);

  return (
    <>
      <div className="header-actions">
        <button className="icon-button" type="button" aria-label="Search" onClick={() => setOverlay("search")}><Search size={19} strokeWidth={1.5} /></button>
        <button className="icon-button" type="button" aria-label={authUser.isAuthenticated ? `Account for ${authUser.username}` : "Account"} onClick={openAccount}>
          {authUser.isAuthenticated && authUser.username ? <span className="header-user-avatar">{authUser.profileImage ? <img src={authUser.profileImage} alt="" /> : authUser.username.charAt(0).toUpperCase()}</span> : <User size={19} strokeWidth={1.5} />}
        </button>
        <button className="icon-button" type="button" aria-label="Wishlist" onClick={() => { setWishlist(readStorage("tribull-wishlist", [])); setOverlay("wishlist"); }}><Heart size={19} strokeWidth={1.5} fill={wishlist.length ? "currentColor" : "none"} /></button>
        <button className="icon-button header-cart-button" type="button" aria-label={`${cartCount} items in cart`} onClick={() => setOverlay("cart")}><ShoppingBag size={19} strokeWidth={1.5} />{cartCount > 0 && <span>{cartCount}</span>}</button>
      </div>

      {overlay && <button className="header-overlay" type="button" aria-label="Close panel" onClick={closeOverlay} />}
      {overlay === "search" && (
        <section className="header-panel header-search-panel" aria-label="Search products">
          <div className="header-panel__heading"><h2>Search</h2><button type="button" aria-label="Close search" onClick={closeOverlay}><X size={20} /></button></div>
          <label className="header-search-field"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or categories" /></label>
          <div className="header-search-results">{searchResults.length ? searchResults.map((product) => <div className="header-search-result" key={product.id}><img src={product.image} alt="" /><div><strong>{product.name}</strong><span>{product.category} · {formatPrice(product.price)}</span></div><button type="button" onClick={(event) => addSearchProductToCart(product, event.currentTarget)} aria-label={`Add ${product.name} to cart`}><Plus size={16} /></button></div>) : <p className="header-empty-state">No products found.</p>}</div>
        </section>
      )}
      {overlay === "account" && (
        <section className={`header-account-drawer ${loginStep !== "profile" || !authUser.isAuthenticated ? "header-login-drawer" : ""}`} role="dialog" aria-modal="true" aria-label="Account panel">
          {loginStep === "profile" && authUser.isAuthenticated ? (
            <div className="header-account-drawer__content">
              <div className="header-account-drawer__header">
                <div className="header-account-drawer__title-wrap">
                  <h2>Account</h2>
                </div>
                <button type="button" className="header-account-drawer__close" onClick={closeOverlay} aria-label="Close account drawer"><X size={20} /></button>
              </div>

              {accountSection === "main" && (
                <>
                  <div className="header-profile-summary">
                    <span className="header-profile-summary__avatar">{authUser.profileImage ? <img src={authUser.profileImage} alt="" /> : authUser.username.charAt(0).toUpperCase()}</span>
                    <div>
                      <p className="header-profile-summary__handle">@{authUser.username}</p>
                    </div>
                  </div>

                  <nav className="header-account-drawer__nav" aria-label="Account navigation">
                    <button type="button" onClick={() => setAccountSection("profile")}>My Profile</button>
                    <button type="button" onClick={() => setAccountSection("orders")}>My Orders</button>
                    <button type="button" onClick={() => setAccountSection("wishlist")}>Wishlist</button>
                    <button type="button" onClick={() => setAccountSection("addresses")}>Addresses</button>
                    <button type="button" className="header-account-drawer__signout" onClick={handleSignOut}>Sign Out</button>
                  </nav>
                </>
              )}

              {accountSection === "profile" && (
                <div className="header-account-section">
                  <button type="button" className="header-account-section__back" onClick={() => setAccountSection("main")}>← Account</button>
                  <div className="header-account-section__content">
                    <div className="header-profile-avatar-editor">
                      <div className="header-profile-avatar-wrap">
                        <button type="button" className="header-profile-avatar-button" onClick={openProfileImagePicker} aria-label="Change profile photo">
                          {(profileEditing ? profileDraft.profileImage : authUser.profileImage) ? <img src={(profileEditing ? profileDraft.profileImage : authUser.profileImage) as string} alt="Profile" /> : <span>{authUser.username.charAt(0).toUpperCase()}</span>}
                        </button>
                        <button type="button" className="header-profile-avatar-camera" onClick={openProfileImagePicker} aria-label="Change profile photo"><Camera size={14} /></button>
                      </div>
                      <input ref={profileImageInputRef} className="header-profile-image-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileImageChange} />
                      {profileEditing && <>
                        <button type="button" className="header-profile-photo-action" onClick={openProfileImagePicker}>Change photo</button>
                        <button type="button" className="header-profile-photo-action header-profile-photo-action--remove" onClick={removeProfileImage}>Remove photo</button>
                      </>}
                    </div>
                    {profileEditing ? (
                      <div className="header-account-profile-form">
                        <label className="checkout-field">
                          <span>Username</span>
                          <input value={profileDraft.username} onChange={(event) => setProfileDraft((current) => ({ ...current, username: event.target.value }))} autoComplete="username" />
                        </label>
                        <label className="checkout-field">
                          <span>Phone</span>
                          <input value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} type="tel" autoComplete="tel" />
                        </label>
                        <label className="checkout-field">
                          <span>Email</span>
                          <input value={profileDraft.email} onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} type="email" autoComplete="email" />
                        </label>
                        {profileError && <p className="header-form-error" role="alert">{profileError}</p>}
                        <div className="header-account-profile-actions">
                          <button type="button" className="header-account-drawer__cta" onClick={saveProfile}>Save Changes</button>
                          <button type="button" className="header-profile-cancel" onClick={cancelProfileEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="header-account-section__handle">@{authUser.username}</p>
                        <p className="header-account-section__name">{authUser.username}</p>
                        <div className="header-account-section__meta-group">
                          <div><span>Phone</span><strong>{authUser.phone || "Not available"}</strong></div>
                          <div><span>Email</span><strong>{authUser.email || "Not available"}</strong></div>
                        </div>
                        {profileSuccess && <p className="header-profile-success" role="status">{profileSuccess}</p>}
                        <button type="button" className="header-account-drawer__cta" onClick={beginProfileEdit}>Edit Profile</button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {accountSection === "orders" && (
                <div className="header-account-section">
                  <button type="button" className="header-account-section__back" onClick={() => setAccountSection("main")}>← Account</button>
                  <div className="header-account-section__content">
                    <h3>My Orders</h3>
                    {orders.length ? orders.map((order) => (
                      <div className="header-account-card" key={order.id}>
                        <div className="header-account-card__row header-account-card__row--split">
                          <strong>Order #{order.orderNumber}</strong>
                          <span>{order.date}</span>
                        </div>
                        <div className="header-account-card__body">
                          {order.items.map((item, index) => (
                            <div key={`${order.id}-${index}`} className="header-account-card__item">
                              <span>{item.name}</span>
                              <small>Qty: {item.quantity}</small>
                            </div>
                          ))}
                        </div>
                        <div className="header-account-card__row header-account-card__row--split">
                          <span>Total: {formatPrice(order.total)}</span>
                          <strong>{order.status}</strong>
                        </div>
                      </div>
                    )) : (
                      <div className="header-account-empty">
                        <p>No Orders Yet</p>
                        <span>Your orders will appear here after you place an order.</span>
                        <button type="button" className="header-account-drawer__cta" onClick={closeOverlay}>Start Shopping</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {accountSection === "wishlist" && (
                <div className="header-account-section">
                  <button type="button" className="header-account-section__back" onClick={() => setAccountSection("main")}>← Account</button>
                  <div className="header-account-section__content">
                    <h3>Wishlist</h3>
                    <div className="header-account-wishlist">
                      {wishlistProducts.length ? wishlistProducts.map((product) => (
                        <div className="header-account-card header-account-card--wishlist" key={product.id}>
                          <img src={product.image} alt={product.name} />
                          <div>
                            <strong>{product.name}</strong>
                            <span>{formatPrice(product.price)}</span>
                          </div>
                          <div className="header-account-card__actions">
                            <button type="button" onClick={() => toggleWishlist(product.id)}>Remove</button>
                            <button type="button" onClick={(event) => { updateCart(product.id, (cart[product.id] || 0) + 1, product, event.currentTarget); }}>Add to Cart</button>
                          </div>
                        </div>
                      )) : (
                        <div className="header-account-empty"><p>Your Wishlist is Empty</p></div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {accountSection === "addresses" && (
                <div className="header-account-section">
                  <button type="button" className="header-account-section__back" onClick={() => setAccountSection("main")}>← Account</button>
                  <div className="header-account-section__content">
                    <h3>Addresses</h3>
                    <div className="header-account-addresses">
                      {addresses.length ? addresses.map((entry) => (
                        <div key={entry.id} className={`header-account-card ${entry.isDefault ? "is-default" : ""}`}>
                          <div className="header-account-card__row header-account-card__row--split">
                            <strong>{entry.fullName}</strong>
                            {entry.isDefault && <span>Default</span>}
                          </div>
                          <p>{entry.address}</p>
                          <p>{entry.city}, {entry.state} - {entry.pinCode}</p>
                          <p>{entry.phone}</p>
                          <div className="header-account-card__actions header-account-card__actions--stack">
                            <button type="button" onClick={() => { setAddressEditId(entry.id); setAddressForm({ fullName: entry.fullName, phone: entry.phone, address: entry.address, city: entry.city, state: entry.state, pinCode: entry.pinCode }); }}>Edit</button>
                            {!entry.isDefault && <button type="button" onClick={() => setDefaultAddress(entry.id)}>Set Default</button>}
                            <button type="button" onClick={() => deleteAddress(entry.id)}>Delete</button>
                          </div>
                        </div>
                      )) : <div className="header-account-empty"><p>No Addresses Saved</p></div>}
                    </div>

                    <div className="header-account-address-form">
                      <h4>{addressEditId ? "Edit Address" : "Add Address"}</h4>
                      <div className="checkout-grid checkout-grid--two">
                        <label className="checkout-field">
                          <span>Full Name</span>
                          <input value={addressForm.fullName} onChange={(event) => setAddressForm((current) => ({ ...current, fullName: event.target.value }))} />
                        </label>
                        <label className="checkout-field">
                          <span>Phone</span>
                          <input value={addressForm.phone} onChange={(event) => setAddressForm((current) => ({ ...current, phone: event.target.value }))} />
                        </label>
                      </div>
                      <label className="checkout-field">
                        <span>Address</span>
                        <input value={addressForm.address} onChange={(event) => setAddressForm((current) => ({ ...current, address: event.target.value }))} />
                      </label>
                      <div className="checkout-grid checkout-grid--three">
                        <label className="checkout-field">
                          <span>City</span>
                          <input value={addressForm.city} onChange={(event) => setAddressForm((current) => ({ ...current, city: event.target.value }))} />
                        </label>
                        <label className="checkout-field">
                          <span>State</span>
                          <input value={addressForm.state} onChange={(event) => setAddressForm((current) => ({ ...current, state: event.target.value }))} />
                        </label>
                        <label className="checkout-field">
                          <span>PIN Code</span>
                          <input value={addressForm.pinCode} onChange={(event) => setAddressForm((current) => ({ ...current, pinCode: event.target.value }))} />
                        </label>
                      </div>
                      <button type="button" className="header-account-drawer__cta" onClick={submitAddress}>{addressEditId ? "Save Address" : "Add Address"}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}
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
          {cartEntries.length ? <><div className="header-cart-list">{cartEntries.map(([id, quantity]) => { const product = products.find((item) => item.id === id); const item = cartItems[id] || product; if (!item) return null; return <div className="header-list-item header-cart-item" key={id}><img src={item.image} alt={item.name} /><div><strong>{item.name}</strong>{item.variant && <span className="header-cart-variant">{item.variant}</span>}<span>{formatPrice(item.price)} · <strong>{formatPrice(item.price * quantity)}</strong></span><div className="header-quantity"><button type="button" onClick={() => updateCart(id, quantity - 1)} aria-label={`Decrease quantity of ${item.name}`}><Minus size={13} /></button><span>{quantity}</span><button type="button" onClick={() => updateCart(id, quantity + 1)} aria-label={`Increase quantity of ${item.name}`}><Plus size={13} /></button></div></div><button type="button" aria-label={`Remove ${item.name} from cart`} onClick={() => updateCart(id, 0)}><Trash2 size={15} /></button></div>; })}</div><div className="header-cart-total"><span>Total</span><strong>{formatPrice(cartTotal)}</strong></div><button className="header-checkout" type="button" onClick={() => { closeOverlay(); setLocation("/checkout"); }}>Checkout</button></> : <p className="header-empty-state">Your Cart is Empty</p>}
        </section>
      )}
    </>
  );
}
