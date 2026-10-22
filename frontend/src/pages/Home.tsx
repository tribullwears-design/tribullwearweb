// Tribull Home — Figma node 103:83 with rich scroll-triggered animations, staggered reveals, and parallax.
import { ArrowLeft, ArrowRight, ArrowUpRight, Instagram, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import MobileCategoryMenu from "../components/MobileCategoryMenu";
import HeaderActions from "../components/HeaderActions";
import ProductPrice from "../components/ProductPrice";
import { defaultCategoryHierarchy, getStorefrontCategoryHierarchy, getStorefrontHomeCategories, useCategoryHierarchy, type CategoryHierarchy } from "../lib/categoryHierarchy";
import { getShowcaseProductImage } from "../lib/storefrontProductImage";
import { fetchProducts, getCachedProducts, getEligibleStorefrontProducts, productHref, refreshProducts } from "../lib/products";
import { getAlternateProductImage, getBestSellingProducts, getNewArrivals } from "../lib/homeProducts";
import type { StorefrontProduct } from "../lib/products";
import { loadCategoryBanner } from "../lib/categoryBanners";
import { loadFeatureImages } from "../lib/featureImages";

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

function Reveal({ children, className = "", id }: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return <div id={id} className={className}>{children}</div>;
}

function ProductCard({ item, showMeta = true, href, originalPrice, hoverImage }: { item: string[]; showMeta?: boolean; href: string; originalPrice?: number; hoverImage?: string }) {
  const [hoverImageLoaded, setHoverImageLoaded] = useState(false);

  return (
    <Link href={href} className="product-card-link" aria-label={`Open ${item[1]} product page`}>
      <article
        className={cls("product-card", "parallax-tilt", hoverImageLoaded ? "product-card--has-hover-image" : null)}
      >
        <div className="product-card__image">
          <img src={item[0]} alt={item[1]} className="product-image-primary" loading="eager" decoding="async" />
          {hoverImage && <img src={hoverImage} alt="" aria-hidden="true" className="product-image-hover" decoding="async" onLoad={() => setHoverImageLoaded(true)} />}
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
  const [catalogProducts, setCatalogProducts] = useState<StorefrontProduct[]>(getCachedProducts);
  const [homeVideos, setHomeVideos] = useState<Array<{ id: string; title: string; url: string; thumbnail?: string; category?: string }>>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [videosError, setVideosError] = useState("");
  const [homeBanner, setHomeBanner] = useState<{ image: string; title?: string; subtitle?: string; link?: string } | null>(null);
  const [featureImages, setFeatureImages] = useState<{ customize: string | null; corporate: string | null }>({ customize: null, corporate: null });
  const pageRef = useRef<HTMLDivElement>(null);
  const lifestyleSectionRef = useRef<HTMLElement>(null);
  const lifestyleTrackRef = useRef<HTMLDivElement>(null);
  const lifestyleViewportRef = useRef<HTMLDivElement>(null);
  const lifestyleSlideRef = useRef<HTMLDivElement>(null);
  const [lifestyleIndex, setLifestyleIndex] = useState(0);
  const [lifestyleStep, setLifestyleStep] = useState(0);
  const [lifestyleVisibleCount, setLifestyleVisibleCount] = useState(3);
  const [lifestyleTransitioning, setLifestyleTransitioning] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void loadFeatureImages().then((images) => {
      if (active) setFeatureImages(images);
    }).catch((error: unknown) => {
      console.error("Could not load homepage feature images.", error);
    });
    return () => { active = false; };
  }, []);

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
    const refreshCatalog = () => syncProducts();
    window.addEventListener("tribull-products-updated", refreshCatalog);
    window.addEventListener("tribull-products-cache-updated", refreshCatalog);
    return () => {
      active = false;
      window.removeEventListener("tribull-products-updated", refreshCatalog);
      window.removeEventListener("tribull-products-cache-updated", refreshCatalog);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setVideosLoading(true);
    void fetch("/api/videos").then(async (response) => {
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
  const maxLifestyleIndex = Math.max(0, lifestyleSlides.length - lifestyleVisibleCount);

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
      const viewport = lifestyleViewportRef.current;
      if (!slide || !track || !viewport) return;
      const styles = window.getComputedStyle(track);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      const slideWidth = slide.getBoundingClientRect().width;
      setLifestyleStep(slideWidth + gap);
      setLifestyleVisibleCount(Math.max(1, Math.floor((viewport.clientWidth + gap) / (slideWidth + gap))));
    };

    updateLifestyleStep();
    const observer = new ResizeObserver(updateLifestyleStep);
    if (lifestyleTrackRef.current) observer.observe(lifestyleTrackRef.current);
    if (lifestyleViewportRef.current) observer.observe(lifestyleViewportRef.current);
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
    hoverImage: getAlternateProductImage(product),
  }));
  const bestSellingCards = getBestSellingProducts(eligibleProducts, hierarchy).map((product) => ({
      item: [product.image, product.name, `₹${product.price.toLocaleString("en-IN")}`],
      href: productLink(product),
      originalPrice: product.originalPrice,
      hoverImage: getAlternateProductImage(product),
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

      {mainCategories.length > 0 ? <nav className="category-nav" aria-label="Shop by category">
        <div className="category-nav__track">
          {mainCategories.map(({ value, label, image, href }) => (
            <Link className="category-nav__item" href={href} key={value} aria-label={`Shop ${label}`}>
              <span className="category-nav__image"><img src={image} alt="" /></span>
              <span className="category-nav__label">{label}</span>
            </Link>
          ))}
        </div>
      </nav> : fetchedHierarchy.error
        ? <div className="category-nav__message" role="alert"><span>Categories could not be loaded.</span><button type="button" onClick={fetchedHierarchy.retry}>Retry</button></div>
        : <p className="category-nav__message" role="status">No visible categories are available right now.</p>}

      <main>
        <section className="hero" aria-label="Tribull new collection">
          <div className="hero__images">
            <div className="hero__image">
              <img src={homeBanner?.image || brandAssets.hero} alt={homeBanner?.title || "Tribull collection"} fetchPriority="high" decoding="async" />
            </div>
          </div>
          <div className="hero__wash" />
          <div className="hero__copy">
            {homeBanner?.title && <h1>{homeBanner.title}</h1>}
            {homeBanner?.subtitle && <p className="hero-description">{homeBanner.subtitle}</p>}
            {homeBanner?.link && <a className="button button--cream" href={homeBanner.link}>Shop now <ArrowUpRight size={17} /></a>}
            <Reveal>
              <p className="eyebrow" style={{ display: 'none' }}>The everyday uniform / 2026</p>
            </Reveal>
            <Reveal>
              <h1 style={{ display: 'none' }}>Wear what<br /><em>moves</em> you.</h1>
            </Reveal>
            <Reveal>
              <a className="button button--cream" href="#arrivals" style={{ display: 'none' }}>Shop now <ArrowUpRight size={17} /></a>
            </Reveal>
          </div>
          <div className="hero__stamp float-fast">TRIBULL<br /><span>EST. 2024</span></div>
        </section>

        <div className="peach-wrapper">
          <div className="product-section" id="arrivals">
            <Reveal>
              <div className="section-heading">
                <Reveal><div><p className="eyebrow"></p><h2>New Arrivals</h2></div></Reveal>
              </div>
            </Reveal>
            <div className="product-grid product-grid--featured">
              {arrivalCards.map(({ item, href, originalPrice, hoverImage }, idx) => (
                <ProductCard
                  item={item}
                  key={`${item[1]}-${idx}`}
                  href={href}
                  originalPrice={originalPrice}
                  hoverImage={hoverImage}
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
                <Reveal><div><p className="eyebrow"></p><h2>Best Selling</h2></div></Reveal>
              </div>
            </Reveal>
            <div className="product-grid product-grid--image-only product-grid--featured">
              {bestSellingCards.map(({ item, href, originalPrice, hoverImage }, idx) => (
                <ProductCard
                  item={item}
                  key={`${item[1]}-${idx}`}
                  href={href}
                  originalPrice={originalPrice}
                  hoverImage={hoverImage}
                />
              ))}
            </div>
            <a className="view-all text-link" href="/products">View all <ArrowUpRight size={16} /></a>
          </div>
        </div>

        <div className="peach-wrapper">
          <div className="cooperate-options">
            <Reveal className="cooperate-option cooperate-option--corporate" id="corporate">
              <div className="cooperate-option__copy">
                <h2>Corporate</h2>
                <p>Anything &amp; Anything for<br />your Teams / Office</p>
                <a className="button cooperate-option__button" href={whatsappUrl("Hi Tribull, I would like to shop for my team.")} target="_blank" rel="noreferrer">+ Shop for your Team</a>
              </div>
              <img src={featureImages.corporate || "/products/hoodieicon.png"} alt="Corporate team apparel" decoding="async" />
            </Reveal>
            <Reveal className="cooperate-option cooperate-option--custom" id="customize">
              <div className="cooperate-option__copy">
                <h2>Customize</h2>
                <p>Design your own t-shirts<br />hoodies &amp; more.</p>
                <a className="button cooperate-option__button" href={whatsappUrl("Hi Tribull, I would like to customize T-shirts and hoodies.")} target="_blank" rel="noreferrer">+ Customize Now</a>
              </div>
              <img src={featureImages.customize || getShowcaseProductImage(1)} alt="Custom apparel design" decoding="async" />
            </Reveal>
          </div>
        </div>

        <div className="essentials" id="essentials">
          <Reveal>
            <div className="section-heading section-heading--light">
              <div><p className="eyebrow">The foundation</p><h2>OUR ESSENTIALS</h2></div>
            </div>
          </Reveal>
          <Reveal className="essentials-grid essentials-grid--compact">
            {[
              { label: "Oversized", alt: "Black oversized T-shirt front and back views", imageIndex: 0, theme: "oversized" },
              { label: "Hoodie", alt: "Black hoodie front and back views", imageIndex: 2, theme: "hoodie" },
            ].map((item) => {
              const image = getShowcaseProductImage(item.imageIndex);
              return (
                <a key={item.label} href="#footer" className={`essential-card essential-card--${item.theme} parallax-tilt`}>
                  <div className="essential-card__visual">
                    <div className="essential-card__backdrop" aria-hidden="true" />
                    <img src={image} alt={item.alt} decoding="async" />
                  </div>
                  <span>{item.label}</span>
                </a>
              );
            })}
          </Reveal>
        </div>

        <div className="bottom-visuals">
          <Reveal>
            <div className="bottom-visuals__grid">
              <div className="visual-block visual-block--green"><img src={getShowcaseProductImage(1)} alt="White T-shirt front and back views" decoding="async" /></div>
              <div className="visual-block visual-block--cream"><span className="float-slow">Made for<br /><em>every day.</em></span></div>
              <div className="visual-block visual-block--green"><img src={getShowcaseProductImage(0)} alt="Black T-shirt front and back views" decoding="async" /></div>
            </div>
          </Reveal>
        </div>

        <section className="lifestyle-section" aria-labelledby="lifestyle-heading" ref={lifestyleSectionRef}>
          <Reveal>
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
