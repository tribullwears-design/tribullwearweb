import { ArrowLeft, Heart, ShoppingCart } from "lucide-react";
import { Link } from "wouter";

type AllProduct = {
  name: string;
  price: string;
  image: string;
};

const products: AllProduct[] = [
  { name: "Round Neck Classic", price: "₹599", image: "/products/front-white.png" },
  { name: "Round Neck Graphic", price: "₹649", image: "/products/back-black.png" },
  { name: "Daily Oversized Tee", price: "₹799", image: "/products/essential-tshirts.png" },
  { name: "Heavyweight Essential", price: "₹899", image: "/products/flat-white.png" },
  { name: "Men's Shirt", price: "₹699", image: "/products/essential-mens-shirt.png" },
  { name: "Acid Wash Oversized", price: "₹1,049", image: "/products/essential-oversized.png" },
  { name: "Street Oversized", price: "₹949", image: "/products/batman.jpg" },
  { name: "Hoodie Essential", price: "₹1,299", image: "/products/essential-hoodies.png" },
  { name: "Washed Tee", price: "₹999", image: "/products/tomandjerry.jpg" },
  { name: "Premium Oversized", price: "₹1,099", image: "/products/hanger-white.png" },
];

export default function AllProductsPage() {
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

        <div className="all-products-actions">
          <button type="button" className="all-products-icon" aria-label="Wishlist">
            <Heart size={18} strokeWidth={1.8} />
          </button>
          <button type="button" className="all-products-icon" aria-label="Cart">
            <ShoppingCart size={18} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <main className="all-products-content">
        <div className="all-products-heading-wrap">
          <p className="all-products-kicker">The foundation</p>
          <h1>All Products</h1>
        </div>

        <section className="all-products-grid" aria-label="All products grid">
          {products.map((product) => (
            <article className="all-products-card" key={product.name}>
              <div className="all-products-card__image">
                <img src={product.image} alt={product.name} loading="lazy" />
              </div>
              <div className="all-products-card__meta">
                <h2>{product.name}</h2>
                <p>{product.price}</p>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
