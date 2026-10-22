import { ArrowRight, Camera, Eye, EyeOff, Heart, LockKeyhole, Mail, Phone, Search, ShoppingBag, User, X, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "../lib/api";
import { validateCustomerAddress } from "../lib/customerAddress";
import {
  createEmptyCustomerAddressFields,
  deleteSavedCustomerAddress,
  fetchCustomerAddresses,
  saveCustomerAddress,
  type SavedCustomerAddress,
} from "../lib/customerAddresses";
import { fetchCustomerProfile, readProfilePhotoFile, saveCustomerProfile } from "../lib/customerProfile";
import { preserveGuestWishlist, restoreGuestWishlist, syncCustomerWishlist, toggleWishlistItem } from "../lib/wishlist";
import { getCheckoutPaymentLabel, indianStatesAndTerritories, normalizeIndianState } from "../../../shared/checkout";
import type { Product } from "../../../shared/products";
import { fetchProducts, getCachedProducts, refreshProducts } from "../lib/products";
import { matchesProductSearch } from "../lib/productSearch";
import { getOrderStatusDisplay } from "../lib/orderStatus";

type Cart = Record<string, number>;
type CartItem = { productId?: string; name: string; price: number; image: string; variant?: string };
type CartItems = Record<string, CartItem>;

type Overlay = "search" | "account" | "wishlist" | "cart" | null;
type LoginStep = "login" | "signup" | "forgot" | "verify-otp" | "new-password" | "google-profile" | "profile";
type GoogleProfileField = "name" | "mobile";
type AccountSection = "main" | "profile" | "orders" | "wishlist" | "addresses";
type AuthUser = {
  username: string;
  isAuthenticated: boolean;
  phone?: string;
  email?: string;
  profileImage?: string;
};
type AddressEntry = SavedCustomerAddress;
type OrderEntry = {
  id: string;
  createdAt: string;
  total: number;
  status: string;
  statusUpdatedAt?: string;
  payment: { method: string; status: string };
  items: { id: string; name: string; image?: string; quantity: number; variant?: string; price: number; originalPrice?: number; lineTotal: number }[];
  shippingAddress: { address: string; apartment: string; city: string; state: string; pinCode: string; country: string; recipientName?: string; phone?: string };
  tracking?: { carrier?: string; trackingNumber?: string; trackingUrl?: string; shippedAt?: string; deliveredAt?: string };
};

const orderProgressLabels = ["Order Placed", "Processing", "Shipped", "Delivered"];

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

function normalizeProfileName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 80) return { valid: false, value: "", message: "Enter a name between 2 and 80 characters." };
  return { valid: true, value: normalized, message: "" };
}

function isCustomerLoginResponse(value: unknown): value is { user: { username: string; email?: string; mobile?: string } } {
  if (typeof value !== "object" || value === null || !("user" in value) || typeof value.user !== "object" || value.user === null || !("username" in value.user) || typeof value.user.username !== "string") {
    return false;
  }
  return (!("email" in value.user) || typeof value.user.email === "string")
    && (!("mobile" in value.user) || typeof value.user.mobile === "string");
}

type GooglePromptNotification = { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean };
type GoogleIdentityAPI = {
  initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
  prompt: (listener?: (notification: GooglePromptNotification) => void) => void;
};

