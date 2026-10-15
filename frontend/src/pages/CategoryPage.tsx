import { ArrowUpRight, Check, Heart, ShoppingCart } from "lucide-react";
import { Link, useParams } from "wouter";
import { apiFetch } from "../lib/api";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { useEffect, useMemo, useRef, useState } from "react";
import { animateAddToWishlist } from "../lib/wishlistAnimation";
import { defaultCategoryHierarchy, getStorefrontCategoryHierarchy, useCategoryHierarchy, type CategoryHierarchy } from "../lib/categoryHierarchy";
import { loadCategoryBanner } from "../lib/categoryBanners";
import MobileCategoryMenu from "../components/MobileCategoryMenu";
import HeaderActions from "../components/HeaderActions";
import ProductPrice from "../components/ProductPrice";

export type CategoryProduct = {
  id: string;
  name: string;
  category?: string;
  price: string;
  image: string;
  originalPrice?: number | null;
  productType?: string;
};

type CategoryDefinition = {
  title: string;
  subtitle: string;
  image?: string;
  subcategories: { slug: string; label: string; image: string }[];
};

const categoryHierarchyFallback: CategoryHierarchy = defaultCategoryHierarchy;
const existingHeroBanners: Record<string, string> = {
  cinema: "/products/hero.png",
  sports: "/products/sportsbanner.png",
  games: "/products/game banner.png",
  motorsports: "/products/motosportsbanner.png",
};

function normalizeCategorySlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function liveCategoryDefinition(targetSlug: string, hierarchy: CategoryHierarchy): CategoryDefinition | undefined {
  const main = hierarchy.main.find((category) => normalizeCategorySlug(category.value) === targetSlug || normalizeCategorySlug(category.label) === targetSlug);
  if (!main) return undefined;
  const subcategories = hierarchy.subcategories[main.value] || [];
  return {
    title: main.label,
    subtitle: "Curated collection",
    image: main.image,
    subcategories: subcategories.map((subcategory) => ({
      slug: normalizeCategorySlug(subcategory.value),
      label: subcategory.label,
      image: subcategory.image || "/products/front-white.png",
    })),
  };
}

