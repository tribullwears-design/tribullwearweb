import {
  Activity, AlertTriangle, Archive, BarChart3, Bell, Box, Boxes, ChevronDown, ChevronRight,
  ClipboardList, DollarSign, FileText, Gift, Globe2, Image, LayoutDashboard,
  LifeBuoy, Menu, MoreHorizontal, PackageCheck, PackageOpen, PanelLeftClose, PanelLeftOpen,
  Percent, Plus, Search, Settings, ShoppingBag, SlidersHorizontal, Store, Tag, Truck,
  UserRound, Users, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Product } from "../../../shared/products";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocation } from "wouter";
import { apiFetch } from "../lib/api";
import { getAdminProductLoadError } from "../lib/adminProductError";
import { filterOrders, getDashboardMetrics, paginate, type DashboardMetrics, type DashboardRange } from "../lib/adminDashboardData";
import { createCategory, createSubcategory, defaultCategoryHierarchy, deleteCategory, deleteSubcategory as deleteSubcategoryApi, loadCategoryHierarchy, publishCategoryHierarchy, saveCategoryHierarchy, updateCategory, updateCategoryVisibility, updateSubcategory, updateSubcategoryVisibility, type CategoryHierarchy } from "../lib/categoryHierarchy";
import { deleteBanner, loadBanners, saveBanner, updateBanner, type CategoryBanner } from "../lib/categoryBanners";
import { defaultGeneralSettings, defaultSocialSettings, fetchAdminFeaturedProductIds, fetchAdminGeneralSettings, fetchAdminSocialSettings, saveAdminFeaturedProductIds, saveAdminGeneralSettings, saveAdminSocialSettings, type GeneralSettings, type SocialSettings } from "../lib/storefrontSettings";
import "./admin-dashboard.css";

type Icon = typeof LayoutDashboard;
type AdminProduct = Omit<Product, "category"> & {
  category: string;
  stock: number;
  status: "Active" | "Draft";
  sku: string;
  databaseProduct?: boolean;
  mainCategoryId?: string;
  subcategoryId?: string;
  mainCategory?: string;
  subcategory?: string;
};
type StoredProduct = {
  id: string;
  _id?: string;
  name: string;
  description: string;
  price: number;
  compareAt: number | null;
  image: string;
  productType?: string;
  stock: number;
  sizes: string[];
  colors: string[];
  status: "Active" | "Draft";
  mainCategoryId: string;
  subcategoryId: string;
  mainCategory: string;
  subcategory: string;
  createdAt: string;
  updatedAt: string;
};
type OrderStatus = "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
type AdminOrderItem = { id: string; name: string; price: number; image: string; quantity: number; variant?: string; lineTotal: number };
type AdminOrder = { id: string; customer: { name: string; email: string; phone: string }; shippingAddress: { address: string; apartment: string; city: string; state: string; pinCode: string; country: string }; items: AdminOrderItem[]; subtotal: number; shipping: number; discount: number; total: number; payment: { method: string; status: string }; paymentMode?: "test"; status: OrderStatus; createdAt: string };
type PermissionKey = "dashboard" | "products" | "orders" | "customers" | "marketing" | "content" | "analytics" | "settings";
type AdminPermissions = Record<PermissionKey, { view: boolean; edit: boolean }>;
type AdminUser = { id: string; name: string; email: string; phone: string; role: string; status: "Active" | "Inactive"; permissions: AdminPermissions };
type AdminCustomerRecord = { id: string; name: string; username: string; email: string; mobile: string; isProfileComplete: boolean };
type AdminCustomer = AdminCustomerRecord & { orderCount: number; verifiedSpend: number };
type NavItem = { label: string; icon: Icon; screen: string };
type NavSection = { label: string; items: NavItem[] };

const navigation: NavSection[] = [
  { label: "Dashboard", items: [{ label: "Dashboard", icon: LayoutDashboard, screen: "dashboard" }] },
  { label: "Products", items: [{ label: "All Products", icon: ShoppingBag, screen: "products" }, { label: "Add Product", icon: Plus, screen: "add-product" }, { label: "Categories", icon: Tag, screen: "categories" }, { label: "Inventory", icon: Box, screen: "inventory" }, { label: "Banners", icon: Image, screen: "banners" }] },
  { label: "Orders", items: [{ label: "All Orders", icon: ClipboardList, screen: "orders" }, { label: "Pending Orders", icon: PackageOpen, screen: "orders-pending" }, { label: "Processing Orders", icon: Boxes, screen: "orders-processing" }, { label: "Shipped Orders", icon: Truck, screen: "orders-shipped" }, { label: "Delivered Orders", icon: PackageCheck, screen: "orders-delivered" }, { label: "Cancelled Orders", icon: Archive, screen: "orders-cancelled" }] },
  { label: "Customers", items: [{ label: "Customers", icon: Users, screen: "customers" }, { label: "Customer Details", icon: UserRound, screen: "customer-details" }] },
  { label: "Marketing", items: [{ label: "Discounts", icon: Percent, screen: "discounts" }, { label: "Coupons", icon: Tag, screen: "coupons" }, { label: "Promotions", icon: Gift, screen: "promotions" }] },
  { label: "Content", items: [{ label: "Collections", icon: Boxes, screen: "collections" }, { label: "Featured Products", icon: ShoppingBag, screen: "featured" }, { label: "Social Media", icon: Globe2, screen: "social-media" }] },
  { label: "Analytics", items: [{ label: "Analytics", icon: BarChart3, screen: "analytics" }, { label: "Sales Reports", icon: Activity, screen: "sales-reports" }, { label: "Product Reports", icon: FileText, screen: "product-reports" }] },
  { label: "Settings", items: [{ label: "General Settings", icon: Settings, screen: "general-settings" }, { label: "Admin Users", icon: Users, screen: "admin-users" }] },
];
const adminRoutes: Record<string, string> = {
  dashboard: "/admin26/dashboard",
  products: "/admin26/products",
  "add-product": "/admin26/products/add",
  categories: "/admin26/products/categories",
  inventory: "/admin26/products/inventory",
  orders: "/admin26/orders",
  "orders-pending": "/admin26/orders/pending",
  "orders-processing": "/admin26/orders/processing",
  "orders-shipped": "/admin26/orders/shipped",
  "orders-delivered": "/admin26/orders/delivered",
  "orders-cancelled": "/admin26/orders/cancelled",
  customers: "/admin26/customers",
  "customer-details": "/admin26/customers/details",
  discounts: "/admin26/marketing/discounts",
  coupons: "/admin26/marketing/coupons",
  promotions: "/admin26/marketing/promotions",
  banners: "/admin26/products/banners",
  collections: "/admin26/content/collections",
  featured: "/admin26/content/featured-products",
  "social-media": "/admin26/content/social-media",
  analytics: "/admin26/analytics",
  "sales-reports": "/admin26/analytics/sales-reports",
  "product-reports": "/admin26/analytics/product-reports",
  "general-settings": "/admin26/settings/general",
  "admin-users": "/admin26/settings/admin-users",
};

const permissionSections: { key: PermissionKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" }, { key: "products", label: "Products" }, { key: "orders", label: "Orders" },
  { key: "customers", label: "Customers" }, { key: "marketing", label: "Marketing" }, { key: "content", label: "Content" },
  { key: "analytics", label: "Analytics" }, { key: "settings", label: "Settings" },
];
type ProductTypeCategory = { label: string; image?: string };
const defaultProductTypeCategories: ProductTypeCategory[] = [{ label: "Round Neck" }, { label: "Oversized" }, { label: "Acid Oversized" }, { label: "Hoodie" }];
function rolePermissions(role: string): AdminPermissions {
  const all = Object.fromEntries(permissionSections.map(({ key }) => [key, { view: true, edit: true }])) as AdminPermissions;
  if (role === "Manager") all.settings = { view: true, edit: false };
  if (role === "Staff") return Object.fromEntries(permissionSections.map(({ key }) => [key, { view: true, edit: ["orders", "customers"].includes(key) }])) as AdminPermissions;
  if (role === "Admin") all.settings = { view: true, edit: false };
  return all;
}

