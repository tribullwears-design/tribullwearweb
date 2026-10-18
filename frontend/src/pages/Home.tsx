// Tribull Home — Figma node 103:83 with rich scroll-triggered animations, staggered reveals, and parallax.
import { ArrowLeft, ArrowRight, ArrowUpRight, Instagram, MapPin } from "lucide-react";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import MobileCategoryMenu from "../components/MobileCategoryMenu";
import HeaderActions from "../components/HeaderActions";
import ProductPrice from "../components/ProductPrice";
import { defaultCategoryHierarchy, getStorefrontCategoryHierarchy, getStorefrontHomeCategories, useCategoryHierarchy, type CategoryHierarchy } from "../lib/categoryHierarchy";
import { getShowcaseProductImage } from "../lib/storefrontProductImage";
import { fetchProducts, getEligibleStorefrontProducts, productHref, refreshProducts } from "../lib/products";
import { getBestSellingProducts, getNewArrivals } from "../lib/homeProducts";
import type { StorefrontProduct } from "../lib/products";
import { loadCategoryBanner } from "../lib/categoryBanners";

const brandAssets = {
  logo: "/products/logo.png",
  hero: "/products/homebanner.jpg",
  cinema: "/products/cinema.png",
  sports: "/products/sports.png",
  games: "/products/games.png",
  motorsports: "/products/motosports.jpg",
};

const whatsappUrl = (message: string) => `https://wa.me/916385400605?text=${encodeURIComponent(message)}`;

const categoryHierarchyFallback: CategoryHierarchy = defaultCategoryHierarchy;

function cls(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <a className={`wordmark ${inverse ? "wordmark--inverse" : ""}`} href="#top" aria-label="Tribull home">
      <img src={brandAssets.logo} alt="TRIBULL" />
    </a>
  );
}

function Reveal({
  children,
  variant = "up",
  stagger = false,
  className = "",
  delay = 0,
  id,
}: {
  children: React.ReactNode;
  variant?: "up" | "left" | "right" | "scale" | "blur";
  stagger?: boolean;
  className?: string;
  delay?: number;
  id?: string;
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
      id={id}
      className={cls(base, stagger ? "reveal-stagger" : null, visible ? "reveal-visible" : null, className)}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

function ProductCard({ item, delay = 0, showMeta = true, href, originalPrice }: { item: string[]; delay?: number; showMeta?: boolean; href: string; originalPrice?: number }) {
  const { ref, visible } = useScrollReveal<HTMLElement>();
  const [, setLocation] = useLocation();
  const [isOpening, setIsOpening] = useState(false);
  const openingTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (openingTimer.current !== null) window.clearTimeout(openingTimer.current);
  }, []);

  const handleProductClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || event.detail === 0
      || !window.matchMedia("(hover: none) and (pointer: coarse)").matches
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;

    event.preventDefault();
    if (isOpening) return;
    setIsOpening(true);
    openingTimer.current = window.setTimeout(() => setLocation(href), 520);
  };

  return (
    <Link href={href} className="product-card-link" aria-label={`Open ${item[1]} product page`} onClick={handleProductClick}>
      <article
        ref={ref}
        className={cls("product-card", "reveal-scale-in", "parallax-tilt", visible ? "is-revealed" : null, isOpening ? "is-opening" : null)}
        style={{ transitionDelay: `${delay}s`, animationDelay: `${delay}s` }}
      >
        <div className="product-card__image">
          <img src={item[0]} alt={item[1]} className="product-image-primary" loading="lazy" />
        </div>
        {showMeta && <div className="product-card__meta"><h3>{item[1]}</h3><ProductPrice sellingPrice={item[2]} originalPrice={originalPrice} productName={item[1]} /></div>}
      </article>
    </Link>
  );
}

