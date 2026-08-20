import { ArrowLeft, ArrowUpRight, Check, Heart, ShoppingCart } from "lucide-react";
import { Link, useParams } from "wouter";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { useEffect, useMemo, useRef, useState } from "react";

type CategoryProduct = {
  name: string;
  price: string;
  image: string;
};

type CategoryDefinition = {
  title: string;
  subtitle: string;
  subcategories: { slug: string; label: string; image: string }[];
};

const categoryDefinitions: Record<string, CategoryDefinition> = {
  cinema: {
    title: "Cinema",
    subtitle: "Cinematic collection",
    subcategories: [
      { slug: "hollywood", label: "Hollywood", image: "/products/hollywood.jpg" },
      { slug: "bollywood", label: "Bollywood", image: "/products/bollywood.jpg" },
      { slug: "kollywood", label: "Kollywood", image: "/products/kollywood.jpg" },
      { slug: "tollywood", label: "Tollywood", image: "/products/tollywood.jpg" },
      { slug: "mollywood", label: "Mollywood", image: "/products/mollywood.jpg" },
      { slug: "sandalwood", label: "Sandalwood", image: "/products/sandalwood.jpg" },
    ],
  },
  sports: {
    title: "Sports",
    subtitle: "Performance wear",
    subcategories: [
      { slug: "cricket", label: "Cricket", image: "/products/cricket.jpg" },
      { slug: "football", label: "Football", image: "/products/football.jpg" },
      { slug: "gym", label: "Gym", image: "/products/gym.jpg" },
    ],
  },
  motorsports: {
    title: "MotoSports",
    subtitle: "Track ready",
    subcategories: [
      { slug: "car", label: "Car", image: "/products/car.jpg" },
      { slug: "bike", label: "Bike", image: "/products/bike.jpg" },
    ],
  },
  games: {
    title: "Games",
    subtitle: "Play mode",
    subcategories: [
      { slug: "pc-games", label: "PC Games", image: "/products/pc games.jpg" },
      { slug: "mobile-games", label: "Mobile Games", image: "/products/mobilegames.jpg" },
    ],
  },
};

const rotationImages = [
  "/products/back-black.png",
  "/products/flat-white.png",
  "/products/front-white.png",
  "/products/hanger-white.png",
];