function StatusPill({ status }: { status: string }) { return <span className={`admin-status admin-status--${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>; }
function ReportingRangeControl({ range, onChange }: { range: DashboardRange; onChange: (value: string) => void }) { return <div className="admin-table-filters"><label>Reporting period<select value={range} onChange={(event) => onChange(event.target.value)}><option>Today</option><option>Yesterday</option><option>Last 7 days</option><option>Last 30 days</option></select></label></div>; }
function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <div className="admin-section-heading"><h2>{title}</h2>{action && <button className="admin-text-button" type="button" onClick={onAction}>{action}<ChevronRight size={15} /></button>}</div>; }
function EmptyState({ title, message, action, onAction }: { title: string; message: string; action?: string; onAction?: () => void }) { return <div className="admin-empty-state"><div className="admin-empty-state__icon"><Box size={20} /></div><strong>{title}</strong><span>{message}</span>{action && <button type="button" className="admin-primary-button" onClick={onAction}>{action}</button>}</div>; }

function ProductTable({ products, onSelect, onEdit, onAdjustStock, alignActionsRight = false }: { products: AdminProduct[]; onSelect?: (product: AdminProduct) => void; onEdit?: (product: AdminProduct) => void; onAdjustStock?: (product: AdminProduct) => void; alignActionsRight?: boolean }) {
  return <div className="admin-table-scroll"><table className={`admin-table${alignActionsRight ? " admin-products-table" : ""}`}><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th className="admin-table-actions-heading">Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="admin-product-name"><img className="admin-real-product-thumb" src={product.image} alt="" /><strong>{product.name}</strong></div></td><td>{product.mainCategory && product.subcategory ? `${product.mainCategory} · ${product.subcategory}` : product.category}</td><td><strong>₹{product.price.toLocaleString("en-IN")}</strong></td><td>{product.stock}</td><td><StatusPill status={product.stock === 0 ? "Out of stock" : product.stock < 10 ? "Low stock" : product.status} /></td><td className="admin-table-actions"><div>{onSelect && <button className="admin-small-button" type="button" onClick={() => onSelect(product)}>View</button>}{onEdit && <button className="admin-small-button" type="button" onClick={() => onEdit(product)}>Edit</button>}{onAdjustStock && <button className="admin-small-button" type="button" onClick={() => onAdjustStock(product)}>Adjust</button>}</div></td></tr>)}</tbody></table></div>;
}
function OrderTable({ orders, onSelect }: { orders: AdminOrder[]; onSelect: (order: AdminOrder) => void }) { return orders.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Order ID</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th /></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong className="admin-order-id">{order.id}</strong></td><td><strong>{order.customer.name}</strong><br /><span>{order.customer.email}</span></td><td>{new Date(order.createdAt).toLocaleString("en-IN")}</td><td>{order.items.reduce((count, item) => count + item.quantity, 0)}</td><td><strong>₹{order.total.toLocaleString("en-IN")}</strong></td><td>{order.payment.status}</td><td><StatusPill status={order.status} /></td><td><button className="admin-more-button" type="button" aria-label={`View order ${order.id}`} onClick={() => onSelect(order)}><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="No orders found." message="Orders will appear here when customers place an order." />; }
function PaginationControls({ page, totalPages, totalItems, pageSize, onPageChange }: { page: number; totalPages: number; totalItems: number; pageSize: number; onPageChange: (page: number) => void }) {
  const firstItem = totalItems ? (page - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(page * pageSize, totalItems);
  return <div className="admin-pagination" aria-label="Table pagination">
    <span>Showing {firstItem}–{lastItem} of {totalItems}</span>
    <div>
      <button className="admin-secondary-button" type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
      <span>Page {page} of {totalPages}</span>
      <button className="admin-secondary-button" type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
    </div>
  </div>;
}
function InventoryAdjustmentDialog({ product, adjustment, error, saving, onAdjustmentChange, onClose, onSubmit }: { product: AdminProduct; adjustment: string; error: string; saving: boolean; onAdjustmentChange: (value: string) => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <div className="admin-modal-backdrop" onClick={saving ? undefined : onClose}>
    <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-adjustment-title" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="admin-modal-close" aria-label="Close inventory adjustment" disabled={saving} onClick={onClose}><X size={17} /></button>
      <h2 id="inventory-adjustment-title">Adjust inventory</h2>
      <p><strong>{product.name}</strong><br />Current stock: {product.stock} units</p>
      <form className="admin-form" onSubmit={onSubmit}>
        <label><span>Unit adjustment</span><input type="number" step="1" required value={adjustment} onChange={(event) => onAdjustmentChange(event.target.value)} aria-describedby="inventory-adjustment-help" /></label>
        <small id="inventory-adjustment-help">Enter a positive number to add stock or a negative number to remove stock. Stock cannot fall below zero.</small>
        {error && <p className="admin-image-error" role="alert">{error}</p>}
        <div className="admin-form-actions">
          <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Updating..." : "Update stock"}</button>
          <button className="admin-secondary-button" type="button" disabled={saving} onClick={onClose}>Cancel</button>
        </div>
      </form>
    </section>
  </div>;
}
type AdminCollection = { id: string; name: string; description: string; productIds: string[]; isVisible: boolean; createdAt: string; updatedAt: string };
type AdminOfferKind = "discount" | "coupon" | "promotion";
type AdminOffer = { id: string; kind: AdminOfferKind; name: string; code?: string; discountType: "percentage" | "fixed"; value: number; minimumOrderAmount: number; startsAt: string | null; endsAt: string | null; isActive: boolean; createdAt: string; updatedAt: string };
function CollectionManagement({ products, productsLoading, productsError, onRefreshProducts }: { products: StoredProduct[]; productsLoading: boolean; productsError: string; onRefreshProducts: () => void }) {
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", productIds: [] as string[], isVisible: true });

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/admin/collections", { cache: "no-store" });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || "Unable to load collections.");
      }
      setCollections(await response.json() as AdminCollection[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load collections.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const reset = () => {
    setForm({ name: "", description: "", productIds: [], isVisible: true });
    setEditingId(null);
    setError("");
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch(editingId ? `/api/admin/collections/${encodeURIComponent(editingId)}` : "/api/admin/collections", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || "Collection could not be saved.");
      }
      const saved = await response.json() as AdminCollection;
      setCollections((current) => editingId ? current.map((collection) => collection.id === saved.id ? saved : collection) : [saved, ...current]);
      toast.success(editingId ? "Collection updated." : "Collection created.");
      reset();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Collection could not be saved.";
      setError(message);
      toast.error("Collection was not saved.", { description: message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (collection: AdminCollection) => {
    if (!window.confirm(`Delete the collection "${collection.name}"? Products will not be deleted.`)) return;
    setError("");
    try {
      const response = await apiFetch(`/api/admin/collections/${encodeURIComponent(collection.id)}`, { method: "DELETE" });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || "Collection could not be deleted.");
      }
      setCollections((current) => current.filter((item) => item.id !== collection.id));
      toast.success("Collection deleted.");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Collection could not be deleted.";
      setError(message);
      toast.error("Collection was not deleted.", { description: message });
    }
  };

  const toggleProduct = (id: string) => {
    setForm((current) => {
      const productIds = current.productIds.includes(id)
        ? current.productIds.filter((productId) => productId !== id)
        : current.productIds.length < 24 ? [...current.productIds, id] : current.productIds;
      return { ...current, productIds };
    });
  };

  return <AdminPanel title="Collections">
    {error && <p className="admin-image-error" role="alert">{error}</p>}
    <form className="admin-form admin-collection-form" onSubmit={save}>
      <label><span>Collection name</span><input required maxLength={80} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
      <label><span>Description</span><textarea maxLength={500} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
      <label className="admin-toggle-label"><span>Storefront visibility</span><input type="checkbox" checked={form.isVisible} onChange={(event) => setForm((current) => ({ ...current, isVisible: event.target.checked }))} /><strong>{form.isVisible ? "Visible" : "Hidden"}</strong></label>
      <fieldset className="admin-collection-products">
        <legend>Products ({form.productIds.length}/24)</legend>
        {productsLoading ? <p>Loading products...</p> : productsError ? <><p className="admin-image-error" role="alert">{productsError}</p><button type="button" className="admin-secondary-button" onClick={onRefreshProducts}>Retry products</button></> : products.filter((product) => product.status === "Active").map((product) => <label key={product.id}><input type="checkbox" checked={form.productIds.includes(product.id)} disabled={!form.productIds.includes(product.id) && form.productIds.length >= 24} onChange={() => toggleProduct(product.id)} /><span>{product.name}</span></label>)}
      </fieldset>
      <div className="admin-form-actions"><button className="admin-primary-button" type="submit" disabled={saving || productsLoading || Boolean(productsError)}>{saving ? "Saving..." : editingId ? "Save Collection" : "Create Collection"}</button>{editingId && <button className="admin-secondary-button" type="button" disabled={saving} onClick={reset}>Cancel</button>}</div>
    </form>
    <div className="admin-collection-list">
      <SectionHeading title="Saved collections" />
      {loading ? <p>Loading collections...</p> : collections.length ? collections.map((collection) => <div className="admin-management-row" key={collection.id}><div><strong>{collection.name}</strong><span>{collection.productIds.length} products · {collection.isVisible ? "Visible" : "Hidden"}</span>{collection.description && <span>{collection.description}</span>}</div><div className="admin-admin-actions"><button className="admin-small-button" type="button" onClick={() => { setEditingId(collection.id); setForm({ name: collection.name, description: collection.description, productIds: collection.productIds, isVisible: collection.isVisible }); setError(""); }}>Edit</button><button className="admin-small-button" type="button" onClick={() => void remove(collection)}>Delete</button></div></div>) : <p>No collections created yet.</p>}
    </div>
  </AdminPanel>;
}
function OfferManagement({ kind }: { kind: AdminOfferKind }) {
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", discountType: "percentage" as "percentage" | "fixed", value: "", minimumOrderAmount: "0", startsAt: "", endsAt: "", isActive: false });
  const heading = kind === "coupon" ? "Coupons" : kind === "discount" ? "Discounts" : "Promotions";

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`/api/admin/marketing/${kind}`, { cache: "no-store" });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || `Unable to load ${heading.toLowerCase()}.`);
      }
      setOffers(await response.json() as AdminOffer[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : `Unable to load ${heading.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [kind]);

  const reset = () => {
    setEditingId(null);
    setForm({ name: "", code: "", discountType: "percentage", value: "", minimumOrderAmount: "0", startsAt: "", endsAt: "", isActive: false });
    setError("");
  };

  const edit = (offer: AdminOffer) => {
    setEditingId(offer.id);
    setForm({
      name: offer.name,
      code: offer.code || "",
      discountType: offer.discountType,
      value: String(offer.value),
      minimumOrderAmount: String(offer.minimumOrderAmount),
      startsAt: offer.startsAt ? offer.startsAt.slice(0, 16) : "",
      endsAt: offer.endsAt ? offer.endsAt.slice(0, 16) : "",
      isActive: offer.isActive,
    });
    setError("");
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(form.value);
    const minimumOrderAmount = Number(form.minimumOrderAmount);
    if (!Number.isFinite(value) || !Number.isFinite(minimumOrderAmount)) {
      setError("Enter valid numeric discount and minimum-order values.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch(editingId ? `/api/admin/marketing/${kind}/${encodeURIComponent(editingId)}` : `/api/admin/marketing/${kind}`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: form.name,
          ...(kind === "coupon" ? { code: form.code } : {}),
          discountType: form.discountType,
          value,
          minimumOrderAmount,
          startsAt: form.startsAt ? `${form.startsAt}:00Z` : null,
          endsAt: form.endsAt ? `${form.endsAt}:00Z` : null,
          isActive: form.isActive,
        }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || `${heading} could not be saved.`);
      }
      const saved = await response.json() as AdminOffer;
      setOffers((current) => editingId ? current.map((offer) => offer.id === saved.id ? saved : offer) : [saved, ...current]);
      toast.success(`${heading.slice(0, -1)} saved.`);
      reset();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : `${heading} could not be saved.`;
      setError(message);
      toast.error(`${heading} were not saved.`, { description: message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (offer: AdminOffer) => {
    if (!window.confirm(`Delete "${offer.name}"? This will not alter existing orders.`)) return;
    setError("");
    try {
      const response = await apiFetch(`/api/admin/marketing/${kind}/${encodeURIComponent(offer.id)}`, { method: "DELETE" });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || `${heading} could not be deleted.`);
      }
      setOffers((current) => current.filter((item) => item.id !== offer.id));
      toast.success(`${heading.slice(0, -1)} deleted.`);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : `${heading} could not be deleted.`;
      setError(message);
      toast.error(`${heading} were not deleted.`, { description: message });
    }
  };

  return <AdminPanel title={heading}>
    <p className="admin-data-warning">Offers are saved and validated as configuration. They are not applied to checkout or existing orders; checkout remains unavailable for real payments until a verified payment integration is configured.</p>
    {error && <p className="admin-image-error" role="alert">{error}</p>}
    <form className="admin-form" onSubmit={save}>
      <label><span>Name</span><input required maxLength={80} value={form.name} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
      {kind === "coupon" && <label><span>Coupon code</span><input required minLength={3} maxLength={32} value={form.code} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} /></label>}
      <label><span>Discount type</span><select value={form.discountType} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, discountType: event.target.value as "percentage" | "fixed" }))}><option value="percentage">Percentage</option><option value="fixed">Fixed amount (₹)</option></select></label>
      <label><span>{form.discountType === "percentage" ? "Percent off" : "Amount off (₹)"}</span><input required type="number" min="0.01" max={form.discountType === "percentage" ? 100 : undefined} step="0.01" value={form.value} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} /></label>
      <label><span>Minimum order amount (₹)</span><input required type="number" min="0" step="0.01" value={form.minimumOrderAmount} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, minimumOrderAmount: event.target.value }))} /></label>
      <label><span>Starts at (UTC)</span><input type="datetime-local" value={form.startsAt} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></label>
      <label><span>Ends at (UTC)</span><input type="datetime-local" value={form.endsAt} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></label>
      <label className="admin-toggle-label"><span>Configuration status</span><input type="checkbox" checked={form.isActive} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /><strong>{form.isActive ? "Active" : "Inactive"}</strong></label>
      <div className="admin-form-actions"><button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? `Save ${heading.slice(0, -1)}` : `Create ${heading.slice(0, -1)}`}</button>{editingId && <button className="admin-secondary-button" type="button" disabled={saving} onClick={reset}>Cancel</button>}</div>
    </form>
    <div className="admin-collection-list"><SectionHeading title={`Saved ${heading.toLowerCase()}`} />{loading ? <p>Loading {heading.toLowerCase()}...</p> : offers.length ? offers.map((offer) => <div className="admin-management-row" key={offer.id}><div><strong>{offer.name}{offer.code ? ` · ${offer.code}` : ""}</strong><span>{offer.discountType === "percentage" ? `${offer.value}% off` : `₹${offer.value.toLocaleString("en-IN")} off`} · minimum ₹{offer.minimumOrderAmount.toLocaleString("en-IN")}</span><span>{offer.isActive ? "Active configuration" : "Inactive"}{offer.startsAt ? ` · Starts ${new Date(offer.startsAt).toLocaleString("en-IN")}` : ""}{offer.endsAt ? ` · Ends ${new Date(offer.endsAt).toLocaleString("en-IN")}` : ""}</span></div><div className="admin-admin-actions"><button className="admin-small-button" type="button" onClick={() => edit(offer)}>Edit</button><button className="admin-small-button" type="button" onClick={() => void remove(offer)}>Delete</button></div></div>) : <p>No {heading.toLowerCase()} configured.</p>}</div>
  </AdminPanel>;
}
function AdminPanel({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) { return <section className="admin-panel admin-workspace-panel"><SectionHeading title={title} action={action} onAction={onAction} />{children}</section>; }

type ProductFormState = { name: string; description: string; price: string; compareAt: string; category: string; subcategory: string; productType: string; image: string; stock: string; sizes: string; colors: string; status: string };
const productTypeOptions = [
  { value: "round-neck", label: "Round Neck" },
  { value: "oversized", label: "Oversized" },
  { value: "acid-oversized", label: "Acid Oversized" },
  { value: "hoodie", label: "Hoodie" },
];
function AddProductForm({ productForm, setProductForm, hierarchy, hierarchyLoading, hierarchyError, onRetryHierarchy, onSave, onCancel, imageError, onImageChange, savedNotice, productSaving, submitLabel = "Save Product" }: { productForm: ProductFormState; setProductForm: React.Dispatch<React.SetStateAction<ProductFormState>>; hierarchy: CategoryHierarchy; hierarchyLoading: boolean; hierarchyError: string; onRetryHierarchy?: () => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>; onCancel: () => void; imageError: string; onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void; savedNotice: string; productSaving: boolean; submitLabel?: string }) {
  const subcategories = hierarchy.subcategories[productForm.category] || [];
  const updateCategory = (category: string) => setProductForm((current) => ({ ...current, category, subcategory: "" }));
  return <form className="admin-form" onSubmit={onSave}>
    <label><span>Product name</span><input required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
    <label><span>Description</span><textarea value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
    <label><span>Price</span><input required type="number" min="0" step="any" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></label>
    <label><span>Compare-at price</span><input type="number" min="0" step="any" value={productForm.compareAt} onChange={(event) => setProductForm({ ...productForm, compareAt: event.target.value })} /></label>
    <label><span>Product type</span><select required value={productForm.productType} onChange={(event) => setProductForm({ ...productForm, productType: event.target.value })}><option value="">Select product type</option>{productTypeOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
    <div className="admin-product-image-field"><span>Product image</span>{productForm.image ? <div className="admin-product-image-upload admin-product-image-upload--preview"><img src={productForm.image} alt="Product preview" /><div className="admin-product-image-actions"><label className="admin-secondary-button">Change Image<input className="admin-product-image-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={onImageChange} /></label><button className="admin-secondary-button" type="button" onClick={() => setProductForm({ ...productForm, image: "" })}>Remove Image</button></div></div> : <div className="admin-product-image-upload"><Image size={22} /><strong>Upload Product Image</strong><label className="admin-primary-button">Choose Image<input className="admin-product-image-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={onImageChange} /></label><small>JPG, PNG, WEBP supported</small></div>}<label><span>Image URL or data URL</span><input type="text" inputMode="url" value={productForm.image.startsWith("data:") ? "" : productForm.image} onChange={(event) => setProductForm({ ...productForm, image: event.target.value })} placeholder="https://example.com/product.jpg or /products/image.jpg" /></label>{imageError && <small className="admin-image-error">{imageError}</small>}</div>
    <label><span>Stock</span><input type="number" min="0" step="1" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} /></label>
    <label><span>Sizes</span><input value={productForm.sizes} onChange={(event) => setProductForm({ ...productForm, sizes: event.target.value })} /></label>
    <label><span>Colors</span><input value={productForm.colors} onChange={(event) => setProductForm({ ...productForm, colors: event.target.value })} /></label>
    <label><span>Main Category</span><select disabled={hierarchyLoading || Boolean(hierarchyError) || hierarchy.main.length === 0} value={productForm.category} onChange={(event) => updateCategory(event.target.value)}><option value="">Select category (optional)</option>{hierarchy.main.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
    <label><span>Subcategory / Industry</span><select disabled={hierarchyLoading || Boolean(hierarchyError) || !subcategories.length} value={productForm.subcategory} onChange={(event) => setProductForm({ ...productForm, subcategory: event.target.value })}><option value="">Select subcategory (optional)</option>{subcategories.map((subcategory) => <option key={subcategory.value} value={subcategory.value}>{subcategory.label}</option>)}</select></label>
    <label><span>Status</span><select value={productForm.status} onChange={(event) => setProductForm({ ...productForm, status: event.target.value })}><option>Active</option><option>Draft</option></select></label>
    {hierarchyError && <p className="admin-image-error" role="alert">{hierarchyError} {onRetryHierarchy && <button className="admin-text-button" type="button" onClick={onRetryHierarchy}>Retry</button>}</p>}
    <div className="admin-form-actions"><button className="admin-primary-button" type="submit" disabled={productSaving || hierarchyLoading || Boolean(hierarchyError) || hierarchy.main.length === 0}>{productSaving ? "Saving..." : submitLabel}</button><button className="admin-secondary-button" type="button" onClick={onCancel}>Cancel</button></div>{savedNotice && <p className={savedNotice.includes("saved") ? "admin-form-success" : "admin-image-error"} role="status">{savedNotice}</p>}
  </form>;
}

function readImage(event: React.ChangeEvent<HTMLInputElement>, onChange: (image: string) => void) { const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith("image/")) { event.target.value = ""; return; } const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === "string") onChange(reader.result); }; reader.readAsDataURL(file); event.target.value = ""; }

function CategoryImage({ image, onChange, onRemove, inputRef, showControls = true }: { image?: string; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; onRemove: () => void; inputRef?: React.RefObject<HTMLInputElement | null>; showControls?: boolean }) {
  const retryWithAvailablePublicImage = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const source = img.getAttribute("src") || "";
    const match = source.match(/^(\/products\/.*)\.(png|jpe?g|webp|gif)$/i);
    if (!match) return;

    const extensions = ["png", "jpg", "jpeg", "webp", "gif"];
    const attempted = new Set((img.dataset.attemptedSources || "").split(",").filter(Boolean));
    attempted.add(source);
    img.dataset.attemptedSources = Array.from(attempted).join(",");
    const fallback = extensions
      .map((extension) => `${match[1]}.${extension}`)
      .find((candidate) => !attempted.has(candidate) && candidate !== source);
    if (fallback) img.src = fallback;
  };
  return <div className={`admin-category-image-field ${showControls ? "admin-category-image-field--controls" : ""}`}>{image ? <img className="admin-category-thumb" src={image} alt="" onError={retryWithAvailablePublicImage} /> : <span className="admin-category-thumb admin-category-thumb--empty">No image</span>}{showControls && <><label className="admin-small-button">{image ? "Change" : "Upload"}<input ref={inputRef} className="admin-product-image-input" type="file" accept="image/*" onChange={onChange} /></label>{image && <button type="button" className="admin-small-button" onClick={onRemove}>Remove</button>}</>}</div>;
}

