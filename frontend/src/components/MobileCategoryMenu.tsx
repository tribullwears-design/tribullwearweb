import { ChevronRight, Menu, X } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useCategoryHierarchy, type CategoryHierarchy } from "../lib/categoryHierarchy";

type MenuCategory = {
  slug: string;
  label: string;
  subcategories: { slug: string; label: string }[];
};

const menuHierarchy: CategoryHierarchy = { main: [], subcategories: {} };

export default function MobileCategoryMenu() {
  const hierarchy = useCategoryHierarchy(menuHierarchy);
  const [open, setOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const toggleMenu = () => {
    setOpen((current) => !current);
    if (open) setExpandedCategory(null);
  };

  const closeMenu = () => {
    setOpen(false);
    setExpandedCategory(null);
  };

  const toggleCategory = (slug: string) => {
    setExpandedCategory((current) => (current === slug ? null : slug));
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
        <nav aria-label="Mobile category navigation">
          {hierarchy.main.map((category) => {
            const subcategories = hierarchy.subcategories[category.value] || [];
            const isExpanded = expandedCategory === category.value;
            return (
              <div className="mobile-category-menu__group" key={category.value}>
                <button
                  className="mobile-category-menu__trigger"
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={`mobile-${category.value}-subcategories`}
                  onClick={() => toggleCategory(category.value)}
                >
                  <span>{category.label}</span>
                  <ChevronRight className={isExpanded ? "mobile-category-menu__arrow mobile-category-menu__arrow--open" : "mobile-category-menu__arrow"} size={19} strokeWidth={1.6} />
                </button>
                <div
                  id={`mobile-${category.value}-subcategories`}
                  className={`mobile-category-menu__subcategories ${isExpanded ? "mobile-category-menu__subcategories--open" : ""}`}
                >
                  {subcategories.map((subcategory) => (
                    <Link
                      className="mobile-category-menu__subcategory"
                      href={`/category/${category.value}/${subcategory.value}`}
                      key={subcategory.value}
                      onClick={closeMenu}
                    >
                      {subcategory.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="mobile-category-menu__links">
          <a href="/#corporate" onClick={closeMenu}>Corporate</a>
          <a href="/#customize" onClick={closeMenu}>Customize</a>
        </div>
        <div className="mobile-category-menu__contact">
          <span>Get in touch</span>
          <a href="mailto:tribullwears@gmail.com">tribullwears@gmail.com</a>
        </div>
      </div>
    </div>
  );
}
