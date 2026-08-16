import React, { useState, useEffect } from "react";
import {
  ShoppingBag, Bell, X, Plus, Minus, Check, Printer, Package,
  Truck, MapPin, ChevronRight, ArrowLeft, MessageCircle, Instagram,
  Clock, Menu, Tag, Copy, ShieldCheck, Zap, ArrowRight, Shirt, Heart,
  Sparkles, Star, Upload, Sun, Moon, Monitor, WifiOff, AlertTriangle,
  SearchX, Compass, RefreshCw, Ruler,
} from "lucide-react";

// ---------- Design tokens ----------
// "Signal Mono": true off-black ink on a cool off-white paper, with a
// single locked accent (cobalt) carrying every CTA, price and status
// across the site. Replaces the old warm-cream/espresso combo, which
// sat inside the generic AI premium-consumer palette family. Exposed as
// CSS custom properties so light/dark can swap without touching markup.
const COLORS = {
  canvas: "var(--canvas)",
  surface: "var(--surface)",
  surfaceAlt: "var(--surface-alt)",
  ink: "var(--ink)",
  inkSoft: "var(--ink-soft)",
  onDark: "var(--on-dark)",
  onDarkSoft: "var(--on-dark-soft)",
  chrome: "var(--chrome)",
  onChrome: "var(--on-chrome)",
  onChromeSoft: "var(--on-chrome-soft)",
  accent: "var(--accent)",
  accentSoft: "var(--accent-soft)",
  onAccent: "var(--on-accent)",
  line: "var(--line)",
  lineOnDark: "var(--line-on-dark)",
  good: "var(--good)",
  goodSoft: "var(--good-soft)",
};

// Decorative-only sub-palette for the product-design swatches (DesignPatch).
// These render nine different garment graphics being sold, so they are
// content, not UI chrome, and are exempt from the one-accent lock below.
const PATCH_COLORS = {
  a: "#2451FF",
  b: "#0EA79C",
  ink: "#131313",
};

const FONTS = {
  display: "'Space Grotesk', sans-serif",
  body: "'Manrope', sans-serif",
  mono: "'Space Mono', monospace",
};

// ---------- Data ----------
const GARMENT_COLORS = [
  { id: "white", name: "Bone White", hex: "#FBFAF6", border: true },
  { id: "black", name: "Jet Black", hex: "#1B1B1E" },
  { id: "navy", name: "Ink Navy", hex: "#14213D" },
  { id: "grey", name: "Storm Grey", hex: "#8A8D93" },
  { id: "olive", name: "Field Olive", hex: "#6B6E4E" },
  { id: "rust", name: "Rust Clay", hex: "#B5502D" },
];

const SIZES = ["S", "M", "L", "XL", "XXL"];

// No seed designs - the gallery is admin-curated (Admin > Designs) or
// customer-uploaded. Nothing shows here until one of those adds something.
const DESIGNS = [];

// No seed products - the catalog is entirely admin-managed (Admin >
// Products). Nothing appears on the shop page until admin adds a product
// there (once both apps are wired to the same backend; see the fetch below).
const BASE_PRODUCTS = [];

// Body measurements shown in the size guide, by garment type. Editorial
// reference numbers (inches) - swap for the brand's real spec sheet later.
const SIZE_CHART = {
  tshirt: [
    { size: "S", chest: 36, length: 26 },
    { size: "M", chest: 38, length: 27 },
    { size: "L", chest: 40, length: 28 },
    { size: "XL", chest: 42, length: 29 },
    { size: "XXL", chest: 44, length: 30 },
  ],
  hoodie: [
    { size: "S", chest: 40, length: 25 },
    { size: "M", chest: 42, length: 26 },
    { size: "L", chest: 44, length: 27 },
    { size: "XL", chest: 46, length: 28 },
    { size: "XXL", chest: 48, length: 29 },
  ],
};

// ---------- Variant/stock helpers ----------
function sizesForColor(product, colorId) {
  return product?.variants?.[colorId] || {};
}
function stockFor(product, colorId, size) {
  return sizesForColor(product, colorId)[size] ?? 0;
}
function colorTotalStock(product, colorId) {
  const sizes = sizesForColor(product, colorId);
  return Object.values(sizes).reduce((sum, n) => sum + n, 0);
}
function productTotalStock(product) {
  if (!product?.variants) return 0;
  return Object.keys(product.variants).reduce((sum, colorId) => sum + colorTotalStock(product, colorId), 0);
}
// First color (in GARMENT_COLORS order) that still has any stock at all.
// Falls back to the first color even if empty so the UI always has something selected.
function firstInStockColor(product) {
  const inStock = GARMENT_COLORS.find((c) => colorTotalStock(product, c.id) > 0);
  return (inStock || GARMENT_COLORS[0]).id;
}
// First size (in SIZES order) with stock for the given color; null if none.
function firstInStockSize(product, colorId) {
  return SIZES.find((s) => stockFor(product, colorId, s) > 0) || null;
}

// Shop-by-category tiles, part of the bento grid right under the hero.
// Each maps to a filter combo on the product grid below.
const CATEGORY_TILES = [
  { key: "tees", title: "Tees", subtitle: "Everyday fits, printed fresh", typeFilter: "tshirt", catFilter: "all", icon: "Shirt" },
  { key: "hoodies", title: "Hoodies", subtitle: "Heavyweight comfort", typeFilter: "hoodie", catFilter: "all", icon: "Package" },
  { key: "women", title: "For Her", subtitle: "Boxy tees & cropped hoodies", typeFilter: "all", catFilter: "women", icon: "Heart" },
];

// mock pincode -> distance in km, near the stall (used only when no API is configured)
const PINCODE_TABLE = {
  "560001": 2, "560034": 4, "560095": 6, "560102": 3,
  "560068": 9, "560038": 12, "560017": 5, "560078": 1,
};

// No seed offers - codes are entirely admin-managed (Admin > Coupons).
// Mirrors whatever backend/src/coupons.js holds so the checkout coupon
// field still validates in local/offline demos with no API configured.
const FALLBACK_COUPON_RULES = [];
const FALLBACK_COUPONS = [];
function validateCouponLocal(rawCode, subtotal) {
  const code = String(rawCode || "").trim().toUpperCase();
  const rule = FALLBACK_COUPON_RULES.find((c) => c.code === code);
  if (!rule) return { valid: false, error: "Invalid or expired code" };
  if (subtotal < rule.minSubtotal) {
    return { valid: false, error: `Add ₹${rule.minSubtotal - subtotal} more to use this code` };
  }
  let discountAmount = rule.kind === "percent" ? Math.round((subtotal * rule.value) / 100) : rule.value;
  discountAmount = Math.min(discountAmount, rule.maxDiscount, subtotal);
  return { valid: true, discountAmount, label: rule.label, code: rule.code };
}

// Real notifications would come from the order-status API (see the
// tracking poll below); nothing invented here.
const NOTIFICATIONS = [];

const STEPS = [
  { key: "placed", label: "Placed", icon: Package },
  { key: "printing", label: "Printing", icon: Printer },
  { key: "ready", label: "Ready", icon: Check },
  { key: "out", label: "Out for delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Check },
];

// ---------- Design preview renderer ----------
function DesignPatch({ design, size = 92 }) {
  const base = { width: size, height: size, borderRadius: 8, overflow: "hidden", position: "relative" };
  if (!design) {
    return <div style={{ ...base, background: "var(--surface-alt)", border: "1px dashed var(--line)" }} />;
  }
  let bg = "";
  switch (design.pattern) {
    case "drip": bg = `repeating-linear-gradient(100deg, ${PATCH_COLORS.a} 0 6px, transparent 6px 22px)`; break;
    case "grid": bg = `linear-gradient(${PATCH_COLORS.ink} 1px, transparent 1px) 0 0/12px 12px, linear-gradient(90deg, ${PATCH_COLORS.ink} 1px, transparent 1px) 0 0/12px 12px, #F2F4F8`; break;
    case "wave": bg = `radial-gradient(circle at 30% 30%, ${PATCH_COLORS.a}, transparent 60%), radial-gradient(circle at 70% 70%, ${PATCH_COLORS.ink}, transparent 60%), #FFFFFF`; break;
    case "sunset": bg = `linear-gradient(180deg, ${PATCH_COLORS.a}, ${PATCH_COLORS.b})`; break;
    case "lines": bg = `repeating-linear-gradient(0deg, ${PATCH_COLORS.ink} 0 2px, transparent 2px 10px), #FFFFFF`; break;
    case "dots": bg = `radial-gradient(${PATCH_COLORS.ink} 2px, transparent 2px) 0 0/10px 10px, #FFFFFF`; break;
    case "geometric": bg = `linear-gradient(45deg, ${PATCH_COLORS.ink} 25%, transparent 25%) 0 0/20px 20px, linear-gradient(-45deg, ${PATCH_COLORS.a} 25%, transparent 25%) 0 0/20px 20px, #FFFFFF`; break;
    case "slogan": bg = PATCH_COLORS.ink; break;
    case "custom": bg = `center/cover no-repeat url(${design.image})`; break;
    default: bg = "#FFFFFF";
  }
  return (
    <div style={{ ...base, background: bg }}>
      {design.pattern === "slogan" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", padding: 4, textAlign: "center",
        }}>
          <span style={{ fontFamily: FONTS.display, fontWeight: 700, color: PATCH_COLORS.a, fontSize: size * 0.14, lineHeight: 1.1 }}>
            {design.text}
          </span>
        </div>
      )}
    </div>
  );
}

// Mouse-driven 3D tilt for the two anchor hero tiles: they lean away from
// the cursor and spring back flat on mouse-leave. `strength` dials the
// tilt for different tile sizes.
function Tilt3DCard({ children, style, className, strength = 10, twist = 12, glow = true }) {
  const ref = React.useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, glowX: 50, glowY: 50 });

  function onMouseMove(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({
      rx: (0.5 - py) * strength,
      ry: (px - 0.5) * twist,
      glowX: px * 100,
      glowY: py * 100,
    });
  }
  function onMouseLeave() {
    setTilt({ rx: 0, ry: 0, glowX: 50, glowY: 50 });
  }

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ perspective: 1200, position: "relative", ...style }}
    >
      <div
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
          position: "relative",
          height: "100%",
        }}
      >
        {glow && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 20,
              pointerEvents: "none",
              background: `radial-gradient(circle at ${tilt.glowX}% ${tilt.glowY}%, rgba(255,255,255,0.22), transparent 55%)`,
              transition: "background 300ms ease",
              zIndex: 3,
            }}
          />
        )}
        {children}
      </div>
    </div>
  );
}

// Bento card primitive shared by every grid in the site: hero stats,
// category/offer tiles, checkout sections, and tracking cards. Consistent
// radius, shadow and hover-lift keep the mosaic feeling like one system.
function BentoTile({ children, tone = "white", hoverable = true, onClick, className = "", style = {} }) {
  const [hover, setHover] = useState(false);
  const backgrounds = {
    white: COLORS.surface,
    canvas: COLORS.surfaceAlt,
    dark: COLORS.chrome,
    accent: COLORS.accent,
    tint: COLORS.accentSoft,
  };
  const isDark = tone === "dark" || tone === "accent";
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hoverable && setHover(true)}
      onMouseLeave={() => hoverable && setHover(false)}
      className={className}
      style={{
        background: backgrounds[tone] || tone,
        color: tone === "dark" ? COLORS.onChrome : isDark ? COLORS.onDark : COLORS.ink,
        borderRadius: 20,
        border: isDark ? "none" : `1px solid ${COLORS.line}`,
        boxShadow: hover ? "0 20px 40px rgba(0,0,0,0.12)" : "0 2px 14px rgba(0,0,0,0.04)",
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        transition: "transform 260ms cubic-bezier(0.22,1,0.36,1), box-shadow 260ms ease",
        padding: 22,
        position: "relative",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Product-grid tilt card: a lighter mouse-tilt card that also owns the
// card chrome (border/shadow/lift), the "tasteful" motion tier applied to
// every product tile.
function TiltCard({ children, style }) {
  const ref = React.useRef(null);
  const [hover, setHover] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  function onMove(e) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ rx: (0.5 - py) * 7, ry: (px - 0.5) * 8 });
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setTilt({ rx: 0, ry: 0 }); }}
      style={{ perspective: 900, height: "100%", ...style }}
    >
      <div style={{
        transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${hover ? -6 : 0}px)`,
        transformStyle: "preserve-3d",
        transition: "transform 260ms cubic-bezier(0.22,1,0.36,1), box-shadow 260ms ease, border-color 260ms ease",
        boxShadow: hover ? "0 22px 42px rgba(0,0,0,0.14)" : "0 1px 0 rgba(0,0,0,0.02)",
        border: `1px solid ${hover ? COLORS.accent : COLORS.line}`,
        borderRadius: 18, background: COLORS.surface, padding: 18, height: "100%",
        display: "flex", flexDirection: "column",
      }}>
        {children}
      </div>
    </div>
  );
}

// Scroll-triggered fade-and-rise reveal, used sparingly so the page feels
// alive on scroll without turning into a motion showcase.
function Reveal({ children, delay = 0, y = 22, style }) {
  const ref = React.useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : `translateY(${y}px)`,
        transition: `opacity 700ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 700ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Faint ambient color wash behind the hero: two soft blurred blooms in the
// locked accent plus a muted ink haze, drifting slowly. Purely atmospheric,
// motivated by giving the hero depth without adding new UI chrome.
function GradientOrbs() {
  return (
    <>
      <div style={{ position: "absolute", top: "-10%", left: "2%", width: 360, height: 360, borderRadius: "50%", background: COLORS.accent, filter: "blur(110px)", opacity: 0.16, animation: "atheFloatA 13s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-16%", right: "0%", width: 320, height: 320, borderRadius: "50%", background: PATCH_COLORS.b, filter: "blur(110px)", opacity: 0.12, animation: "atheFloatB 15s ease-in-out infinite", pointerEvents: "none" }} />
    </>
  );
}

// Wordmark logo: a tight "ATHE." lockup in solid ink (or white on dark
// surfaces) with a small mono tagline underneath. Wordmark-only by design,
// no separate icon mark, so it stays crisp at any size.
function AtheWordmark({ size = "md", tone = "dark", align = "center" }) {
  const dims = {
    sm: { word: 17, tag: 7.5, gap: 3 },
    md: { word: 22, tag: 8.5, gap: 4 },
    lg: { word: 36, tag: 10.5, gap: 6 },
  }[size];
  const wordColor = tone === "light" ? COLORS.onChrome : COLORS.ink;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, lineHeight: 1 }}>
      <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: dims.word, letterSpacing: -0.5, color: wordColor }}>
        ATHE<span style={{ color: COLORS.accent }}>.</span>
      </span>
      <span style={{
        marginTop: dims.gap,
        fontFamily: FONTS.mono, fontSize: dims.tag, fontWeight: 700, letterSpacing: 3,
        color: COLORS.accent, textTransform: "uppercase",
      }}>
        Press Studio
      </span>
    </div>
  );
}