function CategoryVisibilityButton({ isVisible, label, saving, onClick }: { isVisible: boolean; label: string; saving: boolean; onClick: () => void }) {
  return <button type="button" className="admin-small-button" disabled={saving} aria-label={`${isVisible ? "Hide" : "Show"} ${label}`} aria-pressed={isVisible} onClick={onClick}>{saving ? "Saving..." : isVisible ? "Visible" : "Hidden"}</button>;
}

function CategoryManagement({ productCategories, setProductCategories, hierarchy, setHierarchy, hierarchyLoading, hierarchyError, onRetryHierarchy, newCategory, setNewCategory, addCategory }: { productCategories: ProductTypeCategory[]; setProductCategories: React.Dispatch<React.SetStateAction<ProductTypeCategory[]>>; hierarchy: CategoryHierarchy; setHierarchy: React.Dispatch<React.SetStateAction<CategoryHierarchy>>; hierarchyLoading: boolean; hierarchyError: string; onRetryHierarchy: () => void; newCategory: string; setNewCategory: React.Dispatch<React.SetStateAction<string>>; addCategory: (image?: string) => void }) {
  const [parentCategory, setParentCategory] = useState(hierarchy.main[0]?.value || "");
  const [newMainCategory, setNewMainCategory] = useState("");
  const [newMainImage, setNewMainImage] = useState("");
  const newMainImageInputRef = useRef<HTMLInputElement>(null);
  const [newSubcategory, setNewSubcategory] = useState("");
  const addingSubcategoryRef = useRef(false);
  const [newSubcategoryImage, setNewSubcategoryImage] = useState("");
  const newSubcategoryImageInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!hierarchy.main.some((category) => category.value === parentCategory)) setParentCategory(hierarchy.main[0]?.value || "");
  }, [hierarchy.main, parentCategory]);
  const [editingMain, setEditingMain] = useState<string | null>(null);
  const [editingMainName, setEditingMainName] = useState("");
  const [editingMainImage, setEditingMainImage] = useState("");
  const [editingSubcategory, setEditingSubcategory] = useState<{ parent: string; value: string } | null>(null);
  const [editingSubcategoryName, setEditingSubcategoryName] = useState("");
  const [editingSubcategoryParent, setEditingSubcategoryParent] = useState("");
  const [editingSubcategoryImage, setEditingSubcategoryImage] = useState("");
  const [editingProductType, setEditingProductType] = useState<string | null>(null);
  const [editingProductTypeImage, setEditingProductTypeImage] = useState("");
  const [newProductTypeImage, setNewProductTypeImage] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [savingVisibility, setSavingVisibility] = useState<string | null>(null);
  const visibilityRequestRef = useRef(false);
  const refreshHierarchy = async () => {
    const next = await loadCategoryHierarchy();
    setHierarchy(next);
    window.dispatchEvent(new Event("tribull-category-hierarchy-updated"));
    return next;
  };
  const saveHierarchy = async (next: CategoryHierarchy) => { try { if (!await saveCategoryHierarchy(next)) throw new Error("Category save failed"); return await refreshHierarchy(); } catch (error) { setCategoryError(error instanceof Error ? error.message : "Could not save category changes. Please try again."); return undefined; } };
  const addMainCategory = async () => { setCategoryError(""); const label = newMainCategory.trim(); if (!label) { setCategoryError("Category name is required."); return; } if (hierarchy.main.some((item) => item.label.toLowerCase() === label.toLowerCase())) return; const value = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); if (!value || hierarchy.main.some((item) => item.value === value)) return; try { await createCategory({ value, label, image: newMainImage }); await refreshHierarchy(); setNewMainCategory(""); setNewMainImage(""); if (newMainImageInputRef.current) newMainImageInputRef.current.value = ""; setParentCategory(value); } catch (error) { setCategoryError(error instanceof Error ? error.message : "Could not add category. Please try again."); } };
  const deleteMainCategory = async (value: string) => { setCategoryError(""); try { await deleteCategory(value); const next = await refreshHierarchy(); if (parentCategory === value) setParentCategory(next.main[0]?.value || ""); } catch (error) { setCategoryError(error instanceof Error ? error.message : "Could not delete category. Please try again."); } };
  const saveMainEdit = async () => { setCategoryError(""); if (!editingMain) return; const label = editingMainName.trim(); if (!label || hierarchy.main.some((item) => item.value !== editingMain && item.label.toLowerCase() === label.toLowerCase())) return; try { await updateCategory(editingMain, { label, image: editingMainImage }); await refreshHierarchy(); setEditingMain(null); } catch (error) { setCategoryError(error instanceof Error ? error.message : "Could not update category. Please try again."); } };
  const toggleMainVisibility = async (category: CategoryHierarchy["main"][number]) => {
    if (visibilityRequestRef.current) return;
    visibilityRequestRef.current = true;
    setSavingVisibility(`main:${category.value}`);
    setCategoryError("");
    try {
      const isVisible = category.isVisible === false;
      await updateCategoryVisibility(category.value, isVisible);
      const next = {
        ...hierarchy,
        main: hierarchy.main.map((item) => item.value === category.value ? { ...item, isVisible } : item),
      };
      setHierarchy(next);
      publishCategoryHierarchy(next);
      toast.success(`${category.label} visibility updated.`);
    } catch (error) {
      toast.error("Could not update category visibility. Please try again.", {
        description: error instanceof Error ? error.message : "Unknown category update error",
      });
    } finally {
      visibilityRequestRef.current = false;
      setSavingVisibility(null);
    }
  };
  const toggleSubcategoryVisibility = async (parent: string, subcategory: CategoryHierarchy["main"][number]) => {
    if (visibilityRequestRef.current) return;
    visibilityRequestRef.current = true;
    setSavingVisibility(`subcategory:${parent}:${subcategory.value}`);
    setCategoryError("");
    try {
      const isVisible = subcategory.isVisible === false;
      await updateSubcategoryVisibility(parent, subcategory.value, isVisible);
      const next = {
        ...hierarchy,
        subcategories: {
          ...hierarchy.subcategories,
          [parent]: (hierarchy.subcategories[parent] || []).map((item) => item.value === subcategory.value ? { ...item, isVisible } : item),
        },
      };
      setHierarchy(next);
      publishCategoryHierarchy(next);
      toast.success(`${subcategory.label} visibility updated.`);
    } catch (error) {
      toast.error("Could not update subcategory visibility. Please try again.", {
        description: error instanceof Error ? error.message : "Unknown subcategory update error",
      });
    } finally {
      visibilityRequestRef.current = false;
      setSavingVisibility(null);
    }
  };
  const addSubcategory = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (addingSubcategoryRef.current) return;
    setCategoryError("");
    const label = newSubcategory.trim();
    if (!parentCategory) { setCategoryError("Select a parent category."); return; }
    if (!label) { setCategoryError("Subcategory name is required."); return; }
    const value = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const current = hierarchy.subcategories[parentCategory] || [];
    if (!value) { setCategoryError("Subcategory name is required."); return; }
    if (current.some((item) => item.value.toLowerCase() === value || item.label.toLowerCase() === label.toLowerCase())) {
      setCategoryError("Subcategory already exists for this category.");
      return;
    }

    addingSubcategoryRef.current = true;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await createSubcategory(parentCategory, { value, label, image: newSubcategoryImage });
      await refreshHierarchy();
      setNewSubcategory("");
      setNewSubcategoryImage("");
      if (newSubcategoryImageInputRef.current) newSubcategoryImageInputRef.current.value = "";
    } catch (error) {
      setCategoryError(error instanceof Error
        ? (/duplicate/i.test(error.message) ? "Subcategory already exists for this category." : error.message)
        : "Could not add subcategory. Please try again.");
    } finally {
      addingSubcategoryRef.current = false;
      button.disabled = false;
    }
  };
  const deleteSubcategory = async (parent: string, value: string) => {
    setCategoryError("");
    const subcategory = (hierarchy.subcategories[parent] || []).find((item) => item.value === value);
    if (!subcategory || !window.confirm(`Delete ${subcategory.label}? Existing products will not be deleted.`)) return;
    try { await deleteSubcategoryApi(parent, value); await refreshHierarchy(); } catch (error) { setCategoryError(error instanceof Error ? error.message : "Could not delete subcategory. Please try again."); }
  };
  const saveSubcategoryEdit = async () => { setCategoryError(""); if (!editingSubcategory) return; const label = editingSubcategoryName.trim(); if (!label) return; const targetItems = hierarchy.subcategories[editingSubcategoryParent] || []; if (targetItems.some((item) => item.value !== editingSubcategory.value && item.label.toLowerCase() === label.toLowerCase())) return; try { if (editingSubcategoryParent === editingSubcategory.parent) { await updateSubcategory(editingSubcategory.parent, editingSubcategory.value, { label, image: editingSubcategoryImage }); await refreshHierarchy(); } else { const withoutCurrent = (hierarchy.subcategories[editingSubcategory.parent] || []).filter((item) => item.value !== editingSubcategory.value); const current = hierarchy.subcategories[editingSubcategory.parent]?.find((item) => item.value === editingSubcategory.value); if (!await saveHierarchy({ ...hierarchy, subcategories: { ...hierarchy.subcategories, [editingSubcategory.parent]: withoutCurrent, [editingSubcategoryParent]: [...targetItems.filter((item) => item.value !== editingSubcategory.value), { ...(current || { value: editingSubcategory.value }), label, image: editingSubcategoryImage }] } })) return; } setEditingSubcategory(null); setEditingSubcategoryName(""); } catch (error) { setCategoryError(error instanceof Error ? error.message : "Could not update subcategory. Please try again."); } };
  const saveProductTypeImage = (label: string, image: string) => setProductCategories((current) => current.map((item) => item.label === label ? { ...item, image } : item));
  const mainCategoryForm = <div className="admin-inline-form admin-main-category-form"><input value={newMainCategory} placeholder="New category name" onChange={(event) => setNewMainCategory(event.target.value)} /><CategoryImage image={newMainImage} inputRef={newMainImageInputRef} onChange={(event) => readImage(event, setNewMainImage)} onRemove={() => { setNewMainImage(""); if (newMainImageInputRef.current) newMainImageInputRef.current.value = ""; }} /><button className="admin-primary-button" type="button" onClick={addMainCategory}><Plus size={15} />Add category</button></div>;
  return <>
    {categoryError && <p className="admin-image-error">{categoryError}</p>}
    {mainCategoryForm}
    <section className="admin-category-management">
      <SectionHeading title="Main Categories" />
      <div className="admin-category-list">
        {hierarchyLoading ? <span className="admin-empty-state">Loading categories...</span> : hierarchyError ? <span className="admin-empty-state">Unable to load categories. Please try again. <button className="admin-text-button" type="button" onClick={onRetryHierarchy}>Retry</button></span> : hierarchy.main.length === 0 ? <span className="admin-empty-state">No categories found.</span> : hierarchy.main.map((category) => (
          <div className="admin-management-row" key={category.value}>
            <CategoryImage
              image={editingMain === category.value ? editingMainImage : category.image}
              onChange={(event) => readImage(event, editingMain === category.value ? setEditingMainImage : (image) => saveHierarchy({ ...hierarchy, main: hierarchy.main.map((item) => item.value === category.value ? { ...item, image } : item) }))}
              onRemove={() => editingMain === category.value ? setEditingMainImage("") : saveHierarchy({ ...hierarchy, main: hierarchy.main.map((item) => item.value === category.value ? { ...item, image: "" } : item) })}
            />
            {editingMain === category.value ? <input className="admin-subcategory-edit-input" value={editingMainName} onChange={(event) => setEditingMainName(event.target.value)} /> : <strong>{category.label}</strong>}
            {editingMain === category.value ? <>
              <button type="button" className="admin-small-button" onClick={saveMainEdit}>Save</button>
              <button type="button" className="admin-small-button" onClick={() => setEditingMain(null)}>Cancel</button>
            </> : <>
              <CategoryVisibilityButton
                isVisible={category.isVisible !== false}
                label={category.label}
                saving={savingVisibility === `main:${category.value}`}
                onClick={() => void toggleMainVisibility(category)}
              />
              <button type="button" className="admin-small-button" onClick={() => { setEditingMain(category.value); setEditingMainName(category.label); setEditingMainImage(category.image || ""); }}>Edit</button>
              <button type="button" className="admin-small-button" onClick={() => deleteMainCategory(category.value)}>Delete</button>
            </>}
          </div>
        ))}
      </div>
    </section>
    <section className="admin-category-management">
      <SectionHeading title="Subcategories / Industries" />
      <div className="admin-inline-form admin-category-form">
        <select value={parentCategory} onChange={(event) => setParentCategory(event.target.value)}>{hierarchy.main.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select>
        <input value={newSubcategory} placeholder="New subcategory name" onChange={(event) => setNewSubcategory(event.target.value)} />
        <CategoryImage image={newSubcategoryImage} inputRef={newSubcategoryImageInputRef} onChange={(event) => readImage(event, setNewSubcategoryImage)} onRemove={() => { setNewSubcategoryImage(""); if (newSubcategoryImageInputRef.current) newSubcategoryImageInputRef.current.value = ""; }} />
        <button className="admin-primary-button" type="button" onClick={addSubcategory}><Plus size={15} />Add subcategory</button>
      </div>
      <div className="admin-subcategory-list">
        {hierarchyLoading ? <span className="admin-empty-state">Loading categories...</span> : hierarchyError ? <span className="admin-empty-state">Unable to load categories. Please try again. <button className="admin-text-button" type="button" onClick={onRetryHierarchy}>Retry</button></span> : hierarchy.main.length === 0 ? <span className="admin-empty-state">No categories found.</span> : (hierarchy.subcategories[parentCategory] || []).length === 0 ? <span className="admin-empty-state">No subcategories found.</span> : (hierarchy.subcategories[parentCategory] || []).map((subcategory) => {
          const parent = hierarchy.main.find((category) => category.value === parentCategory);
          const isEditing = editingSubcategory?.parent === parentCategory && editingSubcategory.value === subcategory.value;
          return <div className={`admin-subcategory-row ${isEditing ? "admin-subcategory-row--editing" : ""}`} key={`${parentCategory}-${subcategory.value}`}>
            {isEditing ? <>
              <CategoryImage image={editingSubcategoryImage} onChange={(event) => readImage(event, setEditingSubcategoryImage)} onRemove={() => setEditingSubcategoryImage("")} showControls={false} />
              <select className="admin-category-edit-select" value={editingSubcategoryParent} onChange={(event) => setEditingSubcategoryParent(event.target.value)}>{hierarchy.main.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select>
              <input className="admin-subcategory-edit-input" value={editingSubcategoryName} onChange={(event) => setEditingSubcategoryName(event.target.value)} />
              <label className="admin-small-button admin-subcategory-upload-button">Upload<input className="admin-product-image-input" type="file" accept="image/*" onChange={(event) => readImage(event, setEditingSubcategoryImage)} /></label>
              <button type="button" className="admin-small-button" onClick={saveSubcategoryEdit}>Save</button>
              <button type="button" className="admin-small-button" onClick={() => setEditingSubcategory(null)}>Cancel</button>
            </> : <>
              <strong>{parent?.label}</strong>
              <CategoryImage
                image={subcategory.image}
                onChange={(event) => readImage(event, (image) => saveHierarchy({ ...hierarchy, subcategories: { ...hierarchy.subcategories, [parentCategory]: (hierarchy.subcategories[parentCategory] || []).map((item) => item.value === subcategory.value ? { ...item, image } : item) } }))}
                onRemove={() => saveHierarchy({ ...hierarchy, subcategories: { ...hierarchy.subcategories, [parentCategory]: (hierarchy.subcategories[parentCategory] || []).map((item) => item.value === subcategory.value ? { ...item, image: "" } : item) } })}
              />
              <span>{subcategory.label}</span>
              <CategoryVisibilityButton
                isVisible={subcategory.isVisible !== false}
                label={subcategory.label}
                saving={savingVisibility === `subcategory:${parentCategory}:${subcategory.value}`}
                onClick={() => void toggleSubcategoryVisibility(parentCategory, subcategory)}
              />
              <button type="button" className="admin-small-button" onClick={() => { setEditingSubcategory({ parent: parentCategory, value: subcategory.value }); setEditingSubcategoryParent(parentCategory); setEditingSubcategoryName(subcategory.label); setEditingSubcategoryImage(subcategory.image || ""); }}>Edit</button>
              <button type="button" className="admin-small-button" onClick={() => deleteSubcategory(parentCategory, subcategory.value)}>Delete</button>
            </>}
          </div>;
        })}
      </div>
    </section>
    <section className="admin-category-management"><SectionHeading title="Product Type Categories" /><div className="admin-inline-form"><input value={newCategory} placeholder="New product type" onChange={(event) => setNewCategory(event.target.value)} /><CategoryImage image={newProductTypeImage} onChange={(event) => readImage(event, setNewProductTypeImage)} onRemove={() => setNewProductTypeImage("")} /><button className="admin-primary-button" type="button" onClick={() => { addCategory(newProductTypeImage); setNewProductTypeImage(""); }}><Plus size={15} />Add category</button></div><div className="admin-chip-list">{productCategories.map((category) => { const isEditing = editingProductType === category.label; return <div className={`admin-management-row admin-product-type-row ${isEditing ? "admin-product-type-row--editing" : ""}`} key={category.label}>{isEditing ? <><CategoryImage image={editingProductTypeImage} onChange={(event) => readImage(event, setEditingProductTypeImage)} onRemove={() => setEditingProductTypeImage("")} showControls={false} /><input className="admin-subcategory-edit-input" value={category.label} readOnly /><label className="admin-small-button admin-product-type-upload-button">Upload<input className="admin-product-image-input" type="file" accept="image/*" onChange={(event) => readImage(event, setEditingProductTypeImage)} /></label><button type="button" className="admin-small-button" onClick={() => { saveProductTypeImage(category.label, editingProductTypeImage); setEditingProductType(null); }}>Save</button><button type="button" className="admin-small-button" onClick={() => setEditingProductType(null)}>Cancel</button></> : <><CategoryImage image={category.image} onChange={(event) => readImage(event, (image) => saveProductTypeImage(category.label, image))} onRemove={() => saveProductTypeImage(category.label, "")} /><strong>{category.label}</strong><div className="admin-product-type-actions"><button type="button" className="admin-small-button" onClick={() => { setEditingProductType(category.label); setEditingProductTypeImage(category.image || ""); }}>Edit</button><button type="button" className="admin-small-button" onClick={() => setProductCategories((current) => current.filter((item) => item.label !== category.label))}>Delete</button></div></>}</div>; })}</div></section>
  </>;
}

function BannerManagement({ categories, categoriesLoading }: { categories: CategoryHierarchy["main"]; categoriesLoading: boolean }) {
  const [banners, setBanners] = useState<CategoryBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [image, setImage] = useState("");
  const [editing, setEditing] = useState<CategoryBanner | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setBanners(await loadBanners());
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Unable to load banners.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!categories.some((category) => category.value === categoryId)) {
      setCategoryId(categories[0]?.value || "");
    }
  }, [categories, categoryId]);

  const resetForm = () => {
    setEditing(null);
    setImage("");
    setCategoryId(categories[0]?.value || "");
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const changeImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WEBP banner image.");
      event.target.value = "";
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("Banner image must be smaller than 6 MB.");
      event.target.value = "";
      return;
    }
    setReadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);
        setError("");
      }
      setReadingImage(false);
    };
    reader.onerror = () => {
      setReadingImage(false);
      setError("Unable to read the selected banner image.");
    };
    reader.readAsDataURL(file);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current || readingImage) return;
    if (!categoryId) {
      setError(categoriesLoading ? "Categories are still loading." : "Select a main category.");
      return;
    }
    if (!image) {
      setError("Select a banner image.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      if (editing) await updateBanner(editing.id, categoryId, image);
      else await saveBanner(categoryId, image);
      await refresh();
      resetForm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save banner.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const edit = (banner: CategoryBanner) => {
    setEditing(banner);
    setCategoryId(banner.categoryId);
    setImage(banner.image);
    setError("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const remove = async (banner: CategoryBanner) => {
    if (!window.confirm(`Delete the ${banner.categoryName} banner?`)) return;
    setError("");
    try {
      await deleteBanner(banner.id);
      await refresh();
      if (editing?.id === banner.id) resetForm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete banner.");
    }
  };

  return <section className="admin-panel admin-banner-management">
    <SectionHeading title="Category Banners" />
    <form className="admin-banner-form" onSubmit={submit}>
      <label><span>Main Category</span><select required disabled={categoriesLoading || categories.length === 0 || saving} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Select Category</option>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
      <div className="admin-banner-image-control">
        <span>Banner Image</span>
        <div className="admin-banner-image-preview">{image ? <img src={image} alt="Banner preview" /> : <span>No banner selected</span>}</div>
        <label className="admin-primary-button">{readingImage ? "Reading Image..." : image ? "Change Image" : "Upload Image"}<input ref={imageInputRef} className="admin-product-image-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={saving || readingImage} onChange={changeImage} /></label>
      </div>
      <div className="admin-banner-form-actions">
        <button className="admin-primary-button" type="submit" disabled={saving || readingImage || categoriesLoading || !categories.length}>{saving ? "Saving..." : "Save Banner"}</button>
        {editing && <button className="admin-secondary-button" type="button" disabled={saving || readingImage} onClick={resetForm}>Cancel</button>}
      </div>
    </form>
    {error && <p className="admin-image-error" role="alert">{error}</p>}
    <div className="admin-banner-list">
      {loading ? <p>Loading banners...</p> : loadError ? <EmptyState title="Unable to load banners" message={loadError} action="Retry" onAction={() => void refresh()} /> : banners.length ? banners.map((banner) => <div className="admin-banner-row" key={banner.id}>
        <div className="admin-banner-row__preview">{banner.image ? <img src={banner.image} alt={`${banner.categoryName} banner`} /> : <span>No image</span>}</div>
        <strong>{banner.categoryName}</strong>
        <button className="admin-small-button" type="button" onClick={() => edit(banner)}>Edit</button>
        <button className="admin-small-button" type="button" onClick={() => void remove(banner)}>Delete</button>
      </div>) : <p>No banners found.</p>}
    </div>
  </section>;
}

export default function AdminDashboard({ initialScreen = "dashboard", productId }: { initialScreen?: string; productId?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [range, setDashboardRange] = useState<DashboardRange>("Today");
  const setRange = (value: string) => {
    if (value === "Today" || value === "Yesterday" || value === "Last 7 days" || value === "Last 30 days") setDashboardRange(value);
  };
  const [adminSearch, setAdminSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("All categories");
  const [productStatusFilter, setProductStatusFilter] = useState("All statuses");
  const [productStockFilter, setProductStockFilter] = useState("All stock");
  const [productSort, setProductSort] = useState("recent");
  const [productPage, setProductPage] = useState(1);
  const [orderDateFilter, setOrderDateFilter] = useState<"All time" | "Last 7 days" | "Last 30 days">("All time");
  const [orderPage, setOrderPage] = useState(1);
  const [screen, setScreen] = useState(initialScreen);
  const [, setLocation] = useLocation();
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);
  const [isProductEditorOpen, setIsProductEditorOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoredProduct | null>(null);
  const [editingProductTarget, setEditingProductTarget] = useState<AdminProduct | null>(null);
  const [editingProductForm, setEditingProductForm] = useState<ProductFormState>({ name: "", description: "", price: "", compareAt: "", category: "", subcategory: "", productType: "", image: "", stock: "", sizes: "", colors: "", status: "Draft" });
  const [editingProductCategory, setEditingProductCategory] = useState("");
  const [editingProductSubcategory, setEditingProductSubcategory] = useState("");
  const [productUpdateError, setProductUpdateError] = useState("");
  const productUpdateInFlight = useRef(false);
  const [databaseProducts, setDatabaseProducts] = useState<StoredProduct[]>([]);
  const [productsError, setProductsError] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [analyticsMetrics, setAnalyticsMetrics] = useState<DashboardMetrics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsLoadVersion, setAnalyticsLoadVersion] = useState(0);
  const [customerRecords, setCustomerRecords] = useState<AdminCustomerRecord[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [inventoryAdjustmentProduct, setInventoryAdjustmentProduct] = useState<AdminProduct | null>(null);
  const [inventoryAdjustment, setInventoryAdjustment] = useState("");
  const [inventoryAdjustmentError, setInventoryAdjustmentError] = useState("");
  const [inventoryAdjustmentSaving, setInventoryAdjustmentSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [categories, setCategories] = useState<ProductTypeCategory[]>(defaultProductTypeCategories);
  const [categoryHierarchy, setCategoryHierarchy] = useState<CategoryHierarchy>({ main: [], subcategories: {} });
  const [categoryHierarchyLoading, setCategoryHierarchyLoading] = useState(true);
  const [categoryHierarchyError, setCategoryHierarchyError] = useState("");
  const [categoryHierarchyLoadVersion, setCategoryHierarchyLoadVersion] = useState(0);
  const [featured, setFeatured] = useState<string[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [featuredSaving, setFeaturedSaving] = useState(false);
  const [featuredError, setFeaturedError] = useState("");
  const [settingsLoadVersion, setSettingsLoadVersion] = useState(0);
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({ ...defaultGeneralSettings });
  const [generalSettingsLoading, setGeneralSettingsLoading] = useState(false);
  const [generalSettingsSaving, setGeneralSettingsSaving] = useState(false);
  const [generalSettingsError, setGeneralSettingsError] = useState("");
  const [generalSettingsNotice, setGeneralSettingsNotice] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [productForm, setProductForm] = useState<ProductFormState>({ name: "", description: "", price: "", compareAt: "", category: "", subcategory: "", productType: "round-neck", image: "", stock: "", sizes: "S, M, L, XL", colors: "Black", status: "Active" });
  const [editProductLoading, setEditProductLoading] = useState(initialScreen === "edit-product");
  const [editProductError, setEditProductError] = useState("");
  const editProductRequest = useRef<AbortController | null>(null);
  useEffect(() => { setScreen(initialScreen); }, [initialScreen]);
  useEffect(() => {
    if (!productId) return;
    let active = true;
    setEditProductLoading(true);
    setEditProductError("");
    void apiFetch(`/api/admin/products/${encodeURIComponent(productId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
          throw new Error(details?.error || "Unable to load this product.");
        }
        return await response.json() as StoredProduct;
      })
      .then((product) => {
        if (!active) return;
        setProductForm({
          name: product.name,
          description: product.description,
          price: String(product.price),
          compareAt: product.compareAt === null ? "" : String(product.compareAt),
          category: product.mainCategoryId,
          subcategory: product.subcategoryId,
          image: product.image,
          stock: String(product.stock),
          sizes: product.sizes.join(", "),
          colors: product.colors.join(", "),
          productType: product.productType || "",
          status: product.status,
        });
      })
      .catch((error: unknown) => {
        if (active) setEditProductError(error instanceof Error ? error.message : "Unable to load this product.");
      })
      .finally(() => {
        if (active) setEditProductLoading(false);
      });
    return () => { active = false; };
  }, [productId]);
  useEffect(() => {
    let active = true;
    void (async () => {
      setCategoryHierarchyLoading(true);
      setCategoryHierarchyError("");
      try {
        const next = await loadCategoryHierarchy();
        if (!active) return;
        setCategoryHierarchy(next);
        setProductForm((current) => {
          const category = next.main.some((item) => item.value === current.category) ? current.category : next.main[0]?.value || "";
          const subcategory = (next.subcategories[category] || []).some((item) => item.value === current.subcategory) ? current.subcategory : "";
          return { ...current, category, subcategory };
        });
      } catch {
        if (active) setCategoryHierarchyError("Unable to load categories. Please try again.");
      } finally {
        if (active) setCategoryHierarchyLoading(false);
      }
    })();
    return () => { active = false; };
  }, [categoryHierarchyLoadVersion]);
  const retryCategoryHierarchy = () => setCategoryHierarchyLoadVersion((version) => version + 1);
  const refreshProducts = async () => {
    setProductsLoading(true);
    setProductsError("");
    try {
      const response = await apiFetch("/api/admin/products", { cache: "no-store" });
      if (!response.ok) {
        setProductsError(getAdminProductLoadError(response.status));
        return;
      }
      setDatabaseProducts(await response.json() as StoredProduct[]);
    } catch {
      setProductsError(getAdminProductLoadError());
    } finally {
      setProductsLoading(false);
    }
  };
  useEffect(() => { void refreshProducts(); }, []);
  const refreshOrders = async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const response = await apiFetch("/api/orders", { cache: "no-store" });
      if (!response.ok) throw new Error("Order request failed");
      setOrders(await response.json() as AdminOrder[]);
    } catch {
      setOrdersError("Unable to load orders. Please try again.");
    } finally {
      setOrdersLoading(false);
    }
  };
  useEffect(() => { void refreshOrders(); }, []);
  useEffect(() => {
    if (!["analytics", "sales-reports", "product-reports"].includes(screen)) return;
    let active = true;
    setAnalyticsLoading(true);
    setAnalyticsError("");
    void apiFetch(`/api/admin/analytics?range=${encodeURIComponent(range)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
          throw new Error(details?.error || "Unable to load analytics.");
        }
        return await response.json() as DashboardMetrics;
      })
      .then((metrics) => { if (active) setAnalyticsMetrics(metrics); })
      .catch((error: unknown) => {
        if (active) setAnalyticsError(error instanceof Error ? error.message : "Unable to load analytics.");
      })
      .finally(() => { if (active) setAnalyticsLoading(false); });
    return () => { active = false; };
  }, [analyticsLoadVersion, range, screen]);
  const refreshCustomers = async () => {
    setCustomersLoading(true);
    setCustomersError("");
    try {
      const response = await apiFetch("/api/admin/customers", { cache: "no-store" });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || "Customer request failed");
      }
      setCustomerRecords(await response.json() as AdminCustomerRecord[]);
    } catch (error) {
      setCustomersError(error instanceof Error ? error.message : "Unable to load customers. Please try again.");
    } finally {
      setCustomersLoading(false);
    }
  };
  useEffect(() => {
    if (screen === "customers" || screen === "customer-details") void refreshCustomers();
  }, [screen]);
  const refreshAdminUsers = async () => {
    setAdminUsersLoading(true);
    setAdminUsersError("");
    try {
      const response = await apiFetch("/api/admin/users", { cache: "no-store" });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || "Unable to load admin users.");
      }
      setAdminUsers(await response.json() as AdminUser[]);
    } catch (error) {
      setAdminUsersError(error instanceof Error ? error.message : "Unable to load admin users.");
    } finally {
      setAdminUsersLoading(false);
    }
  };
  useEffect(() => {
    if (screen === "admin-users") void refreshAdminUsers();
  }, [screen]);
  useEffect(() => {
    if (screen !== "social-media") return;
    let active = true;
    setSocialLoading(true);
    setSocialError("");
    void fetchAdminSocialSettings().then((settings) => {
      if (active) setSocialLinks(settings);
    }).catch((error: unknown) => {
      if (active) setSocialError(error instanceof Error ? error.message : "Unable to load social settings.");
    }).finally(() => {
      if (active) setSocialLoading(false);
    });
    return () => { active = false; };
  }, [screen, settingsLoadVersion]);
  useEffect(() => {
    if (screen !== "general-settings") return;
    let active = true;
    setGeneralSettingsLoading(true);
    setGeneralSettingsError("");
    void fetchAdminGeneralSettings().then((settings) => {
      if (active) setGeneralSettings(settings);
    }).catch((error: unknown) => {
      if (active) setGeneralSettingsError(error instanceof Error ? error.message : "Unable to load general settings.");
    }).finally(() => {
      if (active) setGeneralSettingsLoading(false);
    });
    return () => { active = false; };
  }, [screen, settingsLoadVersion]);
  useEffect(() => {
    if (screen !== "featured") return;
    let active = true;
    setFeaturedLoading(true);
    setFeaturedError("");
    void fetchAdminFeaturedProductIds().then((ids) => {
      if (active) setFeatured(ids);
    }).catch((error: unknown) => {
      if (active) setFeaturedError(error instanceof Error ? error.message : "Unable to load featured products.");
    }).finally(() => {
      if (active) setFeaturedLoading(false);
    });
    return () => { active = false; };
  }, [screen, settingsLoadVersion]);
  const [savedNotice, setSavedNotice] = useState("");
  const [productSaving, setProductSaving] = useState(false);
  const [imageError, setImageError] = useState("");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState("");
  const [adminUserSaving, setAdminUserSaving] = useState(false);
  const [adminModal, setAdminModal] = useState<"add" | "view-permissions" | "edit-permissions" | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [adminForm, setAdminForm] = useState({ email: "", role: "Admin", status: "Active" as "Active" | "Inactive" });
  const [permissionDraft, setPermissionDraft] = useState<AdminPermissions>(rolePermissions("Admin"));
  const [adminEditRole, setAdminEditRole] = useState<AdminUser["role"]>("Admin");
  const [adminEditStatus, setAdminEditStatus] = useState<AdminUser["status"]>("Active");
  const [socialLinks, setSocialLinks] = useState<SocialSettings>({ ...defaultSocialSettings });
  const [socialNotice, setSocialNotice] = useState("");
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialError, setSocialError] = useState("");
  const adminProducts = useMemo<AdminProduct[]>(() => databaseProducts.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.productType || `${product.mainCategory} / ${product.subcategory}`,
      price: product.price,
      image: product.image,
      created: Date.parse(product.createdAt) || Date.now(),
      sold: 0,
      stock: product.stock,
      status: product.status,
      sku: product.id.slice(0, 8).toUpperCase(),
      databaseProduct: true,
      mainCategoryId: product.mainCategoryId,
      subcategoryId: product.subcategoryId,
      mainCategory: product.mainCategory,
      subcategory: product.subcategory,
    })), [databaseProducts]);
    const dashboardMetrics = useMemo(() => getDashboardMetrics(orders, range), [orders, range]);
    const customers = useMemo(() => {
      const orderStats = new Map<string, { orders: number; spent: number }>();
      for (const order of orders) {
        const key = order.customer.email.trim().toLowerCase();
        if (!key) continue;
        const stats = orderStats.get(key) || { orders: 0, spent: 0 };
        stats.orders += 1;
        if (order.paymentMode !== "test" && order.status !== "Cancelled" && order.payment.status.trim().toLowerCase() === "paid") stats.spent += order.total;
        orderStats.set(key, stats);
      }
      return customerRecords.map((customer) => ({
        ...customer,
        orderCount: orderStats.get(customer.email.toLowerCase())?.orders || 0,
        verifiedSpend: orderStats.get(customer.email.toLowerCase())?.spent || 0,
      }));
    }, [orders, customerRecords]);
    const matchingCustomers = useMemo(() => {
      const query = adminSearch.trim().toLowerCase();
      return customers.filter((customer) => !query || [customer.name, customer.email, customer.mobile].some((value) => value.toLowerCase().includes(query)));
    }, [customers, adminSearch]);
    const pagedCustomers = useMemo(() => paginate(matchingCustomers, customerPage, 10), [matchingCustomers, customerPage]);
    const matchingProducts = useMemo(() => {
      const query = adminSearch.trim().toLowerCase();
      const filtered = adminProducts.filter((product) => {
        const matchesSearch = !query || [product.id, product.name, product.category, product.mainCategory, product.subcategory, product.sku].some((value) => value?.toLowerCase().includes(query));
        const matchesCategory = screen === "inventory" || productCategoryFilter === "All categories" || product.category === productCategoryFilter || `${product.mainCategory} / ${product.subcategory}` === productCategoryFilter;
        const matchesStatus = screen === "inventory" || productStatusFilter === "All statuses" || product.status === productStatusFilter;
        const matchesStock = productStockFilter === "All stock"
          || (productStockFilter === "Out of stock" && product.stock === 0)
          || (productStockFilter === "Low stock" && product.stock > 0 && product.stock < 10)
          || (productStockFilter === "In stock" && product.stock >= 10);
        return matchesSearch && matchesCategory && matchesStatus && matchesStock;
      });
      return filtered.sort((left, right) => {
        if (productSort === "name") return left.name.localeCompare(right.name);
        if (productSort === "price-ascending") return left.price - right.price;
        if (productSort === "price-descending") return right.price - left.price;
        if (productSort === "stock-ascending") return left.stock - right.stock;
        return right.created - left.created;
      });
    }, [adminProducts, adminSearch, productCategoryFilter, productStatusFilter, productStockFilter, productSort, screen]);
    const pagedProducts = useMemo(() => paginate(matchingProducts, productPage, 10), [matchingProducts, productPage]);
    const filteredOrders = useMemo(() => {
      const routeStatus = screen.startsWith("orders-") ? screen.slice("orders-".length) : "";
      return filterOrders(orders, adminSearch, routeStatus, orderDateFilter);
    }, [orders, screen, adminSearch, orderDateFilter]);
    const pagedOrders = useMemo(() => paginate(filteredOrders, orderPage, 10), [filteredOrders, orderPage]);
    const activeNav = navigation.flatMap((section) => section.items).find((item) => item.screen === screen) || (screen === "edit-product" ? navigation.flatMap((section) => section.items).find((item) => item.screen === "products") : undefined);
  const updateOrder = async (id: string, status: OrderStatus) => {
    try {
      const response = await apiFetch(`/api/orders/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error("Order update failed");
      const updated = await response.json() as AdminOrder;
      setOrders((current) => current.map((order) => order.id === id ? updated : order));
      setSelectedOrder(updated);
    } catch {
      setOrdersError("Unable to update order. Please try again.");
    }
  };
  const adjustInventory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inventoryAdjustmentProduct) return;
    const adjustment = Number(inventoryAdjustment);
    if (!Number.isSafeInteger(adjustment) || adjustment === 0) {
      setInventoryAdjustmentError("Enter a non-zero whole number of units.");
      return;
    }
    setInventoryAdjustmentSaving(true);
    setInventoryAdjustmentError("");
    try {
      const response = await apiFetch(`/api/products/${encodeURIComponent(inventoryAdjustmentProduct.id)}/inventory`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustment }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || "Inventory could not be adjusted.");
      }
      const updated = await response.json() as StoredProduct;
      setDatabaseProducts((current) => current.map((product) => product.id === updated.id ? updated : product));
      setInventoryAdjustmentProduct(null);
      setInventoryAdjustment("");
      toast.success(`${updated.name} inventory updated to ${updated.stock} units.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Inventory could not be adjusted.";
      setInventoryAdjustmentError(message);
      toast.error("Inventory adjustment failed", { description: message });
    } finally {
      setInventoryAdjustmentSaving(false);
    }
  };
  const navigate = (nextScreen: string) => { setScreen(nextScreen); setLocation(adminRoutes[nextScreen] || "/admin26"); setMobileOpen(false); setSelectedProduct(null); setSelectedOrder(null); };
  const saveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const price = Number(productForm.price);
    if (!productForm.price.trim() || !Number.isFinite(price) || price < 0) {
      setSavedNotice("Price must be a valid number greater than or equal to 0.");
      return;
    }
    productUpdateInFlight.current = true;
    setProductSaving(true);
    setSavedNotice("");
    try {
      const response = await apiFetch(productId ? `/api/products/${encodeURIComponent(productId)}` : "/api/products", {
        method: productId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: productForm.name,
          description: productForm.description,
          price,
          compareAt: productForm.compareAt ? Number(productForm.compareAt) : null,
          image: productForm.image,
          productType: productForm.productType,
          stock: productForm.stock ? Number(productForm.stock) : 0,
          sizes: productForm.sizes.split(",").map((size) => size.trim()).filter(Boolean),
          colors: productForm.colors.split(",").map((color) => color.trim()).filter(Boolean),
          status: productForm.status,
          mainCategoryId: productForm.category,
          subcategoryId: productForm.subcategory,
        }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || "Product could not be saved.");
      }
      const savedProduct = await response.json() as StoredProduct;
      if (productId) {
        setDatabaseProducts((current) => current.some((product) => product.id === savedProduct.id)
          ? current.map((product) => product.id === savedProduct.id ? savedProduct : product)
          : [...current, savedProduct]);
        navigate("products");
      } else {
        await refreshProducts();
        setSavedNotice("Product saved successfully.");
        setProductForm((current) => ({ ...current, name: "", description: "", price: "", compareAt: "", productType: "round-neck", image: "", stock: "", sizes: "S, M, L, XL", colors: "Black", status: "Active" }));
        toast.success("Product added successfully!");
        window.setTimeout(() => setSavedNotice(""), 2500);
      }
      setImageError("");
    } catch (error) {
      setSavedNotice(error instanceof Error ? error.message : "Unable to save product. Please try again.");
      toast.error("Failed to save product. Please try again.");
    } finally {
      setProductSaving(false);
    }
  };
  const openProduct = (product: AdminProduct) => {
    setSelectedProduct(product);
    setEditingProductCategory(product.mainCategoryId || "");
    setEditingProductSubcategory(product.subcategoryId || "");
    setProductUpdateError("");
  };
  const editProduct = async (product: AdminProduct) => {
    const storedProduct = product.databaseProduct
      ? databaseProducts.find((item) => (item.id || item._id) === product.id)
      : undefined;
    const productId = storedProduct?.id || storedProduct?._id;
    if (!storedProduct || !productId) {
      toast.error("This catalog product is not saved in the database and cannot be edited.");
      return;
    }
    editProductRequest.current?.abort();
    const request = new AbortController();
    editProductRequest.current = request;
    setSelectedProduct(null);
    setIsProductEditorOpen(true);
    setEditingProductTarget(product);
    setEditingProduct(null);
    setEditProductLoading(true);
    setEditProductError("");
    const url = `/api/admin/products/${encodeURIComponent(productId)}`;
    try {
      let response: Response;
      try {
        response = await apiFetch(url, { cache: "no-store", signal: request.signal });
      } catch (error) {
        if (request.signal.aborted) return;
        console.error("Edit product request:", {
          productId,
          url: new URL(url, window.location.origin).toString(),
          error: error instanceof Error ? error.message : String(error),
        });
        throw new Error("Unable to load product details. Please try again.");
      }
      const responseBody = await response.text();
      if (!response.ok) {
        console.error("Edit product request:", {
          productId,
          url: response.url || new URL(url, window.location.origin).toString(),
          status: response.status,
          response: responseBody,
        });
        throw new Error("Unable to load product details. Please try again.");
      }
      let payload: unknown;
      try {
        payload = JSON.parse(responseBody) as unknown;
      } catch {
        console.error("Edit product request:", {
          productId,
          url: response.url || new URL(url, window.location.origin).toString(),
          status: response.status,
          response: responseBody,
        });
        throw new Error("Unable to load product details. Please try again.");
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        console.error("Edit product request:", {
          productId,
          url: response.url || new URL(url, window.location.origin).toString(),
          status: response.status,
          response: responseBody,
        });
        throw new Error("Unable to load product details. Please try again.");
      }
      const savedProduct = payload as StoredProduct;
      if (savedProduct.id !== productId) {
        console.error("Edit product request:", {
          productId,
          url: response.url || new URL(url, window.location.origin).toString(),
          status: response.status,
          response: responseBody,
        });
        throw new Error("Unable to load product details. Please try again.");
      }
      if (request.signal.aborted) return;
      setEditingProduct(savedProduct);
      setEditingProductForm({
        name: savedProduct.name,
        description: savedProduct.description,
        price: String(savedProduct.price),
        compareAt: savedProduct.compareAt === null ? "" : String(savedProduct.compareAt),
        category: savedProduct.mainCategoryId,
        subcategory: savedProduct.subcategoryId,
        productType: savedProduct.productType || "",
        image: savedProduct.image,
        stock: String(savedProduct.stock),
        sizes: savedProduct.sizes.join(", "),
        colors: savedProduct.colors.join(", "),
        status: savedProduct.status,
      });
    } catch (error) {
      if (!request.signal.aborted) setEditProductError(error instanceof Error && error.message === "Unable to load product details. Please try again."
        ? error.message
        : "Unable to load product details. Please try again.");
    } finally {
      if (!request.signal.aborted) setEditProductLoading(false);
    }
  };
  const closeProductEditor = (forceOrEvent: boolean | React.MouseEvent<HTMLElement> = false) => {
    const force = forceOrEvent === true;
    if (productSaving && !force) return;
    const hasUnsavedChanges = editingProduct && (
      editingProductForm.name !== editingProduct.name
      || editingProductForm.description !== editingProduct.description
      || editingProductForm.price !== String(editingProduct.price)
      || editingProductForm.compareAt !== (editingProduct.compareAt === null ? "" : String(editingProduct.compareAt))
      || editingProductForm.category !== editingProduct.mainCategoryId
      || editingProductForm.subcategory !== editingProduct.subcategoryId
      || editingProductForm.productType !== (editingProduct.productType || "")
      || editingProductForm.image !== editingProduct.image
      || editingProductForm.stock !== String(editingProduct.stock)
      || editingProductForm.sizes !== editingProduct.sizes.join(", ")
      || editingProductForm.colors !== editingProduct.colors.join(", ")
      || editingProductForm.status !== editingProduct.status
    );
    if (!force && hasUnsavedChanges && !window.confirm("Discard your unsaved changes?")) return;
    editProductRequest.current?.abort();
    editProductRequest.current = null;
    setIsProductEditorOpen(false);
    setEditingProduct(null);
    setEditingProductTarget(null);
    setEditProductError("");
    setImageError("");
  };
  const saveEditedProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingProduct || productUpdateInFlight.current) return;
    const price = Number(editingProductForm.price);
    const stock = Number(editingProductForm.stock);
    const compareAt = editingProductForm.compareAt.trim() ? Number(editingProductForm.compareAt) : null;
    if (!editingProductForm.name.trim()) {
      setEditProductError("Product name is required.");
      return;
    }
    if (!editingProductForm.price.trim() || !Number.isFinite(price) || price < 0) {
      setEditProductError("Price must be a valid number greater than or equal to 0.");
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      setEditProductError("Stock must be a valid number greater than or equal to 0.");
      return;
    }
    if (compareAt !== null && (!Number.isFinite(compareAt) || compareAt < 0)) {
      setEditProductError("Compare-at price must be a valid number greater than or equal to 0.");
      return;
    }
    setProductSaving(true);
    productUpdateInFlight.current = true;
    setEditProductError("");
    try {
      const response = await apiFetch(`/api/products/${encodeURIComponent(editingProduct.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingProductForm.name,
          description: editingProductForm.description,
          price,
          compareAt,
          image: editingProductForm.image,
          productType: editingProductForm.productType,
          stock,
          sizes: editingProductForm.sizes.split(",").map((size) => size.trim()).filter(Boolean),
          colors: editingProductForm.colors.split(",").map((color) => color.trim()).filter(Boolean),
          status: editingProductForm.status,
          mainCategoryId: editingProductForm.category,
          subcategoryId: editingProductForm.subcategory,
        }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || "Product could not be updated.");
      }
      const responseBody: unknown = await response.json();
      if (!responseBody || typeof responseBody !== "object" || !("id" in responseBody)
        || responseBody.id !== editingProduct.id) {
        throw new Error("The server returned an invalid product update response.");
      }
      const updatedProduct = responseBody as StoredProduct;
      setDatabaseProducts((current) => current.map((item) => item.id === updatedProduct.id ? updatedProduct : item));
      await refreshProducts();
      window.dispatchEvent(new Event("tribull-products-updated"));
      toast.success("Product updated successfully!");
      closeProductEditor(true);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unable to update product. Please try again.";
      setEditProductError(detail);
      toast.error("Failed to update product. Please try again.", { description: detail });
    } finally {
      productUpdateInFlight.current = false;
      setProductSaving(false);
    }
  };
  const saveProductCategory = async () => {
    if (!selectedProduct?.mainCategoryId) return;
    setProductUpdateError("");
    try {
      const response = await apiFetch(`/api/products/${encodeURIComponent(selectedProduct.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mainCategoryId: editingProductCategory, subcategoryId: editingProductSubcategory }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || "Product category could not be updated.");
      }
      const updated = await response.json() as StoredProduct;
      setDatabaseProducts((current) => current.map((product) => product.id === updated.id ? updated : product));
      setSelectedProduct({
        ...selectedProduct,
        category: `${updated.mainCategory} / ${updated.subcategory}`,
        mainCategoryId: updated.mainCategoryId,
        subcategoryId: updated.subcategoryId,
        mainCategory: updated.mainCategory,
        subcategory: updated.subcategory,
      });
    } catch (error) {
      setProductUpdateError(error instanceof Error ? error.message : "Unable to update product category. Please try again.");
    }
  };
  const handleProductImageChange = (event: React.ChangeEvent<HTMLInputElement>, updateForm: React.Dispatch<React.SetStateAction<ProductFormState>> = setProductForm) => { const file = event.target.files?.[0]; if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setImageError("Please choose a JPG, PNG, or WEBP image."); event.target.value = ""; return; } const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === "string") { updateForm((current) => ({ ...current, image: reader.result as string })); setImageError(""); } }; reader.readAsDataURL(file); event.target.value = ""; };
  const addCategory = (image = "") => { const value = newCategory.trim(); if (value && !categories.some((category) => category.label.toLowerCase() === value.toLowerCase())) { setCategories((current) => [...current, { label: value, image }]); setNewCategory(""); } };
  const toggleFeatured = async (id: string) => {
    if (featuredSaving) return;
    const next = featured.includes(id) ? featured.filter((item) => item !== id) : [...featured, id];
    setFeaturedSaving(true);
    setFeaturedError("");
    try {
      const saved = await saveAdminFeaturedProductIds(next);
      setFeatured(saved);
      window.dispatchEvent(new Event("tribull-featured-products-updated"));
      toast.success("Featured products saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save featured products.";
      setFeaturedError(message);
      toast.error("Featured products were not saved.", { description: message });
    } finally {
      setFeaturedSaving(false);
    }
  };
  const openPermissions = (admin: AdminUser, mode: "view-permissions" | "edit-permissions") => {
    setSelectedAdmin(admin);
    setPermissionDraft(admin.permissions);
    setAdminEditRole(admin.role);
    setAdminEditStatus(admin.status);
    setAdminModal(mode);
    setAdminUsersError("");
  };
  const saveAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdminUserSaving(true);
    setAdminUsersError("");
    try {
      const response = await apiFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminForm.email,
          role: adminForm.role,
          status: adminForm.status,
          permissions: rolePermissions(adminForm.role),
        }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || "Admin access could not be granted.");
      }
      const saved = await response.json() as AdminUser;
      setAdminUsers((current) => [...current, saved].sort((left, right) => left.name.localeCompare(right.name)));
      setAdminForm({ email: "", role: "Admin", status: "Active" });
      setAdminModal(null);
      toast.success("Admin access granted to existing customer.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Admin access could not be granted.";
      setAdminUsersError(message);
      toast.error("Admin access was not saved.", { description: message });
    } finally {
      setAdminUserSaving(false);
    }
  };
  const savePermissions = async () => {
    if (!selectedAdmin || adminUserSaving) return;
    setAdminUserSaving(true);
    setAdminUsersError("");
    try {
      const response = await apiFetch(`/api/admin/users/${encodeURIComponent(selectedAdmin.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: adminEditRole, status: adminEditStatus, permissions: permissionDraft }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(details?.error || "Admin permissions could not be saved.");
      }
      const saved = await response.json() as AdminUser;
      setAdminUsers((current) => current.map((admin) => admin.id === saved.id ? saved : admin));
      setSelectedAdmin(saved);
      setAdminModal("view-permissions");
      toast.success("Admin access updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Admin permissions could not be saved.";
      setAdminUsersError(message);
      toast.error("Admin access was not updated.", { description: message });
    } finally {
      setAdminUserSaving(false);
    }
  };
  const saveSocialLinks = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSocialSaving(true);
    setSocialError("");
    setSocialNotice("");
    try {
      setSocialLinks(await saveAdminSocialSettings(socialLinks));
      window.dispatchEvent(new Event("tribull-social-settings-updated"));
      setSocialNotice("Social links saved.");
      toast.success("Social links saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save social links.";
      setSocialError(message);
      toast.error("Social links were not saved.", { description: message });
    } finally {
      setSocialSaving(false);
    }
  };
  const saveGeneralSettingsForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGeneralSettingsSaving(true);
    setGeneralSettingsError("");
    setGeneralSettingsNotice("");
    try {
      setGeneralSettings(await saveAdminGeneralSettings(generalSettings));
      setGeneralSettingsNotice("General settings saved.");
      toast.success("General settings saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save general settings.";
      setGeneralSettingsError(message);
      toast.error("General settings were not saved.", { description: message });
    } finally {
      setGeneralSettingsSaving(false);
    }
  };

  const renderScreen = () => {
    if (screen === "dashboard") {
      const stats: { label: string; value: string; note: string; icon: Icon }[] = [
        { label: "Verified Sales", value: ordersError || ordersLoading ? "—" : `₹${dashboardMetrics.verifiedSales.toLocaleString("en-IN")}`, note: "Paid, non-test orders only", icon: DollarSign },
        { label: "Orders", value: ordersError || ordersLoading ? "—" : String(dashboardMetrics.orderCount), note: range, icon: ClipboardList },
        { label: "Products", value: productsError || productsLoading ? "—" : String(adminProducts.length), note: "Store catalog", icon: ShoppingBag },
        { label: "Customers with orders", value: ordersError || ordersLoading ? "—" : String(dashboardMetrics.customerCount), note: "Distinct order email addresses", icon: Users },
        { label: "Pending Orders", value: ordersError || ordersLoading ? "—" : String(dashboardMetrics.pendingOrders), note: "In selected period", icon: PackageOpen },
        { label: "Low Stock Products", value: productsError || productsLoading ? "—" : String(adminProducts.filter((product) => product.stock < 10).length), note: "Fewer than 10 units", icon: AlertTriangle },
      ];
      const bestSellerProducts = dashboardMetrics.bestSellers
        .map((seller) => adminProducts.find((product) => product.id === seller.id))
        .filter((product): product is AdminProduct => Boolean(product));
      return <>
        {(ordersError || productsError) && <p className="admin-data-warning" role="alert">{ordersError || productsError} Some dashboard values are unavailable until the data loads successfully.</p>}
        <section className="admin-stats-grid">{stats.map(({ label, value, note, icon: StatIcon }) => <div className="admin-stat-card" key={label}><div className="admin-stat-icon admin-stat-icon--teal"><StatIcon size={19} /></div><div className="admin-stat-label">{label}</div><strong>{value}</strong><span>{note}</span></div>)}</section>
        <section className="admin-panel">
          <SectionHeading title="Sales overview" />
          <p className="admin-data-caption">Revenue includes only paid orders and excludes test-mode and cancelled orders.</p>
          <div className="admin-sales-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboardMetrics.salesByDay} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs><linearGradient id="admin-sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#176b68" stopOpacity={0.2} /><stop offset="95%" stopColor="#176b68" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid stroke="#edf1f2" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tick={{ fill: "#89989d", fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} width={58} tick={{ fill: "#89989d", fontSize: 10 }} tickFormatter={(value: number) => `₹${value.toLocaleString("en-IN")}`} />
                <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Verified sales"]} />
                <Area type="monotone" dataKey="revenue" stroke="#176b68" strokeWidth={2} fill="url(#admin-sales-fill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="admin-panel"><SectionHeading title="Recent Orders" action="View all orders" onAction={() => navigate("orders")} />{ordersError ? <EmptyState title="Orders unavailable" message={ordersError} action="Retry" onAction={() => void refreshOrders()} /> : ordersLoading ? <p>Loading orders...</p> : <OrderTable orders={orders.slice(0, 5)} onSelect={setSelectedOrder} />}</section>
        <div className="admin-two-column">
          <section className="admin-panel"><SectionHeading title="Best Selling Products" action="View products" onAction={() => navigate("products")} />{bestSellerProducts.length ? <ProductTable products={bestSellerProducts} onSelect={openProduct} /> : <p className="admin-data-caption">No paid, non-test product sales are available for this period.</p>}</section>
          <section className="admin-panel"><SectionHeading title="Low Stock Products" action="View inventory" onAction={() => navigate("inventory")} />{productsError ? <p className="admin-data-caption">Inventory is unavailable until products load.</p> : adminProducts.filter((product) => product.stock < 10).map((product) => <div className="admin-low-stock-row" key={product.id}><img className="admin-real-product-thumb" src={product.image} alt="" /><div><strong>{product.name}</strong><span>{product.sku}</span></div><div className="admin-stock-count"><strong>{product.stock}</strong><span>units left</span></div></div>)}</section>
        </div>
      </>;
    }
    if (screen === "products") return <AdminPanel title="All Products" action="Add Product" onAction={() => navigate("add-product")}>
      {productsError ? <EmptyState title="Unable to load saved products" message={productsError} action="Retry" onAction={() => void refreshProducts()} /> : productsLoading ? <p>Loading saved products...</p> : <>
        <div className="admin-table-filters">
          <label>Category<select value={productCategoryFilter} onChange={(event) => { setProductCategoryFilter(event.target.value); setProductPage(1); }}><option>All categories</option>{Array.from(new Set(adminProducts.map((product) => product.mainCategory && product.subcategory ? `${product.mainCategory} / ${product.subcategory}` : product.category))).map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Status<select value={productStatusFilter} onChange={(event) => { setProductStatusFilter(event.target.value); setProductPage(1); }}><option>All statuses</option><option>Active</option><option>Draft</option></select></label>
          <label>Stock<select value={productStockFilter} onChange={(event) => { setProductStockFilter(event.target.value); setProductPage(1); }}><option>All stock</option><option>In stock</option><option>Low stock</option><option>Out of stock</option></select></label>
          <label>Sort by<select value={productSort} onChange={(event) => { setProductSort(event.target.value); setProductPage(1); }}><option value="recent">Recently added</option><option value="name">Name</option><option value="price-ascending">Price: low to high</option><option value="price-descending">Price: high to low</option><option value="stock-ascending">Lowest stock</option></select></label>
        </div>
        {pagedProducts.totalItems ? <><ProductTable products={pagedProducts.items} onSelect={openProduct} onEdit={editProduct} alignActionsRight /><PaginationControls page={pagedProducts.page} totalPages={pagedProducts.totalPages} totalItems={pagedProducts.totalItems} pageSize={10} onPageChange={setProductPage} /></> : <EmptyState title="No products match these filters." message="Try changing the search or product filters." />}
      </>}
    </AdminPanel>;
    if (screen === "banners") return <BannerManagement categories={categoryHierarchy.main} categoriesLoading={categoryHierarchyLoading} />;
    if (screen === "add-product") return <AdminPanel title="Add Product"><AddProductForm productForm={productForm} setProductForm={setProductForm} hierarchy={categoryHierarchy} hierarchyLoading={categoryHierarchyLoading} hierarchyError={categoryHierarchyError} onRetryHierarchy={retryCategoryHierarchy} onSave={saveProduct} onCancel={() => navigate("products")} imageError={imageError} onImageChange={handleProductImageChange} savedNotice={savedNotice} productSaving={productSaving} /></AdminPanel>;
    if (screen === "edit-product") return <AdminPanel title="Edit Product">{editProductLoading ? <p>Loading product...</p> : editProductError ? <><p className="admin-image-error" role="alert">{editProductError}</p><button className="admin-secondary-button" type="button" onClick={() => navigate("products")}>Back to Products</button></> : <AddProductForm productForm={productForm} setProductForm={setProductForm} hierarchy={categoryHierarchy} hierarchyLoading={categoryHierarchyLoading} hierarchyError={categoryHierarchyError} onRetryHierarchy={retryCategoryHierarchy} onSave={saveProduct} onCancel={() => navigate("products")} imageError={imageError} onImageChange={handleProductImageChange} savedNotice={savedNotice} productSaving={productSaving} submitLabel="Save Changes" />}</AdminPanel>;
    if (screen === "categories") return <AdminPanel title="Categories"><CategoryManagement productCategories={categories} setProductCategories={setCategories} hierarchy={categoryHierarchy} setHierarchy={setCategoryHierarchy} hierarchyLoading={categoryHierarchyLoading} hierarchyError={categoryHierarchyError} onRetryHierarchy={retryCategoryHierarchy} newCategory={newCategory} setNewCategory={setNewCategory} addCategory={addCategory} /></AdminPanel>;
    if (screen === "add-product") return <AdminPanel title="Add Product"><form className="admin-form" onSubmit={saveProduct}>{["name", "description", "price", "compareAt", "stock", "sizes", "colors"].map((field) => <label key={field}><span>{field === "compareAt" ? "Compare-at price" : field.charAt(0).toUpperCase() + field.slice(1)}</span>{field === "description" ? <textarea value={productForm[field as keyof typeof productForm]} onChange={(event) => setProductForm({ ...productForm, [field]: event.target.value })} /> : <input required={field === "name" || field === "price"} value={productForm[field as keyof typeof productForm]} onChange={(event) => setProductForm({ ...productForm, [field]: event.target.value })} />}</label>)}<label className="admin-product-image-field"><span>Image</span>{productForm.image ? <div className="admin-product-image-upload admin-product-image-upload--preview"><img src={productForm.image} alt="Product preview" /><div className="admin-product-image-actions"><label className="admin-secondary-button">Change Image<input className="admin-product-image-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={handleProductImageChange} /></label><button className="admin-secondary-button" type="button" onClick={() => { setProductForm((current) => ({ ...current, image: "" })); setImageError(""); }}>Remove Image</button></div></div> : <div className="admin-product-image-upload"><Image size={22} /><strong>Upload Product Image</strong><label className="admin-primary-button">Choose Image<input className="admin-product-image-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={handleProductImageChange} /></label><small>JPG, PNG, WEBP supported</small></div>}{imageError && <small className="admin-image-error">{imageError}</small>}</label><label><span>Category</span><select value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}>{categories.map((category) => <option key={category.label} value={category.label}>{category.label}</option>)}</select></label><label><span>Status</span><select value={productForm.status} onChange={(event) => setProductForm({ ...productForm, status: event.target.value })}><option>Active</option><option>Draft</option></select></label><div className="admin-form-actions"><button className="admin-primary-button" type="submit">Save Product</button><button className="admin-secondary-button" type="button" onClick={() => navigate("products")}>Cancel</button></div>{savedNotice && <p className="admin-form-success">{savedNotice}</p>}</form></AdminPanel>;
    if (screen === "categories") return <AdminPanel title="Categories"><div className="admin-inline-form"><input value={newCategory} placeholder="New category name" onChange={(event) => setNewCategory(event.target.value)} /><button className="admin-primary-button" type="button" onClick={() => addCategory()}><Plus size={15} />Add category</button></div><div className="admin-chip-list">{categories.map((category) => <div className="admin-management-row" key={category.label}><strong>{category.label}</strong><button type="button" className="admin-small-button" onClick={() => setCategories((current) => current.filter((item) => item.label !== category.label))}>Delete</button></div>)}</div></AdminPanel>;
    if (screen === "inventory") return <AdminPanel title="Inventory">
      {productsError ? <EmptyState title="Inventory unavailable" message={productsError} action="Retry" onAction={() => void refreshProducts()} /> : productsLoading ? <p>Loading inventory...</p> : <>
        <div className="admin-table-filters">
          <label>Stock status<select value={productStockFilter} onChange={(event) => { setProductStockFilter(event.target.value); setProductPage(1); }}><option>All stock</option><option>In stock</option><option>Low stock</option><option>Out of stock</option></select></label>
          <label>Sort by<select value={productSort} onChange={(event) => { setProductSort(event.target.value); setProductPage(1); }}><option value="recent">Recently added</option><option value="name">Name</option><option value="stock-ascending">Lowest stock</option><option value="price-ascending">Price: low to high</option><option value="price-descending">Price: high to low</option></select></label>
        </div>
        {pagedProducts.totalItems ? <><ProductTable products={pagedProducts.items} onSelect={openProduct} onEdit={editProduct} onAdjustStock={(product) => { setInventoryAdjustmentProduct(product); setInventoryAdjustment(""); setInventoryAdjustmentError(""); }} alignActionsRight /><PaginationControls page={pagedProducts.page} totalPages={pagedProducts.totalPages} totalItems={pagedProducts.totalItems} pageSize={10} onPageChange={setProductPage} /></> : <EmptyState title="No inventory matches these filters." message="Try changing the search or stock filter." />}
        {inventoryAdjustmentProduct && <InventoryAdjustmentDialog product={inventoryAdjustmentProduct} adjustment={inventoryAdjustment} error={inventoryAdjustmentError} saving={inventoryAdjustmentSaving} onAdjustmentChange={setInventoryAdjustment} onClose={() => setInventoryAdjustmentProduct(null)} onSubmit={adjustInventory} />}
      </>}
    </AdminPanel>;
    if (screen.startsWith("orders")) return <AdminPanel title={activeNav?.label || "Orders"}>
      <div className="admin-table-filters">
        <label>Status<select value={screen === "orders" ? "All statuses" : screen.slice("orders-".length)} onChange={(event) => navigate(event.target.value === "All statuses" ? "orders" : `orders-${event.target.value}`)}><option>All statuses</option>{(["Pending", "Processing", "Shipped", "Delivered", "Cancelled"] as OrderStatus[]).map((status) => <option key={status} value={status.toLowerCase()}>{status}</option>)}</select></label>
        <label>Date placed<select value={orderDateFilter} onChange={(event) => { const value = event.target.value; if (value === "All time" || value === "Last 7 days" || value === "Last 30 days") { setOrderDateFilter(value); setOrderPage(1); } }}><option>All time</option><option>Last 7 days</option><option>Last 30 days</option></select></label>
      </div>
      {ordersLoading ? <p>Loading orders...</p> : ordersError ? <EmptyState title="Unable to load orders" message={ordersError} action="Retry" onAction={() => void refreshOrders()} /> : pagedOrders.totalItems ? <><OrderTable orders={pagedOrders.items} onSelect={setSelectedOrder} /><PaginationControls page={pagedOrders.page} totalPages={pagedOrders.totalPages} totalItems={pagedOrders.totalItems} pageSize={10} onPageChange={setOrderPage} /></> : <EmptyState title="No orders match these filters." message="Try changing the search, status or date range." />}
    </AdminPanel>;
    if (screen === "customers" || screen === "customer-details") return <AdminPanel title={screen === "customers" ? "Customers" : "Customer Details"}>
      {customersError ? <EmptyState title="Unable to load customers" message={customersError} action="Retry" onAction={() => void refreshCustomers()} /> : customersLoading ? <p>Loading customer records...</p> : selectedCustomer ? (() => {
        const customer = customers.find((item) => item.id === selectedCustomer);
        if (!customer) return <EmptyState title="Customer not found" message="This customer is not present in the current customer records." action="Back to customers" onAction={() => setSelectedCustomer(null)} />;
        const customerOrders = orders.filter((order) => order.customer.email.toLowerCase() === customer.email.toLowerCase());
        return <div className="admin-detail-card"><button type="button" className="admin-text-button" onClick={() => setSelectedCustomer(null)}>← All customers</button><div className="admin-detail-avatar">{customer.name.split(/\s+/).map((part) => part[0]).join("")}</div><h3>{customer.name}</h3><p>{customer.email} · {customer.mobile || "Phone not provided"}</p><p>{customer.orderCount} order{customer.orderCount === 1 ? "" : "s"} · Verified paid spend ₹{customer.verifiedSpend.toLocaleString("en-IN")}</p>{ordersError ? <p className="admin-image-error" role="alert">Order history is unavailable: {ordersError}</p> : ordersLoading ? <p>Loading order history...</p> : <OrderTable orders={customerOrders} onSelect={setSelectedOrder} />}</div>;
      })() : customers.length ? <><p className="admin-data-caption">Registered customer profiles from the protected customer collection. Order totals include only loaded orders; spend counts paid, non-test, non-cancelled orders.</p><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th>Orders</th><th>Verified Spend</th><th>Profile</th><th>Details</th></tr></thead><tbody>{pagedCustomers.items.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong></td><td>{customer.mobile || "—"}</td><td>{customer.email}</td><td>{customer.orderCount}</td><td><strong>₹{customer.verifiedSpend.toLocaleString("en-IN")}</strong></td><td>{customer.isProfileComplete ? "Complete" : "Incomplete"}</td><td><button className="admin-small-button" type="button" onClick={() => setSelectedCustomer(customer.id)}>View</button></td></tr>)}</tbody></table></div><PaginationControls page={pagedCustomers.page} totalPages={pagedCustomers.totalPages} totalItems={pagedCustomers.totalItems} pageSize={10} onPageChange={setCustomerPage} /></> : <EmptyState title="No customer records found" message="Registered customers will appear here after they create an account." />}
    </AdminPanel>;
    if (screen === "collections") return <CollectionManagement products={databaseProducts} productsLoading={productsLoading} productsError={productsError} onRefreshProducts={() => void refreshProducts()} />;
    if (screen === "discounts") return <OfferManagement kind="discount" />;
    if (screen === "coupons") return <OfferManagement kind="coupon" />;
    if (screen === "promotions") return <OfferManagement kind="promotion" />;
    if (screen === "social-media") return <AdminPanel title="Social Media">
      {socialLoading ? <p>Loading saved social links...</p> : <form className="admin-form admin-social-form" onSubmit={saveSocialLinks}>
        {(["facebook", "instagram", "pinterest", "whatsapp", "linkedin"] as const).map((key) => <label key={key}><span>{key.charAt(0).toUpperCase() + key.slice(1)} URL</span><input type="url" placeholder="https://" value={socialLinks[key]} disabled={Boolean(socialError) || socialSaving} onChange={(event) => setSocialLinks((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
        {socialError && <><p className="admin-image-error" role="alert">{socialError}. Reload the saved values before editing.</p><button className="admin-secondary-button" type="button" onClick={() => setSettingsLoadVersion((version) => version + 1)}>Retry loading</button></>}
        <div className="admin-form-actions"><button className="admin-primary-button" type="submit" disabled={Boolean(socialError) || socialSaving}>{socialSaving ? "Saving..." : "Save Social Links"}</button></div>
        {socialNotice && <p className="admin-form-success" role="status">{socialNotice}</p>}
      </form>}
    </AdminPanel>;
    if (screen === "featured") return <AdminPanel title="Featured Products">
      {featuredLoading ? <p>Loading featured product selection...</p> : featuredError ? <><p className="admin-image-error" role="alert">{featuredError}</p><button className="admin-secondary-button" type="button" onClick={() => setSettingsLoadVersion((version) => version + 1)}>Retry loading</button></> : productsError ? <EmptyState title="Products unavailable" message={productsError} action="Retry" onAction={() => void refreshProducts()} /> : productsLoading ? <p>Loading products...</p> : <>
        <p className="admin-data-caption">Selected active products are shown in the storefront New Arrivals section in this order. Choose up to 24.</p>
        <div className="admin-featured-grid">{adminProducts.filter((product) => product.status === "Active").map((product) => <button type="button" disabled={featuredSaving || (!featured.includes(product.id) && featured.length >= 24)} className={`admin-featured-card ${featured.includes(product.id) ? "is-featured" : ""}`} key={product.id} onClick={() => void toggleFeatured(product.id)}><img src={product.image} alt="" /><strong>{product.name}</strong><span>{featured.includes(product.id) ? "Featured" : "Add to featured"}</span></button>)}</div>
        {featuredSaving && <p aria-live="polite">Saving featured selection...</p>}
      </>}
    </AdminPanel>;
    if (["analytics", "sales-reports", "product-reports"].includes(screen)) {
      if (analyticsLoading) return <AdminPanel title={activeNav?.label || "Analytics"}><p>Loading database-backed analytics...</p></AdminPanel>;
      if (analyticsError || !analyticsMetrics) return <AdminPanel title={activeNav?.label || "Analytics"}><EmptyState title="Analytics unavailable" message={analyticsError || "No analytics response was returned."} action="Retry" onAction={() => setAnalyticsLoadVersion((version) => version + 1)} /></AdminPanel>;
      if (screen === "sales-reports") return <AdminPanel title="Sales Reports">
        <ReportingRangeControl range={range} onChange={setRange} />
        <div className="admin-report-summary"><div><span>Verified sales</span><strong>₹{analyticsMetrics.verifiedSales.toLocaleString("en-IN")}</strong></div><div><span>Orders</span><strong>{analyticsMetrics.orderCount}</strong></div><div><span>Pending</span><strong>{analyticsMetrics.pendingOrders}</strong></div></div>
        <p className="admin-data-caption">Only paid, non-test, non-cancelled orders are included in verified sales. Reporting period: {range}.</p>
        <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Date</th><th>Orders</th><th>Verified sales</th></tr></thead><tbody>{analyticsMetrics.salesByDay.map((day) => <tr key={day.date}><td>{day.label}</td><td>{day.orders}</td><td><strong>₹{day.revenue.toLocaleString("en-IN")}</strong></td></tr>)}</tbody></table></div>
      </AdminPanel>;
      if (screen === "product-reports") return <AdminPanel title="Product Reports">
        <ReportingRangeControl range={range} onChange={setRange} />
        <p className="admin-data-caption">Best sellers are calculated from paid, non-test, non-cancelled order line items for {range}.</p>
        {analyticsMetrics.bestSellers.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Product</th><th>Units sold</th><th>Verified revenue</th><th>Current stock</th></tr></thead><tbody>{analyticsMetrics.bestSellers.map((seller) => {
          const product = adminProducts.find((item) => item.id === seller.id);
          return <tr key={seller.id}><td><strong>{seller.name}</strong></td><td>{seller.quantity}</td><td><strong>₹{seller.revenue.toLocaleString("en-IN")}</strong></td><td>{product ? product.stock : "Product no longer in catalog"}</td></tr>;
        })}</tbody></table></div> : <EmptyState title="No verified product sales" message={`No paid product orders were recorded for ${range}.`} />}
      </AdminPanel>;
      return <AdminPanel title="Analytics">
          <ReportingRangeControl range={range} onChange={setRange} />
          <p className="admin-data-caption">Live order data · {range} · verified revenue excludes test and cancelled orders.</p>
        <section className="admin-stats-grid admin-report-stats"><div className="admin-stat-card"><div className="admin-stat-label">Verified sales</div><strong>₹{analyticsMetrics.verifiedSales.toLocaleString("en-IN")}</strong></div><div className="admin-stat-card"><div className="admin-stat-label">Orders</div><strong>{analyticsMetrics.orderCount}</strong></div><div className="admin-stat-card"><div className="admin-stat-label">Unique customers</div><strong>{analyticsMetrics.customerCount}</strong></div><div className="admin-stat-card"><div className="admin-stat-label">Pending orders</div><strong>{analyticsMetrics.pendingOrders}</strong></div></section>
        <SectionHeading title="Verified sales by day" />
        <div className="admin-sales-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analyticsMetrics.salesByDay} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}><defs><linearGradient id="admin-report-sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#176b68" stopOpacity={0.2} /><stop offset="95%" stopColor="#176b68" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="#edf1f2" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tick={{ fill: "#89989d", fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} width={58} tick={{ fill: "#89989d", fontSize: 10 }} tickFormatter={(value: number) => `₹${value.toLocaleString("en-IN")}`} /><Tooltip formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Verified sales"]} /><Area type="monotone" dataKey="revenue" stroke="#176b68" strokeWidth={2} fill="url(#admin-report-sales-fill)" /></AreaChart></ResponsiveContainer></div>
      </AdminPanel>;
    }
    if (screen === "general-settings") return <AdminPanel title="General Settings">
      {generalSettingsLoading ? <p>Loading saved settings...</p> : <form className="admin-form" onSubmit={saveGeneralSettingsForm}>
        <label><span>Store name</span><input required maxLength={80} value={generalSettings.storeName} disabled={Boolean(generalSettingsError) || generalSettingsSaving} onChange={(event) => setGeneralSettings((current) => ({ ...current, storeName: event.target.value }))} /></label>
        <label><span>Store email</span><input type="email" maxLength={254} placeholder="Not configured" value={generalSettings.email} disabled={Boolean(generalSettingsError) || generalSettingsSaving} onChange={(event) => setGeneralSettings((current) => ({ ...current, email: event.target.value }))} /></label>
        <label><span>Store phone</span><input type="tel" maxLength={30} placeholder="Not configured" value={generalSettings.phone} disabled={Boolean(generalSettingsError) || generalSettingsSaving} onChange={(event) => setGeneralSettings((current) => ({ ...current, phone: event.target.value }))} /></label>
        <label><span>Currency</span><select value={generalSettings.currency} disabled><option value="INR">INR (₹)</option></select></label>
        {generalSettingsError && <><p className="admin-image-error" role="alert">{generalSettingsError}. Reload the saved values before editing.</p><button className="admin-secondary-button" type="button" onClick={() => setSettingsLoadVersion((version) => version + 1)}>Retry loading</button></>}
        <button className="admin-primary-button" type="submit" disabled={Boolean(generalSettingsError) || generalSettingsSaving}>{generalSettingsSaving ? "Saving..." : "Save Settings"}</button>
        {generalSettingsNotice && <p className="admin-form-success" role="status">{generalSettingsNotice}</p>}
      </form>}
    </AdminPanel>;
    if (screen === "admin-users") return <AdminPanel title="Admin Users" action="+ Add Admin" onAction={() => { setAdminUsersError(""); setAdminModal("add"); }}>
      <p className="admin-data-caption">Grant access only to an existing customer account. Sign-in and credentials remain managed by customer authentication.</p>
      {adminUsersError && <><p className="admin-image-error" role="alert">{adminUsersError}</p><button className="admin-secondary-button" type="button" disabled={adminUsersLoading} onClick={() => void refreshAdminUsers()}>Retry loading admins</button></>}
      {adminUsersLoading ? <p>Loading admin users...</p> : adminUsers.length ? <div className="admin-admin-list">{adminUsers.map((admin) => <div className="admin-management-row" key={admin.id}><div><strong>{admin.name}</strong><span>{admin.email} · {admin.role}</span>{admin.phone && <span>{admin.phone}</span>}</div><StatusPill status={admin.status} /><div className="admin-admin-actions"><button className="admin-small-button" type="button" onClick={() => openPermissions(admin, "view-permissions")}>View Permissions</button><button className="admin-small-button" type="button" onClick={() => openPermissions(admin, "edit-permissions")}>Manage Access</button></div></div>)}</div> : <EmptyState title="No admin users found." message="Grant admin access to an existing customer account to get started." />}
      {adminModal && <div className="admin-modal-backdrop" onClick={() => { if (!adminUserSaving) setAdminModal(null); }}><div className="admin-modal admin-admin-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="admin-modal-close" disabled={adminUserSaving} onClick={() => setAdminModal(null)}><X size={17} /></button>{adminUsersError && <p className="admin-image-error" role="alert">{adminUsersError}</p>}
        {adminModal === "add" ? <><h2>Grant Admin Access</h2><form className="admin-form admin-admin-form" onSubmit={saveAdmin}>
          <label><span>Existing customer email</span><input required type="email" maxLength={254} value={adminForm.email} disabled={adminUserSaving} onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })} /></label>
          <label><span>Role</span><select value={adminForm.role} disabled={adminUserSaving} onChange={(event) => setAdminForm({ ...adminForm, role: event.target.value })}>{["Super Admin", "Admin", "Manager", "Staff"].map((role) => <option key={role}>{role}</option>)}</select></label>
          <label><span>Status</span><select value={adminForm.status} disabled={adminUserSaving} onChange={(event) => setAdminForm({ ...adminForm, status: event.target.value as "Active" | "Inactive" })}><option>Active</option><option>Inactive</option></select></label>
          <div className="admin-form-actions"><button className="admin-primary-button" type="submit" disabled={adminUserSaving}>{adminUserSaving ? "Saving..." : "Grant Access"}</button><button className="admin-secondary-button" type="button" disabled={adminUserSaving} onClick={() => setAdminModal(null)}>Cancel</button></div>
        </form></> : selectedAdmin && <><h2>{adminModal === "view-permissions" ? "Admin Permissions" : "Manage Admin Access"}</h2><p className="admin-permission-owner">{selectedAdmin.name} · {selectedAdmin.email}</p>
          {adminModal === "edit-permissions" && <div className="admin-form admin-admin-form"><label><span>Role</span><select value={adminEditRole} disabled={adminUserSaving} onChange={(event) => setAdminEditRole(event.target.value as AdminUser["role"])}>{["Super Admin", "Admin", "Manager", "Staff"].map((role) => <option key={role}>{role}</option>)}</select></label><label><span>Status</span><select value={adminEditStatus} disabled={adminUserSaving} onChange={(event) => setAdminEditStatus(event.target.value as AdminUser["status"])}><option>Active</option><option>Inactive</option></select></label></div>}
          <div className="admin-permission-table"><div className="admin-permission-row admin-permission-row--header"><strong>Permission</strong><strong>View</strong><strong>Edit</strong></div>{permissionSections.map(({ key, label }) => <div className="admin-permission-row" key={key}><span>{label}</span><input aria-label={`${label} view permission`} type="checkbox" checked={permissionDraft[key].view} disabled={adminModal === "view-permissions" || adminUserSaving} onChange={(event) => setPermissionDraft((current) => ({ ...current, [key]: { view: event.target.checked, edit: event.target.checked && current[key].edit } }))} /><input aria-label={`${label} edit permission`} type="checkbox" checked={permissionDraft[key].edit} disabled={adminModal === "view-permissions" || adminUserSaving} onChange={(event) => setPermissionDraft((current) => ({ ...current, [key]: { view: current[key].view || event.target.checked, edit: event.target.checked } }))} /></div>)}</div>
          {adminModal === "edit-permissions" && <div className="admin-form-actions"><button className="admin-primary-button" type="button" disabled={adminUserSaving} onClick={() => void savePermissions()}>{adminUserSaving ? "Saving..." : "Save Access"}</button><button className="admin-secondary-button" type="button" disabled={adminUserSaving} onClick={() => setAdminModal(null)}>Cancel</button></div>}
        </>}
      </div></div>}
    </AdminPanel>;
    return null;
  };

  return <div className={`admin-shell ${collapsed ? "admin-shell--collapsed" : ""}`}>
    <aside className={`admin-sidebar ${mobileOpen ? "admin-sidebar--open" : ""}`}>
      <div className="admin-brand"><div className="admin-brand-mark">T</div><div className="admin-brand-copy"><strong>TRIBULL</strong><span>Admin</span></div><button className="admin-icon-button admin-sidebar-close" type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <div className="admin-store-switcher"><div className="admin-store-icon"><Store size={17} /></div><div><strong>Tribull Store</strong><span>Online store</span></div><ChevronDown size={15} /></div>
      <nav className="admin-navigation" aria-label="Admin navigation">{navigation.map((section) => <div className="admin-nav-section" key={section.label}><p>{section.label}</p>{section.items.map(({ label, icon: NavIcon, screen: itemScreen }) => <button className={`admin-nav-item ${screen === itemScreen ? "admin-nav-item--active" : ""}`} type="button" key={`${section.label}-${label}`} onClick={() => navigate(itemScreen)} title={collapsed ? label : undefined}><NavIcon size={17} /><span>{label}</span></button>)}</div>)}</nav>
      <div className="admin-sidebar-help"><LifeBuoy size={18} /><div><strong>Need a hand?</strong><span>Visit help center</span></div><ChevronRight size={14} /></div><button className="admin-collapse-button" type="button" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}<span>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span></button>
    </aside>
    {mobileOpen && <button className="admin-drawer-overlay" type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <div className="admin-main-wrap">
      <header className="admin-topbar"><button className="admin-icon-button admin-mobile-menu" type="button" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><div className="admin-topbar-context"><span>Admin</span><ChevronRight size={14} /><strong>{activeNav?.label || "Dashboard"}</strong></div><label className="admin-search"><Search size={17} /><input aria-label="Search dashboard" placeholder="Search orders and products..." value={adminSearch} onChange={(event) => { setAdminSearch(event.target.value); setProductPage(1); setOrderPage(1); }} /><kbd>⌘ K</kbd></label><div className="admin-topbar-actions"><button className="admin-icon-button admin-notification-button" type="button" aria-label="Notifications"><Bell size={19} /><i /></button><div className="admin-profile-wrap"><button className="admin-profile-button" type="button" onClick={() => setProfileOpen(!profileOpen)}><span className="admin-avatar">MK</span><span className="admin-profile-name">Monika Manikandan</span><ChevronDown size={15} /></button>{profileOpen && <div className="admin-profile-menu"><strong>Monika Manikandan</strong><span>Store administrator</span><button type="button"><UserRound size={15} /> Account settings</button><button type="button"><LifeBuoy size={15} /> Help center</button></div>}</div></div></header>
      <main className="admin-content"><div className="admin-page-intro"><div><p className="admin-eyebrow">Tribull Store Admin</p><h1>{activeNav?.label || "Dashboard"}</h1><p>Manage your store, catalog, orders, and customers.</p></div>{screen === "dashboard" && <div className="admin-range-control"><SlidersHorizontal size={16} /><select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Dashboard date range"><option>Today</option><option>Yesterday</option><option>Last 7 days</option><option>Last 30 days</option></select><ChevronDown size={15} /></div>}</div>{renderScreen()}{screen === "products" && isProductEditorOpen && <div className="admin-modal-backdrop admin-product-edit-backdrop" onClick={closeProductEditor}><section className="admin-modal admin-product-edit-modal" role="dialog" aria-modal="true" aria-labelledby="admin-product-edit-title" onClick={(event) => event.stopPropagation()}><button type="button" className="admin-modal-close" aria-label="Close editor" onClick={closeProductEditor}><X size={17} /></button><h2 id="admin-product-edit-title">Edit Product</h2>{editProductLoading ? <p>Loading product...</p> : editProductError && !editingProduct ? <><p className="admin-image-error" role="alert">Unable to load product details. Please try again.</p><div className="admin-form-actions">{editingProductTarget && <button className="admin-primary-button" type="button" onClick={() => void editProduct(editingProductTarget)}>Retry</button>}<button className="admin-secondary-button" type="button" onClick={closeProductEditor}>Close</button></div></> : editingProduct && <AddProductForm productForm={editingProductForm} setProductForm={setEditingProductForm} hierarchy={categoryHierarchy} hierarchyLoading={categoryHierarchyLoading} hierarchyError={categoryHierarchyError} onSave={saveEditedProduct} onCancel={closeProductEditor} imageError={imageError} onImageChange={(event) => handleProductImageChange(event, setEditingProductForm)} savedNotice={editProductError} productSaving={productSaving} submitLabel="Save Changes" />}</section></div>}{selectedProduct && <div className="admin-modal-backdrop" onClick={() => setSelectedProduct(null)}><div className="admin-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="admin-modal-close" onClick={() => setSelectedProduct(null)}><X size={17} /></button><img src={selectedProduct.image} alt={selectedProduct.name} /><h2>{selectedProduct.name}</h2><p>{selectedProduct.mainCategory && selectedProduct.subcategory ? `${selectedProduct.mainCategory} · ${selectedProduct.subcategory}` : selectedProduct.category} · ₹{selectedProduct.price.toLocaleString("en-IN")}</p><StatusPill status={selectedProduct.stock < 10 ? "Low stock" : selectedProduct.status} />{selectedProduct.mainCategoryId && <div className="admin-form"><label><span>Main Category</span><select disabled={categoryHierarchyLoading || Boolean(categoryHierarchyError)} value={editingProductCategory} onChange={(event) => { const value = event.target.value; setEditingProductCategory(value); setEditingProductSubcategory(categoryHierarchy.subcategories[value]?.[0]?.value || ""); }}>{categoryHierarchy.main.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label><span>Subcategory / Industry</span><select disabled={categoryHierarchyLoading || Boolean(categoryHierarchyError)} value={editingProductSubcategory} onChange={(event) => setEditingProductSubcategory(event.target.value)}>{(categoryHierarchy.subcategories[editingProductCategory] || []).map((subcategory) => <option key={subcategory.value} value={subcategory.value}>{subcategory.label}</option>)}</select></label>{(productUpdateError || categoryHierarchyError) && <p className="admin-image-error" role="alert">{productUpdateError || categoryHierarchyError}</p>}<div className="admin-form-actions"><button type="button" className="admin-primary-button" disabled={categoryHierarchyLoading || Boolean(categoryHierarchyError)} onClick={() => void saveProductCategory()}>Save Category</button></div></div>}</div></div>}{selectedOrder && <div className="admin-modal-backdrop" onClick={() => setSelectedOrder(null)}><div className="admin-modal admin-order-detail-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="admin-modal-close" onClick={() => setSelectedOrder(null)}><X size={17} /></button><h2>{selectedOrder.id}</h2><p><strong>{selectedOrder.customer.name}</strong><br />{selectedOrder.customer.email} · {selectedOrder.customer.phone}</p><p>{selectedOrder.shippingAddress.address}, {selectedOrder.shippingAddress.apartment}, {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.pinCode}, {selectedOrder.shippingAddress.country}</p><div className="admin-order-detail-items">{selectedOrder.items.map((item) => <div key={item.id} className="admin-order-detail-item"><img src={item.image} alt={item.name} /><span><strong>{item.name}</strong><small>{item.variant || "Standard"} · {item.quantity} × ₹{item.price.toLocaleString("en-IN")}</small></span><strong>₹{item.lineTotal.toLocaleString("en-IN")}</strong></div>)}</div><p>Subtotal: ₹{selectedOrder.subtotal.toLocaleString("en-IN")}<br />Shipping: ₹{selectedOrder.shipping.toLocaleString("en-IN")}<br />Discount: ₹{selectedOrder.discount.toLocaleString("en-IN")}<br /><strong>Total: ₹{selectedOrder.total.toLocaleString("en-IN")}</strong></p><p>Payment: {selectedOrder.payment.method} ({selectedOrder.payment.status})</p><label>Order status<select value={selectedOrder.status} onChange={(event) => void updateOrder(selectedOrder.id, event.target.value as OrderStatus)}><option>Pending</option><option>Processing</option><option>Shipped</option><option>Delivered</option><option>Cancelled</option></select></label><StatusPill status={selectedOrder.status} /><p>{new Date(selectedOrder.createdAt).toLocaleString("en-IN")}</p></div></div>}<footer className="admin-footer"><span><strong>TRIBULL</strong> <em>© 2026 Tribull Store</em></span><div><a href="#admin-help">Help</a><a href="#admin-privacy">Privacy</a><span>Admin Dashboard · v1.0.0</span></div></footer></main>
    </div>
  </div>;
}
