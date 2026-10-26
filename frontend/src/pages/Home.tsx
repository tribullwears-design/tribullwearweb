// Tribull Home — Figma node 103:83 with rich scroll-triggered animations, staggered reveals, and parallax.
import { ArrowLeft, ArrowRight, ArrowUpRight, Instagram, MapPin, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import MobileCategoryMenu from "../components/MobileCategoryMenu";
import HeaderActions from "../components/HeaderActions";
import MovingNavbar from "../components/MovingNavbar";
import ProductPrice from "../components/ProductPrice";
import { defaultCategoryHierarchy, getStorefrontCategoryHierarchy, getStorefrontHomeCategories, useCategoryHierarchy, type CategoryHierarchy } from "../lib/categoryHierarchy";
import { getShowcaseProductImage } from "../lib/storefrontProductImage";
import { fetchProducts, getCachedProducts, getEligibleStorefrontProducts, refreshProducts } from "../lib/products";
import { getAlternateProductImage, getBestSellingProducts, getNewArrivals } from "../lib/homeProducts";
import type { StorefrontProduct } from "../lib/products";
import { getCachedCategoryBanner, loadCategoryBanner } from "../lib/categoryBanners";
import { featureImagesUpdatedEvent, getCachedFeatureImages, loadFeatureImages } from "../lib/featureImages";
import { useSiteLogo } from "../contexts/SiteLogoContext";

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
type HomeVideo = { id: string; title: string; url: string; thumbnail?: string; category?: string };
const HOME_VIDEOS_CACHE_KEY = "tribull-home-videos";

function getCachedHomeVideos(): HomeVideo[] {
  try {
    const cached = window.sessionStorage.getItem(HOME_VIDEOS_CACHE_KEY);
    if (!cached) return [];
    const videos: unknown = JSON.parse(cached);
    if (!Array.isArray(videos)) return [];
    return videos.filter((video): video is HomeVideo =>
      Boolean(video && typeof video === "object"
        && typeof video.id === "string"
        && typeof video.title === "string"
        && typeof video.url === "string"),
    );
  } catch {
    return [];
  }
}

function hasCachedHomeVideos() {
  return getCachedHomeVideos().length > 0;
}

function cls(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

function Wordmark({ inverse = false }: { inverse?: boolean }) {
  const logo = useSiteLogo();
  return (
    <a className={`wordmark ${inverse ? "wordmark--inverse" : ""}`} href="#top" aria-label="Tribull home">
      <img src={logo} alt="TRIBULL" />
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
    <Link href={href} className="product-card-link" aria-label={`Browse products, including ${item[1]}`}>
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
  const [homeVideos, setHomeVideos] = useState<HomeVideo[]>(getCachedHomeVideos);
  const [videosLoading, setVideosLoading] = useState(() => !hasCachedHomeVideos());
  const [videosError, setVideosError] = useState("");
  const [customerReviewPage, setCustomerReviewPage] = useState(0);
  const [homeBanner, setHomeBanner] = useState(() => getCachedCategoryBanner("home"));
  const [featureImages, setFeatureImages] = useState(getCachedFeatureImages);
  const pageRef = useRef<HTMLDivElement>(null);
  const lifestyleSectionRef = useRef<HTMLElement>(null);
  const lifestyleTrackRef = useRef<HTMLDivElement>(null);
  const lifestyleViewportRef = useRef<HTMLDivElement>(null);
  const lifestyleSlideRef = useRef<HTMLDivElement>(null);
  const [lifestyleIndex, setLifestyleIndex] = useState(0);
  const [lifestyleStep, setLifestyleStep] = useState(0);
  const [lifestyleVisibleCount, setLifestyleVisibleCount] = useState(3);
  const [lifestyleTransitioning, setLifestyleTransitioning] = useState(false);
  const [lifestyleMediaReady, setLifestyleMediaReady] = useState(false);
  const [lifestyleSectionVisible, setLifestyleSectionVisible] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const lifestyleVideoRefs = useRef(new Map<string, HTMLVideoElement>());

  useEffect(() => {
    let active = true;
    let loadingImages = false;
    const refreshFeatureImages = async (refresh = false) => {
      if (loadingImages) return;
      loadingImages = true;
      try {
        const images = await loadFeatureImages(refresh);
        if (active) setFeatureImages(images);
      } catch (error: unknown) {
        console.error("Could not load homepage feature images.", error);
      } finally {
        loadingImages = false;
      }
    };
    void refreshFeatureImages();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "tribull-feature-images-updated") void refreshFeatureImages(true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshFeatureImages();
    };
    const onFeatureImagesUpdated = () => void refreshFeatureImages(true);
    const onFocus = () => void refreshFeatureImages();
    window.addEventListener(featureImagesUpdatedEvent, onFeatureImagesUpdated);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener(featureImagesUpdatedEvent, onFeatureImagesUpdated);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
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
    void fetch("/api/videos").then(async (response) => {
      if (!response.ok) throw new Error("Videos could not be loaded.");
      const savedVideos = await response.json() as HomeVideo[];
      try {
        window.sessionStorage.setItem(HOME_VIDEOS_CACHE_KEY, JSON.stringify(savedVideos));
      } catch {
        // Keep the fetched videos available even when browser storage is unavailable.
      }
      if (active) setHomeVideos(savedVideos);
    }).catch((error: unknown) => {
      if (active) setVideosError(error instanceof Error ? error.message : "Videos could not be loaded.");
    }).finally(() => { if (active) setVideosLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const section = lifestyleSectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setLifestyleMediaReady(true);
      setLifestyleSectionVisible(true);
      return;
    }

    const preloadObserver = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setLifestyleMediaReady(true);
        preloadObserver.disconnect();
      }
    }, { rootMargin: "3000px 0px" });
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      setLifestyleSectionVisible(Boolean(entry?.isIntersecting));
    }, { threshold: 0.05 });
    preloadObserver.observe(section);
    visibilityObserver.observe(section);

    return () => {
      preloadObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    homeVideos.forEach((video, index) => {
      const element = lifestyleVideoRefs.current.get(video.id);
      if (!element) return;
      const shouldPlay = lifestyleMediaReady
        && lifestyleSectionVisible
        && index === lifestyleIndex;
      if (!shouldPlay) {
        element.pause();
        return;
      }
      void element.play().catch((error: unknown) => {
        if (error instanceof DOMException && (error.name === "AbortError" || error.name === "NotAllowedError")) return;
        console.error(`Could not play lifestyle video "${video.title}".`, error);
      });
    });
  }, [homeVideos, lifestyleIndex, lifestyleMediaReady, lifestyleSectionVisible, lifestyleVisibleCount]);

  useEffect(() => {
    let active = true;
    void loadCategoryBanner("home").then((banner) => {
      if (active) setHomeBanner(banner);
    }).catch((error: unknown) => {
      console.error("Homepage banner request failed.", error);
    });
    return () => { active = false; };
  }, []);


  const lifestyleSlides = homeVideos;
  const maxLifestyleIndex = Math.max(0, lifestyleSlides.length - lifestyleVisibleCount);
  const lifestylePreloadEnd = lifestyleIndex + Math.max(lifestyleVisibleCount, 2) + 1;

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

  const eligibleProducts = hierarchy.loaded ? getEligibleStorefrontProducts(catalogProducts, hierarchy) : catalogProducts;
  const arrivals = getNewArrivals(eligibleProducts, hierarchy);
  const arrivalCards = arrivals.map((product) => ({
    item: [product.image, product.name, `₹${product.price.toLocaleString("en-IN")}`],
    href: "/products",
    originalPrice: product.originalPrice,
    hoverImage: getAlternateProductImage(product),
  }));
  const bestSellingCards = getBestSellingProducts(eligibleProducts, hierarchy).map((product) => ({
      item: [product.image, product.name, `₹${product.price.toLocaleString("en-IN")}`],
      href: "/products",
      originalPrice: product.originalPrice,
      hoverImage: getAlternateProductImage(product),
    }));
  const customerReviews = [
      { customerName: "Arun Kumar", comment: "Good product!" },
      { customerName: "Priya S", comment: "Nice product!" },
      { customerName: "Karthik R", comment: "Love the fit!" },
      { customerName: "Nisha M", comment: "Great quality!" },
  ].map((review, index) => {
    const product = eligibleProducts[index];
    return {
      ...review,
      productImage: product?.image || getShowcaseProductImage(index),
    };
  });

  return (
    <div id="top" className="tribull-page" ref={pageRef}>
      <MovingNavbar />

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
              <img key={homeBanner?.image || brandAssets.hero} src={homeBanner?.image || brandAssets.hero} alt={homeBanner?.title || "Tribull collection"} fetchPriority="high" decoding="async" />
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
              <img key={featureImages.corporate || "/products/hoodieicon.png"} src={featureImages.corporate || "/products/hoodieicon.png"} alt="Corporate team apparel" decoding="async" />
            </Reveal>
            <Reveal className="cooperate-option cooperate-option--custom" id="customize">
              <div className="cooperate-option__copy">
                <h2>Customize</h2>
                <p>Design your own t-shirts<br />hoodies &amp; more.</p>
                <a className="button cooperate-option__button" href={whatsappUrl("Hi Tribull, I would like to customize T-shirts and hoodies.")} target="_blank" rel="noreferrer">+ Customize Now</a>
              </div>
              <img key={featureImages.customize || getShowcaseProductImage(1)} src={featureImages.customize || getShowcaseProductImage(1)} alt="Custom apparel design" decoding="async" />
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

        <section className="customer-reviews" aria-labelledby="customer-reviews-heading">
          <div className="customer-reviews__heading">
            <h2 id="customer-reviews-heading">Our Customers Feel</h2>
          </div>
          <div className="customer-reviews__carousel">
            <div className="customer-reviews__grid">
              {customerReviews.map((review, index) => (
                <article
                  className={cls("customer-review-card", Math.floor(index / 2) !== customerReviewPage ? "customer-review-card--mobile-hidden" : null)}
                  key={`${review.customerName}-${index}`}
                >
                  <img className="customer-review-card__image" src={review.productImage} alt="" loading="lazy" decoding="async" />
                  <div className="customer-review-card__content">
                    <h3>{review.customerName}</h3>
                    <div className="customer-review-card__stars" aria-label="5 out of 5 stars">
                      {Array.from({ length: 5 }, (_, index) => <Star key={index} size={16} fill="currentColor" aria-hidden="true" />)}
                    </div>
                    <p className="customer-review-card__comment">“{review.comment}”</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="customer-reviews__controls" aria-label="Customer review pages">
              <button
                className="customer-reviews__arrow"
                type="button"
                aria-label="Previous customer reviews"
                disabled={customerReviewPage === 0}
                onClick={() => setCustomerReviewPage((page) => Math.max(0, page - 1))}
              >
                <ArrowLeft size={18} strokeWidth={1.5} />
              </button>
              <button
                className="customer-reviews__arrow"
                type="button"
                aria-label="Next customer reviews"
                disabled={customerReviewPage >= Math.ceil(customerReviews.length / 2) - 1}
                onClick={() => setCustomerReviewPage((page) => Math.min(Math.ceil(customerReviews.length / 2) - 1, page + 1))}
              >
                <ArrowRight size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </section>

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
                    <video
                      ref={(element) => {
                        if (element) lifestyleVideoRefs.current.set(video.id, element);
                        else lifestyleVideoRefs.current.delete(video.id);
                      }}
                      src={lifestyleMediaReady && index >= lifestyleIndex && index < lifestylePreloadEnd ? video.url : undefined}
                      poster={video.thumbnail}
                      autoPlay={lifestyleMediaReady && lifestyleSectionVisible && index === lifestyleIndex}
                      loop
                      muted
                      playsInline
                      preload={!lifestyleMediaReady || index < lifestyleIndex || index >= lifestylePreloadEnd ? "none" : "metadata"}
                      aria-label={`${video.title} lifestyle video`}
                    />
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
