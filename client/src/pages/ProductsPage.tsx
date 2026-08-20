import {
  Check,
  Heart,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

type ProductCategory = "round-neck" | "oversized" | "acid-oversized" | "hoodie";
type SortOption = "featured" | "newest" | "low" | "high" | "selling";

type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  image: string;
  created: number;
  sold: number;
};

const categories: { id: ProductCategory; label: string; icon: string }[] = [
  { id: "round-neck", label: "Round Neck", icon: "/products/roundneckicon.png" },
  { id: "oversized", label: "Oversized", icon: "/products/oversizedicon.png" },
  { id: "acid-oversized", label: "Acid Oversized", icon: "/products/acidoverwashicon.png" },
  { id: "hoodie", label: "Hoodie", icon: "/products/hoodieicon.png" },
];

const products: Product[] = [
  { id: "mass", name: "Thalapathy Vijay - Mass", category: "round-neck", price: 599, image: "/products/front-white.png", created: 4, sold: 94 },
  { id: "thala", name: "Ajith Kumar - Thala", category: "round-neck", price: 599, image: "/products/back-black.png", created: 3, sold: 88 },
  { id: "naan", name: "Vikram - Naan Maatram Illai", category: "round-neck", price: 599, image: "/products/flat-white.png", created: 2, sold: 81 },
  { id: "vazha", name: "Vazha Oru Dharamam", category: "round-neck", price: 599, image: "/products/hanger-white.png", created: 1, sold: 75 },
  { id: "daily-oversized", name: "Daily Uniform Oversized Tee", category: "oversized", price: 799, image: "/products/back-black.png", created: 8, sold: 72 },
  { id: "street-oversized", name: "Street Frame Oversized Tee", category: "oversized", price: 849, image: "/products/front-white.png", created: 7, sold: 65 },
  { id: "heavy-oversized", name: "Heavyweight Essential Tee", category: "oversized", price: 899, image: "/products/flat-white.png", created: 6, sold: 59 },
  { id: "graphic-oversized", name: "Graphic Motion Oversized Tee", category: "oversized", price: 949, image: "/products/tshirt.jpg", created: 5, sold: 52 },
  { id: "acid-shadow", name: "Acid Shadow Washed Tee", category: "acid-oversized", price: 999, image: "/products/tomandjerry.jpg", created: 12, sold: 48 },
  { id: "acid-signal", name: "Acid Signal Oversized Tee", category: "acid-oversized", price: 1_049, image: "/products/batman.jpg", created: 11, sold: 44 },
  { id: "acid-drift", name: "Acid Drift Washed Tee", category: "acid-oversized", price: 1_099, image: "/products/front-white.png", created: 10, sold: 39 },
  { id: "acid-core", name: "Acid Core Graphic Tee", category: "acid-oversized", price: 1_149, image: "/products/flat-white.png", created: 9, sold: 35 },
  { id: "classic-hoodie", name: "Classic Tribull Hoodie", category: "hoodie", price: 1_299, image: "/products/hanger-white.png", created: 16, sold: 83 },
  { id: "forest-hoodie", name: "Forest Logo Hoodie", category: "hoodie", price: 1_399, image: "/products/back-black.png", created: 15, sold: 74 },
  { id: "graphic-hoodie", name: "Graphic Night Hoodie", category: "hoodie", price: 1_499, image: "/products/flat-white.png", created: 14, sold: 61 },
  { id: "studio-hoodie", name: "Studio Heavy Hoodie", category: "hoodie", price: 1_599, image: "/products/front-white.png", created: 13, sold: 56 },
];

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
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>("round-neck");
  const [sort, setSort] = useState<SortOption>("featured");
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage("tribull-wishlist", []));
  const [cart, setCart] = useState<Record<string, number>>(() => readStorage("tribull-cart", {}));
  const [addedProduct, setAddedProduct] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem("tribull-wishlist", JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    window.localStorage.setItem("tribull-cart", JSON.stringify(cart));
  }, [cart]);

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => product.category === selectedCategory);
    return [...filtered].sort((a, b) => {
      if (sort === "newest") return b.created - a.created;
      if (sort === "low") return a.price - b.price;
      if (sort === "high") return b.price - a.price;
      if (sort === "selling") return b.sold - a.sold;
      return products.indexOf(a) - products.indexOf(b);
    });
  }, [selectedCategory, sort]);

  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const selectedLabel = categories.find((category) => category.id === selectedCategory)?.label;

  const toggleWishlist = (productId: string) => {
    setWishlist((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
  };

  const addToCart = (productId: string) => {
    setCart((current) => ({ ...current, [productId]: (current[productId] || 0) + 1 }));
    setAddedProduct(productId);
    window.setTimeout(() => setAddedProduct((current) => current === productId ? null : current), 1200);
  };

  return (
    <div className="products-page">
      <div className="products-page__topbar">
        <Link href="/" className="products-page__brand" aria-label="Back to Tribull home">
          <img src="/products/logo.png" alt="TRIBULL" />
        </Link>
        <div className="products-page__top-actions">
          <button className="products-page__top-icon" aria-label="Wishlist">
            <Heart size={19} strokeWidth={1.7} />
            {wishlist.length > 0 && <span>{wishlist.length}</span>}
          </button>
          <button className="products-page__top-icon" aria-label={`${cartCount} items in cart`}>
            <ShoppingCart size={19} strokeWidth={1.7} />
            <span>{cartCount}</span>
          </button>
        </div>
      </div>

      <main className="products-page__content">
        <section className="product-category-tabs" aria-label="Product categories">
          {categories.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              className={`product-category-tab ${selectedCategory === id ? "is-active" : ""}`}
              onClick={() => setSelectedCategory(id)}
              aria-pressed={selectedCategory === id}
            >
              <span className="product-category-tab__icon"><img src={icon} alt="" /></span>
              <span>{label}</span>
            </button>
          ))}
        </section>

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
              <article className="catalog-product-card" key={product.id}>
                <div className="catalog-product-card__image">
                  <img src={product.image} alt={product.name} loading="lazy" />
                  <button
                    type="button"
                    className={`catalog-product-card__wishlist ${isWishlisted ? "is-active" : ""}`}
                    onClick={() => toggleWishlist(product.id)}
                    aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                    aria-pressed={isWishlisted}
                  >
                    <Heart size={21} fill={isWishlisted ? "currentColor" : "none"} strokeWidth={1.8} />
                  </button>
                </div>
                <div className="catalog-product-card__body">
                  <div>
                    <h2>{product.name}</h2>
                    <p>{formatPrice(product.price)}</p>
                  </div>
                  <button type="button" className={`catalog-product-card__cart ${isAdded ? "is-added" : ""}`} onClick={() => addToCart(product.id)} aria-label={isAdded ? `${product.name} added to cart` : `Add ${product.name} to cart`}>
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
