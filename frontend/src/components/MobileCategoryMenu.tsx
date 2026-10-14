import { ChevronRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { defaultCategoryHierarchy, getStorefrontCategoryHierarchy, useCategoryHierarchy } from "../lib/categoryHierarchy";

export default function MobileCategoryMenu() {
  const [open, setOpen] = useState(false);
  const [cinemaExpanded, setCinemaExpanded] = useState(false);
  const fetchedHierarchy = useCategoryHierarchy(defaultCategoryHierarchy);
  const hierarchy = getStorefrontCategoryHierarchy(fetchedHierarchy);
  const cinemaSubcategories = hierarchy.subcategories.cinema || [];

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

      {open && typeof document !== "undefined" && createPortal(
        <>
          <button className="mobile-category-menu__overlay" type="button" aria-label="Close menu" onClick={closeMenu} />
          <div
            id="mobile-category-navigation"
            className="mobile-category-menu__panel mobile-category-menu__panel--open"
            aria-hidden={!open}
          >
            <div className="mobile-category-menu__header">
              <span>Menu</span>
              <button className="mobile-category-menu__close" type="button" aria-label="Close menu" onClick={closeMenu}>
                <X size={21} strokeWidth={1.5} />
              </button>
            </div>
            <div className="mobile-category-menu__content">
              <div className="mobile-category-menu__group">
                <button
                  className="mobile-category-menu__trigger"
                  type="button"
                  aria-expanded={cinemaExpanded}
                  aria-controls="mobile-cinema-subcategories"
                  onClick={() => setCinemaExpanded((current) => !current)}
                >
                  <span className="mobile-category-menu__label">
                    <img className="mobile-category-menu__icon" src="/products/cinemamenu.png" alt="" />
                    Cinema
                  </span>
                  <ChevronRight
                    className={`mobile-category-menu__arrow ${cinemaExpanded ? "mobile-category-menu__arrow--open" : ""}`}
                    size={17}
                    aria-hidden="true"
                  />
                </button>
                <div
                  id="mobile-cinema-subcategories"
                  className={`mobile-category-menu__subcategories ${cinemaExpanded ? "mobile-category-menu__subcategories--open" : ""}`}
                  aria-hidden={!cinemaExpanded}
                >
                  {cinemaSubcategories.map(({ value, label, image }) => (
                    <a
                      key={value}
                      className="mobile-category-menu__subcategory"
                      href={`/category/cinema/${value}`}
                      onClick={closeMenu}
                      tabIndex={cinemaExpanded ? 0 : -1}
                    >
                      {image && <img className="mobile-category-menu__icon" src={image} alt="" />}
                      {label}
                    </a>
                  ))}
                </div>
              </div>
              <div className="mobile-category-menu__links">
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
        </>,
        document.body,
      )}
    </div>
  );
}
