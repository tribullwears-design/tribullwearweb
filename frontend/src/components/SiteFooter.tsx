import { useEffect, useState } from "react";

type SiteFooterProps = {
  className?: string;
};

type SocialLinks = { facebook: string; instagram: string; pinterest: string; whatsapp: string; linkedin: string };

function readSocialLinks(): SocialLinks {
  try {
    const saved = window.localStorage.getItem("tribull-social-links");
    return saved ? { facebook: "", instagram: "", pinterest: "", whatsapp: "", linkedin: "", ...JSON.parse(saved) as Partial<SocialLinks> } : { facebook: "", instagram: "", pinterest: "", whatsapp: "", linkedin: "" };
  } catch {
    return { facebook: "", instagram: "", pinterest: "", whatsapp: "", linkedin: "" };
  }
}

export default function SiteFooter({ className = "" }: SiteFooterProps) {
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(() => readSocialLinks());

  useEffect(() => {
    const syncSocialLinks = () => setSocialLinks(readSocialLinks());
    window.addEventListener("tribull-social-links-updated", syncSocialLinks);
    window.addEventListener("storage", syncSocialLinks);
    return () => {
      window.removeEventListener("tribull-social-links-updated", syncSocialLinks);
      window.removeEventListener("storage", syncSocialLinks);
    };
  }, []);

  return (
    <footer className={`site-footer ${className}`.trim()} id="footer">
      <a className="footer__logo" href="#top" aria-label="Tribull home">
        <img src="/products/logo.png" alt="TRIBULL" />
      </a>
      <div className="footer__top">
        <div className="footer__col">
          <h3 className="footer__col-title">Need Help</h3>
          <div className="footer__links">
            <a href="#top">Contact Us</a>
            <a href="#top">Track Order</a>
            <a href="#top">Returns &amp; Refunds</a>
            <a href="#top">FAQs</a>
            <a href="#top">My Account</a>
          </div>
          <div className="footer__badges">
            <span className="footer__badge"><span className="footer__badge-icon">₹</span> COD Not Available</span>
            <span className="footer__badge"><span className="footer__badge-icon">↗</span> Free Shipping</span>
            <span className="footer__badge"><span className="footer__badge-icon">↻</span> No Returns or Refunds — Exchange Only</span>
          </div>
        </div>

        <div className="footer__col">
          <h3 className="footer__col-title">Company</h3>
          <div className="footer__links">
            <a href="#top">About Us</a>
            <a href="#top">Investor Relation</a>
            <a href="#top">Careers</a>
            <a href="#top">Gift Vouchers</a>
            <a href="#top">Community Initiatives</a>
          </div>
        </div>
      </div>

      <div className="footer__middle">
        <div className="footer__social">
          <span>Follow Us:</span>
          <a href={socialLinks.facebook || undefined} target={socialLinks.facebook ? "_blank" : undefined} rel={socialLinks.facebook ? "noopener noreferrer" : undefined} className="social-link social-link--fb" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg></a>
          <a href={socialLinks.instagram || undefined} target={socialLinks.instagram ? "_blank" : undefined} rel={socialLinks.instagram ? "noopener noreferrer" : undefined} className="social-link social-link--ig" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
          <a href={socialLinks.pinterest || undefined} target={socialLinks.pinterest ? "_blank" : undefined} rel={socialLinks.pinterest ? "noopener noreferrer" : undefined} className="social-link social-link--pinterest" aria-label="Pinterest"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2a10 10 0 0 0-3.64 19.31c-.02-.78 0-1.72.2-2.57l1.47-6.22s-.37-.73-.37-1.8c0-1.69.98-2.95 2.2-2.95 1.04 0 1.54.78 1.54 1.71 0 1.04-.66 2.6-1 4.04-.28 1.2.6 2.18 1.78 2.18 2.14 0 3.8-2.26 3.8-5.52 0-2.89-2.08-4.9-5.05-4.9-3.44 0-5.47 2.58-5.47 5.25 0 1.04.4 2.16.9 2.77a.36.36 0 0 1 .08.34l-.33 1.34c-.05.22-.17.27-.4.16-1.5-.7-2.44-2.88-2.44-4.63 0-3.77 2.74-7.23 7.9-7.23 4.15 0 7.38 2.96 7.38 6.92 0 4.13-2.6 7.45-6.2 7.45-1.21 0-2.35-.63-2.74-1.38l-.75 2.85c-.27 1.04-1 2.34-1.49 3.13A10 10 0 1 0 12 2Z"/></svg></a>
          <a href={socialLinks.whatsapp || undefined} target={socialLinks.whatsapp ? "_blank" : undefined} rel={socialLinks.whatsapp ? "noopener noreferrer" : undefined} className="social-link social-link--whatsapp" aria-label="WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.08 0C5.5 0 .15 5.35.15 11.93c0 2.1.55 4.15 1.6 5.96L0 24l6.27-1.64a11.9 11.9 0 0 0 5.8 1.48h.01C18.66 23.84 24 18.5 24 11.92c0-3.18-1.24-6.17-3.48-8.44ZM12.08 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.22-3.72.98.99-3.63-.24-.37a9.87 9.87 0 0 1-1.52-5.25C2.19 6.56 6.7 2.05 12.08 2.05c2.6 0 5.04 1.02 6.88 2.86a9.66 9.66 0 0 1 2.85 6.9c0 5.37-4.36 9.99-9.73 9.99Zm5.35-7.48c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.66.15-.2.3-.77.97-.94 1.17-.17.2-.34.22-.64.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.66-1.6-.91-2.19-.24-.57-.48-.5-.66-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.09 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z"/></svg></a>
          <a href={socialLinks.linkedin || undefined} target={socialLinks.linkedin ? "_blank" : undefined} rel={socialLinks.linkedin ? "noopener noreferrer" : undefined} className="social-link social-link--linkedin" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.44-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.26 2.37 4.26 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.78C.8 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.78 24h20.44c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z"/></svg></a>
        </div>
      </div>

      <div className="footer__bottom">
        <span>© TRIBULL</span>
        <span>100% cotton, always.</span>
      </div>
    </footer>
  );
}
