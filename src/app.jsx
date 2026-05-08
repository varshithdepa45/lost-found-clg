/* ================================================================
   TraceNet AI — Geo-Intelligent Recovery Network
   ----------------------------------------------------------------
   Single-file React app loaded as an ES module via Babel-standalone.
   ================================================================ */

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import {
  motion,
  AnimatePresence,
  animate,
} from "https://esm.sh/framer-motion@11.0.8?deps=react@18.2.0";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ================== FIREBASE INIT ================== */

const firebaseConfig = {
  apiKey: "AIzaSyBzaceNHFlq09fy6NDyRgcC93gPYLo0vhE",
  authDomain: "lost-found-clg.firebaseapp.com",
  projectId: "lost-found-clg",
  storageBucket: "lost-found-clg.firebasestorage.app",
  messagingSenderId: "335035491718",
  appId: "1:335035491718:web:0fc46d65558a627f26f807",
  measurementId: "G-FVDL55B1JH",
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);

/* ================== CONSTANTS ================== */

const CATEGORIES = ["Electronics", "Documents", "Accessories", "Clothing", "Other"];

const CAT_COLORS = {
  Electronics: "#22d3ee",
  Documents: "#a855f7",
  Accessories: "#ec4899",
  Clothing: "#fbbf24",
  Other: "#34d399",
};

const CAT_GLYPH = {
  Electronics: "📱",
  Documents: "📄",
  Accessories: "🎒",
  Clothing: "👕",
  Other: "📦",
};

// Default map anchor (NYC midtown). Items don't carry real coords;
// each location string is hashed to a stable pseudo-position around
// this anchor so the map looks dense and useful.
const MAP_CENTER = [40.7589, -73.9851];
const MAP_RADIUS_DEG = 0.05;

/* ================== UTILS ================== */

const cn = (...a) => a.filter(Boolean).join(" ");

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function locationToCoords(location) {
  const key = (location || "unknown").toLowerCase();
  const h1 = hashString(key);
  const h2 = hashString(key + "::salt");
  const lat = MAP_CENTER[0] + (((h1 % 10000) / 10000) - 0.5) * 2 * MAP_RADIUS_DEG;
  const lng = MAP_CENTER[1] + (((h2 % 10000) / 10000) - 0.5) * 2 * MAP_RADIUS_DEG;
  return [lat, lng];
}

// Prefer real lat/lon (from geocoded autocomplete) and gracefully
// fall back to deterministic hashed coords for legacy items.
function itemCoords(item) {
  const lat = Number(item?.lat);
  const lon = Number(item?.lon);
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    !(lat === 0 && lon === 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  ) {
    return [lat, lon];
  }
  return locationToCoords(item?.locationOriginal || item?.location || "");
}

