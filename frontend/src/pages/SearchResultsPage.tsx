import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import HeaderActions from "../components/HeaderActions";
import ProductPrice from "../components/ProductPrice";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { defaultProducts, type Product } from "../../../shared/products";
import { fetchProducts } from "../lib/products";
import { resolveOriginalPrice } from "../lib/productPrice";
import { getProductSearchCategory, getSearchableProducts, matchesProductSearch } from "../lib/productSearch";

type SortOrder = "relevance" | "price-low" | "price-high" | "newest";

const searchProductImages = {
  oversized: [
    { primary: "/products/Black T-Shirt Front and Back Mockup.png", hover: "/products/B1.jpg.jpeg" },
    { primary: "/products/Blank White T-Shirt Front and Back Views.png", hover: "/products/W1.jpg.jpeg" },
  ],
  hoodie: [
    { primary: "/products/Plain White Hoodies, Front and Back.png", hover: "/products/Black Hoodie Front and Back Mockup.png" },
    { primary: "/products/Black Hoodie Front and Back Mockup.png", hover: "/products/Plain White Hoodies, Front and Back.png" },
  ],
} as const;

function SearchResultCard({
  product,
  index,
}: {
  product: Product & { displayImage: string; hoverImage: string };
  index: number;
}) {
  const { ref, visible } = useScrollReveal<HTMLElement>();

  return (
    <Link
      href={`/product/search-${index}?name=${encodeURIComponent(product.name)}&price=${encodeURIComponent(`₹${product.price}`)}&originalPrice=${encodeURIComponent(resolveOriginalPrice(product) ?? "")}&image=${encodeURIComponent(product.displayImage)}`}
      className="search-page__card-link"
    >
      <article
        ref={ref}
        className={`search-page__card reveal-scale-in parallax-tilt${visible ? " reveal-visible" : ""}`}
        style={{ transitionDelay: `${0.08 * index}s` }}
      >
        <div className="search-page__image">
          <img src={product.displayImage} alt={product.name} className="product-image-primary" loading="lazy" />
          <img src={product.hoverImage} alt="" aria-hidden="true" className="product-image-hover" loading="lazy" />
        </div>
        <div className="search-page__card-info">
          <span>{getProductSearchCategory(product) === "oversized" ? "Oversized" : "Hoodie"}</span>
          <h2>{product.name}</h2>
          <ProductPrice
            sellingPrice={product.price}
            originalPrice={resolveOriginalPrice(product)}
            productName={product.name}
          />
        </div>
      </article>
    </Link>
  );
}

export default function SearchResultsPage() {
  const query = new URLSearchParams(window.location.search).get("q")?.trim() || "";
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(defaultProducts);
  const [sortOrder, setSortOrder] = useState<SortOrder>("relevance");

  useEffect(() => {
    let active = true;
    fetchProducts()
      .then((products) => {
        if (active) setCatalogProducts(products);
      })
      .catch((error: unknown) => {
        console.error("Could not load products for search results.", error);
      });
    return () => {
      active = false;
    };
  }, []);

  const supportedProducts = useMemo(
    () => getSearchableProducts(catalogProducts),
    [catalogProducts],
  );

  const matchingProducts = useMemo(() => {
    const matches = query
      ? supportedProducts.filter((product) => matchesProductSearch(product, query))
      : supportedProducts;

    return [...matches].sort((first, second) => {
      if (sortOrder === "price-low") return first.price - second.price;
      if (sortOrder === "price-high") return second.price - first.price;
      if (sortOrder === "newest") return second.created - first.created;
      return second.sold - first.sold;
    });
  }, [supportedProducts, query, sortOrder]);
  const productsWithImages = matchingProducts.map((product, index) => {
    const category = getProductSearchCategory(product);
    const variantIndex = matchingProducts
      .slice(0, index)
      .filter((previousProduct) => getProductSearchCategory(previousProduct) === category)
      .length % 2;

    return {
      ...product,
      displayImage: category ? searchProductImages[category][variantIndex].primary : product.image,
      hoverImage: category ? searchProductImages[category][variantIndex].hover : product.image,
    };
  });
  const productsByCategory = (["oversized", "hoodie"] as const).map((category) => ({
    category,
    products: productsWithImages.filter((product) => getProductSearchCategory(product) === category),
  })).filter(({ products }) => products.length > 0);

  return (
    <div className="search-page">
      <header className="search-page__header">
        <Link href="/" className="search-page__back" aria-label="Back to home">
          <ArrowLeft size={18} />
          <span>Home</span>
        </Link>
        <Link href="/" className="search-page__brand" aria-label="Tribull home">
          <img src="/products/logo.png" alt="TRIBULL" />
        </Link>
        <HeaderActions />
      </header>

      <main className="search-page__content">
        <div className="search-page__heading">
          <p>Search results</p>
          <h1>{query ? `Results for “${query}”` : "Oversized & Hoodie"}</h1>
        </div>

        <div className="search-page__toolbar">
          <span>In stock ({matchingProducts.length})</span>
          <label>
            Sort by
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
              <option value="relevance">Relevance</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>

        <div className="search-page__layout">
          {matchingProducts.length ? (
            <div className="search-page__groups">
              {productsByCategory.map(({ category, products }) => (
                <section className="search-page__group" key={category} aria-label={`${category === "oversized" ? "Oversized" : "Hoodie"} products`}>
                  <h2>{category === "oversized" ? "Oversized" : "Hoodie"}</h2>
                  <div className="search-page__grid">
                    {products.map((product, index) => (
                      <SearchResultCard key={product.id} product={product} index={index} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <section className="search-page__empty">
              <h2>No products found</h2>
              <p>Try searching for oversized or hoodie.</p>
              <Link href="/products">Browse all products</Link>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
