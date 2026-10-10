const showcaseProductImages = [
  "/products/Black T-Shirt Front and Back Mockup.png",
  "/products/Blank White T-Shirt Front and Back Views.png",
  "/products/Black Hoodie Front and Back Mockup.png",
  "/products/Plain White Hoodies, Front and Back.png",
];

export function getShowcaseProductImage(index: number) {
  return showcaseProductImages[index % showcaseProductImages.length];
}
