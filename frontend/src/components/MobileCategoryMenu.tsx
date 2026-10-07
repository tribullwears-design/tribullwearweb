import { Menu, X } from "lucide-react";
import { useState } from "react";

export default function MobileCategoryMenu() {
  const [open, setOpen] = useState(false);

  const toggleMenu = () => {
    setOpen((current) => !current);
  };

  const closeMenu = () => {
    setOpen(false);
  };

  return (
    <div className="mobile-category-menu">
      <button
        className="icon-button mobile-menu"
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-category-navigation"
        onClick={toggleMenu}
      >
        {open ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
      </button>

      <button className="mobile-category-menu__overlay" type="button" aria-label="Close menu" onClick={closeMenu} />
      <div
        id="mobile-category-navigation"
        className={`mobile-category-menu__panel ${open ? "mobile-category-menu__panel--open" : ""}`}
        aria-hidden={!open}
      >
        <div className="mobile-category-menu__header">
          <span>Menu</span>
          <button className="mobile-category-menu__close" type="button" aria-label="Close menu" onClick={closeMenu}>
            <X size={21} strokeWidth={1.5} />
          </button>
        </div>
        <div className="mobile-category-menu__content">
          <div className="mobile-category-menu__links">
            <a href="/category/cinema" onClick={closeMenu}>
              <img className="mobile-category-menu__icon" src="/products/cinemamenu.png" alt="" />
              Cinema
            </a>
            <a href="/#corporate" onClick={closeMenu}>
              <img className="mobile-category-menu__icon" src="/products/corporate.png" alt="" />
              Corporate
            </a>
            <a href="/#customize" onClick={closeMenu}>
              <img className="mobile-category-menu__icon" src="/products/customize.png" alt="" />
              Customize
            </a>
          </div>
          <div className="mobile-category-menu__contact">
            <span>Get in touch</span>
            <a href="mailto:tribullwears@gmail.com">tribullwears@gmail.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}
