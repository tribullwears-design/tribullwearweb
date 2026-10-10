// Tribull Home — Figma node 103:83 with rich scroll-triggered animations, staggered reveals, and parallax.
import { ArrowLeft, ArrowRight, ArrowUpRight, Instagram, MapPin } from "lucide-react";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import MobileCategoryMenu from "../components/MobileCategoryMenu";
import HeaderActions from "../components/HeaderActions";
import ProductPrice from "../components/ProductPrice";
import { defaultCategoryHierarchy, getStorefrontCategoryHierarchy, useCategoryHierarchy, type CategoryHierarchy } from "../lib/categoryHierarchy";
import { getShowcaseProductHoverImage, getShowcaseProductImage } from "../lib/storefrontProductImage";

const brandAssets = {
  logo: "/products/logo.png",
  hero: "/products/homebanner.jpg",
  cinema: "/products/cinema.png",
  sports: "/products/sports.png",
  games: "/products/games.png",
  motorsports: "/products/motosports.jpg",
};

const productImages = {
  backBlack: "/products/back-black.png",
  frontWhite: "/products/front-white.png",
  hangerWhite: "/products/hanger-white.png",
  flatWhite: "/products/flat-white.png",
};

const newArrivals = [
  [productImages.frontWhite, "Spider Web Tee", "₹1,519"],
  [productImages.hangerWhite, "Classic Spider Tee", "₹1,739"],
  [productImages.flatWhite, "Graphic Cotton Tee", "₹1,599"],
  [productImages.backBlack, "Oversized Spider Tee", "₹2,499"],
  [productImages.frontWhite, "Premium Spider Tee", "₹1,899"],
  [productImages.hangerWhite, "Vintage Spider Print", "₹1,649"],
];

const bestSelling = [
  [productImages.backBlack, "Spider Back Print Tee", "₹1,449"],
  [productImages.frontWhite, "Spider Web Front Tee", "₹1,559"],
  [productImages.flatWhite, "Swinging Legends Tee", "₹1,369"],
  [productImages.hangerWhite, "Spider Graphic Tee", "₹1,669"],
  [productImages.flatWhite, "Dark Spider Collection", "₹1,799"],
  [productImages.backBlack, "Classic Spider Heritage", "₹1,929"],
];

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

function ProductCard({ item, delay = 0, showMeta = true, href }: { item: string[]; delay?: number; showMeta?: boolean; href: string }) {
  const { ref, visible } = useScrollReveal<HTMLElement>();
  const hoverImage = getShowcaseProductHoverImage(item[0]);
  return (
    <Link href={href} className="product-card-link" aria-label={`Open ${item[1]} product page`}>
      <article
        ref={ref}
        className={cls("product-card", "reveal-scale-in", "parallax-tilt", visible ? "reveal-visible" : null)}
        style={{ transitionDelay: `${delay}s` }}
      >
        <div className="product-card__image">
          <img src={item[0]} alt={item[1]} className="product-image-primary" loading="lazy" />
          {hoverImage ? <img src={hoverImage} alt="" aria-hidden="true" className="product-image-hover" loading="lazy" /> : null}
        </div>
        {showMeta && <div className="product-card__meta"><h3>{item[1]}</h3><ProductPrice sellingPrice={item[2]} productName={item[1]} /></div>}
      </article>
    </Link>
  );
}

export default function Home() {
  const fetchedHierarchy = useCategoryHierarchy(categoryHierarchyFallback);
  const hierarchy = getStorefrontCategoryHierarchy(fetchedHierarchy);
  const pageRef = useRef<HTMLDivElement>(null);
  const lifestyleTrackRef = useRef<HTMLDivElement>(null);
  const lifestyleViewportRef = useRef<HTMLDivElement>(null);
  const lifestyleSlideRef = useRef<HTMLDivElement>(null);
  const [lifestyleIndex, setLifestyleIndex] = useState(0);
  const [lifestyleStep, setLifestyleStep] = useState(0);
  const [lifestyleTransitioning, setLifestyleTransitioning] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const lifestyleVideos = ["video1", "video2", "video3", "video4"];
  const lifestyleSlides = Array.from({ length: 6 }, (_, index) => lifestyleVideos[index % lifestyleVideos.length]);
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

      <nav className="category-nav" aria-label="Cinema categories">
        <div className="category-nav__track">
          {(hierarchy.subcategories.cinema || []).map(({ value, label, image }) => (
            <a className="category-nav__item" href={`/category/cinema/${value}`} key={value}>
              <span className="category-nav__image"><img src={image || "/products/front-white.png"} alt="" /></span>
              <span className="category-nav__label">{label}</span>
            </a>
          ))}
        </div>
      </nav>

      <main>
        <section className="hero" aria-label="Tribull new collection">
          <div className="hero__images">
            <div className="hero__image">
              <img src={brandAssets.hero} alt="Tribull collection" />
            </div>
          </div>
          <div className="hero__wash" />
          <div className="hero__copy">
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
            <div className="product-grid">
              {newArrivals.map((item, idx) => (
                <ProductCard
                  item={[getShowcaseProductImage(idx), item[1], item[2]]}
                  key={`${item[1]}-${idx}`}
                  delay={0.08 * idx}
                  href={`/product/hollywood-${idx}?name=${encodeURIComponent(item[1])}&price=${encodeURIComponent(item[2])}&image=${encodeURIComponent(getShowcaseProductImage(idx))}`}
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
            <div className="product-grid product-grid--image-only">
              {bestSelling.map((item, idx) => (
                <ProductCard
                  item={[getShowcaseProductImage(idx), item[1], item[2]]}
                  key={`${item[1]}-${idx}`}
                  delay={0.08 * idx}
                  href={`/product/hollywood-${idx + 10}?name=${encodeURIComponent(item[1])}&price=${encodeURIComponent(item[2])}&image=${encodeURIComponent(getShowcaseProductImage(idx))}`}
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
                    key={`${video}-${index}`}
                    ref={index === 0 ? lifestyleSlideRef : undefined}
                  >
                    <video src={`/products/${video}.mp4`} autoPlay loop muted playsInline preload="metadata" aria-label={`${video} lifestyle video`} />
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
        </section>
      </main>

    </div>
  );
}
