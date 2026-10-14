import { ArrowUpRight, Check, Heart, ShoppingCart } from "lucide-react";
import { Link, useParams } from "wouter";
import { apiFetch } from "../lib/api";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { useEffect, useMemo, useRef, useState } from "react";
import { animateAddToCart } from "../lib/cartAnimation";
import { animateAddToWishlist } from "../lib/wishlistAnimation";
import { defaultCategoryHierarchy, useCategoryHierarchy, type CategoryHierarchy } from "../lib/categoryHierarchy";
import { loadCategoryBanner } from "../lib/categoryBanners";
import StorefrontHeader from "../components/StorefrontHeader";

export type CategoryProduct = {
  id?: string;
  name: string;
  price: string;
  image: string;
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

const rotationImages = [
  "/products/back-black.png",
  "/products/flat-white.png",
  "/products/front-white.png",
  "/products/hanger-white.png",
];

export const categoryProducts: Record<string, Record<string, CategoryProduct[]>> = {
  cinema: {
    kollywood: [
      { name: "Kollywood Hero Tee", price: "₹1,699", image: rotationImages[2] },
      { name: "Kollywood Legend", price: "₹1,899", image: rotationImages[3] },
      { name: "Kollywood Power Tee", price: "₹2,099", image: rotationImages[1] },
      { name: "Kollywood Crown", price: "₹1,599", image: rotationImages[0] },      { name: "Kollywood Royale Tee", price: "₹1,749", image: rotationImages[0] },
      { name: "Kollywood Star Print", price: "₹1,999", image: rotationImages[2] },
      { name: "Kollywood Glory Tee", price: "₹1,849", image: rotationImages[3] },
      { name: "Kollywood Charm Tee", price: "₹1,679", image: rotationImages[1] },    ],
    tollywood: [
      { name: "Tollywood Charm Tee", price: "₹1,649", image: rotationImages[1] },
      { name: "Tollywood Spotlight", price: "₹1,829", image: rotationImages[0] },
      { name: "Tollywood Mass Print", price: "₹1,949", image: rotationImages[3] },
      { name: "Tollywood Cinematic", price: "₹1,579", image: rotationImages[2] },
      { name: "Tollywood Drama Queen", price: "₹1,729", image: rotationImages[2] },
      { name: "Tollywood Prestige", price: "₹1,999", image: rotationImages[0] },
      { name: "Tollywood Heritage", price: "₹1,879", image: rotationImages[1] },
      { name: "Tollywood Pulse", price: "₹1,699", image: rotationImages[3] },
    ],
    mollywood: [
      { name: "Mollywood Motion Tee", price: "₹1,739", image: rotationImages[0] },
      { name: "Mollywood Storyline", price: "₹1,899", image: rotationImages[2] },
      { name: "Mollywood Sunset Print", price: "₹2,049", image: rotationImages[1] },
      { name: "Mollywood Classic", price: "₹1,629", image: rotationImages[3] },
      { name: "Mollywood Waves Tee", price: "₹1,799", image: rotationImages[1] },
      { name: "Mollywood Breeze", price: "₹1,969", image: rotationImages[2] },
      { name: "Mollywood Vision Tee", price: "₹1,869", image: rotationImages[0] },
      { name: "Mollywood Soul Tee", price: "₹1,699", image: rotationImages[3] },
    ],
    sandalwood: [
      { name: "Sandalwood Star Tee", price: "₹1,749", image: rotationImages[3] },
      { name: "Sandalwood Reel", price: "₹1,869", image: rotationImages[1] },
      { name: "Sandalwood Heritage", price: "₹1,979", image: rotationImages[2] },
      { name: "Sandalwood Gold", price: "₹1,599", image: rotationImages[0] },
      { name: "Sandalwood Essence Tee", price: "₹1,819", image: rotationImages[2] },
      { name: "Sandalwood Pride", price: "₹1,999", image: rotationImages[3] },
      { name: "Sandalwood Breeze Tee", price: "₹1,899", image: rotationImages[0] },
      { name: "Sandalwood Spirit", price: "₹1,729", image: rotationImages[1] },
    ],
    bollywood: [
      { name: "Bollywood Dazzle Tee", price: "₹1,649", image: rotationImages[1] },
      { name: "Bollywood Shimmer", price: "₹1,849", image: rotationImages[2] },
      { name: "Bollywood Drama Tee", price: "₹1,949", image: rotationImages[3] },
      { name: "Bollywood Gold", price: "₹1,549", image: rotationImages[0] },
      { name: "Bollywood Sparkle Tee", price: "₹1,749", image: rotationImages[0] },
      { name: "Bollywood Glam", price: "₹1,999", image: rotationImages[1] },
      { name: "Bollywood Elegance Tee", price: "₹1,899", image: rotationImages[2] },
      { name: "Bollywood Charm", price: "₹1,699", image: rotationImages[3] },
    ],
    hollywood: [
      { name: "Hollywood Icon Tee", price: "₹1,599", image: rotationImages[0] },
      { name: "Hollywood Star Print", price: "₹1,799", image: rotationImages[1] },
      { name: "Hollywood Blockbuster", price: "₹1,999", image: rotationImages[2] },
      { name: "Hollywood Classic", price: "₹1,499", image: rotationImages[3] },
      { name: "Hollywood Legend Tee", price: "₹1,699", image: rotationImages[3] },
      { name: "Hollywood Prestige", price: "₹1,999", image: rotationImages[0] },
      { name: "Hollywood Premium Tee", price: "₹1,899", image: rotationImages[1] },
      { name: "Hollywood Crown", price: "₹1,699", image: rotationImages[2] },
    ],
  },
  sports: {
    cricket: [
      { name: "Cricket Power Tee", price: "₹1,699", image: rotationImages[0] },
      { name: "Cricket Captain Print", price: "₹1,899", image: rotationImages[2] },
      { name: "Cricket Match Tee", price: "₹1,979", image: rotationImages[1] },
      { name: "Cricket Pace Tee", price: "₹1,599", image: rotationImages[3] },
      { name: "Cricket Victory Tee", price: "₹1,749", image: rotationImages[1] },
      { name: "Cricket Champion", price: "₹1,999", image: rotationImages[0] },
      { name: "Cricket Glory Tee", price: "₹1,899", image: rotationImages[3] },
      { name: "Cricket Legacy", price: "₹1,729", image: rotationImages[2] },
    ],
    football: [
      { name: "Football Flow Tee", price: "₹1,729", image: rotationImages[1] },
      { name: "Football League Print", price: "₹1,949", image: rotationImages[0] },
      { name: "Football Hustle Tee", price: "₹2,099", image: rotationImages[3] },
      { name: "Football Matchday", price: "₹1,649", image: rotationImages[2] },
      { name: "Football Strike Tee", price: "₹1,799", image: rotationImages[2] },
      { name: "Football Goal Print", price: "₹1,999", image: rotationImages[1] },
      { name: "Football Elite Tee", price: "₹1,879", image: rotationImages[0] },
      { name: "Football Momentum", price: "₹1,759", image: rotationImages[3] },
    ],
    gym: [
      { name: "Gym Lift Tee", price: "₹1,579", image: rotationImages[3] },
      { name: "Gym Drive Tee", price: "₹1,799", image: rotationImages[2] },
      { name: "Gym Motion Print", price: "₹1,989", image: rotationImages[0] },
      { name: "Gym Strong Tee", price: "₹1,679", image: rotationImages[1] },
      { name: "Gym Beast Tee", price: "₹1,749", image: rotationImages[0] },
      { name: "Gym Grind Print", price: "₹1,999", image: rotationImages[3] },
      { name: "Gym Shred Tee", price: "₹1,899", image: rotationImages[2] },
      { name: "Gym Flow", price: "₹1,729", image: rotationImages[1] },
    ],
  },
  motorsports: {
    car: [
      { name: "Car Drift Tee", price: "₹1,749", image: rotationImages[0] },
      { name: "Car Racing Print", price: "₹1,999", image: rotationImages[1] },
      { name: "Car Speed Tee", price: "₹2,149", image: rotationImages[2] },
      { name: "Car Apex Tee", price: "₹1,799", image: rotationImages[3] },
      { name: "Car Turbo Tee", price: "₹1,849", image: rotationImages[3] },
      { name: "Car Nitro Print", price: "₹2,099", image: rotationImages[0] },
      { name: "Car Track Tee", price: "₹1,999", image: rotationImages[1] },
      { name: "Car Power", price: "₹1,829", image: rotationImages[2] },
    ],
    bike: [
      { name: "Bike Rush Tee", price: "₹1,699", image: rotationImages[3] },
      { name: "Bike Sprint Print", price: "₹1,949", image: rotationImages[2] },
      { name: "Bike Track Tee", price: "₹2,099", image: rotationImages[0] },
      { name: "Bike Torque Tee", price: "₹1,649", image: rotationImages[1] },
      { name: "Bike Racer Tee", price: "₹1,799", image: rotationImages[1] },
      { name: "Bike Velocity Print", price: "₹2,049", image: rotationImages[3] },
      { name: "Bike Striker Tee", price: "₹1,949", image: rotationImages[2] },
      { name: "Bike Ace", price: "₹1,729", image: rotationImages[0] },
    ],
  },
  games: {
    "pc-games": [
      { name: "PC Games Arena Tee", price: "₹1,699", image: rotationImages[0] },
      { name: "PC Games Pro Print", price: "₹1,899", image: rotationImages[2] },
      { name: "PC Games Hero Tee", price: "₹2,099", image: rotationImages[1] },
      { name: "PC Games Charge Tee", price: "₹1,599", image: rotationImages[3] },
      { name: "PC Games Quest Tee", price: "₹1,749", image: rotationImages[1] },
      { name: "PC Games Master Print", price: "₹1,999", image: rotationImages[0] },
      { name: "PC Games Legend Tee", price: "₹1,899", image: rotationImages[3] },
      { name: "PC Games Victory", price: "₹1,729", image: rotationImages[2] },
    ],
    "mobile-games": [
      { name: "Mobile Games Boost Tee", price: "₹1,579", image: rotationImages[1] },
      { name: "Mobile Games Quest Print", price: "₹1,849", image: rotationImages[3] },
      { name: "Mobile Games Arcade Tee", price: "₹2,049", image: rotationImages[0] },
      { name: "Mobile Games Mode Tee", price: "₹1,699", image: rotationImages[2] },
      { name: "Mobile Games Tap Tee", price: "₹1,749", image: rotationImages[2] },
      { name: "Mobile Games Swipe Print", price: "₹1,999", image: rotationImages[1] },
      { name: "Mobile Games Pulse Tee", price: "₹1,899", image: rotationImages[0] },
      { name: "Mobile Games Rush", price: "₹1,729", image: rotationImages[3] },
    ],
  },
};

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

function ProductCard({ item, delay = 0, category = "", index = 0, isWishlisted, onWishlist, onAddToCart, isAdded }: { item: CategoryProduct; delay?: number; category?: string; index?: number; isWishlisted: boolean; onWishlist: (source: HTMLElement) => void; onAddToCart: (source: HTMLElement) => void; isAdded: boolean }) {
  const { ref, visible } = useScrollReveal<HTMLElement>();
  const productLink = `/product/${category}-${index}?name=${encodeURIComponent(item.name)}&price=${encodeURIComponent(item.price)}&image=${encodeURIComponent(item.image)}`;

  return (
    <Link href={productLink} className="block h-full">
      <article
        ref={ref}
        className={`category-page__card category-cinema-product reveal-scale-in ${visible ? "reveal-visible" : ""} cursor-pointer hover:shadow-lg transition-shadow`}
        style={{ transitionDelay: `${delay}s` }}
      >
        <div className="category-catalog-card__image-wrap">
          <img src={item.image} alt={item.name} className="category-page__image" />
          <button
            type="button"
            className={`category-catalog-card__wishlist ${isWishlisted ? "is-active" : ""}`}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onWishlist(event.currentTarget); }}
            aria-label={isWishlisted ? `Remove ${item.name} from wishlist` : `Add ${item.name} to wishlist`}
            aria-pressed={isWishlisted}
          >
            <Heart size={19} fill={isWishlisted ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="category-page__meta">
          <div>
            <h2>{item.name}</h2>
            <p>{item.price}</p>
          </div>
          <button
            type="button"
            className={`category-catalog-card__cart ${isAdded ? "is-added" : ""}`}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onAddToCart(event.currentTarget); }}
            aria-label={isAdded ? `${item.name} added to cart` : `Add ${item.name} to cart`}
          >
            {isAdded ? <Check size={13} /> : <ShoppingCart size={13} />}
          </button>
        </div>
      </article>
    </Link>
  );
}