function formatDate(d) {
  if (!d) return "Unknown";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDistance(meters) {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 100) return `${Math.round(meters)} m`;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(2)} km`;
  if (meters < 100000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}

// Heuristic 0–100 score derived from existing fields. No new
// Firestore fields are introduced — pure derivation.
function computeTrustScore(item, allItems) {
  if (!item) return 0;
  let s = 28; // baseline
  if (item.email) s += 16;
  if (item.phone) s += 16;
  if (item.userId && item.userId !== "anonymous") s += 14;
  if (item.photoData) s += 10;
  if ((item.description || "").trim().length >= 20) s += 8;
  if (Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon))) s += 6;
  if (item.userId && Array.isArray(allItems)) {
    const posts = allItems.filter((i) => i.userId === item.userId).length;
    s += Math.min(posts * 2, 10);
  }
  return Math.max(0, Math.min(100, Math.round(s)));
}

function trustLabel(score) {
  if (score >= 85) return "Verified";
  if (score >= 70) return "Trusted";
  if (score >= 50) return "Moderate";
  if (score >= 30) return "Limited";
  return "Unvetted";
}

function tokenize(s) {
  return (s || "").toLowerCase().match(/\w+/g) || [];
}

function jaccard(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size && !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter || 1);
}

function matchScore(lost, found) {
  if (!lost || !found || lost.type === found.type) return 0;
  const nameSim = jaccard(lost.itemOriginal || lost.item, found.itemOriginal || found.item);
  const descSim = jaccard(lost.description, found.description);
  const locSim = jaccard(lost.locationOriginal || lost.location, found.locationOriginal || found.location);
  const catBoost = lost.category && lost.category === found.category ? 0.15 : 0;
  return Math.min(1, nameSim * 0.55 + descSim * 0.2 + locSim * 0.15 + catBoost);
}

function findTopMatches(items, limit = 4) {
  const lost = items.filter((i) => i.type === "lost");
  const found = items.filter((i) => i.type === "found");
  const pairs = [];
  for (const l of lost) {
    for (const f of found) {
      const score = matchScore(l, f);
      if (score > 0.25) pairs.push({ lost: l, found: f, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  return pairs.slice(0, limit);
}

function detectFraud(items) {
  const alerts = [];
  const todayKey = new Date().toISOString().slice(0, 10);

  // Rapid-fire posts from same email
  const byEmail = new Map();
  for (const it of items) {
    if (!it.email || !it.createdAt) continue;
    const t = it.createdAt?.seconds
      ? it.createdAt.seconds * 1000
      : new Date(it.createdAt).getTime();
    if (!byEmail.has(it.email)) byEmail.set(it.email, []);
    byEmail.get(it.email).push({ item: it, t });
  }
  for (const [email, posts] of byEmail) {
    if (posts.length < 2) continue;
    posts.sort((a, b) => a.t - b.t);
    for (let i = 1; i < posts.length; i++) {
      if (posts[i].t - posts[i - 1].t < 5 * 60 * 1000) {
        alerts.push({
          severity: "medium",
          type: "Spam Pattern",
          item: posts[i].item,
          reason: `${posts.length} posts from ${email} within minutes of each other.`,
        });
        break;
      }
    }
  }

  // Identical descriptions across distinct posts
  const descMap = new Map();
  for (const it of items) {
    const d = (it.description || "").trim().toLowerCase();
    if (d.length < 15) continue;
    if (!descMap.has(d)) descMap.set(d, []);
    descMap.get(d).push(it);
  }
  for (const [, group] of descMap) {
    if (group.length >= 2) {
      alerts.push({
        severity: "high",
        type: "Duplicate Content",
        item: group[group.length - 1],
        reason: `${group.length} posts share an identical description body.`,
      });
    }
  }

  // Future-dated items
  for (const it of items) {
    if (it.date && it.date > todayKey) {
      alerts.push({
        severity: "low",
        type: "Anomalous Date",
        item: it,
        reason: `Reported with a future date (${it.date}).`,
      });
    }
  }

  // Suspiciously thin descriptions
  for (const it of items) {
    if ((it.description || "").trim().length > 0 && (it.description || "").trim().length < 8) {
      alerts.push({
        severity: "low",
        type: "Low-Quality Post",
        item: it,
        reason: "Description is too short to be useful for matching.",
      });
    }
  }

  // Dedupe by item id + alert type
  const seen = new Set();
  const out = [];
  for (const a of alerts) {
    const k = (a.item?.id || "?") + "|" + a.type;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out.slice(0, 6);
}

/* ================== HOOKS ================== */

function useAnimatedNumber(target, duration = 1.1) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const controls = animate(0, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [target, duration]);
  return value;
}

/* ================== ICON SET ================== */

const Icon = {
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Pin: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Calendar: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  Mail: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  ),
  X: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Bolt: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  ),
  Shield: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  ),
  Activity: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  Globe: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10ZM2 12h20" />
    </svg>
  ),
  Alert: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01" />
    </svg>
  ),
  Sparkles: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  ),
  TrendUp: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 7-8.5 8.5-5-5L2 17" />
      <path d="M16 7h6v6" />
    </svg>
  ),
  Logo: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" />
    </svg>
  ),
  Brain: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  ),
};

/* ================== TOP NAVBAR ================== */

function TopNavbar({
  user,
  onSignIn,
  onSignOut,
  onShowMyPosts,
  onShowAll,
  viewingMyPosts,
  onPostItem,
}) {
  return (
    <motion.nav
      initial={{ y: -32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 px-3 sm:px-6 lg:px-10 pt-3"
    >
      <div className="tn-glass-strong rounded-2xl px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-cyan-400/30 shadow-[0_0_18px_rgba(34,211,238,0.3)] text-cyan-300 shrink-0">
            <Icon.Logo />
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-semibold text-base tracking-tight truncate">
              <span className="tn-gradient-text">TraceNet</span>
              <span className="text-slate-100"> AI</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 hidden sm:block">
              Geo-Intelligent Recovery Network
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60"></span>
              <span className="relative w-2 h-2 rounded-full bg-emerald-400"></span>
            </span>
            <span className="font-mono">NETWORK ONLINE</span>
          </div>

          {user ? (
            <>
              <button
                onClick={viewingMyPosts ? onShowAll : onShowMyPosts}
                className="tn-btn tn-btn-ghost hidden sm:inline-flex"
              >
                {viewingMyPosts ? "All Items" : "My Posts"}
              </button>
              <button onClick={onSignOut} className="tn-btn tn-btn-ghost">
                Sign out
              </button>
            </>
          ) : (
            <button onClick={onSignIn} className="tn-btn tn-btn-ghost">
              Sign in
            </button>
          )}

          <button onClick={onPostItem} className="tn-btn tn-btn-primary">
            <Icon.Plus />
            <span className="hidden sm:inline">Report Item</span>
          </button>
        </div>
      </div>
    </motion.nav>
  );
}

/* ================== HERO ================== */

function Hero({ items, onPostItem }) {
  const taglines = useMemo(
    () => [
      "Cross-referencing geo-signatures…",
      "Detecting probabilistic matches…",
      "Indexing fraud patterns in real-time…",
      "Reuniting objects with owners.",
    ],
    [],
  );
  const [tagIdx, setTagIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTagIdx((i) => (i + 1) % taglines.length), 3500);
    return () => clearInterval(t);
  }, [taglines.length]);

  return (
    <section className="relative px-3 sm:px-6 lg:px-10 pt-5">
      <div className="relative tn-glass rounded-3xl overflow-hidden">
        <div className="absolute inset-0 tn-grid-bg opacity-50" />
        <div className="absolute inset-0 tn-hero-radial" />
        <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute inset-0 pointer-events-none rounded-3xl tn-grad-border opacity-60" />

        <div className="relative px-6 sm:px-10 lg:px-14 py-12 sm:py-16 lg:py-20 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-slate-300 font-mono"
          >
            <span className="text-cyan-300"><Icon.Sparkles /></span>
            <span>v1.0 · neural recovery engine</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="tn-hero-title font-semibold tracking-tight mb-4"
          >
            <span className="tn-gradient-text">TraceNet AI</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg sm:text-xl lg:text-2xl text-slate-300 max-w-2xl mb-2"
          >
            Geo-Intelligent Recovery Network
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="text-sm text-slate-500 font-mono h-6 mb-8"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={tagIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4 }}
                className="inline-block"
              >
                <span className="text-cyan-400">›</span> {taglines[tagIdx]}
              </motion.span>
            </AnimatePresence>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="flex flex-wrap items-center gap-3"
          >
            <button onClick={onPostItem} className="tn-btn tn-btn-primary px-5 py-3 text-sm">
              <Icon.Plus />
              Report a New Item
            </button>
            <a href="#network-map" className="tn-btn tn-btn-ghost px-5 py-3 text-sm">
              <Icon.Globe />
              Explore the network
            </a>
            <div className="hidden md:flex items-center gap-2 ml-2 text-xs text-slate-500 font-mono">
              <span className="w-1 h-1 rounded-full bg-cyan-400" />
              <span>{items.length} active records</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ================== STAT CARD + LIVE STATS ================== */

function StatCard({ icon, label, value, suffix, gradient, delay = 0 }) {
  const animated = useAnimatedNumber(value || 0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ y: -4 }}
      className="relative tn-glass rounded-2xl p-5 overflow-hidden group"
    >
      <div
        className={cn(
          "absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition-opacity",
          gradient,
        )}
      />
      <div className="relative flex items-start justify-between mb-3">
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-[0_0_18px_rgba(34,211,238,0.2)]",
            gradient,
          )}
        >
          {icon}
        </div>
        <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
          live
        </div>
      </div>
      <div className="relative">
        <div className="text-3xl font-semibold font-mono tracking-tight tabular-nums text-slate-50">
          {Math.round(animated)}
          {suffix || ""}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 uppercase tracking-[0.16em]">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

function LiveStats({ items }) {
  const total = items.length;
  const lost = items.filter((i) => i.type === "lost").length;
  const found = items.filter((i) => i.type === "found").length;
  const recoveryRate = total ? Math.round((found / total) * 100) : 0;

  return (
    <section className="px-3 sm:px-6 lg:px-10 pt-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          delay={0.0}
          icon={<Icon.Activity />}
          label="Items Tracked"
          value={total}
          gradient="bg-gradient-to-br from-cyan-400 to-cyan-700"
        />
        <StatCard
          delay={0.08}
          icon={<Icon.Alert />}
          label="Lost Reports"
          value={lost}
          gradient="bg-gradient-to-br from-amber-400 to-orange-600"
        />
        <StatCard
          delay={0.16}
          icon={<Icon.Sparkles />}
          label="Found Reports"
          value={found}
          gradient="bg-gradient-to-br from-emerald-400 to-teal-600"
        />
        <StatCard
          delay={0.24}
          icon={<Icon.TrendUp />}
          label="Recovery Index"
          value={recoveryRate}
          suffix="%"
          gradient="bg-gradient-to-br from-purple-400 to-pink-600"
        />
      </div>
    </section>
  );
}

/* ================== INTERACTIVE MAP ================== */

function InteractiveMap({ items }) {
  const mapEl = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const radiusLayer = useRef(null);
  const linksLayer = useRef(null);
  const markersById = useRef(new Map());
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [cardItem, setCardItem] = useState(null);
  const [scrollZoom, setScrollZoom] = useState(false);
  const [userLocation, setUserLocation] = useState(null); // { coords:[lat,lon], accuracy }
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(null);

  const itemsWithCoords = useMemo(
    () => items.map((i) => ({ ...i, coords: itemCoords(i) })),
    [items],
  );

  const visibleItems = useMemo(
    () =>
      filter === "all"
        ? itemsWithCoords
        : itemsWithCoords.filter((i) => i.type === filter),
    [itemsWithCoords, filter],
  );

  // One-time map init
  useEffect(() => {
    if (!mapEl.current || mapInstance.current || !window.L) return;
    const L = window.L;
    const map = L.map(mapEl.current, {
      center: MAP_CENTER,
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
      {
        attribution: "© OpenStreetMap, © CartoDB",
        subdomains: "abcd",
        maxZoom: 19,
      },
    ).addTo(map);
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 19 },
    ).addTo(map);
    radiusLayer.current = L.layerGroup().addTo(map);
    linksLayer.current = L.layerGroup().addTo(map);
    markersLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    // Click on empty map → deselect and close the card
    map.on("click", () => {
      setSelectedId(null);
      setCardItem(null);
    });

    return () => {
      map.remove();
      mapInstance.current = null;
      markersLayer.current = null;
      radiusLayer.current = null;
      linksLayer.current = null;
      markersById.current.clear();
    };
  }, []);

  // Toggle scroll-wheel zoom
  useEffect(() => {
    if (!mapInstance.current) return;
    if (scrollZoom) mapInstance.current.scrollWheelZoom.enable();
    else mapInstance.current.scrollWheelZoom.disable();
  }, [scrollZoom]);

  // Render markers, radii, and connections
  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current || !window.L) return;
    const L = window.L;
    const map = mapInstance.current;

    markersLayer.current.clearLayers();
    radiusLayer.current.clearLayers();
    linksLayer.current.clearLayers();
    markersById.current.clear();

    visibleItems.forEach((item) => {
      const [lat, lng] = item.coords;
      const isLost = item.type === "lost";
      const color = isLost ? "#fb7185" : "#34d399";
      const isSelected = item.id === selectedId;
      const isDimmed = !!selectedId && !isSelected;
      const glyph = CAT_GLYPH[item.category] || "📍";

      // Per-item radius circle
      L.circle([lat, lng], {
        radius: 350,
        color,
        weight: 1,
        opacity: isDimmed ? 0.18 : 0.55,
        fillColor: color,
        fillOpacity: isDimmed ? 0.02 : 0.07,
        dashArray: "4 6",
        interactive: false,
      }).addTo(radiusLayer.current);

      // Custom marker
      const html = `
        <div class="tn-mk ${isLost ? "tn-mk-lost" : "tn-mk-found"} ${isSelected ? "tn-mk-active" : ""} ${isDimmed ? "tn-mk-dim" : ""}" style="--c:${color}">
          <span class="tn-mk-pulse"></span>
          <span class="tn-mk-core">${glyph}</span>
        </div>
      `;
      const icon = L.divIcon({
        className: "tn-marker-icon",
        html,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const marker = L.marker([lat, lng], { icon, riseOnHover: true });
      // Click opens the rich React MarkerCard instead of a Leaflet popup
      marker.on("click", () => {
        setSelectedId(item.id);
        setCardItem(item);
      });
      marker.addTo(markersLayer.current);
      markersById.current.set(item.id, marker);
    });

    // Nearby visualization for selected
    if (selectedId) {
      const selected = visibleItems.find((i) => i.id === selectedId);
      if (selected) {
        const sLatLng = L.latLng(selected.coords);
        const nearby = visibleItems
          .filter((i) => i.id !== selectedId)
          .map((i) => ({ item: i, d: map.distance(sLatLng, L.latLng(i.coords)) }))
          .filter((x) => x.d < 1000)
          .sort((a, b) => a.d - b.d)
          .slice(0, 8);

        nearby.forEach(({ item }) => {
          const isPair = item.type !== selected.type;
          L.polyline([selected.coords, item.coords], {
            color: isPair ? "#a855f7" : "#22d3ee",
            weight: isPair ? 2.2 : 1.4,
            opacity: 0.85,
            dashArray: isPair ? "8 8" : "5 6",
            className: "tn-link",
            interactive: false,
          }).addTo(linksLayer.current);
        });

        // Outer search halo
        L.circle(selected.coords, {
          radius: 1000,
          color: "#22d3ee",
          weight: 1.5,
          opacity: 0.55,
          fillColor: "#22d3ee",
          fillOpacity: 0.04,
          dashArray: "8 6",
          interactive: false,
        }).addTo(linksLayer.current);
      }
    }

    // "You are here" marker + accuracy + 2km nearby halo
    if (userLocation && Array.isArray(userLocation.coords)) {
      const me = userLocation.coords;
      const acc = Math.min(
        Math.max(Number(userLocation.accuracy) || 50, 25),
        500,
      );

      // Accuracy circle (real GPS uncertainty)
      L.circle(me, {
        radius: acc,
        color: "#22d3ee",
        weight: 1.5,
        opacity: 0.7,
        fillColor: "#22d3ee",
        fillOpacity: 0.10,
        interactive: false,
      }).addTo(linksLayer.current);

      // 2km "nearby" halo
      L.circle(me, {
        radius: 2000,
        color: "#22d3ee",
        weight: 1.2,
        opacity: 0.4,
        fillColor: "#22d3ee",
        fillOpacity: 0.025,
        dashArray: "6 8",
        interactive: false,
      }).addTo(linksLayer.current);

      // Glowing "You" pin
      const html = `
        <div class="tn-you">
          <span class="tn-you-ring"></span>
          <span class="tn-you-ring tn-you-ring-2"></span>
          <span class="tn-you-core"></span>
        </div>
      `;
      const icon = L.divIcon({
        className: "tn-marker-icon",
        html,
        iconSize: [46, 46],
        iconAnchor: [23, 23],
      });
      const popupHtml = `
        <div class="tn-pop">
          <div class="tn-pop-head">
            <span class="tn-pop-badge" style="--c:#22d3ee">You</span>
            <span class="tn-pop-cat"><span class="tn-pop-glyph">📡</span>Geolocation</span>
          </div>
          <div class="tn-pop-title">You are here</div>
          <div class="tn-pop-meta">
            <div><span>📍</span>${me[0].toFixed(4)}°, ${me[1].toFixed(4)}°</div>
            <div><span>📡</span>±${Math.round(userLocation.accuracy || 0)} m accuracy</div>
          </div>
        </div>
      `;
      L.marker(me, { icon, zIndexOffset: 1000 })
        .bindPopup(popupHtml, {
          className: "tn-popup",
          maxWidth: 240,
          minWidth: 210,
          offset: [0, -10],
        })
        .addTo(markersLayer.current);
    }
  }, [visibleItems, selectedId, userLocation]);

  // If the selected/cardItem is filtered out (or removed from the
  // collection), clear it gracefully.
  useEffect(() => {
    if (!cardItem) return;
    const stillVisible = visibleItems.some((i) => i.id === cardItem.id);
    if (!stillVisible) {
      setCardItem(null);
      setSelectedId(null);
    }
  }, [visibleItems, cardItem]);

  const lostCount = items.filter((i) => i.type === "lost").length;
  const foundCount = items.filter((i) => i.type === "found").length;
  const selectedItem = selectedId
    ? visibleItems.find((i) => i.id === selectedId)
    : null;

  const handleReset = () => {
    setSelectedId(null);
    if (mapInstance.current)
      mapInstance.current.flyTo(MAP_CENTER, 13, { duration: 0.7 });
  };

  const handleLocateMe = useCallback(() => {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError("Geolocation isn't supported by this browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation({ coords, accuracy: pos.coords.accuracy || 50 });
        setLocating(false);
        if (mapInstance.current) {
          mapInstance.current.flyTo(coords, 14, { duration: 1.0 });
        }
      },
      (err) => {
        setLocating(false);
        const msg =
          err.code === 1
            ? "Location permission denied"
            : err.code === 2
              ? "Location currently unavailable"
              : err.code === 3
                ? "Location request timed out"
                : "Couldn't get your location";
        setLocError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  // Items within 2km of the user
  const nearbyMeCount = useMemo(() => {
    if (!userLocation || !window.L) return 0;
    const L = window.L;
    const me = L.latLng(userLocation.coords);
    return itemsWithCoords.reduce(
      (n, i) => n + (L.latLng(i.coords).distanceTo(me) <= 2000 ? 1 : 0),
      0,
    );
  }, [itemsWithCoords, userLocation]);

  return (
    <section id="network-map" className="px-3 sm:px-6 lg:px-10 pt-6">
      <div className="flex items-end justify-between mb-4 px-1 flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-400 font-mono mb-1.5 flex items-center gap-2">
            <span className="w-3 h-px bg-cyan-400" />
            Centerpiece · Live Map
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">
            <span className="tn-gradient-text">Recovery Network</span>{" "}
            <span className="text-slate-100">Map</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Click a pin to reveal its proximity radius and nearby items in the network.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
            <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.7)]" />
            <span className="text-slate-300 font-mono">Lost · {lostCount}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
            <span className="text-slate-300 font-mono">Found · {foundCount}</span>
          </div>
        </div>
      </div>

      <div className="relative tn-glass rounded-3xl overflow-hidden">
        <div
          ref={mapEl}
          className="w-full h-[62vh] min-h-[440px] lg:h-[70vh] lg:min-h-[560px]"
        />

        <div className="pointer-events-none absolute inset-0 rounded-3xl tn-grad-border opacity-70 z-[400]" />

        {/* Top-left: live counter */}
        <div className="pointer-events-none absolute top-4 left-4 z-[400] px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur border border-white/[0.08] text-[10px] font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-70" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-cyan-400" />
          </span>
          {visibleItems.length} pins · live
        </div>

        {/* Top-right: filter pills */}
        <div className="absolute top-4 right-4 z-[400] flex p-1 rounded-xl bg-black/60 backdrop-blur border border-white/[0.08] text-[11px] font-mono">
          {[
            { k: "all", label: "All" },
            { k: "lost", label: "Lost" },
            { k: "found", label: "Found" },
          ].map((o) => (
            <button
              key={o.k}
              onClick={() => {
                setSelectedId(null);
                setCardItem(null);
                setFilter(o.k);
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider",
                filter === o.k
                  ? "bg-gradient-to-br from-cyan-500/30 to-purple-500/30 text-white border border-white/[0.12] shadow-[0_0_14px_rgba(34,211,238,0.25)]"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Bottom-left: locate-me + scroll-zoom toggle + reset */}
        <div className="absolute bottom-4 left-4 z-[400] flex items-center gap-2 flex-wrap max-w-[calc(100%-2rem)]">
          <button
            onClick={handleLocateMe}
            disabled={locating}
            className={cn(
              "px-3 py-1.5 rounded-lg backdrop-blur border text-[10px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 disabled:opacity-70",
              userLocation
                ? "bg-cyan-400/20 border-cyan-400/45 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.3)]"
                : "bg-black/60 border-white/[0.08] text-slate-300 hover:text-white",
            )}
            title="Center map on your location"
          >
            {locating ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
                locating…
              </>
            ) : userLocation ? (
              <>📍 you · centered</>
            ) : (
              <>📍 locate me</>
            )}
          </button>
          <button
            onClick={() => setScrollZoom((s) => !s)}
            className={cn(
              "px-3 py-1.5 rounded-lg backdrop-blur border text-[10px] font-mono uppercase tracking-wider transition-colors",
              scrollZoom
                ? "bg-cyan-400/20 border-cyan-400/45 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.25)]"
                : "bg-black/60 border-white/[0.08] text-slate-300 hover:text-white",
            )}
            title="Toggle scroll-wheel zoom"
          >
            scroll-zoom · {scrollZoom ? "on" : "off"}
          </button>
          {(selectedId || filter !== "all" || userLocation || cardItem) && (
            <button
              onClick={() => {
                setUserLocation(null);
                setLocError(null);
                setCardItem(null);
                handleReset();
              }}
              className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur border border-white/[0.08] text-[10px] font-mono uppercase tracking-wider text-slate-300 hover:text-white transition-colors"
            >
              ↺ reset
            </button>
          )}
        </div>

        {/* Geolocation error toast */}
        <AnimatePresence>
          {locError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-16 left-4 z-[420] px-3 py-2 rounded-lg bg-rose-500/15 backdrop-blur border border-rose-500/40 text-[11px] font-mono text-rose-200 max-w-[260px]"
            >
              {locError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom-right: hint / selected info / nearby-me count */}
        <AnimatePresence mode="wait">
          {selectedItem ? (
            <motion.div
              key="selected"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className="absolute bottom-4 right-4 z-[400] max-w-[260px] px-3 py-2 rounded-xl bg-black/65 backdrop-blur border border-white/[0.08] text-xs"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300 font-mono mb-0.5">
                Tracking · 1km radius
              </div>
              <div className="text-slate-100 font-medium truncate">
                {selectedItem.itemOriginal || selectedItem.item || "—"}
              </div>
              <div className="text-slate-400 truncate font-mono text-[11px] mt-0.5">
                {selectedItem.locationOriginal || selectedItem.location || "—"}
              </div>
            </motion.div>
          ) : userLocation ? (
            <motion.div
              key="nearby-me"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className="absolute bottom-4 right-4 z-[400] max-w-[260px] px-3 py-2 rounded-xl bg-black/65 backdrop-blur border border-cyan-400/35 text-xs shadow-[0_0_14px_rgba(34,211,238,0.18)]"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300 font-mono mb-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Near you · 2km radius
              </div>
              <div className="text-slate-100 font-medium">
                {nearbyMeCount} {nearbyMeCount === 1 ? "item" : "items"} within range
              </div>
              <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                {userLocation.coords[0].toFixed(3)}°,{" "}
                {userLocation.coords[1].toFixed(3)}°
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="hint"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className="hidden sm:block absolute bottom-4 right-4 z-[400] px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur border border-white/[0.08] text-[10px] font-mono uppercase tracking-wider text-slate-400"
            >
              tap a pin → see nearby items
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state overlay */}
        {visibleItems.length === 0 && (
          <div className="absolute inset-0 z-[450] flex items-center justify-center pointer-events-none">
            <div className="px-5 py-3 rounded-xl bg-black/65 backdrop-blur border border-white/[0.08] text-center">
              <div className="text-sm text-slate-200 font-medium">No pings on the map</div>
              <div className="text-xs text-slate-500 mt-0.5 font-mono">
                {filter === "all" ? "report an item to populate the network" : `no ${filter} reports yet`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rich React popup card — fixed-position, lives outside the map div */}
      <AnimatePresence mode="wait">
        {cardItem && (
          <MarkerCard
            key={cardItem.id}
            item={cardItem}
            allItems={items}
            userLocation={userLocation}
            onClose={() => {
              setCardItem(null);
              setSelectedId(null);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

/* ================== SMART MATCH CARDS ================== */

function SmartMatchCards({ items }) {
  const matches = useMemo(() => findTopMatches(items, 4), [items]);

  return (
    <section>
      <div className="mb-4 px-1">
        <div className="text-[10px] uppercase tracking-[0.22em] text-purple-400 font-mono mb-1.5 flex items-center gap-2">
          <span className="w-3 h-px bg-purple-400" />
          Section 02 · AI Matching
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <span className="text-purple-300"><Icon.Brain /></span>
          Smart Match Engine
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Top probabilistic links between lost and found posts.
        </p>
      </div>

      <div className="space-y-3">
        {matches.length === 0 ? (
          <div className="tn-glass rounded-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-3 text-slate-500">
              <Icon.Sparkles />
            </div>
            <p className="text-slate-300 text-sm font-medium">Awaiting more signals</p>
            <p className="text-slate-500 text-xs mt-1">
              Matches surface here as more reports enter the network.
            </p>
          </div>
        ) : (
          matches.map((m, idx) => {
            const gradId = `mg-${m.lost.id}-${m.found.id}`;
            return (
              <motion.div
                key={`${m.lost.id}-${m.found.id}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06 }}
                className="tn-glass rounded-2xl p-4 hover:border-purple-400/35 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative w-11 h-11 shrink-0">
                    <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="3"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        stroke={`url(#${gradId})`}
                        strokeWidth="3"
                        strokeDasharray={`${(m.score * 100.53).toFixed(2)} 100.53`}
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-semibold tabular-nums text-slate-100">
                      {Math.round(m.score * 100)}%
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-slate-400 font-mono uppercase tracking-[0.16em]">
                      cross-link · {Math.round(m.score * 100)}% confidence
                    </div>
                    <div className="text-sm text-slate-200 font-medium">
                      Probable match detected
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-rose-400/[0.05] border border-rose-400/15 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-rose-300 font-mono mb-1">
                      Lost
                    </div>
                    <div className="font-medium text-slate-100 truncate">
                      {m.lost.itemOriginal || m.lost.item}
                    </div>
                    <div className="text-slate-400 truncate flex items-center gap-1 mt-0.5">
                      <Icon.Pin />
                      {m.lost.locationOriginal || m.lost.location}
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-400/[0.05] border border-emerald-400/15 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300 font-mono mb-1">
                      Found
                    </div>
                    <div className="font-medium text-slate-100 truncate">
                      {m.found.itemOriginal || m.found.item}
                    </div>
                    <div className="text-slate-400 truncate flex items-center gap-1 mt-0.5">
                      <Icon.Pin />
                      {m.found.locationOriginal || m.found.location}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </section>
  );
}

