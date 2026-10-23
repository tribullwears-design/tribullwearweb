import type { ReactNode } from "react";
import HeaderActions from "./HeaderActions";
import MobileCategoryMenu from "./MobileCategoryMenu";
import MovingNavbar from "./MovingNavbar";
import { useSiteLogo } from "../contexts/SiteLogoContext";

export default function StorefrontHeader({ children }: { children?: ReactNode }) {
  const logo = useSiteLogo();
  return (
    <>
      <MovingNavbar />

      <header className="site-header">
        <MobileCategoryMenu />
        <a className="wordmark" href="/" aria-label="Tribull home">
          <img src={logo} alt="TRIBULL" />
        </a>
        <HeaderActions />
      </header>

      {children}
    </>
  );
}