type CatalogTab = "round-neck" | "oversized" | "acid-oversized" | "hoodie";
type CatalogSort = "featured" | "newest" | "low" | "high" | "selling";

function GlobalNavigation() {
  return <StorefrontHeader />;
}

function DynamicCategoryNav({ categorySlug }: { categorySlug: string }) {
  const hierarchy = useCategoryHierarchy(categoryHierarchyFallback);
  const definition = liveCategoryDefinition(categorySlug, hierarchy);
  if (!definition) return null;

  return (
    <nav className="category-nav cinema-category-nav" aria-label={`${definition.title} categories`}>
      <div className="category-nav__track">
        {definition.subcategories.map(({ label, slug, image }) => (
          <Link key={slug} className="category-nav__item" href={`/category/${categorySlug}/${slug}`}>
            <span className="category-nav__image"><img src={image} alt="" /></span>
            <span className="category-nav__label">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

const catalogTabs: { id: CatalogTab; label: string; icon: string }[] = [
  { id: "round-neck", label: "Round Neck", icon: "/products/roundneckicon.png" },
  { id: "oversized", label: "Oversized", icon: "/products/oversizedicon.png" },
  { id: "acid-oversized", label: "Acid Oversized", icon: "/products/acidoverwashicon.png" },
  { id: "hoodie", label: "Hoodie", icon: "/products/hoodieicon.png" },
];

function CategoryProductsView({ catalog, categorySlug, entrySlug }: { catalog: CategoryProduct[]; categorySlug: string; entrySlug: string }) {
  const [selectedTab, setSelectedTab] = useState<CatalogTab>("round-neck");
  const [sort, setSort] = useState<CatalogSort>("featured");
  const [storedCatalog, setStoredCatalog] = useState<CategoryProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const databaseOnly = !categoryProducts[categorySlug]?.[entrySlug];
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem("tribull-wishlist") || "[]") as string[]; } catch { return []; }
  });
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try { return JSON.parse(window.localStorage.getItem("tribull-cart") || "{}"); } catch { return {}; }
  });
  const [addedProduct, setAddedProduct] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStoredCatalog([]);
    setProductsLoading(true);
    const params = new URLSearchParams({ mainCategory: categorySlug, subcategory: entrySlug });
    void apiFetch(`/api/products?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load category products.");
        return await response.json() as { id: string; name: string; price: number; image: string }[];
      })
      .then((products) => {
        if (active) {
          setStoredCatalog(products.map((product) => ({
            id: product.id,
            name: product.name,
            price: `₹${product.price.toLocaleString("en-IN")}`,
            image: product.image,
          })));
          setProductsLoading(false);
        }
      })
      .catch((error: unknown) => {
        console.error("Category product request failed.", error);
        if (active) setProductsLoading(false);
      });
    return () => { active = false; };
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

  const tabCatalogs: Record<CatalogTab, CategoryProduct[]> = {
    "round-neck": [...catalog, ...storedCatalog],
    oversized: databaseOnly ? [] : [
      { name: "Daily Uniform Oversized Tee", price: "₹799", image: rotationImages[0] },
      { name: "Street Frame Oversized Tee", price: "₹849", image: rotationImages[2] },
      { name: "Heavyweight Essential Tee", price: "₹899", image: rotationImages[1] },
      { name: "Graphic Motion Oversized Tee", price: "₹949", image: rotationImages[3] },
    ],
    "acid-oversized": databaseOnly ? [] : [
      { name: "Acid Shadow Washed Tee", price: "₹999", image: "/products/tomandjerry.jpg" },
      { name: "Acid Signal Oversized Tee", price: "₹1,049", image: "/products/batman.jpg" },
      { name: "Acid Drift Washed Tee", price: "₹1,099", image: "/products/bollywood.jpg" },
      { name: "Acid Core Graphic Tee", price: "₹1,149", image: "/products/hollywood.jpg" },
    ],
    hoodie: databaseOnly ? [] : [
      { name: "Classic Tribull Hoodie", price: "₹1,299", image: rotationImages[3] },
      { name: "Forest Logo Hoodie", price: "₹1,399", image: rotationImages[0] },
      { name: "Graphic Night Hoodie", price: "₹1,499", image: rotationImages[1] },
      { name: "Studio Heavy Hoodie", price: "₹1,599", image: rotationImages[2] },
    ],
  };

  const visibleCatalog = useMemo(() => {
    const items = [...tabCatalogs[selectedTab]];
    const price = (value: string) => Number(value.replace(/[^0-9]/g, ""));
    if (sort === "low") items.sort((a, b) => price(a.price) - price(b.price));
    if (sort === "high") items.sort((a, b) => price(b.price) - price(a.price));
    if (sort === "newest") items.reverse();
    if (sort === "selling") items.sort((a, b) => b.name.length - a.name.length);
    return items;
  }, [catalog, storedCatalog, selectedTab, sort]);

  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const selectedLabel = catalogTabs.find((tab) => tab.id === selectedTab)?.label;
  const productKey = (item: CategoryProduct) => item.id || `${categorySlug}-${entrySlug}-${item.name}`;

  const addToCart = (item: CategoryProduct, source?: HTMLElement) => {
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
    setCart((current) => {
      const nextCart = { ...current, [key]: (current[key] || 0) + 1 };
      window.localStorage.setItem("tribull-cart", JSON.stringify(nextCart));
      window.dispatchEvent(new Event("tribull-cart-updated"));
      return nextCart;
    });
    setAddedProduct(key);
    if (source) animateAddToCart(source, item.image);
    window.setTimeout(() => setAddedProduct((current) => current === key ? null : current), 1200);
  };

  return (
    <>
      <div className="category-catalog-controls">
        <div className="category-catalog-tabs" aria-label="Product categories">
          {catalogTabs.map(({ id, label, icon }) => (
            <button key={id} type="button" className={`category-catalog-tab ${selectedTab === id ? "is-active" : ""}`} onClick={() => setSelectedTab(id)} aria-pressed={selectedTab === id}>
              <img src={icon} alt="" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="category-catalog-toolbar">
          <p>Showing: <strong>{selectedLabel}</strong></p>
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
      </div>
      <div className="category-page__grid category-page__grid--products">
        {productsLoading && databaseOnly ? <p className="header-empty-state">Loading products...</p> : visibleCatalog.length === 0 ? <p className="header-empty-state">No products found</p> : visibleCatalog.map((item, index) => {
          const key = productKey(item);
          return <ProductCard key={`${entrySlug}-${item.name}`} item={item} delay={0.04 * index} category={entrySlug} index={index} isWishlisted={wishlist.includes(key)} onWishlist={(source) => setWishlist((current) => { const isAdding = !current.includes(key); const nextWishlist = isAdding ? [...current, key] : current.filter((id) => id !== key); if (isAdding) animateAddToWishlist(source); window.localStorage.setItem("tribull-wishlist", JSON.stringify(nextWishlist)); window.dispatchEvent(new Event("tribull-wishlist-updated")); return nextWishlist; })} onAddToCart={(source) => addToCart(item, source)} isAdded={addedProduct === key} />;
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
    void Promise.all(requestedSubcategories.map(async (entrySlug) => {
      const params = new URLSearchParams({ mainCategory: categorySlug, subcategory: entrySlug });
      const response = await apiFetch(`/api/products?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load category products.");
      return await response.json() as { id: string; name: string; price: number; image: string }[];
    }))
      .then((result) => {
        if (active) {
          setProducts(result.flat().map((product) => ({
            id: product.id,
            name: product.name,
            price: `₹${product.price.toLocaleString("en-IN")}`,
            image: product.image,
          })));
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        console.error("Category product request failed.", error);
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [categorySlug, entrySlugsKey]);

  if (loading) return <p className="header-empty-state">Loading products...</p>;
  if (products.length === 0) return <p className="header-empty-state">No products found</p>;

  return (
    <div className="category-best-selling-grid">
      {products.map((item, index) => (
        <Link key={item.id || `${categorySlug}-${item.name}`} href={`/product/${categorySlug}-${index}?name=${encodeURIComponent(item.name)}&price=${encodeURIComponent(item.price)}&image=${encodeURIComponent(item.image)}`} className="product-card">
          <div className="product-card__image"><img src={item.image} alt={item.name} loading="lazy" /></div>
        </Link>
      ))}
    </div>
  );
}

export default function CategoryPage() {
  const { slug = "cinema", lang } = useParams<{ slug?: string; lang?: string }>();
  const hierarchy = useCategoryHierarchy(categoryHierarchyFallback);
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

  if (!activeDefinitions[categorySlug]) return <div className="p-8">Category not found.</div>;

  if (categorySlug === "cinema" && !lang) {
    const definition = activeDefinitions.cinema!;
    const defaultSubcat = definition.subcategories[0];
    const entrySlug = defaultSubcat?.slug || "";
    const catalog = entrySlug ? categoryProducts.cinema[entrySlug] || [] : [];

    return (
      <div className="subcategory-page">
        <GlobalNavigation />
        <DynamicCategoryNav categorySlug="cinema" />

        <CategoryHero
          title={definition.title}
          subtitle={definition.subtitle}
          image={heroBanner}
        />

        <div className="section-heading category-best-selling-heading">
          <h2 style={{ font: "700 clamp(18px, 2vw, 30px)/1.15 Montserrat,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tribull-green)" }}>Best Selling</h2>
        </div>

        <div className="category-best-selling-grid">
          {catalog.map((item, index) => (
            <Link key={`${entrySlug}-${item.name}`} href={`/product/${categorySlug}-${index}?name=${encodeURIComponent(item.name)}&price=${encodeURIComponent(item.price)}&image=${encodeURIComponent(item.image)}`} className="product-card">
              <div className="product-card__image"><img src={item.image} alt={item.name} loading="lazy" /></div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (categorySlug === "sports" && !lang) {
    const definition = activeDefinitions.sports!;
    const defaultSubcat = definition.subcategories[0];
    const catalog = categoryProducts.sports[defaultSubcat.slug] || [];
    const entrySlug = defaultSubcat.slug;

    return (
      <div className="subcategory-page">
        <GlobalNavigation />
        <DynamicCategoryNav categorySlug="sports" />

        <CategoryHero
          title={definition.title}
          subtitle={definition.subtitle}
          image={heroBanner}
        />

        <div className="section-heading category-best-selling-heading">
          <h2 style={{ font: "700 clamp(18px, 2vw, 30px)/1.15 Montserrat,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tribull-green)" }}>Best Selling</h2>
        </div>

        <div className="category-best-selling-grid">
          {catalog.map((item, index) => (
            <Link key={`${entrySlug}-${item.name}`} href={`/product/${categorySlug}-${index}?name=${encodeURIComponent(item.name)}&price=${encodeURIComponent(item.price)}&image=${encodeURIComponent(item.image)}`} className="product-card">
              <div className="product-card__image"><img src={item.image} alt={item.name} loading="lazy" /></div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (categorySlug === "motorsports" && !lang) {
    const definition = activeDefinitions.motorsports!;
    const defaultSubcat = definition.subcategories[0];
    const catalog = categoryProducts.motorsports[defaultSubcat.slug] || [];
    const entrySlug = defaultSubcat.slug;

    return (
      <div className="subcategory-page">
        <GlobalNavigation />
        <DynamicCategoryNav categorySlug="motorsports" />

        <CategoryHero
          title={definition.title}
          subtitle={definition.subtitle}
          image={heroBanner}
        />

        <div className="section-heading category-best-selling-heading">
          <h2 style={{ font: "700 clamp(18px, 2vw, 30px)/1.15 Montserrat,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tribull-green)" }}>Best Selling</h2>
        </div>

        <div className="category-best-selling-grid">
          {catalog.map((item, index) => (
            <Link key={`${entrySlug}-${item.name}`} href={`/product/${categorySlug}-${index}?name=${encodeURIComponent(item.name)}&price=${encodeURIComponent(item.price)}&image=${encodeURIComponent(item.image)}`} className="product-card">
              <div className="product-card__image"><img src={item.image} alt={item.name} loading="lazy" /></div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (categorySlug === "games" && !lang) {
    const definition = activeDefinitions.games!;
    const defaultSubcat = definition.subcategories[0];
    const catalog = categoryProducts.games[defaultSubcat.slug] || [];
    const entrySlug = defaultSubcat.slug;

    return (
      <div className="subcategory-page">
        <GlobalNavigation />
        <DynamicCategoryNav categorySlug="games" />

        <CategoryHero
          title={definition.title}
          subtitle={definition.subtitle}
          image={heroBanner}
        />

        <div className="section-heading category-best-selling-heading">
          <h2 style={{ font: "700 clamp(18px, 2vw, 30px)/1.15 Montserrat,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tribull-green)" }}>Best Selling</h2>
        </div>

        <div className="category-best-selling-grid">
          {catalog.map((item, index) => (
            <Link key={`${entrySlug}-${item.name}`} href={`/product/${categorySlug}-${index}?name=${encodeURIComponent(item.name)}&price=${encodeURIComponent(item.price)}&image=${encodeURIComponent(item.image)}`} className="product-card">
              <div className="product-card__image"><img src={item.image} alt={item.name} loading="lazy" /></div>
            </Link>
          ))}
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
    const catalog = categoryProducts[categorySlug]?.[entrySlug] ?? [];

    return (
      <div className="category-products-page">
        <GlobalNavigation />
        <DynamicCategoryNav categorySlug={categorySlug} />

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

        <CategoryProductsView catalog={catalog} categorySlug={categorySlug} entrySlug={entrySlug} />
      </div>
    );
  }

  const fallback = activeDefinitions[categorySlug];
  if (!fallback) return <div className="p-8">Category not found.</div>;
  return (
    <div className="subcategory-page">
      <GlobalNavigation />
      <DynamicCategoryNav categorySlug={categorySlug} />

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
