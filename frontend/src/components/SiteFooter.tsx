type SiteFooterProps = {
  className?: string;
};

function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <a className={`wordmark ${inverse ? "wordmark--inverse" : ""}`} href="#top" aria-label="Tribull home">
      <img src="/products/logo.png" alt="TRIBULL" />
    </a>
  );
}

export default function SiteFooter({ className = "" }: SiteFooterProps) {
  return (
    <footer className={`site-footer ${className}`.trim()} id="footer">
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
            <span className="footer__badge"><span className="footer__badge-icon">₹</span> COD Available</span>
            <span className="footer__badge"><span className="footer__badge-icon">↻</span> 30 Days Easy Returns & Exchanges</span>
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

      <div className="footer__app">
        <p className="footer__app-title">📱 Experience the Souled Store App</p>
        <div className="footer__app-buttons">
          <a href="#top" className="app-btn">
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
            <div>
              <small>GET IT ON</small>
              <span>Google Play</span>
            </div>
          </a>
          <a href="#top" className="app-btn">
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            <div>
              <small>Download on the</small>
              <span>App Store</span>
            </div>
          </a>
        </div>
      </div>

      <div className="footer__middle">
        <div className="footer__brand-row">
          <Wordmark inverse />
        </div>
        <div className="footer__social">
          <span>Follow Us:</span>
          <a href="#top" className="social-link social-link--fb" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg></a>
          <a href="#top" className="social-link social-link--ig" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
          <a href="#top" className="social-link social-link--yt" aria-label="YouTube"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
          <a href="#top" className="social-link social-link--x" aria-label="X"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
        </div>
      </div>

      <div className="footer__bottom">
        <span>© The Souled Store 2026-27</span>
        <span>100% cotton, always.</span>
      </div>
    </footer>
  );
}
