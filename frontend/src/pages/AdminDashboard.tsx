import {
  Activity, AlertTriangle, Archive, BarChart3, Bell, Box, Boxes, ChevronDown, ChevronRight,
  ClipboardList, DollarSign, FileText, Gift, Globe2, Image, LayoutDashboard,
  LifeBuoy, Menu, MoreHorizontal, PackageCheck, PackageOpen, PanelLeftClose, PanelLeftOpen,
  Percent, Plus, Search, Settings, ShoppingBag, SlidersHorizontal, Store, Tag, Truck,
  UserRound, Users, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { products as storeProducts, type Product } from "./ProductsPage";
import { useLocation } from "wouter";
import { apiFetch } from "../lib/api";
import { createCategory, createSubcategory, defaultCategoryHierarchy, deleteCategory, deleteSubcategory as deleteSubcategoryApi, loadCategoryHierarchy, saveCategoryHierarchy, updateCategory, updateSubcategory, type CategoryHierarchy } from "../lib/categoryHierarchy";
import { deleteBanner, loadBanners, saveBanner, updateBanner, type CategoryBanner } from "../lib/categoryBanners";
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
  name: string;
  description: string;
  price: number;
  compareAt: number | null;
  image: string;
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
type AdminOrder = { id: string; customer: { name: string; email: string; phone: string }; shippingAddress: { address: string; apartment: string; city: string; state: string; pinCode: string; country: string }; items: AdminOrderItem[]; subtotal: number; shipping: number; discount: number; total: number; payment: { method: string; status: string }; status: OrderStatus; createdAt: string };
type PermissionKey = "dashboard" | "products" | "orders" | "customers" | "marketing" | "content" | "analytics" | "settings";
type AdminPermissions = Record<PermissionKey, { view: boolean; edit: boolean }>;
type AdminUser = { id: string; name: string; email: string; phone: string; role: string; status: "Active" | "Inactive"; permissions: AdminPermissions };
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

function readStorage<T>(key: string, fallback: T): T { try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function StatusPill({ status }: { status: string }) { return <span className={`admin-status admin-status--${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>; }
function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <div className="admin-section-heading"><h2>{title}</h2>{action && <button className="admin-text-button" type="button" onClick={onAction}>{action}<ChevronRight size={15} /></button>}</div>; }
function EmptyState({ title, message, action, onAction }: { title: string; message: string; action?: string; onAction?: () => void }) { return <div className="admin-empty-state"><div className="admin-empty-state__icon"><Box size={20} /></div><strong>{title}</strong><span>{message}</span>{action && <button type="button" className="admin-primary-button" onClick={onAction}>{action}</button>}</div>; }

function ProductTable({ products, onSelect, onEdit, alignActionsRight = false }: { products: AdminProduct[]; onSelect?: (product: AdminProduct) => void; onEdit?: (product: AdminProduct) => void; alignActionsRight?: boolean }) {
  return <div className="admin-table-scroll"><table className={`admin-table${alignActionsRight ? " admin-products-table" : ""}`}><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th className="admin-table-actions-heading">Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id} onClick={() => onSelect?.(product)}><td><div className="admin-product-name"><img className="admin-real-product-thumb" src={product.image} alt="" /><strong>{product.name}</strong></div></td><td>{product.mainCategory && product.subcategory ? `${product.mainCategory} · ${product.subcategory}` : product.category}</td><td><strong>₹{product.price.toLocaleString("en-IN")}</strong></td><td>{product.stock}</td><td><StatusPill status={product.stock === 0 ? "Out of stock" : product.stock < 10 ? "Low stock" : product.status} /></td><td className="admin-table-actions"><div><button className="admin-small-button" type="button" onClick={(event) => { event.stopPropagation(); onSelect?.(product); }}>View</button>{onEdit && product.databaseProduct && <button className="admin-small-button" type="button" onClick={(event) => { event.stopPropagation(); onEdit(product); }}>Edit</button>}</div></td></tr>)}</tbody></table></div>;
}
function OrderTable({ orders, onSelect }: { orders: AdminOrder[]; onSelect: (order: AdminOrder) => void }) { return orders.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Order ID</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th /></tr></thead><tbody>{orders.map((order) => <tr key={order.id} onClick={() => onSelect(order)}><td><strong className="admin-order-id">{order.id}</strong></td><td><strong>{order.customer.name}</strong><br /><span>{order.customer.email}</span></td><td>{new Date(order.createdAt).toLocaleString("en-IN")}</td><td>{order.items.reduce((count, item) => count + item.quantity, 0)}</td><td><strong>₹{order.total.toLocaleString("en-IN")}</strong></td><td>{order.payment.status}</td><td><StatusPill status={order.status} /></td><td><button className="admin-more-button" type="button" onClick={(event) => { event.stopPropagation(); onSelect(order); }}><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="No orders found." message="Orders will appear here when customers place an order." />; }
function AdminPanel({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) { return <section className="admin-panel admin-workspace-panel"><SectionHeading title={title} action={action} onAction={onAction} />{children}</section>; }

type ProductFormState = { name: string; description: string; price: string; compareAt: string; category: string; subcategory: string; image: string; stock: string; sizes: string; colors: string; status: string };
function AddProductForm({ productForm, setProductForm, hierarchy, hierarchyLoading, hierarchyError, onSave, onCancel, imageError, onImageChange, savedNotice, productSaving, submitLabel = "Save Product" }: { productForm: ProductFormState; setProductForm: React.Dispatch<React.SetStateAction<ProductFormState>>; hierarchy: CategoryHierarchy; hierarchyLoading: boolean; hierarchyError: string; onSave: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>; onCancel: () => void; imageError: string; onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void; savedNotice: string; productSaving: boolean; submitLabel?: string }) {
  const subcategories = hierarchy.subcategories[productForm.category] || [];
  const updateCategory = (category: string) => setProductForm((current) => ({ ...current, category, subcategory: "" }));
  return <form className="admin-form" onSubmit={onSave}>
    <label><span>Product name</span><input required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
    <label><span>Description</span><textarea value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
    <label><span>Price</span><input required type="number" min="0" step="any" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></label>
    <label><span>Compare-at price</span><input type="number" min="0" step="any" value={productForm.compareAt} onChange={(event) => setProductForm({ ...productForm, compareAt: event.target.value })} /></label>
    <div className="admin-product-image-field"><span>Image</span>{productForm.image ? <div className="admin-product-image-upload admin-product-image-upload--preview"><img src={productForm.image} alt="Product preview" /><div className="admin-product-image-actions"><label className="admin-secondary-button">Change Image<input className="admin-product-image-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={onImageChange} /></label><button className="admin-secondary-button" type="button" onClick={() => setProductForm({ ...productForm, image: "" })}>Remove Image</button></div></div> : <div className="admin-product-image-upload"><Image size={22} /><strong>Upload Product Image</strong><label className="admin-primary-button">Choose Image<input className="admin-product-image-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={onImageChange} /></label><small>JPG, PNG, WEBP supported</small></div>}{imageError && <small className="admin-image-error">{imageError}</small>}</div>
    <label><span>Stock</span><input type="number" min="0" step="1" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} /></label>
    <label><span>Sizes</span><input value={productForm.sizes} onChange={(event) => setProductForm({ ...productForm, sizes: event.target.value })} /></label>
    <label><span>Colors</span><input value={productForm.colors} onChange={(event) => setProductForm({ ...productForm, colors: event.target.value })} /></label>
    <label><span>Main Category</span><select required disabled={hierarchyLoading || Boolean(hierarchyError) || hierarchy.main.length === 0} value={productForm.category} onChange={(event) => updateCategory(event.target.value)}>{hierarchy.main.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
    <label><span>Subcategory / Industry</span><select required disabled={hierarchyLoading || Boolean(hierarchyError) || !subcategories.length} value={productForm.subcategory} onChange={(event) => setProductForm({ ...productForm, subcategory: event.target.value })}>{subcategories.length ? <><option value="">Select subcategory</option>{subcategories.map((subcategory) => <option key={subcategory.value} value={subcategory.value}>{subcategory.label}</option>)}</> : <option value="">No subcategories available</option>}</select></label>
    <label><span>Status</span><select value={productForm.status} onChange={(event) => setProductForm({ ...productForm, status: event.target.value })}><option>Active</option><option>Draft</option></select></label>
    {hierarchyError && <p className="admin-image-error" role="alert">{hierarchyError}</p>}
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

function CategoryManagement({ productCategories, setProductCategories, hierarchy, setHierarchy, hierarchyLoading, hierarchyError, newCategory, setNewCategory, addCategory }: { productCategories: ProductTypeCategory[]; setProductCategories: React.Dispatch<React.SetStateAction<ProductTypeCategory[]>>; hierarchy: CategoryHierarchy; setHierarchy: React.Dispatch<React.SetStateAction<CategoryHierarchy>>; hierarchyLoading: boolean; hierarchyError: string; newCategory: string; setNewCategory: React.Dispatch<React.SetStateAction<string>>; addCategory: (image?: string) => void }) {
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
  const refreshHierarchy = async () => {
    const next = await loadCategoryHierarchy();
    setHierarchy(next);
    window.dispatchEvent(new Event("tribull-category-hierarchy-updated"));
    return next;
  };
  const saveHierarchy = async (next: CategoryHierarchy) => { try { if (!await saveCategoryHierarchy(next)) throw new Error("Category save failed"); return await refreshHierarchy(); } catch { setCategoryError("Could not save category changes. Please try again."); return undefined; } };
  const addMainCategory = async () => { setCategoryError(""); const label = newMainCategory.trim(); if (!label) { setCategoryError("Category name is required."); return; } if (hierarchy.main.some((item) => item.label.toLowerCase() === label.toLowerCase())) return; const value = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); if (!value || hierarchy.main.some((item) => item.value === value)) return; try { await createCategory({ value, label, image: newMainImage }); await refreshHierarchy(); setNewMainCategory(""); setNewMainImage(""); if (newMainImageInputRef.current) newMainImageInputRef.current.value = ""; setParentCategory(value); } catch { setCategoryError("Could not add category. Please try again."); } };
  const deleteMainCategory = async (value: string) => { setCategoryError(""); try { await deleteCategory(value); const next = await refreshHierarchy(); if (parentCategory === value) setParentCategory(next.main[0]?.value || ""); } catch { setCategoryError("Could not delete category. Please try again."); } };
  const saveMainEdit = async () => { setCategoryError(""); if (!editingMain) return; const label = editingMainName.trim(); if (!label || hierarchy.main.some((item) => item.value !== editingMain && item.label.toLowerCase() === label.toLowerCase())) return; try { await updateCategory(editingMain, { label, image: editingMainImage }); await refreshHierarchy(); setEditingMain(null); } catch { setCategoryError("Could not update category. Please try again."); } };
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
      setCategoryError(error instanceof Error && /duplicate/i.test(error.message)
        ? "Subcategory already exists for this category."
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
    try { await deleteSubcategoryApi(parent, value); await refreshHierarchy(); } catch { setCategoryError("Could not delete subcategory. Please try again."); }
  };
  const saveSubcategoryEdit = async () => { setCategoryError(""); if (!editingSubcategory) return; const label = editingSubcategoryName.trim(); if (!label) return; const targetItems = hierarchy.subcategories[editingSubcategoryParent] || []; if (targetItems.some((item) => item.value !== editingSubcategory.value && item.label.toLowerCase() === label.toLowerCase())) return; try { if (editingSubcategoryParent === editingSubcategory.parent) { await updateSubcategory(editingSubcategory.parent, editingSubcategory.value, { label, image: editingSubcategoryImage }); await refreshHierarchy(); } else { const withoutCurrent = (hierarchy.subcategories[editingSubcategory.parent] || []).filter((item) => item.value !== editingSubcategory.value); const current = hierarchy.subcategories[editingSubcategory.parent]?.find((item) => item.value === editingSubcategory.value); if (!await saveHierarchy({ ...hierarchy, subcategories: { ...hierarchy.subcategories, [editingSubcategory.parent]: withoutCurrent, [editingSubcategoryParent]: [...targetItems.filter((item) => item.value !== editingSubcategory.value), { ...(current || { value: editingSubcategory.value }), label, image: editingSubcategoryImage }] } })) return; } setEditingSubcategory(null); setEditingSubcategoryName(""); } catch { setCategoryError("Could not update subcategory. Please try again."); } };
  const saveProductTypeImage = (label: string, image: string) => setProductCategories((current) => current.map((item) => item.label === label ? { ...item, image } : item));
  const mainCategoryForm = <div className="admin-inline-form admin-main-category-form"><input value={newMainCategory} placeholder="New category name" onChange={(event) => setNewMainCategory(event.target.value)} /><CategoryImage image={newMainImage} inputRef={newMainImageInputRef} onChange={(event) => readImage(event, setNewMainImage)} onRemove={() => { setNewMainImage(""); if (newMainImageInputRef.current) newMainImageInputRef.current.value = ""; }} /><button className="admin-primary-button" type="button" onClick={addMainCategory}><Plus size={15} />Add category</button></div>;
  return <>
    {categoryError && <p className="admin-image-error">{categoryError}</p>}
    {mainCategoryForm}
    <section className="admin-category-management"><SectionHeading title="Main Categories" /><div className="admin-category-list">{hierarchyLoading ? <span className="admin-empty-state">Loading categories...</span> : hierarchyError ? <span className="admin-empty-state">Unable to load categories. Please try again.</span> : hierarchy.main.length === 0 ? <span className="admin-empty-state">No categories found.</span> : hierarchy.main.map((category) => <div className="admin-management-row" key={category.value}><CategoryImage image={editingMain === category.value ? editingMainImage : category.image} onChange={(event) => readImage(event, editingMain === category.value ? setEditingMainImage : (image) => saveHierarchy({ ...hierarchy, main: hierarchy.main.map((item) => item.value === category.value ? { ...item, image } : item) }))} onRemove={() => editingMain === category.value ? setEditingMainImage("") : saveHierarchy({ ...hierarchy, main: hierarchy.main.map((item) => item.value === category.value ? { ...item, image: "" } : item) })} />{editingMain === category.value ? <input className="admin-subcategory-edit-input" value={editingMainName} onChange={(event) => setEditingMainName(event.target.value)} /> : <strong>{category.label}</strong>}{editingMain === category.value ? <><button type="button" className="admin-small-button" onClick={saveMainEdit}>Save</button><button type="button" className="admin-small-button" onClick={() => setEditingMain(null)}>Cancel</button></> : <><button type="button" className="admin-small-button" onClick={() => { setEditingMain(category.value); setEditingMainName(category.label); setEditingMainImage(category.image || ""); }}>Edit</button><button type="button" className="admin-small-button" onClick={() => deleteMainCategory(category.value)}>Delete</button></>}</div>)}</div></section>
    <section className="admin-category-management"><SectionHeading title="Subcategories / Industries" /><div className="admin-inline-form admin-category-form"><select value={parentCategory} onChange={(event) => setParentCategory(event.target.value)}>{hierarchy.main.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select><input value={newSubcategory} placeholder="New subcategory name" onChange={(event) => setNewSubcategory(event.target.value)} /><CategoryImage image={newSubcategoryImage} inputRef={newSubcategoryImageInputRef} onChange={(event) => readImage(event, setNewSubcategoryImage)} onRemove={() => { setNewSubcategoryImage(""); if (newSubcategoryImageInputRef.current) newSubcategoryImageInputRef.current.value = ""; }} /><button className="admin-primary-button" type="button" onClick={addSubcategory}><Plus size={15} />Add subcategory</button></div><div className="admin-subcategory-list">{hierarchyLoading ? <span className="admin-empty-state">Loading categories...</span> : hierarchyError ? <span className="admin-empty-state">Unable to load categories. Please try again.</span> : hierarchy.main.length === 0 ? <span className="admin-empty-state">No categories found.</span> : (hierarchy.subcategories[parentCategory] || []).length === 0 ? <span className="admin-empty-state">No subcategories found.</span> : (hierarchy.subcategories[parentCategory] || []).map((subcategory) => { const parent = hierarchy.main.find((category) => category.value === parentCategory); const isEditing = editingSubcategory?.parent === parentCategory && editingSubcategory.value === subcategory.value; return <div className={`admin-subcategory-row ${isEditing ? "admin-subcategory-row--editing" : ""}`} key={`${parentCategory}-${subcategory.value}`}>{isEditing ? <><CategoryImage image={editingSubcategoryImage} onChange={(event) => readImage(event, setEditingSubcategoryImage)} onRemove={() => setEditingSubcategoryImage("")} showControls={false} /><select className="admin-category-edit-select" value={editingSubcategoryParent} onChange={(event) => setEditingSubcategoryParent(event.target.value)}>{hierarchy.main.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select><input className="admin-subcategory-edit-input" value={editingSubcategoryName} onChange={(event) => setEditingSubcategoryName(event.target.value)} /><label className="admin-small-button admin-subcategory-upload-button">Upload<input className="admin-product-image-input" type="file" accept="image/*" onChange={(event) => readImage(event, setEditingSubcategoryImage)} /></label><button type="button" className="admin-small-button" onClick={saveSubcategoryEdit}>Save</button><button type="button" className="admin-small-button" onClick={() => setEditingSubcategory(null)}>Cancel</button></> : <><strong>{parent?.label}</strong><CategoryImage image={subcategory.image} onChange={(event) => readImage(event, (image) => saveHierarchy({ ...hierarchy, subcategories: { ...hierarchy.subcategories, [parentCategory]: (hierarchy.subcategories[parentCategory] || []).map((item) => item.value === subcategory.value ? { ...item, image } : item) } }))} onRemove={() => saveHierarchy({ ...hierarchy, subcategories: { ...hierarchy.subcategories, [parentCategory]: (hierarchy.subcategories[parentCategory] || []).map((item) => item.value === subcategory.value ? { ...item, image: "" } : item) } })} /><span>{subcategory.label}</span><button type="button" className="admin-small-button" onClick={() => { setEditingSubcategory({ parent: parentCategory, value: subcategory.value }); setEditingSubcategoryParent(parentCategory); setEditingSubcategoryName(subcategory.label); setEditingSubcategoryImage(subcategory.image || ""); }}>Edit</button><button type="button" className="admin-small-button" onClick={() => deleteSubcategory(parentCategory, subcategory.value)}>Delete</button></>}</div>})}</div></section>
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
  const [categoryId, setCategoryId] = useState("");
  const [image, setImage] = useState("");
  const [editing, setEditing] = useState<CategoryBanner | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setBanners(await loadBanners());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load banners.");
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
      {loading ? <p>Loading banners...</p> : banners.length ? banners.map((banner) => <div className="admin-banner-row" key={banner.id}>
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
  const [range, setRange] = useState("Today");
  const [screen, setScreen] = useState(initialScreen);
  const [, setLocation] = useLocation();
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);
  const [isProductEditorOpen, setIsProductEditorOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoredProduct | null>(null);
  const [editingProductTarget, setEditingProductTarget] = useState<AdminProduct | null>(null);
  const [editingProductForm, setEditingProductForm] = useState<ProductFormState>({ name: "", description: "", price: "", compareAt: "", category: "", subcategory: "", image: "", stock: "", sizes: "", colors: "", status: "Active" });
  const [editingProductCategory, setEditingProductCategory] = useState("");
  const [editingProductSubcategory, setEditingProductSubcategory] = useState("");
  const [productUpdateError, setProductUpdateError] = useState("");
  const [databaseProducts, setDatabaseProducts] = useState<StoredProduct[]>([]);
  const [productsError, setProductsError] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [categories, setCategories] = useState<ProductTypeCategory[]>(defaultProductTypeCategories);
  const [categoryHierarchy, setCategoryHierarchy] = useState<CategoryHierarchy>({ main: [], subcategories: {} });
  const [categoryHierarchyLoading, setCategoryHierarchyLoading] = useState(true);
  const [categoryHierarchyError, setCategoryHierarchyError] = useState("");
  const [featured, setFeatured] = useState<string[]>(() => readStorage("tribull-admin-featured", []));
  const [newCategory, setNewCategory] = useState("");
  const [productForm, setProductForm] = useState<ProductFormState>({ name: "", description: "", price: "", compareAt: "", category: "", subcategory: "", image: "", stock: "", sizes: "S, M, L, XL", colors: "Black", status: "Active" });
  const [editProductLoading, setEditProductLoading] = useState(initialScreen === "edit-product");
  const [editProductError, setEditProductError] = useState("");
  const editProductRequest = useRef<AbortController | null>(null);
  useEffect(() => { setScreen(initialScreen); }, [initialScreen]);
  useEffect(() => {
    if (!productId) return;
    let active = true;
    setEditProductLoading(true);
    setEditProductError("");
    void apiFetch(`/api/products/${encodeURIComponent(productId)}`, { cache: "no-store" })
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
  }, []);
  const refreshProducts = async () => {
    setProductsLoading(true);
    setProductsError("");
    try {
      const response = await apiFetch("/api/products", { cache: "no-store" });
      if (!response.ok) throw new Error("Product request failed");
      setDatabaseProducts(await response.json() as StoredProduct[]);
    } catch {
      setProductsError("Unable to load saved products. Please try again.");
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
  const [savedNotice, setSavedNotice] = useState("");
  const [productSaving, setProductSaving] = useState(false);
  const [imageError, setImageError] = useState("");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(() => readStorage("tribull-admin-users", [{ id: "admin-monika", name: "Monika Manikandan", email: "", phone: "", role: "Super Admin", status: "Active", permissions: rolePermissions("Super Admin") }]));
  const [adminModal, setAdminModal] = useState<"add" | "view-permissions" | "edit-permissions" | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [adminForm, setAdminForm] = useState({ name: "", email: "", phone: "", role: "Admin", status: "Active" as "Active" | "Inactive" });
  const [permissionDraft, setPermissionDraft] = useState<AdminPermissions>(rolePermissions("Admin"));
  const [socialLinks, setSocialLinks] = useState(() => readStorage("tribull-social-links", { facebook: "", instagram: "", youtube: "", x: "", reddit: "" }));
  const [socialNotice, setSocialNotice] = useState("");
  const adminProducts = useMemo<AdminProduct[]>(() => [
    ...storeProducts.map((product, index) => ({ ...product, stock: [42, 18, 7, 0][index % 4], status: "Active" as const, sku: `TRB-${String(index + 1).padStart(3, "0")}` })),
    ...databaseProducts.map((product) => ({
      id: product.id,
      name: product.name,
      category: `${product.mainCategory} / ${product.subcategory}`,
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
    })),
  ], [databaseProducts]);
  const databaseAdminProducts = useMemo<AdminProduct[]>(() => databaseProducts.map((product) => ({
    id: product.id,
    name: product.name,
    category: `${product.mainCategory} / ${product.subcategory}`,
    price: product.price,
    image: product.image,
    created: Date.parse(product.createdAt) || 0,
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
  const customers = [{ name: "Aarav Mehta", email: "aarav.m@example.com", phone: "Not available", orders: 8, spent: "₹7,192", status: "Returning" }, { name: "Nisha Kapoor", email: "nisha.k@example.com", phone: "Not available", orders: 3, spent: "₹2,697", status: "Returning" }, { name: "Rohan Shah", email: "rohan.s@example.com", phone: "Not available", orders: 1, spent: "₹899", status: "New" }];
  const activeNav = navigation.flatMap((section) => section.items).find((item) => item.screen === screen) || (screen === "edit-product" ? navigation.flatMap((section) => section.items).find((item) => item.screen === "products") : undefined);
  const filteredOrders = screen.startsWith("orders-") ? orders.filter((order) => order.status.toLowerCase() === screen.replace("orders-", "")) : orders;
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
  const navigate = (nextScreen: string) => { setScreen(nextScreen); setLocation(adminRoutes[nextScreen] || "/admin26"); setMobileOpen(false); setSelectedProduct(null); setSelectedOrder(null); };
  const saveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const price = Number(productForm.price);
    if (!productForm.price.trim() || !Number.isFinite(price) || price < 0) {
      setSavedNotice("Price must be a valid number greater than or equal to 0.");
      return;
    }
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
        setProductForm((current) => ({ ...current, name: "", description: "", price: "", compareAt: "", image: "", stock: "", sizes: "S, M, L, XL", colors: "Black", status: "Active" }));
        window.setTimeout(() => setSavedNotice(""), 2500);
      }
      setImageError("");
    } catch (error) {
      setSavedNotice(error instanceof Error ? error.message : "Unable to save product. Please try again.");
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
    editProductRequest.current?.abort();
    const request = new AbortController();
    editProductRequest.current = request;
    setSelectedProduct(null);
    setIsProductEditorOpen(true);
    setEditingProductTarget(product);
    setEditingProduct(null);
    setEditProductLoading(true);
    setEditProductError("");
    const productId = product.id;
    if (!product.databaseProduct || !productId.trim()) {
      setEditProductError("Unable to load product details. Please try again.");
      setEditProductLoading(false);
      return;
    }
    const url = `/api/products/${encodeURIComponent(productId)}`;
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
  const closeProductEditor = () => {
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
    if (!editingProduct) return;
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
      const updatedProduct = await response.json() as StoredProduct;
      setDatabaseProducts((current) => current.map((item) => item.id === updatedProduct.id ? updatedProduct : item));
      closeProductEditor();
    } catch (error) {
      setEditProductError(error instanceof Error ? error.message : "Unable to update product. Please try again.");
    } finally {
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
  const toggleFeatured = (id: string) => setFeatured((current) => { const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; window.localStorage.setItem("tribull-admin-featured", JSON.stringify(next)); return next; });
  const saveAdminUsers = (nextUsers: AdminUser[]) => { setAdminUsers(nextUsers); window.localStorage.setItem("tribull-admin-users", JSON.stringify(nextUsers)); };
  const openPermissions = (admin: AdminUser, mode: "view-permissions" | "edit-permissions") => { setSelectedAdmin(admin); setPermissionDraft(admin.permissions); setAdminModal(mode); };
  const saveAdmin = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const admin: AdminUser = { id: `admin-${Date.now()}`, ...adminForm, permissions: rolePermissions(adminForm.role) }; saveAdminUsers([...adminUsers, admin]); setAdminForm({ name: "", email: "", phone: "", role: "Admin", status: "Active" }); setAdminModal(null); setSavedNotice("Admin added successfully."); window.setTimeout(() => setSavedNotice(""), 2500); };
  const savePermissions = () => { if (!selectedAdmin) return; const nextUsers = adminUsers.map((admin) => admin.id === selectedAdmin.id ? { ...admin, permissions: permissionDraft } : admin); saveAdminUsers(nextUsers); setSelectedAdmin(nextUsers.find((admin) => admin.id === selectedAdmin.id) || null); setAdminModal("view-permissions"); setSavedNotice("Permissions updated successfully."); window.setTimeout(() => setSavedNotice(""), 2500); };
  const saveSocialLinks = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); window.localStorage.setItem("tribull-social-links", JSON.stringify(socialLinks)); window.dispatchEvent(new Event("tribull-social-links-updated")); setSocialNotice("Social links updated successfully."); window.setTimeout(() => setSocialNotice(""), 2500); };

  const renderScreen = () => {
    if (screen === "dashboard") return <><section className="admin-stats-grid">{[["Total Sales", "₹0.00", "No sales recorded", DollarSign], ["Total Orders", String(orders.length), "Current order count", ClipboardList], ["Total Products", String(adminProducts.length), "From store catalog", ShoppingBag], ["Total Customers", String(customers.length), "Registered customers", Users], ["Pending Orders", String(orders.filter((order) => order.status === "Pending").length), "Needs attention", PackageOpen], ["Low Stock Products", String(adminProducts.filter((product) => product.stock < 10).length), "Needs your attention", AlertTriangle]].map(([label, value, note, StatIcon]) => { const IconComponent = StatIcon as Icon; return <div className="admin-stat-card" key={label as string}><div className="admin-stat-icon admin-stat-icon--teal"><IconComponent size={19} /></div><div className="admin-stat-label">{label as string}</div><strong>{value as string}</strong><span>{note as string}</span></div>; })}</section><section className="admin-panel"><SectionHeading title="Recent Orders" action="View all orders" onAction={() => navigate("orders")} /><OrderTable orders={orders.slice(0, 5)} onSelect={setSelectedOrder} /></section><div className="admin-two-column"><section className="admin-panel"><SectionHeading title="Best Selling Products" action="View products" onAction={() => navigate("products")} /><ProductTable products={adminProducts.slice(0, 5)} onSelect={openProduct} /></section><section className="admin-panel"><SectionHeading title="Low Stock Products" action="View inventory" onAction={() => navigate("inventory")} />{adminProducts.filter((product) => product.stock < 10).map((product) => <div className="admin-low-stock-row" key={product.id}><img className="admin-real-product-thumb" src={product.image} alt="" /><div><strong>{product.name}</strong><span>{product.sku}</span></div><div className="admin-stock-count"><strong>{product.stock}</strong><span>units left</span></div></div>)}</section></div></>;
    if (screen === "products") return <AdminPanel title="All Products" action="Add Product" onAction={() => navigate("add-product")}>{productsError ? <EmptyState title="Unable to load saved products" message={productsError} action="Retry" onAction={() => void refreshProducts()} /> : productsLoading ? <p>Loading saved products...</p> : adminProducts.length ? <ProductTable products={adminProducts} onSelect={openProduct} onEdit={editProduct} alignActionsRight /> : <EmptyState title="No products found." message="Add a product to see it in your catalog." action="Add Product" onAction={() => navigate("add-product")} />}</AdminPanel>;
    if (screen === "banners") return <BannerManagement categories={categoryHierarchy.main} categoriesLoading={categoryHierarchyLoading} />;
    if (screen === "add-product") return <AdminPanel title="Add Product"><AddProductForm productForm={productForm} setProductForm={setProductForm} hierarchy={categoryHierarchy} hierarchyLoading={categoryHierarchyLoading} hierarchyError={categoryHierarchyError} onSave={saveProduct} onCancel={() => navigate("products")} imageError={imageError} onImageChange={handleProductImageChange} savedNotice={savedNotice} productSaving={productSaving} /></AdminPanel>;
    if (screen === "edit-product") return <AdminPanel title="Edit Product">{editProductLoading ? <p>Loading product...</p> : editProductError ? <><p className="admin-image-error" role="alert">{editProductError}</p><button className="admin-secondary-button" type="button" onClick={() => navigate("products")}>Back to Products</button></> : <AddProductForm productForm={productForm} setProductForm={setProductForm} hierarchy={categoryHierarchy} hierarchyLoading={categoryHierarchyLoading} hierarchyError={categoryHierarchyError} onSave={saveProduct} onCancel={() => navigate("products")} imageError={imageError} onImageChange={handleProductImageChange} savedNotice={savedNotice} productSaving={productSaving} submitLabel="Save Changes" />}</AdminPanel>;
    if (screen === "categories") return <AdminPanel title="Categories"><CategoryManagement productCategories={categories} setProductCategories={setCategories} hierarchy={categoryHierarchy} setHierarchy={setCategoryHierarchy} hierarchyLoading={categoryHierarchyLoading} hierarchyError={categoryHierarchyError} newCategory={newCategory} setNewCategory={setNewCategory} addCategory={addCategory} /></AdminPanel>;
    if (screen === "add-product") return <AdminPanel title="Add Product"><form className="admin-form" onSubmit={saveProduct}>{["name", "description", "price", "compareAt", "stock", "sizes", "colors"].map((field) => <label key={field}><span>{field === "compareAt" ? "Compare-at price" : field.charAt(0).toUpperCase() + field.slice(1)}</span>{field === "description" ? <textarea value={productForm[field as keyof typeof productForm]} onChange={(event) => setProductForm({ ...productForm, [field]: event.target.value })} /> : <input required={field === "name" || field === "price"} value={productForm[field as keyof typeof productForm]} onChange={(event) => setProductForm({ ...productForm, [field]: event.target.value })} />}</label>)}<label className="admin-product-image-field"><span>Image</span>{productForm.image ? <div className="admin-product-image-upload admin-product-image-upload--preview"><img src={productForm.image} alt="Product preview" /><div className="admin-product-image-actions"><label className="admin-secondary-button">Change Image<input className="admin-product-image-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={handleProductImageChange} /></label><button className="admin-secondary-button" type="button" onClick={() => { setProductForm((current) => ({ ...current, image: "" })); setImageError(""); }}>Remove Image</button></div></div> : <div className="admin-product-image-upload"><Image size={22} /><strong>Upload Product Image</strong><label className="admin-primary-button">Choose Image<input className="admin-product-image-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={handleProductImageChange} /></label><small>JPG, PNG, WEBP supported</small></div>}{imageError && <small className="admin-image-error">{imageError}</small>}</label><label><span>Category</span><select value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}>{categories.map((category) => <option key={category.label} value={category.label}>{category.label}</option>)}</select></label><label><span>Status</span><select value={productForm.status} onChange={(event) => setProductForm({ ...productForm, status: event.target.value })}><option>Active</option><option>Draft</option></select></label><div className="admin-form-actions"><button className="admin-primary-button" type="submit">Save Product</button><button className="admin-secondary-button" type="button" onClick={() => navigate("products")}>Cancel</button></div>{savedNotice && <p className="admin-form-success">{savedNotice}</p>}</form></AdminPanel>;
    if (screen === "categories") return <AdminPanel title="Categories"><div className="admin-inline-form"><input value={newCategory} placeholder="New category name" onChange={(event) => setNewCategory(event.target.value)} /><button className="admin-primary-button" type="button" onClick={() => addCategory()}><Plus size={15} />Add category</button></div><div className="admin-chip-list">{categories.map((category) => <div className="admin-management-row" key={category.label}><strong>{category.label}</strong><button type="button" className="admin-small-button" onClick={() => setCategories((current) => current.filter((item) => item.label !== category.label))}>Delete</button></div>)}</div></AdminPanel>;
    if (screen === "inventory") return <AdminPanel title="Inventory"><ProductTable products={adminProducts} /></AdminPanel>;
    if (screen.startsWith("orders")) return <AdminPanel title={activeNav?.label || "Orders"}>{ordersLoading ? <EmptyState title="Loading orders..." message="Fetching the latest orders." /> : ordersError ? <EmptyState title="Unable to load orders. Please try again." message={ordersError} action="Retry" onAction={() => void refreshOrders()} /> : <OrderTable orders={filteredOrders} onSelect={setSelectedOrder} />}</AdminPanel>;
    if (screen === "customers" || screen === "customer-details") return <AdminPanel title={screen === "customers" ? "Customers" : "Customer Details"}>{selectedCustomer ? <div className="admin-detail-card"><button type="button" className="admin-text-button" onClick={() => setSelectedCustomer(null)}>← All customers</button><div className="admin-detail-avatar">{selectedCustomer.split(" ").map((part) => part[0]).join("")}</div><h3>{selectedCustomer}</h3><p>{customers.find((customer) => customer.name === selectedCustomer)?.email}</p></div> : <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th>Orders</th><th>Total Spent</th><th>Status</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.email} onClick={() => setSelectedCustomer(customer.name)}><td><strong>{customer.name}</strong></td><td>{customer.phone}</td><td>{customer.email}</td><td>{customer.orders}</td><td><strong>{customer.spent}</strong></td><td><StatusPill status={customer.status} /></td></tr>)}</tbody></table></div>}</AdminPanel>;
    if (["discounts", "coupons", "promotions", "collections"].includes(screen)) return <AdminPanel title={activeNav?.label || "Management"}><EmptyState title={`No ${activeNav?.label?.toLowerCase() || "items"} created`} message={`Create your first ${activeNav?.label?.toLowerCase() || "item"} when the store is ready for backend integration.`} action="Create item" /></AdminPanel>;
    if (screen === "social-media") return <AdminPanel title="Social Media"><form className="admin-form admin-social-form" onSubmit={saveSocialLinks}>{([["facebook", "Facebook URL"], ["instagram", "Instagram URL"], ["youtube", "YouTube URL"], ["x", "X / Twitter URL"], ["reddit", "Reddit URL"]] as const).map(([key, label]) => <label key={key}><span>{label}</span><input type="url" placeholder="https://" value={socialLinks[key]} onChange={(event) => setSocialLinks((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<div className="admin-form-actions"><button className="admin-primary-button" type="submit">Save Social Links</button></div>{socialNotice && <p className="admin-form-success">{socialNotice}</p>}</form></AdminPanel>;
    if (screen === "featured") return <AdminPanel title="Featured Products"><div className="admin-featured-grid">{adminProducts.map((product) => <button type="button" className={`admin-featured-card ${featured.includes(product.id) ? "is-featured" : ""}`} key={product.id} onClick={() => toggleFeatured(product.id)}><img src={product.image} alt="" /><strong>{product.name}</strong><span>{featured.includes(product.id) ? "Featured" : "Add to featured"}</span></button>)}</div></AdminPanel>;
    if (["analytics", "sales-reports", "product-reports"].includes(screen)) return <AdminPanel title={activeNav?.label || "Analytics"}><EmptyState title="Analytics data is not available" message="Reports will appear here when order and customer data is connected." /></AdminPanel>;
    if (screen === "general-settings") return <AdminPanel title="General Settings"><form className="admin-form"><label><span>Store name</span><input defaultValue="Tribull Store" /></label><label><span>Store email</span><input type="email" placeholder="Not configured" /></label><label><span>Store phone</span><input placeholder="Not configured" /></label><label><span>Currency</span><select defaultValue="INR"><option value="INR">INR (₹)</option><option value="USD">USD ($)</option></select></label><label className="admin-toggle-label"><span>Store status</span><input type="checkbox" defaultChecked /><strong>Store is online</strong></label><button className="admin-primary-button" type="button" onClick={() => setSavedNotice("Settings saved.")}>Save Settings</button>{savedNotice && <p className="admin-form-success">{savedNotice}</p>}</form></AdminPanel>;
    if (screen === "admin-users") return <AdminPanel title="Admin Users" action="+ Add Admin" onAction={() => setAdminModal("add")}><div className="admin-admin-list">{adminUsers.map((admin) => <div className="admin-management-row" key={admin.id}><div><strong>{admin.name}</strong><span>{admin.email || "Email not configured"} · {admin.role}</span>{admin.phone && <span>{admin.phone}</span>}</div><StatusPill status={admin.status} /><div className="admin-admin-actions"><button className="admin-small-button" type="button" onClick={() => openPermissions(admin, "view-permissions")}>View Permissions</button><button className="admin-small-button" type="button" onClick={() => openPermissions(admin, "edit-permissions")}>Edit Permissions</button></div></div>)}</div>{savedNotice && <p className="admin-form-success">{savedNotice}</p>} {adminModal && <div className="admin-modal-backdrop" onClick={() => setAdminModal(null)}><div className="admin-modal admin-admin-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="admin-modal-close" onClick={() => setAdminModal(null)}><X size={17} /></button>{adminModal === "add" && <><h2>Add Admin</h2><form className="admin-form admin-admin-form" onSubmit={saveAdmin}>{(["name", "email", "phone"] as const).map((field) => <label key={field}><span>{field.charAt(0).toUpperCase() + field.slice(1)}</span><input required={field === "name" || field === "email"} type={field === "email" ? "email" : field === "phone" ? "tel" : "text"} value={adminForm[field]} onChange={(event) => setAdminForm({ ...adminForm, [field]: event.target.value })} /></label>)}<label><span>Role</span><select value={adminForm.role} onChange={(event) => setAdminForm({ ...adminForm, role: event.target.value })}>{["Super Admin", "Admin", "Manager", "Staff"].map((role) => <option key={role}>{role}</option>)}</select></label><label><span>Status</span><select value={adminForm.status} onChange={(event) => setAdminForm({ ...adminForm, status: event.target.value as "Active" | "Inactive" })}><option>Active</option><option>Inactive</option></select></label><div className="admin-form-actions"><button className="admin-primary-button" type="submit">Save Admin</button><button className="admin-secondary-button" type="button" onClick={() => setAdminModal(null)}>Cancel</button></div></form></>}{adminModal !== "add" && selectedAdmin && <><h2>{adminModal === "view-permissions" ? "View Permissions" : "Edit Permissions"}</h2><p className="admin-permission-owner">{selectedAdmin.name} · {selectedAdmin.role}</p><div className="admin-permission-table"><div className="admin-permission-row admin-permission-row--header"><strong>Permission</strong><strong>View</strong><strong>Edit</strong></div>{permissionSections.map(({ key, label }) => <div className="admin-permission-row" key={key}><span>{label}</span><input type="checkbox" checked={permissionDraft[key].view} disabled={adminModal === "view-permissions"} onChange={(event) => setPermissionDraft((current) => ({ ...current, [key]: { ...current[key], view: event.target.checked } }))} /><input type="checkbox" checked={permissionDraft[key].edit} disabled={adminModal === "view-permissions"} onChange={(event) => setPermissionDraft((current) => ({ ...current, [key]: { ...current[key], edit: event.target.checked } }))} /></div>)}</div>{adminModal === "edit-permissions" && <div className="admin-form-actions"><button className="admin-primary-button" type="button" onClick={savePermissions}>Save Permissions</button><button className="admin-secondary-button" type="button" onClick={() => setAdminModal(null)}>Cancel</button></div>}</>}</div></div>}</AdminPanel>;
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
      <header className="admin-topbar"><button className="admin-icon-button admin-mobile-menu" type="button" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><div className="admin-topbar-context"><span>Admin</span><ChevronRight size={14} /><strong>{activeNav?.label || "Dashboard"}</strong></div><label className="admin-search"><Search size={17} /><input aria-label="Search dashboard" placeholder="Search orders, products, customers..." /><kbd>⌘ K</kbd></label><div className="admin-topbar-actions"><button className="admin-icon-button admin-notification-button" type="button" aria-label="Notifications"><Bell size={19} /><i /></button><div className="admin-profile-wrap"><button className="admin-profile-button" type="button" onClick={() => setProfileOpen(!profileOpen)}><span className="admin-avatar">MK</span><span className="admin-profile-name">Monika Manikandan</span><ChevronDown size={15} /></button>{profileOpen && <div className="admin-profile-menu"><strong>Monika Manikandan</strong><span>Store administrator</span><button type="button"><UserRound size={15} /> Account settings</button><button type="button"><LifeBuoy size={15} /> Help center</button></div>}</div></div></header>
      <main className="admin-content"><div className="admin-page-intro"><div><p className="admin-eyebrow">Tribull Store Admin</p><h1>{activeNav?.label || "Dashboard"}</h1><p>Manage your store, catalog, orders, and customers.</p></div>{screen === "dashboard" && <div className="admin-range-control"><SlidersHorizontal size={16} /><select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Dashboard date range"><option>Today</option><option>Yesterday</option><option>Last 7 days</option><option>Last 30 days</option></select><ChevronDown size={15} /></div>}</div>{renderScreen()}{screen === "products" && isProductEditorOpen && <div className="admin-modal-backdrop admin-product-edit-backdrop" onClick={closeProductEditor}><section className="admin-modal admin-product-edit-modal" role="dialog" aria-modal="true" aria-labelledby="admin-product-edit-title" onClick={(event) => event.stopPropagation()}><button type="button" className="admin-modal-close" aria-label="Close editor" onClick={closeProductEditor}><X size={17} /></button><h2 id="admin-product-edit-title">Edit Product</h2>{editProductLoading ? <p>Loading product...</p> : editProductError && !editingProduct ? <><p className="admin-image-error" role="alert">Unable to load product details. Please try again.</p><div className="admin-form-actions">{editingProductTarget && <button className="admin-primary-button" type="button" onClick={() => void editProduct(editingProductTarget)}>Retry</button>}<button className="admin-secondary-button" type="button" onClick={closeProductEditor}>Close</button></div></> : editingProduct && <AddProductForm productForm={editingProductForm} setProductForm={setEditingProductForm} hierarchy={categoryHierarchy} hierarchyLoading={categoryHierarchyLoading} hierarchyError={categoryHierarchyError} onSave={saveEditedProduct} onCancel={closeProductEditor} imageError={imageError} onImageChange={(event) => handleProductImageChange(event, setEditingProductForm)} savedNotice={editProductError} productSaving={productSaving} submitLabel="Save Changes" />}</section></div>}{selectedProduct && <div className="admin-modal-backdrop" onClick={() => setSelectedProduct(null)}><div className="admin-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="admin-modal-close" onClick={() => setSelectedProduct(null)}><X size={17} /></button><img src={selectedProduct.image} alt={selectedProduct.name} /><h2>{selectedProduct.name}</h2><p>{selectedProduct.mainCategory && selectedProduct.subcategory ? `${selectedProduct.mainCategory} · ${selectedProduct.subcategory}` : selectedProduct.category} · ₹{selectedProduct.price.toLocaleString("en-IN")}</p><StatusPill status={selectedProduct.stock < 10 ? "Low stock" : selectedProduct.status} />{selectedProduct.mainCategoryId && <div className="admin-form"><label><span>Main Category</span><select disabled={categoryHierarchyLoading || Boolean(categoryHierarchyError)} value={editingProductCategory} onChange={(event) => { const value = event.target.value; setEditingProductCategory(value); setEditingProductSubcategory(categoryHierarchy.subcategories[value]?.[0]?.value || ""); }}>{categoryHierarchy.main.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label><span>Subcategory / Industry</span><select disabled={categoryHierarchyLoading || Boolean(categoryHierarchyError)} value={editingProductSubcategory} onChange={(event) => setEditingProductSubcategory(event.target.value)}>{(categoryHierarchy.subcategories[editingProductCategory] || []).map((subcategory) => <option key={subcategory.value} value={subcategory.value}>{subcategory.label}</option>)}</select></label>{(productUpdateError || categoryHierarchyError) && <p className="admin-image-error" role="alert">{productUpdateError || categoryHierarchyError}</p>}<div className="admin-form-actions"><button type="button" className="admin-primary-button" disabled={categoryHierarchyLoading || Boolean(categoryHierarchyError)} onClick={() => void saveProductCategory()}>Save Category</button></div></div>}</div></div>}{selectedOrder && <div className="admin-modal-backdrop" onClick={() => setSelectedOrder(null)}><div className="admin-modal admin-order-detail-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="admin-modal-close" onClick={() => setSelectedOrder(null)}><X size={17} /></button><h2>{selectedOrder.id}</h2><p><strong>{selectedOrder.customer.name}</strong><br />{selectedOrder.customer.email} · {selectedOrder.customer.phone}</p><p>{selectedOrder.shippingAddress.address}, {selectedOrder.shippingAddress.apartment}, {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.pinCode}, {selectedOrder.shippingAddress.country}</p><div className="admin-order-detail-items">{selectedOrder.items.map((item) => <div key={item.id} className="admin-order-detail-item"><img src={item.image} alt={item.name} /><span><strong>{item.name}</strong><small>{item.variant || "Standard"} · {item.quantity} × ₹{item.price.toLocaleString("en-IN")}</small></span><strong>₹{item.lineTotal.toLocaleString("en-IN")}</strong></div>)}</div><p>Subtotal: ₹{selectedOrder.subtotal.toLocaleString("en-IN")}<br />Shipping: ₹{selectedOrder.shipping.toLocaleString("en-IN")}<br />Discount: ₹{selectedOrder.discount.toLocaleString("en-IN")}<br /><strong>Total: ₹{selectedOrder.total.toLocaleString("en-IN")}</strong></p><p>Payment: {selectedOrder.payment.method} ({selectedOrder.payment.status})</p><label>Order status<select value={selectedOrder.status} onChange={(event) => void updateOrder(selectedOrder.id, event.target.value as OrderStatus)}><option>Pending</option><option>Processing</option><option>Shipped</option><option>Delivered</option><option>Cancelled</option></select></label><StatusPill status={selectedOrder.status} /><p>{new Date(selectedOrder.createdAt).toLocaleString("en-IN")}</p></div></div>}<footer className="admin-footer"><span><strong>TRIBULL</strong> <em>© 2026 Tribull Store</em></span><div><a href="#admin-help">Help</a><a href="#admin-privacy">Privacy</a><span>Admin Dashboard · v1.0.0</span></div></footer></main>
    </div>
  </div>;
}