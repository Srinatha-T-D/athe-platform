import React, { useState, useEffect } from "react";
import { Package, Printer, Check, Truck, MapPin, Home, Clock, ChevronRight, Sun, Moon, Monitor } from "lucide-react";

// Same "Signal Mono" palette as the storefront and admin (off-black ink,
// cool paper canvas, one locked cobalt accent) so admin/staff/shop feel
// like one brand. `pink`/`mustard`/`good` are kept as names but now
// resolve to accent/amber/green. Values are CSS custom properties so
// dark mode swaps for free.
const COLORS = {
  canvas: "var(--canvas)", ink: "var(--ink)", pink: "var(--accent)", mustard: "var(--amber)",
  charcoal: "var(--ink)", line: "var(--line)", panel: "var(--surface)", good: "var(--good)",
  onDark: "var(--on-dark)", chrome: "var(--chrome)", onChrome: "var(--on-chrome)",
};
const FONTS = {
  display: "'Space Grotesk', sans-serif",
  body: "'Manrope', sans-serif",
  mono: "'Space Mono', monospace",
};

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

// No seed orders - the queue is whatever the storefront actually sends,
// once both apps share a backend (see loadOrders below).
const INITIAL_ORDERS = [];

// Quick-pick reasons for staff-initiated cancellations, shown to the
// customer on their tracking page. "Custom reason" opens a free-text field.
const STAFF_CANCEL_REASONS = [
  "Printing defect - couldn't be salvaged",
  "Out of material for this design/colour",
  "Design isn't printable as submitted",
  "Wrong item was started by mistake",
];

// order flow depends on delivery type
const FLOW = {
  stall: ["placed", "printing", "ready", "delivered"],
  home: ["placed", "printing", "ready", "out", "delivered"],
};
const STEP_META = {
  placed: { label: "Accept & start printing", next: "printing", icon: Package },
  printing: { label: "Mark ready", next: "ready", icon: Printer },
  ready_stall: { label: "Mark picked up at stall", next: "delivered", icon: Check },
  ready_home: { label: "Send out for delivery", next: "out", icon: Truck },
  out: { label: "Mark delivered", next: "delivered", icon: Check },
};

function StatusPill({ status, cancelled }) {
  const map = {
    placed: { label: "New", color: "#8A8D93" },
    printing: { label: "Printing", color: COLORS.pink },
    ready: { label: "Ready", color: COLORS.mustard },
    out: { label: "Out for delivery", color: "#3A7CA5" },
    delivered: { label: "Delivered", color: COLORS.good },
  };
  const s = cancelled ? { label: "Cancelled", color: "#DC2626" } : map[status];
  return <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: s.color, padding: "3px 10px", borderRadius: 999 }}>{s.label}</span>;
}

