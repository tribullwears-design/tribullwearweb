import { ArrowLeft, ArrowUpRight, Check, Star, ShoppingCart } from "lucide-react";
import { Link, useParams } from "wouter";
import { useEffect, useState } from "react";
import ProductsPage from "./ProductsPage";

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
  const [selectedColor, setSelectedColor] = useState("Black");
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
  }, [cart]);

  const [category, indexStr] = id?.split("-") || [];
  const index = Number.parseInt(indexStr || "0", 10);
  const products = allCategoryProducts[category] || [];
  const product = products[index];

  if (!product) return <ProductsPage />;

  const colors = ["Black", "Red", "Green", "Navy"];
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
  const parentCategoryMap: Record<string, string> = {
    hollywood: "cinema",
    bollywood: "cinema",
    kollywood: "cinema",
    tollywood: "cinema",
    mollywood: "cinema",
    sandalwood: "cinema",
    cricket: "sports",
    football: "sports",
    gym: "sports",
    car: "motorsports",
    bike: "motorsports",
    "pc-games": "games",
    "mobile-games": "games",
  };
  const backHref = category ? `/category/${parentCategoryMap[category] ?? category}` : "/";
  const addCurrentProductToCart = () => {
    const productId = `${category}-${index}`;
    setCart((current) => ({ ...current, [productId]: (current[productId] || 0) + quantity }));
    setIsAdded(true);
    window.setTimeout(() => setIsAdded(false), 1200);
  };

  return (
    <div className="product-detail-page">
      <ProductsPage />
      <div className="border-b border-gray-200 py-4 px-6">
        <Link href={backHref} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={20} />
          Back to {product.category}
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="flex flex-col gap-6">
            <div className="aspect-square rounded-12 overflow-hidden bg-gray-100 border border-gray-200">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex gap-3 overflow-auto pb-2">
              {[0, 1, 2, 3].map((i) => (
                <button
                  key={i}
                  className="flex-shrink-0 w-20 h-20 rounded-lg bg-gray-100 border-2 border-transparent hover:border-gray-400 overflow-hidden"
                >
                  <img
                    src={product.image}
                    alt={`View ${i + 1}`}
                    className="w-full h-full object-cover"
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
              <label className="block text-sm font-semibold mb-3">COLOR: {selectedColor.toUpperCase()}</label>
              <div className="flex gap-3">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-10 h-10 rounded-full border-2 transition ${
                      selectedColor === color
                        ? "border-gray-900 shadow-md"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    style={{
                      backgroundColor:
                        color === "Black" ? "#000000" :
                        color === "Red" ? "#c41e3a" :
                        color === "Green" ? "#1B362D" :
                        color === "Navy" ? "#001f3f" : "#ffffff",
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-3">SIZE: {selectedSize}</label>
              <div className="flex gap-2 flex-wrap">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-4 py-2 rounded border-2 font-medium transition ${
                      selectedSize === size
                        ? "bg-gray-900 text-white border-gray-900"
                        : "border-gray-300 text-gray-900 hover:border-gray-400"
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
                  className="text-gray-600 hover:text-gray-900 font-bold"
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
                  className="text-gray-600 hover:text-gray-900 font-bold"
                >
                  +
                </button>
              </div>

              <button onClick={addCurrentProductToCart} className={`flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded flex items-center justify-center gap-2 transition ${isAdded ? "bg-green-700" : ""}`}>
                {isAdded ? <Check size={20} /> : <ShoppingCart size={20} />}
                {isAdded ? "ADDED TO CART" : "ADD TO CART"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-200">
              <div className="text-center">
                <div className="text-2xl mb-2">⭐</div>
                <div className="text-xs font-semibold">Premium Quality</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">🚚</div>
                <div className="text-xs font-semibold">Free Shipping</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">✓</div>
                <div className="text-xs font-semibold">2-Day Delivery</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">💬</div>
                <div className="text-xs font-semibold">24/7 Support</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