function GarmentPreview({ colorHex, design, type, photoUrl }) {
  const clip = "polygon(20% 0%, 35% 0%, 50% 10%, 65% 0%, 80% 0%, 100% 20%, 85% 34%, 78% 27%, 78% 100%, 22% 100%, 22% 27%, 15% 34%, 0% 20%)";

  // Once a real garment photo has been uploaded in Admin, show that instead
  // of the flat placeholder shape, with the design overlaid on the chest.
  if (photoUrl) {
    return (
      <div style={{ position: "relative", width: "100%", maxWidth: 260, aspectRatio: "1/1.05", margin: "0 auto", borderRadius: 10, overflow: "hidden", background: "#FFFFFF" }}>
        <img src={photoUrl} alt={type} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", top: "32%", left: "50%", transform: "translateX(-50%)", width: "34%" }}>
          <div style={{ width: "100%", aspectRatio: "1/1", borderRadius: 6, overflow: "hidden" }}>
            <DesignPatch design={design} size={90} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 260, aspectRatio: "1/1.05", margin: "0 auto" }}>
      <div style={{ position: "absolute", inset: 0, background: colorHex, clipPath: clip, border: colorHex === "#FBFAF6" ? `1px solid ${COLORS.line}` : "none" }} />
      {type === "hoodie" && (
        <div style={{ position: "absolute", top: "-4%", left: "38%", width: "24%", height: "16%", background: colorHex, borderRadius: "50% 50% 0 0", border: colorHex === "#FBFAF6" ? `1px solid ${COLORS.line}` : "none" }} />
      )}
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)" }}>
        <DesignPatch design={design} size={90} />
      </div>
    </div>
  );
}

function PolicyBlock({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.4, color: COLORS.ink, marginBottom: 5 }}>{title.toUpperCase()}</p>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: COLORS.inkSoft }}>{children}</p>
    </div>
  );
}

// Small pill used in the offers tile: shows a code, copies it on click.
function CouponChip({ code, label }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  return (
    <button onClick={copy} style={{
      display: "flex", alignItems: "center", gap: 10, background: COLORS.surface,
      border: `1px solid ${COLORS.line}`, borderRadius: 999, padding: "8px 8px 8px 16px",
      color: COLORS.ink, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{
        fontFamily: FONTS.mono, fontSize: 11.5, fontWeight: 700, background: COLORS.chrome, color: COLORS.onChrome,
        padding: "5px 10px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6,
      }}>
        {copied ? "Copied!" : code} {!copied && <Copy size={11} />}
      </span>
    </button>
  );
}

// Footer nav link with an accent underline that grows in on hover. Renders
// a real <a href="#/..."> (not a <button>) so it behaves like an actual
// hyperlink: right-click > open in new tab, hover shows the URL, browser
// back/forward works. `onClick` still runs the same state updates the old
// button did; the href just makes the destination a real, bookmarkable URL.
function FooterLink({ href, onClick, children }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ color: COLORS.onChromeSoft, fontSize: 12.5, textAlign: "left", width: "fit-content", position: "relative", paddingBottom: 2, textDecoration: "none", cursor: "pointer" }}
    >
      {children}
      <span style={{
        position: "absolute", left: 0, right: hover ? 0 : "100%", bottom: 0, height: 1,
        background: COLORS.accent, transition: "right 200ms ease",
      }} />
    </a>
  );
}

// Header/mobile-menu nav link: same idea as FooterLink but undecorated, for
// the primary nav bar. Real <a href> for genuine hyperlink behavior.
function NavLink({ href, onClick, style, children }) {
  return (
    <a href={href} onClick={onClick} style={{ textDecoration: "none", cursor: "pointer", ...style }}>
      {children}
    </a>
  );
}

// ---------- Reusable state blocks (empty / no-results / loading / offline / error) ----------

// Generic centered state block: icon + title + message + optional action.
// Used for empty cart, no search results, "no active order", and the
// offline/error takeovers below, so every dead-end in the app reads as one
// consistent, intentional design instead of ad hoc blank space.
function EmptyState({ icon: Icon, title, message, actionLabel, onAction, tone = "canvas" }) {
  return (
    <BentoTile tone={tone} hoverable={false} style={{ alignItems: "center", textAlign: "center", padding: "56px 24px" }}>
      <Icon size={34} color={COLORS.inkSoft} />
      <p style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 17, color: COLORS.ink, marginTop: 14 }}>{title}</p>
      {message && <p style={{ fontSize: 13, color: COLORS.inkSoft, marginTop: 6, maxWidth: 360 }}>{message}</p>}
      {actionLabel && (
        <button onClick={onAction} style={{
          marginTop: 18, background: COLORS.ink, color: COLORS.onDark, border: "none",
          padding: "10px 20px", borderRadius: 999, fontWeight: 700, fontSize: 13,
        }}>
          {actionLabel}
        </button>
      )}
    </BentoTile>
  );
}

// Skeleton loader matching the real product card's shape (image block, two
// text lines, button-height block) so the grid doesn't jump when real data
// arrives. Shown only while a configured API is still loading products.
function ProductCardSkeleton() {
  const block = (h, w) => ({ height: h, width: w, borderRadius: 8, background: COLORS.surfaceAlt, animation: "athePulse 1.6s ease-in-out infinite" });
  return (
    <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 18, background: COLORS.surface, padding: 18 }}>
      <div style={{ ...block("auto", "100%"), aspectRatio: "1/1.05" }} />
      <div style={{ marginTop: 12 }}>
        <div style={block(9, "30%")} />
        <div style={{ ...block(15, "65%"), marginTop: 8 }} />
        <div style={{ ...block(13, "40%"), marginTop: 8, marginBottom: 12 }} />
        <div style={block(38, "100%")} />
      </div>
    </div>
  );
}

// Full-takeover offline state: rendered in place of the whole page body
// (header stays, so the theme toggle and cart badge remain reachable) the
// moment the browser goes offline. Auto-clears itself via the `online`
// listener in the component below, "Try again" just re-checks navigator.onLine.
function OfflineState({ onRetry }) {
  return (
    <section style={{ padding: "80px 16px", maxWidth: 480, margin: "0 auto" }}>
      <EmptyState
        icon={WifiOff}
        title="You're offline"
        message="Checkout, live tracking, and new designs need a connection. Reconnect and we'll pick up right where you left off."
        actionLabel="Try again"
        onAction={onRetry}
      />
    </section>
  );
}

