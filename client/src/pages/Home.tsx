// Tribull Home — Figma node 103:83 with rich scroll-triggered animations, staggered reveals, and parallax.
import { ArrowLeft, ArrowRight, ArrowUpRight, Instagram, MapPin, Menu, Search, ShoppingBag, User, Heart } from "lucide-react";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { useEffect, useRef } from "react";

const brandAssets = {
  logo: "/products/logo.png",
  hero: "/products/homebanner.jpg",
  cinema: "/products/cinema.jpg",
  sports: "/products/sports.png",
  games: "/products/games.jpg",
  motorsports: "/products/motosports.jpg",
};

const productImages = {
  backBlack: "/products/back-black.png",
  frontWhite: "/products/front-white.png",
  hangerWhite: "/products/hanger-white.png",
  flatWhite: "/products/flat-white.png",
  essentialMensShirt: "/products/essential-mens-shirt.png",
  essentialTshirts: "/products/essential-tshirts.png",
  essentialOversized: "/products/essential-oversized.png",
  essentialHoodies: "/products/essential-hoodies.png",
};

const newArrivals = [
  [productImages.frontWhite, "Spider Web Tee", "₹1,519"],
  [productImages.hangerWhite, "Classic Spider Tee", "₹1,739"],
  [productImages.flatWhite, "Graphic Cotton Tee", "₹1,599"],
  [productImages.backBlack, "Oversized Spider Tee", "₹2,499"],
];

const bestSelling = [
  [productImages.backBlack, "Spider Back Print Tee", "₹1,449"],
  [productImages.frontWhite, "Spider Web Front Tee", "₹1,559"],
  [productImages.flatWhite, "Swinging Legends Tee", "₹1,369"],
  [productImages.hangerWhite, "Spider Graphic Tee", "₹1,669"],
];

const whatsappUrl = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;

const categories = [
  { slug: "cinema", label: "Cinema", image: brandAssets.cinema, subcategories: ["oversized", "tshirt"] },
  { slug: "sports", label: "Sports", image: brandAssets.sports, subcategories: ["hoodie", "half-sleeve"] },
  { slug: "games", label: "Games", image: brandAssets.games, subcategories: ["full-sleeve", "oversized"] },
  { slug: "motorsports", label: "MotoSports", image: brandAssets.motorsports, subcategories: ["hoodie", "oversized"] },
];

const categoryNavItems = [
  { label: "Cinema", image: brandAssets.cinema, href: "/category/cinema" },
  { label: "Sports", image: brandAssets.sports, href: "/category/sports" },
  { label: "Games", image: brandAssets.games, href: "/category/games" },
  { label: "MotoSports", image: brandAssets.motorsports, href: "/category/motorsports" },
  { label: "Round Neck", image: "/products/roundneckicon.png", href: "/products" },
  { label: "Oversized", image: "/products/oversizedicon.png", href: "/products" },
  { label: "Acid Wash", image: "/products/acidoverwashicon.png", href: "/products" },
  { label: "Hoodies", image: "/products/hoodieicon.png", href: "/products" },
];

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
      className={cls(base, stagger ? "reveal-stagger" : null, visible ? "reveal-visible" : null, className)}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

function ProductCard({ item, delay = 0 }: { item: string[]; delay?: number }) {
  const { ref, visible } = useScrollReveal<HTMLElement>();
  return (
    <article
      ref={ref}
      className={cls("product-card", "reveal-scale-in", "parallax-tilt", visible ? "reveal-visible" : null)}
      style={{ transitionDelay: `${delay}s` }}
    >
      <div className="product-card__image"><img src={item[0]} alt={item[1]} loading="lazy" /></div>
      <div className="product-card__meta"><h3>{item[1]}</h3><p>{item[2]}</p></div>
    </article>
  );
}