const categoryProducts: Record<string, Record<string, CategoryProduct[]>> = {
  cinema: {
    kollywood: [
      { name: "Kollywood Hero Tee", price: "₹1,699", image: rotationImages[2] },
      { name: "Kollywood Legend", price: "₹1,899", image: rotationImages[3] },
      { name: "Kollywood Power Tee", price: "₹2,099", image: rotationImages[1] },
      { name: "Kollywood Crown", price: "₹1,599", image: rotationImages[0] },
    ],
    tollywood: [
      { name: "Tollywood Charm Tee", price: "₹1,649", image: rotationImages[1] },
      { name: "Tollywood Spotlight", price: "₹1,829", image: rotationImages[0] },
      { name: "Tollywood Mass Print", price: "₹1,949", image: rotationImages[3] },
      { name: "Tollywood Cinematic", price: "₹1,579", image: rotationImages[2] },
    ],
    mollywood: [
      { name: "Mollywood Motion Tee", price: "₹1,739", image: rotationImages[0] },
      { name: "Mollywood Storyline", price: "₹1,899", image: rotationImages[2] },
      { name: "Mollywood Sunset Print", price: "₹2,049", image: rotationImages[1] },
      { name: "Mollywood Classic", price: "₹1,629", image: rotationImages[3] },
    ],
    sandalwood: [
      { name: "Sandalwood Star Tee", price: "₹1,749", image: rotationImages[3] },
      { name: "Sandalwood Reel", price: "₹1,869", image: rotationImages[1] },
      { name: "Sandalwood Heritage", price: "₹1,979", image: rotationImages[2] },
      { name: "Sandalwood Gold", price: "₹1,599", image: rotationImages[0] },
    ],
    bollywood: [
      { name: "Bollywood Dazzle Tee", price: "₹1,649", image: rotationImages[1] },
      { name: "Bollywood Shimmer", price: "₹1,849", image: rotationImages[2] },
      { name: "Bollywood Drama Tee", price: "₹1,949", image: rotationImages[3] },
      { name: "Bollywood Gold", price: "₹1,549", image: rotationImages[0] },
    ],
    hollywood: [
      { name: "Hollywood Icon Tee", price: "₹1,599", image: rotationImages[0] },
      { name: "Hollywood Star Print", price: "₹1,799", image: rotationImages[1] },
      { name: "Hollywood Blockbuster", price: "₹1,999", image: rotationImages[2] },
      { name: "Hollywood Classic", price: "₹1,499", image: rotationImages[3] },
    ],
  },
  sports: {
    cricket: [
      { name: "Cricket Power Tee", price: "₹1,699", image: rotationImages[0] },
      { name: "Cricket Captain Print", price: "₹1,899", image: rotationImages[2] },
      { name: "Cricket Match Tee", price: "₹1,979", image: rotationImages[1] },
      { name: "Cricket Pace Tee", price: "₹1,599", image: rotationImages[3] },
    ],
    football: [
      { name: "Football Flow Tee", price: "₹1,729", image: rotationImages[1] },
      { name: "Football League Print", price: "₹1,949", image: rotationImages[0] },
      { name: "Football Hustle Tee", price: "₹2,099", image: rotationImages[3] },
      { name: "Football Matchday", price: "₹1,649", image: rotationImages[2] },
    ],
    gym: [
      { name: "Gym Lift Tee", price: "₹1,579", image: rotationImages[3] },
      { name: "Gym Drive Tee", price: "₹1,799", image: rotationImages[2] },
      { name: "Gym Motion Print", price: "₹1,989", image: rotationImages[0] },
      { name: "Gym Strong Tee", price: "₹1,679", image: rotationImages[1] },
    ],
  },
  motorsports: {
    car: [
      { name: "Car Drift Tee", price: "₹1,749", image: rotationImages[0] },
      { name: "Car Racing Print", price: "₹1,999", image: rotationImages[1] },
      { name: "Car Speed Tee", price: "₹2,149", image: rotationImages[2] },
      { name: "Car Apex Tee", price: "₹1,799", image: rotationImages[3] },
    ],
    bike: [
      { name: "Bike Rush Tee", price: "₹1,699", image: rotationImages[3] },
      { name: "Bike Sprint Print", price: "₹1,949", image: rotationImages[2] },
      { name: "Bike Track Tee", price: "₹2,099", image: rotationImages[0] },
      { name: "Bike Torque Tee", price: "₹1,649", image: rotationImages[1] },
    ],
  },
  games: {
    "pc-games": [
      { name: "PC Games Arena Tee", price: "₹1,699", image: rotationImages[0] },
      { name: "PC Games Pro Print", price: "₹1,899", image: rotationImages[2] },
      { name: "PC Games Hero Tee", price: "₹2,099", image: rotationImages[1] },
      { name: "PC Games Charge Tee", price: "₹1,599", image: rotationImages[3] },
    ],
    "mobile-games": [
      { name: "Mobile Games Boost Tee", price: "₹1,579", image: rotationImages[1] },
      { name: "Mobile Games Quest Print", price: "₹1,849", image: rotationImages[3] },
      { name: "Mobile Games Arcade Tee", price: "₹2,049", image: rotationImages[0] },
      { name: "Mobile Games Mode Tee", price: "₹1,699", image: rotationImages[2] },
    ],
  },
};

function SubcategoryList({ categorySlug, items }: { categorySlug: string; items: { slug: string; label: string; image: string }[] }) {
  return (
    <div className="subcategory-card-grid" aria-label={`${categorySlug} subcategories`}>
      {items.map((item) => (
        <Link key={item.slug} href={`/category/${categorySlug}/${item.slug}`} className="subcategory-card">
          <div className="subcategory-card__media">
            <img src={item.image} alt={item.label} loading="lazy" />
          </div>
          <div className="subcategory-card__label">{item.label}</div>
        </Link>
      ))}
    </div>
  );
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
          <img ref={heroImgRef} src={image} alt={`${title} collection hero`} />
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

function ProductCard({ item, delay = 0, category = "", index = 0, isWishlisted, onWishlist, onAddToCart, isAdded }: { item: CategoryProduct; delay?: number; category?: string; index?: number; isWishlisted: boolean; onWishlist: () => void; onAddToCart: () => void; isAdded: boolean }) {
  const { ref, visible } = useScrollReveal<HTMLElement>();
  const productLink = `/product/${category}-${index}`;

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
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onWishlist(); }}
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
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onAddToCart(); }}
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