/* ================== FRAUD ALERTS ================== */

const SEV = {
  high: { color: "#fb7185", label: "HIGH" },
  medium: { color: "#fbbf24", label: "MED" },
  low: { color: "#94a3b8", label: "LOW" },
};

function FraudAlertsPanel({ items }) {
  const alerts = useMemo(() => detectFraud(items), [items]);

  return (
    <section>
      <div className="mb-4 px-1 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-rose-400 font-mono mb-1.5 flex items-center gap-2">
            <span className="w-3 h-px bg-rose-400" />
            Section 03 · Anomaly Detection
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <span className="text-rose-300"><Icon.Shield /></span>
            Fraud Alert Stream
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Heuristic anomalies flagged across the network.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <span className="relative flex w-2 h-2">
            <span
              className={cn(
                "absolute inset-0 rounded-full opacity-60",
                alerts.length ? "bg-rose-400 animate-ping" : "bg-emerald-400",
              )}
            />
            <span
              className={cn(
                "relative w-2 h-2 rounded-full",
                alerts.length ? "bg-rose-400" : "bg-emerald-400",
              )}
            />
          </span>
          <span className="text-slate-300 font-mono">{alerts.length} active</span>
        </div>
      </div>

      <div className="tn-glass rounded-2xl overflow-hidden">
        {alerts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-400/[0.06] border border-emerald-400/20 mb-3 text-emerald-400">
              <Icon.Shield />
            </div>
            <p className="text-slate-200 text-sm font-medium">All clear</p>
            <p className="text-slate-500 text-xs mt-1">
              No anomalies detected in current dataset.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {alerts.map((a, idx) => {
              const sev = SEV[a.severity];
              return (
                <motion.li
                  key={`${a.item?.id || "?"}-${a.type}-${idx}`}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="px-4 py-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div
                    className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-[0.12em]"
                    style={{
                      backgroundColor: `${sev.color}1f`,
                      color: sev.color,
                      border: `1px solid ${sev.color}40`,
                      boxShadow: a.severity !== "low" ? `0 0 10px ${sev.color}30` : "none",
                    }}
                  >
                    {sev.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200">{a.type}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{a.reason}</div>
                    {a.item && (
                      <div className="text-[11px] text-slate-500 mt-1 font-mono truncate">
                        → {a.item.itemOriginal || a.item.item || "—"}
                        {a.item.email ? ` · ${a.item.email}` : ""}
                      </div>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ================== ANALYTICS DASHBOARD ================== */

function AnalyticsDashboard({ items }) {
  const byCategory = useMemo(() => {
    const m = new Map(CATEGORIES.map((c) => [c, 0]));
    items.forEach((i) => {
      const c = CATEGORIES.includes(i.category) ? i.category : "Other";
      m.set(c, (m.get(c) || 0) + 1);
    });
    return Array.from(m.entries()).map(([name, count]) => ({ name, count }));
  }, [items]);

  const maxCat = Math.max(1, ...byCategory.map((c) => c.count));

  const last7 = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        key,
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        count: 0,
      });
    }
    items.forEach((i) => {
      if (!i.date) return;
      const found = days.find((d) => d.key === i.date);
      if (found) found.count++;
    });
    return days;
  }, [items]);

  const maxDay = Math.max(1, ...last7.map((d) => d.count));

  return (
    <section className="px-3 sm:px-6 lg:px-10 pt-8">
      <div className="mb-4 px-1">
        <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-400 font-mono mb-1.5 flex items-center gap-2">
          <span className="w-3 h-px bg-emerald-400" />
          Section 04 · Analytics
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Network Pulse
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Real-time decomposition of activity across the recovery graph.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="lg:col-span-3 tn-glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-slate-200">
              Items by Category
            </div>
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
              total · {items.length}
            </div>
          </div>
          <div className="space-y-3">
            {byCategory.map((c, i) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-300 flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: CAT_COLORS[c.name],
                        boxShadow: `0 0 8px ${CAT_COLORS[c.name]}80`,
                      }}
                    />
                    {c.name}
                  </span>
                  <span className="text-slate-500 font-mono tabular-nums">{c.count}</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.03] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(c.count / maxCat) * 100}%` }}
                    transition={{ duration: 0.9, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${CAT_COLORS[c.name]}55, ${CAT_COLORS[c.name]})`,
                      boxShadow: `0 0 12px ${CAT_COLORS[c.name]}50`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 tn-glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-slate-200">Last 7 Days</div>
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
              activity
            </div>
          </div>
          <div className="h-32 flex items-end gap-2">
            {last7.map((d, i) => {
              const pct = (d.count / maxDay) * 100;
              return (
                <div key={d.key} className="flex-1 flex flex-col items-stretch h-full">
                  <div className="flex-1 flex items-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(pct, d.count ? 4 : 1)}%` }}
                      transition={{ duration: 0.8, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full rounded-t-md"
                      style={{
                        background: d.count
                          ? "linear-gradient(180deg, #67e8f9, rgba(34,211,238,0.18))"
                          : "rgba(255,255,255,0.04)",
                        boxShadow: d.count ? "0 0 12px rgba(34,211,238,0.25)" : "none",
                      }}
                      title={`${d.count} on ${d.key}`}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono text-center mt-1.5">
                    {d.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================== ITEM CARD + GRID ================== */

function ItemCard({ item, currentUser, onContact, onDelete, idx }) {
  const isLost = item.type === "lost";
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.45, delay: Math.min(idx, 8) * 0.04 }}
      whileHover={{ y: -4 }}
      className="group relative tn-glass rounded-2xl overflow-hidden hover:border-cyan-400/30 transition-all"
    >
      <div className="relative h-44 overflow-hidden">
        {item.photoData ? (
          <img
            src={item.photoData}
            alt={item.itemOriginal || item.item || ""}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${CAT_COLORS[item.category] || "#475569"}30, ${CAT_COLORS[item.category] || "#475569"}05)`,
            }}
          >
            <div className="text-5xl opacity-40">
              {CAT_GLYPH[item.category] || "📦"}
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.12em]",
              isLost
                ? "bg-rose-400/20 text-rose-300 border border-rose-400/35 shadow-[0_0_10px_rgba(251,113,133,0.25)]"
                : "bg-emerald-400/20 text-emerald-300 border border-emerald-400/35 shadow-[0_0_10px_rgba(52,211,153,0.25)]",
            )}
          >
            {item.type || "—"}
          </span>
          {item.matched && (
            <span className="px-2 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.12em] bg-purple-400/20 text-purple-300 border border-purple-400/35">
              matched
            </span>
          )}
        </div>
        {item.category && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-[0.12em] bg-black/45 backdrop-blur text-slate-200 border border-white/[0.08]">
              {item.category}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-base mb-2 leading-tight tn-line-clamp-1 text-slate-50">
          {item.itemOriginal || item.item || "Untitled"}
        </h3>
        <div className="space-y-1 text-xs text-slate-400 mb-3">
          <div className="flex items-center gap-1.5">
            <Icon.Pin />
            <span className="truncate">
              {item.locationOriginal || item.location || "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon.Calendar />
            <span>{formatDate(item.date)}</span>
          </div>
        </div>
        {item.description && (
          <p className="text-sm text-slate-300 mb-4 tn-line-clamp-2">
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
          <button
            onClick={() => onContact(item)}
            className="flex-1 tn-btn tn-btn-ghost text-xs py-2"
          >
            <Icon.Mail />
            Contact
          </button>
          {currentUser && currentUser.uid === item.userId && (
            <button
              onClick={() => onDelete(item.id)}
              className="tn-btn text-xs py-2 px-3 bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20"
              title="Delete"
            >
              <Icon.Trash />
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function ItemGrid({
  items,
  currentUser,
  onContact,
  onDelete,
  viewingMyPosts,
  onShowAll,
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const filtered = useMemo(() => {
    let f = items;
    if (typeFilter) f = f.filter((i) => i.type === typeFilter);
    if (categoryFilter) f = f.filter((i) => i.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      f = f.filter(
        (i) =>
          (i.itemOriginal || i.item || "").toLowerCase().includes(q) ||
          (i.description || "").toLowerCase().includes(q) ||
          (i.locationOriginal || i.location || "").toLowerCase().includes(q),
      );
    }
    return f;
  }, [items, search, typeFilter, categoryFilter]);

  return (
    <section className="px-3 sm:px-6 lg:px-10 pt-8">
      <div className="mb-4 px-1 flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-400 font-mono mb-1.5 flex items-center gap-2">
            <span className="w-3 h-px bg-cyan-400" />
            Section 05 · Items
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {viewingMyPosts ? "Your Posts" : "Recovery Feed"}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {viewingMyPosts
              ? "Items you've reported on the network."
              : "All active items in the recovery graph."}
          </p>
        </div>
        {viewingMyPosts && (
          <button onClick={onShowAll} className="tn-btn tn-btn-ghost">
            ← Back to all
          </button>
        )}
      </div>

      <div className="tn-glass rounded-2xl p-3 mb-5 flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            <Icon.Search />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items, descriptions, locations…"
            className="tn-input pl-10"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="tn-input sm:w-40"
        >
          <option value="">All Types</option>
          <option value="lost">Lost</option>
          <option value="found">Found</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="tn-input sm:w-44"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="tn-glass rounded-2xl p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4 text-slate-500">
            <Icon.Search />
          </div>
          <p className="text-slate-200 text-base font-medium mb-1">
            No items match your filters
          </p>
          <p className="text-slate-500 text-sm">
            Try widening your search or clear the filters above.
          </p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((item, idx) => (
              <ItemCard
                key={item.id}
                item={item}
                idx={idx}
                currentUser={currentUser}
                onContact={onContact}
                onDelete={onDelete}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </section>
  );
}

/* ================== POST ITEM SHEET ================== */

function Field({ label, v, onChange, placeholder, type = "text", as = "input", full, children }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-[10px] uppercase tracking-[0.18em] text-slate-400 font-mono mb-1.5">
        {label}
      </label>
      {as === "textarea" ? (
        <textarea
          value={v}
          onChange={onChange}
          placeholder={placeholder}
          rows={3}
          className="tn-input resize-none"
        />
      ) : as === "select" ? (
        <select value={v} onChange={onChange} className="tn-input">
          {children}
        </select>
      ) : (
        <input
          type={type}
          value={v}
          onChange={onChange}
          placeholder={placeholder}
          className="tn-input"
        />
      )}
    </div>
  );
}

/* ================== MARKER CARD (rich popup) ================== */

const Phone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7a2 2 0 0 1 1.72 2.03Z" />
  </svg>
);
const Compass = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

function MarkerCard({ item, userLocation, allItems, onClose }) {
  const isLost = item?.type === "lost";
  const accent = isLost ? "#fb7185" : "#34d399";
  const trust = useMemo(() => computeTrustScore(item, allItems), [item, allItems]);
  const trustL = trustLabel(trust);

  const distance = useMemo(() => {
    if (!item || !userLocation || !window.L) return null;
    try {
      return window.L
        .latLng(userLocation.coords)
        .distanceTo(window.L.latLng(itemCoords(item)));
    } catch {
      return null;
    }
  }, [item, userLocation]);

  const phone = item?.phone || "";
  const email = item?.email || "";
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;
  const mailHref = email
    ? `mailto:${email}?subject=${encodeURIComponent(
        `RE: ${item.itemOriginal || item.item || "TraceNet item"}`,
      )}&body=${encodeURIComponent(
        `Hi ${item.name || ""},\n\nI'm reaching out via TraceNet AI about the ${
          isLost ? "item you reported lost" : "item you reported as found"
        }: "${item.itemOriginal || item.item || ""}".\n\n`,
      )}`
    : null;

  const dirHref = useMemo(() => {
    if (!item) return null;
    const c = itemCoords(item);
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
    const dest = `${c[0].toFixed(6)},${c[1].toFixed(6)}`;
    const origin = userLocation
      ? `&origin=${userLocation.coords[0].toFixed(6)},${userLocation.coords[1].toFixed(6)}`
      : "";
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}`;
  }, [item, userLocation]);

  if (!item) return null;
  const gradId = `tn-trust-${(item.id || "x").replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const fmtDist = formatDistance(distance);

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 28, scale: 0.96 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{ "--accent": accent }}
      className="tn-marker-card fixed z-[55] inset-x-2 bottom-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px] max-h-[85vh] flex flex-col rounded-3xl overflow-hidden"
      role="dialog"
      aria-label={`Details for ${item.itemOriginal || item.item || "item"}`}
    >
      <div className="tn-marker-card-inner flex flex-col min-h-0">
        {/* Photo header */}
        <div className="relative h-36 shrink-0 overflow-hidden">
          {item.photoData ? (
            <img
              src={item.photoData}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-6xl"
              style={{
                background: `linear-gradient(135deg, ${accent}30, rgba(8,10,22,0.7))`,
              }}
            >
              <span style={{ opacity: 0.55 }}>
                {CAT_GLYPH[item.category] || "📦"}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c1a] via-[#0a0c1a]/40 to-transparent" />
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span
              className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.14em] border"
              style={{
                background: `${accent}26`,
                color: accent,
                borderColor: `${accent}55`,
                boxShadow: `0 0 14px ${accent}55`,
              }}
            >
              {item.type || "—"}
            </span>
            {item.category && (
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-[0.12em] bg-black/55 backdrop-blur text-slate-200 border border-white/[0.08]">
                {item.category}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/60 backdrop-blur border border-white/[0.08] flex items-center justify-center text-slate-300 hover:text-white hover:bg-black/80 transition-colors"
            aria-label="Close"
          >
            <Icon.X />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">
          {/* Name + Trust ring */}
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-slate-500 mb-1">
                {isLost ? "Reported by" : "Found by"}
              </div>
              <div className="text-lg font-semibold text-slate-50 truncate">
                {item.name || "Anonymous"}
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                {formatDate(item.date)}
              </div>
            </div>
            <div className="relative w-16 h-16 shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke={`url(#${gradId})`}
                  strokeWidth="2.5"
                  strokeDasharray={`${((trust * 100.53) / 100).toFixed(2)} 100.53`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-mono font-bold text-slate-100 tabular-nums leading-none">
                  {trust}
                </span>
                <span className="text-[8px] font-mono text-cyan-300 mt-0.5 uppercase tracking-[0.12em]">
                  trust
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.025] border border-white/[0.06] p-3 mb-3">
            <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-slate-500 mb-1 flex items-center justify-between">
              <span>Item</span>
              <span className="text-cyan-300">{trustL}</span>
            </div>
            <div className="text-sm font-semibold text-slate-100">
              {item.itemOriginal || item.item || "—"}
            </div>
            {item.description && (
              <p className="text-[12.5px] text-slate-400 mt-1.5 leading-relaxed tn-line-clamp-3">
                {item.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl bg-white/[0.025] border border-white/[0.06] p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-slate-500 mb-1 flex items-center gap-1">
                <Icon.Pin />
                Location
              </div>
              <div className="text-[12.5px] text-slate-200 font-medium tn-line-clamp-2 leading-snug">
                {item.locationOriginal || item.location || "—"}
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.025] border border-white/[0.06] p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-slate-500 mb-1 flex items-center gap-1">
                <Icon.Activity />
                Distance
              </div>
              <div className="text-[12.5px] text-slate-200 font-medium font-mono tabular-nums">
                {fmtDist || (
                  <span className="text-slate-500 normal-case">
                    locate me first
                  </span>
                )}
              </div>
            </div>
          </div>

          {(phone || email) && (
            <div className="space-y-1.5 mb-2">
              {phone && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                  <span className="text-emerald-300/80 shrink-0"><Phone /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9.5px] uppercase tracking-[0.16em] font-mono text-slate-500">
                      Phone
                    </div>
                    <div className="text-[12.5px] text-slate-100 font-mono truncate">
                      {phone}
                    </div>
                  </div>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                  <span className="text-cyan-300/80 shrink-0"><Icon.Mail /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9.5px] uppercase tracking-[0.16em] font-mono text-slate-500">
                      Email
                    </div>
                    <div className="text-[12.5px] text-slate-100 font-mono truncate">
                      {email}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="shrink-0 px-4 py-3 border-t border-white/[0.06] bg-gradient-to-t from-[#0a0c1a] via-[#0a0c1a]/95 to-[#0a0c1a]/80 grid grid-cols-3 gap-2">
          <a
            href={telHref || undefined}
            onClick={(e) => !telHref && e.preventDefault()}
            aria-disabled={!telHref}
            className={cn("tn-action-btn", !telHref && "tn-action-disabled")}
            style={{ "--c": "#34d399" }}
          >
            <span className="tn-action-glow" />
            <span className="tn-action-icon"><Phone /></span>
            <span className="tn-action-label">Call</span>
          </a>
          <a
            href={mailHref || undefined}
            onClick={(e) => !mailHref && e.preventDefault()}
            aria-disabled={!mailHref}
            className={cn("tn-action-btn", !mailHref && "tn-action-disabled")}
            style={{ "--c": "#22d3ee" }}
          >
            <span className="tn-action-glow" />
            <span className="tn-action-icon"><Icon.Mail /></span>
            <span className="tn-action-label">Email</span>
          </a>
          <a
            href={dirHref || undefined}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => !dirHref && e.preventDefault()}
            aria-disabled={!dirHref}
            className={cn("tn-action-btn", !dirHref && "tn-action-disabled")}
            style={{ "--c": "#a855f7" }}
          >
            <span className="tn-action-glow" />
            <span className="tn-action-icon"><Compass /></span>
            <span className="tn-action-label">Directions</span>
          </a>
        </div>
      </div>
    </motion.div>
  );
}

/* ================== LOCATION AUTOCOMPLETE (Nominatim) ================== */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

function primaryName(s) {
  return (s.display_name || "").split(",")[0].trim() || s.display_name || "—";
}
function secondaryName(s) {
  const parts = (s.display_name || "").split(",");
  return parts.slice(1).join(",").trim();
}

function LocationAutocomplete({ value, onChange, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);
  const reqIdRef = useRef(0);

  // Click outside closes the dropdown
  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Debounced fetch from Nominatim (free, OSM-backed, no API key)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = (value || "").trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const myReqId = ++reqIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const url =
          `${NOMINATIM_URL}?q=${encodeURIComponent(q)}` +
          `&format=json&addressdetails=1&limit=6`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        const data = await res.json();
        if (myReqId !== reqIdRef.current) return; // discard stale
        setSuggestions(Array.isArray(data) ? data : []);
        setHighlight(-1);
      } catch {
        if (myReqId === reqIdRef.current) setSuggestions([]);
      } finally {
        if (myReqId === reqIdRef.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  const pick = (s) => {
    onSelect({
      name: s.display_name,
      lat: parseFloat(s.lat),
      lon: parseFloat(s.lon),
    });
    setOpen(false);
    setSuggestions([]);
    setHighlight(-1);
  };

  const onKey = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown =
    open && (loading || suggestions.length > 0 || (value || "").trim().length >= 2);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value || ""}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder || "Try Hyderabad, HITEC City…"}
          className="tn-input pr-9"
          autoComplete="off"
          spellCheck={false}
        />
        {loading ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-cyan-400/25 border-t-cyan-400 animate-spin" />
        ) : (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
            <Icon.Search />
          </span>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="tn-autocomplete absolute z-[60] mt-1.5 w-full max-h-72 overflow-auto rounded-xl"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-3 text-xs text-slate-500 text-center font-mono">
                {loading ? "Searching the network…" : "No matches found"}
              </li>
            ) : (
              suggestions.map((s, i) => (
                <motion.li
                  key={`${s.place_id}-${i}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.025, duration: 0.18 }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    "px-3 py-2.5 text-sm cursor-pointer flex items-start gap-2 rounded-lg transition-colors",
                    highlight === i
                      ? "bg-cyan-400/10 text-white"
                      : "text-slate-200 hover:bg-white/[0.04]",
                  )}
                >
                  <span className="text-cyan-400 mt-0.5 shrink-0">
                    <Icon.Pin />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium truncate">
                      {primaryName(s)}
                    </span>
                    {secondaryName(s) && (
                      <span className="block text-[11px] text-slate-500 truncate font-mono">
                        {secondaryName(s)}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono shrink-0 mt-0.5">
                    {parseFloat(s.lat).toFixed(2)}°,{" "}
                    {parseFloat(s.lon).toFixed(2)}°
                  </span>
                </motion.li>
              ))
            )}
            <li className="px-3 pt-1.5 pb-1 text-[9px] text-slate-600 font-mono uppercase tracking-wider text-right">
              powered by OpenStreetMap · Nominatim
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function PostItemSheet({ open, onClose, currentUser }) {
  const blank = {
    name: "",
    email: "",
    phone: "",
    type: "",
    category: "",
    item: "",
    description: "",
    location: "",
    lat: null,
    lon: null,
    date: "",
  };
  const [form, setForm] = useState(blank);
  const [photoFile, setPhotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && currentUser) {
      setForm((f) => ({ ...f, email: f.email || currentUser.email || "" }));
    }
  }, [open, currentUser]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError("");
    const required = ["name", "email", "phone", "type", "category", "item", "location", "date"];
    for (const k of required) {
      if (!form[k]) {
        setError(`Missing required field: ${k}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      let photoBase64 = null;
      if (photoFile) {
        photoBase64 = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(photoFile);
        });
      }
      await addDoc(collection(db, "items"), {
        name: form.name,
        email: form.email,
        phone: form.phone,
        type: form.type,
        item: form.item.toLowerCase(),
        itemOriginal: form.item,
        description: form.description,
        location: form.location.toLowerCase(),
        locationOriginal: form.location,
        lat: typeof form.lat === "number" && Number.isFinite(form.lat) ? form.lat : null,
        lon: typeof form.lon === "number" && Number.isFinite(form.lon) ? form.lon : null,
        date: form.date,
        category: form.category,
        userId: currentUser ? currentUser.uid : "anonymous",
        photoData: photoBase64,
        createdAt: serverTimestamp(),
        viewed: false,
        matched: false,
      });
      setForm({ ...blank, email: currentUser?.email || "" });
      setPhotoFile(null);
      onClose();
    } catch (e) {
      setError(e.message || "Failed to post item");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 240 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] z-50 overflow-y-auto"
          >
            <div className="tn-glass-strong h-full p-6 sm:p-8 border-l border-white/[0.08]">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-400 font-mono mb-1">
                    New Report
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Submit to Network
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    All fields are encrypted in transit.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="tn-btn tn-btn-ghost p-2 -mr-1 rounded-lg"
                  aria-label="Close"
                >
                  <Icon.X />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Your Name" v={form.name} onChange={update("name")} placeholder="Full name" />
                <Field label="Email" v={form.email} onChange={update("email")} placeholder="you@example.com" type="email" />
                <Field label="Phone" v={form.phone} onChange={update("phone")} placeholder="+1 (555) 000-0000" type="tel" />
                <Field label="Date" v={form.date} onChange={update("date")} type="date" />
                <Field label="Item Type" v={form.type} onChange={update("type")} as="select">
                  <option value="">Select…</option>
                  <option value="lost">Lost</option>
                  <option value="found">Found</option>
                </Field>
                <Field label="Category" v={form.category} onChange={update("category")} as="select">
                  <option value="">Select…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Field>
                <Field label="Item Name" v={form.item} onChange={update("item")} placeholder="e.g., AirPods Pro, Student ID" full />

                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase tracking-[0.18em] text-slate-400 font-mono mb-1.5">
                    Location
                  </label>
                  <LocationAutocomplete
                    value={form.location}
                    onChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        location: v,
                        // typing again invalidates locked coords
                        lat: null,
                        lon: null,
                      }))
                    }
                    onSelect={(sel) =>
                      setForm((f) => ({
                        ...f,
                        location: sel.name,
                        lat: sel.lat,
                        lon: sel.lon,
                      }))
                    }
                    placeholder="Try Hyd, HITEC City, JFK Airport…"
                  />
                  {Number.isFinite(form.lat) && Number.isFinite(form.lon) ? (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-mono text-cyan-300">
                      <span className="relative flex w-1.5 h-1.5">
                        <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-70" />
                        <span className="relative w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      </span>
                      Coords locked · {form.lat.toFixed(4)}°,{" "}
                      {form.lon.toFixed(4)}°
                    </div>
                  ) : (
                    <div className="mt-1.5 text-[10px] font-mono text-slate-500">
                      Pick a suggestion to attach precise coordinates to this item.
                    </div>
                  )}
                </div>

                <Field label="Description" v={form.description} onChange={update("description")} placeholder="Color, brand, identifying features…" as="textarea" full />
                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase tracking-[0.18em] text-slate-400 font-mono mb-1.5">
                    Photo (optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files[0] || null)}
                    className="tn-input file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-cyan-400/10 file:text-cyan-300 file:font-mono file:text-xs file:cursor-pointer cursor-pointer"
                  />
                  {photoFile && (
                    <div className="text-[11px] text-slate-500 mt-1.5 font-mono truncate">
                      → {photoFile.name}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="mt-4 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="tn-btn tn-btn-primary w-full mt-6 py-3 text-sm"
              >
                {submitting ? "Transmitting…" : (
                  <>
                    <Icon.Bolt />
                    Submit to Network
                  </>
                )}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ================== AUTH MODAL ================== */

function AuthModal({ open, onClose }) {
  const [tab, setTab] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
      setErr("");
    }
  }, [open]);

  const submit = async () => {
    setErr("");
    if (!email || !password) {
      setErr("Email and password are required.");
      return;
    }
    setBusy(true);
    try {
      if (tab === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (e) {
      setErr(e.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="tn-glass-strong rounded-3xl w-full max-w-md p-6 sm:p-8 relative"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 tn-btn tn-btn-ghost p-2 rounded-lg"
              aria-label="Close"
            >
              <Icon.X />
            </button>
            <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-400 font-mono mb-1">
              Network Access
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-1">
              {tab === "signup" ? "Create your node" : "Sign in"}
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Authenticate to join the recovery network.
            </p>

            <div className="flex p-1 mb-5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              {["signup", "signin"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                    tab === t
                      ? "bg-gradient-to-br from-cyan-500/25 to-purple-500/25 text-white shadow-[0_0_18px_rgba(34,211,238,0.18)] border border-white/[0.08]"
                      : "text-slate-400 hover:text-slate-200",
                  )}
                >
                  {t === "signup" ? "Sign up" : "Sign in"}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] text-slate-400 font-mono mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="tn-input"
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] text-slate-400 font-mono mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="tn-input"
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </div>
            </div>

            {err && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {err}
              </div>
            )}

            <button
              onClick={submit}
              disabled={busy}
              className="tn-btn tn-btn-primary w-full mt-5 py-3 text-sm"
            >
              {busy ? "Authenticating…" : tab === "signup" ? "Create account" : "Sign in"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ================== CONTACT MODAL ================== */

function ContactRow({ label, value, href }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-mono">
        {label}
      </div>
      {href ? (
        <a href={href} className="text-sm text-cyan-300 hover:text-cyan-200 truncate">
          {value || "—"}
        </a>
      ) : (
        <div className="text-sm text-slate-100 truncate">{value || "—"}</div>
      )}
    </div>
  );
}

function ContactModal({ item, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!item) return;
    const text = `Name: ${item.name || ""}\nEmail: ${item.email || ""}\nPhone: ${item.phone || ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="tn-glass-strong rounded-3xl w-full max-w-md p-6 sm:p-8 relative"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 tn-btn tn-btn-ghost p-2 rounded-lg"
              aria-label="Close"
            >
              <Icon.X />
            </button>
            <div className="text-[10px] uppercase tracking-[0.22em] text-purple-400 font-mono mb-1">
              Secure Channel
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-1">
              Contact Information
            </h2>
            <p className="text-sm text-slate-400 mb-5">
              Linked to:{" "}
              <span className="text-slate-200">
                {item.itemOriginal || item.item || "—"}
              </span>
            </p>

            <div className="space-y-2.5">
              <ContactRow label="Name" value={item.name} />
              <ContactRow
                label="Email"
                value={item.email}
                href={item.email ? `mailto:${item.email}` : null}
              />
              <ContactRow
                label="Phone"
                value={item.phone}
                href={item.phone ? `tel:${item.phone}` : null}
              />
            </div>

            <button onClick={copy} className="tn-btn tn-btn-primary w-full mt-5 py-2.5">
              {copied ? "✓ Copied to clipboard" : "Copy Contact"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ================== FOOTER ================== */

function Footer() {
  return (
    <footer className="px-3 sm:px-6 lg:px-10 py-8">
      <div className="tn-glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-500 font-mono flex items-center gap-3">
          <span className="tn-gradient-text font-semibold text-sm">TraceNet AI</span>
          <span className="opacity-30">·</span>
          <span>Geo-Intelligent Recovery Network</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-600 font-mono uppercase tracking-[0.18em]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            Secure
          </span>
          <span className="opacity-30">•</span>
          <span>Powered by Firebase</span>
        </div>
      </div>
    </footer>
  );
}

/* ================== ROOT APP ================== */

function App() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [contactItem, setContactItem] = useState(null);
  const [viewingMyPosts, setViewingMyPosts] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "items"),
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        setItems(list);
      },
      (err) => console.error("snapshot error:", err),
    );
    return () => unsub();
  }, []);

  const visibleItems = useMemo(() => {
    if (viewingMyPosts && user) return items.filter((i) => i.userId === user.uid);
    return items;
  }, [items, user, viewingMyPosts]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
      setViewingMyPosts(false);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm("Delete this item permanently?")) return;
    try {
      await deleteDoc(doc(db, "items", id));
    } catch (e) {
      alert("Error: " + e.message);
    }
  }, []);

  return (
    <>
      <TopNavbar
        user={user}
        viewingMyPosts={viewingMyPosts}
        onSignIn={() => setAuthOpen(true)}
        onSignOut={handleSignOut}
        onShowMyPosts={() =>
          user ? setViewingMyPosts(true) : setAuthOpen(true)
        }
        onShowAll={() => setViewingMyPosts(false)}
        onPostItem={() => setPostOpen(true)}
      />

      <Hero items={items} onPostItem={() => setPostOpen(true)} />
      <InteractiveMap items={items} />
      <LiveStats items={items} />

      <section className="px-3 sm:px-6 lg:px-10 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SmartMatchCards items={items} />
          <FraudAlertsPanel items={items} />
        </div>
      </section>

      <AnalyticsDashboard items={items} />

      <ItemGrid
        items={visibleItems}
        currentUser={user}
        onContact={setContactItem}
        onDelete={handleDelete}
        viewingMyPosts={viewingMyPosts}
        onShowAll={() => setViewingMyPosts(false)}
      />

      <Footer />

      <PostItemSheet
        open={postOpen}
        onClose={() => setPostOpen(false)}
        currentUser={user}
      />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <ContactModal item={contactItem} onClose={() => setContactItem(null)} />
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
