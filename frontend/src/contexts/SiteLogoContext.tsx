import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { defaultSiteLogo, loadSiteLogo, siteLogoUpdatedEvent, siteLogoUpdatedStorageKey } from "../lib/siteLogo";

const SiteLogoContext = createContext(defaultSiteLogo);

export function SiteLogoProvider({ children }: { children: ReactNode }) {
  const [logo, setLogo] = useState(defaultSiteLogo);

  useEffect(() => {
    let active = true;
    void loadSiteLogo()
      .then(({ image }) => {
        if (active && image) setLogo(image);
      })
      .catch((error: unknown) => {
        console.error("Could not load the store logo.", error);
      });

    const updateLogo = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "string") setLogo(event.detail);
    };
    const updateFromAnotherTab = (event: StorageEvent) => {
      if (event.key === siteLogoUpdatedStorageKey) {
        void loadSiteLogo()
          .then(({ image }) => { if (image) setLogo(image); })
          .catch((error: unknown) => console.error("Could not refresh the store logo.", error));
      }
    };
    window.addEventListener(siteLogoUpdatedEvent, updateLogo);
    window.addEventListener("storage", updateFromAnotherTab);

    return () => {
      active = false;
      window.removeEventListener(siteLogoUpdatedEvent, updateLogo);
      window.removeEventListener("storage", updateFromAnotherTab);
    };
  }, []);

  return <SiteLogoContext.Provider value={logo}>{children}</SiteLogoContext.Provider>;
}

export function useSiteLogo() {
  return useContext(SiteLogoContext);
}
