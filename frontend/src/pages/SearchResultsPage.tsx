import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Search } from "lucide-react";
import StorefrontHeader from "../components/StorefrontHeader";
import ProductPrice from "../components/ProductPrice";
import { useScrollReveal } from "../hooks/useScrollReveal";
import type { Product } from "../../../shared/products";
import { fetchProducts, refreshProducts } from "../lib/products";
import { resolveOriginalPrice } from "../lib/productPrice";
import { getProductSearchCategory, getSearchableProducts, matchesProductSearch } from "../lib/productSearch";

type SortOrder = "relevance" | "price-low" | "price-high" | "newest";
type SearchCategory = "oversized" | "hoodie";

function SearchResultCard({
  product,
  index,
}: {
  product: Product;
  index: number;
}) {
  const { ref, visible } = useScrollReveal<HTMLElement>();
  const category = getProductSearchCategory(product);

  return (
    <Link
      href={`/product/${encodeURIComponent(product.id)}`}
      className="search-page__card-link"
    >
      <article
        ref={ref}
        className={`search-page__card reveal-scale-in parallax-tilt${visible ? " reveal-visible" : ""}`}
        style={{ transitionDelay: `${0.08 * index}s` }}
      >
        <div className="search-page__image">
          <img src={product.image} alt={product.name} className="product-image-primary" loading="lazy" />
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
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>("relevance");

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    const syncSearchFromLocation = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const category = searchParams.get("category");
      setQuery(searchParams.get("q")?.trim() || "");
      setSelectedCategory(category === "oversized" || category === "hoodie" ? category : null);
    };
    const selectCategory = (event: Event) => {
      const { category, query } = (event as CustomEvent<{ category: SearchCategory; query: string }>).detail;
      setSelectedCategory(category);
      setQuery(query);
      setSearchInput(query);
    };
    window.addEventListener("popstate", syncSearchFromLocation);
    window.addEventListener("tribull-search-category-selected", selectCategory);
    return () => {
      window.removeEventListener("popstate", syncSearchFromLocation);
      window.removeEventListener("tribull-search-category-selected", selectCategory);
    };
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = searchInput.trim();
    setQuery(nextQuery);
    const searchParams = new URLSearchParams();
    if (selectedCategory) searchParams.set("category", selectedCategory);
    if (nextQuery) searchParams.set("q", nextQuery);
    const search = searchParams.toString();
    setLocation(search ? `/search?${search}` : "/search");
  };

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
    const refreshCatalog = () => syncProducts(true);
    window.addEventListener("tribull-products-updated", refreshCatalog);
    return () => {
      active = false;
      window.removeEventListener("tribull-products-updated", refreshCatalog);
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

    const categoryMatches = selectedCategory
      ? matches.filter((product) => getProductSearchCategory(product) === selectedCategory)
      : matches;

    return [...categoryMatches].sort((first, second) => {
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
          <h1>{query ? `Results for “${query}”` : selectedCategory === "oversized" ? "Oversized" : selectedCategory === "hoodie" ? "Hoodie" : "Oversized & Hoodie"}</h1>
          <form className="search-page__search-form" onSubmit={submitSearch} role="search">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Search products or categories"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search products or categories"
            />
            <button type="submit">Search</button>
          </form>
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