function getGoogleIdentityAPI(): GoogleIdentityAPI | undefined {
  const candidate = window.google as typeof window.google & { accounts?: { id?: GoogleIdentityAPI } };
  return candidate?.accounts?.id;
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

export default function HeaderActions() {
  const [, setLocation] = useLocation();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [query, setQuery] = useState("");
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage("tribull-wishlist", []));
  const [cart, setCart] = useState<Cart>(() => readStorage("tribull-cart", {}));
  const [cartItems, setCartItems] = useState<CartItems>(() => readStorage("tribull-cart-items", {}));
  const [products, setProducts] = useState<Product[]>(getCachedProducts);
  const [authUser, setAuthUser] = useState<AuthUser>(() => ({
    ...readStorage<AuthUser>("tribull-user", { username: "", isAuthenticated: false }),
    isAuthenticated: false,
  }));
  const [accountSection, setAccountSection] = useState<AccountSection>("main");
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ username: authUser.username, phone: authUser.phone || "", email: authUser.email || "", profileImage: authUser.profileImage });
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileLoadError, setProfileLoadError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profilePhotoChanged, setProfilePhotoChanged] = useState(false);
  const [profilePhotoReading, setProfilePhotoReading] = useState(false);
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);
  const profilePhotoReadVersionRef = useRef(0);
  const profileSaveInFlightRef = useRef(false);
  const [addressForm, setAddressForm] = useState(createEmptyCustomerAddressFields);
  const [addressEditId, setAddressEditId] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<AddressEntry[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressSuccess, setAddressSuccess] = useState("");
  const addressRequestIdRef = useRef<string | null>(null);
  const addressFetchVersionRef = useRef(0);
  const addressOperationInFlightRef = useRef(false);
  const [orders, setOrders] = useState<OrderEntry[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [loginStep, setLoginStep] = useState<LoginStep>("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupMobile, setSignupMobile] = useState("");
  const [pendingGoogleToken, setPendingGoogleToken] = useState("");
  const [googleProfileMissingFields, setGoogleProfileMissingFields] = useState<GoogleProfileField[]>([]);
  const [recoveryOtp, setRecoveryOtp] = useState("");
  const [recoveryNewPassword, setRecoveryNewPassword] = useState("");
  const [recoveryPasswordConfirmation, setRecoveryPasswordConfirmation] = useState("");
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [showRecoveryPasswordConfirmation, setShowRecoveryPasswordConfirmation] = useState(false);
  const [recoveryResendSeconds, setRecoveryResendSeconds] = useState(0);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginClosing, setLoginClosing] = useState(false);
  const loginCloseTimerRef = useRef<number | undefined>(undefined);
  const resetRedirectTimerRef = useRef<number | undefined>(undefined);
  const googleScriptPromiseRef = useRef<Promise<void> | null>(null);
  const isLoginPanelOpen = overlay === "account" && (loginStep !== "profile" || !authUser.isAuthenticated);

  useEffect(() => {
    let active = true;
    const syncProducts = (refresh = false) => {
      const request = refresh ? refreshProducts() : fetchProducts();
      void request.then((items) => {
        if (active) setProducts(items);
      }).catch((error: unknown) => {
        console.error("Could not load products for account actions.", error);
      });
    };
    syncProducts();
    const refreshCatalog = () => syncProducts();
    window.addEventListener("tribull-products-updated", refreshCatalog);
    window.addEventListener("tribull-products-cache-updated", refreshCatalog);
    return () => {
      active = false;
      window.removeEventListener("tribull-products-updated", refreshCatalog);
      window.removeEventListener("tribull-products-cache-updated", refreshCatalog);
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch("/api/auth/me")
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          if (response.status === 401) {
            preserveGuestWishlist();
            const signedOut: AuthUser = { username: "", isAuthenticated: false };
            setAuthUser(signedOut);
            window.localStorage.removeItem("tribull-user");
          }
          return;
        }
        const data: unknown = await response.json();
        if (active && isCustomerLoginResponse(data)) {
          const user: AuthUser = {
            username: data.user.username,
            email: data.user.email,
            phone: data.user.mobile,
            isAuthenticated: true,
          };
          setAuthUser(user);
          window.localStorage.setItem("tribull-user", JSON.stringify(user));
        }
      })
      .catch(() => {
        // Authentication stays signed out until the backend can confirm a session.
      });
    return () => { active = false; };
  }, []);

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
    if (!authUser.isAuthenticated) return;
    void syncCustomerWishlist().catch(() => undefined);
  }, [authUser.isAuthenticated]);

  useEffect(() => {
    if (!authUser.isAuthenticated) {
      setProfileLoadError("");
      return;
    }
    let active = true;
    void fetchCustomerProfile()
      .then((profile) => {
        if (!active) return;
        const user: AuthUser = {
          username: profile.name,
          email: profile.email,
          phone: profile.phone,
          profileImage: profile.photo,
          isAuthenticated: true,
        };
        setAuthUser(user);
        window.localStorage.setItem("tribull-user", JSON.stringify(user));
        if (!profileEditing) {
          setProfileDraft({
            username: profile.name,
            email: profile.email,
            phone: profile.phone,
            profileImage: profile.photo,
          });
        }
        setProfileLoadError("");
      })
      .catch((error: unknown) => {
        if (active) setProfileLoadError(error instanceof Error ? error.message : "Unable to load your saved profile.");
      });
    return () => { active = false; };
  }, [authUser.isAuthenticated]);

  useEffect(() => {
    if (overlay !== "account" || !authUser.isAuthenticated) return;
    let active = true;
    let timer: number | undefined;

    if (accountSection === "addresses") {
      const requestVersion = ++addressFetchVersionRef.current;
      setAddresses([]);
      setAddressesLoading(true);
      setAddressError("");
      void fetchCustomerAddresses()
        .then((data) => {
          if (active && requestVersion === addressFetchVersionRef.current) setAddresses(data);
        })
        .catch((error: unknown) => {
          if (active && requestVersion === addressFetchVersionRef.current) {
            setAddresses([]);
            setAddressError(error instanceof Error ? error.message : "Unable to load saved addresses.");
          }
        })
        .finally(() => {
          if (active && requestVersion === addressFetchVersionRef.current) setAddressesLoading(false);
        });
    }

    if (accountSection === "orders") {
      const loadOrders = (page: number, append: boolean) => {
        setOrdersLoading(true);
        setOrdersError("");
        if (page === 1 && !append) {
          setOrders([]);
          setOrdersTotal(0);
        }
        void apiFetch(`/api/customer/orders?page=${page}`, { cache: "no-store" })
          .then(async (response) => {
            const data = await response.json().catch(() => undefined) as { orders?: OrderEntry[]; total?: number; error?: string } | undefined;
            if (!response.ok || !data || !Array.isArray(data.orders) || typeof data.total !== "number" || !Number.isInteger(data.total) || data.total < 0) {
              throw new Error(data?.error || "The order service returned an invalid response.");
            }
            if (active) {
              setOrders((current) => {
                if (!append) return data.orders!;
                const refreshed = new Map(current.map((order) => [order.id, order]));
                for (const order of data.orders!) refreshed.set(order.id, order);
                return Array.from(refreshed.values());
              });
              setOrdersTotal(data.total);
            }
          })
          .catch((error: unknown) => {
            if (active) {
              if (page === 1 && !append) {
                setOrders([]);
                setOrdersTotal(0);
              }
              setOrdersError(error instanceof Error ? error.message : "Unable to load your orders.");
            }
          })
          .finally(() => { if (active) setOrdersLoading(false); });
      };
      loadOrders(ordersPage, ordersPage > 1);
      timer = window.setInterval(() => loadOrders(1, true), 20_000);
    }

    return () => {
      active = false;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [overlay, accountSection, authUser.isAuthenticated, ordersPage]);

  useEffect(() => {
    document.body.classList.toggle("header-overlay-open", overlay !== null);
    return () => document.body.classList.remove("header-overlay-open");
  }, [overlay]);

  useEffect(() => {
    const body = document.body;
    body.classList.toggle("header-login-overlay-open", isLoginPanelOpen);
    if (isLoginPanelOpen) {
      body.style.setProperty("--header-scrollbar-compensation", `${window.innerWidth - document.documentElement.clientWidth}px`);
    } else {
      body.style.removeProperty("--header-scrollbar-compensation");
    }
    return () => {
      body.classList.remove("header-login-overlay-open");
      body.style.removeProperty("--header-scrollbar-compensation");
    };
  }, [isLoginPanelOpen]);
  useEffect(() => () => {
    if (loginCloseTimerRef.current !== undefined) window.clearTimeout(loginCloseTimerRef.current);
    if (resetRedirectTimerRef.current !== undefined) window.clearTimeout(resetRedirectTimerRef.current);
  }, []);

  useEffect(() => {
    if (loginStep !== "verify-otp" || recoveryResendSeconds <= 0) return;
    const timer = window.setTimeout(() => setRecoveryResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [loginStep, recoveryResendSeconds]);

  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return products.slice(0, 6);
    return products.filter((product) => matchesProductSearch(product, normalizedQuery));
  }, [products, query]);

  const wishlistProducts = products.filter((product) => wishlist.includes(product.id));
  const cartEntries = Object.entries(cart).filter(([, quantity]) => quantity > 0);
  const cartTotal = cartEntries.reduce((total, [id, quantity]) => {
    const product = products.find((item) => item.id === (cartItems[id]?.productId || id));
    return total + (product?.price || 0) * quantity;
  }, 0);
  const cartCount = cartEntries.reduce((total, [, quantity]) => total + quantity, 0);

  const resetOverlay = () => {
    setOverlay(null);
    setLoginStep("login");
    setAccountSection("main");
    setLoginEmail("");
    setLoginPassword("");
    setRecoveryOtp("");
    setRecoveryNewPassword("");
    setRecoveryPasswordConfirmation("");
    setRecoveryResendSeconds(0);
    setShowLoginPassword(false);
    setLoginError("");
    setLoginSuccess("");
  };

  const closeOverlay = () => {
    if (overlay === "account" && (loginStep !== "profile" || !authUser.isAuthenticated)) {
      if (loginClosing) return;
      setLoginClosing(true);
      loginCloseTimerRef.current = window.setTimeout(() => {
        resetOverlay();
        setLoginClosing(false);
        loginCloseTimerRef.current = undefined;
      }, 500);
      return;
    }
    resetOverlay();
  };

  useEffect(() => {
    if (overlay !== "search") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeOverlay();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [overlay]);

  const persistUser = (nextUser: AuthUser) => {
    setAuthUser(nextUser);
    window.localStorage.setItem("tribull-user", JSON.stringify(nextUser));
    if (nextUser.isAuthenticated) window.dispatchEvent(new Event("tribull-customer-authenticated"));
  };

  const openAccount = () => {
    setLoginSuccess("");
    if (loginCloseTimerRef.current !== undefined) {
      window.clearTimeout(loginCloseTimerRef.current);
      loginCloseTimerRef.current = undefined;
    }
    setLoginClosing(false);
    if (authUser.isAuthenticated && authUser.username) {
      setLoginStep("profile");
      setAccountSection("main");
      setOverlay("account");
      return;
    }
    setLoginStep("login");
    setAccountSection("main");
    setLoginError("");
    setLoginSuccess("");
    setOverlay("account");
  };

  useEffect(() => {
    const openLoginForCheckout = () => openAccount();
    window.addEventListener("tribull-open-login", openLoginForCheckout);
    return () => window.removeEventListener("tribull-open-login", openLoginForCheckout);
  }, [authUser.isAuthenticated]);

  const beginProfileEdit = () => {
    profilePhotoReadVersionRef.current += 1;
    setProfilePhotoChanged(false);
    setProfilePhotoReading(false);
    setProfileDraft({ username: authUser.username, phone: authUser.phone || "", email: authUser.email || "", profileImage: authUser.profileImage });
    setProfileError("");
    setProfileSuccess("");
    setProfileEditing(true);
  };

  const cancelProfileEdit = () => {
    profilePhotoReadVersionRef.current += 1;
    setProfilePhotoChanged(false);
    setProfilePhotoReading(false);
    setProfileDraft({ username: authUser.username, phone: authUser.phone || "", email: authUser.email || "", profileImage: authUser.profileImage });
    setProfileError("");
    setProfileSuccess("");
    setProfileEditing(false);
  };

  const saveProfile = async () => {
    if (profileSaving || profileSaveInFlightRef.current || profilePhotoReading) return;
    const normalizedName = normalizeProfileName(profileDraft.username);
    const normalizedPhone = profileDraft.phone.trim();
    const phoneDigits = normalizedPhone.replace(/\D/g, "");

    if (!normalizedName.valid) {
      setProfileError(normalizedName.message);
      return;
    }
    if (normalizedPhone && (!/^\+?[\d\s()-]{10,18}$/.test(normalizedPhone) || phoneDigits.length < 10 || phoneDigits.length > 15)) {
      setProfileError("Enter a valid phone number.");
      return;
    }
    setProfileError("");
    setProfileSuccess("");
    profileSaveInFlightRef.current = true;
    setProfileSaving(true);
    try {
      const savedProfile = await saveCustomerProfile({
        name: normalizedName.value,
        phone: normalizedPhone,
        ...(profilePhotoChanged ? { photo: profileDraft.profileImage ?? null } : {}),
      });
      const nextUser: AuthUser = {
        username: savedProfile.name,
        phone: savedProfile.phone,
        email: savedProfile.email,
        profileImage: savedProfile.photo,
        isAuthenticated: true,
      };
      persistUser(nextUser);
      setProfileDraft({
        username: savedProfile.name,
        phone: savedProfile.phone,
        email: savedProfile.email,
        profileImage: savedProfile.photo,
      });
      setProfileLoadError("");
      setProfilePhotoChanged(false);
      setProfileSuccess("Profile updated successfully.");
      setProfileEditing(false);
      window.setTimeout(() => setProfileSuccess(""), 3000);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to save your profile.");
    } finally {
      profileSaveInFlightRef.current = false;
      setProfileSaving(false);
    }
  };

  const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const requestVersion = ++profilePhotoReadVersionRef.current;
    setProfileError("");
    setProfilePhotoReading(true);
    void readProfilePhotoFile(file)
      .then((photo) => {
        if (requestVersion !== profilePhotoReadVersionRef.current) return;
        setProfileDraft((current) => ({ ...current, profileImage: photo }));
        setProfilePhotoChanged(true);
      })
      .catch((error: unknown) => {
        if (requestVersion === profilePhotoReadVersionRef.current) {
          setProfileError(error instanceof Error ? error.message : "The selected image could not be read.");
        }
      })
      .finally(() => {
        if (requestVersion === profilePhotoReadVersionRef.current) setProfilePhotoReading(false);
      });
    event.target.value = "";
  };

  const removeProfileImage = () => {
    profilePhotoReadVersionRef.current += 1;
    setProfilePhotoReading(false);
    setProfileError("");
    setProfileDraft((current) => ({ ...current, profileImage: undefined }));
    setProfilePhotoChanged(true);
  };

  const openProfileImagePicker = () => {
    if (!profileEditing) beginProfileEdit();
    profileImageInputRef.current?.click();
  };

  const handleEmailSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    setLoginSuccess("");

    const email = loginEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginError("Enter a valid email address.");
      return;
    }
    if (!loginPassword) {
      setLoginError("Enter your password.");
      return;
    }

    setIsSigningIn(true);
    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: loginPassword }),
      });
      const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;
      if (!isJson) {
        setLoginError("Email/password authentication is not configured: POST /api/auth/login is unavailable.");
        return;
      }

      const data: unknown = await response.json();
      if (!response.ok) {
        const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "Sign-in failed. Please try again.";
        setLoginError(message);
        return;
      }

      if (!isCustomerLoginResponse(data)) {
        setLoginError("The sign-in service returned an invalid response. Authentication was not completed.");
        return;
      }

      const signedInUser = data.user;
      const nextUser: AuthUser = {
        username: signedInUser.username,
        email: signedInUser.email ?? email,
        phone: signedInUser.mobile,
        isAuthenticated: true,
      };
      persistUser(nextUser);
      setLoginSuccess("Signed in successfully.");
      setLoginStep("profile");
      setAccountSection("main");
      setLoginPassword("");
    } catch {
      setLoginError("Unable to reach the sign-in service. Email/password authentication may not be configured.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoginError("");
    setLoginSuccess("");
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setLoginError("Google sign-in is not configured: VITE_GOOGLE_CLIENT_ID is missing.");
      return;
    }
    const flow = loginStep === "signup" ? "signup" : "signin";
    setIsSigningIn(true);
    try {
      if (!getGoogleIdentityAPI()) {
        if (!googleScriptPromiseRef.current) {
          googleScriptPromiseRef.current = new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Unable to load Google Identity Services"));
            document.head.appendChild(script);
          });
        }
        await googleScriptPromiseRef.current;
      }
      const googleIdentity = getGoogleIdentityAPI();
      if (!googleIdentity) throw new Error("Google Identity Services did not initialize");
      googleIdentity.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          if (!credential) {
            setLoginError("Google sign-in did not return a credential.");
            setIsSigningIn(false);
            return;
          }
          try {
            const response = await apiFetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential, flow }),
            });
            const data: unknown = await response.json();
            if (!response.ok) {
              const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
                ? data.error
                : "Google sign-in failed.";
              setLoginError(message);
              return;
            }
            if (isCustomerLoginResponse(data)) {
              persistUser({
                username: data.user.username,
                email: data.user.email,
                phone: data.user.mobile,
                isAuthenticated: true,
              });
              setLoginSuccess("Signed in successfully.");
              setLoginStep("profile");
              setAccountSection("main");
              return;
            }
            if (typeof data === "object" && data !== null && "requiresProfile" in data && data.requiresProfile === true
              && "pendingToken" in data && typeof data.pendingToken === "string"
              && "email" in data && typeof data.email === "string"
              && "name" in data && typeof data.name === "string"
              && "missingFields" in data && Array.isArray(data.missingFields)
              && data.missingFields.every((field) => field === "name" || field === "mobile")) {
              setPendingGoogleToken(data.pendingToken);
              setLoginEmail(data.email);
              setSignupName(data.name);
              setGoogleProfileMissingFields(data.missingFields);
              setLoginStep("google-profile");
              setLoginSuccess("");
              return;
            }
            setLoginError("Google sign-in returned an invalid response.");
          } catch {
            setLoginError("Unable to reach the Google sign-in service.");
          } finally {
            setIsSigningIn(false);
          }
        },
      });
      googleIdentity.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setLoginError("Google sign-in was closed before completion. Try again.");
          setIsSigningIn(false);
        }
      });
    } catch {
      setLoginError("Google sign-in could not start. Check the Google client ID and allowed website origins.");
      setIsSigningIn(false);
    }
  };

  const openForgotPassword = () => {
    setLoginStep("forgot");
    setLoginError("");
    setLoginSuccess("");
    setRecoveryOtp("");
    setRecoveryResendSeconds(0);
    setRecoveryNewPassword("");
    setRecoveryPasswordConfirmation("");
  };

  const switchToSignup = () => {
    setLoginStep("signup");
    setLoginError("");
    setLoginSuccess("");
  };

  const switchToLogin = () => {
    setLoginStep("login");
    setLoginError("");
    setLoginSuccess("");
  };

  const handleForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    setLoginSuccess("");
    const email = loginEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginError("Enter a valid email address.");
      return;
    }
    setIsSigningIn(true);
    try {
      const response = await apiFetch("/api/auth/request-password-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        setLoginError(typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "Password recovery failed.");
        return;
      }
      setRecoveryOtp("");
      setRecoveryResendSeconds(60);
      setLoginSuccess("");
      setLoginStep("verify-otp");
    } catch {
      setLoginError("Unable to reach the password recovery service.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleVerifyRecoveryOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    setLoginSuccess("");
    if (!/^\d{6}$/.test(recoveryOtp)) {
      setLoginError("Enter the 6-digit code sent to your email.");
      return;
    }
    setIsSigningIn(true);
    try {
      const response = await apiFetch("/api/auth/verify-password-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), otp: recoveryOtp }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        setLoginError(typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "OTP verification failed.");
        return;
      }
      if (typeof data !== "object" || data === null || !("verified" in data) || data.verified !== true) {
        setLoginError("The OTP verification service returned an invalid response.");
        return;
      }
      setRecoveryOtp("");
      setRecoveryNewPassword("");
      setRecoveryPasswordConfirmation("");
      setLoginStep("new-password");
    } catch {
      setLoginError("Unable to reach the OTP verification service.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const resendRecoveryOtp = async () => {
    if (recoveryResendSeconds > 0 || isSigningIn) return;
    setLoginError("");
    setLoginSuccess("");
    setIsSigningIn(true);
    try {
      const response = await apiFetch("/api/auth/resend-password-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim() }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        if (typeof data === "object" && data !== null && "resendAfterSeconds" in data && typeof data.resendAfterSeconds === "number") {
          setRecoveryResendSeconds(data.resendAfterSeconds);
        }
        setLoginError(typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "Unable to resend the OTP.");
        return;
      }
      setRecoveryOtp("");
      setRecoveryResendSeconds(60);
    } catch {
      setLoginError("Unable to reach the OTP email service.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleRecoveryPasswordReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    setLoginSuccess("");
    if (new TextEncoder().encode(recoveryNewPassword).length < 8 || new TextEncoder().encode(recoveryNewPassword).length > 72) {
      setLoginError("Password must be between 8 and 72 bytes.");
      return;
    }
    if (recoveryNewPassword !== recoveryPasswordConfirmation) {
      setLoginError("The passwords do not match.");
      return;
    }
    setIsSigningIn(true);
    try {
      const response = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: recoveryNewPassword }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        setLoginError(typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "Unable to reset your password.");
        return;
      }
      setLoginSuccess("Password updated. Sign in with your new password.");
      setRecoveryNewPassword("");
      setRecoveryPasswordConfirmation("");
      if (resetRedirectTimerRef.current !== undefined) window.clearTimeout(resetRedirectTimerRef.current);
      resetRedirectTimerRef.current = window.setTimeout(() => {
        setLoginStep("login");
        setLoginError("");
        setLoginPassword("");
        resetRedirectTimerRef.current = undefined;
      }, 1600);
    } catch {
      setLoginError("Unable to reach the password reset service.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    if (!pendingGoogleToken) {
      setLoginError("Google profile session expired. Start Google sign-in again.");
      return;
    }
    setIsSigningIn(true);
    try {
      const response = await apiFetch("/api/auth/google/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingToken: pendingGoogleToken,
          ...(googleProfileMissingFields.includes("name") ? { name: signupName.trim() } : {}),
          ...(googleProfileMissingFields.includes("mobile") ? { mobile: signupMobile.trim() } : {}),
        }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        setLoginError(typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "Unable to complete your Google profile.");
        return;
      }
      if (!isCustomerLoginResponse(data)) {
        setLoginError("Google profile completion returned an invalid response.");
        return;
      }
      persistUser({
        username: data.user.username,
        email: data.user.email,
        phone: data.user.mobile,
        isAuthenticated: true,
      });
      setPendingGoogleToken("");
      setGoogleProfileMissingFields([]);
      setLoginStep("profile");
      setAccountSection("main");
      setLoginSuccess("Signed in successfully.");
    } catch {
      setLoginError("Unable to reach the account service.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    setLoginSuccess("");
    const name = signupName.trim();
    const email = loginEmail.trim();
    const mobile = signupMobile.trim();
    if (!name) {
      setLoginError("Enter your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginError("Enter a valid email address.");
      return;
    }
    if (loginPassword.length < 8) {
      setLoginError("Password must be at least 8 characters.");
      return;
    }
    if (!/^\+?[\d\s()-]{10,18}$/.test(mobile) || mobile.replace(/\D/g, "").length < 10 || mobile.replace(/\D/g, "").length > 15) {
      setLoginError("Enter a valid mobile number.");
      return;
    }

    setIsSigningIn(true);
    try {
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password: loginPassword, mobile }),
      });
      const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;
      if (response.status === 404 || !isJson) {
        setLoginError("Account registration is not configured: POST /api/auth/register is unavailable.");
        return;
      }

      const data: unknown = await response.json();
      if (response.status === 409) {
        setLoginError("An account with this email already exists. Sign in instead.");
        return;
      }
      if (!response.ok) {
        const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "Account registration failed. Please try again.";
        setLoginError(message);
        return;
      }

      if (isCustomerLoginResponse(data)) {
        persistUser({ username: data.user.username, email: data.user.email ?? email, phone: data.user.mobile ?? mobile, isAuthenticated: true });
        setLoginStep("profile");
        setAccountSection("main");
        setLoginPassword("");
        setLoginSuccess("Account created successfully.");
        return;
      }
      setLoginError("The registration service returned an invalid response. Account creation was not confirmed.");
    } catch {
      setLoginError("Unable to reach the registration service. Account registration may not be configured.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setProfileError("");
    try {
      const response = await apiFetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setProfileError("Unable to sign out right now. Please try again.");
        return;
      }
      persistUser({ username: "", isAuthenticated: false });
      restoreGuestWishlist();
      setLoginStep("login");
      setAccountSection("main");
      setOverlay("account");
      setLoginEmail("");
      setLoginPassword("");
      setLoginError("");
      setLoginSuccess("");
    } catch {
      setProfileError("Unable to reach the sign-out service. You are still signed in.");
    }
  };

  const cancelAddressEdit = () => {
    setAddressEditId(null);
    setAddressForm(createEmptyCustomerAddressFields());
    addressRequestIdRef.current = null;
    window.sessionStorage.removeItem("tribull-address-request-id");
    setAddressError("");
    setAddressSuccess("");
  };

  const reloadAddresses = async () => {
    const requestVersion = ++addressFetchVersionRef.current;
    setAddressesLoading(true);
    setAddressError("");
    try {
      const data = await fetchCustomerAddresses();
      if (requestVersion === addressFetchVersionRef.current) setAddresses(data);
      return data;
    } finally {
      if (requestVersion === addressFetchVersionRef.current) setAddressesLoading(false);
    }
  };

  const submitAddress = async () => {
    if (addressSaving || addressOperationInFlightRef.current) return;
    setAddressError("");
    setAddressSuccess("");
    const validation = validateCustomerAddress(addressForm);
    setAddressForm(validation.value);
    if (validation.error) {
      setAddressError(validation.error);
      return;
    }
    const normalizedAddress = validation.value;

    addressOperationInFlightRef.current = true;
    addressFetchVersionRef.current += 1;
    setAddressesLoading(false);
    setAddressSaving(true);
    try {
      const editing = addressEditId ? addresses.find((entry) => entry.id === addressEditId) : undefined;
      if (addressEditId && !editing) throw new Error("This address is no longer available. Reload your addresses and try again.");
      addressRequestIdRef.current ||= window.sessionStorage.getItem("tribull-address-request-id")
        || (window.crypto?.randomUUID ? window.crypto.randomUUID() : `address-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      window.sessionStorage.setItem("tribull-address-request-id", addressRequestIdRef.current);
      const { addresses: refreshedAddresses } = await saveCustomerAddress(
        normalizedAddress,
        addressEditId,
        addressRequestIdRef.current,
        editing?.isDefault || false,
      );
      setAddresses(refreshedAddresses);
      const wasEditing = Boolean(addressEditId);
      cancelAddressEdit();
      setAddressSuccess(wasEditing ? "Address changes saved." : "Address saved to your account.");
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "Unable to save this address.");
    } finally {
      addressOperationInFlightRef.current = false;
      setAddressSaving(false);
    }
  };

  const deleteAddress = async (id: string) => {
    if (addressSaving || addressOperationInFlightRef.current) return;
    if (!window.confirm("Delete this saved address? This cannot be undone.")) return;
    setAddressError("");
    setAddressSuccess("");
    addressOperationInFlightRef.current = true;
    setAddressSaving(true);
    try {
      const refreshedAddresses = await deleteSavedCustomerAddress(id, () => {
        addressFetchVersionRef.current += 1;
        setAddressesLoading(false);
        setAddresses((current) => current.filter((entry) => entry.id !== id));
      });
      setAddresses(refreshedAddresses);
      if (addressEditId === id) cancelAddressEdit();
      setAddressSuccess("Address deleted.");
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "Unable to delete this address.");
    } finally {
      addressOperationInFlightRef.current = false;
      setAddressSaving(false);
    }
  };

  const setDefaultAddress = async (id: string) => {
    if (addressSaving || addressOperationInFlightRef.current) return;
    const selected = addresses.find((entry) => entry.id === id);
    if (!selected) return;
    setAddressError("");
    addressOperationInFlightRef.current = true;
    setAddressSaving(true);
    try {
      const response = await apiFetch(`/api/customer/addresses/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...selected, isDefault: true }),
      });
      const data = await response.json().catch(() => undefined) as AddressEntry | { error?: string } | undefined;
      if (!response.ok || !data || !("id" in data) || typeof data.id !== "string" || !data.id.trim()) throw new Error(data && "error" in data && data.error ? data.error : "Unable to update the default address.");
      const refreshedAddresses = await reloadAddresses();
      setAddresses(refreshedAddresses);
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "Unable to update the default address.");
    } finally {
      addressOperationInFlightRef.current = false;
      setAddressSaving(false);
    }
  };

  const updateCart = (productId: string, quantity: number, item?: CartItem) => {
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
  };

  const toggleWishlist = (productId: string) => {
    void toggleWishlistItem(productId, !wishlist.includes(productId)).catch(() => undefined);
  };

  const addSearchProductToCart = (product: Product) => updateCart(product.id, (cart[product.id] || 0) + 1, product);
  const submitSearch = (searchTerm = query) => {
    const normalizedQuery = searchTerm.trim();
    if (!normalizedQuery) return;
    closeOverlay();
    setLocation(`/search?q=${encodeURIComponent(normalizedQuery)}`);
  };

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

      {overlay && <button className={`header-overlay${isLoginPanelOpen ? " header-overlay--login" : ""}${loginClosing ? " is-closing" : ""}`} type="button" aria-label="Close panel" onClick={closeOverlay} />}
      {overlay === "search" && (
        <section className="header-panel header-side-panel header-search-panel" role="dialog" aria-modal="true" aria-labelledby="header-search-title">
          <div className="header-panel__heading"><h2 id="header-search-title">Search</h2><button type="button" aria-label="Close search" onClick={closeOverlay}><X size={20} /></button></div>
          <form className="header-search-form" onSubmit={(event) => { event.preventDefault(); submitSearch(); }}>
            <label className="header-search-field"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or categories" aria-label="Search products or categories" /></label>
            <button className="header-search-submit" type="submit" aria-label="View search results"><ArrowRight size={19} /></button>
          </form>
          <div className="header-search-popular" aria-label="Popular searches">
            <span>Popular searches</span>
            <div>{["Oversized", "Hoodie"].map((term) => <button type="button" key={term} onClick={() => setQuery(term)}>{term}</button>)}</div>
          </div>
          <div className="header-search-results" aria-live="polite">
            <h3>{query.trim() ? `Products (${searchResults.length})` : "Popular products"}</h3>
            {searchResults.length ? searchResults.slice(0, 5).map((product) => (
              <div className="header-search-result" key={product.id}>
                <button className="header-search-result__product" type="button" onClick={() => { closeOverlay(); setLocation(`/product/${encodeURIComponent(product.id)}`); }}>
                  <img src={product.image} alt="" />
                  <span><strong>{product.name}</strong><small>{product.category}</small><b>{formatPrice(product.price)}</b></span>
                </button>
                <button className="header-search-result__add" type="button" onClick={() => addSearchProductToCart(product)} aria-label={`Add ${product.name} to cart`}><Plus size={16} /></button>
              </div>
            )) : <p className="header-empty-state">No products found. Try another name or category.</p>}
            {query.trim() && searchResults.length > 0 && <button className="header-search-all" type="button" onClick={() => submitSearch()}>View all {searchResults.length} results <ArrowRight size={15} /></button>}
          </div>
        </section>
      )}
      {overlay === "account" && (
        <section className={`header-account-drawer ${loginStep !== "profile" || !authUser.isAuthenticated ? "header-login-drawer" : ""}${loginClosing ? " is-closing" : ""}`} role="dialog" aria-modal="true" aria-label="Account panel">
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
                  {loginSuccess && <p className="header-form-success" role="status">{loginSuccess}</p>}

                  <nav className="header-account-drawer__nav" aria-label="Account navigation">
                    <button type="button" onClick={() => setAccountSection("profile")}>My Profile</button>
                    <button type="button" onClick={() => { setOrders([]); setOrdersTotal(0); setOrdersPage(1); setAccountSection("orders"); }}>My Orders</button>
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
                    {profileLoadError && <p className="header-form-error" role="alert">{profileLoadError}</p>}
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
                        <button type="button" className="header-profile-photo-action header-profile-photo-action--remove" onClick={removeProfileImage} disabled={profilePhotoReading}>Remove photo</button>
                      </>}
                      {profilePhotoReading && <p role="status">Preparing profile photo…</p>}
                    </div>
                    {profileEditing ? (
                      <div className="header-account-profile-form">
                        <label className="checkout-field">
                          <span>Name</span>
                          <input value={profileDraft.username} onChange={(event) => setProfileDraft((current) => ({ ...current, username: event.target.value }))} autoComplete="username" />
                        </label>
                        <label className="checkout-field">
                          <span>Phone</span>
                          <input value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} type="tel" autoComplete="tel" />
                        </label>
                        <label className="checkout-field">
                          <span>Email</span>
                          <input value={authUser.email || profileDraft.email} type="email" autoComplete="email" readOnly />
                        </label>
                        {profileError && <p className="header-form-error" role="alert">{profileError}</p>}
                        <div className="header-account-profile-actions">
                          <button type="button" className="header-account-drawer__cta" onClick={() => void saveProfile()} disabled={profileSaving || profilePhotoReading}>{profileSaving ? "Saving…" : "Save Changes"}</button>
                          <button type="button" className="header-profile-cancel" onClick={cancelProfileEdit} disabled={profileSaving}>Cancel</button>
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
                    {ordersError && <p className="header-form-error" role="alert">{ordersError}</p>}
                    {ordersLoading && <p role="status">Loading your orders…</p>}
                    {orders.length ? orders.map((order) => {
                      const statusDisplay = getOrderStatusDisplay(order.status);
                      const progressStatus = statusDisplay.progressStatus;
                      const currentStep = progressStatus ? orderProgressLabels.indexOf(progressStatus) : -1;
                      return (
                        <div className="header-account-card" key={order.id}>
                          <div className="header-account-card__row header-account-card__row--split">
                            <div className="header-account-order-heading">
                              <strong>Order {order.id}</strong>
                              <span className={`header-account-order-status header-account-order-status--${statusDisplay.tone}`}>
                                {statusDisplay.label}
                              </span>
                            </div>
                            <span>Placed {new Date(order.createdAt).toLocaleDateString("en-IN")}</span>
                          </div>
                          {statusDisplay.tone === "cancelled" ? <p>This order was cancelled.</p> : progressStatus ? (
                            <ol aria-label="Order progress">
                              {orderProgressLabels.map((label, index) => (
                                <li key={label} aria-current={index === currentStep ? "step" : undefined}>{label}{index < currentStep ? " ✓" : ""}</li>
                              ))}
                            </ol>
                          ) : null}
                          {order.statusUpdatedAt && <p>Status updated: {new Date(order.statusUpdatedAt).toLocaleString("en-IN")}</p>}
                          <div className="header-account-card__body">
                            {order.items.map((item, index) => (
                              <div key={`${order.id}-${index}`} className="header-account-card__item">
                                {item.image && <img src={item.image} alt="" />}
                                <span>{item.name}{item.variant ? ` · ${item.variant}` : ""}<small>Qty: {item.quantity} · {formatPrice(item.lineTotal)}</small></span>
                              </div>
                            ))}
                          </div>
                          <div className="header-account-card__row header-account-card__row--split">
                            <span>Total: {formatPrice(order.total)}</span>
                            <strong>Payment: {order.payment.status}</strong>
                          </div>
                          <p>Payment method: {getCheckoutPaymentLabel(order.payment.method)}</p>
                          {order.shippingAddress.recipientName && <p>Recipient: {order.shippingAddress.recipientName}{order.shippingAddress.phone ? ` · ${order.shippingAddress.phone}` : ""}</p>}
                          <p>Delivering to: {order.shippingAddress.address}{order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ""}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pinCode}</p>
                          {order.tracking && (order.tracking.carrier || order.tracking.trackingNumber || order.tracking.trackingUrl || order.tracking.shippedAt || order.tracking.deliveredAt) && (
                            <div className="header-account-order-tracking">
                              <strong>Tracking</strong>
                              {order.tracking.carrier && <span>Carrier: {order.tracking.carrier}</span>}
                              {order.tracking.trackingNumber && <span>Tracking number: {order.tracking.trackingNumber}</span>}
                              {order.tracking.trackingUrl && <a href={order.tracking.trackingUrl} target="_blank" rel="noreferrer">Track shipment</a>}
                              {order.tracking.shippedAt && <span>Shipped: {new Date(order.tracking.shippedAt).toLocaleString("en-IN")}</span>}
                              {order.tracking.deliveredAt && <span>Delivered: {new Date(order.tracking.deliveredAt).toLocaleString("en-IN")}</span>}
                            </div>
                          )}
                        </div>
                      );
                    }) : !ordersLoading && !ordersError ? (
                      <div className="header-account-empty">
                        <p>No Orders Yet</p>
                        <span>Your orders will appear here after you place an order.</span>
                        <button type="button" className="header-account-drawer__cta" onClick={closeOverlay}>Start Shopping</button>
                      </div>
                    ) : null}
                    {orders.length < ordersTotal && <button type="button" className="header-profile-cancel" disabled={ordersLoading} onClick={() => { setOrdersPage((page) => page + 1); }}>{ordersLoading ? "Loading…" : "Load more orders"}</button>}
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
                          <div className="header-account-card--wishlist__details">
                            <strong>{product.name}</strong>
                            <div className="header-account-card--wishlist__price">
                              <span>{formatPrice(product.price)}</span>
                              {product.originalPrice && product.originalPrice > product.price && <del>{formatPrice(product.originalPrice)}</del>}
                            </div>
                          </div>
                          <div className="header-account-card__actions header-account-card--wishlist__actions">
                            <button type="button" onClick={() => toggleWishlist(product.id)}>Remove</button>
                            <button type="button" onClick={() => { updateCart(product.id, (cart[product.id] || 0) + 1, product); }}>Add to Cart</button>
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
                    {addressesLoading && <p role="status">Loading saved addresses…</p>}
                    {addressError && <p className="header-form-error" role="alert">{addressError}</p>}
                    {addressSuccess && <p className="header-form-success" role="status">{addressSuccess}</p>}
                    <div className="header-account-addresses">
                      {addresses.length ? addresses.map((entry) => (
                        <div key={entry.id} className={`header-account-card ${entry.isDefault ? "is-default" : ""}`}>
                          <div className="header-account-card__row header-account-card__row--split">
                            <strong>{entry.fullName}</strong>
                            {entry.isDefault && <span>Default</span>}
                          </div>
                          <p>{entry.address}{entry.apartment ? `, ${entry.apartment}` : ""}</p>
                          <p>{entry.city}, {entry.state} - {entry.pinCode}</p>
                          <p>{entry.phone}</p>
                          <div className="header-account-card__actions header-account-card__actions--stack">
                            <button type="button" disabled={addressSaving} onClick={() => { setAddressError(""); setAddressSuccess(""); addressRequestIdRef.current = null; window.sessionStorage.removeItem("tribull-address-request-id"); setAddressEditId(entry.id); setAddressForm({ fullName: entry.fullName, phone: entry.phone, address: entry.address, apartment: entry.apartment || "", city: entry.city, state: entry.state, pinCode: entry.pinCode }); }}>Edit</button>
                            {!entry.isDefault && <button type="button" disabled={addressSaving} onClick={() => void setDefaultAddress(entry.id)}>Set Default</button>}
                            <button type="button" disabled={addressSaving} onClick={() => void deleteAddress(entry.id)}>{addressSaving ? "Please wait…" : "Delete"}</button>
                          </div>
                        </div>
                      )) : !addressesLoading && !addressError && <div className="header-account-empty"><p>No Addresses Saved</p></div>}
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
                      <label className="checkout-field">
                        <span>Apartment / Building (optional)</span>
                        <input value={addressForm.apartment} onChange={(event) => setAddressForm((current) => ({ ...current, apartment: event.target.value }))} />
                      </label>
                      <div className="checkout-grid checkout-grid--three">
                        <label className="checkout-field">
                          <span>City</span>
                          <input value={addressForm.city} onChange={(event) => setAddressForm((current) => ({ ...current, city: event.target.value }))} />
                        </label>
                        <label className="checkout-field">
                          <span>State</span>
                          <select required value={normalizeIndianState(addressForm.state)} onChange={(event) => setAddressForm((current) => ({ ...current, state: event.target.value }))}>
                            <option value="">Select state or union territory</option>
                            {indianStatesAndTerritories.map((state) => <option key={state} value={state}>{state}</option>)}
                          </select>
                        </label>
                        <label className="checkout-field">
                          <span>PIN Code</span>
                          <input value={addressForm.pinCode} onChange={(event) => setAddressForm((current) => ({ ...current, pinCode: event.target.value }))} />
                        </label>
                      </div>
                      <button type="button" className="header-account-drawer__cta" disabled={addressSaving} onClick={() => void submitAddress()}>{addressSaving ? "Saving…" : addressEditId ? "Save Changes" : "Add Address"}</button>
                      {addressEditId && <button type="button" className="header-profile-cancel" onClick={cancelAddressEdit} disabled={addressSaving}>Cancel</button>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="header-login-content">
              <button className="header-account-modal__close" type="button" aria-label="Close login" onClick={closeOverlay}><X size={20} /></button>
              <img className="header-login-logo" src="/products/logo.png" alt="TRIBULL" />
              <p className="eyebrow">{loginStep === "signup" ? "Join the Tribe" : loginStep === "forgot" || loginStep === "verify-otp" || loginStep === "new-password" ? "Account Recovery" : loginStep === "google-profile" ? "One Last Step" : "Welcome Back"}</p>
              <h2>{loginStep === "signup" ? "Sign Up" : loginStep === "forgot" ? "Account Recovery" : loginStep === "verify-otp" ? "Verify Your Email" : loginStep === "new-password" ? "New Password" : loginStep === "google-profile" ? "Complete Profile" : "Login"}</h2>
              <span className="header-login-heading-rule" aria-hidden="true" />
              {loginStep === "verify-otp" && <p className="login-recovery-instruction">Enter the 6-digit code sent to your email.<span>{loginEmail}</span></p>}
              {loginStep === "new-password" && <p className="login-recovery-instruction">Choose a new password for your Tribull account.</p>}
              {loginError && <p className="header-form-error header-login-status" role="alert">{loginError}</p>}
              {loginSuccess && <p className="header-form-success header-login-status" role="status">{loginSuccess}</p>}
              <form onSubmit={loginStep === "signup" ? handleSignUp : loginStep === "forgot" ? handleForgotPassword : loginStep === "verify-otp" ? handleVerifyRecoveryOtp : loginStep === "new-password" ? handleRecoveryPasswordReset : loginStep === "google-profile" ? handleGoogleProfile : handleEmailSignIn}>
                {(loginStep === "signup" || loginStep === "google-profile" && googleProfileMissingFields.includes("name")) && <label>Name
                  <span className="header-login-input">
                    <User size={22} aria-hidden="true" />
                    <input type="text" autoComplete="name" autoFocus value={signupName} onChange={(event) => { setSignupName(event.target.value); setLoginError(""); }} placeholder="Enter your name" required />
                  </span>
                </label>}
                {(loginStep === "login" || loginStep === "signup" || loginStep === "forgot") && <label>Email
                  <span className="header-login-input">
                    <Mail size={22} aria-hidden="true" />
                    <input type="email" autoComplete="email" autoFocus={loginStep === "login" || loginStep === "forgot"} value={loginEmail} onChange={(event) => { setLoginEmail(event.target.value); setLoginError(""); }} placeholder="Enter your email address" required />
                  </span>
                </label>}
                {loginStep === "google-profile" && <p className="google-profile-email"><Mail size={18} aria-hidden="true" />{loginEmail}</p>}
                {(loginStep === "signup" || loginStep === "google-profile" && googleProfileMissingFields.includes("mobile")) && <label>{loginStep === "signup" ? "Mobile" : "Mobile number"}
                  <span className="header-login-input">
                    <Phone size={22} aria-hidden="true" />
                    <input type="tel" autoComplete="tel" inputMode="tel" value={signupMobile} onChange={(event) => { setSignupMobile(event.target.value); setLoginError(""); }} placeholder="Enter your mobile number" required />
                  </span>
                </label>}
                {(loginStep === "login" || loginStep === "signup") && <label>Password
                  <span className="header-password-field">
                    <LockKeyhole size={22} aria-hidden="true" />
                    <input type={showLoginPassword ? "text" : "password"} autoComplete={loginStep === "signup" ? "new-password" : "current-password"} value={loginPassword} onChange={(event) => { setLoginPassword(event.target.value); setLoginError(""); }} placeholder="Enter your password" minLength={loginStep === "signup" ? 8 : undefined} required />
                    <button type="button" aria-label={showLoginPassword ? "Hide password" : "Show password"} aria-pressed={showLoginPassword} onClick={() => setShowLoginPassword((visible) => !visible)}>{showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}<span>{showLoginPassword ? "Hide" : "Show"}</span></button>
                  </span>
                </label>}
                {loginStep === "verify-otp" && <label htmlFor="recovery-otp-input">6-digit OTP
                  <span className="header-login-input recovery-otp-field">
                    <Mail size={22} aria-hidden="true" />
                    <input
                      id="recovery-otp-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={recoveryOtp}
                      onChange={(event) => { setRecoveryOtp(event.target.value.replace(/\D/g, "").slice(0, 6)); setLoginError(""); }}
                      placeholder="Enter your 6-digit code"
                      required
                    />
                  </span>
                </label>}
                {loginStep === "new-password" && <>
                  <label>New Password
                    <span className="header-password-field">
                      <LockKeyhole size={22} aria-hidden="true" />
                      <input type={showRecoveryPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={72} value={recoveryNewPassword} onChange={(event) => { setRecoveryNewPassword(event.target.value); setLoginError(""); }} placeholder="Enter a new password" required />
                      <button type="button" aria-label={showRecoveryPassword ? "Hide new password" : "Show new password"} aria-pressed={showRecoveryPassword} onClick={() => setShowRecoveryPassword((visible) => !visible)}>{showRecoveryPassword ? <EyeOff size={20} /> : <Eye size={20} />}<span>{showRecoveryPassword ? "Hide" : "Show"}</span></button>
                    </span>
                  </label>
                  <label>Confirm New Password
                    <span className="header-password-field">
                      <LockKeyhole size={22} aria-hidden="true" />
                      <input type={showRecoveryPasswordConfirmation ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={72} value={recoveryPasswordConfirmation} onChange={(event) => { setRecoveryPasswordConfirmation(event.target.value); setLoginError(""); }} placeholder="Confirm your new password" required />
                      <button type="button" aria-label={showRecoveryPasswordConfirmation ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showRecoveryPasswordConfirmation} onClick={() => setShowRecoveryPasswordConfirmation((visible) => !visible)}>{showRecoveryPasswordConfirmation ? <EyeOff size={20} /> : <Eye size={20} />}<span>{showRecoveryPasswordConfirmation ? "Hide" : "Show"}</span></button>
                    </span>
                  </label>
                </>}
                {loginStep === "login" && <button className="forgot-password" type="button" onClick={openForgotPassword}>Forgot Password?</button>}
                <button className="header-account-modal__submit" type="submit" disabled={isSigningIn}>{isSigningIn ? (loginStep === "signup" ? "Creating Account..." : loginStep === "forgot" ? "Sending OTP..." : loginStep === "verify-otp" ? "Verifying OTP..." : loginStep === "new-password" ? "Resetting Password..." : loginStep === "google-profile" ? "Saving Profile..." : "Signing In...") : <>{loginStep === "signup" ? "Create Account" : loginStep === "forgot" ? "Send OTP" : loginStep === "verify-otp" ? "Verify OTP" : loginStep === "new-password" ? "Reset Password" : loginStep === "google-profile" ? "Complete Sign Up" : "Sign In"} <ArrowRight size={22} /></>}</button>
              </form>
              {loginStep === "verify-otp" && <div className="recovery-step-actions">
                <button type="button" className="forgot-password" onClick={() => { setLoginStep("forgot"); setRecoveryOtp(""); setRecoveryResendSeconds(0); setLoginError(""); }}>Change email</button>
                <button type="button" className="recovery-resend" onClick={resendRecoveryOtp} disabled={isSigningIn || recoveryResendSeconds > 0}>
                  {recoveryResendSeconds > 0 ? `Resend OTP in ${recoveryResendSeconds}s` : isSigningIn ? "Sending..." : "Resend OTP"}
                </button>
              </div>}
              {(loginStep === "signup" || loginStep === "login") && <p className="header-signup-prompt">
                {loginStep === "signup" ? "Already have an account? " : "New to Tribull? "}
                <button type="button" onClick={loginStep === "signup" ? switchToLogin : switchToSignup}>{loginStep === "signup" ? "Sign In" : "Sign Up"}</button>
              </p>}
              {(loginStep === "forgot" || loginStep === "new-password" || loginStep === "google-profile") && <p className="header-signup-prompt"><button type="button" onClick={switchToLogin}>Back to Sign In</button></p>}
              {loginStep === "login" && <>
                <div className="header-login-divider"><span>OR</span></div>
                <button className="google-sign-in" type="button" onClick={handleGoogleSignIn}><GoogleLogo />Continue with Google</button>
              </>}
              {loginStep === "signup" && <>
                <div className="header-login-divider"><span>OR</span></div>
                <button className="google-sign-in" type="button" onClick={handleGoogleSignIn} disabled={isSigningIn}><GoogleLogo />Continue with Google</button>
              </>}
            </div>
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
          {cartEntries.length ? <><div className="header-cart-list">{cartEntries.map(([id, quantity]) => { const metadata = cartItems[id]; const product = products.find((item) => item.id === (metadata?.productId || id)); const item = product || metadata; if (!item) return null; const currentPrice = product?.price; const variant = metadata?.variant; return <div className="header-list-item header-cart-item" key={id}><img src={product?.image || item.image} alt={product?.name || item.name} /><div><strong>{product?.name || item.name}</strong>{variant && <span className="header-cart-variant">{variant}</span>}{typeof currentPrice === "number" ? <span>{formatPrice(currentPrice)} · <strong>{formatPrice(currentPrice * quantity)}</strong></span> : <span>Product unavailable</span>}<div className="header-quantity"><button type="button" onClick={() => updateCart(id, quantity - 1)} aria-label={`Decrease quantity of ${item.name}`}><Minus size={13} /></button><span>{quantity}</span><button type="button" onClick={() => updateCart(id, quantity + 1)} aria-label={`Increase quantity of ${item.name}`}><Plus size={13} /></button></div></div><button type="button" aria-label={`Remove ${item.name} from cart`} onClick={() => updateCart(id, 0)}><Trash2 size={15} /></button></div>; })}</div><div className="header-cart-total"><span>Total</span><strong>{formatPrice(cartTotal)}</strong></div><button className="header-checkout" type="button" onClick={() => { closeOverlay(); setLocation("/checkout"); }}>Checkout</button></> : <p className="header-empty-state">Your Cart is Empty</p>}
        </section>
      )}
    </>
  );
}
