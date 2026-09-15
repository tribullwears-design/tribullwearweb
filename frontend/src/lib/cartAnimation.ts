const CART_TARGET_SELECTOR = ".header-cart-button, .category-catalog-cart-button, .products-page__top-actions .products-page__top-icon:nth-child(2)";

export function animateAddToCart(source: HTMLElement, image: string) {
  if (typeof window === "undefined" || !image) return;

  const target = document.querySelector<HTMLElement>(CART_TARGET_SELECTOR);
  if (!target) return;

  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const size = Math.max(42, Math.min(72, sourceRect.width * 1.8));
  const startX = sourceRect.left + sourceRect.width / 2 - size / 2;
  const startY = sourceRect.top + sourceRect.height / 2 - size / 2;
  const targetX = targetRect.left + targetRect.width / 2 - size / 2;
  const targetY = targetRect.top + targetRect.height / 2 - size / 2;

  const flyingImage = document.createElement("img");
  flyingImage.src = image;
  flyingImage.alt = "";
  flyingImage.className = "cart-flying-image";
  flyingImage.style.width = `${size}px`;
  flyingImage.style.height = `${size}px`;
  flyingImage.style.left = `${startX}px`;
  flyingImage.style.top = `${startY}px`;
  flyingImage.style.setProperty("--cart-dx", `${targetX - startX}px`);
  flyingImage.style.setProperty("--cart-dy", `${targetY - startY}px`);
  let bounceTimer = 0;

  const finishAnimation = () => {
    window.clearTimeout(bounceTimer);
    flyingImage.remove();
    target.classList.remove("cart-icon-bounce");
  };

  flyingImage.addEventListener("animationend", finishAnimation, { once: true });
  document.body.appendChild(flyingImage);
  bounceTimer = window.setTimeout(() => target.classList.add("cart-icon-bounce"), 680);
}
