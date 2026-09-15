const WISHLIST_TARGET_SELECTOR = ".header-actions .icon-button[aria-label=\"Wishlist\"], .products-page__top-actions .products-page__top-icon[aria-label=\"Wishlist\"]";

export function animateAddToWishlist(source: HTMLElement) {
  if (typeof window === "undefined") return;

  const target = document.querySelector<HTMLElement>(WISHLIST_TARGET_SELECTOR);
  if (!target) return;

  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const startX = sourceRect.left + sourceRect.width / 2;
  const startY = sourceRect.top + sourceRect.height / 2;
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;
  const effect = document.createElement("span");
  effect.className = "wishlist-heart-effect";
  effect.style.left = `${startX - 18}px`;
  effect.style.top = `${startY - 18}px`;
  effect.style.setProperty("--wishlist-dx", `${targetX - startX}px`);
  effect.style.setProperty("--wishlist-dy", `${targetY - startY}px`);
  effect.innerHTML = '<span class="wishlist-heart-effect__main">&#10084;</span><i class="wishlist-heart-effect__spark wishlist-heart-effect__spark--one">&#10084;</i><i class="wishlist-heart-effect__spark wishlist-heart-effect__spark--two">&#9829;</i><i class="wishlist-heart-effect__spark wishlist-heart-effect__spark--three">&#10084;</i>';

  let pulseTimer = 0;
  const finishAnimation = () => {
    window.clearTimeout(pulseTimer);
    effect.remove();
    target.classList.remove("wishlist-icon-bounce");
  };

  effect.addEventListener("animationend", finishAnimation, { once: true });
  document.body.appendChild(effect);
  pulseTimer = window.setTimeout(() => target.classList.add("wishlist-icon-bounce"), 700);
}