const catalogTabs: { id: CatalogTab; label: string; icon: string }[] = [
  { id: "round-neck", label: "Round Neck", icon: "/products/roundneckicon.png" },
  { id: "oversized", label: "Oversized", icon: "/products/oversizedicon.png" },
  { id: "acid-oversized", label: "Acid Oversized", icon: "/products/acidoverwashicon.png" },
  { id: "hoodie", label: "Hoodie", icon: "/products/hoodieicon.png" },
];

function CategoryProductsView({ catalog, categorySlug, entrySlug }: { catalog: CategoryProduct[]; categorySlug: string; entrySlug: string }) {
  const [selectedTab, setSelectedTab] = useState<CatalogTab>("round-neck");
  const [sort, setSort] = useState<CatalogSort>("featured");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [addedProduct, setAddedProduct] = useState<string | null>(null);

  const tabCatalogs = useMemo<Record<CatalogTab, CategoryProduct[]>>(() => ({
    "round-neck": catalog,
    oversized: [
      { name: "Daily Uniform Oversized Tee", price: "₹799", image: rotationImages[0] },
      { name: "Street Frame Oversized Tee", price: "₹849", image: rotationImages[2] },
      { name: "Heavyweight Essential Tee", price: "₹899", image: rotationImages[1] },
      { name: "Graphic Motion Oversized Tee", price: "₹949", image: rotationImages[3] },
    ],
    "acid-oversized": [
      { name: "Acid Shadow Washed Tee", price: "₹999", image: "/products/tomandjerry.jpg" },
      { name: "Acid Signal Oversized Tee", price: "₹1,049", image: "/products/batman.jpg" },
      { name: "Acid Drift Washed Tee", price: "₹1,099", image: "/products/bollywood.jpg" },
      { name: "Acid Core Graphic Tee", price: "₹1,149", image: "/products/hollywood.jpg" },
    ],
    hoodie: [
      { name: "Classic Tribull Hoodie", price: "₹1,299", image: rotationImages[3] },
      { name: "Forest Logo Hoodie", price: "₹1,399", image: rotationImages[0] },
      { name: "Graphic Night Hoodie", price: "₹1,499", image: rotationImages[1] },
      { name: "Studio Heavy Hoodie", price: "₹1,599", image: rotationImages[2] },
    ],
  }), [catalog]);

  const visibleCatalog = useMemo(() => {
    const items = [...tabCatalogs[selectedTab]];
    const price = (value: string) => Number(value.replace(/[^0-9]/g, ""));
    if (sort === "low") items.sort((a, b) => price(a.price) - price(b.price));
    if (sort === "high") items.sort((a, b) => price(b.price) - price(a.price));
    if (sort === "newest") items.reverse();
    if (sort === "selling") items.sort((a, b) => b.name.length - a.name.length);
    return items;
  }, [selectedTab, sort, tabCatalogs]);

  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const selectedLabel = catalogTabs.find((tab) => tab.id === selectedTab)?.label;
  const productKey = (item: CategoryProduct) => `${categorySlug}-${entrySlug}-${item.name}`;

  const addToCart = (item: CategoryProduct) => {
    const key = productKey(item);
    setCart((current) => ({ ...current, [key]: (current[key] || 0) + 1 }));
    setAddedProduct(key);
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
          <span className="category-catalog-cart-count"><ShoppingCart size={15} /> {cartCount}</span>
        </div>
      </div>
      <div className="category-page__grid category-page__grid--products">
        {visibleCatalog.map((item, index) => {
          const key = productKey(item);
          return <ProductCard key={`${selectedTab}-${item.name}`} item={item} delay={0.04 * index} category={selectedTab} index={index} isWishlisted={wishlist.includes(key)} onWishlist={() => setWishlist((current) => current.includes(key) ? current.filter((id) => id !== key) : [...current, key])} onAddToCart={() => addToCart(item)} isAdded={addedProduct === key} />;
        })}
      </div>
    </>
  );
}