export default function Home() {
  const fetchedHierarchy = useCategoryHierarchy(categoryHierarchyFallback);
  const hierarchy = getStorefrontCategoryHierarchy(fetchedHierarchy);
  const mainCategories = getStorefrontHomeCategories(hierarchy);
  const [catalogProducts, setCatalogProducts] = useState<StorefrontProduct[]>([]);
  const [homeVideos, setHomeVideos] = useState<Array<{ id: string; title: string; url: string; thumbnail?: string; category?: string }>>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [videosError, setVideosError] = useState("");
  const [homeBanner, setHomeBanner] = useState<{ image: string; title?: string; subtitle?: string; link?: string } | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const lifestyleTrackRef = useRef<HTMLDivElement>(null);
  const lifestyleViewportRef = useRef<HTMLDivElement>(null);
  const lifestyleSlideRef = useRef<HTMLDivElement>(null);
  const [lifestyleIndex, setLifestyleIndex] = useState(0);
  const [lifestyleStep, setLifestyleStep] = useState(0);
  const [lifestyleTransitioning, setLifestyleTransitioning] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const syncProducts = (refresh = false) => {
      const request = refresh ? refreshProducts() : fetchProducts();
      void request.then((products) => {
        if (active) setCatalogProducts(products);
      }).catch((error: unknown) => {
        console.error("Could not load products for the storefront.", error);
      });
    };
    syncProducts();
    const refreshCatalog = () => syncProducts(true);
    window.addEventListener("tribull-products-updated", refreshCatalog);
    return () => {
      active = false;
      window.removeEventListener("tribull-products-updated", refreshCatalog);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setVideosLoading(true);
    void fetch("/api/videos", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Videos could not be loaded.");
      const savedVideos = await response.json() as Array<{ id: string; title: string; url: string; thumbnail?: string; category?: string }>;
      if (active) setHomeVideos(savedVideos);
    }).catch((error: unknown) => {
      if (active) setVideosError(error instanceof Error ? error.message : "Videos could not be loaded.");
    }).finally(() => { if (active) setVideosLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void loadCategoryBanner("home").then((banner) => {
      if (active) setHomeBanner(banner);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);


  const lifestyleSlides = homeVideos;
  const maxLifestyleIndex = Math.max(0, lifestyleSlides.length - 3);

  const scrollLifestyle = (direction: "left" | "right") => {
    if (lifestyleTransitioning) return;

    const nextIndex = direction === "left" ? lifestyleIndex - 1 : lifestyleIndex + 1;
    if (nextIndex < 0 || nextIndex > maxLifestyleIndex) return;

    setLifestyleTransitioning(true);
    setLifestyleIndex(nextIndex);
  };

  useEffect(() => {
    const updateLifestyleStep = () => {
      const slide = lifestyleSlideRef.current;
      const track = lifestyleTrackRef.current;
      if (!slide || !track) return;
      const styles = window.getComputedStyle(track);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      setLifestyleStep(slide.getBoundingClientRect().width + gap);
    };

    updateLifestyleStep();
    const observer = new ResizeObserver(updateLifestyleStep);
    if (lifestyleTrackRef.current) observer.observe(lifestyleTrackRef.current);
    return () => observer.disconnect();
  }, [lifestyleSlides.length]);

  const handleLifestyleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== "transform") return;
    setLifestyleTransitioning(false);
  };

  const handleLifestyleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleLifestyleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;

    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const deltaX = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < 30) return;
    if (deltaX > 0) scrollLifestyle("right");
    else scrollLifestyle("left");
  };

  const productLink = productHref;
  const eligibleProducts = hierarchy.loaded ? getEligibleStorefrontProducts(catalogProducts, hierarchy) : catalogProducts;
  const arrivals = getNewArrivals(eligibleProducts, hierarchy);
  const arrivalCards = arrivals.map((product) => ({
    item: [product.image, product.name, `₹${product.price.toLocaleString("en-IN")}`],
    href: productLink(product),
    originalPrice: product.originalPrice,
  }));
  const bestSellingCards = getBestSellingProducts(eligibleProducts, hierarchy).map((product) => ({
      item: [product.image, product.name, `₹${product.price.toLocaleString("en-IN")}`],
      href: productLink(product),
      originalPrice: product.originalPrice,
    }));

  return (
    <div id="top" className="tribull-page" ref={pageRef}>
      <div className="ticker" aria-label="Announcement">
        <div className="ticker__track">
          {Array.from({ length: 8 }).map((_, index) => (
            <span key={index}>100% COTTON.<b>SHOP NOW</b><i>✦</i></span>
          ))}
        </div>
      </div>

      <header className="site-header">
        <MobileCategoryMenu />
        <Wordmark />
        <HeaderActions />
      </header>

      {hierarchy.loaded ? mainCategories.length > 0 ? <nav className="category-nav" aria-label="Shop by category">
        <div className="category-nav__track">
          {mainCategories.map(({ value, label, image, href }) => (
            <Link className="category-nav__item" href={href} key={value} aria-label={`Shop ${label}`}>
              <span className="category-nav__image"><img src={image} alt="" /></span>
              <span className="category-nav__label">{label}</span>
            </Link>
          ))}
        </div>
      </nav> : <p className="category-nav__message" role="status">No visible categories are available right now.</p>
        : fetchedHierarchy.error
          ? <div className="category-nav__message" role="alert"><span>Categories could not be loaded.</span><button type="button" onClick={fetchedHierarchy.retry}>Retry</button></div>
          : <p className="category-nav__message" role="status">Loading categories...</p>}

      <main>
        <section className="hero" aria-label="Tribull new collection">
          <div className="hero__images">
            <div className="hero__image">
              <img src={homeBanner?.image || brandAssets.hero} alt={homeBanner?.title || "Tribull collection"} />
            </div>
          </div>
          <div className="hero__wash" />
          <div className="hero__copy">
            {homeBanner?.title && <h1>{homeBanner.title}</h1>}
            {homeBanner?.subtitle && <p className="hero-description">{homeBanner.subtitle}</p>}
            {homeBanner?.link && <a className="button button--cream" href={homeBanner.link}>Shop now <ArrowUpRight size={17} /></a>}
            <Reveal variant="blur" delay={0.1}>
              <p className="eyebrow" style={{ display: 'none' }}>The everyday uniform / 2026</p>
            </Reveal>
            <Reveal variant="blur" delay={0.25}>
              <h1 style={{ display: 'none' }}>Wear what<br /><em>moves</em> you.</h1>
            </Reveal>
            <Reveal variant="up" delay={0.5}>
              <a className="button button--cream" href="#arrivals" style={{ display: 'none' }}>Shop now <ArrowUpRight size={17} /></a>
            </Reveal>
          </div>
          <div className="hero__stamp float-fast">TRIBULL<br /><span>EST. 2024</span></div>
        </section>

        <div className="peach-wrapper">
          <div className="product-section" id="arrivals">
            <Reveal>
              <div className="section-heading">
                <Reveal variant="left"><div><p className="eyebrow"></p><h2>New Arrivals</h2></div></Reveal>
              </div>
            </Reveal>
            <div className="product-grid product-grid--featured">
              {arrivalCards.map(({ item, href, originalPrice }, idx) => (
                <ProductCard
                  item={item}
                  key={`${item[1]}-${idx}`}
                  delay={0.08 * idx}
                  href={href}
                  originalPrice={originalPrice}
                />
              ))}
            </div>
            <a className="view-all text-link" href="/products">View all <ArrowUpRight size={16} /></a>
          </div>
        </div>

        <div className="peach-wrapper">
          <div className="product-section product-section--best" id="best-selling">
            <Reveal>
              <div className="section-heading">
                <Reveal variant="left"><div><p className="eyebrow"></p><h2>Best Selling</h2></div></Reveal>
              </div>
            </Reveal>
            <div className="product-grid product-grid--image-only product-grid--featured">
              {bestSellingCards.map(({ item, href, originalPrice }, idx) => (
                <ProductCard
                  item={item}
                  key={`${item[1]}-${idx}`}
                  delay={0.08 * idx}
                  href={href}
                  originalPrice={originalPrice}
                />
              ))}
            </div>
            <a className="view-all text-link" href="/products">View all <ArrowUpRight size={16} /></a>
          </div>
        </div>

        <div className="peach-wrapper">
          <div className="cooperate-options">
            <Reveal variant="left" className="cooperate-option cooperate-option--corporate" id="corporate">
              <div className="cooperate-option__copy">
                <h2>Corporate</h2>
                <p>Anything &amp; Anything for<br />your Teams / Office</p>
                <a className="button cooperate-option__button" href={whatsappUrl("Hi Tribull, I would like to shop for my team.")} target="_blank" rel="noreferrer">+ Shop for your Team</a>
              </div>
              <img src="/products/hoodieicon.png" alt="Custom team hoodie" />
            </Reveal>
            <Reveal variant="right" className="cooperate-option cooperate-option--custom" id="customize">
              <div className="cooperate-option__copy">
                <h2>Customize</h2>
                <p>Design your own t-shirts<br />hoodies &amp; more with Dudeme!</p>
                <a className="button cooperate-option__button" href={whatsappUrl("Hi Tribull, I would like to customize T-shirts and hoodies.")} target="_blank" rel="noreferrer">+ Customize Now</a>
              </div>
              <img src={getShowcaseProductImage(1)} alt="White T-shirt mockup ready for custom designs" />
            </Reveal>
          </div>
        </div>

        <div className="essentials" id="essentials">
          <Reveal variant="blur">
            <div className="section-heading section-heading--light">
              <div><p className="eyebrow">The foundation</p><h2>OUR ESSENTIALS</h2></div>
            </div>
          </Reveal>
          <Reveal variant="scale" stagger className="essentials-grid essentials-grid--compact">
            {[
              { label: "Oversized", alt: "Black oversized T-shirt front and back views", imageIndex: 0, theme: "oversized" },
              { label: "Hoodie", alt: "Black hoodie front and back views", imageIndex: 2, theme: "hoodie" },
            ].map((item) => {
              const image = getShowcaseProductImage(item.imageIndex);
              return (
                <a key={item.label} href="#footer" className={`essential-card essential-card--${item.theme} parallax-tilt`}>
                  <div className="essential-card__visual">
                    <div className="essential-card__backdrop" aria-hidden="true" />
                    <img src={image} alt={item.alt} />
                  </div>
                  <span>{item.label}</span>
                </a>
              );
            })}
          </Reveal>
        </div>

        <div className="bottom-visuals">
          <Reveal variant="scale" stagger>
            <div className="bottom-visuals__grid">
              <div className="visual-block visual-block--green"><img src={getShowcaseProductImage(1)} alt="White T-shirt front and back views" /></div>
              <div className="visual-block visual-block--cream"><span className="float-slow">Made for<br /><em>every day.</em></span></div>
              <div className="visual-block visual-block--green"><img src={getShowcaseProductImage(0)} alt="Black T-shirt front and back views" /></div>
            </div>
          </Reveal>
        </div>

        <section className="lifestyle-section" aria-labelledby="lifestyle-heading">
          <Reveal variant="blur">
            <h2 id="lifestyle-heading">Shop by Lifestyle</h2>
          </Reveal>
          <div className="lifestyle-slider" onTouchStart={handleLifestyleTouchStart} onTouchEnd={handleLifestyleTouchEnd}>
            <button
              className="lifestyle-slider__arrow lifestyle-slider__arrow--left"
              type="button"
              aria-label="Previous lifestyle videos"
              disabled={lifestyleTransitioning || lifestyleIndex <= 0 || lifestyleStep === 0}
              onClick={() => scrollLifestyle("left")}
            >
              <ArrowLeft size={18} strokeWidth={1.5} />
            </button>
            <div className="lifestyle-grid" ref={lifestyleViewportRef}>
              <div
                className="lifestyle-grid__track"
                ref={lifestyleTrackRef}
                onTransitionEnd={handleLifestyleTransitionEnd}
                style={{
                  transform: `translate3d(calc(-${lifestyleIndex * lifestyleStep}px + var(--lifestyle-peek)), 0, 0)`,
                  transition: lifestyleTransitioning ? "transform 0.7s cubic-bezier(.23,1,.32,1)" : "none",
                }}
              >
                {lifestyleSlides.map((video, index) => (
                  <div
                    className={cls("lifestyle-video", index === lifestyleIndex ? "lifestyle-video--active" : null)}
                    key={`${video.id}-${index}`}
                    ref={index === 0 ? lifestyleSlideRef : undefined}
                  >
                    <video src={video.url} poster={video.thumbnail} autoPlay loop muted playsInline preload="metadata" aria-label={`${video.title} lifestyle video`} />
                  </div>
                ))}
              </div>
            </div>
            <button
              className="lifestyle-slider__arrow lifestyle-slider__arrow--right"
              type="button"
              aria-label="Next lifestyle videos"
              disabled={lifestyleTransitioning || lifestyleIndex >= maxLifestyleIndex || lifestyleStep === 0}
              onClick={() => scrollLifestyle("right")}
            >
              <ArrowRight size={18} strokeWidth={1.5} />
            </button>
          </div>
          {videosLoading && <p className="lifestyle-section__message" role="status">Loading videos...</p>}
          {!videosLoading && videosError && <p className="lifestyle-section__message" role="alert">{videosError}</p>}
          {!videosLoading && !videosError && lifestyleSlides.length === 0 && <p className="lifestyle-section__message" role="status">No active videos are available right now.</p>}
        </section>
      </main>

    </div>
  );
}
