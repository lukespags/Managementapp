"use client";

import { useState, useEffect, useReducer, useCallback } from "react";

// ─── Constants ───
const LS_DATA = "backstage-data";
const LS_SETTINGS = "backstage-settings";

const defaultSettings = {
  aboss: {
    token: "",
    projectId: "",
    accountType: "artist",
    agencyId: "",
    connected: false,
    lastSync: null,
  },
};

const defaultData = {
  artists: [
    { id: "cyril", name: "CYRIL", color: "#FF6B35", avatar: "C" },
  ],
  releases: [
    { id: "r1", artistId: "cyril", title: "Think About Us (CYRIL Remix)", type: "Remix", status: "released", date: "2025-02-07", label: "Defected Records", notes: "Sonny Fodera collab remix" },
    { id: "r2", artistId: "cyril", title: "New Single", type: "Single", status: "in-progress", date: "2025-03-21", label: "TBA", notes: "Upcoming release - master due March 7" },
  ],
  shows: [
    { id: "s1", artistId: "cyril", venue: "The Ivy", city: "Sydney", country: "AU", date: "2025-02-22", fee: "$8,500", status: "confirmed", notes: "Premium venue - VIP setup required", source: "manual" },
    { id: "s2", artistId: "cyril", venue: "Marquee", city: "Las Vegas", country: "US", date: "2025-03-01", fee: "$12,000", status: "confirmed", notes: "Part of LV → MEL → TKY routing", source: "manual" },
    { id: "s3", artistId: "cyril", venue: "WOMB", city: "Tokyo", country: "JP", date: "2025-03-08", fee: "¥1,200,000", status: "pending", notes: "Awaiting final confirmation", source: "manual" },
  ],
  socialPosts: [
    { id: "p1", artistId: "cyril", platform: "Instagram", type: "Reel", date: "2025-02-14", caption: "Think About Us remix out now 🔊", status: "scheduled" },
    { id: "p2", artistId: "cyril", platform: "TikTok", type: "Video", date: "2025-02-15", caption: "Studio session preview", status: "draft" },
    { id: "p3", artistId: "cyril", platform: "Instagram", type: "Story", date: "2025-02-16", caption: "Sydney show countdown", status: "draft" },
  ],
  abossShows: [],
};

