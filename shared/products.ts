export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  image: string;
  created: number;
  sold: number;
};

export const defaultProducts: Product[] = [
  { id: "mass", name: "Thalapathy Vijay - Mass", category: "round-neck", price: 599, image: "/products/front-white.png", created: 4, sold: 94 },
  { id: "thala", name: "Ajith Kumar - Thala", category: "round-neck", price: 599, image: "/products/back-black.png", created: 3, sold: 88 },
  { id: "naan", name: "Vikram - Naan Maatram Illai", category: "round-neck", price: 599, image: "/products/flat-white.png", created: 2, sold: 81 },
  { id: "vazha", name: "Vazha Oru Dharamam", category: "round-neck", price: 599, image: "/products/hanger-white.png", created: 1, sold: 75 },
  { id: "daily-oversized", name: "Daily Uniform Oversized Tee", category: "oversized", price: 799, image: "/products/back-black.png", created: 8, sold: 72 },
  { id: "street-oversized", name: "Street Frame Oversized Tee", category: "oversized", price: 849, image: "/products/front-white.png", created: 7, sold: 65 },
  { id: "heavy-oversized", name: "Heavyweight Essential Tee", category: "oversized", price: 899, image: "/products/flat-white.png", created: 6, sold: 59 },
  { id: "graphic-oversized", name: "Graphic Motion Oversized Tee", category: "oversized", price: 949, image: "/products/tshirt.jpg", created: 5, sold: 52 },
  { id: "acid-shadow", name: "Acid Shadow Washed Tee", category: "acid-oversized", price: 999, image: "/products/tomandjerry.jpg", created: 12, sold: 48 },
  { id: "acid-signal", name: "Acid Signal Oversized Tee", category: "acid-oversized", price: 1049, image: "/products/batman.jpg", created: 11, sold: 44 },
  { id: "acid-drift", name: "Acid Drift Washed Tee", category: "acid-oversized", price: 1099, image: "/products/front-white.png", created: 10, sold: 39 },
  { id: "acid-core", name: "Acid Core Graphic Tee", category: "acid-oversized", price: 1149, image: "/products/flat-white.png", created: 9, sold: 35 },
  { id: "classic-hoodie", name: "Classic Tribull Hoodie", category: "hoodie", price: 1299, image: "/products/hanger-white.png", created: 16, sold: 83 },
  { id: "forest-hoodie", name: "Forest Logo Hoodie", category: "hoodie", price: 1399, image: "/products/back-black.png", created: 15, sold: 74 },
  { id: "graphic-hoodie", name: "Graphic Night Hoodie", category: "hoodie", price: 1499, image: "/products/flat-white.png", created: 14, sold: 61 },
  { id: "studio-hoodie", name: "Studio Heavy Hoodie", category: "hoodie", price: 1599, image: "/products/front-white.png", created: 13, sold: 56 },
];
