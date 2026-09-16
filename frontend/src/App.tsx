import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import SiteFooter from "./components/SiteFooter";
import { ThemeProvider } from "./contexts/ThemeContext";
import CategoryPage from "./pages/CategoryPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import Home from "./pages/Home";
import AllProductsPage from "./pages/AllProductsPage";
import AdminDashboard from "./pages/AdminDashboard";
import CheckoutPage from "./pages/CheckoutPage";


function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/admin26/category"}>{() => <LegacyCategoryRedirect />}</Route>
      <Route path={"/admin26"}>{() => <AdminDashboard />}</Route>
      <Route path={"/admin26/dashboard"}>{() => <AdminDashboard initialScreen="dashboard" />}</Route>
      <Route path={"/admin26/products"}>{() => <AdminDashboard initialScreen="products" />}</Route>
      <Route path={"/admin26/products/add"}>{() => <AdminDashboard initialScreen="add-product" />}</Route>
      <Route path={"/admin26/products/categories"}>{() => <AdminDashboard initialScreen="categories" />}</Route>
      <Route path={"/admin26/products/inventory"}>{() => <AdminDashboard initialScreen="inventory" />}</Route>
      <Route path={"/admin26/orders"}>{() => <AdminDashboard initialScreen="orders" />}</Route>
      <Route path={"/admin26/orders/pending"}>{() => <AdminDashboard initialScreen="orders-pending" />}</Route>
      <Route path={"/admin26/orders/processing"}>{() => <AdminDashboard initialScreen="orders-processing" />}</Route>
      <Route path={"/admin26/orders/shipped"}>{() => <AdminDashboard initialScreen="orders-shipped" />}</Route>
      <Route path={"/admin26/orders/delivered"}>{() => <AdminDashboard initialScreen="orders-delivered" />}</Route>
      <Route path={"/admin26/orders/cancelled"}>{() => <AdminDashboard initialScreen="orders-cancelled" />}</Route>
      <Route path={"/admin26/customers"}>{() => <AdminDashboard initialScreen="customers" />}</Route>
      <Route path={"/admin26/customers/details"}>{() => <AdminDashboard initialScreen="customer-details" />}</Route>
      <Route path={"/admin26/marketing/discounts"}>{() => <AdminDashboard initialScreen="discounts" />}</Route>
      <Route path={"/admin26/marketing/coupons"}>{() => <AdminDashboard initialScreen="coupons" />}</Route>
      <Route path={"/admin26/marketing/promotions"}>{() => <AdminDashboard initialScreen="promotions" />}</Route>
      <Route path={"/admin26/content/banners"}>{() => <AdminDashboard initialScreen="banners" />}</Route>
      <Route path={"/admin26/content/collections"}>{() => <AdminDashboard initialScreen="collections" />}</Route>
      <Route path={"/admin26/content/featured-products"}>{() => <AdminDashboard initialScreen="featured" />}</Route>
      <Route path={"/admin26/content/social-media"}>{() => <AdminDashboard initialScreen="social-media" />}</Route>
      <Route path={"/admin26/analytics"}>{() => <AdminDashboard initialScreen="analytics" />}</Route>
      <Route path={"/admin26/analytics/sales-reports"}>{() => <AdminDashboard initialScreen="sales-reports" />}</Route>
      <Route path={"/admin26/analytics/product-reports"}>{() => <AdminDashboard initialScreen="product-reports" />}</Route>
      <Route path={"/admin26/settings/general"}>{() => <AdminDashboard initialScreen="general-settings" />}</Route>
      <Route path={"/admin26/settings/admin-users"}>{() => <AdminDashboard initialScreen="admin-users" />}</Route>
      <Route path={"/products"} component={AllProductsPage} />
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