export default function AtheStaff({ apiBaseUrl = "" }) {
  const { cycle: cycleTheme, Icon: ThemeIcon, label: themeLabel } = useTheme("athe_staff_theme");
  const [token, setToken] = useState(() => localStorage.getItem("athe_staff_token") || "");
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
      localStorage.setItem("athe_staff_token", data.token);
      setToken(data.token);
    } catch (err) {
      setLoginError(err.message || "Login failed");
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() {
    localStorage.removeItem("athe_staff_token");
    setToken("");
  }

  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [filter, setFilter] = useState("active");

  function mapOrder(o) {
    return {
      id: o.code,
      item: o.items?.length ? `${o.items.length} item(s)` : "Order",
      type: o.deliveryType?.toLowerCase(),
      status: o.status?.toLowerCase(),
      time: new Date(o.createdAt).toLocaleTimeString(),
      cancelled: !!o.cancelled,
      cancelReason: o.cancelReason,
      _dbId: o.id,
    };
  }

  function loadOrders() {
    if (!apiBaseUrl || !token) return;
    fetch(`${apiBaseUrl}/api/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setOrders(data.map(mapOrder)))
      .catch(() => {});
  }

  useEffect(() => {
    loadOrders();
    if (!apiBaseUrl || !token) return;
    const poll = setInterval(loadOrders, 8000); // keep the queue fresh as new orders come in
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, token]);

  function advance(id) {
    const target = orders.find((o) => o.id === id);
    setOrders((os) =>
      os.map((o) => {
        if (o.id !== id) return o;
        const flow = FLOW[o.type];
        const idx = flow.indexOf(o.status);
        const next = flow[Math.min(idx + 1, flow.length - 1)];
        return { ...o, status: next };
      })
    );
    if (!apiBaseUrl || !token || !target?._dbId) return;
    fetch(`${apiBaseUrl}/api/orders/${target._dbId}/advance`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  // Staff can cancel an order any time between it being accepted and
  // delivered - e.g. a printing defect - as long as a reason is given, so
  // the customer sees why on their tracking page (once both apps share a
  // backend; this app's own queue always reflects it immediately).
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  function cancelOrder(id, reason) {
    if (!reason.trim()) return;
    const target = orders.find((o) => o.id === id);
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, cancelled: true, cancelReason: reason.trim() } : o)));
    setCancellingId(null);
    if (!apiBaseUrl || !token || !target?._dbId) return;
    fetch(`${apiBaseUrl}/api/orders/${target._dbId}/cancel`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim(), cancelledBy: "staff" }),
    }).catch(() => {});
  }

  const visible = orders.filter((o) => {
    if (filter === "cancelled") return !!o.cancelled;
    if (filter === "done") return o.status === "delivered" && !o.cancelled;
    return o.status !== "delivered" && !o.cancelled;
  });
  const counts = {
    placed: orders.filter((o) => o.status === "placed").length,
    printing: orders.filter((o) => o.status === "printing").length,
    ready: orders.filter((o) => o.status === "ready" || o.status === "out").length,
  };

  // Not logged in yet - show a login form instead of the queue.
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
        <form onSubmit={handleLogin} style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 28, width: 320, margin: "0 16px" }}>
          <p style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 20, marginBottom: 4 }}>ATHE · Staff</p>
          <p style={{ fontSize: 12.5, color: "#64748B", marginBottom: 20 }}>Sign in to manage orders</p>
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
    <div style={{ background: COLORS.canvas, minHeight: "100vh", fontFamily: FONTS.body, color: COLORS.charcoal }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        ${ROOT_TOKENS_CSS}
        * { box-sizing: border-box; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>

      <header style={{ position: "sticky", top: 0, background: COLORS.chrome, color: COLORS.onChrome, padding: "16px 18px", zIndex: 10 }}>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 20, letterSpacing: 0.5, color: COLORS.onChrome }}>ATHE</span>
          <p style={{ fontSize: 13, color: "#94A3B8" }}>· Staff</p>
          <div className="flex items-center gap-2" style={{ marginLeft: "auto" }}>
            <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Click to change.`} title={themeLabel} style={{
              background: "none", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 8, padding: 6, display: "flex",
            }}>
              <ThemeIcon size={14} color={COLORS.onChrome} />
            </button>
            {token && (
              <button onClick={logout} style={{
                background: "none", border: "none", color: "#94A3B8",
                fontSize: 11, fontWeight: 600, textDecoration: "underline",
              }}>Log out</button>
            )}
          </div>
        </div>
        <div className="flex gap-3" style={{ marginTop: 12 }}>
          {[
            { label: "New", value: counts.placed, color: COLORS.onChrome },
            { label: "Printing", value: counts.printing, color: COLORS.pink },
            { label: "Ready / Out", value: counts.ready, color: COLORS.mustard },
          ].map((s) => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 10, padding: "8px 14px", flex: 1 }}>
              <p style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 18, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </header>

      <div style={{ padding: "14px 16px 0", maxWidth: 560, margin: "0 auto" }}>
        <div className="flex gap-2 flex-wrap">
          {[{ k: "active", label: "Active orders" }, { k: "done", label: "Delivered" }, { k: "cancelled", label: "Cancelled" }].map((f) => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{
              padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700,
              border: `1px solid ${COLORS.ink}`, background: filter === f.k ? COLORS.chrome : "transparent",
              color: filter === f.k ? COLORS.onChrome : COLORS.ink,
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "14px 16px 60px", maxWidth: 560, margin: "0 auto", display: "grid", gap: 12 }}>
        {visible.length === 0 && (
          <p style={{ textAlign: "center", color: "#94A3B8", fontSize: 13, padding: "40px 0" }}>Nothing here right now.</p>
        )}
        {visible.map((o) => {
          const stepKey = o.status === "ready" ? (o.type === "home" ? "ready_home" : "ready_stall") : o.status;
          const meta = STEP_META[stepKey];
          const Icon = meta ? meta.icon : Check;
          return (
            <div key={o.id} style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <p style={{ fontFamily: FONTS.mono, fontSize: 13 }}>{o.id}</p>
                <StatusPill status={o.status} cancelled={o.cancelled} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{o.item}</p>
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                {o.type === "home" ? <Home size={13} color="#64748B" /> : <MapPin size={13} color="#64748B" />}
                <span style={{ fontSize: 11.5, color: "#64748B" }}>{o.type === "home" ? "Home delivery" : "Stall pickup"}</span>
                <Clock size={13} color="#64748B" style={{ marginLeft: 6 }} />
                <span style={{ fontSize: 11.5, color: "#64748B" }}>{o.time}</span>
              </div>

              {o.cancelled ? (
                <p style={{ fontSize: 12, color: "#DC2626", background: "#FEF2F2", borderRadius: 8, padding: "8px 10px" }}>
                  Cancelled: {o.cancelReason}
                </p>
              ) : (
                <>
                  {o.status !== "delivered" && meta && (
                    <button onClick={() => advance(o.id)} style={{
                      width: "100%", background: COLORS.chrome, color: COLORS.onChrome, border: "none",
                      padding: "13px 0", borderRadius: 10, fontWeight: 700, fontSize: 14,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}>
                      <Icon size={16} /> {meta.label} <ChevronRight size={15} />
                    </button>
                  )}

                  {o.status !== "delivered" && (
                    cancellingId === o.id ? (
                      <div style={{ marginTop: 10, borderTop: `1px solid ${COLORS.line}`, paddingTop: 10 }}>
                        <p style={{ fontSize: 11.5, fontWeight: 700, color: "#DC2626", marginBottom: 6 }}>WHY IS THIS ORDER BEING CANCELLED?</p>
                        <div className="flex flex-col gap-1" style={{ marginBottom: 8 }}>
                          {STAFF_CANCEL_REASONS.map((r) => (
                            <button key={r} onClick={() => setCancelReasonDraft(r)} style={{
                              textAlign: "left", fontSize: 12, padding: "7px 9px", borderRadius: 8,
                              border: `1px solid ${cancelReasonDraft === r ? "#DC2626" : COLORS.line}`,
                              background: cancelReasonDraft === r ? "#FEF2F2" : "none", color: COLORS.ink,
                            }}>{r}</button>
                          ))}
                        </div>
                        <textarea placeholder="Or type a custom reason - this is shown to the customer" value={cancelReasonDraft}
                          onChange={(e) => setCancelReasonDraft(e.target.value)} rows={2}
                          style={{ width: "100%", padding: "8px 9px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 12.5, resize: "none", marginBottom: 8 }} />
                        <div className="flex gap-2">
                          <button
                            disabled={!cancelReasonDraft.trim()}
                            onClick={() => cancelOrder(o.id, cancelReasonDraft)}
                            style={{ flex: 1, background: "#DC2626", color: "#fff", border: "none", padding: "10px 0", borderRadius: 8, fontWeight: 700, fontSize: 13, opacity: cancelReasonDraft.trim() ? 1 : 0.5 }}
                          >Confirm cancellation</button>
                          <button onClick={() => { setCancellingId(null); setCancelReasonDraft(""); }} style={{ background: "none", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>Back</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setCancellingId(o.id); setCancelReasonDraft(""); }} style={{
                        width: "100%", background: "none", border: "none", color: "#DC2626", fontSize: 12, fontWeight: 600, marginTop: 8, padding: "4px 0",
                      }}>Cancel this order</button>
                    )
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