function Reveal({
  children,
  variant = "up",
  stagger = false,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  variant?: "up" | "left" | "right" | "scale" | "blur";
  stagger?: boolean;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  const base =
    variant === "up" ? "reveal-hidden" :
    variant === "left" ? "reveal-hidden-left" :
    variant === "right" ? "reveal-hidden-right" :
    variant === "scale" ? "reveal-scale-in" : "reveal-blur-in";
  return (
    <div
      ref={ref}
      className={`${base} ${stagger ? "reveal-stagger" : ""} ${visible ? "reveal-visible" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

interface CategoryHeroProps {
  title: string;
  subtitle: string;
  description?: string;
  image: string;
}

function CategoryHero({ title, subtitle, description, image }: CategoryHeroProps) {
  const heroImgRef = useRef<HTMLImageElement>(null);
  const heroCopyRef = useRef<HTMLDivElement>(null);
  const heroStampRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 800) {
          if (heroImgRef.current) heroImgRef.current.style.transform = `translate3d(0, ${y * 0.22}px, 0) scale(1.04)`;
          if (heroCopyRef.current) heroCopyRef.current.style.transform = `translate3d(0, ${y * 0.1}px, 0)`;
          if (heroStampRef.current) heroStampRef.current.style.transform = `translate3d(0, ${y * 0.16}px, 0) rotate(${y * 0.04}deg)`;
        }
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="hero category-hero-section" aria-label={`${title} collection`}>
      <div className="hero__images">
        <div className="hero__image">
          {image && <img ref={heroImgRef} src={image} alt={`${title} collection hero`} />}
        </div>
      </div>
      <div className="hero__wash" />
      <div className="hero__copy" ref={heroCopyRef}>
        <Reveal variant="blur" delay={0.1}>
          <p className="eyebrow">{subtitle}</p>
        </Reveal>
        <Reveal variant="blur" delay={0.25}>
          <h1>{title}<br /><em>Collection</em></h1>
        </Reveal>
        {description && (
          <Reveal variant="up" delay={0.5}>
            <p className="hero-description">{description}</p>
          </Reveal>
        )}
      </div>
      <div className="hero__stamp float-fast" ref={heroStampRef}>
        {title.toUpperCase()}<br />
        <span>EXCLUSIVE</span>
      </div>
    </section>
  );
}

function ProductCard({ item, delay = 0, isWishlisted, onWishlist, onAddToCart, isAdded }: { item: CategoryProduct; delay?: number; isWishlisted: boolean; onWishlist: (source: HTMLElement) => void; onAddToCart: (source: HTMLElement) => void; isAdded: boolean }) {
  const { ref, visible } = useScrollReveal<HTMLElement>();
  const productLink = `/product/${encodeURIComponent(item.id)}`;

  return (
    <Link href={productLink} className="block h-full">
      <article
        ref={ref}
        className={`category-page__card category-cinema-product reveal-scale-in ${visible ? "reveal-visible" : ""} cursor-pointer hover:shadow-lg transition-shadow`}
        style={{ transitionDelay: `${delay}s`, animationDelay: `${delay}s` }}
      >
        <div className="category-catalog-card__image-wrap">
          <img src={item.image} alt={item.name} className="category-page__image product-image-primary" />
          {getShowcaseProductHoverImage(item.image) && (
            <img src={getShowcaseProductHoverImage(item.image)} alt="" aria-hidden="true" className="category-page__image product-image-hover" />
          )}
          <button
            type="button"
            className={`category-catalog-card__wishlist ${isWishlisted ? "is-active" : ""}`}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onWishlist(event.currentTarget); }}
            aria-label={isWishlisted ? `Remove ${item.name} from wishlist` : `Add ${item.name} to wishlist`}
            aria-pressed={isWishlisted}
          >
            <Heart size={19} fill={isWishlisted ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            className={`category-catalog-card__cart ${isAdded ? "is-added" : ""}`}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onAddToCart(); }}
            aria-label={isAdded ? `${item.name} added to cart` : `Add ${item.name} to cart`}
          >
            {isAdded ? <Check size={17} /> : <ShoppingCart size={17} />}
          </button>
        </div>
        <div className="category-page__meta">
          <div>
            <h2>{item.name}</h2>
            <ProductPrice sellingPrice={item.price} originalPrice={item.originalPrice} productName={item.name} />
          </div>
        </div>
      </article>
    </Link>
  );
}

function GlobalNavigation() {
  return <StorefrontHeader />;
}

function DynamicCategoryNav({ categorySlug, hierarchy }: { categorySlug: string; hierarchy: CategoryHierarchy }) {
  const definition = liveCategoryDefinition(categorySlug, hierarchy);
  if (!definition) return null;
  const visibleSubcategories = definition.subcategories
    .filter(({ slug }) => slug !== selectedSubcategory)
    .slice(0, selectedSubcategory ? 5 : undefined);

  return (
    <nav className="category-nav cinema-category-nav" aria-label={`${definition.title} categories`}>
      <div className="category-nav__track">
        {visibleSubcategories.map(({ label, slug, image }) => (
          <Link key={slug} className="category-nav__item" href={`/category/${categorySlug}/${slug}`}>
            <span className="category-nav__image"><img src={image} alt="" /></span>
            <span className="category-nav__label">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

type CatalogSort = "featured" | "newest" | "low" | "high" | "selling";
type CatalogFilter = "oversized" | "hoodie";
const catalogFilters: { id: CatalogFilter; label: string; icon: string }[] = [
  { id: "oversized", label: "Oversized", icon: "/products/oversizedicon.png" },
  { id: "hoodie", label: "Hoodie", icon: "/products/hoodieicon.png" },
];
const hoodieProducts = defaultProducts.filter((product) => product.category === "hoodie");
const hoodieColorVariants: CategoryProduct[] = hoodieProducts.slice(0, 4).map((product) => ({
  id: `${product.id}-white`,
  name: `${product.name} - White`,
  category: product.category,
  price: `₹${product.price.toLocaleString("en-IN")}`,
  image: getShowcaseProductImage(3),
}));

function CategoryProductsView({ categorySlug, entrySlug }: { categorySlug: string; entrySlug: string }) {
  const [selectedTab, setSelectedTab] = useState<CatalogTab>("round-neck");
  const [sort, setSort] = useState<CatalogSort>("featured");
  const [storedCatalog, setStoredCatalog] = useState<CategoryProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem("tribull-wishlist") || "[]") as string[]; } catch { return []; }
  });
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try { return JSON.parse(window.localStorage.getItem("tribull-cart") || "{}") as Record<string, number>; } catch { return {}; }
  });
  const [addedProduct, setAddedProduct] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStoredCatalog([]);
    setProductsLoading(true);
    const params = new URLSearchParams({ mainCategory: categorySlug, subcategory: entrySlug });
    const loadProducts = () => apiFetch(`/api/products?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load category products.");
        return await response.json() as { id: string; name: string; price: number; compareAt?: number | null; image: string; productType?: string }[];
      })
      .then((products) => {
        if (active) {
          setStoredCatalog(products.map((product) => ({
            id: product.id,
            name: product.name,
            price: `₹${product.price.toLocaleString("en-IN")}`,
            image: product.image,
            originalPrice: product.compareAt,
            productType: product.productType,
          })));
          setProductsLoading(false);
        }
      })
      .catch((error: unknown) => {
        console.error("Category product request failed.", error);
        if (active) setProductsLoading(false);
      });
    void loadProducts();
    window.addEventListener("tribull-products-updated", loadProducts);
    return () => {
      active = false;
      window.removeEventListener("tribull-products-updated", loadProducts);
    };
  }, [categorySlug, entrySlug]);

  useEffect(() => {
    const syncWishlist = () => {
      try {
        setWishlist(JSON.parse(window.localStorage.getItem("tribull-wishlist") || "[]") as string[]);
      } catch {
        setWishlist([]);
      }
    };
    window.addEventListener("tribull-wishlist-updated", syncWishlist);
    window.addEventListener("storage", syncWishlist);
    return () => {
      window.removeEventListener("tribull-wishlist-updated", syncWishlist);
      window.removeEventListener("storage", syncWishlist);
    };
  }, []);

  const visibleCatalog = useMemo(() => {
    const items = storedCatalog.filter((product) => product.productType === selectedTab);
    const price = (value: string) => Number(value.replace(/[^0-9]/g, ""));
    if (sort === "low") items.sort((a, b) => price(a.price) - price(b.price));
    if (sort === "high") items.sort((a, b) => price(b.price) - price(a.price));
    if (sort === "newest") items.reverse();
    if (sort === "selling") items.sort((a, b) => b.name.length - a.name.length);
    return items;
  }, [storedCatalog, selectedTab, sort]);

  const productKey = (item: CategoryProduct) => item.id || `${categorySlug}-${entrySlug}-${item.name}`;

  const addToCart = (item: CategoryProduct) => {
    const key = productKey(item);
    try {
      const cartItems = JSON.parse(window.localStorage.getItem("tribull-cart-items") || "{}");
      window.localStorage.setItem("tribull-cart-items", JSON.stringify({
        ...cartItems,
        [key]: { name: item.name, price: Number(item.price.replace(/[^0-9]/g, "")), image: item.image },
      }));
    } catch {
      // Keep the existing quantity cart usable if metadata storage is unavailable.
    }
    const nextCart = { ...cart, [key]: (cart[key] || 0) + 1 };
    setCart(nextCart);
    window.localStorage.setItem("tribull-cart", JSON.stringify(nextCart));
    window.dispatchEvent(new Event("tribull-cart-updated"));
    setAddedProduct(key);
    window.setTimeout(() => setAddedProduct((current) => current === key ? null : current), 1200);
  };

  return (
    <>
      <div className="category-catalog-controls">
        <div className="category-catalog-tabs" aria-label="Filter products by style">
          {catalogFilters.map(({ id, label, icon }) => (
            <button key={id} type="button" className={`category-catalog-tab ${filter === id ? "is-active" : ""}`} onClick={() => setFilter(id)} aria-pressed={filter === id}>
              <img src={icon} alt="" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="category-catalog-toolbar">
        <p>Showing: <strong>{filter}</strong> ({visibleCatalog.length})</p>
        <label>
          <span>Sort by:</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as CatalogSort)} aria-label="Sort products">
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option>
            <option value="selling">Best Selling</option>
          </select>
        </label>
      </div>
      <div className="category-page__grid category-page__grid--products">
        {productsLoading ? <p className="header-empty-state">Loading products...</p> : visibleCatalog.length === 0 ? <p className="header-empty-state">No products found</p> : visibleCatalog.map((item, index) => {
          const key = productKey(item);
          return <ProductCard key={item.id} item={item} delay={0.04 * index} isWishlisted={wishlist.includes(key)} onWishlist={(source) => setWishlist((current) => { const isAdding = !current.includes(key); const nextWishlist = isAdding ? [...current, key] : current.filter((id) => id !== key); if (isAdding) animateAddToWishlist(source); window.localStorage.setItem("tribull-wishlist", JSON.stringify(nextWishlist)); window.dispatchEvent(new Event("tribull-wishlist-updated")); return nextWishlist; })} onAddToCart={(source) => addToCart(item, source)} isAdded={addedProduct === key} />;
        })}
      </div>
    </>
  );
}

