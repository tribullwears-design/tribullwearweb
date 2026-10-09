import { ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Minus, PackageCheck, Plus, ShieldCheck, ShoppingBag, Sparkles, Star, Truck } from "lucide-react";
import HeaderActions from "../components/HeaderActions";
import MobileCategoryMenu from "../components/MobileCategoryMenu";
import ProductPrice from "../components/ProductPrice";
import { resolveOriginalPrice, type OriginalPriceFields } from "../lib/productPrice";
import { Link, useParams } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { animateAddToCart } from "../lib/cartAnimation";

interface ProductData extends OriginalPriceFields {
  name: string;
  price: string;
  image: string;
  category: string;
}

const allCategoryProducts: Record<string, ProductData[]> = {
  hollywood: [
    { name: "Hollywood Icon Tee", price: "₹1,599", image: "/products/back-black.png", category: "Hollywood" },
    { name: "Hollywood Star Print", price: "₹1,799", image: "/products/batman.png", category: "Hollywood" },
    { name: "Hollywood Blockbuster", price: "₹1,999", image: "/products/bollywood.jpg", category: "Hollywood" },
    { name: "Hollywood Classic", price: "₹1,499", image: "/products/flat-white.png", category: "Hollywood" },
  ],
  bollywood: [
    { name: "Bollywood Dazzle Tee", price: "₹1,649", image: "/products/batman.png", category: "Bollywood" },
    { name: "Bollywood Shimmer", price: "₹1,849", image: "/products/bollywood.jpg", category: "Bollywood" },
    { name: "Bollywood Drama Tee", price: "₹1,949", image: "/products/flat-white.png", category: "Bollywood" },
    { name: "Bollywood Gold", price: "₹1,549", image: "/products/front-white.png", category: "Bollywood" },
  ],
  kollywood: [
    { name: "Kollywood Hero Tee", price: "₹1,699", image: "/products/bollywood.jpg", category: "Kollywood" },
    { name: "Kollywood Legend", price: "₹1,899", image: "/products/flat-white.png", category: "Kollywood" },
    { name: "Kollywood Power Tee", price: "₹2,099", image: "/products/front-white.png", category: "Kollywood" },
    { name: "Kollywood Crown", price: "₹1,599", image: "/products/hanger-white.png", category: "Kollywood" },
  ],
  tollywood: [
    { name: "Tollywood Charm Tee", price: "₹1,649", image: "/products/back-black.png", category: "Tollywood" },
    { name: "Tollywood Spotlight", price: "₹1,829", image: "/products/flat-white.png", category: "Tollywood" },
    { name: "Tollywood Mass Print", price: "₹1,949", image: "/products/hanger-white.png", category: "Tollywood" },
    { name: "Tollywood Cinematic", price: "₹1,579", image: "/products/front-white.png", category: "Tollywood" },
  ],
  mollywood: [
    { name: "Mollywood Motion Tee", price: "₹1,739", image: "/products/front-white.png", category: "Mollywood" },
    { name: "Mollywood Storyline", price: "₹1,899", image: "/products/back-black.png", category: "Mollywood" },
    { name: "Mollywood Sunset Print", price: "₹2,049", image: "/products/flat-white.png", category: "Mollywood" },
    { name: "Mollywood Classic", price: "₹1,629", image: "/products/hanger-white.png", category: "Mollywood" },
  ],
  sandalwood: [
    { name: "Sandalwood Star Tee", price: "₹1,749", image: "/products/hanger-white.png", category: "Sandalwood" },
    { name: "Sandalwood Reel", price: "₹1,869", image: "/products/flat-white.png", category: "Sandalwood" },
    { name: "Sandalwood Heritage", price: "₹1,979", image: "/products/front-white.png", category: "Sandalwood" },
    { name: "Sandalwood Gold", price: "₹1,599", image: "/products/back-black.png", category: "Sandalwood" },
  ],
  cricket: [
    { name: "Cricket Power Tee", price: "₹1,699", image: "/products/back-black.png", category: "Cricket" },
    { name: "Cricket Captain Print", price: "₹1,899", image: "/products/flat-white.png", category: "Cricket" },
    { name: "Cricket Match Tee", price: "₹1,979", image: "/products/front-white.png", category: "Cricket" },
    { name: "Cricket Pace Tee", price: "₹1,599", image: "/products/hanger-white.png", category: "Cricket" },
  ],
  football: [
    { name: "Football Flow Tee", price: "₹1,729", image: "/products/flat-white.png", category: "Football" },
    { name: "Football League Print", price: "₹1,949", image: "/products/back-black.png", category: "Football" },
    { name: "Football Hustle Tee", price: "₹2,099", image: "/products/hanger-white.png", category: "Football" },
    { name: "Football Matchday", price: "₹1,649", image: "/products/front-white.png", category: "Football" },
  ],
  gym: [
    { name: "Gym Lift Tee", price: "₹1,579", image: "/products/hanger-white.png", category: "Gym" },
    { name: "Gym Drive Tee", price: "₹1,799", image: "/products/front-white.png", category: "Gym" },
    { name: "Gym Motion Print", price: "₹1,989", image: "/products/back-black.png", category: "Gym" },
    { name: "Gym Strong Tee", price: "₹1,679", image: "/products/flat-white.png", category: "Gym" },
  ],
  car: [
    { name: "Car Drift Tee", price: "₹1,749", image: "/products/back-black.png", category: "Car" },
    { name: "Car Racing Print", price: "₹1,999", image: "/products/flat-white.png", category: "Car" },
    { name: "Car Speed Tee", price: "₹2,149", image: "/products/front-white.png", category: "Car" },
    { name: "Car Apex Tee", price: "₹1,799", image: "/products/hanger-white.png", category: "Car" },
  ],
  bike: [
    { name: "Bike Rush Tee", price: "₹1,699", image: "/products/hanger-white.png", category: "Bike" },
    { name: "Bike Sprint Print", price: "₹1,949", image: "/products/front-white.png", category: "Bike" },
    { name: "Bike Track Tee", price: "₹2,099", image: "/products/back-black.png", category: "Bike" },
    { name: "Bike Torque Tee", price: "₹1,649", image: "/products/flat-white.png", category: "Bike" },
  ],
  "pc-games": [
    { name: "PC Games Arena Tee", price: "₹1,699", image: "/products/back-black.png", category: "PC Games" },
    { name: "PC Games Pro Print", price: "₹1,899", image: "/products/front-white.png", category: "PC Games" },
    { name: "PC Games Hero Tee", price: "₹2,099", image: "/products/flat-white.png", category: "PC Games" },
    { name: "PC Games Charge Tee", price: "₹1,599", image: "/products/hanger-white.png", category: "PC Games" },
  ],
  "mobile-games": [
    { name: "Mobile Games Boost Tee", price: "₹1,579", image: "/products/flat-white.png", category: "Mobile Games" },
    { name: "Mobile Games Quest Print", price: "₹1,849", image: "/products/hanger-white.png", category: "Mobile Games" },
    { name: "Mobile Games Arcade Tee", price: "₹2,049", image: "/products/back-black.png", category: "Mobile Games" },
    { name: "Mobile Games Mode Tee", price: "₹1,699", image: "/products/front-white.png", category: "Mobile Games" },
  ],
};

