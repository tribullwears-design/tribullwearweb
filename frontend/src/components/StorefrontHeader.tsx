import type { ReactNode } from "react";
import { Link } from "wouter";
import HeaderActions from "./HeaderActions";
import MobileCategoryMenu from "./MobileCategoryMenu";

export default function StorefrontHeader({ children }: { children?: ReactNode }) {
  return (
    <>
      <div className="ticker" aria-label="Announcement">
        <div className="ticker__track">
          {Array.from({ length: 8 }).map((_, index) => (
            <span key={index}>100% COTTON.<Link href="/products"><b>SHOP NOW</b></Link><i>✦</i></span>
          ))}
        </div>
      </div>

      <header className="site-header">
        <MobileCategoryMenu />
        <a className="wordmark" href="/" aria-label="Tribull home">
          <img src="/products/logo.png" alt="TRIBULL" />
        </a>
        <HeaderActions />
      </header>

      {children}
    </>
  );
}
