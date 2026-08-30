import { Check, Headphones, Heart, Menu, Package, Search, ShieldCheck, ShoppingBag, ShoppingCart, Star, Truck, User } from "lucide-react";
import { Link, useParams } from "wouter";
import { useEffect, useState } from "react";

interface ProductData {
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

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState("M");
  const [selectedImage, setSelectedImage] = useState("");
  const [activeInfoTab, setActiveInfoTab] = useState<"description" | "additional">("description");
  const [headerCartCount, setHeaderCartCount] = useState(0);
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem("tribull-cart") || "{}");
    } catch {
      return {};
    }
  });
  const [isAdded, setIsAdded] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("tribull-cart", JSON.stringify(cart));
    setHeaderCartCount(Object.values(cart).reduce((total, quantity) => total + quantity, 0));
  }, [cart]);

  useEffect(() => {
    const syncHeaderCart = () => {
      try {
        const savedCart = JSON.parse(window.localStorage.getItem("tribull-cart") || "{}") as Record<string, number>;
        setHeaderCartCount(Object.values(savedCart).reduce((total, quantity) => total + quantity, 0));
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
    image: query.get("image") || "",
    category: category || "Tribull",
  } : undefined;
  const product = linkedProduct ?? categoryProducts[index];

  useEffect(() => {
    if (product?.image) setSelectedImage(product.image);
  }, [product?.image]);

  if (!product) return <div className="p-8">Product not found.</div>;

  const galleryImages = Array.from(new Set([
    product.image,
    ...categoryProducts.map((item) => item.image),
    "/products/front-white.png",
    "/products/flat-white.png",
    "/products/hanger-white.png",
  ])).slice(0, 4);

  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
  const addCurrentProductToCart = () => {
    const productId = `${category}-${index}`;
    setCart((current) => ({ ...current, [productId]: (current[productId] || 0) + quantity }));
    window.dispatchEvent(new Event("tribull-cart-updated"));
    setIsAdded(true);
    window.setTimeout(() => setIsAdded(false), 1200);
  };

  const recommendations = [
    ...categoryProducts.filter((_, productIndex) => productIndex !== index),
    ...Object.entries(allCategoryProducts)
      .filter(([productCategory]) => productCategory !== category)
      .flatMap(([, items]) => items),
  ].slice(0, 4);
  const productDescription = `${product.name} is a premium ${product.category.toLowerCase()} style made for everyday comfort and statement dressing. It features a soft, breathable cotton feel, a durable printed graphic, and an easy fit designed for repeat wear.`;

  return (
    <div className="product-detail-page">
      <div className="ticker" aria-label="Announcement"><div className="ticker__track">{Array.from({ length: 7 }).map((_, i) => <span key={i}>100% Cotton.<b>Shop Now</b><i>✦</i></span>)}</div></div>
      <header className="site-header">
        <button className="icon-button mobile-menu" aria-label="Open menu"><Menu size={20} strokeWidth={1.5} /></button>
        <a className="wordmark" href="/" aria-label="Tribull home"><img src="/products/logo.png" alt="TRIBULL" /></a>
        <div className="header-actions">
          <button className="icon-button" aria-label="Search"><Search size={19} strokeWidth={1.5} /></button>
          <button className="icon-button" aria-label="Account"><User size={19} strokeWidth={1.5} /></button>
          <button className="icon-button" aria-label="Wishlist"><Heart size={19} strokeWidth={1.5} /></button>
          <button className="icon-button header-cart-button" type="button" aria-label={`${headerCartCount} items in cart`}>
            <ShoppingBag size={19} strokeWidth={1.5} />
            {headerCartCount > 0 && <span>{headerCartCount}</span>}
          </button>
        </div>
      </header>
      <div className="product-detail-main max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="flex flex-row items-start gap-4">
            <div className="flex-1 min-w-0 aspect-square rounded-12 overflow-hidden bg-gray-100 border border-gray-200">
              <img
                src={selectedImage || product.image}
                alt={product.name}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="order-first flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1">
              {galleryImages.map((image, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedImage(image)}
                  className={`flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 border-2 ${selectedImage === image ? "border-[var(--tribull-green)]" : "border-transparent"} hover:border-gray-400 overflow-hidden`}
                >
                  <img
                    src={image}
                    alt={`View ${i + 1}`}
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-8">
            <div>
              <h1 className="text-4xl font-bold mb-4">{product.name}</h1>

              <div className="flex items-center gap-2 mb-6">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      size={18}
                      className="fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600">41 reviews</span>
              </div>

              <div className="flex items-center gap-4 mb-8">
                <span className="text-2xl font-bold text-red-600">{product.price}</span>
                <span className="text-lg text-gray-400 line-through">₹2,499</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-3">SIZE: {selectedSize}</label>
              <div className="flex gap-2 flex-wrap">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`product-detail-size-button flex h-10 w-10 items-center justify-center rounded-full border font-medium transition ${
                      selectedSize === size
                        ? "border-[#333333] bg-[#333333] text-white active:text-white focus:text-white"
                        : "border-[#6b7280] bg-[#6b7280] text-white hover:border-[#333333] hover:bg-[#333333]"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-4 border border-gray-300 rounded px-3 py-2">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="rounded bg-transparent px-2 text-[var(--tribull-green)] font-bold hover:bg-transparent"
                >
                  −
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                  className="w-12 text-center border-0 outline-none"
                  min="1"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="rounded bg-transparent px-2 text-[var(--tribull-green)] font-bold hover:bg-transparent"
                >
                  +
                </button>
              </div>

              <button onClick={addCurrentProductToCart} className={`product-detail-add-to-cart flex-1 bg-[#333333] hover:bg-[#222222] text-white active:text-white focus:text-white font-bold py-3 px-6 rounded flex items-center justify-center gap-2 transition ${isAdded ? "bg-[#444444] text-white" : ""}`}>
                {isAdded ? <Check size={20} /> : <ShoppingCart size={20} />}
                {isAdded ? "ADDED TO CART" : "ADD TO CART"}
              </button>
            </div>

            <div className="product-detail-delivery">
              <div className="product-detail-delivery__title"><Package size={20} /> <span>Estimated Delivery Date</span></div>
              <div className="product-detail-delivery__form">
                <input type="text" inputMode="numeric" maxLength={6} placeholder="Enter Pincode" aria-label="Enter pincode" />
                <button type="button">Check</button>
              </div>
              <div className="product-detail-delivery__powered">Powered by <strong>Tribull Delivery</strong></div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-200">
              <div className="text-center">
                <ShieldCheck className="mx-auto mb-2" size={24} />
                <div className="text-xs font-semibold">Premium Quality</div>
              </div>
              <div className="text-center">
                <Truck className="mx-auto mb-2" size={24} />
                <div className="text-xs font-semibold">Free Shipping</div>
              </div>
              <div className="text-center">
                <ShieldCheck className="mx-auto mb-2" size={24} />
                <div className="text-xs font-semibold">2-Day Delivery</div>
              </div>
              <div className="text-center">
                <Headphones className="mx-auto mb-2" size={24} />
                <div className="text-xs font-semibold">24/7 Support</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="product-detail-description" aria-labelledby="product-description">
        <div className="product-detail-description__tabs">
          <button type="button" className={activeInfoTab === "description" ? "is-active" : ""} onClick={() => setActiveInfoTab("description")}>Description</button>
          <button type="button" className={activeInfoTab === "additional" ? "is-active" : ""} onClick={() => setActiveInfoTab("additional")}>Additional Information</button>
        </div>
        {activeInfoTab === "description" ? (
          <div className="product-detail-description__body">
            <p>{productDescription}</p>
            <p><strong>Note:</strong> Printed T-shirts and hoodies are not embroidered.</p>
            <p><strong>Wash Note:</strong> Machine wash in cold water with mild detergent. Dry in the shade, do not iron directly on the print, do not bleach, and do not tumble dry.</p>
            <p><strong>Standard Sizing:</strong> We follow standard sizing across our collections.</p>
            <p><strong>Estimated Order Processing Time:</strong> 24 to 48 hours</p>
            <p><strong>Estimated Delivery Time:</strong> Depends on the delivery location.</p>
          </div>
        ) : (
          <div className="product-detail-information-table">
            <div><strong>Size</strong><span>S, M, L, XL, 2XL</span></div>
          </div>
        )}
      </section>

      <section className="product-detail-recommendations" aria-labelledby="you-may-also-like">
        <div className="product-detail-recommendations__heading">
          <h2 id="you-may-also-like">You May Also Like</h2>
        </div>
        <div className="product-detail-recommendations__grid">
          {recommendations.map((recommendation, recommendationIndex) => (
            <Link
              key={`${recommendation.name}-${recommendationIndex}`}
              href={`/product/${category}-${recommendationIndex}?name=${encodeURIComponent(recommendation.name)}&price=${encodeURIComponent(recommendation.price)}&image=${encodeURIComponent(recommendation.image)}`}
              className="product-detail-recommendation-card"
            >
              <img src={recommendation.image} alt={recommendation.name} loading="lazy" />
              <h3>{recommendation.name}</h3>
              <p>{recommendation.price}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="product-detail-reviews" aria-labelledby="customer-reviews">
        <h2 id="customer-reviews">Customer Reviews</h2>
        <div className="product-detail-reviews__content">
          <div className="product-detail-reviews__summary">
            <div className="product-detail-reviews__rating">
              <div className="product-detail-reviews__stars">
                {[1, 2, 3, 4].map((star) => <Star key={star} size={22} fill="currentColor" />)}
                <Star size={22} fill="currentColor" />
              </div>
              <span>4.33 out of 5</span>
            </div>
            <p>Based on 3 reviews</p>
          </div>
          <div className="product-detail-reviews__breakdown" aria-label="Rating breakdown">
            {[5, 4, 3, 2, 1].map((rating, index) => (
              <div className="product-detail-reviews__breakdown-row" key={rating}>
                <div className="product-detail-reviews__small-stars">
                  {Array.from({ length: 5 }, (_, starIndex) => <Star key={starIndex} size={18} fill={starIndex < rating ? "currentColor" : "none"} />)}
                </div>
                <span className={`product-detail-reviews__bar product-detail-reviews__bar--${index}`} />
                <span>{index === 0 ? 1 : index === 1 ? 2 : 0}</span>
              </div>
            ))}
          </div>
          <div className="product-detail-reviews__action">
            <button type="button" className="product-detail-reviews__button">Write a review</button>
          </div>
        </div>
      </section>

      <footer className="product-detail-footer">
        <div className="product-detail-footer__grid">
          <div className="product-detail-footer__brand">
            <img src="/products/logo.png" alt="TRIBULL" />
            <p>100% cotton, always.</p>
            <p>Made for everyday movement.</p>
            <h3 className="product-detail-footer__follow-title">Follow Us:</h3>
            <div className="product-detail-footer__socials" aria-label="Social media links">
              <a href="#customer-reviews" aria-label="Facebook">f</a>
              <a href="#customer-reviews" aria-label="X">𝕏</a>
              <a href="#customer-reviews" aria-label="Instagram">◎</a>
              <a href="#customer-reviews" aria-label="LinkedIn">in</a>
              <a href="#customer-reviews" aria-label="Pinterest">p</a>
              <a href="#customer-reviews" aria-label="YouTube">▶</a>
            </div>
          </div>
          <div>
            <h3>Need Help</h3>
            <a href="#customer-reviews">Contact Us</a>
            <a href="#customer-reviews">Track Order</a>
            <a href="#customer-reviews">Returns &amp; Refunds</a>
            <a href="#customer-reviews">FAQs</a>
          </div>
          <div>
            <h3>Company</h3>
            <a href="/">About Us</a>
            <a href="/">Careers</a>
            <a href="/">Community</a>
            <a href="/">Contact</a>
          </div>
          <div>
            <h3>Shopping</h3>
            <a href="/">T-shirts</a>
            <a href="/">Hoodies</a>
            <a href="/">Corporate / Bulk</a>
            <a href="/">Shipping</a>
          </div>
          <div className="product-detail-footer__shipping">
            <h3>We're Shipping Globally</h3>
            <div className="product-detail-footer__shipping-badge"><span>🇮🇳</span><strong>Homegrown<br />INDIAN BRAND</strong><span>🚚</span><strong>Free Shipping &amp;<br />Fast Processing</strong></div>
            <div className="product-detail-footer__payments" aria-label="Payment methods">
              <span>UPI</span><span>VISA</span><span>●●</span><span>a</span><span>RuPay</span><span>paytm</span><span>f</span>
            </div>
          </div>
        </div>
        <div className="product-detail-footer__bottom">
          <span>© Tribull 2026. All rights reserved.</span>
          <span>Privacy &nbsp; Terms &nbsp; Shipping</span>
        </div>
      </footer>
    </div>
  );
}
