import { ArrowLeft, Check, Heart, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import HeaderActions from "../components/HeaderActions";
import ProductPrice from "../components/ProductPrice";
import { animateAddToCart } from "../lib/cartAnimation";
import { animateAddToWishlist } from "../lib/wishlistAnimation";
import { allProducts } from "../lib/allProducts";
import { resolveOriginalPrice } from "../lib/productPrice";

function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function AllProductsPage() {
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage("tribull-wishlist", []));
  const [cart, setCart] = useState<Record<string, number>>(() => readStorage("tribull-cart", {}));
  const [addedProduct, setAddedProduct] = useState<string | null>(null);

  useEffect(() => {
    const syncWishlist = () => setWishlist(readStorage("tribull-wishlist", []));
    const syncCart = () => setCart(readStorage("tribull-cart", {}));
    window.addEventListener("tribull-wishlist-updated", syncWishlist);
    window.addEventListener("tribull-cart-updated", syncCart);
    window.addEventListener("storage", syncWishlist);
    window.addEventListener("storage", syncCart);
    return () => {
      window.removeEventListener("tribull-wishlist-updated", syncWishlist);
      window.removeEventListener("tribull-cart-updated", syncCart);
      window.removeEventListener("storage", syncWishlist);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  const toggleWishlist = (productId: string, source: HTMLElement) => {
    const isAdding = !wishlist.includes(productId);
    const nextWishlist = isAdding ? [...wishlist, productId] : wishlist.filter((id) => id !== productId);
    if (isAdding) animateAddToWishlist(source);
    window.localStorage.setItem("tribull-wishlist", JSON.stringify(nextWishlist));
    setWishlist(nextWishlist);
    window.dispatchEvent(new Event("tribull-wishlist-updated"));
  };

  const addToCart = (productId: string, source: HTMLElement) => {
    const product = allProducts.find((item) => item.id === productId);
    if (!product) return;

    try {
      const cartItems = readStorage<Record<string, unknown>>("tribull-cart-items", {});
      window.localStorage.setItem("tribull-cart-items", JSON.stringify({
        ...cartItems,
        [productId]: {
          name: product.name,
          price: Number(product.price.replace(/[^0-9]/g, "")),
          originalPrice: resolveOriginalPrice(product),
          image: product.image,
        },
      }));
    } catch (error) {
      console.error("Could not save product details to the cart.", error);
    }

    const nextCart = { ...cart, [productId]: (cart[productId] || 0) + 1 };
    window.localStorage.setItem("tribull-cart", JSON.stringify(nextCart));
    setCart(nextCart);
    window.dispatchEvent(new Event("tribull-cart-updated"));
    animateAddToCart(source, product.image);
    setAddedProduct(productId);
    window.setTimeout(() => setAddedProduct((current) => current === productId ? null : current), 1200);
  };

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
  };

  return (
    <div className="all-products-page">
      <header className="all-products-header">
        <button type="button" className="all-products-back" onClick={goBack} aria-label="Go back">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>

        <Link href="/" className="all-products-brand" aria-label="Back to home">
          <img src="/products/logo.png" alt="TRIBULL" />
        </Link>

        <HeaderActions />
      </header>

      <main className="all-products-content">
        <div className="all-products-heading-wrap">
          <p className="all-products-kicker">The foundation</p>
          <h1>All Products</h1>
        </div>

        <section className="all-products-grid" aria-label="All products grid">
          {allProducts.map((product) => (
            <article className="all-products-card" key={product.name}>
              <div className="all-products-card__image">
                <img src={product.image} alt={product.name} loading="lazy" />
                <button
                  className={`all-products-card__wishlist ${wishlist.includes(product.id) ? "is-active" : ""}`}
                  type="button"
                  aria-label={wishlist.includes(product.id) ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                  aria-pressed={wishlist.includes(product.id)}
                  onClick={(event) => toggleWishlist(product.id, event.currentTarget)}
                >
                  <Heart size={18} fill={wishlist.includes(product.id) ? "currentColor" : "none"} />
                </button>
                <button
                  className={`all-products-card__cart ${addedProduct === product.id ? "is-added" : ""}`}
                  type="button"
                  aria-label={`Add ${product.name} to cart`}
                  onClick={(event) => addToCart(product.id, event.currentTarget)}
                >
                  {addedProduct === product.id ? <Check size={17} /> : <ShoppingCart size={17} />}
                </button>
              </div>
              <div className="all-products-card__meta">
                <h2>{product.name}</h2>
                <ProductPrice sellingPrice={product.price} originalPrice={resolveOriginalPrice(product)} productName={product.name} />
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