// Full-page crash fallback rendered by AtheErrorBoundary below when a
// render error escapes the component tree. Reload is the honest recovery
// path here (state is unknown-bad); "Try again" just retries the same tree.
function ErrorPage({ onRetry }) {
  return (
    <div style={{ background: "var(--canvas)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.body, padding: 16 }}>
      <div style={{ maxWidth: 420, width: "100%" }}>
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          message="This page hit an unexpected error. Reloading usually fixes it, and your cart is saved."
          actionLabel="Reload page"
          onAction={() => { onRetry?.(); window.location.reload(); }}
          tone="white"
        />
      </div>
    </div>
  );
}

// Unknown-route state: shown when a #/... hash doesn't match any known
// route, instead of silently leaving the visitor on whatever view they
// were on before (the old behavior, which looked like a broken link).
function NotFoundState({ onBack }) {
  return (
    <section style={{ padding: "80px 16px", maxWidth: 480, margin: "0 auto" }}>
      <EmptyState
        icon={Compass}
        title="Page not found"
        message="That link doesn't match anything here. It may be out of date."
        actionLabel="Back to shop"
        onAction={onBack}
      />
    </section>
  );
}

// Catches render-time errors anywhere below it and shows ErrorPage instead
// of an unrecoverable blank screen. Must be a class component (React only
// supports error boundaries via getDerivedStateFromError/componentDidCatch).
class AtheErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("Athe storefront crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return <ErrorPage onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

// ---------- Main App ----------
function AtheApp({ apiBaseUrl = "" }) {
  const [view, setView] = useState("shop");
  const [typeFilter, setTypeFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [newOnly, setNewOnly] = useState(false);
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState(() => new Set());
  // Color picked on each product CARD (shop grid), keyed by product id -
  // independent of the customize flow's selColor so browsing one card's
  // colors never disturbs another card or an in-progress customization.
  const [cardColor, setCardColor] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // ---------- Theme: light / dark / system ----------
  // "system" means no stored preference - the OS-driven @media block in the
  // <style> tag above takes over. An explicit light/dark choice is written
  // to the root data-theme attribute, which always wins over OS preference
  // (see the CSS rules), and persisted so it survives reloads.
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("athe_theme") || "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("athe_theme", theme);
    } catch {
      // localStorage unavailable (private mode, etc.) - theme still applies for this session
    }
  }, [theme]);
  function cycleTheme() {
    setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));
  }
  const ThemeIcon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;
  const themeLabel = theme === "system" ? "Matching system theme" : theme === "light" ? "Light theme" : "Dark theme";

  // ---------- Offline detection ----------
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  useEffect(() => {
    function goOffline() { setIsOffline(true); }
    function goOnline() { setIsOffline(false); }
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const [activeProduct, setActiveProduct] = useState(null);
  const [selColor, setSelColor] = useState(GARMENT_COLORS[1]);
  const [selSize, setSelSize] = useState("M");
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [selDesign, setSelDesign] = useState(null);
  const [designsList, setDesignsList] = useState(DESIGNS);
  const [products, setProducts] = useState(BASE_PRODUCTS);
  const [apiError, setApiError] = useState(false);
  // Only a real configured API is worth a loading skeleton - the local
  // sample data below renders instantly, so there's nothing to wait on.
  const [productsLoading, setProductsLoading] = useState(!!apiBaseUrl);
  const [coupons, setCoupons] = useState(FALLBACK_COUPONS);
  const [garmentPhotos, setGarmentPhotos] = useState({});
  const [heroSlide, setHeroSlide] = useState(0);

  // Auto-advance the hero's design carousel, every design in the gallery
  // slides through, not just one static pick.
  useEffect(() => {
    if (designsList.length < 2) return;
    const id = setInterval(() => setHeroSlide((i) => (i + 1) % designsList.length), 2800);
    return () => clearInterval(id);
  }, [designsList.length]);

  // Real hyperlink navigation for the header/footer nav: each destination
  // is a genuine #/... URL, not just an onClick. ROUTE_ACTIONS is the single
  // source of truth so NavLink clicks and browser back/forward (hashchange)
  // both end up applying the exact same state changes.
  const ROUTE_ACTIONS = {
    "": () => setView("shop"),
    "#": () => setView("shop"),
    "#/home": () => setView("shop"),
    "#/shop": () => { setView("shop"); setTypeFilter("all"); setCatFilter("all"); setNewOnly(false); },
    "#/tees": () => { setView("shop"); setTypeFilter("tshirt"); setNewOnly(false); },
    "#/hoodies": () => { setView("shop"); setTypeFilter("hoodie"); setNewOnly(false); },
    "#/new": () => { setView("shop"); setTypeFilter("all"); setCatFilter("all"); setNewOnly(true); },
    "#/products": () => { setView("shop"); setTypeFilter("all"); setNewOnly(false); },
    "#/track": () => setView("tracking"),
    "#/about": () => setView("about"),
    "#/privacy": () => setView("privacy"),
    "#/terms": () => setView("terms"),
    "#/refunds": () => setView("refunds"),
  };
  function goRoute(hash) {
    return function handleNavClick() {
      ROUTE_ACTIONS[hash]?.();
      if (window.location.hash !== hash) window.location.hash = hash;
    };
  }
  useEffect(() => {
    function applyHash() {
      const hash = window.location.hash;
      if (hash && !(hash in ROUTE_ACTIONS)) {
        setView("notfound");
        return;
      }
      ROUTE_ACTIONS[hash]?.();
    }
    window.addEventListener("hashchange", applyHash);
    applyHash(); // support deep links and page reloads on a non-root hash
    return () => window.removeEventListener("hashchange", applyHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Looks up a real uploaded garment photo for a given type/colour, if admin
  // has added one (Admin > Photos). `garmentPhotos` is a flat "typeId:colorId"
  // -> url map from the API. Falls back to null (renders the placeholder shape).
  function findGarmentPhoto(typeId, colorId) {
    if (colorId) {
      const direct = garmentPhotos[`${typeId}:${colorId}`];
      if (direct) return direct;
    }
    // No exact colour match (e.g. a product card with no colour picked yet) -
    // use any photo we have for this garment type so it's not totally blank.
    const anyForType = Object.keys(garmentPhotos).find((k) => k.startsWith(`${typeId}:`));
    return anyForType ? garmentPhotos[anyForType] : null;
  }

  // Load real products + designs from the API. If the API is unreachable
  // (e.g. still deploying), silently fall back to the built-in sample data
  // so the storefront never looks broken to a visitor.
  useEffect(() => {
    if (!apiBaseUrl) return;
    fetch(`${apiBaseUrl}/api/products`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && data.length && setProducts(data))
      .catch(() => setApiError(true))
      .finally(() => setProductsLoading(false));

    fetch(`${apiBaseUrl}/api/designs`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length) {
          // Any design with a real uploaded image should render that image,
          // not a placeholder pattern. Only fall back to the local decorative
          // patterns for designs that don't have a real image on file.
          const withPatterns = data.map((d) => {
            if (d.imageUrl) return { ...d, pattern: "custom", image: d.imageUrl };
            const local = DESIGNS.find((x) => x.name === d.name);
            return { ...d, pattern: local?.pattern || "dots", text: local?.text };
          });
          setDesignsList(withPatterns);
        }
      })
      .catch(() => setApiError(true));

    fetch(`${apiBaseUrl}/api/coupons`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && data.length && setCoupons(data))
      .catch(() => {});

    fetch(`${apiBaseUrl}/api/garment-photos`)
      .then((r) => r.json())
      .then((data) => data && typeof data === "object" && setGarmentPhotos(data))
      .catch(() => {});
  }, [apiBaseUrl]);

  function toggleWishlist(productId) {
    setWishlist((prev) => {
      const next = new Set(prev);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      return next;
    });
  }

  function handleDesignUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const newDesign = {
        id: "u" + Date.now(),
        name: file.name.replace(/\.[^/.]+$/, "").slice(0, 24) || "My design",
        tag: "Your upload",
        pattern: "custom",
        image: reader.result,
        pending: true,
      };
      setDesignsList((d) => [newDesign, ...d]);
      setSelDesign(newDesign);
      setActiveProduct((p) => p || products[0]);
      setSelColor(GARMENT_COLORS[1]);
      setSelSize("M");
      setView("customize");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const [deliveryType, setDeliveryType] = useState("stall");
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [address, setAddress] = useState({ line: "", pincode: "" });
  const [errors, setErrors] = useState({});
  const [contactConfirmed, setContactConfirmed] = useState(false);
  const [payNow, setPayNow] = useState(true);

  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null); // { code, discountAmount, label }
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const [order, setOrder] = useState(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Cancellation window: freely cancellable before printing starts. Once
  // printing has begun, a PAID (online) order is locked in - money's moved
  // and the print is already committed. An UNPAID (pay-at-pickup) order can
  // still be cancelled after that point since nothing's been charged, but
  // it needs a reason since production may already be underway.
  function canCustomerCancel() {
    if (!order || order.cancelled) return false;
    if (statusIndex >= STEPS.length - 1) return false; // already delivered
    const printingStarted = statusIndex >= 1;
    if (!printingStarted) return true;
    return order.paid === false;
  }

  async function submitCancelOrder() {
    if (!order || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      if (apiBaseUrl) {
        await fetch(`${apiBaseUrl}/api/orders/${order.id}/cancel`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: cancelReason.trim(), cancelledBy: "customer" }),
        }).catch(() => {});
      }
      setOrder((o) => ({ ...o, cancelled: true, cancelReason: cancelReason.trim(), cancelledBy: "customer" }));
      setShowCancelForm(false);
      setCancelReason("");
    } finally {
      setCancelling(false);
    }
  }

  // Poll the real order status from the API instead of a fake local timer.
  // This is also how a staff-side cancellation reaches the customer here on
  // the website - once both apps point at the same backend, staff cancelling
  // an order server-side shows up on this page within one poll cycle.
  // (Real SMS delivery on top of that needs a telephony/SMS provider wired
  // into the backend - out of scope for this frontend-only demo.)
  useEffect(() => {
    if (view !== "tracking" || !order || !apiBaseUrl) return;
    const poll = setInterval(() => {
      fetch(`${apiBaseUrl}/api/orders/track/${order.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.cancelled) {
            setOrder((o) => ({ ...o, cancelled: true, cancelReason: data.cancelReason, cancelledBy: data.cancelledBy || "staff" }));
            return;
          }
          const idx = STEPS.findIndex((s) => s.key === (data.status || "").toLowerCase());
          if (idx >= 0) setStatusIndex(idx);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(poll);
  }, [view, order, apiBaseUrl]);

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const [pincodeInfo, setPincodeInfo] = useState({ status: "idle" });

  useEffect(() => {
    if (address.pincode.length !== 6) {
      setPincodeInfo({ status: "idle" });
      return;
    }
    if (!apiBaseUrl) {
      const km = PINCODE_TABLE[address.pincode];
      setPincodeInfo(km === undefined ? { status: "unknown" } : { status: "known", km, fee: km <= 5 ? 100 : 200 });
      return;
    }
    fetch(`${apiBaseUrl}/api/zones/${address.pincode}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((zone) => setPincodeInfo({ status: "known", km: zone.km, fee: zone.fee }))
      .catch(() => setPincodeInfo({ status: "unknown" }));
  }, [address.pincode, apiBaseUrl]);

  const deliveryFee = deliveryType === "home" && pincodeInfo.status === "known" ? pincodeInfo.fee : 0;
  const discountAmount = coupon?.discountAmount || 0;
  const grandTotal = Math.max(0, cartTotal - discountAmount) + deliveryFee;

  function openCustomize(product, presetColorId) {
    const colorId = presetColorId || cardColor[product.id] || firstInStockColor(product);
    const color = GARMENT_COLORS.find((c) => c.id === colorId) || GARMENT_COLORS[1];
    setActiveProduct(product);
    setSelColor(color);
    setSelDesign(designsList[0] || null);
    setSelSize(firstInStockSize(product, color.id) || SIZES[0]);
    setView("customize");
  }

  function goToCategory(tile) {
    setTypeFilter(tile.typeFilter);
    setCatFilter(tile.catFilter);
    setNewOnly(false);
    setView("shop");
    requestAnimationFrame(() => {
      document.getElementById("shop-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function addToCart() {
    setCart((c) => [
      ...c,
      {
        cartId: Date.now(),
        productId: activeProduct.id,
        name: activeProduct.name,
        type: activeProduct.type,
        color: selColor,
        size: selSize,
        design: selDesign,
        price: activeProduct.price,
        qty: 1,
      },
    ]);
    setCartOpen(true);
    setView("shop");
  }

  function updateQty(cartId, delta) {
    setCart((c) =>
      c.map((i) => {
        if (i.cartId !== cartId) return i;
        const product = products.find((p) => p.id === (i.productId || i.name));
        const cap = product ? stockFor(product, i.color?.id, i.size) : 99;
        return { ...i, qty: Math.max(1, Math.min(cap || 1, i.qty + delta)) };
      })
    );
  }
  function removeItem(cartId) {
    setCart((c) => c.filter((i) => i.cartId !== cartId));
  }

  // Deducts each placed cart item from its product/colour/size stock cell.
  // Runs client-side against local `products` state (this demo has no
  // backend to hold the authoritative count); a real deployment would do
  // this as a DB transaction on the order-create endpoint instead, so two
  // shoppers can't both win the last unit.
  function applyStockForOrder(items) {
    setProducts((prev) =>
      prev.map((p) => {
        const forThisProduct = items.filter((i) => (i.productId || i.name) === p.id);
        if (!forThisProduct.length || !p.variants) return p;
        const nextVariants = { ...p.variants };
        forThisProduct.forEach((item) => {
          const colorId = item.color?.id;
          const size = item.size;
          if (!colorId || !nextVariants[colorId]) return;
          const current = nextVariants[colorId][size] ?? 0;
          nextVariants[colorId] = { ...nextVariants[colorId], [size]: Math.max(0, current - item.qty) };
        });
        return { ...p, variants: nextVariants };
      })
    );
  }

  function validateContact() {
    const e = {};
    if (!contact.name.trim()) e.name = "Name required";
    if (!/^[6-9]\d{9}$/.test(contact.phone)) e.phone = "Enter a valid 10-digit mobile number";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) e.email = "Enter a valid email";
    if (deliveryType === "home") {
      if (!address.line.trim()) e.line = "Address required";
      if (!/^\d{6}$/.test(address.pincode)) e.pincode = "Enter a 6-digit pincode";
    }
    setErrors(e);
    if (Object.keys(e).length === 0) setContactConfirmed(true);
  }

  async function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setApplyingCoupon(true);
    setCouponError("");
    try {
      if (apiBaseUrl) {
        const res = await fetch(`${apiBaseUrl}/api/coupons/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, subtotal: cartTotal }),
        });
        const data = await res.json();
        if (!res.ok || !data.valid) throw new Error(data.error || "Invalid code");
        setCoupon({ code: data.code, discountAmount: data.discountAmount, label: data.label });
      } else {
        const result = validateCouponLocal(code, cartTotal);
        if (!result.valid) throw new Error(result.error);
        setCoupon(result);
      }
    } catch (err) {
      setCoupon(null);
      setCouponError(err.message || "Invalid code");
    } finally {
      setApplyingCoupon(false);
    }
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponCode("");
    setCouponError("");
  }

  // Submits the order to our API, optionally attaching proof-of-payment
  // fields once Razorpay has confirmed the payment succeeded.
  async function submitOrder(paymentFields = {}) {
    const res = await fetch(`${apiBaseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: contact.name,
        customerPhone: contact.phone,
        customerEmail: contact.email,
        deliveryType: deliveryType.toUpperCase(),
        addressLine: address.line || undefined,
        pincode: address.pincode || undefined,
        discountCode: coupon?.code || undefined,
        items: cart.map((i) => ({
          productId: i.productId || i.name, // fallback if product id wasn't tracked through customize flow
          designId: i.design?.id || "custom",
          color: i.color.name,
          size: i.size,
          qty: i.qty,
          price: i.price,
        })),
        ...paymentFields,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Could not place order");
    }
    const created = await res.json();
    setOrder({ ...created, id: created.code });
    setStatusIndex(0);
    applyStockForOrder(cart);
    setCart([]);
    setContactConfirmed(false);
    setContact({ name: "", phone: "", email: "" });
    setAddress({ line: "", pincode: "" });
    removeCoupon();
    setView("tracking");
  }

  async function placeOrder() {
    setOrderError("");

    // Re-check stock right before placing - it's the live source of truth
    // for cart contents and could have sold out (another order, an admin
    // adjustment) since these items were added.
    for (const item of cart) {
      const product = products.find((p) => p.id === (item.productId || item.name));
      const available = product ? stockFor(product, item.color?.id, item.size) : 0;
      if (available < item.qty) {
        setOrderError(`${item.name} (${item.color.name}, ${item.size}) just sold out. Remove it from your cart to continue.`);
        return;
      }
    }

    // No live API configured (e.g. running purely locally), fall back to
    // the original client-only mock order so the demo still works.
    if (!apiBaseUrl) {
      const id = "JZ-2026-" + Math.floor(1000 + Math.random() * 9000);
      setOrder({
        id, items: cart, deliveryType, total: grandTotal, deliveryFee, contact, address,
        paid: deliveryType === "home" ? true : payNow, placedAt: new Date(),
        discountAmount, discountCode: coupon?.code,
      });
      setStatusIndex(0);
      applyStockForOrder(cart);
      setCart([]);
      setContactConfirmed(false);
      setContact({ name: "", phone: "", email: "" });
      setAddress({ line: "", pincode: "" });
      removeCoupon();
      setView("tracking");
      return;
    }

    // Home delivery always requires payment. Stall pickup pays now only if
    // the customer chose that toggle, otherwise it's created unpaid and
    // settled at pickup.
    const needsPayment = deliveryType === "home" || (deliveryType === "stall" && payNow);

    setPlacingOrder(true);
    try {
      if (!needsPayment) {
        await submitOrder();
        return;
      }

      // 1. Ask our backend to create a Razorpay order for this exact amount.
      const orderRes = await fetch(`${apiBaseUrl}/api/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: grandTotal }),
      });
      if (!orderRes.ok) throw new Error("Could not start payment. Please try again.");
      const razorpayOrder = await orderRes.json();

      // 2. Open Razorpay's checkout modal.
      if (typeof window.Razorpay === "undefined") {
        throw new Error("Payment system failed to load. Please refresh and try again.");
      }

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: razorpayOrder.keyId,
          order_id: razorpayOrder.orderId,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          name: "ATHE",
          description: `Order for ${contact.name}`,
          prefill: { name: contact.name, email: contact.email, contact: contact.phone },
          theme: { color: "#2451FF" },
          handler: async (response) => {
            try {
              await submitOrder({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error("Payment was cancelled.")),
          },
        });
        rzp.on("payment.failed", () => reject(new Error("Payment failed. Please try again.")));
        rzp.open();
      });
    } catch (err) {
      setOrderError(typeof err.message === "string" ? err.message : "Something went wrong placing your order.");
    } finally {
      setPlacingOrder(false);
    }
  }

  const filteredProducts = products.filter(
    (p) => (typeFilter === "all" || p.type === typeFilter) && (catFilter === "all" || p.category === catFilter) && (!newOnly || p.isNew)
  );

  const heroCoupon = coupons[0];

  return (
    <div style={{ background: COLORS.canvas, minHeight: "100vh", fontFamily: FONTS.body, color: COLORS.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');

        :root {
          --canvas: #F5F5F3;
          --surface: #FFFFFF;
          --surface-alt: #EEEEEC;
          --ink: #131313;
          --ink-soft: #5B5B58;
          --on-dark: #FFFFFF;
          --on-dark-soft: rgba(255,255,255,0.62);
          --accent: #2451FF;
          --accent-soft: #E7ECFF;
          --on-accent: #FFFFFF;
          --line: #E2E2DE;
          --line-on-dark: rgba(255,255,255,0.14);
          --good: #16A34A;
          --good-soft: #DCFCE7;
          --chrome: #131313;
          --on-chrome: #FFFFFF;
          --on-chrome-soft: rgba(255,255,255,0.62);
        }
        /* System preference applies only while no explicit choice is stored (no data-theme attr). */
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) {
            --canvas: #101012;
            --surface: #17181B;
            --surface-alt: #1E2024;
            --ink: #F4F4F2;
            --ink-soft: #A5A6A8;
            --on-dark: #0E0E10;
            --on-dark-soft: rgba(14,14,16,0.6);
            --accent: #5B7FFF;
            --accent-soft: rgba(91,127,255,0.16);
            --on-accent: #0E0E10;
            --line: #2A2C31;
            --line-on-dark: rgba(0,0,0,0.2);
            --good: #34D399;
            --good-soft: rgba(52,211,153,0.14);
            --chrome: #0B0B0D;
            --on-chrome: #FFFFFF;
            --on-chrome-soft: rgba(255,255,255,0.62);
          }
        }
        /* Explicit "dark" choice always wins, regardless of OS preference. */
        :root[data-theme="dark"] {
          --canvas: #101012;
          --surface: #17181B;
          --surface-alt: #1E2024;
          --ink: #F4F4F2;
          --ink-soft: #A5A6A8;
          --on-dark: #0E0E10;
          --on-dark-soft: rgba(14,14,16,0.6);
          --accent: #5B7FFF;
          --accent-soft: rgba(91,127,255,0.16);
          --on-accent: #0E0E10;
          --line: #2A2C31;
          --line-on-dark: rgba(0,0,0,0.2);
          --good: #34D399;
          --good-soft: rgba(52,211,153,0.14);
          --chrome: #0B0B0D;
          --on-chrome: #FFFFFF;
          --on-chrome-soft: rgba(255,255,255,0.62);
        }

        @keyframes athePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        * { box-sizing: border-box; }
        button { cursor: pointer; font-family: inherit; }
        input, textarea { font-family: inherit; }

        @keyframes atheFloatA { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-18px, 22px) scale(1.06); } }
        @keyframes atheFloatB { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(22px, -18px) scale(1.08); } }
        @keyframes atheSpinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes atheMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      {/* ---------- Floating header ---------- */}
      <div style={{ position: "sticky", top: 12, zIndex: 40, padding: "0 12px" }}>
        <header style={{
          maxWidth: 1120, margin: "0 auto", background: "var(--surface)", backdropFilter: "blur(14px)",
          border: `1px solid ${COLORS.line}`, borderRadius: 999, boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "8px 10px 8px 14px", height: 56 }}>
            {/* Left: notification + cart */}
            <div className="flex items-center gap-1" style={{ justifySelf: "start" }}>
              <div style={{ position: "relative" }}>
                <button onClick={() => { setNotifOpen((o) => !o); setMenuOpen(false); }} style={{ background: "none", border: "none", padding: 8, position: "relative" }}>
                  <Bell size={19} color={COLORS.ink} />
                  {NOTIFICATIONS.length > 0 && (
                    <span style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%", background: COLORS.accent }} />
                  )}
                </button>
                {notifOpen && (
                  <div style={{ position: "absolute", left: 0, top: 44, width: 260, background: "var(--surface)", border: `1px solid ${COLORS.line}`, borderRadius: 16, boxShadow: "0 12px 30px rgba(0,0,0,0.14)", padding: 8, zIndex: 50 }}>
                    {NOTIFICATIONS.length === 0 ? (
                      <div style={{ padding: "14px 10px", textAlign: "center", fontSize: 12, color: COLORS.inkSoft }}>No notifications yet.</div>
                    ) : (
                      NOTIFICATIONS.map((n) => (
                        <div key={n.id} style={{ padding: "8px 6px", borderBottom: `1px solid ${COLORS.line}` }}>
                          <div style={{ fontSize: 12.5, color: COLORS.ink }}>{n.text}</div>
                          <div style={{ fontSize: 10.5, color: COLORS.inkSoft, marginTop: 2 }}>{n.time}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setCartOpen(true)} style={{ background: "none", border: "none", padding: 8, position: "relative" }}>
                <ShoppingBag size={19} color={COLORS.ink} />
                {cart.length > 0 && (
                  <span style={{ position: "absolute", top: 2, right: 2, background: COLORS.accent, color: COLORS.onAccent, fontSize: 10, fontWeight: 700, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {cart.length}
                  </span>
                )}
              </button>
            </div>

            {/* Center: logo */}
            <NavLink href="#/home" onClick={goRoute("#/home")} style={{ display: "flex", alignItems: "center", justifySelf: "center" }}>
              <AtheWordmark size="sm" tone="dark" />
            </NavLink>

            {/* Right: nav (desktop) + menu toggle (mobile) */}
            <div className="flex items-center justify-end gap-2" style={{ justifySelf: "end" }}>
              <nav className="hidden md:flex items-center gap-6" style={{ fontSize: 13.5, fontWeight: 600, marginRight: 6 }}>
                <NavLink href="#/shop" onClick={goRoute("#/shop")} style={{ color: COLORS.inkSoft }}>Shop</NavLink>
                <NavLink href="#/tees" onClick={goRoute("#/tees")} style={{ color: COLORS.inkSoft }}>Tees</NavLink>
                <NavLink href="#/hoodies" onClick={goRoute("#/hoodies")} style={{ color: COLORS.inkSoft }}>Hoodies</NavLink>
                <NavLink href="#/track" onClick={goRoute("#/track")} style={{ color: COLORS.inkSoft }}>Track Order</NavLink>
                <NavLink href="#/about" onClick={goRoute("#/about")} style={{ color: COLORS.inkSoft }}>About</NavLink>
              </nav>
              <NavLink href="#/new" onClick={goRoute("#/new")} className="hidden md:block" style={{
                background: COLORS.accent, color: COLORS.onAccent,
                fontSize: 12.5, fontWeight: 700, padding: "7px 14px", borderRadius: 999, marginRight: 4, whiteSpace: "nowrap",
              }}>New Arrivals</NavLink>
              <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Click to change.`} title={themeLabel} style={{ background: "none", border: "none", padding: 8, display: "flex" }}>
                <ThemeIcon size={18} color={COLORS.ink} />
              </button>
              <button className="md:hidden" onClick={() => { setMenuOpen((o) => !o); setNotifOpen(false); }} style={{ background: "none", border: "none", padding: 8 }}>
                {menuOpen ? <X size={19} color={COLORS.ink} /> : <Menu size={19} color={COLORS.ink} />}
              </button>
            </div>
          </div>
        </header>

        {menuOpen && (
          <nav className="grid md:hidden" style={{
            maxWidth: 1120, margin: "8px auto 0", background: "var(--surface)", border: `1px solid ${COLORS.line}`,
            borderRadius: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.08)", padding: "10px 16px", gap: 2,
          }}>
            {[
              { label: "Shop", hash: "#/shop" },
              { label: "Tees", hash: "#/tees" },
              { label: "Hoodies", hash: "#/hoodies" },
              { label: "Track Order", hash: "#/track" },
              { label: "About", hash: "#/about" },
            ].map((item) => (
              <NavLink key={item.label} href={item.hash} onClick={() => { goRoute(item.hash)(); setMenuOpen(false); }} style={{
                color: COLORS.inkSoft, textAlign: "left",
                padding: "10px 4px", fontSize: 15, fontWeight: 600,
              }}>{item.label}</NavLink>
            ))}
            <NavLink href="#/new" onClick={() => { goRoute("#/new")(); setMenuOpen(false); }} style={{
              display: "flex", alignItems: "center", gap: 6, color: COLORS.accent, textAlign: "left",
              padding: "10px 4px", fontSize: 15, fontWeight: 700,
            }}>
              <Sparkles size={14} /> New Arrivals
            </NavLink>
          </nav>
        )}
      </div>

      {/* ---------- OFFLINE TAKEOVER ---------- */}
      {isOffline && <OfflineState onRetry={() => setIsOffline(!navigator.onLine)} />}

      {/* ---------- SHOP VIEW ---------- */}
      {!isOffline && view === "shop" && (
        <>
          {/* ---- Hero: asymmetric split, copy left / live design showcase right ---- */}
          <section style={{ padding: "40px 16px 8px", maxWidth: 1120, margin: "0 auto", position: "relative" }}>
            <GradientOrbs />
            <div className="grid md:grid-cols-[1.1fr_1fr] gap-8" style={{ position: "relative", alignItems: "center" }}>
              <Reveal>
                <h1 style={{
                  fontFamily: FONTS.display, fontWeight: 700, fontSize: "clamp(34px, 5vw, 56px)",
                  lineHeight: 1.03, letterSpacing: -1, margin: 0, color: COLORS.ink,
                }}>
                  Design it.<br />We press it in <span style={{ color: COLORS.accent }}>an hour.</span>
                </h1>
                <p style={{ fontSize: 15.5, color: COLORS.inkSoft, lineHeight: 1.6, marginTop: 16, maxWidth: "42ch" }}>
                  Pick a blank tee or hoodie, choose a design or upload your own, and walk out wearing it.
                </p>
                <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 24 }}>
                  <button onClick={() => document.getElementById("shop-grid")?.scrollIntoView({ behavior: "smooth" })} style={{
                    background: COLORS.ink, color: COLORS.onDark, border: "none", padding: "13px 24px", borderRadius: 999,
                    fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8,
                  }}>
                    Start designing <ArrowRight size={16} />
                  </button>
                  <label style={{
                    display: "flex", alignItems: "center", gap: 6, color: COLORS.ink, fontWeight: 600, fontSize: 13.5,
                    padding: "13px 18px", borderRadius: 999, border: `1px solid ${COLORS.line}`, cursor: "pointer",
                  }}>
                    <Upload size={15} /> Upload your art
                    <input type="file" accept="image/*" onChange={handleDesignUpload} style={{ display: "none" }} />
                  </label>
                </div>
              </Reveal>

              <Reveal delay={100}>
                <Tilt3DCard strength={6} twist={7}>
                  <div style={{
                    borderRadius: 20, padding: 20, background: COLORS.surface,
                    border: `1px solid ${COLORS.line}`, boxShadow: "0 2px 14px rgba(0,0,0,0.05)",
                    display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
                  }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                      <span style={{ fontFamily: FONTS.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: COLORS.accent, textTransform: "uppercase" }}>New drop</span>
                      <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 13, color: COLORS.ink }}>{designsList.length} design{designsList.length === 1 ? "" : "s"}</span>
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", minHeight: 260 }}>
                      {designsList.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "0 20px" }}>
                          <Sparkles size={24} color={COLORS.inkSoft} />
                          <p style={{ fontSize: 12.5, color: COLORS.inkSoft, marginTop: 10 }}>New designs land here soon. Upload your own to be first.</p>
                        </div>
                      ) : (
                        <div style={{
                          display: "flex", width: "70%", aspectRatio: "1/1.05",
                          transform: `translateX(-${heroSlide * 100}%)`,
                          transition: "transform 700ms cubic-bezier(0.65,0,0.35,1)",
                        }}>
                          {designsList.map((d) => (
                            <div key={d.id} style={{ flex: "0 0 100%", height: "100%" }}>
                              <GarmentPreview colorHex="#FBFAF6" design={d} type="tshirt" photoUrl={findGarmentPhoto("tshirt")} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
                      <Star size={13} color={COLORS.accent} fill={COLORS.accent} />
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.inkSoft }}>Every piece pressed to order</span>
                    </div>
                  </div>
                </Tilt3DCard>
              </Reveal>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ marginTop: 24, position: "relative" }}>
              <Reveal delay={140}>
                <BentoTile tone="tint" style={{ justifyContent: "space-between", minHeight: 110 }}>
                  <Clock size={18} color={COLORS.accent} />
                  <div>
                    <p style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 20 }}>~1 HR</p>
                    <p style={{ fontSize: 11, color: COLORS.inkSoft, fontWeight: 600 }}>Ready at the stall</p>
                  </div>
                </BentoTile>
              </Reveal>
              <Reveal delay={180}>
                <BentoTile tone="canvas" style={{ justifyContent: "space-between", minHeight: 110 }}>
                  <Zap size={18} color={COLORS.accent} />
                  <div>
                    <p style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 20 }}>{designsList.length} designs</p>
                    <p style={{ fontSize: 11, color: COLORS.inkSoft, fontWeight: 600 }}>New drops weekly</p>
                  </div>
                </BentoTile>
              </Reveal>
              <Reveal delay={220}>
                <BentoTile tone="canvas" style={{ justifyContent: "space-between", minHeight: 110 }}>
                  <ShieldCheck size={18} color={COLORS.accent} />
                  <div>
                    <p style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 14.5 }}>Secure checkout</p>
                    <p style={{ fontSize: 11, color: COLORS.inkSoft, fontWeight: 600 }}>Powered by Razorpay</p>
                  </div>
                </BentoTile>
              </Reveal>
              <Reveal delay={260}>
                <BentoTile tone="dark" hoverable={false} onClick={() => setView("tracking")} style={{
                  justifyContent: "space-between", minHeight: 110, cursor: "pointer",
                }}>
                  <Truck size={18} color={COLORS.onChrome} />
                  <div>
                    <p style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 14.5 }}>Track order</p>
                    <p style={{ fontSize: 11, color: COLORS.onChromeSoft, fontWeight: 600 }}>No login needed</p>
                  </div>
                </BentoTile>
              </Reveal>
            </div>
          </section>

          {/* ---- Marquee strip ---- */}
          <div style={{ padding: "22px 0", overflow: "hidden", position: "relative" }}>
            <div style={{ display: "flex", width: "max-content", animation: "atheMarquee 26s linear infinite" }}>
              {[0, 1].map((rep) => (
                <div key={rep} style={{ display: "flex", alignItems: "center", gap: 32, paddingRight: 32 }}>
                  {["Custom press studio", "Ready in about an hour at the stall", "240 GSM tees", "300 GSM hoodies", "Secure checkout", "New designs every week"].map((t) => (
                    <span key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: FONTS.mono, fontSize: 11.5, letterSpacing: 1, color: COLORS.inkSoft, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      <Sparkles size={12} color={COLORS.accent} /> {t}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* ---- Category + offers bento (compact) ---- */}
          <section style={{ padding: "4px 16px 4px", maxWidth: 1120, margin: "0 auto" }}>
            <Reveal>
              <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 18, color: COLORS.ink, marginBottom: 10 }}>Shop the drop</h2>
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-[92px]">
              {CATEGORY_TILES.map((tile, i) => {
                const Icon = tile.icon === "Shirt" ? Shirt : tile.icon === "Heart" ? Heart : Package;
                const wide = i === 0;
                return (
                  <Reveal key={tile.key} delay={i * 70} className={wide ? "col-span-2" : "col-span-1"} style={{ gridColumn: wide ? "span 2 / span 2" : "span 1 / span 1" }}>
                    <BentoTile tone={i === 0 ? "accent" : i === 1 ? "canvas" : "tint"} onClick={() => goToCategory(tile)} style={{ height: "100%", justifyContent: "center", padding: 14 }}>
                      <Icon size={16} color={i === 0 ? COLORS.onDark : COLORS.accent} style={{ position: "absolute", top: 12, right: 12 }} />
                      <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 15, color: i === 0 ? COLORS.onDark : COLORS.ink }}>{tile.title}</span>
                      <span style={{ fontSize: 10.5, color: i === 0 ? COLORS.onDarkSoft : COLORS.inkSoft, marginTop: 2 }}>{tile.subtitle}</span>
                    </BentoTile>
                  </Reveal>
                );
              })}

              {coupons.length > 0 && (
                <Reveal delay={CATEGORY_TILES.length * 70} className="col-span-2" style={{ gridColumn: "span 2 / span 2" }}>
                  <BentoTile tone="canvas" hoverable={false} style={{ height: "100%", justifyContent: "center", padding: 14 }}>
                    <div className="flex items-center gap-2" style={{ color: COLORS.accent, marginBottom: 6 }}>
                      <Tag size={13} />
                      <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 11.5, color: COLORS.ink }}>Current offers</span>
                    </div>
                    <div className="flex items-center gap-2" style={{ overflowX: "auto", paddingBottom: 2 }}>
                      {coupons.map((c) => <CouponChip key={c.code} code={c.code} label={c.label} />)}
                    </div>
                  </BentoTile>
                </Reveal>
              )}

              <Reveal delay={(CATEGORY_TILES.length + 1) * 70} className="col-span-2" style={{ gridColumn: "span 2 / span 2" }}>
                <label style={{ display: "block", height: "100%", cursor: "pointer" }}>
                  <BentoTile tone="dark" hoverable={false} style={{
                    height: "100%", justifyContent: "space-between", flexDirection: "row", alignItems: "center", padding: 14,
                    border: "1.5px dashed rgba(255,255,255,0.24)",
                  }}>
                    <div>
                      <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 13.5, color: COLORS.onChrome }}>Got your own art?</span>
                      <p style={{ fontSize: 10.5, color: COLORS.onChromeSoft, marginTop: 2 }}>Upload it, we press it fresh</p>
                    </div>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Upload size={14} color={COLORS.onChrome} />
                    </div>
                  </BentoTile>
                  <input type="file" accept="image/*" onChange={handleDesignUpload} style={{ display: "none" }} />
                </label>
              </Reveal>
            </div>
          </section>

          {/* ---- Filters ---- */}
          <section id="shop-grid" style={{ padding: "44px 16px 0", maxWidth: 1120, margin: "0 auto 12px", scrollMarginTop: 96 }}>
            <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 16 }}>
              <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.ink }}>{newOnly ? "New arrivals" : "All products"}</h2>
              <div className="flex flex-wrap items-center gap-2">
                {newOnly && (
                  <button onClick={() => setNewOnly(false)} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                    border: "none", background: COLORS.accent, color: COLORS.onAccent,
                  }}>
                    New arrivals only <X size={13} />
                  </button>
                )}
                {["all", "tshirt", "hoodie"].map((t) => (
                  <button key={t} onClick={() => { setTypeFilter(t); setNewOnly(false); }} style={{
                    padding: "7px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                    border: `1px solid ${typeFilter === t ? COLORS.ink : COLORS.line}`, background: typeFilter === t ? COLORS.ink : "transparent",
                    color: typeFilter === t ? COLORS.onDark : COLORS.ink, transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
                  }}>
                    {t === "all" ? "All" : t === "tshirt" ? "T-Shirts" : "Hoodies"}
                  </button>
                ))}
                <span style={{ width: 1, background: COLORS.line, margin: "0 4px" }} />
                {["all", "men", "women", "unisex"].map((c) => (
                  <button key={c} onClick={() => { setCatFilter(c); setNewOnly(false); }} style={{
                    padding: "7px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                    border: `1px solid ${catFilter === c ? COLORS.accent : COLORS.line}`, background: catFilter === c ? COLORS.accentSoft : "transparent",
                    color: COLORS.ink, transition: "background 150ms ease, border-color 150ms ease",
                  }}>
                    {c === "all" ? "Everyone" : c[0].toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ---- Product grid ---- */}
          <section style={{ padding: "10px 16px 70px", maxWidth: 1120, margin: "0 auto" }}>
            {productsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Nothing in the shop yet"
                message="New products land here as soon as they're added. Check back soon."
              />
            ) : filteredProducts.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No products match these filters"
                message="Try a different category, or clear your filters to see everything."
                actionLabel="Clear filters"
                onAction={() => { setTypeFilter("all"); setCatFilter("all"); setNewOnly(false); }}
              />
            ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {filteredProducts.map((p, idx) => {
                // Prefer a design whose audience matches this product's category
                // (or one marked "all"), instead of just cycling blindly.
                const matchingDesigns = designsList.filter((d) => !d.audience || d.audience === "all" || d.audience === p.category);
                const pool = matchingDesigns.length ? matchingDesigns : designsList;
                const cardDesign = pool[idx % pool.length] || DESIGNS[0];
                const activeColorId = cardColor[p.id] || firstInStockColor(p);
                const activeColor = GARMENT_COLORS.find((c) => c.id === activeColorId) || GARMENT_COLORS[0];
                const outOfStock = productTotalStock(p) === 0;
                return (
                <Reveal key={p.id} delay={(idx % 6) * 60}>
                <TiltCard>
                  <div style={{ position: "relative" }}>
                    {p.isNew && !outOfStock && (
                      <span style={{
                        position: "absolute", top: 6, left: 6, zIndex: 2, fontFamily: FONTS.mono, fontSize: 9.5, fontWeight: 700,
                        letterSpacing: 0.5, color: COLORS.onAccent, background: COLORS.accent,
                        padding: "4px 8px", borderRadius: 999,
                      }}>NEW</span>
                    )}
                    {outOfStock && (
                      <span style={{
                        position: "absolute", top: 6, left: 6, zIndex: 2, fontFamily: FONTS.mono, fontSize: 9.5, fontWeight: 700,
                        letterSpacing: 0.5, color: COLORS.onDark, background: COLORS.inkSoft,
                        padding: "4px 8px", borderRadius: 999,
                      }}>OUT OF STOCK</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWishlist(p.id); }}
                      aria-label={wishlist.has(p.id) ? "Remove from wishlist" : "Add to wishlist"}
                      style={{
                        position: "absolute", top: 6, right: 6, zIndex: 2, background: "rgba(255,255,255,0.9)",
                        backdropFilter: "blur(4px)", border: "none", borderRadius: "50%", width: 30, height: 30,
                        display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                      }}
                    >
                      <Heart size={14} color={wishlist.has(p.id) ? COLORS.accent : "#B8AFA8"} fill={wishlist.has(p.id) ? COLORS.accent : "none"} />
                    </button>
                    <GarmentPreview colorHex={activeColor.hex} design={cardDesign} type={p.type} photoUrl={findGarmentPhoto(p.type, activeColor.id)} />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 10, fontFamily: FONTS.mono, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>{p.category}</p>
                    <p style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 16, marginTop: 2 }}>{p.name}</p>
                    <p style={{ fontSize: 13.5, color: COLORS.inkSoft, marginBottom: 8 }}>₹{p.price}</p>

                    {/* Color swatches - pick right on the card, no need to open Customize first */}
                    <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 10 }}>
                      {GARMENT_COLORS.map((c) => {
                        const has = colorTotalStock(p, c.id) > 0;
                        const selected = activeColorId === c.id;
                        return (
                          <button
                            key={c.id}
                            disabled={!has}
                            onClick={(e) => { e.stopPropagation(); setCardColor((m) => ({ ...m, [p.id]: c.id })); }}
                            title={has ? c.name : `${c.name} - out of stock`}
                            aria-label={c.name}
                            style={{
                              width: 18, height: 18, borderRadius: "50%", background: c.hex, padding: 0, position: "relative",
                              border: selected ? `2px solid ${COLORS.accent}` : c.border ? `1px solid ${COLORS.line}` : "1px solid transparent",
                              outline: selected ? `1px solid ${COLORS.accent}` : "none", outlineOffset: 1,
                              opacity: has ? 1 : 0.3, cursor: has ? "pointer" : "not-allowed",
                            }}
                          >
                            {!has && <span style={{ position: "absolute", inset: 0, background: `linear-gradient(45deg, transparent 46%, ${COLORS.ink} 48%, ${COLORS.ink} 52%, transparent 54%)`, borderRadius: "50%" }} />}
                          </button>
                        );
                      })}
                    </div>

                    {heroCoupon && !outOfStock && (
                      <p style={{ fontSize: 10.5, color: COLORS.good, fontWeight: 600, marginBottom: 10 }}>
                        Use {heroCoupon.code} at checkout
                      </p>
                    )}
                    <button disabled={outOfStock} onClick={() => openCustomize(p, activeColorId)} style={{
                      background: outOfStock ? COLORS.surfaceAlt : COLORS.ink, color: outOfStock ? COLORS.inkSoft : COLORS.onDark, border: "none", width: "100%", padding: "10px 0", borderRadius: 10,
                      fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      marginTop: heroCoupon && !outOfStock ? 0 : 6, transition: "background 150ms ease", cursor: outOfStock ? "not-allowed" : "pointer",
                    }}
                      onMouseEnter={(e) => { if (!outOfStock) e.currentTarget.style.background = "#000000"; }}
                      onMouseLeave={(e) => { if (!outOfStock) e.currentTarget.style.background = COLORS.ink; }}
                    >
                      {outOfStock ? "Out of stock" : <>Customize <ChevronRight size={14} /></>}
                    </button>
                  </div>
                </TiltCard>
                </Reveal>
                );
              })}
            </div>
            )}
          </section>
        </>
      )}

      {/* ---------- CUSTOMIZE VIEW ---------- */}
      {!isOffline && view === "customize" && activeProduct && (
        <section style={{ padding: "16px 16px 130px", maxWidth: 1020, margin: "0 auto" }}>
          <button onClick={() => setView("shop")} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: COLORS.ink, marginBottom: 18 }}>
            <ArrowLeft size={16} /> Back to shop
          </button>
          <div className="grid md:grid-cols-2 gap-5">
            <BentoTile tone="white" hoverable={false} style={{ padding: 26 }}>
              <GarmentPreview colorHex={selColor.hex} design={selDesign} type={activeProduct.type} photoUrl={findGarmentPhoto(activeProduct.type, selColor.id)} />
              <p style={{ textAlign: "center", fontSize: 12.5, color: COLORS.inkSoft, marginTop: 14 }}>
                {activeProduct.name} · {selColor.name}{selDesign ? ` · ${selDesign.name}` : " · No design selected"}
              </p>
            </BentoTile>
            <div className="grid gap-4">
              <div>
                <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.ink, marginBottom: 4 }}>{activeProduct.name}</h2>
                <p style={{ fontSize: 16, fontWeight: 700 }}>₹{activeProduct.price}</p>
              </div>

              <BentoTile tone="canvas" hoverable={false} style={{ padding: 18 }}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, marginBottom: 10 }}>COLOUR · {selColor.name}</p>
                <div className="flex gap-2 flex-wrap">
                  {GARMENT_COLORS.map((c) => {
                    const has = colorTotalStock(activeProduct, c.id) > 0;
                    return (
                      <button key={c.id} disabled={!has} title={has ? c.name : `${c.name} - out of stock`} style={{
                        width: 32, height: 32, borderRadius: "50%", background: c.hex, position: "relative",
                        border: selColor.id === c.id ? `2px solid ${COLORS.accent}` : `1px solid ${COLORS.line}`,
                        outline: selColor.id === c.id ? `2px solid ${COLORS.accent}` : "none", outlineOffset: 2,
                        opacity: has ? 1 : 0.3, cursor: has ? "pointer" : "not-allowed",
                      }}
                        onClick={() => {
                          setSelColor(c);
                          // The size that was selected might not exist in the new color -
                          // land on its first in-stock size instead of a silently-invalid pick.
                          if (stockFor(activeProduct, c.id, selSize) <= 0) {
                            setSelSize(firstInStockSize(activeProduct, c.id) || SIZES[0]);
                          }
                        }}
                      >
                        {!has && <span style={{ position: "absolute", inset: 0, background: `linear-gradient(45deg, transparent 46%, ${COLORS.ink} 48%, ${COLORS.ink} 52%, transparent 54%)`, borderRadius: "50%" }} />}
                      </button>
                    );
                  })}
                </div>
              </BentoTile>

              <BentoTile tone="canvas" hoverable={false} style={{ padding: 18 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>SIZE</p>
                  <button onClick={() => setShowSizeGuide(true)} style={{ background: "none", border: "none", fontSize: 11.5, fontWeight: 700, color: COLORS.accent, display: "flex", alignItems: "center", gap: 4 }}>
                    <Ruler size={12} /> Size guide
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {SIZES.map((s) => {
                    const units = stockFor(activeProduct, selColor.id, s);
                    const has = units > 0;
                    return (
                      <button key={s} disabled={!has} onClick={() => setSelSize(s)} style={{
                        width: 46, height: 44, borderRadius: 10, fontSize: 13, fontWeight: 600,
                        border: `1px solid ${selSize === s ? COLORS.ink : COLORS.line}`,
                        background: selSize === s ? COLORS.ink : COLORS.surface, color: has ? (selSize === s ? COLORS.onDark : COLORS.ink) : COLORS.inkSoft,
                        opacity: has ? 1 : 0.45, cursor: has ? "pointer" : "not-allowed", textDecoration: has ? "none" : "line-through",
                      }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
                {SIZES.every((s) => stockFor(activeProduct, selColor.id, s) <= 0) ? (
                  <p style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 10 }}>All sizes are out of stock in {selColor.name}. Try another colour.</p>
                ) : stockFor(activeProduct, selColor.id, selSize) > 0 && stockFor(activeProduct, selColor.id, selSize) <= 3 ? (
                  <p style={{ fontSize: 11.5, color: COLORS.accent, fontWeight: 600, marginTop: 10 }}>Only {stockFor(activeProduct, selColor.id, selSize)} left in {selColor.name}, size {selSize}.</p>
                ) : null}
              </BentoTile>

              <BentoTile tone="canvas" hoverable={false} style={{ padding: 18 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>DESIGN</p>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.accent, cursor: "pointer" }}>
                    + Upload your own
                    <input type="file" accept="image/*" onChange={handleDesignUpload} style={{ display: "none" }} />
                  </label>
                </div>
                {designsList.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 10px" }}>
                    <p style={{ fontSize: 12.5, color: COLORS.inkSoft }}>No designs in the gallery yet. Upload your own above to get started.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {designsList.map((d) => (
                      <button key={d.id} onClick={() => setSelDesign(d)} style={{
                        background: COLORS.surface, border: selDesign?.id === d.id ? `2px solid ${COLORS.accent}` : `1px solid ${COLORS.line}`,
                        borderRadius: 12, padding: 6, textAlign: "left", position: "relative",
                      }}>
                        <DesignPatch design={d} size={70} />
                        <p style={{ fontSize: 10.5, fontWeight: 700, marginTop: 5 }}>{d.name}</p>
                        <p style={{ fontSize: 9.5, color: d.pending ? COLORS.accent : COLORS.inkSoft }}>{d.pending ? "Pending review" : d.tag}</p>
                      </button>
                    ))}
                  </div>
                )}
                {designsList.some((d) => d.pending) && (
                  <p style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 8 }}>
                    Your upload prints on this order right away. It'll also join our public design gallery once we review it.
                  </p>
                )}
              </BentoTile>
            </div>
          </div>

          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--surface)", borderTop: `1px solid ${COLORS.line}`, padding: 14 }}>
            <div className="flex items-center justify-between" style={{ maxWidth: 1020, margin: "0 auto" }}>
              <span style={{ fontWeight: 700 }}>₹{activeProduct.price}</span>
              {(() => {
                const outOfStock = stockFor(activeProduct, selColor.id, selSize) <= 0;
                const blocked = outOfStock || !selDesign;
                return (
                  <button
                    disabled={blocked}
                    onClick={addToCart}
                    style={{
                      background: blocked ? COLORS.surfaceAlt : COLORS.accent,
                      color: blocked ? COLORS.inkSoft : COLORS.onAccent, border: "none",
                      padding: "12px 28px", borderRadius: 999, fontWeight: 700, fontSize: 14,
                      cursor: blocked ? "not-allowed" : "pointer",
                    }}>
                    {outOfStock ? "Out of stock" : !selDesign ? "Choose a design first" : "Add to cart"}
                  </button>
                );
              })()}
            </div>
          </div>

          {/* ---- Size guide modal ---- */}
          {showSizeGuide && (
            <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
              <div onClick={() => setShowSizeGuide(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
              <div style={{ position: "relative", background: "var(--surface)", borderRadius: 20, padding: 24, width: "100%", maxWidth: 420, boxShadow: "0 30px 60px rgba(0,0,0,0.3)" }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
                  <h3 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 18, color: COLORS.ink }}>Size guide</h3>
                  <button onClick={() => setShowSizeGuide(false)} style={{ background: "none", border: "none" }}><X size={18} color={COLORS.ink} /></button>
                </div>
                <p style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 14 }}>Measurements in inches, laid flat. {activeProduct.type === "hoodie" ? "Hoodie" : "T-shirt"} fit.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.inkSoft, paddingBottom: 8, borderBottom: `1px solid ${COLORS.line}` }}>SIZE</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.inkSoft, paddingBottom: 8, borderBottom: `1px solid ${COLORS.line}`, textAlign: "right" }}>CHEST</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.inkSoft, paddingBottom: 8, borderBottom: `1px solid ${COLORS.line}`, textAlign: "right" }}>LENGTH</div>
                  {SIZE_CHART[activeProduct.type].map((row) => (
                    <React.Fragment key={row.size}>
                      <div style={{ fontSize: 13, fontWeight: row.size === selSize ? 700 : 500, color: row.size === selSize ? COLORS.accent : COLORS.ink, padding: "9px 0", borderBottom: `1px solid ${COLORS.line}` }}>{row.size}</div>
                      <div style={{ fontSize: 13, color: COLORS.inkSoft, padding: "9px 0", borderBottom: `1px solid ${COLORS.line}`, textAlign: "right" }}>{row.chest}"</div>
                      <div style={{ fontSize: 13, color: COLORS.inkSoft, padding: "9px 0", borderBottom: `1px solid ${COLORS.line}`, textAlign: "right" }}>{row.length}"</div>
                    </React.Fragment>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 14 }}>Between sizes? Size up for a relaxed fit, true-to-size otherwise.</p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ---------- ABOUT / PRIVACY / TERMS / REFUNDS ---------- */}
      {!isOffline && ["about", "privacy", "terms", "refunds"].includes(view) && (
        <section style={{ padding: "20px 16px 80px", maxWidth: 720, margin: "0 auto" }}>
          <button onClick={() => setView("shop")} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: COLORS.ink, marginBottom: 18 }}>
            <ArrowLeft size={16} /> Back
          </button>
          {view === "about" && (
            <>
              <div style={{ marginBottom: 28 }}>
                <AtheWordmark size="lg" tone="dark" />
              </div>
              <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 26, color: COLORS.ink, marginBottom: 14 }}>About ATHE</h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: COLORS.inkSoft }}>
                Athe is a custom-press streetwear studio. Pick a blank tee or hoodie, choose a design from our
                rotating gallery (or upload your own), and we press it fresh in front of you. Stall pickups are
                usually ready inside an hour, and home deliveries are printed fresh and dispatched right after, so
                timing depends on distance. New designs land regularly, and customer uploads join the gallery once reviewed.
              </p>
            </>
          )}
          {view === "privacy" && (
            <>
              <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 26, color: COLORS.ink, marginBottom: 14 }}>Privacy policy</h2>
              <p style={{ fontSize: 11, color: COLORS.inkSoft, marginBottom: 18 }}>Last updated: August 2026</p>
              <PolicyBlock title="Who we are">
                This Website is operated by ATHE, based at 51B, Bengaluru, Karnataka, India.
              </PolicyBlock>
              <PolicyBlock title="Information we collect">
                When you browse, customize a design, or place an order, we collect your name, phone number, email
                address, delivery address and pincode (for home delivery), your order details, any custom design
                images you upload for printing, and basic technical data like IP address and browser type.
                Payment card details are handled directly by our payment processor and never touch our servers.
              </PolicyBlock>
              <PolicyBlock title="How we use it">
                To process and fulfil your orders, contact you about order status, respond to support requests,
                improve the site, and meet our legal and tax obligations under Indian law. We never sell your
                personal information to third parties.
              </PolicyBlock>
              <PolicyBlock title="Who we share it with">
                Delivery partners (to deliver your order), our payment processor (to complete your transaction),
                and Amazon Web Services (which securely hosts our systems and stores uploaded design files).
              </PolicyBlock>
              <PolicyBlock title="Your rights">
                You can ask us for a copy of the personal data we hold about you, ask us to correct it, or ask us
                to delete it (subject to records we're legally required to keep, e.g. for tax purposes). Contact
                us at support@athe.com to do any of this.
              </PolicyBlock>
              <PolicyBlock title="Cookies">
                We may use cookies to keep you logged in and remember your cart. You can control cookies through
                your browser settings.
              </PolicyBlock>
              <PolicyBlock title="Contact">
                ATHE · 51B, Bengaluru, Karnataka<br />support@athe.com · +91 78926 28601
              </PolicyBlock>
            </>
          )}
          {view === "terms" && (
            <>
              <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 26, color: COLORS.ink, marginBottom: 14 }}>Terms of service</h2>
              <p style={{ fontSize: 11, color: COLORS.inkSoft, marginBottom: 18 }}>Last updated: August 2026</p>
              <PolicyBlock title="Products">
                ATHE sells custom-printed apparel where you select a blank garment, choose or upload a design, and
                have it printed to order. Colors and print placement shown on-screen are representative; minor
                variation between screen preview and the final printed product may occur.
              </PolicyBlock>
              <PolicyBlock title="Orders & pricing">
                All prices are in Indian Rupees (INR). Placing an order is an offer to purchase; we may decline or
                cancel any order (e.g. if a design violates our content policy, or stock is unavailable), in which
                case any payment taken will be refunded. Home delivery requires full prepayment; stall pickup may
                be paid on collection. Promo codes are applied at our discretion and may be withdrawn at any time.
              </PolicyBlock>
              <PolicyBlock title="Uploaded designs">
                If you upload your own design, you confirm you own the rights to it (or have permission to use
                it), and that it doesn't infringe anyone's copyright or trademark, and isn't unlawful, obscene, or
                hateful. We can refuse to print any design that violates this, refunding any payment for that item.
              </PolicyBlock>
              <PolicyBlock title="Delivery">
                Print times are estimates and may extend during high demand. Once printing begins, orders cannot
                be cancelled or changed. Delivery fees are calculated by distance from our stall and confirmed at
                checkout. See our Refund & Shipping Policy for full details.
              </PolicyBlock>
              <PolicyBlock title="Intellectual property">
                The ATHE name, logo, and Website design belong to ATHE. Designs in our own gallery may be used to
                customize your own order only, not reused commercially elsewhere.
              </PolicyBlock>
              <PolicyBlock title="Governing law">
                These Terms are governed by the laws of India; disputes are subject to the courts of Bengaluru, Karnataka.
              </PolicyBlock>
              <PolicyBlock title="Contact">
                ATHE · 51B, Bengaluru, Karnataka<br />support@athe.com · +91 78926 28601
              </PolicyBlock>
            </>
          )}
          {view === "refunds" && (
            <>
              <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 26, color: COLORS.ink, marginBottom: 14 }}>Refund & shipping policy</h2>
              <p style={{ fontSize: 11, color: COLORS.inkSoft, marginBottom: 18 }}>Last updated: August 2026</p>
              <PolicyBlock title="Shipping / delivery">
                We print using DTF (direct-to-film) transfers. If your chosen design already has a transfer in
                stock, stall pickup is ready in about an hour, and home delivery within Bengaluru typically
                arrives the same or next day. If your design needs a fresh transfer made at our DTF studio, please
                allow about 1 extra day for stall pickup or Bengaluru delivery. Outside Bengaluru, standard
                delivery takes approximately 3 to 7 business days depending on location, regardless of design.
              </PolicyBlock>
              <PolicyBlock title="Order updates">
                You'll get updates on your order status by both SMS/WhatsApp and email, using the phone number and
                email address you provide at checkout.
              </PolicyBlock>
              <PolicyBlock title="Cancellations">
                Orders can be cancelled free of charge <b>before printing starts</b>. Contact us right away if you
                need to cancel. Once printing has begun, the order can't be cancelled since it's already been
                customized specifically for you.
              </PolicyBlock>
              <PolicyBlock title="Returns & refunds">
                Because each item is made to order, we can only offer a return, replacement, or refund for: a
                printing error on our part (wrong design/size/color from what you ordered), a defective product
                (fabric fault, print peeling on arrival), or an order that never arrives. We can't offer a refund
                for change of mind after printing starts, correct sizing per our size guide, or minor color
                variation between screen and print. Refund requests are accepted up to 2 days after delivery.
              </PolicyBlock>
              <PolicyBlock title="How to request one">
                Email support@athe.com or call/WhatsApp +91 78926 28601 within 2 days of receiving your order,
                with your order number, photos of the issue, and a brief description. Approved refunds go to your
                original payment method and may take 5 to 7 business days to reflect.
              </PolicyBlock>
              <PolicyBlock title="Contact">
                ATHE · 51B, Bengaluru, Karnataka<br />support@athe.com · +91 78926 28601
              </PolicyBlock>
            </>
          )}
        </section>
      )}

      {/* ---------- CHECKOUT VIEW ---------- */}
      {!isOffline && view === "checkout" && cart.length === 0 && (
        <section style={{ padding: "20px 16px 80px", maxWidth: 560, margin: "0 auto" }}>
          <button onClick={() => setView("shop")} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: COLORS.ink, marginBottom: 18 }}>
            <ArrowLeft size={16} /> Continue shopping
          </button>
          <EmptyState
            icon={ShoppingBag}
            title="Your cart is empty"
            message="Design something fresh, then come back here to check out."
            actionLabel="Start designing"
            onAction={() => setView("shop")}
          />
        </section>
      )}
      {!isOffline && view === "checkout" && cart.length > 0 && (
        <section style={{ padding: "20px 16px 160px", maxWidth: 640, margin: "0 auto" }}>
          <button onClick={() => setView("shop")} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: COLORS.ink, marginBottom: 18 }}>
            <ArrowLeft size={16} /> Continue shopping
          </button>
          <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.ink, marginBottom: 18 }}>Checkout</h2>

          <BentoTile tone="white" hoverable={false} style={{ padding: 18, marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, marginBottom: 10 }}>1. DELIVERY</p>
            <div className="flex gap-3">
              {[
                { k: "stall", label: "Pickup at stall", note: "Ready in about an hour", icon: MapPin },
                { k: "home", label: "Home delivery", note: "Printed fresh, then dispatched", icon: Truck },
              ].map(({ k, label, note, icon: Icon }) => (
                <button key={k} onClick={() => { setDeliveryType(k); setContactConfirmed(false); }} style={{
                  flex: 1, padding: 14, borderRadius: 14, textAlign: "left",
                  border: `1.5px solid ${deliveryType === k ? COLORS.accent : COLORS.line}`,
                  background: deliveryType === k ? COLORS.accentSoft : COLORS.surface,
                }}>
                  <Icon size={18} color={COLORS.ink} />
                  <p style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>{label}</p>
                  <p style={{ fontSize: 10.5, color: COLORS.inkSoft, marginTop: 2 }}>{note}</p>
                </button>
              ))}
            </div>
          </BentoTile>

          <BentoTile tone="white" hoverable={false} style={{ padding: 18, marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, marginBottom: 10 }}>2. YOUR DETAILS</p>
            <div style={{ display: "grid", gap: 10, marginBottom: deliveryType === "home" ? 10 : 0 }}>
              <div>
                <input placeholder="Full name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })}
                  style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${errors.name ? "#DC2626" : COLORS.line}`, fontSize: 14, background: COLORS.surface, color: COLORS.ink }} />
                {errors.name && <p style={{ fontSize: 11, color: "#DC2626", marginTop: 3 }}>{errors.name}</p>}
              </div>
              <div>
                <input placeholder="Mobile number" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${errors.phone ? "#DC2626" : COLORS.line}`, fontSize: 14, background: COLORS.surface, color: COLORS.ink }} />
                {errors.phone && <p style={{ fontSize: 11, color: "#DC2626", marginTop: 3 }}>{errors.phone}</p>}
                <p style={{ fontSize: 10.5, color: COLORS.inkSoft, marginTop: 3 }}>Used for order updates via WhatsApp only.</p>
              </div>
              <div>
                <input placeholder="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${errors.email ? "#DC2626" : COLORS.line}`, fontSize: 14, background: COLORS.surface, color: COLORS.ink }} />
                {errors.email && <p style={{ fontSize: 11, color: "#DC2626", marginTop: 3 }}>{errors.email}</p>}
                <p style={{ fontSize: 10.5, color: COLORS.inkSoft, marginTop: 3 }}>For your receipt and occasional drops. Unsubscribe anytime.</p>
              </div>
            </div>

            {deliveryType === "home" && (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                <div>
                  <textarea placeholder="Delivery address" value={address.line} onChange={(e) => setAddress({ ...address, line: e.target.value })}
                    rows={2} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${errors.line ? "#DC2626" : COLORS.line}`, fontSize: 14, resize: "none", background: COLORS.surface, color: COLORS.ink }} />
                  {errors.line && <p style={{ fontSize: 11, color: "#DC2626", marginTop: 3 }}>{errors.line}</p>}
                </div>
                <div>
                  <input placeholder="Pincode" value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                    style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${errors.pincode ? "#DC2626" : COLORS.line}`, fontSize: 14, background: COLORS.surface, color: COLORS.ink }} />
                  {errors.pincode && <p style={{ fontSize: 11, color: "#DC2626", marginTop: 3 }}>{errors.pincode}</p>}
                  {pincodeInfo.status === "known" && (
                    <p style={{ fontSize: 12, color: COLORS.good, marginTop: 5, fontWeight: 600 }}>
                      ~{pincodeInfo.km} km away · Delivery fee ₹{pincodeInfo.fee}
                    </p>
                  )}
                  {pincodeInfo.status === "unknown" && (
                    <p style={{ fontSize: 12, color: COLORS.accent, marginTop: 5 }}>
                      We haven't mapped this pincode yet. We'll confirm your delivery fee over WhatsApp.
                    </p>
                  )}
                </div>
              </div>
            )}
          </BentoTile>

          <BentoTile tone="white" hoverable={false} style={{ padding: 18, marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, marginBottom: 10 }}>3. PROMO CODE</p>
            {coupon ? (
              <div className="flex items-center justify-between" style={{ background: COLORS.goodSoft, border: `1px solid ${COLORS.good}`, borderRadius: 12, padding: "10px 12px" }}>
                <div className="flex items-center gap-2">
                  <Tag size={15} color={COLORS.good} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.good }}>{coupon.code} applied</span>
                  <span style={{ fontSize: 12, color: COLORS.good }}>· −₹{coupon.discountAmount}</span>
                </div>
                <button onClick={removeCoupon} style={{ background: "none", border: "none", color: COLORS.good }}><X size={15} /></button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input placeholder="Enter code (e.g. ATHE20)" value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                    style={{ flex: 1, padding: "11px 12px", borderRadius: 10, border: `1px solid ${couponError ? "#DC2626" : COLORS.line}`, fontSize: 14, textTransform: "uppercase", background: COLORS.surface, color: COLORS.ink }} />
                  <button onClick={applyCoupon} disabled={applyingCoupon || !couponCode.trim()} style={{
                    background: COLORS.ink, color: COLORS.onDark, border: "none", padding: "0 20px", borderRadius: 10,
                    fontWeight: 700, fontSize: 13, opacity: applyingCoupon || !couponCode.trim() ? 0.5 : 1,
                  }}>
                    {applyingCoupon ? "Checking…" : "Apply"}
                  </button>
                </div>
                {couponError && <p style={{ fontSize: 11.5, color: "#DC2626", marginTop: 5 }}>{couponError}</p>}
              </div>
            )}
          </BentoTile>

          {!contactConfirmed ? (
            <button onClick={validateContact} style={{ background: COLORS.ink, color: COLORS.onDark, border: "none", width: "100%", padding: "13px 0", borderRadius: 999, fontWeight: 700, fontSize: 14 }}>
              Continue
            </button>
          ) : (
            <>
              <BentoTile tone="canvas" hoverable={false} style={{ padding: 16, marginBottom: 16 }}>
                <div className="flex justify-between" style={{ fontSize: 13, marginBottom: 6 }}>
                  <span>Subtotal</span><span>₹{cartTotal}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between" style={{ fontSize: 13, marginBottom: 6, color: COLORS.good, fontWeight: 600 }}>
                    <span>Discount ({coupon.code})</span><span>−₹{discountAmount}</span>
                  </div>
                )}
                {deliveryType === "home" && (
                  <div className="flex justify-between" style={{ fontSize: 13, marginBottom: 6 }}>
                    <span>Delivery fee</span><span>{pincodeInfo.status === "known" ? `₹${deliveryFee}` : "Pending"}</span>
                  </div>
                )}
                <div className="flex justify-between" style={{ fontSize: 15, fontWeight: 700, borderTop: `1px solid ${COLORS.line}`, paddingTop: 8, marginTop: 4 }}>
                  <span>Total</span><span>₹{grandTotal}</span>
                </div>
              </BentoTile>

              {deliveryType === "stall" && (
                <div className="flex gap-3" style={{ marginBottom: 16 }}>
                  {[{ k: true, label: "Pay now" }, { k: false, label: "Pay at pickup" }].map((o) => (
                    <button key={o.label} onClick={() => setPayNow(o.k)} style={{
                      flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                      border: `1px solid ${payNow === o.k ? COLORS.ink : COLORS.line}`,
                      background: payNow === o.k ? COLORS.ink : COLORS.surface, color: payNow === o.k ? COLORS.onDark : COLORS.ink,
                    }}>{o.label}</button>
                  ))}
                </div>
              )}
              {deliveryType === "home" && (
                <p style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 14 }}>
                  Home deliveries require prepayment, including delivery fee.
                </p>
              )}
            </>
          )}

          {contactConfirmed && (
            <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--surface)", borderTop: `1px solid ${COLORS.line}`, padding: 14 }}>
              <div style={{ maxWidth: 640, margin: "0 auto" }}>
                {orderError && (
                  <p style={{ fontSize: 12.5, color: "#DC2626", marginBottom: 8, textAlign: "center" }}>{orderError}</p>
                )}
                <button
                  disabled={placingOrder || cart.length === 0 || (deliveryType === "home" && pincodeInfo.status !== "known")}
                  onClick={placeOrder}
                  style={{
                    background: COLORS.accent, color: COLORS.onAccent, border: "none", width: "100%", padding: "14px 0",
                    borderRadius: 999, fontWeight: 700, fontSize: 15,
                    opacity: placingOrder || cart.length === 0 || (deliveryType === "home" && pincodeInfo.status !== "known") ? 0.5 : 1,
                  }}>
                  {placingOrder
                    ? "Processing…"
                    : (deliveryType === "home" || payNow)
                    ? `Pay ₹${grandTotal} & place order`
                    : `Place order · Pay ₹${grandTotal} at pickup`}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ---------- TRACKING VIEW ---------- */}
      {!isOffline && view === "tracking" && (
        <section style={{ padding: "20px 16px 80px", maxWidth: 560, margin: "0 auto" }}>
          <button onClick={() => setView("shop")} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: COLORS.ink, marginBottom: 20 }}>
            <ArrowLeft size={16} /> Back to shop
          </button>
          {!order ? (
            <EmptyState
              icon={Package}
              title="No active orders yet"
              message="Place an order to see live tracking here."
              actionLabel="Start designing"
              onAction={() => setView("shop")}
            />
          ) : (
            <>
              <BentoTile tone="accent" hoverable={false} style={{ padding: 20, marginBottom: 16 }}>
                <p style={{ fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1, fontWeight: 700, color: COLORS.onDarkSoft }}>ORDER RECEIPT</p>
                <p style={{ fontFamily: FONTS.mono, fontSize: 20, marginTop: 4, color: COLORS.onDark }}>{order.id}</p>
                <p style={{ fontSize: 12, color: COLORS.onDarkSoft, marginTop: 6 }}>
                  {order.deliveryType === "stall" ? "Pickup at stall" : "Home delivery"} · ₹{order.total} · {order.paid ? "Paid" : "Pay on pickup"}
                </p>
                {order.discountAmount > 0 && (
                  <p style={{ fontSize: 12, marginTop: 4, fontWeight: 600, color: COLORS.onDark }}>
                    You saved ₹{order.discountAmount} with {order.discountCode}
                  </p>
                )}
              </BentoTile>

              {order.cancelled ? (
                <BentoTile tone="white" hoverable={false} style={{ padding: 20 }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                    <X size={18} color="#DC2626" />
                    <p style={{ fontWeight: 700, fontSize: 15, color: "#DC2626" }}>Order cancelled</p>
                  </div>
                  <p style={{ fontSize: 13, color: COLORS.inkSoft, lineHeight: 1.6 }}>
                    {order.cancelledBy === "staff"
                      ? "We had to cancel this one from our side."
                      : "You cancelled this order."}
                  </p>
                  {order.cancelReason && (
                    <div style={{ background: COLORS.surfaceAlt, borderRadius: 10, padding: 12, marginTop: 10 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: COLORS.inkSoft, letterSpacing: 0.4, marginBottom: 4 }}>REASON</p>
                      <p style={{ fontSize: 13, color: COLORS.ink }}>{order.cancelReason}</p>
                    </div>
                  )}
                  <a href="#" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: COLORS.accent, marginTop: 14 }}>
                    <MessageCircle size={16} /> Message us on WhatsApp
                  </a>
                </BentoTile>
              ) : (
                <BentoTile tone="white" hoverable={false} style={{ padding: 20 }}>
                  <div style={{ display: "grid", gap: 0 }}>
                    {STEPS.map((s, i) => {
                      const Icon = s.icon;
                      const done = i <= statusIndex;
                      return (
                        <div key={s.key} className="flex items-start gap-3">
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                              background: done ? COLORS.accent : COLORS.surface, border: `2px solid ${done ? COLORS.accent : COLORS.line}`,
                            }}>
                              <Icon size={15} color={done ? COLORS.onAccent : COLORS.inkSoft} />
                            </div>
                            {i < STEPS.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 30, background: i < statusIndex ? COLORS.accent : COLORS.line }} />}
                          </div>
                          <div style={{ paddingBottom: 26 }}>
                            <p style={{ fontWeight: 700, fontSize: 14, color: done ? COLORS.ink : COLORS.inkSoft }}>{s.label}</p>
                            {i === statusIndex && i < STEPS.length - 1 && <p style={{ fontSize: 11.5, color: COLORS.inkSoft }}>In progress…</p>}
                            {i === STEPS.length - 1 && statusIndex === STEPS.length - 1 && <p style={{ fontSize: 11.5, color: COLORS.good }}>Delivered. Enjoy!</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <a href="#" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: COLORS.accent, marginTop: 10 }}>
                    <MessageCircle size={16} /> Message us on WhatsApp
                  </a>
                </BentoTile>
              )}

              {/* ---- Cancel order ---- */}
              {!order.cancelled && statusIndex < STEPS.length - 1 && (
                <BentoTile tone="canvas" hoverable={false} style={{ padding: 18, marginTop: 14 }}>
                  {!canCustomerCancel() ? (
                    <p style={{ fontSize: 12, color: COLORS.inkSoft, lineHeight: 1.6 }}>
                      Printing has already started on this order, and it's paid, so it can't be cancelled from here.
                      Message us on WhatsApp if something's wrong.
                    </p>
                  ) : !showCancelForm ? (
                    <button onClick={() => setShowCancelForm(true)} style={{
                      background: "none", border: `1px solid ${COLORS.line}`, borderRadius: 999, padding: "9px 16px",
                      fontSize: 12.5, fontWeight: 700, color: "#DC2626", display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <X size={13} /> Cancel this order
                    </button>
                  ) : (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, marginBottom: 8 }}>WHY ARE YOU CANCELLING?</p>
                      <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3}
                        placeholder="e.g. changed my mind, ordered by mistake, found a better fit…"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.line}`, fontSize: 13.5, resize: "none", background: COLORS.surface, color: COLORS.ink }} />
                      <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
                        <button disabled={!cancelReason.trim() || cancelling} onClick={submitCancelOrder} style={{
                          background: "#DC2626", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 999,
                          fontSize: 12.5, fontWeight: 700, opacity: !cancelReason.trim() || cancelling ? 0.5 : 1,
                        }}>{cancelling ? "Cancelling…" : "Confirm cancellation"}</button>
                        <button onClick={() => { setShowCancelForm(false); setCancelReason(""); }} style={{
                          background: "none", border: "none", fontSize: 12.5, fontWeight: 600, color: COLORS.inkSoft,
                        }}>Never mind</button>
                      </div>
                    </div>
                  )}
                </BentoTile>
              )}
            </>
          )}
        </section>
      )}

      {/* ---------- NOT FOUND VIEW ---------- */}
      {!isOffline && view === "notfound" && (
        <NotFoundState onBack={goRoute("#/shop")} />
      )}

      {/* ---------- CART DRAWER ---------- */}
      {cartOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <div onClick={() => setCartOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(380px, 100%)", background: "var(--surface)", padding: 20, overflowY: "auto" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <h3 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 19, color: COLORS.ink }}>Your cart</h3>
              <button onClick={() => setCartOpen(false)} style={{ background: "none", border: "none" }}><X size={20} color={COLORS.ink} /></button>
            </div>
            {cart.length === 0 ? (
              <p style={{ fontSize: 13, color: COLORS.inkSoft }}>Your cart is empty. Design something fresh!</p>
            ) : (
              <>
                {cart.map((item) => (
                  <div key={item.cartId} className="flex gap-3" style={{ borderBottom: `1px solid ${COLORS.line}`, padding: "12px 0" }}>
                    <DesignPatch design={item.design} size={54} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>{item.name}</p>
                      <p style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{item.color.name} · {item.size} · {item.design.name}</p>
                      <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.cartId, -1)} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 6, background: "none", width: 22, height: 22 }}><Minus size={11} color={COLORS.ink} /></button>
                          <span style={{ fontSize: 12, color: COLORS.ink }}>{item.qty}</span>
                          <button onClick={() => updateQty(item.cartId, 1)} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 6, background: "none", width: 22, height: 22 }}><Plus size={11} color={COLORS.ink} /></button>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>₹{item.price * item.qty}</span>
                      </div>
                      <button onClick={() => removeItem(item.cartId)} style={{ background: "none", border: "none", color: COLORS.accent, fontSize: 11, marginTop: 4, padding: 0 }}>Remove</button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between" style={{ margin: "16px 0", fontWeight: 700, fontSize: 15, color: COLORS.ink }}>
                  <span>Subtotal</span><span>₹{cartTotal}</span>
                </div>
                <button onClick={() => { setCartOpen(false); setView("checkout"); }} style={{ background: COLORS.ink, color: COLORS.onDark, border: "none", width: "100%", padding: "13px 0", borderRadius: 999, fontWeight: 700, fontSize: 14 }}>
                  Checkout
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------- FOOTER (floating mega bento tile) ---------- */}
      {!["customize", "checkout"].includes(view) && (
        <section style={{ padding: "8px 16px 24px", maxWidth: 1120, margin: "0 auto" }}>
          <BentoTile tone="dark" hoverable={false} style={{ padding: "32px 28px 22px" }}>
            <div className="flex items-start justify-between flex-wrap gap-8" style={{ marginBottom: 24 }}>
              <div style={{ maxWidth: 280 }}>
                <div style={{ marginBottom: 12 }}>
                  <AtheWordmark size="sm" tone="light" />
                </div>
                <p style={{ fontSize: 12.5, color: COLORS.onChromeSoft, lineHeight: 1.6 }}>Custom-press streetwear, made to order. Pick it up fresh or have it delivered.</p>
              </div>
              <div className="flex gap-14 flex-wrap">
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: COLORS.onChromeSoft, letterSpacing: 0.5, marginBottom: 10 }}>SHOP</p>
                  <div className="flex flex-col gap-2">
                    <FooterLink href="#/products" onClick={goRoute("#/products")}>All products</FooterLink>
                    <FooterLink href="#/track" onClick={goRoute("#/track")}>Track order</FooterLink>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: COLORS.onChromeSoft, letterSpacing: 0.5, marginBottom: 10 }}>LEGAL</p>
                  <div className="flex flex-col gap-2">
                    <FooterLink href="#/about" onClick={goRoute("#/about")}>About</FooterLink>
                    <FooterLink href="#/privacy" onClick={goRoute("#/privacy")}>Privacy</FooterLink>
                    <FooterLink href="#/terms" onClick={goRoute("#/terms")}>Terms</FooterLink>
                    <FooterLink href="#/refunds" onClick={goRoute("#/refunds")}>Refunds</FooterLink>
                  </div>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: COLORS.onChromeSoft, letterSpacing: 0.5, marginBottom: 10 }}>FOLLOW</p>
                <div className="flex gap-3">
                  <MessageCircle size={17} color={COLORS.onChromeSoft} />
                  <Instagram size={17} color={COLORS.onChromeSoft} />
                </div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16 }}>
              <p style={{ fontSize: 11, color: COLORS.onChromeSoft }}>© {new Date().getFullYear()} ATHE. All rights reserved.</p>
            </div>
          </BentoTile>
        </section>
      )}
    </div>
  );
}

// Wraps the app in the crash boundary so a render error anywhere below
// shows ErrorPage instead of a blank screen. This is the piece main.jsx
// actually renders.
export default function Athe(props) {
  return (
    <AtheErrorBoundary>
      <AtheApp {...props} />
    </AtheErrorBoundary>
  );
}
