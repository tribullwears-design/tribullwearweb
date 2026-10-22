import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import StorefrontHeader from "../components/StorefrontHeader";
import ProductPrice from "../components/ProductPrice";
import type { Product } from "../../../shared/products";
import { fetchProducts, getCachedProducts, refreshProducts } from "../lib/products";
import { resolveOriginalPrice } from "../lib/productPrice";
import { getProductSearchCategory, getSearchableProducts, matchesProductSearch } from "../lib/productSearch";

type SortOrder = "relevance" | "price-low" | "price-high" | "newest";

function SearchResultCard({ product }: { product: Product }) {
  const category = getProductSearchCategory(product);

  return (
    <Link
      href={`/product/${encodeURIComponent(product.id)}`}
      className="search-page__card-link"
    >
      <article className="search-page__card parallax-tilt">
        <div className="search-page__image">
          <img src={product.image} alt={product.name} className="product-image-primary" decoding="async" />
        </div>
        <div className="search-page__card-info">
          <span>{category.replace(/-/g, " ")}</span>
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
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(getCachedProducts);
  const [sortOrder, setSortOrder] = useState<SortOrder>("relevance");

  useEffect(() => {
    let active = true;
    const syncProducts = (refresh = false) => (refresh ? refreshProducts() : fetchProducts())
      .then((products) => {
        if (active) setCatalogProducts(products);
      })
      .catch((error: unknown) => {
        console.error("Could not load products for search results.", error);
      });
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
  const productsByCategory = Array.from(new Set(matchingProducts.map(getProductSearchCategory)), (category) => ({
    category,
    products: matchingProducts.filter((product) => getProductSearchCategory(product) === category),
  }));

  return (
    <div className="search-page">
      <StorefrontHeader />

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
                <section className="search-page__group" key={category} aria-label={`${category.replace(/-/g, " ")} products`}>
                  <h2>{category.replace(/-/g, " ")}</h2>
                  <div className="search-page__grid">
                    {products.map((product) => (
                      <SearchResultCard key={product.id} product={product} />
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
