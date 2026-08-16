import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, Package, Palette, MapPin, IndianRupee, ShoppingBag,
  Trash2, Check, X, TrendingUp, Truck, Menu, Tag, Upload,
  Sun, Moon, Monitor, Shirt, ChevronDown, ChevronUp, PlusCircle,
} from "lucide-react";

// Same "Signal Mono" palette as the storefront (off-black ink, cool paper
// canvas, one locked cobalt accent) so admin/staff/shop feel like one
// brand. `pink`/`mustard`/`warn`/`good` are kept as names (used across ~40
// call sites) but now resolve to accent/amber/amber/green from that
// system. Values are CSS custom properties so dark mode swaps for free.
const COLORS = {
  canvas: "var(--canvas)", canvasDeep: "var(--surface-alt)", ink: "var(--ink)", pink: "var(--accent)", mustard: "var(--amber)",
  accent: "var(--accent)", charcoal: "var(--ink)", line: "var(--line)", panel: "var(--surface)", good: "var(--good)", warn: "var(--amber)",
  onDark: "var(--on-dark)", onDarkSoft: "var(--on-dark-soft)", onAccent: "var(--on-accent)", inkSoft: "var(--ink-soft)",
  chrome: "var(--chrome)", onChrome: "var(--on-chrome)",
};
const FONTS = {
  display: "'Space Grotesk', sans-serif",
  body: "'Manrope', sans-serif",
  mono: "'Space Mono', monospace",
};

// Same token set as the storefront and staff app: one locked cobalt accent,
// off-black ink, cool paper canvas, auto dark mode via prefers-color-scheme.
const ROOT_TOKENS_CSS = `
  :root {
    --canvas: #F5F5F3; --surface: #FFFFFF; --surface-alt: #EEEEEC;
    --ink: #131313; --ink-soft: #5B5B58;
    --on-dark: #FFFFFF; --on-dark-soft: rgba(255,255,255,0.62);
    --accent: #2451FF; --accent-soft: #E7ECFF; --on-accent: #FFFFFF;
    --amber: #D97706; --line: #E2E2DE; --good: #16A34A;
    --chrome: #131313; --on-chrome: #FFFFFF;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --canvas: #101012; --surface: #17181B; --surface-alt: #1E2024;
      --ink: #F4F4F2; --ink-soft: #A5A6A8;
      --on-dark: #0E0E10; --on-dark-soft: rgba(14,14,16,0.6);
      --accent: #5B7FFF; --accent-soft: rgba(91,127,255,0.16); --on-accent: #0E0E10;
      --amber: #F59E0B; --line: #2A2C31; --good: #34D399;
      --chrome: #0B0B0D; --on-chrome: #FFFFFF;
    }
  }
  :root[data-theme="dark"] {
    --canvas: #101012; --surface: #17181B; --surface-alt: #1E2024;
    --ink: #F4F4F2; --ink-soft: #A5A6A8;
    --on-dark: #0E0E10; --on-dark-soft: rgba(14,14,16,0.6);
    --accent: #5B7FFF; --accent-soft: rgba(91,127,255,0.16); --on-accent: #0E0E10;
    --amber: #F59E0B; --line: #2A2C31; --good: #34D399;
    --chrome: #0B0B0D; --on-chrome: #FFFFFF;
  }
`;

// Reusable light/dark/system cycling toggle, shared by the login gate and
// the main dashboard chrome so the choice is available before and after
// signing in.
function useTheme(storageKey) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(storageKey) || "system"; } catch { return "system"; }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try { localStorage.setItem(storageKey, theme); } catch {}
  }, [theme, storageKey]);
  function cycle() {
    setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));
  }
  const Icon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;
  const label = theme === "system" ? "Matching system theme" : theme === "light" ? "Light theme" : "Dark theme";
  return { theme, cycle, Icon, label };
}

// No seed orders - real orders populate this from the storefront once both
// apps share a backend. Nothing invented here.
const INITIAL_ORDERS = [];

// No seed designs - the gallery is built entirely from what admin adds
// below (or customer uploads, once synced through a shared backend).
const INITIAL_DESIGNS = [];

const INITIAL_ZONES = [
  { id: 1, pincode: "560001", km: 2, fee: 100 }, { id: 2, pincode: "560034", km: 4, fee: 100 },
  { id: 3, pincode: "560095", km: 6, fee: 200 }, { id: 4, pincode: "560102", km: 3, fee: 100 },
  { id: 5, pincode: "560068", km: 9, fee: 200 }, { id: 6, pincode: "560038", km: 12, fee: 200 },
];

// ---------- Types, products & per-colour/size inventory ----------
// Garment "type" used to be a hardcoded T-Shirt/Hoodie pair. Styles change
// season to season, so it's an admin-managed list instead: add "Classic",
// "Oversized", whatever's trending, and delete what isn't sold anymore.
// Each type still needs a base silhouette for the placeholder preview
// shape/hood rendering - only "tshirt" and "hoodie" silhouettes exist as
// actual artwork, but the type's own name/label is entirely free-form.
const INITIAL_TYPES = [
  { id: "tshirt", name: "T-Shirt", silhouette: "tshirt" },
  { id: "hoodie", name: "Hoodie", silhouette: "hoodie" },
];

const GARMENT_COLORS = [
  { id: "white", name: "Bone White", hex: "#FBFAF6" },
  { id: "black", name: "Jet Black", hex: "#1B1B1E" },
  { id: "navy", name: "Ink Navy", hex: "#14213D" },
  { id: "grey", name: "Storm Grey", hex: "#8A8D93" },
  { id: "olive", name: "Field Olive", hex: "#6B6E4E" },
  { id: "rust", name: "Rust Clay", hex: "#B5502D" },
];
const PRODUCT_SIZES = ["S", "M", "L", "XL", "XXL"];