export default function Home() {
  const heroImgRef = useRef<HTMLImageElement>(null);
  const heroCopyRef = useRef<HTMLDivElement>(null);
  const heroStampRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const lifestyleTrackRef = useRef<HTMLDivElement>(null);

  const scrollLifestyle = (direction: "left" | "right") => {
    lifestyleTrackRef.current?.scrollBy({ left: direction === "left" ? -320 : 320, behavior: "smooth" });
  };

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 1200) {
          if (heroImgRef.current) heroImgRef.current.style.transform = `translate3d(0, ${y * 0.08}px, 0)`;
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
    <div id="top" className="tribull-page" ref={pageRef}>
      <div className="ticker" aria-label="Announcement"><div className="ticker__track">{Array.from({ length: 7 }).map((_, i) => <span key={i}>100% Cotton.<b>Shop Now</b><i>✦</i></span>)}</div></div>
      <header className="site-header">
        <button className="icon-button mobile-menu" aria-label="Open menu"><Menu size={20} strokeWidth={1.5} /></button>
        <Wordmark />
        <div className="header-actions"><button className="icon-button" aria-label="Search"><Search size={19} strokeWidth={1.5} /></button><button className="icon-button" aria-label="Account"><User size={19} strokeWidth={1.5} /></button><button className="icon-button" aria-label="Wishlist"><Heart size={19} strokeWidth={1.5} /></button><a className="icon-button" href="/product/hollywood-0" aria-label="Shopping bag"><ShoppingBag size={19} strokeWidth={1.5} /></a></div>
      </header>

      <nav className="category-nav" aria-label="Shop categories">
        <div className="category-nav__track">
          {categoryNavItems.map(({ label, image, href }) => (
            <a className="category-nav__item" href={href} key={label}>
              <span className="category-nav__image"><img src={image} alt="" /></span>
              <span className="category-nav__label">{label}</span>
            </a>
          ))}
        </div>
      </nav>

      <main>
        <section className="hero" aria-label="Tribull new collection">
          <div className="hero__images">
            <div className="hero__image">
              <img ref={heroImgRef} src={brandAssets.hero} alt="Tribull collection" />
            </div>
          </div>
          <div className="hero__wash" />
          <div className="hero__copy" ref={heroCopyRef}>
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
          <div className="hero__stamp float-fast" ref={heroStampRef}>TRIBULL<br /><span>EST. 2024</span></div>
        </section>

        <div className="peach-wrapper">
          <div className="category-section" id="categories">
            <Reveal variant="left">
              <div className="section-lead section-lead--centered">
                <h2>Shop by category</h2>
              </div>
            </Reveal>
            <Reveal variant="scale" stagger className="category-grid">
              {categories.map(({ slug, label, image, subcategories }) => (
                <div className="category-item" key={label}>
                  <a href={`/category/${slug}`} className="category-card parallax-tilt">
                    <img src={image} alt="" loading="lazy" />
                    <span>{label}</span>
                    <ArrowUpRight size={17} />
                  </a>
                </div>
              ))}
            </Reveal>
          </div>
        </div>

        <div className="peach-wrapper">
          <div className="product-section" id="arrivals">
            <Reveal>
              <div className="section-heading">
                <Reveal variant="left"><div><p className="eyebrow"></p><h2>New Arrivals</h2></div></Reveal>
              </div>
            </Reveal>
            <div className="product-grid">
              {newArrivals.map((item, idx) => <ProductCard item={item} key={item[1]} delay={0.08 * idx} />)}
            </div>
            <a className="view-all text-link" href="#best-selling">View all <ArrowUpRight size={16} /></a>
          </div>
        </div>

        <div className="peach-wrapper">
          <div className="product-section product-section--best" id="best-selling">
            <Reveal>
              <div className="section-heading">
                <Reveal variant="left"><div><p className="eyebrow"></p><h2>Best Selling</h2></div></Reveal>
              </div>
            </Reveal>
            <div className="product-grid">
              {bestSelling.map((item, idx) => <ProductCard item={item} key={item[1]} delay={0.08 * idx} />)}
            </div>
            <a className="view-all text-link" href="#essentials">View all <ArrowUpRight size={16} /></a>
          </div>
        </div>

        <div className="essentials" id="essentials">
          <Reveal variant="blur">
            <div className="section-heading section-heading--light">
              <div><p className="eyebrow">The foundation</p><h2>OUR ESSENTIALS</h2></div>
            </div>
          </Reveal>
          <Reveal variant="scale" stagger className="essentials-grid">
            <a href="#footer" className="essential-card parallax-tilt"><img src={productImages.essentialMensShirt} alt="Round Neck" /><span>Round Neck</span></a>
            <a href="#footer" className="essential-card parallax-tilt"><img src={productImages.essentialTshirts} alt="Oversized" /><span>Oversized</span></a>
            <a href="#footer" className="essential-card parallax-tilt"><img src={productImages.essentialOversized} alt="Acid Wash Oversized" /><span>Acid Wash Oversized</span></a>
            <a href="#footer" className="essential-card parallax-tilt"><img src={productImages.essentialHoodies} alt="Hoodie" /><span>Hoodie</span></a>
          </Reveal>
        </div>

        <div className="peach-wrapper">
          <div className="cooperate-options">
            <Reveal variant="left" className="cooperate-option cooperate-option--corporate">
              <div className="cooperate-option__copy">
                <h2>Corporate</h2>
                <p>Anything &amp; Anything for<br />your Teams / Office</p>
                <a className="button cooperate-option__button" href={whatsappUrl("Hi Tribull, I would like to shop for my team.")} target="_blank" rel="noreferrer">+ Shop for your Team</a>
              </div>
              <img src="/products/hoodieicon.png" alt="Custom team hoodie" />
            </Reveal>
            <Reveal variant="right" className="cooperate-option cooperate-option--custom">
              <div className="cooperate-option__copy">
                <h2>Customize</h2>
                <p>Design your own t-shirts<br />hoodies &amp; more with Dudeme!</p>
                <a className="button cooperate-option__button" href={whatsappUrl("Hi Tribull, I would like to customize T-shirts and hoodies.")} target="_blank" rel="noreferrer">+ Customize Now</a>
              </div>
              <img src="/products/tshirt.jpg" alt="Custom graphic T-shirt" />
            </Reveal>
          </div>
        </div>

        <div className="bottom-visuals">
          <Reveal variant="scale" stagger>
            <div className="bottom-visuals__grid">
              <div className="visual-block visual-block--green"><img src={productImages.flatWhite} alt="Graphic spider T-shirt" /></div>
              <div className="visual-block visual-block--cream"><span className="float-slow">Made for<br /><em>every day.</em></span></div>
              <div className="visual-block visual-block--green"><img src={productImages.backBlack} alt="Black oversized graphic T-shirt" /></div>
            </div>
          </Reveal>
        </div>

        <section className="lifestyle-section" aria-labelledby="lifestyle-heading">
          <Reveal variant="blur">
            <h2 id="lifestyle-heading">Shop by Lifestyle</h2>
          </Reveal>
          <div className="lifestyle-slider">
            <button className="lifestyle-slider__arrow lifestyle-slider__arrow--left" type="button" aria-label="Previous lifestyle videos" onClick={() => scrollLifestyle("left")}>
              <ArrowLeft size={18} strokeWidth={1.5} />
            </button>
            <div className="lifestyle-grid" ref={lifestyleTrackRef}>
              {["video1", "video2", "video3", "video4"].map((video) => (
                <div className="lifestyle-video" key={video}>
                  <video src={`/products/${video}.mp4`} autoPlay loop muted playsInline preload="metadata" aria-label={`${video} lifestyle video`} />
                </div>
              ))}
            </div>
            <button className="lifestyle-slider__arrow lifestyle-slider__arrow--right" type="button" aria-label="Next lifestyle videos" onClick={() => scrollLifestyle("right")}>
              <ArrowRight size={18} strokeWidth={1.5} />
            </button>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="footer">
        <div className="footer__top">
          <Reveal variant="left" className="footer__col">
            <h3 className="footer__col-title">Need Help</h3>
            <div className="footer__links">
              <a href="#top">Contact Us</a>
              <a href="#top">Track Order</a>
              <a href="#top">Returns & Refunds</a>
              <a href="#top">FAQs</a>
              <a href="#top">My Account</a>
            </div>
            <div className="footer__badges">
              <span className="footer__badge"><span className="footer__badge-icon">₹</span> COD Available</span>
              <span className="footer__badge"><span className="footer__badge-icon">↻</span> 30 Days Easy Returns & Exchanges</span>
            </div>
          </Reveal>
          <Reveal variant="up" delay={0.08} className="footer__col">
            <h3 className="footer__col-title">Company</h3>
            <div className="footer__links">
              <a href="#top">About Us</a>
              <a href="#top">Investor Relation</a>
              <a href="#top">Careers</a>
              <a href="#top">Gift Vouchers</a>
              <a href="#top">Community Initiatives</a>
            </div>
          </Reveal>
        </div>

        <Reveal variant="blur" delay={0.3} className="footer__app">
          <p className="footer__app-title">📱 Experience the Souled Store App</p>
          <div className="footer__app-buttons">
            <a href="#top" className="app-btn">
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
              <div>
                <small>GET IT ON</small>
                <span>Google Play</span>
              </div>
            </a>
            <a href="#top" className="app-btn">
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              <div>
                <small>Download on the</small>
                <span>App Store</span>
              </div>
            </a>
          </div>
        </Reveal>

        <div className="footer__middle">
          <Reveal variant="left" delay={0.35} className="footer__brand-row">
            <Wordmark inverse />
          </Reveal>
          <Reveal variant="right" delay={0.4} className="footer__social">
            <span>Follow Us:</span>
            <a href="#top" className="social-link social-link--fb" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg></a>
            <a href="#top" className="social-link social-link--ig" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
            <a href="#top" className="social-link social-link--yt" aria-label="YouTube"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
            <a href="#top" className="social-link social-link--x" aria-label="X"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
          </Reveal>
        </div>

        <Reveal variant="blur" className="footer__bottom" delay={0.55}>
          <span>© The Souled Store 2026-27</span>
          <span>100% cotton, always.</span>
        </Reveal>
      </footer>
    </div>
  );
}
