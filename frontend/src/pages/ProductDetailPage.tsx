import { ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Heart, Minus, PackageCheck, Plus, ShieldCheck, ShoppingBag, Sparkles, Truck } from "lucide-react";
import HeaderActions from "../components/HeaderActions";
import MobileCategoryMenu from "../components/MobileCategoryMenu";
import ProductPrice from "../components/ProductPrice";
import { resolveOriginalPrice, type OriginalPriceFields } from "../lib/productPrice";
import { fetchProducts } from "../lib/products";
import { apiFetch } from "../lib/api";
import { toggleWishlistItem } from "../lib/wishlist";
import { Link, useLocation, useParams } from "wouter";
import { useEffect, useState } from "react";
import "./ProductDetailPage.css";

interface ProductData extends OriginalPriceFields {
  id?: string;
  name: string;
  price: string;
  image: string;
  category: string;
  description?: string;
  sizes?: string[];
  colors?: string[];
  stock?: number;
  basePrice?: number;
}

const tShirtColors = [
  { name: "Black", value: "#171717" },
  { name: "White", value: "#ffffff" },
] as const;

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [storedProduct, setStoredProduct] = useState<ProductData | null>(null);
  const [recommendationProducts, setRecommendationProducts] = useState<ProductData[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(() => {
    try {
      return (JSON.parse(window.localStorage.getItem("tribull-wishlist") || "[]") as string[]).includes(id || "");
    } catch {
      return false;
    }
  });
  const [isProductLoading, setIsProductLoading] = useState(true);
  const [productLoadError, setProductLoadError] = useState(false);
  const [productRetry, setProductRetry] = useState(0);
  const [activeInfoTab, setActiveInfoTab] = useState<"details" | "fit" | "shipping">("details");
  const [isInfoOpen, setIsInfoOpen] = useState(true);
  const [headerCartCount, setHeaderCartCount] = useState(0);
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem("tribull-cart") || "{}");
    } catch {
      return {};
    }
  });
  const [isAdded, setIsAdded] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [sizeError, setSizeError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; name: string; discountType: "percentage" | "fixed"; value: number; minimumOrderAmount: number } | null>(null);
  const [couponFeedback, setCouponFeedback] = useState<{ kind: "idle" | "error" | "success"; message: string }>({ kind: "idle", message: "" });

  useEffect(() => {
    window.localStorage.setItem("tribull-cart", JSON.stringify(cart));
    setHeaderCartCount(Object.values(cart).reduce((total, quantityValue) => total + quantityValue, 0));
  }, [cart]);

  useEffect(() => {
    const syncHeaderCart = () => {
      try {
        const savedCart = JSON.parse(window.localStorage.getItem("tribull-cart") || "{}") as Record<string, number>;
        setCart(savedCart);
        setHeaderCartCount(Object.values(savedCart).reduce((total, quantityValue) => total + quantityValue, 0));
      } catch {
        setHeaderCartCount(0);
      }
    };
    syncHeaderCart();
    window.addEventListener("tribull-cart-updated", syncHeaderCart);
    return () => window.removeEventListener("tribull-cart-updated", syncHeaderCart);
  }, []);

  useEffect(() => {
    let active = true;
    const loadStoredProduct = () => {
      setStoredProduct(null);
      setIsProductLoading(true);
      setProductLoadError(false);
      if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
        setIsProductLoading(false);
        return;
      }
      void apiFetch(`/api/products/${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(15000) })
        .then(async (response) => {
          if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error("Unable to load product details.");
          }
          if (!(response.headers.get("content-type") || "").includes("application/json")) throw new Error("Product response was not JSON.");
          const product = await response.json() as Partial<{
            id: string;
            name: string;
            description: string;
            price: number;
            compareAt: number | null;
            image: string;
            mainCategory: string;
            sizes: string[];
            colors: string[];
            stock: number;
            basePrice?: number;
          }>;
          if (typeof product.id !== "string" || !product.id || typeof product.name !== "string"
            || typeof product.price !== "number" || !Number.isFinite(product.price)
            || typeof product.image !== "string" || typeof product.mainCategory !== "string"
            || !Array.isArray(product.sizes) || !Array.isArray(product.colors) || typeof product.stock !== "number") {
            throw new Error("Product response was incomplete.");
          }
          return product as {
            id: string;
            name: string;
            description: string;
            price: number;
            compareAt: number | null;
            image: string;
            mainCategory: string;
            sizes: string[];
            colors: string[];
            stock: number;
            basePrice?: number;
          };
        })
        .then((product) => {
          if (!active) return;
          if (!product) {
            setIsProductLoading(false);
            return;
          }
          setStoredProduct({
            id: product.id,
            name: product.name,
            description: product.description,
            price: `₹${product.price.toLocaleString("en-IN")}`,
            originalPrice: product.compareAt ?? undefined,
            image: product.image,
            category: product.mainCategory,
            sizes: product.sizes,
            colors: product.colors,
            stock: product.stock,
            basePrice: product.basePrice,
          });
          setIsProductLoading(false);
        })
        .catch((error: unknown) => {
          console.error("Product detail request failed.", error);
          if (active) {
            setProductLoadError(true);
            setIsProductLoading(false);
          }
        });
    };
    loadStoredProduct();
    window.addEventListener("tribull-products-updated", loadStoredProduct);
    return () => {
      active = false;
      window.removeEventListener("tribull-products-updated", loadStoredProduct);
    };
  }, [id, productRetry]);

  useEffect(() => {
    const syncWishlist = () => {
      try {
        setIsWishlisted((JSON.parse(window.localStorage.getItem("tribull-wishlist") || "[]") as string[]).includes(id || ""));
      } catch {
        setIsWishlisted(false);
      }
    };
    syncWishlist();
    window.addEventListener("tribull-wishlist-updated", syncWishlist);
    return () => window.removeEventListener("tribull-wishlist-updated", syncWishlist);
  }, [id]);

  useEffect(() => {
    let active = true;
    const loadRecommendations = () => {
      void fetchProducts()
        .then((products) => {
          if (active) setRecommendationProducts(products
            .filter((product) => product.id !== id)
            .slice(0, 4)
            .map((product) => ({
              id: product.id,
              name: product.name,
              price: `₹${product.price.toLocaleString("en-IN")}`,
              originalPrice: product.originalPrice,
              image: product.image,
              category: product.category,
            })));
        })
        .catch((error: unknown) => console.error("Product recommendations request failed.", error));
    };
    loadRecommendations();
    window.addEventListener("tribull-products-updated", loadRecommendations);
    return () => {
      active = false;
      window.removeEventListener("tribull-products-updated", loadRecommendations);
    };
  }, [id]);
  const product = storedProduct;
  const isTShirtColorVariant = Boolean(storedProduct?.colors?.length);
  const productColorOptions = storedProduct?.colors?.length
    ? storedProduct.colors.map((name) => ({
      name,
      value: tShirtColors.find((color) => color.name.toLowerCase() === name.toLowerCase())?.value || name.toLowerCase(),
    }))
    : [];
  const hasProductColors = isTShirtColorVariant || Boolean(storedProduct?.colors?.length);
  const availableSizes = storedProduct?.sizes || [];
  const initialColor = storedProduct?.colors?.[0] || "";
  const activeColor = selectedColor ?? initialColor;
  const productImageViews = storedProduct?.image ? [storedProduct.image] : [];

  const navigateGallery = (direction: "next" | "prev") => {
    if (productImageViews.length < 2) return;
    const nextIndex = direction === "next"
      ? (selectedImageIndex + 1) % productImageViews.length
      : (selectedImageIndex - 1 + productImageViews.length) % productImageViews.length;
    setSelectedImageIndex(nextIndex);
  };

  useEffect(() => {
    if (product?.image) {
      setSelectedImageIndex(0);
      setSelectedColor(storedProduct?.colors?.[0] || "");
      setImageFailed(false);
    }
  }, [product?.image]);

  useEffect(() => {
    if (!product || !appliedCoupon) return;
    const currentPrice = Number(product.price.replace(/[^0-9]/g, ""));
    if (currentPrice * quantity < appliedCoupon.minimumOrderAmount) {
      setAppliedCoupon(null);
      setCouponFeedback({ kind: "error", message: `Coupon removed: minimum order is ₹${appliedCoupon.minimumOrderAmount.toLocaleString("en-IN")}.` });
    }
  }, [product, appliedCoupon, quantity, selectedSize, activeColor]);

  if (!product) {
    return (
      <div className="product-detail-page">
        <main className="product-detail-page__state" role="status">
          {isProductLoading ? "Loading product…" : productLoadError ? (
            <><p>We could not load this product. Please check your connection and try again.</p><button type="button" onClick={() => setProductRetry((retry) => retry + 1)}>Retry</button></>
          ) : (
            <><p>Product Not Found</p><Link href="/products">Back to shopping</Link></>
          )}
        </main>
      </div>
    );
  }

  const priceValue = Number(product.price.replace(/[^0-9]/g, ""));
  const isOutOfStock = typeof product.stock === "number" && product.stock <= 0;
  const originalPriceValue = resolveOriginalPrice(product) ?? (product.basePrice && product.basePrice > priceValue ? product.basePrice : undefined);
  const originalPriceNumber = typeof originalPriceValue === "number" ? originalPriceValue : undefined;
  const originalProductPrice = typeof product.basePrice === "number" && product.basePrice > priceValue ? product.basePrice : priceValue;
  const productDiscountPerUnit = Math.max(0, originalProductPrice - priceValue);
  const productDescription = product.description || "Product details have not been added yet.";

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) { setCouponFeedback({ kind: "error", message: "Enter a coupon code." }); return; }
    try {
      const response = await apiFetch(`/api/marketing/coupons/${encodeURIComponent(code)}`, { cache: "no-store" });
      const result = await response.json() as { error?: string; id?: string; code?: string; name?: string; discountType?: "percentage" | "fixed"; value?: number; minimumOrderAmount?: number };
      if (!response.ok || !result.id || !result.code || !result.name || !result.discountType || typeof result.value !== "number" || typeof result.minimumOrderAmount !== "number") throw new Error(result.error || "Coupon is invalid or unavailable.");
      if (priceValue * quantity < result.minimumOrderAmount) throw new Error(`This coupon requires a minimum order of ₹${result.minimumOrderAmount.toLocaleString("en-IN")}.`);
      setAppliedCoupon({ code: result.code, name: result.name, discountType: result.discountType, value: result.value, minimumOrderAmount: result.minimumOrderAmount });
      setCouponFeedback({ kind: "success", message: `${result.name}: ${result.discountType === "percentage" ? `${result.value}% off` : `₹${result.value.toLocaleString("en-IN")} off`}. Minimum order ₹${result.minimumOrderAmount.toLocaleString("en-IN")}.` });
    } catch (error) { setAppliedCoupon(null); setCouponFeedback({ kind: "error", message: error instanceof Error ? error.message : "Coupon is invalid or unavailable." }); }
  };

  const couponDiscountPerUnit = appliedCoupon && priceValue * quantity >= appliedCoupon.minimumOrderAmount
    ? appliedCoupon.discountType === "percentage" ? priceValue * appliedCoupon.value / 100 : Math.min(appliedCoupon.value, priceValue * quantity) / quantity
    : 0;
  const productSubtotal = priceValue * quantity;
  const productDiscountTotal = productDiscountPerUnit * quantity;
  const couponDiscountTotal = Math.min(productSubtotal, Math.round(couponDiscountPerUnit * quantity * 100) / 100);
  const finalProductTotal = Math.max(0, productSubtotal - couponDiscountTotal);

  const benefitItems = [
    { title: "Fit", detail: "Relaxed" },
    { title: "Collar", detail: "Classic" },
    { title: "Occasion", detail: "Casual" },
    { title: "Fabric", detail: "Cotton blend" },
    { title: "Style", detail: product.category },
  ];

  const accordionMap = {
    details: {
      title: "Product Details",
      content: "Crafted for everyday streetwear rotation, this tee balances soft-touch comfort with understated structure. The fabric is breathable, durable, and printed to stay fresh through repeat wear.",
    },
    fit: {
      title: "Fit & Care",
      content: "Standard fit with a roomier silhouette. Machine wash cold with like colors, inside out. Avoid direct ironing on the print and do not use bleach.",
    },
    shipping: {
      title: "Shipping & Returns",
      content: "Dispatch within 24–48 hours. Easy exchanges within eligible return windows for unworn items. Delivery estimates vary by PIN code and courier availability.",
    },
  } as const;

  const addCurrentProductToCart = () => {
    if (isOutOfStock) return;
    if (isAdded) {
      window.dispatchEvent(new Event("tribull-open-cart"));
      return;
    }

    if (availableSizes.length > 0 && !selectedSize) {
      setSizeError("Please select a size before adding to cart.");
      return;
    }

    const productId = product.id || id || "";
    const metadata = {
      productId,
      name: product.name,
      price: priceValue,
      originalPrice: originalPriceNumber,
      image: product.image,
      size: selectedSize,
      color: isTShirtColorVariant ? activeColor : "",
      variant: `${selectedSize ? `Size: ${selectedSize}` : ""}${isTShirtColorVariant ? `${selectedSize ? " / " : ""}Colour: ${activeColor}` : ""}`,
    };
    try {
      const cartItems = JSON.parse(window.localStorage.getItem("tribull-cart-items") || "{}");
      window.localStorage.setItem("tribull-cart-items", JSON.stringify({ ...cartItems, [productId]: metadata }));
    } catch {
      console.error("Could not save product details with the cart item.");
    }

    const nextCart = { ...cart, [productId]: (cart[productId] || 0) + quantity };
    window.localStorage.setItem("tribull-cart", JSON.stringify(nextCart));
    setCart(nextCart);
    window.dispatchEvent(new Event("tribull-cart-updated"));
    setSizeError("");
    setIsAdded(true);
  };

  const checkoutCurrentProduct = () => {
    if (isOutOfStock) return;
    if (availableSizes.length > 0 && !selectedSize) {
      setSizeError("Please select a size before checking out.");
      return;
    }
    const productId = product.id || id || "";
    const metadata = {
      productId,
      name: product.name,
      price: priceValue,
      originalPrice: originalPriceNumber,
      image: product.image,
      ...(appliedCoupon ? {
        couponCode: appliedCoupon.code,
        couponDiscountType: appliedCoupon.discountType,
        couponValue: appliedCoupon.value,
        couponMinimumOrderAmount: appliedCoupon.minimumOrderAmount,
      } : {}),
      size: selectedSize,
      color: isTShirtColorVariant ? activeColor : "",
      variant: `${selectedSize ? `Size: ${selectedSize}` : ""}${isTShirtColorVariant ? `${selectedSize ? " / " : ""}Colour: ${activeColor}` : ""}`,
    };
    window.sessionStorage.setItem("tribull-checkout-selection", JSON.stringify({ productId, quantity, metadata }));
    setLocation("/checkout");
  };

  const toggleWishlist = () => {
    const productId = product.id || id || "";
    void toggleWishlistItem(productId, !isWishlisted).catch(() => undefined);
  };

  return (
    <div className="product-detail-page">
      <div className="product-detail-page__announcement" aria-label="Announcement">
        <div className="product-detail-page__announcement-track">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index}>
              100% cotton <b>shop now</b> <i>✦</i>
            </span>
          ))}
        </div>
      </div>

      <header className="site-header" aria-label="Main nav">
        <MobileCategoryMenu />
        <a className="wordmark" href="/" aria-label="Tribull home">
          <img src="/products/logo.png" alt="TRIBULL" />
        </a>
        <HeaderActions />
      </header>

      <main className="product-detail-page__main">
        <div className="product-detail-page__shell">
          <section className="product-detail-gallery" aria-label="Product gallery">
            <div className="product-detail-gallery__status">
              <span className="product-detail-gallery__label">Tribull Studio</span>
              <span className="product-detail-gallery__count">{String(selectedImageIndex + 1).padStart(2, "0")} / {String(productImageViews.length).padStart(2, "0")}</span>
            </div>

            <div className="product-detail-gallery__body">
              <div className="product-detail-gallery__thumbs" aria-label="Product image views">
                {productImageViews.map((image, viewIndex) => (
                <button
                  key={image}
                  type="button"
                  className={selectedImageIndex === viewIndex ? "is-active" : ""}
                  onClick={() => setSelectedImageIndex(viewIndex)}
                  aria-label={`View product image ${viewIndex + 1}`}
                  aria-pressed={selectedImageIndex === viewIndex}
                >
                  {imageFailed ? <span aria-hidden="true">Image</span> : <img src={image} alt="" aria-hidden="true" onError={() => setImageFailed(true)} />}
                </button>
              ))}
              </div>

              <div className="product-detail-gallery__media">
                <div className={`product-detail-gallery__viewport${isTShirtColorVariant ? " product-detail-gallery__viewport--shirt" : ""}`}>
                  {imageFailed
                    ? <span className="product-detail-gallery__fallback">Image unavailable</span>
                    : <img src={product.image} alt={product.name} onError={() => setImageFailed(true)} />}
                </div>
                <div className="product-detail-gallery__nav">
                  <button type="button" onClick={() => navigateGallery("prev")} aria-label="Previous image view" disabled={productImageViews.length < 2}>
                    <ChevronLeft size={18} />
                  </button>
                  <button type="button" onClick={() => navigateGallery("next")} aria-label="Next image view" disabled={productImageViews.length < 2}>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="product-detail-panel" aria-label="Product information">
            <div className="product-detail-panel__eyebrow">{product.category} <span>·</span> SKU: {product.id}</div>
            <h1 className="product-detail-panel__heading">{product.name}</h1>

            <ProductPrice
              sellingPrice={product.price}
              originalPrice={originalPriceValue}
              productName={product.name}
              className="product-price--detail"
            />
            <p className="product-detail-tax-note">Tax included.</p>
            {typeof product.stock === "number" && (
              <p className="product-detail-stock" aria-live="polite">
                {product.stock > 0 ? `${product.stock} available` : "Currently out of stock"}
              </p>
            )}

            <p className="product-detail-panel__description">{productDescription}</p>

            {availableSizes.length > 0 && <div className="product-detail-option">
              <div className="product-detail-option__header">
                <span>Size</span>
                <button type="button" className="product-detail-option__guide" onClick={() => setIsSizeGuideOpen(true)}>Size guide</button>
              </div>
              <div className="product-detail-size-summary">
                <span>{selectedSize ? `Selected: ${selectedSize}` : "Choose your size"}</span>
              </div>

              <div className="product-detail-sizes">
                {availableSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={selectedSize === size ? "is-selected" : ""}
                    onClick={() => {
                      setSelectedSize(size);
                      setSizeError("");
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
              {sizeError ? <p className="product-detail-option__error">{sizeError}</p> : null}
            </div>}

            <div className="product-detail-return-note">
              <ShieldCheck size={17} />
              <span>Easy 10-day return and exchange on this product. No questions asked.</span>
            </div>

            {hasProductColors ? (
              <div className="product-detail-color-option">
                <span>Colour: {activeColor}</span>
                <div className="product-detail-swatches" aria-label="Choose T-shirt colour">
                  {productColorOptions.map((option) => (
                    <button
                      key={option.name}
                      data-color={option.name}
                      className={activeColor === option.name ? "is-selected" : ""}
                      type="button"
                      onClick={() => {
                        setSelectedColor(option.name);
                        setSelectedImageIndex(0);
                      }}
                      aria-label={`Select ${option.name} T-shirt`}
                      aria-pressed={activeColor === option.name}
                      title={option.name}
                      style={{
                        background: option.value,
                        ...(option.name === "White"
                          ? { boxShadow: "inset 0 0 0 1px rgba(25, 25, 24, 0.5)" }
                          : {}),
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="product-detail-coupon" aria-label="Coupon code">
              <label htmlFor="product-coupon">Enter coupon code</label>
              <div className="product-detail-pincode__field">
                <input id="product-coupon" value={couponCode} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); setCouponFeedback({ kind: "idle", message: "" }); }} placeholder="Enter coupon code" maxLength={32} />
                <button type="button" onClick={() => void applyCoupon()}>Apply</button>
              </div>
              {couponFeedback.kind !== "idle" && <p className={couponFeedback.kind === "success" ? "is-success" : "is-error"}>{couponFeedback.message}</p>}
            </div>

            <div className="product-detail-price-summary" aria-label="Price summary">
              <div><span>Original product price</span><strong>₹{(originalProductPrice * quantity).toLocaleString("en-IN")}</strong></div>
              {productDiscountTotal > 0 && <div><span>Product discount</span><strong>-₹{productDiscountTotal.toLocaleString("en-IN")}</strong></div>}
              {appliedCoupon && couponDiscountTotal > 0 && <div><span>Coupon {appliedCoupon.code}</span><strong>-₹{couponDiscountTotal.toLocaleString("en-IN")}</strong></div>}
              <div className="product-detail-price-summary__total"><span>Final price</span><strong>₹{finalProductTotal.toLocaleString("en-IN")}</strong></div>
              {appliedCoupon && <button type="button" onClick={() => { setAppliedCoupon(null); setCouponFeedback({ kind: "idle", message: "" }); }}>Remove Coupon</button>}
            </div>

            <div className="product-detail-cta-row">
              <div className="product-detail-qty" aria-label="Quantity selector">
                <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Decrease quantity">
                  <Minus size={16} />
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.min(product.stock ?? Number.MAX_SAFE_INTEGER, current + 1))}
                  aria-label="Increase quantity"
                  disabled={isOutOfStock || (typeof product.stock === "number" && quantity >= product.stock)}
                >
                  <Plus size={16} />
                </button>
              </div>

              <button type="button" className="product-detail-add-to-cart" onClick={addCurrentProductToCart} disabled={isOutOfStock}>
                {isOutOfStock ? null : isAdded ? <Check size={18} /> : <ShoppingBag size={18} />}
                {isOutOfStock ? "Out of stock" : isAdded ? "Go to cart" : "Add to cart"}
                {!isOutOfStock && !isAdded && <ArrowRight size={18} />}
              </button>
              <button type="button" className="product-detail-checkout" onClick={checkoutCurrentProduct} disabled={isOutOfStock}>
                Checkout
              </button>
              <button
                type="button"
                className={`product-detail-wishlist${isWishlisted ? " is-active" : ""}`}
                aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                aria-pressed={isWishlisted}
                onClick={toggleWishlist}
              >
                <Heart size={19} fill={isWishlisted ? "currentColor" : "none"} />
                <span>{isWishlisted ? "Saved" : "Wishlist"}</span>
              </button>
            </div>

            <div className="product-detail-features" aria-label="Performance details">
              {[
                { icon: ShieldCheck, label: "Premium quality" },
                { icon: Truck, label: "Free shipping" },
                { icon: PackageCheck, label: "Express dispatch" },
                { icon: Sparkles, label: "Limited edit" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="product-detail-feature">
                  <Icon size={18} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="product-detail-benefits" aria-label="Product benefits">
          <h2>Key highlights</h2>
          {benefitItems.map((benefit) => (
            <div key={benefit.title} className="product-detail-benefit">
              <span>{benefit.title}</span>
              <small>{benefit.detail}</small>
            </div>
          ))}
        </section>

        <section className="product-detail-info" aria-label="Product details and policies">
          <h2>Product description</h2>
          <div className="product-detail-info__tabs" aria-label="Product details">
            {Object.entries(accordionMap).map(([key, item]) => {
              const isActive = activeInfoTab === key && isInfoOpen;
              return (
                <div className={`product-detail-info__item ${isActive ? "is-active" : ""}`} key={key}>
                  <button
                    type="button"
                    aria-expanded={isActive}
                    onClick={() => {
                      if (activeInfoTab === key) setIsInfoOpen((open) => !open);
                      else {
                        setActiveInfoTab(key as typeof activeInfoTab);
                        setIsInfoOpen(true);
                      }
                    }}
                  >
                    <span>{item.title}</span>
                    {isActive ? <Minus size={17} /> : <Plus size={17} />}
                  </button>
                  {isActive ? <p>{item.content}</p> : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="product-detail-recommendations" aria-labelledby="you-may-also-like">
          <div className="product-detail-recommendations__header">
            <p>Style it your way</p>
            <h2 id="you-may-also-like">Frequently bought together</h2>
          </div>

          <div className="product-detail-recommendations__grid">
            {recommendationProducts.map((recommendation) => (
              <Link
                key={recommendation.id}
                href={`/product/${encodeURIComponent(recommendation.id || "")}`}
                className="product-detail-recommendation-card"
              >
                <div className="product-detail-recommendation-card__image">
                  <img src={recommendation.image} alt={recommendation.name} className="product-image-primary" loading="lazy" />
                </div>
                <div>
                  <h3>{recommendation.name}</h3>
                  <ProductPrice
                    sellingPrice={recommendation.price}
                    originalPrice={resolveOriginalPrice(recommendation)}
                    productName={recommendation.name}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {isSizeGuideOpen ? (
        <div className="product-detail-guides" aria-modal="true" role="dialog" aria-label="Size guide">
          <div className="product-detail-guides__panel">
            <div className="product-detail-guides__header">
              <h3>Size guide</h3>
              <button type="button" onClick={() => setIsSizeGuideOpen(false)} aria-label="Close size guide">
                <ChevronUp size={18} />
              </button>
            </div>
            <div className="product-detail-guides__grid">
              {[
                ["XS", "Chest 34\" / Length 26\""],
                ["S", "Chest 36\" / Length 27\""],
                ["M", "Chest 38\" / Length 28\""],
                ["L", "Chest 40\" / Length 29\""],
                ["XL", "Chest 42\" / Length 30\""],
                ["XXL", "Chest 44\" / Length 31\""],
              ].map(([size, measurements]) => (
                <div key={size} className="product-detail-guides__row">
                  <span>{size}</span>
                  <small>{measurements}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="product-detail-sticky-cart" aria-label="Quick add to cart">
        <div>
          <ProductPrice
            sellingPrice={product.price}
            originalPrice={resolveOriginalPrice(product)}
            productName={product.name}
            className="product-price--sticky"
          />
          <small>Tax included.</small>
        </div>
        <button type="button" onClick={addCurrentProductToCart} disabled={isOutOfStock}>
          {isOutOfStock ? "Out of stock" : isAdded ? <><Check size={18} /> Go to cart</> : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