const sizeOptions = ["XS", "S", "M", "L", "XL", "XXL"];
const colorOptions = [
  { name: "Ivory", value: "#f3efe7" },
  { name: "Graphite", value: "#1d1d1d" },
  { name: "Stone", value: "#d6c9b7" },
  { name: "Charcoal", value: "#575b5f" },
];

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState(colorOptions[0].name);
  const [selectedImage, setSelectedImage] = useState("");
  const [activeInfoTab, setActiveInfoTab] = useState<"details" | "fit" | "shipping">("details");
  const [headerCartCount, setHeaderCartCount] = useState(0);
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem("tribull-cart") || "{}");
    } catch {
      return {};
    }
  });
  const [isAdded, setIsAdded] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [sizeError, setSizeError] = useState("");
  const [pincode, setPincode] = useState("");
  const [pincodeFeedback, setPincodeFeedback] = useState<{ kind: "idle" | "error" | "success"; message: string }>({
    kind: "idle",
    message: "",
  });

  useEffect(() => {
    window.localStorage.setItem("tribull-cart", JSON.stringify(cart));
    setHeaderCartCount(Object.values(cart).reduce((total, quantityValue) => total + quantityValue, 0));
  }, [cart]);

  useEffect(() => {
    const syncHeaderCart = () => {
      try {
        const savedCart = JSON.parse(window.localStorage.getItem("tribull-cart") || "{}") as Record<string, number>;
        setHeaderCartCount(Object.values(savedCart).reduce((total, quantityValue) => total + quantityValue, 0));
      } catch {
        setHeaderCartCount(0);
      }
    };
    syncHeaderCart();
    window.addEventListener("tribull-cart-updated", syncHeaderCart);
    return () => window.removeEventListener("tribull-cart-updated", syncHeaderCart);
  }, []);

  const separatorIndex = id?.lastIndexOf("-") ?? -1;
  const category = separatorIndex > 0 ? id?.slice(0, separatorIndex) || "" : "";
  const index = Number.parseInt(separatorIndex > 0 ? id?.slice(separatorIndex + 1) || "0" : "0", 10);
  const categoryProducts = allCategoryProducts[category] || [];
  const query = new URLSearchParams(window.location.search);
  const linkedProduct = query.get("name") && query.get("image") ? {
    name: query.get("name") || "Selected product",
    price: query.get("price") || "₹0",
    originalPrice: query.get("originalPrice") ? Number(query.get("originalPrice")) : undefined,
    image: query.get("image") || "",
    category: category || "Tribull",
  } : undefined;
  const product = linkedProduct ?? categoryProducts[index];

  useEffect(() => {
    if (product?.image) {
      setSelectedImage(product.image);
      setSelectedColor((current) => current || colorOptions[0].name);
    }
  }, [product?.image]);

  if (!product) return <div className="p-8">Product not found.</div>;

  const galleryImages = useMemo(() => Array.from(new Set([
    product.image,
    ...categoryProducts.map((item) => item.image),
    "/products/front-white.png",
    "/products/flat-white.png",
    "/products/hanger-white.png",
  ])).slice(0, 5), [categoryProducts, product.image]);

  const selectedImageIndex = Math.max(0, galleryImages.indexOf(selectedImage || product.image));
  const priceValue = Number(product.price.replace(/[^0-9]/g, ""));
  const originalPriceValue = resolveOriginalPrice(product);
  const originalPriceNumber = typeof originalPriceValue === "number" ? originalPriceValue : undefined;
  const recommendationPool = [
    ...categoryProducts.filter((_, productIndex) => productIndex !== index),
    ...Object.entries(allCategoryProducts)
      .filter(([productCategory]) => productCategory !== category)
      .flatMap(([, items]) => items),
  ].slice(0, 4);

  const productDescription = `${product.name} is a premium ${product.category.toLowerCase()} staple designed for elevated daily wear. Built with a soft cotton blend, durable print finish, and an easy, relaxed silhouette for all-day comfort.`;

  const benefitItems = [
    { title: "Fabric Quality", detail: "Premium cotton feel with breathable comfort" },
    { title: "Fit & Comfort", detail: "Relaxed silhouette built for everyday movement" },
    { title: "Print & Finish", detail: "Detailed artwork with a clean, lasting finish" },
  ];

  const accordionMap = {
    details: {
      title: "Product Details",
      content: "Crafted for everyday streetwear rotation, this tee balances soft-touch comfort with understated structure. The fabric is breathable, durable, and printed to stay fresh through repeat wear.",
    },
    fit: {
      title: "Fit & Care",
      content: "Standard fit with a roomier silhouette. Machine wash cold with like colors, inside out. Avoid direct ironing on the print and do not use bleach.",
    },
    shipping: {
      title: "Shipping & Returns",
      content: "Dispatch within 24–48 hours. Easy exchanges within eligible return windows for unworn items. Delivery estimates vary by PIN code and courier availability.",
    },
  } as const;

  const addCurrentProductToCart = (source?: HTMLElement) => {
    if (!selectedSize) {
      setSizeError("Please select a size before adding to cart.");
      return;
    }

    const productId = `${category}-${index}`;
    try {
      const cartItems = JSON.parse(window.localStorage.getItem("tribull-cart-items") || "{}");
      window.localStorage.setItem("tribull-cart-items", JSON.stringify({
        ...cartItems,
        [productId]: {
          name: product.name,
          price: priceValue,
          originalPrice: originalPriceNumber,
          image: selectedImage || product.image,
          variant: `Size: ${selectedSize} / ${selectedColor}`,
        },
      }));
    } catch {
      // Keep the cart usable if metadata storage is unavailable.
    }

    setCart((current) => ({ ...current, [productId]: (current[productId] || 0) + quantity }));
    window.dispatchEvent(new Event("tribull-cart-updated"));
    setSizeError("");
    if (source) animateAddToCart(source, selectedImage || product.image);
    setIsAdded(true);
    window.setTimeout(() => setIsAdded(false), 1200);
  };

  const handlePincodeSubmit = () => {
    const numericPin = pincode.replace(/\D/g, "");

    if (!/^\d{6}$/.test(numericPin)) {
      setPincodeFeedback({
        kind: "error",
        message: "Please enter a valid 6-digit PIN code.",
      });
      return;
    }

    setPincodeFeedback({
      kind: "success",
      message: `Estimated delivery for ${numericPin}: 2–5 business days in this service area.`,
    });
  };

  const navigateGallery = (direction: "next" | "prev") => {
    const currentIndex = selectedImageIndex;
    const nextIndex = direction === "next" ? (currentIndex + 1) % galleryImages.length : (currentIndex - 1 + galleryImages.length) % galleryImages.length;
    setSelectedImage(galleryImages[nextIndex]);
  };

  return (
    <div className="product-detail-page">
      <div className="product-detail-page__announcement" aria-label="Announcement">
        <div className="product-detail-page__announcement-track">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index}>
              100% cotton <b>shop now</b> <i>✦</i>
            </span>
          ))}
        </div>
      </div>

      <header className="site-header" aria-label="Main nav">
        <MobileCategoryMenu />
        <a className="wordmark" href="/" aria-label="Tribull home">
          <img src="/products/logo.png" alt="TRIBULL" />
        </a>
        <HeaderActions />
      </header>

      <main className="product-detail-page__main">
        <div className="product-detail-page__shell">
          <aside className="product-detail-editorial" aria-label="Brand story">
            <span className="product-detail-editorial__eyebrow">Tribull Studio</span>
            <div className="product-detail-editorial__line" aria-hidden="true" />
            <p>Built for movement, culture, and everyday statement dressing.</p>
          </aside>

          <section className="product-detail-gallery" aria-label="Product gallery">
            <div className="product-detail-gallery__status">
              <span className="product-detail-gallery__label">New Arrival</span>
              <span className="product-detail-gallery__count">{String(selectedImageIndex + 1).padStart(2, "0")} / {String(galleryImages.length).padStart(2, "0")}</span>
            </div>

            <div className="product-detail-gallery__viewport">
              <img src={selectedImage || product.image} alt={product.name} />
            </div>

            <div className="product-detail-gallery__nav">
              <button type="button" onClick={() => navigateGallery("prev")} aria-label="Previous image">
                <ChevronLeft size={18} />
              </button>
              <button type="button" onClick={() => navigateGallery("next")} aria-label="Next image">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="product-detail-gallery__thumbs" aria-label="Product images">
              {galleryImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  className={selectedImage === image ? "is-active" : ""}
                  onClick={() => setSelectedImage(image)}
                  aria-label={`View image ${index + 1}`}
                >
                  <img src={image} alt={`Product view ${index + 1}`} />
                </button>
              ))}
            </div>
          </section>

          <section className="product-detail-panel" aria-label="Product information">
            <div className="product-detail-panel__eyebrow">{product.category}</div>
            <h1 className="product-detail-panel__heading">{product.name}</h1>

            <div className="product-detail-panel__rating">
              <div className="product-detail-panel__stars" aria-label="Rated 4.8 out of 5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={16} fill="currentColor" />
                ))}
              </div>
              <span>4.8</span>
              <small>41 reviews</small>
            </div>

            <ProductPrice
              sellingPrice={product.price}
              originalPrice={resolveOriginalPrice(product)}
              productName={product.name}
              className="product-price--detail"
            />

            <p className="product-detail-panel__description">{productDescription}</p>

            <div className="product-detail-option">
              <div className="product-detail-option__header">
                <span>Colour</span>
                <b>{selectedColor}</b>
              </div>
              <div className="product-detail-swatches" aria-label="Colour selector">
                {colorOptions.map((option) => (
                  <button
                    key={option.name}
                    className={selectedColor === option.name ? "is-selected" : ""}
                    type="button"
                    onClick={() => setSelectedColor(option.name)}
                    aria-label={`Select ${option.name}`}
                    title={option.name}
                    style={{ background: option.value }}
                  >
                    <span aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>

            <div className="product-detail-option">
              <div className="product-detail-option__header">
                <span>Size</span>
                {selectedSize ? <b>{selectedSize}</b> : <button type="button" className="product-detail-option__guide" onClick={() => setIsSizeGuideOpen(true)}>Size guide</button>}
              </div>

              <div className="product-detail-sizes">
                {sizeOptions.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={selectedSize === size ? "is-selected" : ""}
                    onClick={() => {
                      setSelectedSize(size);
                      setSizeError("");
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
              {sizeError ? <p className="product-detail-option__error">{sizeError}</p> : null}
            </div>

            <div className="product-detail-cta-row">
              <div className="product-detail-qty" aria-label="Quantity selector">
                <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Decrease quantity">
                  <Minus size={16} />
                </button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity((current) => current + 1)} aria-label="Increase quantity">
                  <Plus size={16} />
                </button>
              </div>

              <button
                type="button"
                className="product-detail-add-to-cart"
                onClick={(event) => addCurrentProductToCart(event.currentTarget)}
              >
                {isAdded ? <Check size={18} /> : <ShoppingBag size={18} />}
                {isAdded ? "Added to cart" : "Add to cart"}
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="product-detail-pincode">
              <label htmlFor="product-pin">Delivery check</label>
              <div className="product-detail-pincode__field">
                <input
                  id="product-pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  placeholder="Enter 6-digit PIN"
                  onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <button type="button" onClick={handlePincodeSubmit}>Check</button>
              </div>
              {pincodeFeedback.kind !== "idle" ? (
                <p className={pincodeFeedback.kind === "success" ? "is-success" : "is-error"}>{pincodeFeedback.message}</p>
              ) : (
                <p className="product-detail-pincode__hint">Service checks are configured for supported delivery zones.</p>
              )}
            </div>

            <div className="product-detail-features" aria-label="Performance details">
              {[
                { icon: ShieldCheck, label: "Premium quality" },
                { icon: Truck, label: "Free shipping" },
                { icon: PackageCheck, label: "Express dispatch" },
                { icon: Sparkles, label: "Limited edit" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="product-detail-feature">
                  <Icon size={18} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="product-detail-benefits" aria-label="Product benefits">
          {benefitItems.map((benefit) => (
            <div key={benefit.title} className="product-detail-benefit">
              <span>{benefit.title}</span>
              <small>{benefit.detail}</small>
            </div>
          ))}
        </section>

        <section className="product-detail-info" aria-label="Product details and policies">
          <div className="product-detail-info__tabs" role="tablist" aria-label="Product info tabs">
            {Object.entries(accordionMap).map(([key, item]) => {
              const isActive = activeInfoTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={isActive ? "is-active" : ""}
                  onClick={() => setActiveInfoTab(key as typeof activeInfoTab)}
                >
                  {item.title}
                </button>
              );
            })}
          </div>

          <div className="product-detail-info__panel">
            {Object.entries(accordionMap).map(([key, item]) => (
              <div key={key} className={activeInfoTab === key ? "is-visible" : ""}>
                {activeInfoTab === key ? <p>{item.content}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="product-detail-recommendations" aria-labelledby="you-may-also-like">
          <div className="product-detail-recommendations__header">
            <p>Recommended picks</p>
            <h2 id="you-may-also-like">You may also like</h2>
          </div>

          <div className="product-detail-recommendations__grid">
            {recommendationPool.map((recommendation, recommendationIndex) => (
              <Link
                key={`${recommendation.name}-${recommendationIndex}`}
                href={`/product/${category}-${recommendationIndex}?name=${encodeURIComponent(recommendation.name)}&price=${encodeURIComponent(recommendation.price)}&originalPrice=${encodeURIComponent(resolveOriginalPrice(recommendation) ?? "")}&image=${encodeURIComponent(recommendation.image)}`}
                className="product-detail-recommendation-card"
              >
                <img src={recommendation.image} alt={recommendation.name} loading="lazy" />
                <div>
                  <h3>{recommendation.name}</h3>
                  <ProductPrice
                    sellingPrice={recommendation.price}
                    originalPrice={resolveOriginalPrice(recommendation)}
                    productName={recommendation.name}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {isSizeGuideOpen ? (
        <div className="product-detail-guides" aria-modal="true" role="dialog" aria-label="Size guide">
          <div className="product-detail-guides__panel">
            <div className="product-detail-guides__header">
              <h3>Size guide</h3>
              <button type="button" onClick={() => setIsSizeGuideOpen(false)} aria-label="Close size guide">
                <ChevronUp size={18} />
              </button>
            </div>
            <div className="product-detail-guides__grid">
              {[
                ["XS", "Chest 34\" / Length 26\""],
                ["S", "Chest 36\" / Length 27\""],
                ["M", "Chest 38\" / Length 28\""],
                ["L", "Chest 40\" / Length 29\""],
                ["XL", "Chest 42\" / Length 30\""],
                ["XXL", "Chest 44\" / Length 31\""],
              ].map(([size, measurements]) => (
                <div key={size} className="product-detail-guides__row">
                  <span>{size}</span>
                  <small>{measurements}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
