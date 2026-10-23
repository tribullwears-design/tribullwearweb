import {
  ArrowLeft,
  Check,
  Heart,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { animateAddToWishlist } from "../lib/wishlistAnimation";
import { toggleWishlistItem } from "../lib/wishlist";
import type { Product } from "../../../shared/products";
import ProductPrice from "../components/ProductPrice";
import MovingNavbar from "../components/MovingNavbar";
import { fetchProducts, getCachedProducts, refreshProducts } from "../lib/products";
import { useSiteLogo } from "../contexts/SiteLogoContext";
import { useProductTypeCategories } from "../lib/productTypeCategories";

export type { Product } from "../../../shared/products";

type ProductCategory = Product["category"];
type SortOption = "featured" | "newest" | "low" | "high" | "selling";

const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`;

function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function ProductsPage() {
  const logo = useSiteLogo();
  const [, setLocation] = useLocation();
  const categories = useProductTypeCategories().filter((category) => category.isVisible);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(getCachedProducts);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>("round-neck");
  const [sort, setSort] = useState<SortOption>("featured");
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage("tribull-wishlist", []));
  const [cart, setCart] = useState<Record<string, number>>(() => readStorage("tribull-cart", {}));
  const [addedProduct, setAddedProduct] = useState<string | null>(null);

  useEffect(() => {
    if (!categories.some((category) => category.id === selectedCategory) && categories[0]) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    let active = true;
    const syncProducts = (refresh = false) => {
      const request = refresh ? refreshProducts() : fetchProducts();
      void request.then((nextProducts) => {
        if (active) setCatalogProducts(nextProducts);
      }).catch((error: unknown) => {
        console.error("Failed to load products from the product API.", error);
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
    const syncWishlist = () => setWishlist(readStorage("tribull-wishlist", []));
    window.addEventListener("tribull-wishlist-updated", syncWishlist);
    window.addEventListener("storage", syncWishlist);
    return () => {
      window.removeEventListener("tribull-wishlist-updated", syncWishlist);
      window.removeEventListener("storage", syncWishlist);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("tribull-cart", JSON.stringify(cart));
  }, [cart]);

  const visibleProducts = useMemo(() => {
    const filtered = categories.some((category) => category.id === selectedCategory)
      ? catalogProducts.filter((product) => product.category === selectedCategory)
      : [];
    return [...filtered].sort((a, b) => {
      if (sort === "newest") return b.created - a.created;
      if (sort === "low") return a.price - b.price;
      if (sort === "high") return b.price - a.price;
      if (sort === "selling") return b.sold - a.sold;
      return catalogProducts.indexOf(a) - catalogProducts.indexOf(b);
    });
  }, [catalogProducts, categories, selectedCategory, sort]);

  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const selectedLabel = categories.find((category) => category.id === selectedCategory)?.label || "Products";

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation("/");
  };

  const toggleWishlist = (productId: string, source?: HTMLElement) => {
    const isAdding = !wishlist.includes(productId);
    if (isAdding && source) animateAddToWishlist(source);
    void toggleWishlistItem(productId, isAdding).catch(() => undefined);
  };

  const addToCart = (productId: string) => {
    if (addedProduct === productId) {
      window.dispatchEvent(new Event("tribull-open-cart"));
      return;
    }

    const product = catalogProducts.find((item) => item.id === productId);
    const nextCart = { ...cart, [productId]: (cart[productId] || 0) + 1 };
    window.localStorage.setItem("tribull-cart", JSON.stringify(nextCart));
    setCart(nextCart);
    if (product) {
      try {
        const cartItems = JSON.parse(window.localStorage.getItem("tribull-cart-items") || "{}");
        window.localStorage.setItem("tribull-cart-items", JSON.stringify({ ...cartItems, [productId]: product }));
      } catch {
        // Keep the existing quantity cart usable if metadata storage is unavailable.
      }
    }
    window.dispatchEvent(new Event("tribull-cart-updated"));
    setAddedProduct(productId);
  };

  return (
    <div className="products-page">
      <MovingNavbar />
      <div className="products-page__topbar">
        <button type="button" className="products-page__back" onClick={goBack} aria-label="Go back">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <Link href="/" className="products-page__brand" aria-label="Back to Tribull home">
          <img src={logo} alt="TRIBULL" />
        </Link>
        <div className="products-page__top-actions">
          <button className="products-page__top-icon" aria-label="Wishlist">
            <Heart size={19} strokeWidth={1.7} />
            {wishlist.length > 0 && <span>{wishlist.length}</span>}
          </button>
        </div>
      </div>

      <main className="products-page__content">
        <section className="product-category-tabs" aria-label="Product categories">
          {categories.map(({ id, label, image }) => (
            <button
              key={id}
              type="button"
              className={`product-category-tab ${selectedCategory === id ? "is-active" : ""}`}
              onClick={() => setSelectedCategory(id)}
              aria-pressed={selectedCategory === id}
            >
              <span className="product-category-tab__icon">
                {image && <img src={image} alt="" style={{ width: 24, height: 24, objectFit: "contain", display: "block" }} />}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </section>
        {categories.length === 0 && <p role="status">No product types are currently visible.</p>}

        <div className="products-page__toolbar">
          <p>Showing: <strong>{selectedLabel}</strong></p>
          <label className="products-page__sort">
            <span>Sort by:</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)} aria-label="Sort products">
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="low">Price: Low to High</option>
              <option value="high">Price: High to Low</option>
              <option value="selling">Best Selling</option>
            </select>
          </label>
        </div>

        <section className="products-page__grid" aria-label={`${selectedLabel} products`}>
          {visibleProducts.map((product) => {
            const isWishlisted = wishlist.includes(product.id);
            const isAdded = addedProduct === product.id;
            return (
              <article
                className="catalog-product-card"
                key={product.id}
                role="link"
                tabIndex={0}
                onClick={() => setLocation(`/product/${encodeURIComponent(product.id)}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setLocation(`/product/${encodeURIComponent(product.id)}`);
                  }
                }}
              >
                <div className="catalog-product-card__image">
                  <img src={product.image} alt={product.name} className="product-image-primary" decoding="async" />
                  <button
                    type="button"
                    className={`catalog-product-card__wishlist ${isWishlisted ? "is-active" : ""}`}
                    onClick={(event) => { event.stopPropagation(); toggleWishlist(product.id, event.currentTarget); }}
                    aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                    aria-pressed={isWishlisted}
                  >
                    <Heart size={21} fill={isWishlisted ? "currentColor" : "none"} strokeWidth={1.8} />
                  </button>
                </div>
                <div className="catalog-product-card__body">
                  <div>
                    <h2>{product.name}</h2>
                    <ProductPrice sellingPrice={product.price} originalPrice={product.originalPrice} productName={product.name} />
                  </div>
                  <button type="button" className={`catalog-product-card__cart ${isAdded ? "is-added" : ""}`} onClick={(event) => { event.stopPropagation(); addToCart(product.id); }} aria-label={isAdded ? `Go to cart with ${product.name}` : `Add ${product.name} to cart`}>
                    {isAdded ? <Check size={14} /> : <ShoppingCart size={14} />}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
