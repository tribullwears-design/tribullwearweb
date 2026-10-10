const showcaseProductImages = [
  "/products/Black T-Shirt Front and Back Mockup.png",
  "/products/Blank White T-Shirt Front and Back Views.png",
  "/products/Black Hoodie Front and Back Mockup.png",
  "/products/Plain White Hoodies, Front and Back.png",
];

const showcaseHoverImages: Record<string, string> = {
  [showcaseProductImages[0]]: "/products/B1.jpg.jpeg",
  [showcaseProductImages[1]]: "/products/W1.jpg.jpeg",
};

export function getShowcaseProductImage(index: number) {
  return showcaseProductImages[index % showcaseProductImages.length];
}

export function getShowcaseProductHoverImage(image: string) {
  return showcaseHoverImages[image];
}