// ─── Reducer ───
function appReducer(state, action) {
  switch (action.type) {
    case "LOAD_DATA": return { ...state, ...action.payload };
    case "ADD_ARTIST": return { ...state, artists: [...state.artists, action.payload] };
    case "ADD_RELEASE": return { ...state, releases: [...state.releases, action.payload] };
    case "ADD_SHOW": return { ...state, shows: [...state.shows, action.payload] };
    case "ADD_POST": return { ...state, socialPosts: [...state.socialPosts, action.payload] };
    case "UPDATE_POST": return { ...state, socialPosts: state.socialPosts.map((p) => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
    case "SET_ABOSS_SHOWS": return { ...state, abossShows: action.payload };
    default: return state;
  }
}

// ─── Utility ───
const uid = () => Math.random().toString(36).slice(2, 9);
const formatDate = (d) => {
  const date = new Date(d.includes("T") ? d : d + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const formatDateFull = (d) => {
  const date = new Date(d.includes("T") ? d : d + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
};
const daysUntil = (d) => {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(d.includes("T") ? d : d + "T00:00:00");
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
};

const statusColors = {
  released: { bg: "#E8F5E9", text: "#2E7D32" },
  "in-progress": { bg: "#FFF3E0", text: "#E65100" },
  upcoming: { bg: "#E3F2FD", text: "#1565C0" },
  confirmed: { bg: "#E8F5E9", text: "#2E7D32" },
  Confirmed: { bg: "#E8F5E9", text: "#2E7D32" },
  pending: { bg: "#FFF8E1", text: "#F57F17" },
  Pending: { bg: "#FFF8E1", text: "#F57F17" },
  cancelled: { bg: "#FFEBEE", text: "#C62828" },
  Cancelled: { bg: "#FFEBEE", text: "#C62828" },
  scheduled: { bg: "#E8F5E9", text: "#2E7D32" },
  draft: { bg: "#F3E5F5", text: "#7B1FA2" },
  posted: { bg: "#E0F2F1", text: "#00695C" },
  Option: { bg: "#E3F2FD", text: "#1565C0" },
  Offer: { bg: "#FFF3E0", text: "#E65100" },
};

const platformIcons = { Instagram: "📸", TikTok: "🎵", Twitter: "𝕏", YouTube: "▶️", Facebook: "📘" };

// ─── ABOSS Fetch (via our API proxy) ───
async function fetchAbossEvents(settings) {
  const { token, projectId, accountType, agencyId } = settings.aboss;
  if (!token || !projectId) return [];

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const to = new Date(now.getFullYear(), now.getMonth() + 12, 0).toISOString().split("T")[0];

  const params = new URLSearchParams({
    accountType,
    projectId,
    from,
    to,
  });
  if (agencyId) params.set("agencyId", agencyId);

  const res = await fetch(`/api/aboss?${params.toString()}`, {
    headers: { "x-aboss-token": token },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function normalizeAbossEvent(event) {
  return {
    id: `aboss-${event.id}`,
    abossId: event.id,
    venue: event.location?.title || event.title || "TBA",
    city: event.location?.city || "",
    country: event.location?.country || "",
    date: event.start ? event.start.split("T")[0] : "",
    dateTime: event.start || "",
    endDateTime: event.end || "",
    status: event.status || "confirmed",
    eventType: event.eventType || "",
    title: event.title || "",
    website: event.website || "",
    ticketLink: event.ticketLink || "",
    lineUp: event.lineUp || "",
    publicNotes: event.publicNotes || "",
    tba: event.tba || false,
    source: "aboss",
  };
}

// ─── Shared Components ───
function StatusBadge({ status }) {
  const c = statusColors[status] || statusColors[status?.toLowerCase?.()] || { bg: "#F5F5F5", text: "#616161" };
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", backgroundColor: c.bg, color: c.text }}>
      {status}
    </span>
  );
}

function AbossBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "#EDE7F6", color: "#5E35B1", letterSpacing: 0.3 }}>
      ⚡ ABOSS
    </span>
  );
}

function ArtistPill({ artist, selected, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px 6px 6px", borderRadius: 24, border: selected ? `2px solid ${artist.color}` : "2px solid #E5E5EA", background: selected ? `${artist.color}12` : "#fff", cursor: "pointer", transition: "all 0.2s", fontSize: 13, fontWeight: 600, color: selected ? artist.color : "#86868B", fontFamily: "inherit" }}>
      <span style={{ width: 26, height: 26, borderRadius: "50%", background: artist.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{artist.avatar}</span>
      {artist.name}
    </button>
  );
}

function Card({ children, onClick, style: s = {} }) {
  return (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 16, padding: 18, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)", cursor: onClick ? "pointer" : "default", transition: "transform 0.15s, box-shadow 0.15s", ...s }}
      onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, count, onAdd, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1D1D1F", margin: 0, letterSpacing: -0.3 }}>{title}</h2>
        {count !== undefined && <span style={{ fontSize: 13, color: "#86868B", fontWeight: 500 }}>{count}</span>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {right}
        {onAdd && <button onClick={onAdd} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#007AFF", color: "#fff", fontSize: 20, fontWeight: 300, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, fontFamily: "inherit" }}>+</button>}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return <div style={{ textAlign: "center", padding: "40px 20px", color: "#86868B" }}><div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div><p style={{ fontSize: 14, margin: 0 }}>{text}</p></div>;
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 500, maxHeight: "85vh", overflow: "auto", padding: "20px 24px 40px", animation: "slideUp 0.3s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1D1D1F", margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "#F2F2F7", border: "none", borderRadius: "50%", width: 30, height: 30, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#86868B", fontFamily: "inherit" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return <div style={{ marginBottom: 16 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>{children}</div>;
}

const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid #E5E5EA", fontSize: 15, fontFamily: "inherit", color: "#1D1D1F", outline: "none", boxSizing: "border-box", background: "#F9F9FB", transition: "border-color 0.15s" };
const selectStyle = { ...inputStyle, appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2386868B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: 36 };
const btnPrimary = { width: "100%", padding: "14px", borderRadius: 14, border: "none", background: "#007AFF", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 8 };

// ─── Dashboard ───
function DashboardView({ data, selectedArtist, settings }) {
  const releases = data.releases.filter((r) => r.artistId === selectedArtist);
  const manualShows = data.shows.filter((s) => s.artistId === selectedArtist);
  const allShows = [...manualShows, ...data.abossShows];
  const posts = data.socialPosts.filter((p) => p.artistId === selectedArtist);

  const upcomingShows = allShows.filter((s) => daysUntil(s.date) >= 0).sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcomingReleases = releases.filter((r) => r.status !== "released").sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcomingPosts = posts.filter((p) => p.status !== "posted").sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Releases", value: releases.length, sub: `${upcomingReleases.length} upcoming`, color: "#FF6B35" },
          { label: "Shows", value: allShows.length, sub: settings.aboss.connected ? `${data.abossShows.length} from ABOSS` : `${upcomingShows.length} upcoming`, color: "#007AFF" },
          { label: "Content", value: posts.length, sub: `${upcomingPosts.length} pending`, color: "#AF52DE" },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "#fff", borderRadius: 16, padding: "16px 14px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color, letterSpacing: -1 }}>{stat.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1D1D1F", marginTop: 2 }}>{stat.label}</div>
            <div style={{ fontSize: 11, color: "#86868B", marginTop: 2 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {settings.aboss.connected && settings.aboss.lastSync && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, padding: "8px 12px", background: "#EDE7F6", borderRadius: 10 }}>
          <span style={{ fontSize: 12, color: "#5E35B1", fontWeight: 600 }}>⚡ ABOSS synced</span>
          <span style={{ fontSize: 11, color: "#7E57C2" }}>· {new Date(settings.aboss.lastSync).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
        </div>
      )}

      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Up Next</h3>

      {upcomingShows.length === 0 && upcomingReleases.length === 0 && upcomingPosts.length === 0 ? (
        <EmptyState icon="📋" text="Nothing upcoming — add some items!" />
      ) : (
        <div>
          {upcomingShows.slice(0, 3).map((show) => {
            const days = daysUntil(show.date);
            return (
              <Card key={show.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#007AFF", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        🎤 Show {days === 0 ? "· Today" : days === 1 ? "· Tomorrow" : `· ${days}d`}
                      </span>
                      {show.source === "aboss" && <AbossBadge />}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#1D1D1F" }}>{show.venue}</div>
                    {show.title && show.title !== show.venue && <div style={{ fontSize: 13, color: "#1D1D1F", marginTop: 2 }}>{show.title}</div>}
                    <div style={{ fontSize: 13, color: "#86868B", marginTop: 2 }}>{show.city}{show.country ? `, ${show.country}` : ""} · {formatDate(show.date)}</div>
                  </div>
                  <StatusBadge status={show.status} />
                </div>
              </Card>
            );
          })}
          {upcomingReleases.slice(0, 2).map((rel) => (
            <Card key={rel.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>💿 Release · {daysUntil(rel.date)}d</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#1D1D1F" }}>{rel.title}</div>
                  <div style={{ fontSize: 13, color: "#86868B", marginTop: 2 }}>{rel.type} · {formatDate(rel.date)}</div>
                </div>
                <StatusBadge status={rel.status} />
              </div>
            </Card>
          ))}
          {upcomingPosts.slice(0, 2).map((post) => (
            <Card key={post.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#AF52DE", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{platformIcons[post.platform] || "📱"} {post.platform} · {post.type}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1D1D1F" }}>{post.caption}</div>
                  <div style={{ fontSize: 13, color: "#86868B", marginTop: 2 }}>{formatDate(post.date)}</div>
                </div>
                <StatusBadge status={post.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Releases ───
function ReleasesView({ data, selectedArtist, dispatch }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", type: "Single", status: "upcoming", date: "", label: "", notes: "" });
  const releases = data.releases.filter((r) => r.artistId === selectedArtist).sort((a, b) => new Date(b.date) - new Date(a.date));

  const addRelease = () => {
    dispatch({ type: "ADD_RELEASE", payload: { ...form, id: uid(), artistId: selectedArtist } });
    setShowForm(false);
    setForm({ title: "", type: "Single", status: "upcoming", date: "", label: "", notes: "" });
  };

  return (
    <div>
      <SectionHeader title="Releases" count={releases.length} onAdd={() => setShowForm(true)} />
      {releases.length === 0 ? <EmptyState icon="💿" text="No releases yet" /> : releases.map((rel) => (
        <Card key={rel.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1D1D1F" }}>{rel.title}</div>
              <div style={{ fontSize: 13, color: "#86868B", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>{rel.type}</span><span>{formatDateFull(rel.date)}</span>{rel.label && <span>{rel.label}</span>}
              </div>
              {rel.notes && <div style={{ fontSize: 13, color: "#8E8E93", marginTop: 6, fontStyle: "italic" }}>{rel.notes}</div>}
            </div>
            <StatusBadge status={rel.status} />
          </div>
        </Card>
      ))}
      {showForm && (
        <Modal title="New Release" onClose={() => setShowForm(false)}>
          <FormField label="Title"><input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Track name" /></FormField>
          <FormField label="Type"><select style={selectStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{["Single", "EP", "Album", "Remix", "Mixtape"].map((t) => <option key={t}>{t}</option>)}</select></FormField>
          <FormField label="Status"><select style={selectStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["upcoming", "in-progress", "released"].map((s) => <option key={s} value={s}>{s}</option>)}</select></FormField>
          <FormField label="Release Date"><input style={inputStyle} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></FormField>
          <FormField label="Label"><input style={inputStyle} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Label name" /></FormField>
          <FormField label="Notes"><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField>
          <button style={btnPrimary} onClick={addRelease} disabled={!form.title || !form.date}>Add Release</button>
        </Modal>
      )}
    </div>
  );
}

// ─── Shows ───
function ShowsView({ data, selectedArtist, dispatch, settings, onSync, syncing }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ venue: "", city: "", country: "", date: "", fee: "", status: "pending", notes: "" });

  const manualShows = data.shows.filter((s) => s.artistId === selectedArtist);
  const allShows = [...manualShows, ...data.abossShows].sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcoming = allShows.filter((s) => daysUntil(s.date) >= 0);
  const past = allShows.filter((s) => daysUntil(s.date) < 0).reverse();

  const addShow = () => {
    dispatch({ type: "ADD_SHOW", payload: { ...form, id: uid(), artistId: selectedArtist, source: "manual" } });
    setShowForm(false);
    setForm({ venue: "", city: "", country: "", date: "", fee: "", status: "pending", notes: "" });
  };

  const renderShow = (show) => {
    const days = daysUntil(show.date);
    return (
      <Card key={show.id}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: "#1D1D1F" }}>{show.venue}</span>
              {show.source === "aboss" && <AbossBadge />}
            </div>
            {show.title && show.title !== show.venue && <div style={{ fontSize: 14, color: "#3A3A3C", marginTop: 2 }}>{show.title}</div>}
            <div style={{ fontSize: 13, color: "#86868B", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span>📍 {show.city}{show.country ? `, ${show.country}` : ""}</span>
              <span>📅 {formatDateFull(show.date)}</span>
              {show.fee && <span>💰 {show.fee}</span>}
              {show.eventType && <span>🏷️ {show.eventType}</span>}
            </div>
            {days >= 0 && days <= 14 && (
              <div style={{ fontSize: 12, fontWeight: 600, color: days <= 3 ? "#FF3B30" : "#FF9500", marginTop: 6 }}>
                {days === 0 ? "TODAY" : days === 1 ? "TOMORROW" : `${days} days away`}
              </div>
            )}
            {(show.notes || show.publicNotes) && <div style={{ fontSize: 13, color: "#8E8E93", marginTop: 6, fontStyle: "italic" }}>{show.notes || show.publicNotes}</div>}
            {show.ticketLink && <a href={show.ticketLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#007AFF", marginTop: 4, display: "inline-block" }} onClick={(e) => e.stopPropagation()}>🎟️ Tickets</a>}
          </div>
          <StatusBadge status={show.status} />
        </div>
      </Card>
    );
  };

  const syncButton = settings.aboss.connected ? (
    <button onClick={onSync} disabled={syncing} style={{ padding: "6px 12px", borderRadius: 20, border: "1.5px solid #5E35B1", background: syncing ? "#EDE7F6" : "#fff", color: "#5E35B1", fontSize: 12, fontWeight: 600, cursor: syncing ? "default" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, opacity: syncing ? 0.7 : 1 }}>
      <span style={{ display: "inline-block", animation: syncing ? "spin 1s linear infinite" : "none" }}>⚡</span>
      {syncing ? "Syncing..." : "Sync ABOSS"}
    </button>
  ) : null;

  return (
    <div>
      <SectionHeader title="Shows" count={allShows.length} onAdd={() => setShowForm(true)} right={syncButton} />
      {allShows.length === 0 ? <EmptyState icon="🎤" text="No shows booked yet" /> : (
        <>
          {upcoming.length > 0 && <><div style={{ fontSize: 12, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Upcoming</div>{upcoming.map(renderShow)}</>}
          {past.length > 0 && <><div style={{ fontSize: 12, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginTop: 20 }}>Past</div>{past.map(renderShow)}</>}
        </>
      )}
      {showForm && (
        <Modal title="New Show" onClose={() => setShowForm(false)}>
          <FormField label="Venue"><input style={inputStyle} value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Venue name" /></FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="City"><input style={inputStyle} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></FormField>
            <FormField label="Country"><input style={inputStyle} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="AU, US, JP..." /></FormField>
          </div>
          <FormField label="Date"><input style={inputStyle} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Fee"><input style={inputStyle} value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} placeholder="$10,000" /></FormField>
            <FormField label="Status"><select style={selectStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["pending", "confirmed", "cancelled"].map((s) => <option key={s}>{s}</option>)}</select></FormField>
          </div>
          <FormField label="Notes"><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField>
          <button style={btnPrimary} onClick={addShow} disabled={!form.venue || !form.date}>Add Show</button>
        </Modal>
      )}
    </div>
  );
}

// ─── Social ───
function SocialView({ data, selectedArtist, dispatch }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ platform: "Instagram", type: "Post", date: "", caption: "", status: "draft" });
  const posts = data.socialPosts.filter((p) => p.artistId === selectedArtist).sort((a, b) => new Date(b.date) - new Date(a.date));

  const addPost = () => {
    dispatch({ type: "ADD_POST", payload: { ...form, id: uid(), artistId: selectedArtist } });
    setShowForm(false);
    setForm({ platform: "Instagram", type: "Post", date: "", caption: "", status: "draft" });
  };

  const cycleStatus = (post) => {
    const order = ["draft", "scheduled", "posted"];
    dispatch({ type: "UPDATE_POST", payload: { id: post.id, status: order[(order.indexOf(post.status) + 1) % order.length] } });
  };

  return (
    <div>
      <SectionHeader title="Social" count={posts.length} onAdd={() => setShowForm(true)} />
      {posts.length === 0 ? <EmptyState icon="📱" text="No content planned yet" /> : posts.map((post) => (
        <Card key={post.id} onClick={() => cycleStatus(post)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{platformIcons[post.platform] || "📱"}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1D1D1F" }}>{post.platform}</span>
                <span style={{ fontSize: 12, color: "#86868B" }}>· {post.type}</span>
              </div>
              <div style={{ fontSize: 15, color: "#1D1D1F", marginTop: 2 }}>{post.caption}</div>
              <div style={{ fontSize: 12, color: "#86868B", marginTop: 4 }}>{formatDateFull(post.date)}</div>
            </div>
            <StatusBadge status={post.status} />
          </div>
          <div style={{ fontSize: 11, color: "#C7C7CC", marginTop: 8 }}>Tap to cycle status</div>
        </Card>
      ))}
      {showForm && (
        <Modal title="New Post" onClose={() => setShowForm(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Platform"><select style={selectStyle} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{["Instagram", "TikTok", "Twitter", "YouTube", "Facebook"].map((p) => <option key={p}>{p}</option>)}</select></FormField>
            <FormField label="Type"><select style={selectStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{["Post", "Reel", "Story", "Video", "Thread", "Short"].map((t) => <option key={t}>{t}</option>)}</select></FormField>
          </div>
          <FormField label="Date"><input style={inputStyle} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></FormField>
          <FormField label="Caption"><textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="What's the post about?" /></FormField>
          <FormField label="Status"><select style={selectStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["draft", "scheduled", "posted"].map((s) => <option key={s}>{s}</option>)}</select></FormField>
          <button style={btnPrimary} onClick={addPost} disabled={!form.caption || !form.date}>Add Post</button>
        </Modal>
      )}
    </div>
  );
}

// ─── Artists ───
function ArtistsView({ data, dispatch, setSelectedArtist }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", color: "#007AFF" });
  const colors = ["#FF6B35", "#007AFF", "#AF52DE", "#FF2D55", "#34C759", "#FF9500", "#5856D6", "#00C7BE"];

  const addArtist = () => {
    const a = { id: uid(), name: form.name, color: form.color, avatar: form.name.charAt(0).toUpperCase() };
    dispatch({ type: "ADD_ARTIST", payload: a });
    setSelectedArtist(a.id);
    setShowForm(false);
    setForm({ name: "", color: "#007AFF" });
  };

  return (
    <div>
      <SectionHeader title="Artists" count={data.artists.length} onAdd={() => setShowForm(true)} />
      {data.artists.map((artist) => (
        <Card key={artist.id} onClick={() => setSelectedArtist(artist.id)}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: artist.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 700 }}>{artist.avatar}</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#1D1D1F" }}>{artist.name}</div>
              <div style={{ fontSize: 13, color: "#86868B", marginTop: 2 }}>
                {data.releases.filter((r) => r.artistId === artist.id).length} releases · {data.shows.filter((s) => s.artistId === artist.id).length} shows · {data.socialPosts.filter((p) => p.artistId === artist.id).length} posts
              </div>
            </div>
          </div>
        </Card>
      ))}
      {showForm && (
        <Modal title="Add Artist" onClose={() => setShowForm(false)}>
          <FormField label="Artist Name"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Artist or project name" /></FormField>
          <FormField label="Color">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {colors.map((c) => <button key={c} onClick={() => setForm({ ...form, color: c })} style={{ width: 36, height: 36, borderRadius: "50%", background: c, border: form.color === c ? "3px solid #1D1D1F" : "3px solid transparent", cursor: "pointer" }} />)}
            </div>
          </FormField>
          <button style={btnPrimary} onClick={addArtist} disabled={!form.name}>Add Artist</button>
        </Modal>
      )}
    </div>
  );
}

// ─── Settings ───
function SettingsView({ settings, setSettings, onSync, syncing, syncError }) {
  const aboss = settings.aboss;
  const [showToken, setShowToken] = useState(false);

  const update = (field, val) => setSettings({ ...settings, aboss: { ...settings.aboss, [field]: val } });

  const disconnect = () => setSettings({ ...settings, aboss: { ...defaultSettings.aboss } });

  return (
    <div>
      <SectionHeader title="Settings" />
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #7C4DFF, #B388FF)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 800 }}>A</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F" }}>ABOSS Integration</div>
            <div style={{ fontSize: 12, color: aboss.connected ? "#2E7D32" : "#86868B", fontWeight: 500 }}>{aboss.connected ? "✓ Connected" : "Not connected"}</div>
          </div>
        </div>
        <FormField label="Account Type">
          <select style={selectStyle} value={aboss.accountType} onChange={(e) => update("accountType", e.target.value)}>
            <option value="artist">Artist</option>
            <option value="agency">Agency</option>
          </select>
        </FormField>
        <FormField label="API Token">
          <div style={{ position: "relative" }}>
            <input style={inputStyle} type={showToken ? "text" : "password"} value={aboss.token} onChange={(e) => update("token", e.target.value)} placeholder="Paste your ABOSS Bearer token" />
            <button onClick={() => setShowToken(!showToken)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#86868B" }}>{showToken ? "🙈" : "👁️"}</button>
          </div>
          <div style={{ fontSize: 11, color: "#86868B", marginTop: 4 }}>Find this in ABOSS → Profile Settings → OAuth 2.0 credentials</div>
        </FormField>
        <FormField label="Project ID">
          <input style={inputStyle} value={aboss.projectId} onChange={(e) => update("projectId", e.target.value)} placeholder="Your ABOSS project/artist ID" />
        </FormField>
        {aboss.accountType === "agency" && (
          <FormField label="Agency ID">
            <input style={inputStyle} value={aboss.agencyId} onChange={(e) => update("agencyId", e.target.value)} placeholder="Your ABOSS agency ID" />
          </FormField>
        )}
        {syncError && <div style={{ padding: "10px 14px", borderRadius: 10, background: "#FFEBEE", color: "#C62828", fontSize: 13, marginBottom: 12, fontWeight: 500 }}>{syncError}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...btnPrimary, flex: 1, background: aboss.token && aboss.projectId ? "#5E35B1" : "#C7C7CC", marginTop: 0 }} disabled={!aboss.token || !aboss.projectId || syncing} onClick={onSync}>
            {syncing ? "Connecting..." : aboss.connected ? "Re-sync" : "Connect & Sync"}
          </button>
          {aboss.connected && <button onClick={disconnect} style={{ ...btnPrimary, flex: 0, width: "auto", padding: "14px 20px", background: "#FF3B30", marginTop: 0 }}>Disconnect</button>}
        </div>
        {aboss.lastSync && <div style={{ fontSize: 12, color: "#86868B", marginTop: 10, textAlign: "center" }}>Last synced: {new Date(aboss.lastSync).toLocaleString()}</div>}
      </Card>
      <Card style={{ background: "#F9F9FB" }}>
        <div style={{ fontSize: 13, color: "#86868B", lineHeight: 1.5 }}>
          <strong style={{ color: "#1D1D1F" }}>🔒 Your data stays private</strong><br /><br />
          Your ABOSS token is stored in your browser&apos;s localStorage. API calls go through this app&apos;s server to ABOSS — your token is never exposed to any third party.
        </div>
      </Card>
    </div>
  );
}

// ─── Main App ───
export default function Home() {
  const [data, dispatch] = useReducer(appReducer, defaultData);
  const [settings, setSettings] = useState(defaultSettings);
  const [tab, setTab] = useState("dashboard");
  const [selectedArtist, setSelectedArtist] = useState("cyril");
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const d = localStorage.getItem(LS_DATA);
      if (d) dispatch({ type: "LOAD_DATA", payload: JSON.parse(d) });
      const s = localStorage.getItem(LS_SETTINGS);
      if (s) setSettings(JSON.parse(s));
    } catch (e) {}
    setLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(LS_DATA, JSON.stringify(data)); } catch (e) {}
  }, [data, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); } catch (e) {}
  }, [settings, loaded]);

  // ABOSS sync
  const syncAboss = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const events = await fetchAbossEvents(settings);
      dispatch({ type: "SET_ABOSS_SHOWS", payload: events.map(normalizeAbossEvent) });
      setSettings((prev) => ({ ...prev, aboss: { ...prev.aboss, connected: true, lastSync: new Date().toISOString() } }));
    } catch (err) {
      setSyncError(`Connection failed: ${err.message}`);
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [settings]);

  const tabs = [
    { id: "dashboard", label: "Home", icon: "◉" },
    { id: "releases", label: "Releases", icon: "💿" },
    { id: "shows", label: "Shows", icon: "🎤" },
    { id: "social", label: "Social", icon: "📱" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  if (!loaded) return null;

  return (
    <div style={{ background: "#F2F2F7", minHeight: "100vh", maxWidth: 500, margin: "0 auto", position: "relative", paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ background: "#fff", padding: "16px 20px 14px", borderBottom: "1px solid #E5E5EA", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1D1D1F", margin: 0, letterSpacing: -0.5 }}>Backstage</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {settings.aboss.connected && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34C759", display: "inline-block" }} />}
            <span style={{ fontSize: 11, color: "#86868B", fontWeight: 500 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
          </div>
        </div>
        {tab !== "settings" && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {data.artists.map((a) => <ArtistPill key={a.id} artist={a} selected={a.id === selectedArtist} onClick={() => setSelectedArtist(a.id)} />)}
            <button onClick={() => setTab("settings")} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 24, border: "2px dashed #D1D1D6", background: "none", cursor: "pointer", fontSize: 13, color: "#86868B", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Artist</button>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "16px 16px 20px" }}>
        {tab === "dashboard" && <DashboardView data={data} selectedArtist={selectedArtist} settings={settings} />}
        {tab === "releases" && <ReleasesView data={data} selectedArtist={selectedArtist} dispatch={dispatch} />}
        {tab === "shows" && <ShowsView data={data} selectedArtist={selectedArtist} dispatch={dispatch} settings={settings} onSync={syncAboss} syncing={syncing} />}
        {tab === "social" && <SocialView data={data} selectedArtist={selectedArtist} dispatch={dispatch} />}
        {tab === "settings" && <SettingsView settings={settings} setSettings={setSettings} onSync={syncAboss} syncing={syncing} syncError={syncError} />}
      </div>

      {/* Tab Bar */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 500, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid #E5E5EA", display: "flex", justifyContent: "space-around", padding: "8px 0 28px", zIndex: 100 }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "4px 12px", fontFamily: "inherit" }}>
            <span style={{ fontSize: 22, filter: tab === t.id ? "none" : "grayscale(1)", opacity: tab === t.id ? 1 : 0.4, transition: "all 0.15s" }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: tab === t.id ? "#007AFF" : "#86868B" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
