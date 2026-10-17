import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useLocation } from "wouter";
import { useEffect, useLayoutEffect, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import SiteFooter from "./components/SiteFooter";
import { ThemeProvider } from "./contexts/ThemeContext";
import CategoryPage from "./pages/CategoryPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import Home from "./pages/Home";
import AllProductsPage from "./pages/AllProductsPage";
import AdminDashboard from "./pages/AdminDashboard";
import { apiFetch } from "./lib/api";
import "./pages/admin-login.css";
import CheckoutPage from "./pages/CheckoutPage";
import SearchResultsPage from "./pages/SearchResultsPage";


function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/admin26/category"}>{() => <LegacyCategoryRedirect />}</Route>
      <Route path={"/admin26"}>{() => <AdminRoute />}</Route>
      <Route path={"/admin26/dashboard"}>{() => <AdminRoute initialScreen="dashboard" />}</Route>
      <Route path={"/admin26/products"}>{() => <AdminRoute initialScreen="products" />}</Route>
      <Route path={"/admin26/products/add"}>{() => <AdminRoute initialScreen="add-product" />}</Route>
      <Route path={"/admin26/products/edit/:id"}>{(params) => <AdminRoute initialScreen="edit-product" productId={params.id} />}</Route>
      <Route path={"/admin26/products/categories"}>{() => <AdminRoute initialScreen="categories" />}</Route>
      <Route path={"/admin26/products/inventory"}>{() => <AdminRoute initialScreen="inventory" />}</Route>
      <Route path={"/admin26/products/banners"}>{() => <AdminRoute initialScreen="banners" />}</Route>
      <Route path={"/admin26/orders"}>{() => <AdminRoute initialScreen="orders" />}</Route>
      <Route path={"/admin26/orders/pending"}>{() => <AdminRoute initialScreen="orders-pending" />}</Route>
      <Route path={"/admin26/orders/processing"}>{() => <AdminRoute initialScreen="orders-processing" />}</Route>
      <Route path={"/admin26/orders/shipped"}>{() => <AdminRoute initialScreen="orders-shipped" />}</Route>
      <Route path={"/admin26/orders/delivered"}>{() => <AdminRoute initialScreen="orders-delivered" />}</Route>
      <Route path={"/admin26/orders/cancelled"}>{() => <AdminRoute initialScreen="orders-cancelled" />}</Route>
      <Route path={"/admin26/customers"}>{() => <AdminRoute initialScreen="customers" />}</Route>
      <Route path={"/admin26/customers/details"}>{() => <AdminRoute initialScreen="customer-details" />}</Route>
      <Route path={"/admin26/marketing/discounts"}>{() => <AdminRoute initialScreen="discounts" />}</Route>
      <Route path={"/admin26/marketing/coupons"}>{() => <AdminRoute initialScreen="coupons" />}</Route>
      <Route path={"/admin26/marketing/promotions"}>{() => <AdminRoute initialScreen="promotions" />}</Route>
      <Route path={"/admin26/content/banners"}>{() => <AdminRoute initialScreen="banners" />}</Route>
      <Route path={"/admin26/content/collections"}>{() => <AdminRoute initialScreen="collections" />}</Route>
      <Route path={"/admin26/content/featured-products"}>{() => <AdminRoute initialScreen="featured" />}</Route>
      <Route path={"/admin26/content/social-media"}>{() => <AdminRoute initialScreen="social-media" />}</Route>
      <Route path={"/admin26/analytics"}>{() => <AdminRoute initialScreen="analytics" />}</Route>
      <Route path={"/admin26/analytics/sales-reports"}>{() => <AdminRoute initialScreen="sales-reports" />}</Route>
      <Route path={"/admin26/analytics/product-reports"}>{() => <AdminRoute initialScreen="product-reports" />}</Route>
      <Route path={"/admin26/settings/general"}>{() => <AdminRoute initialScreen="general-settings" />}</Route>
      <Route path={"/admin26/settings/account"}>{() => <AdminRoute initialScreen="account-settings" />}</Route>
      <Route path={"/admin26/settings/admin-users"}>{() => <AdminRoute initialScreen="admin-users" />}</Route>
      <Route path={"/admin26/help"}>{() => <AdminRoute initialScreen="help-center" />}</Route>
      <Route path={"/products"} component={AllProductsPage} />
      <Route path={"/search"} component={SearchResultsPage} />
      <Route path={"/checkout"} component={CheckoutPage} />
      <Route path={"/product/:id"} component={ProductDetailPage} />
      <Route path={"/category/:slug/:lang"} component={CategoryPage} />
      <Route path={"/category/:slug"} component={CategoryPage} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminRoute({ initialScreen = "dashboard", productId }: { initialScreen?: string; productId?: string }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState("");
  useEffect(() => {
    let active = true;
    void apiFetch("/api/admin/auth/me", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json().catch(() => undefined) as { admin?: { status?: string }; error?: string } | undefined;
      if (!response.ok || !payload?.admin || payload.admin.status !== "Active") throw new Error(payload?.error || "Sign in with an authorized admin account.");
      if (active) setAuthenticated(true);
    }).catch((error: unknown) => {
      if (active) setSessionError(error instanceof Error ? error.message : "Unable to verify admin session.");
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  if (checking) return <main className="admin-login-shell"><p role="status">Checking admin session…</p></main>;
  if (!authenticated) return <AdminSignIn initialError={sessionError} />;
  return <AdminDashboard initialScreen={initialScreen} productId={productId} />;
}

function AdminSignIn({ initialError }: { initialError: string }) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter a valid email address."); return; }
    if (!password) { setError("Enter your password."); return; }
    setLoading(true);
    try {
      const response = await apiFetch("/api/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
      const payload = await response.json().catch(() => undefined) as { error?: string; admin?: { status?: string } } | undefined;
      if (!response.ok || payload?.admin?.status !== "Active") throw new Error(payload?.error || "Unable to sign in.");
      setLocation("/admin26/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in. Please try again.");
    } finally { setLoading(false); }
  };
  return <main className="admin-login-shell"><section className="admin-login-card" aria-labelledby="admin-login-title">
    <div className="admin-login-brand">T</div><p className="admin-login-eyebrow">Tribull administration</p><h1 id="admin-login-title">Sign in</h1><p className="admin-login-subtitle">Use your authorized admin account to continue.</p>
    {(initialError && initialError !== "Not signed in") && <p className="admin-login-notice" role="status">{initialError}</p>}
    <form onSubmit={submit} noValidate><label htmlFor="admin-email">Email</label><input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <label htmlFor="admin-password">Password</label><div className="admin-password-wrap"><input id="admin-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div>
      {error && <p className="admin-login-error" role="alert">{error}</p>}<button className="admin-login-submit" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign In"}</button>
    </form>
  </section></main>;
}

function LegacyCategoryRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => setLocation("/admin26/products/categories"), [setLocation]);
  return null;
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  const [location] = useLocation();

  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    if (!location.startsWith("/product/")) return;

    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);

    const frame = window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      root.style.scrollBehavior = previousScrollBehavior;
    });

    return () => {
      window.cancelAnimationFrame(frame);
      root.style.scrollBehavior = previousScrollBehavior;
    };
  }, [location]);

  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
            {!location.startsWith("/admin26") && <SiteFooter />}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