function DynamicBestSelling({ categorySlug, entrySlugs }: { categorySlug: string; entrySlugs: string[] }) {
  const [products, setProducts] = useState<CategoryProduct[]>([]);
  const [loading, setLoading] = useState(entrySlugs.length > 0);
  const entrySlugsKey = entrySlugs.join("\u0000");

  useEffect(() => {
    const requestedSubcategories = entrySlugsKey ? entrySlugsKey.split("\u0000") : [];
    let active = true;
    if (requestedSubcategories.length === 0) {
      setProducts([]);
      setLoading(false);
      return () => { active = false; };
    }

    setProducts([]);
    setLoading(true);
    const loadProducts = () => {
      void Promise.all(requestedSubcategories.map(async (entrySlug) => {
        const params = new URLSearchParams({ mainCategory: categorySlug, subcategory: entrySlug });
        const response = await apiFetch(`/api/products?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load category products.");
        return await response.json() as { id: string; name: string; price: number; compareAt?: number | null; image: string }[];
      }))
        .then((result) => {
          if (active) {
            setProducts(result.flat().map((product) => ({
              id: product.id,
              name: product.name,
              price: `₹${product.price.toLocaleString("en-IN")}`,
              image: product.image,
              originalPrice: product.compareAt,
            })));
            setLoading(false);
          }
        })
        .catch((error: unknown) => {
          console.error("Category product request failed.", error);
          if (active) setLoading(false);
        });
    };
    loadProducts();
    window.addEventListener("tribull-products-updated", loadProducts);
    return () => {
      active = false;
      window.removeEventListener("tribull-products-updated", loadProducts);
    };
  }, [categorySlug, entrySlugsKey]);

  if (loading) return <p className="header-empty-state">Loading products...</p>;
  if (products.length === 0) return <p className="header-empty-state">No products found</p>;

  return (
    <div className="category-best-selling-grid">
      {products.map((item) => (
        <Link key={item.id} href={`/product/${encodeURIComponent(item.id)}`} className="product-card">
          <div className="product-card__image"><img src={item.image} alt={item.name} loading="lazy" /></div>
        </Link>
      ))}
    </div>
  );
}

export default function CategoryPage() {
  const { slug = "cinema", lang } = useParams<{ slug?: string; lang?: string }>();
  const fetchedHierarchy = useCategoryHierarchy(categoryHierarchyFallback);
  const hierarchy = getStorefrontCategoryHierarchy(fetchedHierarchy);
  const routeSlug = normalizeCategorySlug(slug || "cinema");
  const categorySlug = normalizeCategorySlug(hierarchy.main.find((category) =>
    normalizeCategorySlug(category.value) === routeSlug || normalizeCategorySlug(category.label) === routeSlug,
  )?.value || routeSlug);
  const activeDefinitions = Object.fromEntries(hierarchy.main.map(({ value }) => [normalizeCategorySlug(value), liveCategoryDefinition(normalizeCategorySlug(value), hierarchy)])) as Record<string, CategoryDefinition | undefined>;
  const categoryImage = hierarchy.main.find((category) => normalizeCategorySlug(category.value) === categorySlug)?.image || "";
  const heroFallback = existingHeroBanners[categorySlug] || categoryImage;
  const [heroBanner, setHeroBanner] = useState(heroFallback);
  useEffect(() => {
    let active = true;
    setHeroBanner(heroFallback);
    void loadCategoryBanner(categorySlug)
      .then((banner) => {
        if (active) setHeroBanner(banner?.image || categoryImage);
      })
      .catch((error: unknown) => {
        console.error("Category banner request failed.", error);
      });
    return () => { active = false; };
  }, [categorySlug, categoryImage, heroFallback]);

  if (!hierarchy.loaded) return <div className="p-8">Loading category...</div>;
  if (!activeDefinitions[categorySlug]) return <div className="p-8">Category not found.</div>;

  if (categorySlug === "cinema" && !lang) {
    const definition = activeDefinitions.cinema!;
    const defaultSubcat = definition.subcategories[0];
    const entrySlug = defaultSubcat?.slug || "";

    return (
      <div className="subcategory-page">
        <GlobalNavigation />
        <DynamicCategoryNav categorySlug="cinema" hierarchy={hierarchy} />

        <CategoryHero
          title={definition.title}
          subtitle={definition.subtitle}
          image={heroBanner}
        />

        <div className="section-heading category-best-selling-heading">
          <h2 style={{ font: "700 clamp(18px, 2vw, 30px)/1.15 Montserrat,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tribull-green)" }}>Best Selling</h2>
        </div>

        <div className="category-best-selling-grid">
          <DynamicBestSelling categorySlug={categorySlug} entrySlugs={[entrySlug]} />
        </div>
      </div>
    );
  }

  if (categorySlug === "sports" && !lang) {
    const definition = activeDefinitions.sports!;
    const defaultSubcat = definition.subcategories[0];
    const entrySlug = defaultSubcat.slug;

    return (
      <div className="subcategory-page">
        <GlobalNavigation />
        <DynamicCategoryNav categorySlug="sports" hierarchy={hierarchy} />

        <CategoryHero
          title={definition.title}
          subtitle={definition.subtitle}
          image={heroBanner}
        />

        <div className="section-heading category-best-selling-heading">
          <h2 style={{ font: "700 clamp(18px, 2vw, 30px)/1.15 Montserrat,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tribull-green)" }}>Best Selling</h2>
        </div>

        <div className="category-best-selling-grid">
          <DynamicBestSelling categorySlug={categorySlug} entrySlugs={[entrySlug]} />
        </div>
      </div>
    );
  }

  if (categorySlug === "motorsports" && !lang) {
    const definition = activeDefinitions.motorsports!;
    const defaultSubcat = definition.subcategories[0];
    const entrySlug = defaultSubcat.slug;

    return (
      <div className="subcategory-page">
        <GlobalNavigation />
        <DynamicCategoryNav categorySlug="motorsports" hierarchy={hierarchy} />

        <CategoryHero
          title={definition.title}
          subtitle={definition.subtitle}
          image={heroBanner}
        />

        <div className="section-heading category-best-selling-heading">
          <h2 style={{ font: "700 clamp(18px, 2vw, 30px)/1.15 Montserrat,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tribull-green)" }}>Best Selling</h2>
        </div>

        <div className="category-best-selling-grid">
          <DynamicBestSelling categorySlug={categorySlug} entrySlugs={[entrySlug]} />
        </div>
      </div>
    );
  }

  if (categorySlug === "games" && !lang) {
    const definition = activeDefinitions.games!;
    const defaultSubcat = definition.subcategories[0];
    const entrySlug = defaultSubcat.slug;

    return (
      <div className="subcategory-page">
        <GlobalNavigation />
        <DynamicCategoryNav categorySlug="games" hierarchy={hierarchy} />

        <CategoryHero
          title={definition.title}
          subtitle={definition.subtitle}
          image={heroBanner}
        />

        <div className="section-heading category-best-selling-heading">
          <h2 style={{ font: "700 clamp(18px, 2vw, 30px)/1.15 Montserrat,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tribull-green)" }}>Best Selling</h2>
        </div>

        <div className="category-best-selling-grid">
          <DynamicBestSelling categorySlug={categorySlug} entrySlugs={[entrySlug]} />
        </div>
      </div>
    );
  }

  if (lang) {
    const selectedSlug = normalizeCategorySlug(String(lang));
    const category = activeDefinitions[categorySlug];
    if (!category) return <div className="p-8">Category not found.</div>;
    const entry = category.subcategories.find((item) => item.slug === selectedSlug || normalizeCategorySlug(item.label) === selectedSlug);
    if (!entry) return <div className="p-8">Category not found.</div>;
    const entrySlug = entry.slug;

    return (
      <div className="category-products-page">
        <GlobalNavigation />
        <DynamicCategoryNav categorySlug={categorySlug} hierarchy={hierarchy} />

        <div className="category-hero" aria-label={`${entry.label} featured collection`}>
          <div className="category-hero__visual">
            <img src={entry.image} alt={entry.label} />
          </div>
          <div className="category-hero__content">
            <p className="category-page__eyebrow">Curated drop</p>
            <h2>{entry.label}</h2>
            <p>Premium statement pieces designed for the {entry.label.toLowerCase()} lifestyle.</p>
          </div>
        </div>

        <CategoryProductsView categorySlug={categorySlug} entrySlug={entrySlug} />
      </div>
    );
  }

  const fallback = activeDefinitions[categorySlug];
  if (!fallback) return <div className="p-8">Category not found.</div>;
  return (
    <div className="subcategory-page">
      <GlobalNavigation />
      <DynamicCategoryNav categorySlug={categorySlug} hierarchy={hierarchy} />

      <CategoryHero
        title={fallback.title}
        subtitle={fallback.subtitle}
        image={heroBanner}
      />

      <div className="section-heading category-best-selling-heading">
        <h2 style={{ font: "700 clamp(18px, 2vw, 30px)/1.15 Montserrat,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tribull-green)" }}>Best Selling</h2>
      </div>

      <DynamicBestSelling categorySlug={categorySlug} entrySlugs={fallback.subcategories.map((subcategory) => subcategory.slug)} />
    </div>
  );
}