export default function CategoryPage() {
  const { slug = "cinema", lang } = useParams<{ slug?: string; lang?: string }>();
  const categorySlug = slug || "cinema";

  if (categorySlug === "cinema" && !lang) {
    const definition = categoryDefinitions.cinema;

    return (
      <div className="subcategory-page">
        <div className="category-page__header">
          <Link href="/" className="back-link">
            <ArrowLeft size={18} /> Back
          </Link>
          <div className="category-page__title-wrap">
            <p className="category-page__eyebrow">{definition.subtitle}</p>
            <h1>{definition.title}</h1>
          </div>
        </div>

        <CategoryHero
          title={definition.title}
          subtitle={definition.subtitle}
          image="/products/hero.png"
        />

        <SubcategoryList categorySlug={categorySlug} items={definition.subcategories} />
      </div>
    );
  }

  if (categorySlug === "sports" && !lang) {
    const definition = categoryDefinitions.sports;

    return (
      <div className="subcategory-page">
        <div className="category-page__header">
          <Link href="/" className="back-link">
            <ArrowLeft size={18} /> Back
          </Link>
          <div className="category-page__title-wrap">
            <p className="category-page__eyebrow">{definition.subtitle}</p>
            <h1>{definition.title}</h1>
          </div>
        </div>

        <CategoryHero
          title={definition.title}
          subtitle={definition.subtitle}
          image="/products/sportsbanner.png"
        />

        <SubcategoryList categorySlug={categorySlug} items={definition.subcategories} />
      </div>
    );
  }

  if (categorySlug === "motorsports" && !lang) {
    const definition = categoryDefinitions.motorsports;

    return (
      <div className="subcategory-page">
        <div className="category-page__header">
          <Link href="/" className="back-link">
            <ArrowLeft size={18} /> Back
          </Link>
          <div className="category-page__title-wrap">
            <p className="category-page__eyebrow">{definition.subtitle}</p>
            <h1>{definition.title}</h1>
          </div>
        </div>

        <CategoryHero
          title={definition.title}
          subtitle={definition.subtitle}
          image="/products/motosportsbanner.png"
        />

        <SubcategoryList categorySlug={categorySlug} items={definition.subcategories} />
      </div>
    );
  }

  if (categorySlug === "games" && !lang) {
    const definition = categoryDefinitions.games;

    return (
      <div className="subcategory-page">
        <div className="category-page__header">
          <Link href="/" className="back-link">
            <ArrowLeft size={18} /> Back
          </Link>
          <div className="category-page__title-wrap">
            <p className="category-page__eyebrow">{definition.subtitle}</p>
            <h1>{definition.title}</h1>
          </div>
        </div>

        <CategoryHero
          title={definition.title}
          subtitle={definition.subtitle}
          image="/products/game banner.png"
        />

        <SubcategoryList categorySlug={categorySlug} items={definition.subcategories} />
      </div>
    );
  }

  if (lang) {
    const selectedSlug = String(lang);
    const category = categoryDefinitions[categorySlug] ?? categoryDefinitions.cinema;
    const entry = category.subcategories.find((item) => item.slug === selectedSlug) ?? category.subcategories[0];
    const catalog = categoryProducts[categorySlug]?.[selectedSlug] ?? categoryProducts.cinema[entry.slug] ?? [];

    return (
      <div className="category-products-page">
        <div className="category-page__header">
          <Link href={`/category/${categorySlug}`} className="back-link">
            <ArrowLeft size={18} /> Back
          </Link>
          <div className="category-page__title-wrap">
            <p className="category-page__eyebrow">{category.title}</p>
            <h1>{entry.label}</h1>
          </div>
        </div>

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

        <CategoryProductsView catalog={catalog} categorySlug={categorySlug} entrySlug={selectedSlug} />
      </div>
    );
  }

  const fallback = categoryDefinitions.cinema;
  return (
    <div className="subcategory-page">
      <div className="category-page__header">
        <Link href="/" className="back-link">
          <ArrowLeft size={18} /> Back
        </Link>
        <div className="category-page__title-wrap">
          <p className="category-page__eyebrow">{fallback.subtitle}</p>
          <h1>{fallback.title}</h1>
        </div>
      </div>

      <SubcategoryList categorySlug={categorySlug} items={fallback.subcategories} />
    </div>
  );
}