// New products start with every colour/size at 0 - admin sets real stock
// once, here, rather than the demo seeding fake numbers.
function emptyVariants() {
  const variants = {};
  GARMENT_COLORS.forEach((c) => {
    variants[c.id] = {};
    PRODUCT_SIZES.forEach((s) => { variants[c.id][s] = 0; });
  });
  return variants;
}
function colorTotalStock(product, colorId) {
  return Object.values(product.variants?.[colorId] || {}).reduce((a, b) => a + b, 0);
}
function productTotalStock(product) {
  return Object.keys(product.variants || {}).reduce((sum, c) => sum + colorTotalStock(product, c), 0);
}

// No seed products - the catalog is entirely what admin adds below.
const INITIAL_PRODUCTS = [];

const STATUS_STYLE = {
  placed: { label: "Placed", color: "#8A8D93" },
  printing: { label: "Printing", color: COLORS.pink },
  ready: { label: "Ready", color: COLORS.mustard },
  out: { label: "Out for delivery", color: "#3A7CA5" },
  delivered: { label: "Delivered", color: COLORS.good },
};

function Badge({ status }) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: s.color, padding: "3px 9px", borderRadius: 999 }}>
      {s.label}
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16, flex: 1, minWidth: 150 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", letterSpacing: 0.4 }}>{label}</span>
        <Icon size={16} color={accent || COLORS.ink} />
      </div>
      <p style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.ink }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// Full product editor: name/category/price/"new" flag up top, and an
