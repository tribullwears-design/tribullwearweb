import { useEffect, useRef, useState } from "react";
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
  const [copiesPerGroup, setCopiesPerGroup] = useState(12);
  const tickerRef = useRef<HTMLDivElement>(null);
  const sampleRef = useRef<HTMLSpanElement>(null);

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

  useEffect(() => {
    const ticker = tickerRef.current;
    const sample = sampleRef.current;
    if (!ticker || !sample) return;

    const updateCopies = () => {
      const itemWidth = sample.getBoundingClientRect().width;
      if (itemWidth <= 0) return;
      const requiredCopies = Math.ceil(ticker.clientWidth / itemWidth) + 1;
      setCopiesPerGroup((current) => current === requiredCopies ? current : requiredCopies);
    };

    updateCopies();
    const observer = new ResizeObserver(updateCopies);
    observer.observe(ticker);
    observer.observe(sample);
    return () => observer.disconnect();
  }, [settings]);

  const renderAnnouncement = (groupIndex: number) => (
    <div className="ticker__group" key={groupIndex} aria-hidden={groupIndex > 0}>
      {Array.from({ length: copiesPerGroup }, (_, index) => (
        <span
          key={index}
          ref={groupIndex === 0 && index === 0 ? sampleRef : undefined}
          aria-hidden={index > 0}
        >
          {settings.message}
          <a href={settings.linkUrl}><b>{settings.linkText}</b></a>
          <i aria-hidden="true">✦</i>
        </span>
      ))}
    </div>
  );

  return (
    <div className={`ticker ${className}`.trim()} aria-label="Announcement" ref={tickerRef}>
      <div className={`ticker__track ${trackClassName}`.trim()}>
        {renderAnnouncement(0)}
        {renderAnnouncement(1)}
      </div>
    </div>
  );
}
