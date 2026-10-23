import { useEffect, useState } from "react";
import {
  fetchMovingNavbarSettings,
  getCachedMovingNavbarSettings,
} from "../lib/storefrontSettings";
import type { MovingNavbarSettings } from "../lib/storefrontSettings";

type MovingNavbarProps = {
  className?: string;
  trackClassName?: string;
};

export default function MovingNavbar({ className = "", trackClassName = "" }: MovingNavbarProps) {
  const [settings, setSettings] = useState<MovingNavbarSettings>(() => getCachedMovingNavbarSettings());

  useEffect(() => {
    let active = true;
    const syncSettings = () => {
      void fetchMovingNavbarSettings()
        .then((nextSettings) => {
          if (active) setSettings(nextSettings);
        })
        .catch((error: unknown) => {
          console.error("Could not load moving navbar settings.", error);
        });
    };
    const onSettingsUpdated = () => {
      if (active) setSettings(getCachedMovingNavbarSettings());
    };
    window.addEventListener("tribull-moving-navbar-updated", onSettingsUpdated);
    syncSettings();
    return () => {
      active = false;
      window.removeEventListener("tribull-moving-navbar-updated", onSettingsUpdated);
    };
  }, []);

  return (
    <div className={`ticker ${className}`.trim()} aria-label="Announcement">
      <div className={`ticker__track ${trackClassName}`.trim()}>
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index}>
            {settings.message}
            <a href={settings.linkUrl}><b>{settings.linkText}</b></a>
            <i aria-hidden="true">✦</i>
          </span>
        ))}
      </div>
    </div>
  );
}