// expandable colour x size stock grid per product underneath. This is the
// single place price and inventory actually live now - the storefront and
// the Overview low-stock banner both read off the same `products` state.
function ProductsPanel({ products, types, onField, onStock, onAddProduct, onRemoveProduct, onAddType, onRemoveType }) {
  const [expandedId, setExpandedId] = useState(products[0]?.id ?? null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", typeId: types[0]?.id || "", category: "unisex" });
  const [newType, setNewType] = useState({ name: "", silhouette: "tshirt" });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const inputStyle = {
    padding: "7px 9px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13, background: COLORS.panel, color: COLORS.ink,
  };
  const typeName = (id) => types.find((t) => t.id === id)?.name || id;

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: 6 }}>
        <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.ink }}>PRODUCTS</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTypes((v) => !v)} style={{
            fontSize: 12, fontWeight: 700, color: COLORS.ink, background: "none", border: `1px solid ${COLORS.line}`,
            borderRadius: 8, padding: "7px 12px",
          }}>Manage types ({types.length})</button>
          <button onClick={() => setShowAddProduct((v) => !v)} style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: COLORS.onChrome,
            background: COLORS.chrome, border: "none", borderRadius: 8, padding: "7px 12px",
          }}><PlusCircle size={14} /> Add product</button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
        Price, category and the "New" badge apply everywhere the product shows up. Open a row to edit stock per colour and size -
        the storefront can't sell a colour/size once it hits zero here.
      </p>

      {showTypes && (
        <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>GARMENT TYPES</p>
          <div className="flex flex-wrap gap-2" style={{ marginBottom: 12 }}>
            {types.length === 0 && <p style={{ fontSize: 12.5, color: "#94A3B8" }}>No types yet - add one below before adding products.</p>}
            {types.map((t) => (
              <span key={t.id} className="flex items-center gap-2" style={{
                fontSize: 12.5, fontWeight: 600, padding: "6px 10px", borderRadius: 999, border: `1px solid ${COLORS.line}`, color: COLORS.ink,
              }}>
                {t.name} <span style={{ color: "#94A3B8", fontSize: 11 }}>({t.silhouette})</span>
                <button onClick={() => onRemoveType(t.id)} style={{ background: "none", border: "none", color: COLORS.pink, display: "flex" }}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <input placeholder="New type name (e.g. Oversized, Crop)" value={newType.name}
              onChange={(e) => setNewType({ ...newType, name: e.target.value })}
              style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
            <select value={newType.silhouette} onChange={(e) => setNewType({ ...newType, silhouette: e.target.value })} style={inputStyle}>
              <option value="tshirt">Tee silhouette</option>
              <option value="hoodie">Hoodie silhouette</option>
            </select>
            <button onClick={() => { onAddType(newType.name, newType.silhouette); setNewType({ name: "", silhouette: "tshirt" }); }}
              disabled={!newType.name.trim()}
              style={{ background: COLORS.chrome, color: COLORS.onChrome, border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 12.5, opacity: newType.name.trim() ? 1 : 0.5 }}>
              Add type
            </button>
          </div>
          <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>
            The silhouette picks which placeholder shape the preview draws (only tee/hoodie art exists) - the name is whatever you call it.
          </p>
        </div>
      )}

      {showAddProduct && (
        <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>NEW PRODUCT</p>
          {types.length === 0 ? (
            <p style={{ fontSize: 12.5, color: COLORS.warn }}>Add a garment type first (above), then come back to add the product.</p>
          ) : (
            <div className="flex gap-2 flex-wrap items-center">
              <input placeholder="Product name" value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
              <select value={newProduct.typeId} onChange={(e) => setNewProduct({ ...newProduct, typeId: e.target.value })} style={inputStyle}>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} style={inputStyle}>
                <option value="unisex">Unisex</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
              </select>
              <button
                disabled={!newProduct.name.trim()}
                onClick={() => {
                  onAddProduct(newProduct);
                  setNewProduct({ name: "", typeId: types[0]?.id || "", category: "unisex" });
                  setShowAddProduct(false);
                }}
                style={{ background: COLORS.chrome, color: COLORS.onChrome, border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 12.5, opacity: newProduct.name.trim() ? 1 : 0.5 }}
              >
                Add
              </button>
            </div>
          )}
          <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>
            Starts at ₹0 with every colour/size at 0 stock - set the real price and stock below once it's added.
          </p>
        </div>
      )}

      {products.length === 0 && !showAddProduct && (
        <div style={{ textAlign: "center", padding: "40px 20px", border: `1px dashed ${COLORS.line}`, borderRadius: 14 }}>
          <p style={{ fontSize: 13, color: "#64748B" }}>No products yet. Add one to start selling.</p>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {products.map((p) => {
          const total = productTotalStock(p);
          const isOpen = expandedId === p.id;
          return (
            <div key={p.id} style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, overflow: "hidden" }}>
              <div className="flex items-center gap-3 flex-wrap" style={{ padding: 14 }}>
                <input value={p.name} onChange={(e) => onField(p.id, "name", e.target.value)}
                  style={{ ...inputStyle, fontWeight: 700, flex: 1, minWidth: 150 }} />
                <select value={p.type} onChange={(e) => onField(p.id, "type", e.target.value)} style={inputStyle}>
                  {types.find((t) => t.id === p.type) ? null : <option value={p.type}>{typeName(p.type)}</option>}
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select value={p.category} onChange={(e) => onField(p.id, "category", e.target.value)} style={inputStyle}>
                  <option value="unisex">Unisex</option>
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                </select>
                <div className="flex items-center gap-1">
                  <span style={{ fontSize: 13, color: COLORS.inkSoft }}>₹</span>
                  <input type="number" min={0} value={p.price}
                    onChange={(e) => onField(p.id, "price", Math.max(0, parseInt(e.target.value, 10) || 0))}
                    style={{ ...inputStyle, width: 76, fontFamily: FONTS.mono }} />
                </div>
                <button onClick={() => onField(p.id, "isNew", !p.isNew)} style={{
                  fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 999, background: "none",
                  border: `1px solid ${p.isNew ? COLORS.accent : COLORS.line}`, color: p.isNew ? COLORS.accent : "#94A3B8",
                }}>{p.isNew ? "★ New arrival" : "Mark as new"}</button>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: total === 0 ? "#DC2626" : total < 20 ? COLORS.warn : COLORS.good, marginLeft: "auto" }}>
                  {total === 0 ? "Out of stock" : `${total} in stock`}
                </span>
                <button onClick={() => setExpandedId(isOpen ? null : p.id)} style={{
                  display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px solid ${COLORS.line}`,
                  borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 600, color: COLORS.ink,
                }}>
                  {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Stock
                </button>
                {confirmDeleteId === p.id ? (
                  <div className="flex items-center gap-1">
                    <span style={{ fontSize: 11, color: COLORS.pink, fontWeight: 700 }}>Delete "{p.name}"?</span>
                    <button onClick={() => { onRemoveProduct(p.id); setConfirmDeleteId(null); }} style={{ background: COLORS.pink, color: "#fff", border: "none", borderRadius: 6, padding: "5px 8px", fontSize: 11, fontWeight: 700 }}>Yes</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{ background: "none", border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: "5px 8px", fontSize: 11 }}>No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(p.id)} style={{ background: "none", border: "none", color: COLORS.pink, display: "flex", padding: 6 }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {isOpen && (
                <div style={{ padding: "0 14px 14px", overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "#94A3B8", padding: "6px 8px", borderBottom: `1px solid ${COLORS.line}` }}>COLOUR</th>
                        {PRODUCT_SIZES.map((s) => (
                          <th key={s} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: "#94A3B8", padding: "6px 8px", borderBottom: `1px solid ${COLORS.line}` }}>{s}</th>
                        ))}
                        <th style={{ textAlign: "right", fontSize: 10.5, fontWeight: 700, color: "#94A3B8", padding: "6px 8px", borderBottom: `1px solid ${COLORS.line}` }}>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {GARMENT_COLORS.map((c) => (
                        <tr key={c.id}>
                          <td style={{ padding: "6px 8px", borderBottom: `1px solid ${COLORS.line}` }}>
                            <div className="flex items-center gap-2">
                              <span style={{ width: 14, height: 14, borderRadius: "50%", background: c.hex, border: `1px solid ${COLORS.line}`, flexShrink: 0 }} />
                              <span style={{ fontSize: 12.5 }}>{c.name}</span>
                            </div>
                          </td>
                          {PRODUCT_SIZES.map((s) => (
                            <td key={s} style={{ padding: "6px 4px", borderBottom: `1px solid ${COLORS.line}`, textAlign: "center" }}>
                              <input type="number" min={0} value={p.variants[c.id]?.[s] ?? 0}
                                onChange={(e) => onStock(p.id, c.id, s, parseInt(e.target.value, 10))}
                                style={{
                                  width: 44, textAlign: "center", padding: "5px 2px", borderRadius: 6, fontFamily: FONTS.mono, fontSize: 12,
                                  border: `1px solid ${(p.variants[c.id]?.[s] ?? 0) === 0 ? "#DC2626" : COLORS.line}`,
                                  background: (p.variants[c.id]?.[s] ?? 0) === 0 ? "#FEF2F2" : COLORS.panel, color: COLORS.ink,
                                }} />
                            </td>
                          ))}
                          <td style={{ padding: "6px 8px", borderBottom: `1px solid ${COLORS.line}`, textAlign: "right", fontSize: 12, fontWeight: 700, color: COLORS.ink }}>
                            {colorTotalStock(p, c.id)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function AtheAdmin({ apiBaseUrl = "" }) {
  const [tab, setTab] = useState("overview");
  const [navOpen, setNavOpen] = useState(false);
  const { cycle: cycleTheme, Icon: ThemeIcon, label: themeLabel } = useTheme("athe_admin_theme");

  // ---------- Auth ----------
  const [token, setToken] = useState(() => localStorage.getItem("athe_admin_token") || "");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Login failed");
      }
      const data = await res.json();
      localStorage.setItem("athe_admin_token", data.token);
      setToken(data.token);
    } catch (err) {
      setLoginError(err.message || "Login failed");
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() {
    localStorage.removeItem("athe_admin_token");
    setToken("");
  }

  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ---------- Data (fetched from the real API once logged in) ----------
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [types, setTypes] = useState(INITIAL_TYPES);
  const [designs, setDesigns] = useState(INITIAL_DESIGNS);
  const [zones, setZones] = useState(INITIAL_ZONES);
  const [coupons, setCoupons] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadError, setLoadError] = useState("");

  function loadAll() {
    if (!token) return;
    fetch(`${apiBaseUrl}/api/orders`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setOrders(data.map((o) => ({
        id: o.code, customer: o.customerName, item: o.items?.[0] ? `${o.items.length} item(s)` : "-",
        total: o.total, type: o.deliveryType?.toLowerCase(), status: o.status?.toLowerCase(),
        time: new Date(o.createdAt).toLocaleTimeString(),
      }))))
      .catch(() => setLoadError("Could not load orders"));

    fetch(`${apiBaseUrl}/api/garment-photos`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => data && typeof data === "object" && setPhotosByKey(data))
      .catch(() => {});

    fetch(`${apiBaseUrl}/api/products`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && data.length && setProducts(data))
      .catch(() => setLoadError("Could not load products"));

    fetch(`${apiBaseUrl}/api/product-types`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && data.length && setTypes(data))
      .catch(() => {});

    fetch(`${apiBaseUrl}/api/designs`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setDesigns(data))
      .catch(() => {});

    fetch(`${apiBaseUrl}/api/zones`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setZones(data))
      .catch(() => {});

    fetch(`${apiBaseUrl}/api/coupons/all`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setCoupons(data))
      .catch(() => setLoadError("Could not load coupons"));

    fetch(`${apiBaseUrl}/api/orders/stats/summary`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }

  useEffect(() => {
    if (apiBaseUrl && token) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, token]);

  const [newDesignName, setNewDesignName] = useState("");
  const [newDesignTag, setNewDesignTag] = useState("");
  const [newZone, setNewZone] = useState({ pincode: "", km: "", fee: "" });
  const [newCoupon, setNewCoupon] = useState({ code: "", label: "", kind: "PERCENT", value: "", minSubtotal: "", maxDiscount: "" });
  const [couponError, setCouponError] = useState("");

  // No invented fallback numbers - these are real counts from `orders`
  // (empty until real orders exist) unless a connected backend supplies stats.
  const salesToday = stats?.salesToday ?? orders.reduce((s, o) => s + o.total, 0);
  const salesMonth = stats?.salesMonth ?? orders.reduce((s, o) => s + o.total, 0);
  const ordersMonth = stats?.ordersMonth ?? orders.length;
  const avgOrder = stats?.avgOrder ?? (ordersMonth ? Math.round(salesMonth / ordersMonth) : 0);
  const deliveryExpenseMonth = stats?.deliveryExpenseMonth ?? 0;
  const homeOrdersMonth = stats?.homeOrdersMonth ?? 0;

  // Photo slots are derived from the current `types` list x the fixed
  // colour palette, not a hardcoded seed - add/delete a type and its photo
  // row appears/disappears here too. Keyed "typeId:colorId" -> photo URL.
  const [photosByKey, setPhotosByKey] = useState({});
  const [uploadingPhotoId, setUploadingPhotoId] = useState(null);

  async function uploadGarmentPhoto(key, file) {
    if (!file || !apiBaseUrl || !token) return;
    setUploadingPhotoId(key);
    try {
      const urlRes = await fetch(`${apiBaseUrl}/api/designs/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Could not get an upload link");
      const { uploadUrl, publicUrl } = await urlRes.json();

      const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!putRes.ok) throw new Error("Image upload failed");

      const [typeId, colorId] = key.split(":");
      const res = await fetch(`${apiBaseUrl}/api/garment-photos`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ typeId, colorId, photoUrl: publicUrl }),
      });
      if (!res.ok) throw new Error("Could not save the photo");
      setPhotosByKey((m) => ({ ...m, [key]: publicUrl }));
    } catch (err) {
      setLoadError(err.message || "Could not upload garment photo");
    } finally {
      setUploadingPhotoId(null);
    }
  }

  // ---------- Products: price/details + per-colour/size stock ----------
  function updateProductField(id, field, value) {
    setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    if (!apiBaseUrl || !token) return;
    fetch(`${apiBaseUrl}/api/products/${id}`, {
      method: "PATCH", headers: authHeaders, body: JSON.stringify({ [field]: value }),
    }).catch(() => setLoadError("Could not save product change"));
  }
  function updateVariantStock(id, colorId, size, units) {
    const clamped = Math.max(0, Number.isFinite(units) ? units : 0);
    setProducts((ps) => ps.map((p) => {
      if (p.id !== id) return p;
      return { ...p, variants: { ...p.variants, [colorId]: { ...p.variants[colorId], [size]: clamped } } };
    }));
    if (!apiBaseUrl || !token) return;
    fetch(`${apiBaseUrl}/api/products/${id}/stock`, {
      method: "PATCH", headers: authHeaders, body: JSON.stringify({ colorId, size, units: clamped }),
    }).catch(() => setLoadError("Could not save stock change"));
  }
  function addProduct({ name, typeId, category }) {
    const id = "p-" + Date.now();
    const optimistic = { id, name, type: typeId, category, price: 0, isNew: false, active: true, variants: emptyVariants() };
    setProducts((ps) => [optimistic, ...ps]);
    if (!apiBaseUrl || !token) return;
    fetch(`${apiBaseUrl}/api/products`, {
      method: "POST", headers: authHeaders, body: JSON.stringify({ name, type: typeId, category }),
    })
      .then((r) => r.json())
      .then((real) => setProducts((ps) => ps.map((p) => (p.id === id ? real : p))))
      .catch(() => setLoadError("Could not save the new product"));
  }
  function removeProduct(id) {
    setProducts((ps) => ps.filter((p) => p.id !== id));
    if (!apiBaseUrl || !token) return;
    fetch(`${apiBaseUrl}/api/products/${id}`, { method: "DELETE", headers: authHeaders }).catch(() => setLoadError("Could not delete product"));
  }

  // ---------- Garment types (T-Shirt, Hoodie, or whatever's trending) ----------
  function addProductType(name, silhouette) {
    if (!name.trim()) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const optimistic = { id, name: name.trim(), silhouette };
    setTypes((ts) => [...ts, optimistic]);
    if (!apiBaseUrl || !token) return;
    fetch(`${apiBaseUrl}/api/product-types`, {
      method: "POST", headers: authHeaders, body: JSON.stringify(optimistic),
    }).catch(() => setLoadError("Could not save the new type"));
  }
  function removeProductType(id) {
    setTypes((ts) => ts.filter((t) => t.id !== id));
    if (!apiBaseUrl || !token) return;
    fetch(`${apiBaseUrl}/api/product-types/${id}`, { method: "DELETE", headers: authHeaders }).catch(() => setLoadError("Could not delete type"));
  }

  function toggleDesign(id, key) {
    setDesigns((d) => d.map((x) => (x.id === id ? { ...x, [key]: !x[key] } : x)));
    if (!apiBaseUrl || !token) return;
    const design = designs.find((x) => x.id === id);
    fetch(`${apiBaseUrl}/api/designs/${id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ [key]: !design?.[key] }),
    }).catch(() => setLoadError("Could not save design change"));
  }
  function removeDesign(id) {
    setDesigns((d) => d.filter((x) => x.id !== id));
    if (!apiBaseUrl || !token) return;
    fetch(`${apiBaseUrl}/api/designs/${id}`, { method: "DELETE", headers: authHeaders }).catch(() => {});
  }

  const [newDesignAudience, setNewDesignAudience] = useState("all");
  const [newDesignFile, setNewDesignFile] = useState(null);
  const [uploadingDesign, setUploadingDesign] = useState(false);
  const [designUploadError, setDesignUploadError] = useState("");

  async function addDesign() {
    setDesignUploadError("");
    if (!newDesignName.trim()) { setDesignUploadError("Name is required"); return; }
    if (!newDesignFile) { setDesignUploadError("Choose an image file"); return; }
    if (!apiBaseUrl || !token) { setDesignUploadError("Not connected to the API"); return; }

    setUploadingDesign(true);
    try {
      // 1. Ask the backend for a presigned S3 upload URL
      const urlRes = await fetch(`${apiBaseUrl}/api/designs/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: newDesignFile.name, contentType: newDesignFile.type }),
      });
      if (!urlRes.ok) throw new Error("Could not get an upload link");
      const { uploadUrl, publicUrl } = await urlRes.json();

      // 2. Upload the actual file straight to S3
      const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": newDesignFile.type }, body: newDesignFile });
      if (!putRes.ok) throw new Error("Image upload failed");

      // 3. Register the design as fully approved (admin-created, not a pending customer upload)
      const res = await fetch(`${apiBaseUrl}/api/designs/admin`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: newDesignName, tag: newDesignTag || "New", audience: newDesignAudience,
          imageUrl: publicUrl, trending: false,
        }),
      });
      if (!res.ok) throw new Error("Could not save the design");
      const created = await res.json();
      setDesigns((d) => [created, ...d]);
      setNewDesignName(""); setNewDesignTag(""); setNewDesignAudience("all"); setNewDesignFile(null);
    } catch (err) {
      setDesignUploadError(err.message || "Something went wrong");
    } finally {
      setUploadingDesign(false);
    }
  }
  function removeZone(id) {
    setZones((z) => z.filter((x) => x.id !== id));
    if (!apiBaseUrl || !token) return;
    fetch(`${apiBaseUrl}/api/zones/${id}`, { method: "DELETE", headers: authHeaders }).catch(() => {});
  }
  function addZone() {
    if (!/^\d{6}$/.test(newZone.pincode) || !newZone.km || !newZone.fee) return;
    const optimistic = { id: "temp-" + Date.now(), pincode: newZone.pincode, km: Number(newZone.km), fee: Number(newZone.fee) };
    setZones((z) => [...z, optimistic]);
    setNewZone({ pincode: "", km: "", fee: "" });
    if (!apiBaseUrl || !token) return;
    fetch(`${apiBaseUrl}/api/zones`, { method: "POST", headers: authHeaders, body: JSON.stringify(optimistic) })
      .then((r) => r.json())
      .then((real) => setZones((z) => z.map((x) => (x.id === optimistic.id ? real : x))))
      .catch(() => {});
  }

  // ---------- Coupons ----------
  // Coupons are priced authoritatively on the server (backend/src/coupons.js);
  // this tab only manages which codes exist and whether they're active.
  async function addCoupon() {
    setCouponError("");
    const { code, label, kind, value, minSubtotal, maxDiscount } = newCoupon;
    if (!code.trim() || !label.trim() || !value || !maxDiscount) {
      setCouponError("Code, label, value and max discount are required");
      return;
    }
    if (!apiBaseUrl || !token) {
      // No live API - just reflect it locally so the demo still works.
      setCoupons((c) => [{
        id: "temp-" + Date.now(), code: code.trim().toUpperCase(), label, kind,
        value: Number(value), minSubtotal: Number(minSubtotal) || 0, maxDiscount: Number(maxDiscount), active: true,
      }, ...c]);
      setNewCoupon({ code: "", label: "", kind: "PERCENT", value: "", minSubtotal: "", maxDiscount: "" });
      return;
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/coupons`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ code, label, kind, value, minSubtotal, maxDiscount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create coupon");
      setCoupons((c) => [data, ...c]);
      setNewCoupon({ code: "", label: "", kind: "PERCENT", value: "", minSubtotal: "", maxDiscount: "" });
    } catch (err) {
      setCouponError(err.message);
    }
  }

  function toggleCouponActive(id, active) {
    setCoupons((c) => c.map((x) => (x.id === id ? { ...x, active: !active } : x)));
    if (!apiBaseUrl || !token) return;
    fetch(`${apiBaseUrl}/api/coupons/${id}`, {
      method: "PATCH", headers: authHeaders, body: JSON.stringify({ active: !active }),
    }).catch(() => setLoadError("Could not save coupon change"));
  }

  function removeCoupon(id) {
    setCoupons((c) => c.filter((x) => x.id !== id));
    if (!apiBaseUrl || !token) return;
    fetch(`${apiBaseUrl}/api/coupons/${id}`, { method: "DELETE", headers: authHeaders }).catch(() => {});
  }

  const NAV = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "orders", label: "Orders", icon: ShoppingBag },
    { key: "products", label: "Products", icon: Shirt },
    { key: "inventory", label: "Photos", icon: Package },
    { key: "designs", label: "Designs", icon: Palette },
    { key: "zones", label: "Delivery Zones", icon: MapPin },
    { key: "coupons", label: "Coupons", icon: Tag },
  ];

  // Not logged in yet - show a login form instead of the dashboard.
  // (If no API is configured at all, skip the login gate so the mock demo still works.)
  if (apiBaseUrl && !token) {
    return (
      <div style={{ background: COLORS.canvas, minHeight: "100vh", fontFamily: FONTS.body, color: COLORS.charcoal, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
          ${ROOT_TOKENS_CSS}
          * { box-sizing: border-box; }
          button { cursor: pointer; font-family: inherit; }
          input { font-family: inherit; }
        `}</style>
        <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Click to change.`} title={themeLabel} style={{
          position: "fixed", top: 16, right: 16, background: "none", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 8, display: "flex",
        }}>
          <ThemeIcon size={16} color={COLORS.ink} />
        </button>
        <form onSubmit={handleLogin} style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 28, width: 340 }}>
          <p style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, marginBottom: 4 }}>ATHE Admin</p>
          <p style={{ fontSize: 12.5, color: "#64748B", marginBottom: 20 }}>Sign in to manage the store</p>
          <input placeholder="Email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 10 }} />
          <input placeholder="Password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 14 }} />
          {loginError && <p style={{ fontSize: 12, color: COLORS.pink, marginBottom: 10 }}>{loginError}</p>}
          <button type="submit" disabled={loggingIn} style={{
            width: "100%", background: COLORS.chrome, color: COLORS.onChrome, border: "none", padding: "11px 0",
            borderRadius: 8, fontWeight: 700, fontSize: 14, opacity: loggingIn ? 0.6 : 1,
          }}>{loggingIn ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.canvas, minHeight: "100vh", fontFamily: FONTS.body, color: COLORS.charcoal, display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        ${ROOT_TOKENS_CSS}
        * { box-sizing: border-box; }
        button { cursor: pointer; font-family: inherit; }
        input { font-family: inherit; }
      `}</style>

      {/* Sidebar */}
      <aside style={{
        width: 210, background: COLORS.chrome, color: COLORS.onChrome, padding: "22px 14px", flexShrink: 0,
        position: navOpen ? "fixed" : "static", zIndex: 50, height: navOpen ? "100vh" : "auto",
        display: navOpen ? "block" : undefined,
      }} className="hidden md:block">
        <div className="flex items-center gap-2" style={{ marginBottom: 26, paddingLeft: 6 }}>
          <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 20, letterSpacing: 0.5, color: COLORS.onChrome }}>ATHE</span>
        </div>
        <p style={{ fontSize: 10, letterSpacing: 1, color: "#8A93B5", marginBottom: 10, paddingLeft: 6 }}>ADMIN</p>
        <div className="flex items-center gap-2" style={{ marginBottom: 14, paddingLeft: 2 }}>
          <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Click to change.`} title={themeLabel} style={{
            background: "none", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 8, padding: 6, display: "flex",
          }}>
            <ThemeIcon size={14} color={COLORS.onChrome} />
          </button>
          {token && (
            <button onClick={logout} style={{
              background: "none", border: "none", color: "#8A93B5", fontSize: 11, fontWeight: 600,
              padding: "4px 6px", textDecoration: "underline",
            }}>Log out</button>
          )}
        </div>
        {NAV.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setTab(key); setNavOpen(false); }} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", background: tab === key ? "rgba(36,81,255,0.14)" : "none",
            border: "none", color: tab === key ? COLORS.pink : "#D8DCEA", padding: "10px 10px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, marginBottom: 4,
          }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </aside>

      {/* Mobile top bar - "flex" (not inline display) so md:hidden can still
          override it; an inline display:flex would beat the media-query class. */}
      <div className="flex md:hidden" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: COLORS.chrome, color: COLORS.onChrome, padding: "12px 16px", alignItems: "center", justifyContent: "space-between" }}>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 17, letterSpacing: 0.5, color: COLORS.onChrome }}>ATHE</span>
          <p style={{ fontSize: 12, color: "#8A93B5" }}>Admin</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Click to change.`} title={themeLabel} style={{ background: "none", border: "none", color: COLORS.onChrome, padding: 6 }}>
            <ThemeIcon size={18} />
          </button>
          <button onClick={() => setNavOpen((o) => !o)} style={{ background: "none", border: "none", color: COLORS.onChrome }}><Menu size={20} /></button>
        </div>
      </div>
      {navOpen && (
        <div className="md:hidden" style={{ position: "fixed", top: 48, left: 0, right: 0, zIndex: 39, background: COLORS.chrome, padding: 12 }}>
          {NAV.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setTab(key); setNavOpen(false); }} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", background: tab === key ? "rgba(36,81,255,0.14)" : "none",
              border: "none", color: tab === key ? COLORS.pink : "#D8DCEA", padding: "10px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, marginBottom: 4,
            }}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      )}

      {/* Main */}
      <main style={{ flex: 1, padding: "24px 24px 60px", marginTop: 0, maxWidth: 1100 }} className="mt-12 md:mt-0">
        {tab === "overview" && (
          <>
            <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.ink, marginBottom: 16 }}>OVERVIEW</h2>
            <div className="flex flex-wrap gap-3" style={{ marginBottom: 22 }}>
              <KpiCard icon={IndianRupee} label="SALES TODAY" value={`₹${salesToday.toLocaleString("en-IN")}`} sub={`${orders.length} orders`} accent={COLORS.pink} />
              <KpiCard icon={TrendingUp} label="REVENUE THIS MONTH" value={`₹${salesMonth.toLocaleString("en-IN")}`} sub={`${ordersMonth} orders`} />
              <KpiCard icon={ShoppingBag} label="AVG ORDER VALUE" value={`₹${avgOrder}`} />
              <KpiCard icon={Truck} label="DELIVERY FEES COLLECTED (MTD)" value={`₹${deliveryExpenseMonth.toLocaleString("en-IN")}`} sub={`from ${homeOrdersMonth} home delivery order${homeOrdersMonth === 1 ? "" : "s"}`} accent={COLORS.warn} />
            </div>

            <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Recent orders</p>
              {orders.length === 0 && (
                <p style={{ fontSize: 12.5, color: "#94A3B8", padding: "6px 0" }}>No orders yet.</p>
              )}
              {orders.slice(0, 5).map((o) => (
                <div key={o.id} className="flex items-center justify-between" style={{ padding: "9px 0", borderBottom: `1px solid ${COLORS.line}` }}>
                  <div>
                    <p style={{ fontFamily: FONTS.mono, fontSize: 12 }}>{o.id}</p>
                    <p style={{ fontSize: 11.5, color: "#64748B" }}>{o.item}</p>
                  </div>
                  <Badge status={o.status} />
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "orders" && (
          <>
            <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.ink, marginBottom: 16 }}>ORDERS</h2>
            <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, overflow: "hidden" }}>
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between flex-wrap gap-2" style={{ padding: "14px 16px", borderBottom: `1px solid ${COLORS.line}` }}>
                  <div>
                    <p style={{ fontFamily: FONTS.mono, fontSize: 12.5 }}>{o.id} <span style={{ color: "#94A3B8" }}>· {o.time}</span></p>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{o.customer}</p>
                    <p style={{ fontSize: 11.5, color: "#64748B" }}>{o.item}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 11, background: o.type === "home" ? "#EAF2FB" : "#F1EFE6", color: o.type === "home" ? "#3A7CA5" : "#7A6E4E", padding: "3px 9px", borderRadius: 999, fontWeight: 700 }}>
                      {o.type === "home" ? "Home" : "Stall"}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>₹{o.total}</span>
                    <Badge status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "inventory" && (
          <>
            <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.ink, marginBottom: 6 }}>GARMENT PHOTOS</h2>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
              Add a real photo per garment type/colour so the storefront shows your actual product instead of a placeholder shape.
              This list follows whatever types exist on the Products tab - add or delete a type there and its photo slots
              appear or disappear here too. Stock levels live on the Products tab, per product/colour/size.
            </p>
            {types.length === 0 ? (
              <p style={{ fontSize: 13, color: "#64748B" }}>No garment types yet - add one on the Products tab first.</p>
            ) : (
              <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, overflow: "hidden" }}>
                {types.flatMap((t) => GARMENT_COLORS.map((c) => {
                  const key = `${t.id}:${c.id}`;
                  const photoUrl = photosByKey[key];
                  return (
                    <div key={key} className="flex items-center justify-between gap-3" style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.line}` }}>
                      <div className="flex items-center gap-3">
                        {photoUrl ? (
                          <img src={photoUrl} alt={`${t.name} ${c.name}`} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: COLORS.canvasDeep, flexShrink: 0 }} />
                        )}
                        <p style={{ fontSize: 13.5, fontWeight: 600 }}>{t.name} · {c.name}</p>
                      </div>
                      <label style={{
                        fontSize: 11, fontWeight: 700, color: COLORS.accent, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 4,
                        opacity: uploadingPhotoId === key ? 0.5 : 1,
                      }}>
                        <Upload size={12} />
                        {uploadingPhotoId === key ? "Uploading…" : photoUrl ? "Replace photo" : "Add photo"}
                        <input type="file" accept="image/*" style={{ display: "none" }}
                          disabled={uploadingPhotoId === key}
                          onChange={(e) => uploadGarmentPhoto(key, e.target.files?.[0])} />
                      </label>
                    </div>
                  );
                }))}
              </div>
            )}
          </>
        )}

        {tab === "products" && (
          <ProductsPanel
            products={products}
            types={types}
            onField={updateProductField}
            onStock={updateVariantStock}
            onAddProduct={addProduct}
            onRemoveProduct={removeProduct}
            onAddType={addProductType}
            onRemoveType={removeProductType}
          />
        )}

        {tab === "designs" && (
          <>
            <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.ink, marginBottom: 16 }}>DESIGNS</h2>
            <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>ADD NEW DESIGN</p>
              <div className="flex gap-2 flex-wrap" style={{ marginBottom: 10 }}>
                <input placeholder="Design name" value={newDesignName} onChange={(e) => setNewDesignName(e.target.value)}
                  style={{ flex: 1, minWidth: 140, padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13 }} />
                <input placeholder="Tag (e.g. Streetwear)" value={newDesignTag} onChange={(e) => setNewDesignTag(e.target.value)}
                  style={{ flex: 1, minWidth: 140, padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13 }} />
                <select value={newDesignAudience} onChange={(e) => setNewDesignAudience(e.target.value)}
                  style={{ padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13 }}>
                  <option value="all">Everyone</option>
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                  <option value="unisex">Unisex</option>
                </select>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label style={{
                  display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  padding: "9px 12px", borderRadius: 8, border: `1.5px dashed ${COLORS.line}`, color: newDesignFile ? COLORS.good : "#475569",
                }}>
                  <Upload size={14} />
                  {newDesignFile ? newDesignFile.name : "Choose design image"}
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => setNewDesignFile(e.target.files?.[0] || null)} />
                </label>
                <button onClick={addDesign} disabled={uploadingDesign} style={{
                  background: COLORS.chrome, color: COLORS.onChrome, border: "none", padding: "9px 16px", borderRadius: 8,
                  fontWeight: 700, fontSize: 13, opacity: uploadingDesign ? 0.6 : 1,
                }}>{uploadingDesign ? "Uploading…" : "Add"}</button>
              </div>
              {designUploadError && <p style={{ fontSize: 12, color: COLORS.pink, marginTop: 8 }}>{designUploadError}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {designs.map((d) => (
                <div key={d.id} style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14 }}>
                  <div className="flex items-center gap-3">
                    {d.imageUrl && (
                      <img src={d.imageUrl} alt={d.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    )}
                    <div className="flex items-center justify-between" style={{ flex: 1 }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{d.name}</p>
                        <p style={{ fontSize: 11.5, color: "#64748B" }}>{d.tag} {d.audience && d.audience !== "all" ? `· ${d.audience}` : ""}</p>
                      </div>
                      <button onClick={() => removeDesign(d.id)} style={{ background: "none", border: "none", color: COLORS.pink }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                  {d.pending && (
                    <p style={{ fontSize: 11, color: COLORS.mustard, fontWeight: 700, marginTop: 8 }}>⏳ Awaiting your review — a customer uploaded this</p>
                  )}
                  <div className="flex gap-2" style={{ marginTop: 10 }}>
                    <button onClick={() => toggleDesign(d.id, "active")} style={{
                      fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999,
                      border: `1px solid ${d.active ? COLORS.good : COLORS.line}`,
                      color: d.active ? COLORS.good : "#94A3B8", background: "none",
                    }}>{d.active ? "Live on site" : "Hidden"}</button>
                    <button onClick={() => toggleDesign(d.id, "trending")} style={{
                      fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999,
                      border: `1px solid ${d.trending ? COLORS.mustard : COLORS.line}`,
                      color: d.trending ? "#946200" : "#94A3B8", background: d.trending ? "#FFF6DE" : "none",
                    }}>{d.trending ? "★ Trending" : "Mark trending"}</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "zones" && (
          <>
            <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.ink, marginBottom: 16 }}>DELIVERY ZONES</h2>
            <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>ADD PINCODE</p>
              <div className="flex gap-2 flex-wrap">
                <input placeholder="Pincode" value={newZone.pincode} onChange={(e) => setNewZone({ ...newZone, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                  style={{ width: 110, padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13 }} />
                <input placeholder="Distance (km)" value={newZone.km} onChange={(e) => setNewZone({ ...newZone, km: e.target.value.replace(/\D/g, "") })}
                  style={{ width: 120, padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13 }} />
                <input placeholder="Fee (₹)" value={newZone.fee} onChange={(e) => setNewZone({ ...newZone, fee: e.target.value.replace(/\D/g, "") })}
                  style={{ width: 100, padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13 }} />
                <button onClick={addZone} style={{ background: COLORS.chrome, color: COLORS.onChrome, border: "none", padding: "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>Add</button>
              </div>
              <p style={{ fontSize: 11, color: "#64748B", marginTop: 8 }}>Rule of thumb: ≤5 km → ₹100, &gt;5 km → ₹200. Override per pincode if needed.</p>
            </div>
            <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, overflow: "hidden" }}>
              {zones.map((z) => (
                <div key={z.id} className="flex items-center justify-between" style={{ padding: "11px 16px", borderBottom: `1px solid ${COLORS.line}` }}>
                  <p style={{ fontFamily: FONTS.mono, fontSize: 13 }}>{z.pincode}</p>
                  <p style={{ fontSize: 12.5, color: "#64748B" }}>{z.km} km</p>
                  <p style={{ fontWeight: 700, fontSize: 13 }}>₹{z.fee}</p>
                  <button onClick={() => removeZone(z.id)} style={{ background: "none", border: "none", color: COLORS.pink }}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "coupons" && (
          <>
            <h2 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.ink, marginBottom: 16 }}>COUPONS</h2>
            <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>ADD NEW COUPON</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2" style={{ marginBottom: 10 }}>
                <input placeholder="CODE (e.g. ATHE20)" value={newCoupon.code}
                  onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                  style={{ padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13, textTransform: "uppercase" }} />
                <input placeholder="Label shown to customers" value={newCoupon.label}
                  onChange={(e) => setNewCoupon({ ...newCoupon, label: e.target.value })}
                  style={{ padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13, gridColumn: "span 2 / span 2" }} />
                <select value={newCoupon.kind} onChange={(e) => setNewCoupon({ ...newCoupon, kind: e.target.value })}
                  style={{ padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13 }}>
                  <option value="PERCENT">% off</option>
                  <option value="FLAT">₹ flat off</option>
                </select>
                <input placeholder={newCoupon.kind === "PERCENT" ? "Value (e.g. 20)" : "Value in ₹"} value={newCoupon.value}
                  onChange={(e) => setNewCoupon({ ...newCoupon, value: e.target.value.replace(/\D/g, "") })}
                  style={{ padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13 }} />
                <input placeholder="Max discount (₹)" value={newCoupon.maxDiscount}
                  onChange={(e) => setNewCoupon({ ...newCoupon, maxDiscount: e.target.value.replace(/\D/g, "") })}
                  style={{ padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13 }} />
                <input placeholder="Min order value (₹, optional)" value={newCoupon.minSubtotal}
                  onChange={(e) => setNewCoupon({ ...newCoupon, minSubtotal: e.target.value.replace(/\D/g, "") })}
                  style={{ padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13 }} />
              </div>
              {couponError && <p style={{ fontSize: 11.5, color: COLORS.pink, marginBottom: 8 }}>{couponError}</p>}
              <button onClick={addCoupon} style={{ background: COLORS.chrome, color: COLORS.onChrome, border: "none", padding: "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>Add coupon</button>
            </div>

            {coupons.length === 0 ? (
              <p style={{ fontSize: 13, color: "#64748B" }}>No coupons yet — add one above to start offering discounts on the storefront.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {coupons.map((c) => (
                  <div key={c.id} style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14 }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 14 }}>{c.code}</p>
                        <p style={{ fontSize: 11.5, color: "#64748B" }}>{c.label}</p>
                      </div>
                      <button onClick={() => removeCoupon(c.id)} style={{ background: "none", border: "none", color: COLORS.pink }}><Trash2 size={15} /></button>
                    </div>
                    <p style={{ fontSize: 11.5, color: "#64748B", marginTop: 8 }}>
                      {c.kind === "PERCENT" ? `${c.value}% off` : `₹${c.value} off`} · up to ₹{c.maxDiscount}
                      {c.minSubtotal > 0 ? ` · min ₹${c.minSubtotal}` : ""}
                    </p>
                    <div className="flex gap-2" style={{ marginTop: 10 }}>
                      <button onClick={() => toggleCouponActive(c.id, c.active)} style={{
                        fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999,
                        border: `1px solid ${c.active ? COLORS.good : COLORS.line}`,
                        color: c.active ? COLORS.good : "#94A3B8", background: "none",
                      }}>{c.active ? "Live on site" : "Paused"}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
