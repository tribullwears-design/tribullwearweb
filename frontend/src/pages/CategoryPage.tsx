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

function GlobalNavigation() {
  return (
    <div className="cinema-page-header">
      <div className="cinema-marketbar" aria-label="Announcement">
        <div className="cinema-marketbar__track">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i}>
              <b>100% COTTON.</b> SHOP NOW
              <i>✦</i>
            </span>
          ))}
        </div>
      </div>

      <header className="site-header cinema-site-header">
        <button className="icon-button mobile-menu" aria-label="Open menu"><span aria-hidden="true">☰</span></button>
        <a className="wordmark" href="/" aria-label="Tribull home">
          <img src="/products/logo.png" alt="TRIBULL" />
        </a>
        <div className="header-actions">
          <button className="icon-button" aria-label="Search"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M16 16L21 21" /></svg></button>
          <button className="icon-button" aria-label="Account"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg></button>
          <button className="icon-button" aria-label="Wishlist"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7.5-4.35-9.5-8.73C1.2 9.7 2.47 5 6.73 5c2.1 0 3.2 1.15 4.27 2.3C12.07 6.15 13.17 5 15.27 5c4.26 0 5.53 4.7 4.23 7.27C19.5 16.65 12 21 12 21z" /></svg></button>
          <Link href="/product/hollywood-0" className="icon-button" aria-label="Shopping bag"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h2l2.4 9.68a1 1 0 0 0 .98.82h8.35a1 1 0 0 0 .98-.8L20 7H7" /><circle cx="10" cy="18.5" r="1.3" /><circle cx="17" cy="18.5" r="1.3" /></svg></Link>
        </div>
      </header>
    </div>
  );
}

function DynamicCategoryNav({ categorySlug }: { categorySlug: string }) {
  const definition = categoryDefinitions[categorySlug];
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
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [addedProduct, setAddedProduct] = useState<string | null>(null);

  const tabCatalogs: Record<CatalogTab, CategoryProduct[]> = {
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
  };

  const visibleCatalog = useMemo(() => {
    const items = [...tabCatalogs[selectedTab]];
    const price = (value: string) => Number(value.replace(/[^0-9]/g, ""));
    if (sort === "low") items.sort((a, b) => price(a.price) - price(b.price));
    if (sort === "high") items.sort((a, b) => price(b.price) - price(a.price));
    if (sort === "newest") items.reverse();
    if (sort === "selling") items.sort((a, b) => b.name.length - a.name.length);
    return items;
  }, [catalog, selectedTab, sort]);

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
          <button type="button" className="category-catalog-cart-button" aria-label={`${cartCount} items in cart`}>
            <ShoppingCart size={18} />
            {cartCount > 0 && <span>{cartCount}</span>}
          </button>
        </div>
      </div>
      <div className="category-page__grid category-page__grid--products">
        {visibleCatalog.map((item, index) => {
          const key = productKey(item);
          return <ProductCard key={`${entrySlug}-${item.name}`} item={item} delay={0.04 * index} category={entrySlug} index={index} isWishlisted={wishlist.includes(key)} onWishlist={() => setWishlist((current) => current.includes(key) ? current.filter((id) => id !== key) : [...current, key])} onAddToCart={() => addToCart(item)} isAdded={addedProduct === key} />;
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
    const catalog = categoryProducts.cinema.hollywood;
    const entrySlug = "hollywood";

    return (
      <div className="subcategory-page">
        <GlobalNavigation />
        <DynamicCategoryNav categorySlug="cinema" />

        <CategoryHero
          title={definition.title}
          subtitle={definition.subtitle}
          image="/products/hero.png"
        />

        <div className="section-heading" style={{ justifyContent: "center", marginBottom: "20px" }}>
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
    const definition = categoryDefinitions.sports;
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
          image="/products/sportsbanner.png"
        />

        <div className="section-heading" style={{ justifyContent: "center", marginBottom: "20px" }}>
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
    const definition = categoryDefinitions.motorsports;
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
          image="/products/motosportsbanner.png"
        />

        <div className="section-heading" style={{ justifyContent: "center", marginBottom: "20px" }}>
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
    const definition = categoryDefinitions.games;
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
          image="/products/game banner.png"
        />

        <div className="section-heading" style={{ justifyContent: "center", marginBottom: "20px" }}>
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
    const selectedSlug = String(lang);
    const category = categoryDefinitions[categorySlug] ?? categoryDefinitions.cinema;
    const entry = category.subcategories.find((item) => item.slug === selectedSlug) ?? category.subcategories[0];
    const catalog = categoryProducts[categorySlug]?.[selectedSlug] ?? categoryProducts.cinema[entry.slug] ?? [];

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
