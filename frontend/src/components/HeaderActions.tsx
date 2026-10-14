import { ArrowRight, Camera, Eye, EyeOff, Heart, LockKeyhole, Mail, Phone, Search, ShoppingBag, User, X, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "../lib/api";
import { products, type Product } from "../pages/ProductsPage";
import { categoryProducts } from "../pages/CategoryPage";
import { animateAddToCart } from "../lib/cartAnimation";

type Cart = Record<string, number>;
type CartItem = { name: string; price: number; image: string; variant?: string };
type CartItems = Record<string, CartItem>;

type Overlay = "search" | "account" | "wishlist" | "cart" | null;
type LoginStep = "login" | "signup" | "forgot" | "verify-otp" | "new-password" | "google-profile" | "profile";
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

function normalizeUsername(value: string) {
  const normalized = value.trim();
  if (!normalized) return { valid: false, value: "", message: "Please enter a valid username." };
  if (!/^[a-zA-Z0-9_]+$/.test(normalized)) return { valid: false, value: "", message: "Please enter a valid username." };
  if (normalized.length < 3) return { valid: false, value: "", message: "Please enter a valid username." };
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
  const [authUser, setAuthUser] = useState<AuthUser>(() => ({
    ...readStorage<AuthUser>("tribull-user", { username: "", isAuthenticated: false }),
    isAuthenticated: false,
  }));
  const [accountSection, setAccountSection] = useState<AccountSection>("main");
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ username: authUser.username, phone: authUser.phone || "", email: authUser.email || "", profileImage: authUser.profileImage });
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);
  const [addressForm, setAddressForm] = useState({ fullName: "", phone: "", address: "", city: "", state: "", pinCode: "" });
  const [addressEditId, setAddressEditId] = useState<string | null>(null);
  const [loginStep, setLoginStep] = useState<LoginStep>("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupMobile, setSignupMobile] = useState("");
  const [pendingGoogleToken, setPendingGoogleToken] = useState("");
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
    apiFetch("/api/auth/me")
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          if (response.status === 401) {
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

  const persistUser = (nextUser: AuthUser) => {
    setAuthUser(nextUser);
    window.localStorage.setItem("tribull-user", JSON.stringify(nextUser));
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
              body: JSON.stringify({ credential }),
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
              && "name" in data && typeof data.name === "string") {
              setPendingGoogleToken(data.pendingToken);
              setLoginEmail(data.email);
              setSignupName(data.name);
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
        body: JSON.stringify({ pendingToken: pendingGoogleToken, name: signupName.trim(), mobile: signupMobile.trim() }),
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
      setLoginStep("profile");
      setAccountSection("main");
      setLoginSuccess("Account created successfully.");
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

      {overlay && <button className={`header-overlay${isLoginPanelOpen ? " header-overlay--login" : ""}${loginClosing ? " is-closing" : ""}`} type="button" aria-label="Close panel" onClick={closeOverlay} />}
      {overlay === "search" && (
        <section className="header-panel header-search-panel" aria-label="Search products">
          <div className="header-panel__heading"><h2>Search</h2><button type="button" aria-label="Close search" onClick={closeOverlay}><X size={20} /></button></div>
          <label className="header-search-field"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or categories" /></label>
          <div className="header-search-results">{searchResults.length ? searchResults.map((product) => <div className="header-search-result" key={product.id}><img src={product.image} alt="" /><div><strong>{product.name}</strong><span>{product.category} · {formatPrice(product.price)}</span></div><button type="button" onClick={(event) => addSearchProductToCart(product, event.currentTarget)} aria-label={`Add ${product.name} to cart`}><Plus size={16} /></button></div>) : <p className="header-empty-state">No products found.</p>}</div>
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
                {loginStep === "signup" && <label>Name
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
                {(loginStep === "signup" || loginStep === "google-profile") && <label>{loginStep === "signup" ? "Mobile" : "Mobile number"}
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
          {cartEntries.length ? <><div className="header-cart-list">{cartEntries.map(([id, quantity]) => { const product = products.find((item) => item.id === id); const item = cartItems[id] || product; if (!item) return null; return <div className="header-list-item header-cart-item" key={id}><img src={item.image} alt={item.name} /><div><strong>{item.name}</strong>{item.variant && <span className="header-cart-variant">{item.variant}</span>}<span>{formatPrice(item.price)} · <strong>{formatPrice(item.price * quantity)}</strong></span><div className="header-quantity"><button type="button" onClick={() => updateCart(id, quantity - 1)} aria-label={`Decrease quantity of ${item.name}`}><Minus size={13} /></button><span>{quantity}</span><button type="button" onClick={() => updateCart(id, quantity + 1)} aria-label={`Increase quantity of ${item.name}`}><Plus size={13} /></button></div></div><button type="button" aria-label={`Remove ${item.name} from cart`} onClick={() => updateCart(id, 0)}><Trash2 size={15} /></button></div>; })}</div><div className="header-cart-total"><span>Total</span><strong>{formatPrice(cartTotal)}</strong></div><button className="header-checkout" type="button" onClick={() => { closeOverlay(); setLocation("/checkout"); }}>Checkout</button></> : <p className="header-empty-state">Your Cart is Empty</p>}
        </section>
      )}
    </>
  );
}
