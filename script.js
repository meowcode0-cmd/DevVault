/* ============================================================
   DevVault · script.js
   Vanilla JS app: store, hash router, views, DSA visualizer.
   ============================================================ */
"use strict";

/* ------------------------------------------------------------
   0. Utilities
   ------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

/** Escape user text for safe interpolation into innerHTML templates. */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const daysFromToday = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
};

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/* Storage guarded behind try/catch (private mode / quota safe) */
const storage = (() => {
  let mem = {};
  let ok = false;
  try {
    const t = "__dv_test__";
    localStorage.setItem(t, "1");
    localStorage.removeItem(t);
    ok = true;
  } catch { ok = false; }
  return {
    get(k, fallback) {
      try {
        const raw = ok ? localStorage.getItem(k) : (mem[k] ?? null);
        return raw === null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(k, v) {
      try {
        const raw = JSON.stringify(v);
        if (ok) localStorage.setItem(k, raw); else mem[k] = raw;
        return true;
      } catch { return false; }
    },
    remove(k) { try { if (ok) localStorage.removeItem(k); else delete mem[k]; } catch { /* noop */ } }
  };
})();

/* ------------------------------------------------------------
   1. Constants & demo data
   ------------------------------------------------------------ */
const SCHEMA_VERSION = 1;
const STORE_KEY = "devvault:data:v1";
const PREF_KEY = "devvault:prefs:v1";

const PROJECT_STATUSES = ["exploring", "building", "shipped", "paused"];
const TASK_STATUSES = ["todo", "doing", "done"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const LANGS = ["javascript", "python", "html", "css", "java", "c", "cpp", "sql", "go", "rust", "other"];
const RES_CATS = ["docs", "tutorial", "article", "tool", "video", "reference"];

const STATUS_META = {
  exploring: "st-exploring", building: "st-building", shipped: "st-shipped", paused: "st-paused",
  todo: "st-todo", doing: "st-doing", done: "st-done"
};
const PRIORITY_COLOR = { low: "var(--ink-3)", medium: "var(--sky)", high: "var(--warn)", critical: "var(--bad)" };
const PROJ_TONES = ["var(--accent)", "var(--rose)", "var(--lilac)", "var(--sky)", "var(--mint)", "var(--peach)"];

const LANG_COMMENT = { javascript: "//", python: "#", html: "<!--", css: "/*", sql: "--", other: "#" };
const commentFor = (lang) => LANG_COMMENT[lang] ?? "//";

const ALGOS = {
  bubble:    { name: "Bubble Sort",    gen: genBubble,    best: "O(n)",   avg: "O(n²)",   worst: "O(n²)", space: "O(1)" },
  selection: { name: "Selection Sort", gen: genSelection, best: "O(n²)",  avg: "O(n²)",   worst: "O(n²)", space: "O(1)" },
  insertion: { name: "Insertion Sort", gen: genInsertion, best: "O(n)",   avg: "O(n²)",   worst: "O(n²)", space: "O(1)" },
  merge:     { name: "Merge Sort",     gen: genMerge,     best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(n)" },
  quick:     { name: "Quick Sort",     gen: genQuick,     best: "O(n log n)", avg: "O(n log n)", worst: "O(n²)", space: "O(log n)" }
};

function iso(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function demoData(profileName = "") {
  const now = Date.now();
  const projects = [
    { id: uid(), name: "Polyglot Notes", description: "A markdown note app that renders the same note in three human languages side by side.", stack: ["React", "TypeScript", "PostgreSQL"], status: "building", progress: 62, priority: "high", deadline: iso(21), createdAt: now - 86400000 * 12 },
    { id: uid(), name: "Tiny Plot Engine", description: "Zero-dependency charting micro-library that draws line charts into a canvas with 3 KB of code.", stack: ["JavaScript", "Canvas"], status: "shipped", progress: 100, priority: "medium", deadline: iso(-9), createdAt: now - 86400000 * 40 },
    { id: uid(), name: "Pixel Forge", description: "Browser-based sprite editor with onion skinning and a palette generator for game jams.", stack: ["Vue", "Vite", "Web Workers"], status: "exploring", progress: 18, priority: "low", deadline: iso(45), createdAt: now - 86400000 * 5 },
    { id: uid(), name: "Snack Tracker API", description: "A playful REST API that tracks fridge snacks and nags you before the last cookie disappears.", stack: ["Node.js", "Express", "Redis"], status: "paused", progress: 40, priority: "medium", deadline: iso(8), createdAt: now - 86400000 * 25 }
  ];
  const tasks = [
    { id: uid(), title: "Design the note schema", project: projects[0].id, status: "done", priority: "high", due: iso(-2), createdAt: now - 86400000 * 9, completedAt: now - 86400000 * 3 },
    { id: uid(), title: "Build side-by-side renderer", project: projects[0].id, status: "doing", priority: "high", due: iso(3), createdAt: now - 86400000 * 6 },
    { id: uid(), title: "Add locale switcher with animation", project: projects[0].id, status: "todo", priority: "medium", due: iso(9), createdAt: now - 86400000 * 4 },
    { id: uid(), title: "Write README with live demo GIF", project: projects[1].id, status: "done", priority: "medium", due: iso(-10), createdAt: now - 86400000 * 30, completedAt: now - 86400000 * 11 },
    { id: uid(), title: "Publish package to npm", project: projects[1].id, status: "done", priority: "critical", due: iso(-8), createdAt: now - 86400000 * 28, completedAt: now - 86400000 * 9 },
    { id: uid(), title: "Prototype onion-skin slider", project: projects[2].id, status: "todo", priority: "low", due: iso(14), createdAt: now - 86400000 * 3 },
    { id: uid(), title: "Research Web Worker painting pipeline", project: projects[2].id, status: "doing", priority: "medium", due: iso(1), createdAt: now - 86400000 * 2 },
    { id: uid(), title: "Fix fridge sync race condition", project: projects[3].id, status: "todo", priority: "critical", due: iso(-1), createdAt: now - 86400000 * 15 },
    { id: uid(), title: "Set up daily leetcode warm-up", project: null, status: "done", priority: "medium", due: iso(-5), createdAt: now - 86400000 * 7, completedAt: now - 86400000 * 5 }
  ];
  const snippets = [
    { id: uid(), title: "Debounce, the tiny way", lang: "javascript", tags: ["utils", "events"], code: "const debounce = (fn, ms = 250) => {\n  let t;\n  return (...args) => {\n    clearTimeout(t);\n    t = setTimeout(() => fn(...args), ms);\n  };\n};", createdAt: now - 86400000 * 6 },
    { id: uid(), title: "Flatten any depth", lang: "javascript", tags: ["arrays", "recursion"], code: "const flatten = (arr) =>\n  arr.flatMap((v) =>\n    Array.isArray(v) ? flatten(v) : v\n  );", createdAt: now - 86400000 * 10 },
    { id: uid(), title: "Chunk a list into rows", lang: "python", tags: ["lists", "utils"], code: "def chunk(items, size):\n    for i in range(0, len(items), size):\n        yield items[i:i + size]", createdAt: now - 86400000 * 14 },
    { id: uid(), title: "Perfect center, every time", lang: "css", tags: ["layout", "flexbox"], code: ".center {\n  display: grid;\n  place-items: center;\n  min-height: 100dvh;\n}", createdAt: now - 86400000 * 18 },
    { id: uid(), title: "Fetch with a timeout", lang: "javascript", tags: ["network", "async"], code: "const fetchWithTimeout = async (url, ms = 5000) => {\n  const ctl = new AbortController();\n  const timer = setTimeout(() => ctl.abort(), ms);\n  try {\n    return await fetch(url, { signal: ctl.signal });\n  } finally {\n    clearTimeout(timer);\n  }\n};", createdAt: now - 86400000 * 2 },
    { id: uid(), title: "Two-table join, softly", lang: "sql", tags: ["queries"], code: "SELECT p.name, COUNT(t.id) AS open_tasks\nFROM projects p\nLEFT JOIN tasks t\n  ON t.project_id = p.id\n AND t.status <> 'done'\nGROUP BY p.id\nORDER BY open_tasks DESC;", createdAt: now - 86400000 * 20 }
  ];
  const resources = [
    { id: uid(), title: "MDN Web Docs", url: "https://developer.mozilla.org", category: "docs", tags: ["web", "reference"], note: "The source of truth for anything browser-related.", createdAt: now - 86400000 * 30 },
    { id: uid(), title: "JavaScript Info", url: "https://javascript.info", category: "tutorial", tags: ["javascript", "deep-dive"], note: "Reads like a very patient mentor wrote it.", createdAt: now - 86400000 * 22 },
    { id: uid(), title: "Can I use", url: "https://caniuse.com", category: "reference", tags: ["compatibility", "browser"], note: "Settle every \"is this supported?\" argument in seconds.", createdAt: now - 86400000 * 17 },
    { id: uid(), title: "CSS-Tricks flexbox guide", url: "https://css-tricks.com/snippets/css/a-guide-to-flexbox/", category: "article", tags: ["css", "layout"], note: "The flexbox diagram I keep coming back to.", createdAt: now - 86400000 * 12 },
    { id: uid(), title: "Visualgo", url: "https://visualgo.net", category: "tool", tags: ["dsa", "visualization"], note: "Algorithms drawn as animations — great before interviews.", createdAt: now - 86400000 * 8 },
    { id: uid(), title: "Excalidraw", url: "https://excalidraw.com", category: "tool", tags: ["design", "diagrams"], note: "Sketch architecture ideas without opening a heavy app.", createdAt: now - 86400000 * 4 },
    { id: uid(), title: "Frontend Mentor", url: "https://www.frontendmentor.io", category: "tutorial", tags: ["practice", "frontend"], note: "Real designs to rebuild when motivation dips.", createdAt: now - 86400000 * 1 }
  ];
  // Seeded-ish DSA practice history for the last 84 days
  const dsa = {};
  for (let i = 0; i < 84; i++) {
    if (Math.random() < 0.45) dsa[iso(-i)] = 1 + Math.floor(Math.random() * 4);
  }
  dsa[todayISO()] = 3;
  return { version: SCHEMA_VERSION, profile: { name: String(profileName || "").trim().slice(0, 40), theme: "night", createdAt: now }, projects, tasks, snippets, resources, dsa, activity: buildDemoActivity(projects, tasks, snippets, resources, now) };
}

function buildDemoActivity(projects, tasks, snippets, resources, now) {
  const a = [];
  a.push({ id: uid(), type: "project_created", label: "Seeded the vault with 4 starter projects", meta: "", ts: now - 86400000 * 12 });
  a.push({ id: uid(), type: "task_completed", label: "Completed \"Publish package to npm\"", meta: "Tiny Plot Engine", ts: now - 86400000 * 9 });
  a.push({ id: uid(), type: "snippet_saved", label: "Saved snippet \"Fetch with a timeout\"", meta: "javascript", ts: now - 86400000 * 2 });
  a.push({ id: uid(), type: "resource_saved", label: "Bookmarked \"Frontend Mentor\"", meta: "tutorial", ts: now - 86400000 * 1 });
  a.push({ id: uid(), type: "task_completed", label: "Completed \"Set up daily leetcode warm-up\"", meta: "", ts: now - 86400000 * 5 });
  a.push({ id: uid(), type: "dsa", label: "Cleared a warm-up set in the DSA Lab", meta: "sorting", ts: now - 86400000 * 0 });
  return a;
}

/* ------------------------------------------------------------
   2. Store
   ------------------------------------------------------------ */
function emptyVaultData() {
  const savedPrefs = storage.get(PREF_KEY, {});
  return {
    version: SCHEMA_VERSION,
    profile: {
      name: "",
      theme: savedPrefs?.theme === "day" ? "day" : "night",
      createdAt: Date.now()
    },
    projects: [],
    tasks: [],
    snippets: [],
    resources: [],
    dsa: {},
    activity: []
  };
}

const Store = {
  data: null,
  listeners: [],

  load() {
    const saved = storage.get(STORE_KEY, null);
    if (saved && typeof saved === "object" && Array.isArray(saved.projects)) {
      this.data = normalizeData(saved);
    } else {
      this.data = emptyVaultData();
    }
    return this.data;
  },

  needsOnboarding() {
    return !String(this.data?.profile?.name || "").trim();
  },

  save() {
    if (!this.data) return false;
    this.data.version = SCHEMA_VERSION;
    const okFlag = storage.set(STORE_KEY, this.data);
    if (!okFlag) toast("Could not save — storage is full or blocked.", "bad");
    return okFlag;
  },

  commit() { this.save(); this.listeners.forEach((fn) => fn()); },
  onChange(fn) { this.listeners.push(fn); },

  resetDemo() {
    const name = this.data?.profile?.name || "";
    const theme = this.data?.profile?.theme || "night";
    this.data = demoData(name);
    this.data.profile.theme = theme;
    this.commit();
  },
  wipeAll() {
    const theme = this.data?.profile?.theme || "night";
    this.data = emptyVaultData();
    this.data.profile.theme = theme;
    this.commit();
  },

  importPayload(raw) {
    const clean = normalizeData(raw, { requireStrict: true });
    if (!clean) throw new Error("This file is not a valid DevVault export.");
    clean.profile = { name: clean.profile?.name || "", theme: Prefs.theme, createdAt: clean.profile?.createdAt || Date.now() };
    this.data = clean;
    this.commit();
  },

  exportPayload() {
    return JSON.stringify({ ...this.data, version: SCHEMA_VERSION, exportedAt: new Date().toISOString() }, null, 2);
  },

  logActivity(type, label, meta = "") {
    this.data.activity.unshift({ id: uid(), type, label, meta, ts: Date.now() });
    if (this.data.activity.length > 60) this.data.activity.length = 60;
  }
};

/** Ensure a loaded/imported object has every field with a sane type. */
function normalizeData(input, { requireStrict = false } = {}) {
  if (!input || typeof input !== "object") return null;
  const asArray = (v) => Array.isArray(v) ? v : [];
  const str = (v, fb = "") => typeof v === "string" ? v : fb;
  const num = (v, fb = 0) => (Number.isFinite(Number(v)) ? Number(v) : fb);

  try {
    const base = {
      version: num(input.version, SCHEMA_VERSION),
      profile: {
        name: str(input.profile?.name).slice(0, 40),
        theme: input.profile?.theme === "day" ? "day" : "night",
        createdAt: num(input.profile?.createdAt, Date.now())
      },
      projects: [], tasks: [], snippets: [], resources: [], dsa: {}, activity: []
    };
    if (requireStrict && !Array.isArray(input.projects)) return null;

    base.projects = asArray(input.projects).slice(0, 500).map((p) => ({
      id: str(p?.id) || uid(),
      name: str(p?.name).slice(0, 80),
      description: str(p?.description).slice(0, 600),
      stack: asArray(p?.stack).map((s) => str(s).slice(0, 30)).filter(Boolean).slice(0, 10),
      status: PROJECT_STATUSES.includes(p?.status) ? p.status : "exploring",
      progress: clamp(Math.round(num(p?.progress, 0)), 0, 100),
      priority: PRIORITIES.includes(p?.priority) ? p.priority : "medium",
      deadline: str(p?.deadline) || null,
      createdAt: num(p?.createdAt, Date.now())
    })).filter((p) => p.name);

    base.tasks = asArray(input.tasks).slice(0, 1000).map((t) => ({
      id: str(t?.id) || uid(),
      title: str(t?.title).slice(0, 120),
      project: str(t?.project) || null,
      status: TASK_STATUSES.includes(t?.status) ? t.status : "todo",
      priority: PRIORITIES.includes(t?.priority) ? t.priority : "medium",
      due: str(t?.due) || null,
      createdAt: num(t?.createdAt, Date.now()),
      completedAt: t?.completedAt ? num(t.completedAt, Date.now()) : null
    })).filter((t) => t.title);

    base.snippets = asArray(input.snippets).slice(0, 500).map((s) => ({
      id: str(s?.id) || uid(),
      title: str(s?.title).slice(0, 90),
      lang: LANGS.includes(s?.lang) ? s.lang : "other",
      tags: asArray(s?.tags).map((t) => str(t).slice(0, 24)).filter(Boolean).slice(0, 8),
      code: str(s?.code).slice(0, 8000),
      createdAt: num(s?.createdAt, Date.now())
    })).filter((s) => s.title && s.code);

    base.resources = asArray(input.resources).slice(0, 500).map((r) => ({
      id: str(r?.id) || uid(),
      title: str(r?.title).slice(0, 90),
      url: normalizeURL(str(r?.url)),
      category: RES_CATS.includes(r?.category) ? r.category : "reference",
      tags: asArray(r?.tags).map((t) => str(t).slice(0, 24)).filter(Boolean).slice(0, 8),
      note: str(r?.note).slice(0, 300),
      createdAt: num(r?.createdAt, Date.now())
    })).filter((r) => r.title && r.url);

    base.dsa = {};
    if (input.dsa && typeof input.dsa === "object") {
      for (const [k, v] of Object.entries(input.dsa)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number(v) > 0) base.dsa[k] = clamp(Math.round(Number(v)), 1, 99);
      }
    }

    base.activity = asArray(input.activity).slice(0, 60).map((a) => ({
      id: str(a?.id) || uid(),
      type: str(a?.type, "misc"),
      label: str(a?.label).slice(0, 140),
      meta: str(a?.meta).slice(0, 60),
      ts: num(a?.ts, Date.now())
    }));

    return base;
  } catch { return null; }
}

function normalizeURL(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return "https://" + s.replace(/^\/+/, "");
}

/* ------------------------------------------------------------
   3. Preferences (theme, name live in data.profile; theme mirror in prefs)
   ------------------------------------------------------------ */
const Prefs = {
  get theme() { return storage.get(PREF_KEY, {})?.theme || Store.data?.profile?.theme || "night"; },
  setTheme(t) {
    storage.set(PREF_KEY, { theme: t });
    if (Store.data?.profile) Store.data.profile.theme = t;
    applyTheme();
  }
};

function applyTheme() {
  document.documentElement.dataset.theme = Prefs.theme === "day" ? "day" : "night";
  const icon = $("#theme-toggle .ic use");
  if (icon) icon.setAttribute("href", Prefs.theme === "day" ? "#i-sun" : "#i-moon");
}

/* ------------------------------------------------------------
   4. Toasts
   ------------------------------------------------------------ */
function toast(msg, tone = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${tone}`;
  const iconName = tone === "ok" ? "i-check" : tone === "bad" ? "i-x" : "i-spark";
  el.innerHTML = `<svg class="ic"><use href="#${iconName}"/></svg><span>${esc(msg)}</span>`;
  $("#toaster").appendChild(el);
  setTimeout(() => {
    el.classList.add("leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 2600);
}

/* ------------------------------------------------------------
   5. Modal framework
   ------------------------------------------------------------ */
const Modal = {
  open(html, { wide = false, onMount } = {}) {
    const layer = $("#modal-layer");
    const holder = $("#modal-holder");
    holder.className = wide ? "modal-holder wide" : "modal-holder";
    holder.innerHTML = html;
    layer.hidden = false;
    document.body.style.overflow = "hidden";
    if (onMount) onMount(holder);
    const firstInput = holder.querySelector("input, select, textarea, button:not(.icon-btn)");
    setTimeout(() => (firstInput || holder).focus?.(), 40);
  },
  close() {
    $("#modal-layer").hidden = true;
    $("#modal-holder").innerHTML = "";
    document.body.style.overflow = "";
  }
};

function confirmModal({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    Modal.open(`
      <div class="modal-head">
        <div><h3>${esc(title)}</h3></div>
        <button class="icon-btn" data-cancel aria-label="Close"><svg class="ic"><use href="#i-x"/></svg></button>
      </div>
      <p style="color:var(--ink-2);font-size:14px">${esc(message)}</p>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-cancel>Cancel</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok>${esc(confirmLabel)}</button>
      </div>`,
      {
        onMount(holder) {
          holder.querySelector("[data-cancel]").onclick = () => { Modal.close(); resolve(false); };
          holder.querySelector("[data-ok]").onclick = () => { Modal.close(); resolve(true); };
        }
      });
    $("#modal-layer .scrim").dataset.closeModal = "";
  });
}

function openOnboarding() {
  Modal.open(`
    <div class="modal-head">
      <div>
        <h3>Welcome to DevVault</h3>
        <p class="modal-sub">Your command center starts with your name.</p>
      </div>
    </div>
    <form id="onboarding-form">
      <div class="form-field">
        <label for="onboarding-name">What should we call you? <span class="req">*</span></label>
        <input id="onboarding-name" name="name" maxlength="40" placeholder="Your name" autocomplete="name" />
        <span class="field-err">Add a name to enter your vault.</span>
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" type="submit">Enter DevVault</button>
      </div>
    </form>`,
    {
      onMount(holder) {
        const form = $("#onboarding-form", holder);
        const input = $("#onboarding-name", holder);
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const name = input.value.trim();
          const field = input.closest(".form-field");
          if (!name) {
            field.classList.add("invalid");
            input.focus();
            return;
          }
          Store.data.profile.name = name.slice(0, 40);
          Store.commit();
          Modal.close();
          updateSideUser();
          route();
          animateMeters();
          toast(`Welcome, ${Store.data.profile.name}`);
        });
        input.addEventListener("input", () => input.closest(".form-field").classList.remove("invalid"));
      }
    }
  );
}

/* ------------------------------------------------------------
   6. Syntax highlighter (small, regex-based, token-safe)
   ------------------------------------------------------------ */
function highlight(code, lang) {
  const escd = esc(code);
  if (lang === "css" || lang === "html") return escd; // keep simple + safe
  const comment = lang === "python" || lang === "other" ? "#" : "//";
  const rules = [
    [new RegExp(`(${comment === "<!--" ? "//" : comment}[^\\n]*)`, "g"), "tok-com"],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, "tok-str"],
    [/\b(const|let|var|function|return|if|else|for|while|new|class|def|import|from|yield|await|async|try|except|finally|with|in|of|not|and|or|is|lambda|None|True|False|null|undefined|true|false|this|SELECT|FROM|LEFT|JOIN|ON|GROUP|ORDER|BY|COUNT|AS|DESC|AND)\b/g, "tok-key"],
    [/\b(\d+(?:\.\d+)?)\b/g, "tok-num"],
    [/([A-Za-z_$][\w$]*)(?=\s*\()/g, "tok-fn"]
  ];
  let html = escd;
  const store = [];
  // protect strings & comments first by replacing with placeholders
  html = html.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, (m) => { store.push(`<span class="tok-str">${m}</span>`); return `\u0000${store.length - 1}\u0000`; });
  if (comment === "#") html = html.replace(/(^|\s)(#[^\n]*)/g, (m, pre, c) => { store.push(`${pre}<span class="tok-com">${c}</span>`); return `\u0000${store.length - 1}\u0000`; });
  else html = html.replace(/(\/\/[^\n]*)/g, (m) => { store.push(`<span class="tok-com">${m}</span>`); return `\u0000${store.length - 1}\u0000`; });
  html = html.replace(/\b(const|let|var|function|return|if|else|for|while|new|class|def|import|from|yield|await|async|try|catch|finally|with|in|of|not|and|or|is|lambda|None|True|False|null|undefined|true|false|this|SELECT|FROM|LEFT|JOIN|ON|GROUP|ORDER|BY|COUNT|AS|DESC)\b/g, '<span class="tok-key">$1</span>');
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  html = html.replace(/\b([A-Za-z_$][\w$]*)(?=\()/g, '<span class="tok-fn">$1</span>');
  html = html.replace(/\u0000(\d+)\u0000/g, (_, i) => store[Number(i)]);
  return html;
}

/* ------------------------------------------------------------
   7. Icon helper
   ------------------------------------------------------------ */
const icon = (name, cls = "ic") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/* ------------------------------------------------------------
   8. Shared UI fragments
   ------------------------------------------------------------ */
const taskProgressOf = (projectId) => {
  const ts = Store.data.tasks.filter((t) => t.project === projectId);
  if (!ts.length) return null;
  return Math.round((ts.filter((t) => t.status === "done").length / ts.length) * 100);
};

const statusPill = (status) => `<span class="pill ${STATUS_META[status] || ""}">${esc(status)}</span>`;
const priorityFlag = (p) => `<span class="pr-flag pr-${p}">${icon("flame", "ic")} ${esc(p)}</span>`;

function viewHead(title, sub, actionsHTML = "") {
  return `<div class="view-head">
    <div><h1><span class="tick">~/</span>${title}</h1><p class="sub">${sub}</p></div>
    <div class="view-actions">${actionsHTML}</div>
  </div>`;
}

function emptyState(art, title, text, btnHTML = "") {
  return `<div class="empty">
    <div class="empty-art">${art}</div>
    <h3>${esc(title)}</h3><p>${esc(text)}</p>${btnHTML}
  </div>`;
}

/* ------------------------------------------------------------
   9. Router + shell
   ------------------------------------------------------------ */
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "projects", label: "Projects", icon: "box" },
  { id: "tasks", label: "Tasks", icon: "check" },
  { id: "snippets", label: "Snippets", icon: "code" },
  { id: "resources", label: "Resources", icon: "book" },
  { id: "dsa", label: "DSA Lab", icon: "dsa" },
  { id: "analytics", label: "Analytics", icon: "chart" },
  { id: "settings", label: "Settings", icon: "gear" }
];
let currentView = "dashboard";

function buildNav() {
  const d = Store.data;
  const counts = {
    projects: d.projects.length, tasks: d.tasks.filter((t) => t.status !== "done").length,
    snippets: d.snippets.length, resources: d.resources.length
  };
  $("#side-nav").innerHTML = NAV.map((n) => `
    <button class="nav-item ${n.id === currentView ? "active" : ""}" data-nav="${n.id}">
      ${icon(n.icon)}<span>${n.label}</span>
      ${counts[n.id] !== undefined ? `<span class="nav-count">${counts[n.id]}</span>` : ""}
    </button>`).join("");
  $$("#side-nav .nav-item").forEach((b) => b.addEventListener("click", () => {
    const dest = b.dataset.nav;
    if (location.hash !== `#/${dest}`) location.hash = `#/${dest}`; else setView(dest);
    closeSidebar();
  }));
  updateVaultMeter();
}

function updateVaultMeter() {
  const d = Store.data;
  const projDone = d.projects.length ? d.projects.reduce((s, p) => s + p.progress, 0) / (d.projects.length * 100) : 0;
  const taskDone = d.tasks.length ? d.tasks.filter((t) => t.status === "done").length / d.tasks.length : 0;
  const dsaDays = Object.keys(d.dsa).length;
  const dsaScore = clamp(dsaDays / 30, 0, 1);
  const score = Math.round(((projDone * 0.4 + taskDone * 0.35 + dsaScore * 0.25) * 100));
  $("#vault-meter-value").textContent = `${score}%`;
  $("#vault-meter-bar").style.width = `${score}%`;
  const notes = ["Keep building.", "Momentum is real.", "The vault is warm.", "Shipping weather today.", "Serious fuel. Respect."];
  $("#vault-meter-note").textContent = score >= 80 ? notes[4] : score >= 60 ? notes[3] : score >= 40 ? notes[2] : score >= 15 ? notes[1] : notes[0];
}

function updateSideUser() {
  const name = Store.data.profile.name.trim();
  $("#side-username").textContent = name;
  $("#side-username").textContent = name || "Your vault";
  $("#side-avatar").textContent = name.charAt(0).toUpperCase() || "?";
}

function setView(id) {
  currentView = NAV.some((n) => n.id === id) ? id : "dashboard";
  if (currentView !== "dsa" && typeof Lab !== "undefined" && Lab.playing) Lab.pause(); // stop the visualizer when leaving the lab
  const views = {
    dashboard: renderDashboard, projects: renderProjects, tasks: renderTasks,
    snippets: renderSnippets, resources: renderResources, dsa: renderDSA,
    analytics: renderAnalytics, settings: renderSettings
  };
  const root = $("#view-root");
  root.classList.remove("view-enter");
  void root.offsetWidth; // restart animation
  root.classList.add("view-enter");
  root.innerHTML = views[currentView]();
  root.focus({ preventScroll: true });
  $("#topbar-locator").textContent = NAV.find((n) => n.id === currentView).label;
  buildNav();
  window.scrollTo({ top: 0 });
  const mount = VIEW_MOUNT[currentView];
  if (mount) mount(root);
}

function route() {
  const id = (location.hash.replace(/^#\//, "") || "dashboard");
  setView(id);
  closeSidebar();
}

function closeSidebar() {
  $("#sidebar").classList.remove("open");
  $("#sidebar-scrim").classList.remove("show");
  $("#nav-toggle").setAttribute("aria-expanded", "false");
}

/* ------------------------------------------------------------
   10. View: Dashboard
   ------------------------------------------------------------ */
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late-night session";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Night owl mode";
}

function renderDashboard() {
  const d = Store.data;
  const openTasks = d.tasks.filter((t) => t.status !== "done");
  const doneTasks = d.tasks.filter((t) => t.status === "done");
  const activeProjects = d.projects.filter((p) => p.status !== "shipped" && p.status !== "paused");
  const avgProgress = d.projects.length ? Math.round(d.projects.reduce((s, p) => s + p.progress, 0) / d.projects.length) : 0;
  const dsaWeek = Object.entries(d.dsa).filter(([k]) => daysFromToday(k) !== null && daysFromToday(k) <= 6).reduce((s, [, v]) => s + v, 0);

  const hours = new Date().getHours();
  const heroIcon = hours >= 21 || hours < 5 ? "moon" : "sun";

  const recent = d.activity.slice(0, 6);
  const feedIcon = { project_created: "box", task_completed: "check", snippet_saved: "code", resource_saved: "book", dsa: "dsa", misc: "spark" };
  const feedTone = { project_created: "tone-accent", task_completed: "tone-good", snippet_saved: "tone-lilac", resource_saved: "tone-rose", dsa: "tone-accent", misc: "" };

  const stat = (ic, label, num, foot, tint = "") => `
    <div class="stat-card ${tint}">
      <div class="stat-top"><span class="stat-ic">${icon(ic)}</span>${label}</div>
      <div class="stat-num">${num}</div>
      <div class="stat-foot">${foot}</div>
    </div>`;

  return `
  <section class="hero stagger">
    <div class="hero-greet">${icon(heroIcon, "ic")} ${esc(greeting().toLowerCase())} · ${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
    <h2>Hey ${esc(Store.data.profile.name)}, your vault is <em>${avgProgress >= 70 ? "humming" : avgProgress >= 35 ? "warming up" : "waiting"}</em>.</h2>
    <p class="lede">${openTasks.length ? `You have ${openTasks.length} open ${openTasks.length === 1 ? "task" : "tasks"} and ${activeProjects.length} active ${activeProjects.length === 1 ? "project" : "projects"}. Small commits beat big plans.` : "Everything is clear — a perfect moment to start something new."}</p>
    <div class="hero-line">
      <button class="btn btn-primary" data-goto="projects" data-new-project>${icon("plus")} New project</button>
      <button class="btn btn-ghost" data-goto="tasks" data-new-task>${icon("plus")} New task</button>
      <button class="btn btn-ghost" data-goto="dsa">${icon("dsa")} Warm up in the Lab</button>
    </div>
  </section>

  <div class="stat-row stagger">
    ${stat("box", "Projects", d.projects.length, `${d.projects.filter((p) => p.status === "shipped").length} shipped`, "tint-lilac")}
    ${stat("check", "Tasks done", doneTasks.length, `${openTasks.length} still open`, "tint-mint")}
    ${stat("code", "Snippets", d.snippets.length, "saved in the vault", "tint-rose")}
    ${stat("flame", "DSA this week", dsaWeek, "problems warm-up")}
  </div>

  <div class="dash-cols stagger">
    <div class="dash-col">
      <div class="card">
        <div class="card-title">${icon("clock")} Recent activity <button class="title-aux btn-ghost btn btn-sm" data-goto="analytics">All analytics</button></div>
        <div class="feed" style="margin-top:8px">
          ${recent.length ? recent.map((a) => `
            <div class="feed-item">
              <span class="feed-dot ${feedTone[a.type] || ""}">${icon(feedIcon[a.type] || "spark")}</span>
              <div class="feed-body"><b>${esc(a.label)}</b><div class="feed-meta">${esc(a.meta || "·")} · ${timeAgo(a.ts)}</div></div>
            </div>`).join("") : `<p style="color:var(--ink-3);font-size:13.5px;padding:14px 2px">Nothing yet — your story starts with the first commit.</p>`}
        </div>
      </div>

      <div class="card">
        <div class="card-title">${icon("box")} Active projects
          <button class="title-aux btn btn-sm btn-ghost" data-goto="projects">All projects</button>
        </div>
        <div style="margin-top:6px">
          ${activeProjects.length ? activeProjects.slice(0, 4).map((p, i) => `
            <div class="ap-row" data-open-project="${p.id}" role="button" tabindex="0">
              <span class="ap-swatch" style="background:${PROJ_TONES[i % PROJ_TONES.length]}"></span>
              <div class="ap-main"><b>${esc(p.name)}</b><div class="progress" data-w="${p.progress}"><i></i></div></div>
              <span class="ap-pct">${p.progress}%</span>
            </div>`).join("") : `<p style="color:var(--ink-3);font-size:13.5px;padding:14px 2px">No active projects. Grand things start as empty folders.</p>`}
        </div>
      </div>
    </div>

    <div class="dash-col">
      <div class="card">
        <div class="card-title">${icon("target")} Learning progress</div>
        <div class="meter-big" style="margin-top:14px">
          <div class="ring-wrap">
            <svg viewBox="0 0 120 120">
              <circle class="ring-bg" cx="60" cy="60" r="51"/>
              <circle class="ring-fg" cx="60" cy="60" r="51" data-ring="${avgProgress}"/>
            </svg>
            <span class="ring-label">${avgProgress}%</span>
          </div>
          <div style="font-size:13px;color:var(--ink-2)">
            <p><b style="color:var(--ink)">${avgProgress}%</b> average completion across projects</p>
            <p style="margin-top:6px">${Object.keys(d.dsa).length} days of DSA practice logged</p>
            <p style="margin-top:6px">${doneTasks.length} tasks shipped overall</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${icon("spark")} Quick actions</div>
        <div class="qa-grid" style="margin-top:14px">
          <button class="qa-btn" data-new-snippet>${icon("code")} New snippet</button>
          <button class="qa-btn" data-new-resource>${icon("book")} Save resource</button>
          <button class="qa-btn" data-new-task>${icon("check")} New task</button>
          <button class="qa-btn" data-new-project>${icon("box")} New project</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------
   11. View: Projects
   ------------------------------------------------------------ */
function renderProjects() {
  const d = Store.data;
  const list = d.projects;
  return `
  ${viewHead("Projects", "Everything you are building, in one shelf.",
    `<button class="btn btn-primary" data-new-project>${icon("plus")} New project</button>`)}
  ${list.length ? `<div class="proj-grid stagger">${list.map((p, i) => projectCard(p, i)).join("")}</div>`
    : emptyState("[ ]", "No projects yet", "Create your first project and give your ambitions a home.",
      `<button class="btn btn-primary" data-new-project>${icon("plus")} New project</button>`)}`;
}

function projectCard(p, i) {
  const dLeft = daysFromToday(p.deadline);
  const overdue = p.status !== "shipped" && dLeft !== null && dLeft < 0;
  const dlText = p.deadline ? (dLeft === 0 ? "due today" : dLeft > 0 ? `${dLeft}d left` : `${Math.abs(dLeft)}d over`) : "no deadline";
  const linked = Store.data.tasks.filter((t) => t.project === p.id);
  return `
  <article class="proj-card" style="--proj-tone:${PROJ_TONES[i % PROJ_TONES.length]}" data-open-project="${p.id}" tabindex="0" role="button" aria-label="Open ${esc(p.name)}">
    <div class="proj-head">
      <div style="flex:1;min-width:0">
        <div class="proj-name">${esc(p.name)}</div>
        <div style="display:flex;gap:8px;margin-top:7px;flex-wrap:wrap">${statusPill(p.status)} ${priorityFlag(p.priority)}</div>
      </div>
      <div class="card-ops">
        <button class="icon-btn" data-edit-project="${p.id}" aria-label="Edit project">${icon("edit")}</button>
        <button class="icon-btn danger" data-del-project="${p.id}" aria-label="Delete project">${icon("trash")}</button>
      </div>
    </div>
    <p class="proj-desc">${esc(p.description || "No description yet — future you will thank present you for one.")}</p>
    ${p.stack.length ? `<div class="proj-stack">${p.stack.map((s) => `<span class="chip chip-tag">${esc(s)}</span>`).join("")}</div>` : ""}
    <div class="proj-foot">
      <div class="progress" data-w="${p.progress}"><i></i></div>
      <span class="proj-deadline ${overdue ? "overdue" : ""}">${icon("clock", "ic")} ${dlText} · ${linked.filter((t) => t.status === "done").length}/${linked.length} tasks</span>
    </div>
  </article>`;
}

function projectModal(existing) {
  const p = existing || { name: "", description: "", stack: [], status: "exploring", progress: 0, priority: "medium", deadline: "" };
  Modal.open(`
    <div class="modal-head">
      <div><h3>${existing ? "Edit project" : "New project"}</h3><p class="modal-sub">${existing ? "Refine the blueprint." : "Name it before it becomes a repo."}</p></div>
      <button class="icon-btn" data-close-modal aria-label="Close">${icon("x")}</button>
    </div>
    <form id="proj-form" novalidate>
      <div class="form-grid">
        <div class="form-field full">
          <label>Project name <span class="req">*</span></label>
          <input name="name" value="${esc(p.name)}" maxlength="80" placeholder="e.g. Portfolio v3" />
          <span class="field-err">A project needs a name.</span>
        </div>
        <div class="form-field full">
          <label>Description</label>
          <textarea name="description" maxlength="600" placeholder="What is it, and why does it matter?">${esc(p.description)}</textarea>
        </div>
        <div class="form-field">
          <label>Stack <span style="color:var(--ink-3);font-weight:400">(comma separated)</span></label>
          <input name="stack" value="${esc(p.stack.join(", "))}" placeholder="React, Node, Postgres" />
        </div>
        <div class="form-field">
          <label>Status</label>
          <select name="status">${PROJECT_STATUSES.map((s) => `<option value="${s}" ${p.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        </div>
        <div class="form-field">
          <label>Priority</label>
          <select name="priority">${PRIORITIES.map((s) => `<option value="${s}" ${p.priority === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        </div>
        <div class="form-field">
          <label>Deadline</label>
          <input type="date" name="deadline" value="${esc(p.deadline || "")}" />
        </div>
        <div class="form-field">
          <label>Progress</label>
          <div class="range-row">
            <input type="range" name="progress" min="0" max="100" step="5" value="${p.progress}" />
            <output>${p.progress}%</output>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">${existing ? "Save changes" : "Create project"}</button>
      </div>
    </form>`,
    {
      onMount(holder) {
        const form = holder.querySelector("#proj-form");
        const range = form.elements.progress, out = holder.querySelector("output");
        range.addEventListener("input", () => (out.textContent = `${range.value}%`));
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const name = form.elements.name.value.trim();
          const nameField = form.elements.name.closest(".form-field");
          if (!name) {
            nameField.classList.add("invalid");
            form.elements.name.addEventListener("input", () => nameField.classList.remove("invalid"), { once: true });
            return;
          }
          const payload = {
            name,
            description: form.elements.description.value.trim(),
            stack: form.elements.stack.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10),
            status: form.elements.status.value,
            priority: form.elements.priority.value,
            deadline: form.elements.deadline.value || null,
            progress: Number(range.value)
          };
          if (existing) {
            Object.assign(Store.data.projects.find((x) => x.id === existing.id), payload);
            Store.logActivity("project_updated", `Updated project "${payload.name}"`);
          } else {
            Store.data.projects.unshift({ id: uid(), createdAt: Date.now(), ...payload });
            Store.logActivity("project_created", `Created project "${payload.name}"`);
          }
          Store.commit();
          Modal.close();
          toast(existing ? "Project updated" : "Project created");
          if (currentView !== "projects") location.hash = "#/projects"; else setView("projects");
        });
      }
    });
}

function projectDetailModal(id) {
  const p = Store.data.projects.find((x) => x.id === id);
  if (!p) return;
  const linked = Store.data.tasks.filter((t) => t.project === id);
  const dLeft = daysFromToday(p.deadline);
  Modal.open(`
    <div class="detail-hero">
      <div style="flex:1;min-width:0">
        <h3 style="font-size:22px;letter-spacing:-.4px">${esc(p.name)}</h3>
        <div style="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap">${statusPill(p.status)} ${priorityFlag(p.priority)}</div>
      </div>
      <button class="icon-btn" data-close-modal aria-label="Close">${icon("x")}</button>
    </div>
    <p style="font-family:var(--font-serif);font-size:15px;color:var(--ink-2)">${esc(p.description || "No description yet.")}</p>
    <div class="detail-facts">
      <div class="fact"><div class="fact-k">Progress</div><div class="fact-v mono">${p.progress}%</div></div>
      <div class="fact"><div class="fact-k">Deadline</div><div class="fact-v mono">${p.deadline ? fmtDate(p.deadline) : "—"}</div></div>
      <div class="fact"><div class="fact-k">Time left</div><div class="fact-v mono" ${dLeft !== null && dLeft < 0 && p.status !== "shipped" ? 'style="color:var(--bad)"' : ""}>${p.deadline ? (dLeft >= 0 ? `${dLeft} days` : `${Math.abs(dLeft)} days over`) : "—"}</div></div>
      <div class="fact"><div class="fact-k">Created</div><div class="fact-v mono">${timeAgo(p.createdAt)}</div></div>
    </div>
    ${p.stack.length ? `<div class="proj-stack" style="margin-bottom:18px">${p.stack.map((s) => `<span class="chip chip-tag">${esc(s)}</span>`).join("")}</div>` : ""}
    <div class="detail-tasks">
      <div class="card-title" style="margin-bottom:6px">${icon("check")} Linked tasks
        <button class="title-aux btn btn-sm btn-ghost" data-add-task-for="${p.id}">+ Add task</button></div>
      ${linked.length ? linked.map((t) => `
        <div class="task-mini ${t.status === "done" ? "done" : ""}">
          <button class="mini-check" data-toggle-task="${t.id}" aria-label="Toggle task">${icon("check")}</button>
          <span class="mini-title ${overdueTask(t) ? "overdue" : ""}">${esc(t.title)}</span>
          <span class="pill ${STATUS_META[t.status]}" style="font-size:10px">${esc(t.status)}</span>
        </div>`).join("") : `<p style="font-size:13px;color:var(--ink-3);padding:8px 2px">No linked tasks yet.</p>`}
    </div>
    <div class="modal-foot">
      <button class="btn btn-danger" data-del-project="${p.id}">${icon("trash")} Delete</button>
      <button class="btn btn-primary" data-edit-project="${p.id}">${icon("edit")} Edit</button>
    </div>`,
    { wide: true });
}

const overdueTask = (t) => t.status !== "done" && t.due && (daysFromToday(t.due) ?? 1) < 0;

/* ------------------------------------------------------------
   12. View: Tasks
   ------------------------------------------------------------ */
let taskFilter = "all";
let taskQuery = "";

function renderTasks() {
  const d = Store.data;
  const filtered = filterTasks();
  const counts = { all: d.tasks.length, todo: 0, doing: 0, done: 0 };
  d.tasks.forEach((t) => { if (counts[t.status] !== undefined) counts[t.status]++; });

  return `
  ${viewHead("Tasks", "One list to rule the chaos.", `<button class="btn btn-primary" data-new-task>${icon("plus")} New task</button>`)}
  <div class="filter-bar">
    <div class="field-search">${icon("search")}<input id="task-search" placeholder="Search tasks…" value="${esc(taskQuery)}" /></div>
    <div class="seg" id="task-seg">
      ${["all", "todo", "doing", "done"].map((s) => `<button data-tf="${s}" class="${taskFilter === s ? "active" : ""}">${s === "all" ? "All" : s} <span class="seg-n">${counts[s]}</span></button>`).join("")}
    </div>
  </div>
  ${filtered.length ? `<div class="task-list stagger">${filtered.map(taskRow).join("")}</div>`
    : d.tasks.length ? `<div class="empty"><div class="empty-art">{ }</div><h3>No matches</h3><p>Nothing matches this filter. Try a different word.</p></div>`
    : emptyState("[ ]", "No tasks yet", "Break the mountain into pebbles. Add your first task.", `<button class="btn btn-primary" data-new-task>${icon("plus")} New task</button>`)}`;
}

function filterTasks() {
  const q = taskQuery.toLowerCase();
  return Store.data.tasks
    .filter((t) => (taskFilter === "all" || t.status === taskFilter) && (!q || t.title.toLowerCase().includes(q)))
    .sort((a, b) => {
      const rank = { done: 2, doing: 0, todo: 1 };
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      const po = { critical: 0, high: 1, medium: 2, low: 3 };
      if (po[a.priority] !== po[b.priority]) return po[a.priority] - po[b.priority];
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
}

function taskRow(t) {
  const proj = Store.data.projects.find((p) => p.id === t.project);
  const overdue = overdueTask(t);
  const soon = !overdue && t.due && t.status !== "done" && (daysFromToday(t.due) ?? 99) <= 2;
  return `
  <div class="task-row ${t.status === "done" ? "done" : ""}" data-task="${t.id}">
    <button class="task-check" data-toggle-task="${t.id}" aria-label="Toggle complete">${icon("check")}</button>
    <div class="task-main">
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-sub">
        ${priorityFlag(t.priority)}
        ${proj ? `<span class="t-proj">${icon("box", "ic")} ${esc(proj.name)}</span>` : ""}
        ${t.due ? `<span class="t-due ${overdue ? "overdue" : soon ? "soon" : ""}">${icon("clock", "ic")} ${fmtDate(t.due)}${overdue ? " · overdue" : ""}</span>` : ""}
        ${t.completedAt ? `<span style="font-family:var(--font-mono);font-size:11px">done ${timeAgo(t.completedAt)}</span>` : ""}
      </div>
    </div>
    <div class="card-ops">
      <button class="icon-btn" data-edit-task="${t.id}" aria-label="Edit task">${icon("edit")}</button>
      <button class="icon-btn danger" data-del-task="${t.id}" aria-label="Delete task">${icon("trash")}</button>
    </div>
  </div>`;
}

function taskModal(existing, presetProject = null) {
  const projects = Store.data.projects;
  const t = existing || { title: "", project: presetProject, status: "todo", priority: "medium", due: "" };
  Modal.open(`
    <div class="modal-head">
      <div><h3>${existing ? "Edit task" : "New task"}</h3><p class="modal-sub">${existing ? "Adjust the pebble." : "A task a day keeps the panic away."}</p></div>
      <button class="icon-btn" data-close-modal aria-label="Close">${icon("x")}</button>
    </div>
    <form id="task-form" novalidate>
      <div class="form-grid">
        <div class="form-field full">
          <label>Task <span class="req">*</span></label>
          <input name="title" value="${esc(t.title)}" maxlength="120" placeholder="e.g. Wire up the settings screen" />
          <span class="field-err">Give the task a title.</span>
        </div>
        <div class="form-field">
          <label>Project</label>
          <select name="project">
            <option value="">No project</option>
            ${projects.map((p) => `<option value="${p.id}" ${t.project === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-field">
          <label>Due date</label>
          <input type="date" name="due" value="${esc(t.due || "")}" />
        </div>
        <div class="form-field">
          <label>Status</label>
          <select name="status">${TASK_STATUSES.map((s) => `<option value="${s}" ${t.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        </div>
        <div class="form-field">
          <label>Priority</label>
          <select name="priority">${PRIORITIES.map((s) => `<option value="${s}" ${t.priority === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">${existing ? "Save changes" : "Create task"}</button>
      </div>
    </form>`,
    {
      onMount(holder) {
        const form = holder.querySelector("#task-form");
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const title = form.elements.title.value.trim();
          const tf = form.elements.title.closest(".form-field");
          if (!title) {
            tf.classList.add("invalid");
            form.elements.title.addEventListener("input", () => tf.classList.remove("invalid"), { once: true });
            return;
          }
          const prevStatus = t.status;
          const payload = {
            title,
            project: form.elements.project.value || null,
            due: form.elements.due.value || null,
            status: form.elements.status.value,
            priority: form.elements.priority.value
          };
          if (existing) {
            const target = Store.data.tasks.find((x) => x.id === existing.id);
            Object.assign(target, payload);
            if (payload.status === "done" && prevStatus !== "done") {
              target.completedAt = Date.now();
              Store.logActivity("task_completed", `Completed "${title}"`, projName(payload.project));
            }
          } else {
            Store.data.tasks.unshift({ id: uid(), createdAt: Date.now(), completedAt: payload.status === "done" ? Date.now() : null, ...payload });
            if (payload.status === "done") Store.logActivity("task_completed", `Completed "${title}"`, projName(payload.project));
          }
          Store.commit();
          Modal.close();
          toast(existing ? "Task updated" : "Task created");
          if (currentView !== "tasks") location.hash = "#/tasks"; else setView("tasks");
        });
      }
    });
}

const projName = (id) => Store.data.projects.find((p) => p.id === id)?.name || "";

function toggleTask(id) {
  const t = Store.data.tasks.find((x) => x.id === id);
  if (!t) return;
  if (t.status === "done") {
    t.status = "todo"; t.completedAt = null;
  } else {
    t.status = "done"; t.completedAt = Date.now();
    Store.logActivity("task_completed", `Completed "${t.title}"`, projName(t.project));
    toast("Task complete — nice.");
  }
  Store.commit();
  setView(currentView);
}

/* ------------------------------------------------------------
   13. View: Snippets
   ------------------------------------------------------------ */
let snipQuery = "", snipLang = "all";

function renderSnippets() {
  const d = Store.data;
  const list = d.snippets.filter((s) => {
    const q = snipQuery.toLowerCase();
    const matchQ = !q || s.title.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.tags.some((t) => t.toLowerCase().includes(q));
    return matchQ && (snipLang === "all" || s.lang === snipLang);
  });
  const langs = ["all", ...new Set(d.snippets.map((s) => s.lang))];
  return `
  ${viewHead("Snippets", "Small pieces of code worth keeping warm.",
    `<button class="btn btn-primary" data-new-snippet>${icon("plus")} New snippet</button>`)}
  <div class="filter-bar">
    <div class="field-search">${icon("search")}<input id="snip-search" placeholder="Search code, titles, tags…" value="${esc(snipQuery)}" /></div>
    ${langs.length > 1 ? `<div class="seg" id="snip-seg">${langs.map((l) => `<button data-lang="${l}" class="${snipLang === l ? "active" : ""}">${l}</button>`).join("")}</div>` : ""}
  </div>
  ${list.length ? `<div class="snip-grid stagger">${list.map(snippetCard).join("")}</div>`
    : d.snippets.length ? `<div class="empty"><div class="empty-art">{ }</div><h3>No matches</h3><p>Adjust the search or pick another language.</p></div>`
    : emptyState("{ }", "No snippets yet", "Save the code you always forget. Future you says thanks.", `<button class="btn btn-primary" data-new-snippet>${icon("plus")} New snippet</button>`)}`;
}

function snippetCard(s) {
  const lines = s.code.split("\n");
  return `
  <article class="snip-card">
    <div class="snip-head">
      <span class="snip-lang">${esc(s.lang)}</span>
      <span class="snip-title">${esc(s.title)}</span>
      <div class="card-ops">
        <button class="icon-btn" data-edit-snippet="${s.id}" aria-label="Edit snippet">${icon("edit")}</button>
        <button class="icon-btn danger" data-del-snippet="${s.id}" aria-label="Delete snippet">${icon("trash")}</button>
      </div>
    </div>
    <div class="snip-code">
      <span class="line-no">${lines.map((_, i) => i + 1).join("<br>")}</span>
      <pre><code class="code-inner">${highlight(s.code, s.lang)}</code></pre>
    </div>
    <div class="snip-foot">
      ${s.tags.map((t) => `<span class="chip chip-tag">#${esc(t)}</span>`).join("")}
      <button class="copy-btn" data-copy-snippet="${s.id}">${icon("copy")} Copy</button>
    </div>
  </article>`;
}

function snippetModal(existing) {
  const s = existing || { title: "", lang: "javascript", tags: [], code: "" };
  Modal.open(`
    <div class="modal-head">
      <div><h3>${existing ? "Edit snippet" : "New snippet"}</h3><p class="modal-sub">Paste it before it scrolls away.</p></div>
      <button class="icon-btn" data-close-modal aria-label="Close">${icon("x")}</button>
    </div>
    <form id="snip-form" novalidate>
      <div class="form-grid">
        <div class="form-field full">
          <label>Title <span class="req">*</span></label>
          <input name="title" value="${esc(s.title)}" maxlength="90" placeholder="e.g. Retry with backoff" />
          <span class="field-err">A title helps you find it later.</span>
        </div>
        <div class="form-field">
          <label>Language</label>
          <select name="lang">${LANGS.map((l) => `<option value="${l}" ${s.lang === l ? "selected" : ""}>${l}</option>`).join("")}</select>
        </div>
        <div class="form-field">
          <label>Tags <span style="color:var(--ink-3);font-weight:400">(comma separated)</span></label>
          <input name="tags" value="${esc(s.tags.join(", "))}" placeholder="utils, async" />
        </div>
        <div class="form-field full">
          <label>Code <span class="req">*</span></label>
          <textarea name="code" class="code" spellcheck="false" placeholder="Paste your code here…">${esc(s.code)}</textarea>
          <span class="field-err">The snippet needs some code.</span>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">${existing ? "Save changes" : "Save snippet"}</button>
      </div>
    </form>`,
    {
      onMount(holder) {
        const form = holder.querySelector("#snip-form");
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const title = form.elements.title.value.trim();
          const code = form.elements.code.value;
          let bad = false;
          [["title", title], ["code", code.trim()]].forEach(([f, v]) => {
            if (!v) { form.elements[f].closest(".form-field").classList.add("invalid"); bad = true;
              form.elements[f].addEventListener("input", () => form.elements[f].closest(".form-field").classList.remove("invalid"), { once: true }); }
          });
          if (bad) return;
          const payload = { title, lang: form.elements.lang.value, tags: form.elements.tags.value.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean).slice(0, 8), code };
          if (existing) Object.assign(Store.data.snippets.find((x) => x.id === existing.id), payload);
          else { Store.data.snippets.unshift({ id: uid(), createdAt: Date.now(), ...payload }); Store.logActivity("snippet_saved", `Saved snippet "${title}"`, payload.lang); }
          Store.commit();
          Modal.close();
          toast(existing ? "Snippet updated" : "Snippet saved");
          if (currentView !== "snippets") location.hash = "#/snippets"; else setView("snippets");
        });
      }
    });
}

async function copySnippet(id, btn) {
  const s = Store.data.snippets.find((x) => x.id === id);
  if (!s) return;
  const legacyCopy = () => {
    const ta = document.createElement("textarea");
    ta.value = s.code; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const okFlag = document.execCommand("copy");
    ta.remove();
    return okFlag;
  };
  try {
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(s.code); copied = true; }
      catch { copied = legacyCopy(); } // clipboard API can be denied — use the fallback
    } else copied = legacyCopy();
    if (!copied) throw new Error("copy rejected");
    btn.classList.add("copied");
    btn.innerHTML = `${icon("check")} Copied`;
    toast("Copied to clipboard");
    setTimeout(() => { btn.classList.remove("copied"); btn.innerHTML = `${icon("copy")} Copy`; }, 1600);
  } catch { toast("Copy failed — select the code manually.", "warn"); }
}

/* ------------------------------------------------------------
   14. View: Resources
   ------------------------------------------------------------ */
let resQuery = "", resCat = "all";

function renderResources() {
  const d = Store.data;
  const list = d.resources.filter((r) => {
    const q = resQuery.toLowerCase();
    const matchQ = !q || r.title.toLowerCase().includes(q) || r.url.toLowerCase().includes(q) || r.note.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q));
    return matchQ && (resCat === "all" || r.category === resCat);
  });
  return `
  ${viewHead("Resources", "A bookmarks bar that actually stays organized.",
    `<button class="btn btn-primary" data-new-resource>${icon("plus")} Save resource</button>`)}
  <div class="filter-bar">
    <div class="field-search">${icon("search")}<input id="res-search" placeholder="Search resources…" value="${esc(resQuery)}" /></div>
    <div class="seg" id="res-seg">
      ${["all", ...RES_CATS].map((c) => `<button data-cat="${c}" class="${resCat === c ? "active" : ""}">${c === "all" ? "All" : c}</button>`).join("")}
    </div>
  </div>
  ${list.length ? `<div class="res-grid stagger">${list.map(resCard).join("")}</div>`
    : d.resources.length ? `<div class="empty"><div class="empty-art">{ }</div><h3>No matches</h3><p>Nothing here with that filter.</p></div>`
    : emptyState("</>", "No resources yet", "Save the tutorials and docs you keep re-googling.", `<button class="btn btn-primary" data-new-resource>${icon("plus")} Save resource</button>`)}`;
}

function resCard(r) {
  let host = r.url;
  try { host = new URL(r.url).hostname.replace(/^www\./, ""); } catch { /* keep raw */ }
  return `
  <article class="res-card">
    <span class="res-favicon">${esc(r.title.charAt(0))}</span>
    <div class="res-body">
      <div class="res-title">${esc(r.title)}</div>
      <div class="res-host">${esc(host)}</div>
      ${r.note ? `<p class="res-note">${esc(r.note)}</p>` : ""}
      <div class="res-tags"><span class="chip">${esc(r.category)}</span>${r.tags.map((t) => `<span class="chip chip-tag">#${esc(t)}</span>`).join("")}</div>
    </div>
    <div class="res-ops">
      <a class="icon-btn" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open resource">${icon("ext")}</a>
      <button class="icon-btn" data-edit-resource="${r.id}" aria-label="Edit resource">${icon("edit")}</button>
      <button class="icon-btn danger" data-del-resource="${r.id}" aria-label="Delete resource">${icon("trash")}</button>
    </div>
  </article>`;
}

function resourceModal(existing) {
  const r = existing || { title: "", url: "", category: "reference", tags: [], note: "" };
  Modal.open(`
    <div class="modal-head">
      <div><h3>${existing ? "Edit resource" : "Save resource"}</h3><p class="modal-sub">A link worth keeping is a link worth describing.</p></div>
      <button class="icon-btn" data-close-modal aria-label="Close">${icon("x")}</button>
    </div>
    <form id="res-form" novalidate>
      <div class="form-grid">
        <div class="form-field full">
          <label>Title <span class="req">*</span></label>
          <input name="title" value="${esc(r.title)}" maxlength="90" placeholder="e.g. MDN Web Docs" />
          <span class="field-err">Give it a name.</span>
        </div>
        <div class="form-field full">
          <label>URL <span class="req">*</span></label>
          <input name="url" value="${esc(r.url)}" maxlength="400" placeholder="https://…" inputmode="url" />
          <span class="field-err">A valid URL is needed (https://…).</span>
        </div>
        <div class="form-field">
          <label>Category</label>
          <select name="category">${RES_CATS.map((c) => `<option value="${c}" ${r.category === c ? "selected" : ""}>${c}</option>`).join("")}</select>
        </div>
        <div class="form-field">
          <label>Tags <span style="color:var(--ink-3);font-weight:400">(comma separated)</span></label>
          <input name="tags" value="${esc(r.tags.join(", "))}" placeholder="css, layout" />
        </div>
        <div class="form-field full">
          <label>Note</label>
          <textarea name="note" maxlength="300" placeholder="Why is this worth keeping?">${esc(r.note)}</textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">${existing ? "Save changes" : "Save resource"}</button>
      </div>
    </form>`,
    {
      onMount(holder) {
        const form = holder.querySelector("#res-form");
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const title = form.elements.title.value.trim();
          const rawURL = form.elements.url.value.trim();
          const urlField = form.elements.url.closest(".form-field");
          let urlOK = false;
          let url = normalizeURL(rawURL);
          try { urlOK = Boolean(new URL(url).hostname.includes(".")); } catch { urlOK = false; }
          let bad = false;
          [["title", title], ["url", rawURL]].forEach(([f, v]) => {
            if (!v) { form.elements[f].closest(".form-field").classList.add("invalid"); bad = true;
              form.elements[f].addEventListener("input", () => form.elements[f].closest(".form-field").classList.remove("invalid"), { once: true }); }
          });
          if (!urlOK) { urlField.classList.add("invalid"); bad = true;
            form.elements.url.addEventListener("input", () => urlField.classList.remove("invalid"), { once: true }); }
          if (bad) return;
          const payload = {
            title, url,
            category: form.elements.category.value,
            tags: form.elements.tags.value.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean).slice(0, 8),
            note: form.elements.note.value.trim()
          };
          if (existing) Object.assign(Store.data.resources.find((x) => x.id === existing.id), payload);
          else { Store.data.resources.unshift({ id: uid(), createdAt: Date.now(), ...payload }); Store.logActivity("resource_saved", `Bookmarked "${title}"`, payload.category); }
          Store.commit();
          Modal.close();
          toast(existing ? "Resource updated" : "Resource saved");
          if (currentView !== "resources") location.hash = "#/resources"; else setView("resources");
        });
      }
    });
}

/* ------------------------------------------------------------
   15. View: DSA Lab (step-generator visualizer)
   ------------------------------------------------------------ */
const Lab = {
  arr: [], steps: [], stepIdx: -1, playing: false, timer: null,
  algo: "bubble", speed: 6, size: 18, status: "idle",

  newSteps() {
    this.pause();
    this.arr = Array.from({ length: this.size }, () => 8 + Math.floor(Math.random() * 92));
    this.steps = [...ALGOS[this.algo].gen(this.arr.slice())]; // materialize generator into frames
    this.stepIdx = -1;
    this.status = "ready";
    this.render();
    setLabStatus("Ready — press play to sort.", "ready");
  },

  genAndPlay() {
    if (this.stepIdx >= this.steps.length - 1) this.newSteps();
    this.play();
  },

  play() {
    if (!this.steps.length) this.newSteps();
    if (this.stepIdx >= this.steps.length - 1) { this.newSteps(); }
    this.playing = true;
    this.status = "running";
    this.tick();
  },

  tick() {
    clearTimeout(this.timer);
    if (!this.playing) return;
    if (this.stepIdx >= this.steps.length - 1) {
      this.playing = false; this.status = "done";
      this.render();
      setLabStatus(`Sorted in ${this.steps.length} steps. Log a warm-up?`, "done");
      return;
    }
    this.stepIdx++;
    this.render();
    const base = 700 / clamp(this.speed, 1, 12);
    const step = this.steps[this.stepIdx];
    // long pauses on swap frames for readability
    const factor = step && (step.type === "swap" || step.type === "write") ? 1.6 : 1;
    this.timer = setTimeout(() => this.tick(), base * factor);
  },

  pause() { this.playing = false; clearTimeout(this.timer); this.status = this.stepIdx >= this.steps.length - 1 && this.steps.length ? "done" : "paused"; if (this.steps.length) setLabStatus(this.status === "done" ? "Sorted." : "Paused.", this.status); },

  reset() { this.pause(); this.stepIdx = -1; this.status = this.steps.length ? "ready" : "idle"; this.render(); setLabStatus(this.steps.length ? "Reset to the original array." : "Generate an array to begin.", "ready"); },

  render() {
    const stage = $("#lab-stage");
    if (!stage) return;
    const view = this.steps.length && this.stepIdx >= 0 ? this.steps[this.stepIdx].arr : this.arr;
    const marks = this.steps.length && this.stepIdx >= 0 ? this.steps[this.stepIdx].marks || {} : {};
    const max = Math.max(...view, 1);
    stage.innerHTML = view.map((v, i) => {
      const cls = marks.sorted?.includes(i) ? "sorted" : marks.swap?.includes(i) ? "swap" : marks.cmp?.includes(i) ? "cmp" : marks.pivot === i ? "pivot" : "";
      return `<div class="lab-bar ${cls} ${this.speed >= 8 ? "show-val" : ""}" style="height:${Math.round((v / max) * 250) + 8}px"><span>${v}</span></div>`;
    }).join("");
    const meta = $("#lab-step-meta");
    if (meta) meta.textContent = this.steps.length ? `step ${clamp(this.stepIdx + 1, 0, this.steps.length)} / ${this.steps.length}` : "no steps yet";
  }
};

function setLabStatus(text, state) {
  const el = $("#lab-status");
  if (!el) return;
  const txt = el.querySelector(".status-txt");
  if (txt) txt.textContent = text;
  el.className = `lab-status ${state === "running" ? "running" : state === "done" ? "done" : ""}`;
}

/* --- Step generators: each yields {arr, marks, note} --- */
function* genBubble(input) {
  const a = input.slice(); const n = a.length;
  const sorted = [];
  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j++) {
      yield { arr: a.slice(), marks: { cmp: [j, j + 1], sorted: [...sorted] }, note: `compare ${a[j]} and ${a[j + 1]}` };
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
        yield { arr: a.slice(), marks: { swap: [j, j + 1], sorted: [...sorted] }, note: `swap ${a[j + 1]} and ${a[j]}` };
      }
    }
    sorted.unshift(n - 1 - i);
    yield { arr: a.slice(), marks: { sorted: [...sorted] }, note: `${a[n - 1 - i]} is in place` };
    if (!swapped) { for (let k = 0; k < n; k++) if (!sorted.includes(k)) sorted.push(k); yield { arr: a.slice(), marks: { sorted: [...sorted] }, note: "already sorted" }; break; }
  }
  yield { arr: a.slice(), marks: { sorted: a.map((_, i) => i) }, note: "done" };
}

function* genSelection(input) {
  const a = input.slice(); const n = a.length; const sorted = [];
  for (let i = 0; i < n - 1; i++) {
    let min = i;
    yield { arr: a.slice(), marks: { pivot: min, sorted: [...sorted] }, note: `scan for the minimum from index ${i}` };
    for (let j = i + 1; j < n; j++) {
      yield { arr: a.slice(), marks: { cmp: [j, min], pivot: i, sorted: [...sorted] }, note: `compare ${a[j]} with current min ${a[min]}` };
      if (a[j] < a[min]) { min = j; yield { arr: a.slice(), marks: { pivot: min, sorted: [...sorted] }, note: `new minimum: ${a[min]}` }; }
    }
    if (min !== i) { [a[i], a[min]] = [a[min], a[i]]; yield { arr: a.slice(), marks: { swap: [i, min], sorted: [...sorted] }, note: `swap ${a[i]} into position ${i}` }; }
    sorted.push(i);
  }
  sorted.push(n - 1);
  yield { arr: a.slice(), marks: { sorted: a.map((_, i) => i) }, note: "done" };
}

function* genInsertion(input) {
  const a = input.slice(); const n = a.length;
  yield { arr: a.slice(), marks: { sorted: [0] }, note: "treat the first element as sorted" };
  for (let i = 1; i < n; i++) {
    const key = a[i]; let j = i - 1;
    yield { arr: a.slice(), marks: { pivot: i, sorted: range(0, i - 1) }, note: `pick up ${key}` };
    while (j >= 0 && a[j] > key) {
      yield { arr: a.slice(), marks: { cmp: [j, j + 1], pivot: i, sorted: range(0, i - 1) }, note: `${a[j]} > ${key}, shift right` };
      a[j + 1] = a[j];
      yield { arr: a.slice(), marks: { swap: [j, j + 1], pivot: i, sorted: range(0, i - 1) }, note: "shift" };
      j--;
    }
    a[j + 1] = key;
    yield { arr: a.slice(), marks: { sorted: range(0, i) }, note: `insert ${key} at position ${j + 1}` };
  }
  yield { arr: a.slice(), marks: { sorted: a.map((_, i) => i) }, note: "done" };
}

function* genMerge(input) {
  const a = input.slice();
  const marks = { sorted: [] };

  function* ms(lo, hi) {
    if (hi - lo < 1) return;
    const mid = (lo + hi) >> 1;
    yield* ms(lo, mid); yield* ms(mid + 1, hi);
    const merged = [];
    let i = lo, j = mid + 1;
    while (i <= mid && j <= hi) {
      marks.cmp = [i, j]; marks.pivot = null; marks.swap = null; marks.sorted = [];
      yield { arr: a.slice(), marks: { ...marks }, note: `merge: compare ${a[i]} and ${a[j]}` };
      if (a[i] <= a[j]) merged.push(a[i++]); else merged.push(a[j++]);
    }
    while (i <= mid) merged.push(a[i++]);
    while (j <= hi) merged.push(a[j++]);
    for (let k = 0; k < merged.length; k++) a[lo + k] = merged[k];
    yield { arr: a.slice(), marks: { sorted: range(lo, hi) }, note: `wrote ${merged.length} values back to [${lo}…${hi}]` };
  }
  yield* ms(0, a.length - 1);
  yield { arr: a.slice(), marks: { sorted: a.map((_, i) => i) }, note: "done" };
}

function* genQuick(input) {
  const a = input.slice();

  function* qs(lo, hi) {
    if (lo > hi) return;
    if (lo === hi) { yield { arr: a.slice(), marks: { sorted: [lo] }, note: `${a[lo]} is a single element — in place` }; return; }
    const p = a[lo + ((hi - lo) >> 1)];
    let i = lo, j = hi;
    yield { arr: a.slice(), marks: { pivot: lo + ((hi - lo) >> 1) }, note: `partition [${lo}…${hi}] around ${p}` };
    while (i <= j) {
      while (a[i] < p) { yield { arr: a.slice(), marks: { cmp: [i], pivot: lo + ((hi - lo) >> 1) }, note: `${a[i]} < ${p}, move left pointer` }; i++; }
      while (a[j] > p) { yield { arr: a.slice(), marks: { cmp: [j], pivot: lo + ((hi - lo) >> 1) }, note: `${a[j]} > ${p}, move right pointer` }; j--; }
      if (i <= j) {
        if (a[i] !== a[j]) { [a[i], a[j]] = [a[j], a[i]]; yield { arr: a.slice(), marks: { swap: [i, j], pivot: lo + ((hi - lo) >> 1) }, note: `swap ${a[i]} and ${a[j]}` }; }
        i++; j--;
      }
    }
    yield { arr: a.slice(), marks: { sorted: range(lo, hi) }, note: `partition complete for [${lo}…${hi}]` };
    yield* qs(lo, j); yield* qs(i, hi);
  }
  yield* qs(0, a.length - 1);
  yield { arr: a.slice(), marks: { sorted: a.map((_, i) => i) }, note: "done" };
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

function renderDSA() {
  const algo = ALGOS[Lab.algo];
  return `
  ${viewHead("DSA Lab", "Watch the classics earn their reputation, step by step.")}
  <div class="lab-wrap stagger">
    <div class="card lab-stage-card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <div style="font-weight:600;font-size:15px">${esc(algo.name)}</div>
        <span class="chip chip-tag">${esc(algo.avg)} average</span>
        <span class="lab-status" id="lab-status" style="margin-left:auto"><span class="status-dot"></span><span class="status-txt">Generate an array to begin.</span></span>
      </div>
      <div class="lab-stage" id="lab-stage" aria-label="Sorting visualization"></div>
      <div class="lab-legend">
        <span><i style="background:var(--warn)"></i>comparing</span>
        <span><i style="background:var(--bad)"></i>swapping</span>
        <span><i style="background:var(--lilac)"></i>pivot / key</span>
        <span><i style="background:var(--good)"></i>sorted</span>
        <span style="margin-left:auto;font-family:var(--font-mono)" id="lab-step-meta"></span>
      </div>
      <div class="lab-controls" style="margin-top:18px">
        <div class="lab-btn-row">
          <button class="btn btn-primary" id="lab-play">${icon("play")} <span>Sort</span></button>
          <button class="btn btn-ghost" id="lab-pause">${icon("pause")} Pause</button>
          <button class="btn btn-ghost" id="lab-reset">${icon("reset")} Reset</button>
          <button class="btn btn-ghost" id="lab-new">${icon("shuffle")} New array</button>
        </div>
        <div class="ctrl-field">
          <label>Speed <output>${Lab.speed}</output></label>
          <input type="range" id="lab-speed" min="1" max="12" value="${Lab.speed}" />
        </div>
        <div class="ctrl-field">
          <label>Array size <output>${Lab.size}</output></label>
          <input type="range" id="lab-size" min="8" max="40" value="${Lab.size}" />
        </div>
      </div>
    </div>

    <div class="lab-side">
      <div class="card">
        <div class="card-title">${icon("dsa")} Pick an algorithm</div>
        <div class="lab-algo-pick" style="margin-top:12px">
          ${Object.entries(ALGOS).map(([k, a]) => `
            <button class="algo-btn ${Lab.algo === k ? "active" : ""}" data-algo="${k}">
              ${icon("spark")}<span><b>${esc(a.name)}</b><span class="algo-meta">avg ${esc(a.avg)}</span></span>
            </button>`).join("")}
        </div>
      </div>
      <div class="card">
        <div class="card-title">${icon("clock")} Complexity</div>
        <table class="complex-table" style="margin-top:10px" id="complex-table">
          <tr><th>Case</th><th>Time</th></tr>
          <tr data-row="best"><td>Best</td><td>${esc(algo.best)}</td></tr>
          <tr data-row="avg" class="hot"><td>Average</td><td>${esc(algo.avg)}</td></tr>
          <tr data-row="worst"><td>Worst</td><td>${esc(algo.worst)}</td></tr>
          <tr data-row="space"><td>Space</td><td>${esc(algo.space)}</td></tr>
        </table>
      </div>
      <div class="card">
        <div class="card-title">${icon("flame")} Practice log</div>
        <p style="font-size:13px;color:var(--ink-2);margin:10px 0 12px">Finished a run? Log it — it feeds your analytics.</p>
        <button class="btn btn-primary btn-sm" id="lab-log" style="width:100%;justify-content:center">${icon("check")} Log today's warm-up</button>
      </div>
    </div>
  </div>`;
}

function mountDSA() {
  Lab.newSteps();
  $("#lab-play").addEventListener("click", () => Lab.genAndPlay());
  $("#lab-pause").addEventListener("click", () => { Lab.pause(); });
  $("#lab-reset").addEventListener("click", () => Lab.reset());
  $("#lab-new").addEventListener("click", () => Lab.newSteps());
  $("#lab-speed").addEventListener("input", (e) => {
    Lab.speed = Number(e.target.value);
    e.target.closest(".ctrl-field").querySelector("output").textContent = Lab.speed;
    Lab.render();
  });
  $("#lab-size").addEventListener("input", (e) => {
    Lab.size = Number(e.target.value);
    e.target.closest(".ctrl-field").querySelector("output").textContent = Lab.size;
    Lab.newSteps();
  });
  $$("#view-root [data-algo]").forEach((b) => b.addEventListener("click", () => {
    Lab.algo = b.dataset.algo;
    Lab.newSteps();
    // refresh algorithm meta panels without a full re-render
    $$("#view-root [data-algo]").forEach((x) => x.classList.toggle("active", x === b));
    const a = ALGOS[Lab.algo];
    const titleEl = $("#view-root .lab-stage-card .card-title, #view-root .lab-stage-card div[style*='font-weight:600']");
    if (titleEl) titleEl.textContent = a.name;
    const table = $("#complex-table");
    if (table) {
      table.querySelector("[data-row='best'] td:last-child").textContent = a.best;
      table.querySelector("[data-row='avg'] td:last-child").textContent = a.avg;
      table.querySelector("[data-row='worst'] td:last-child").textContent = a.worst;
      table.querySelector("[data-row='space'] td:last-child").textContent = a.space;
    }
  }));
  $("#lab-log").addEventListener("click", () => {
    const today = todayISO();
    Store.data.dsa[today] = (Store.data.dsa[today] || 0) + 1;
    Store.logActivity("dsa", "Logged a sorting run in the DSA Lab", ALGOS[Lab.algo].name);
    Store.commit();
    updateVaultMeter();
    toast("Warm-up logged. Streak alive.");
  });
}

/* ------------------------------------------------------------
   16. View: Analytics (vanilla charts)
   ------------------------------------------------------------ */
function renderAnalytics() {
  const d = Store.data;

  // weekly activity: last 7 days, tasks completed + dsa logged
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(); date.setDate(date.getDate() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    days.push({
      key, label: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
      tasks: d.tasks.filter((t) => t.completedAt && new Date(t.completedAt).toDateString() === date.toDateString()).length,
      dsa: d.dsa[key] || 0
    });
  }
  const maxDay = Math.max(...days.map((x) => x.tasks + x.dsa), 1);

  // project status donut
  const statusCounts = PROJECT_STATUSES.map((s) => ({ label: s, n: d.projects.filter((p) => p.status === s).length })).filter((x) => x.n);
  const totalProjects = d.projects.length;

  // language distribution
  const langCounts = {};
  d.snippets.forEach((s) => { langCounts[s.lang] = (langCounts[s.lang] || 0) + 1; });
  const topLangs = Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxLang = Math.max(...topLangs.map(([, n]) => n), 1);

  // 12-week DSA heatmap (84 cells)
  const heat = [];
  for (let i = 83; i >= 0; i--) {
    const date = new Date(); date.setDate(date.getDate() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    heat.push({ n: d.dsa[key] || 0 });
  }

  const donePct = d.tasks.length ? Math.round((d.tasks.filter((t) => t.status === "done").length / d.tasks.length) * 100) : 0;

  const DONUT_COLORS = { exploring: "var(--sky)", building: "var(--warn)", shipped: "var(--good)", paused: "var(--ink-3)" };
  let donutSegs = "";
  if (totalProjects) {
    const r = 60, c = 2 * Math.PI * r;
    let offset = 0;
    donutSegs = statusCounts.map((s) => {
      const frac = s.n / totalProjects;
      const seg = `<circle class="donut-seg" cx="80" cy="80" r="${r}" stroke="${DONUT_COLORS[s.label]}" stroke-dasharray="${(frac * c - 3).toFixed(1)} ${c}" stroke-dashoffset="${-offset}"/>`;
      offset += frac * c;
      return seg;
    }).join("");
  }

  return `
  ${viewHead("Analytics", "The vault, measured.")}
  <div class="an-grid stagger">
    <div class="card">
      <div class="card-title">${icon("chart")} Weekly momentum <span class="title-aux">tasks done · DSA problems</span></div>
      <div class="chart-box" style="margin-top:16px">
        <div class="bar-col-group">
          ${days.map((x, i) => `
            <div class="bar-col" title="${x.label}: ${x.tasks} tasks, ${x.dsa} DSA">
              <div class="bar-stack">
                ${x.tasks ? `<div class="bar-seg" style="height:${(x.tasks / maxDay) * 170}px;background:var(--accent);animation-delay:${i * 60}ms"></div>` : ""}
                ${x.dsa ? `<div class="bar-seg" style="height:${(x.dsa / maxDay) * 170}px;background:var(--lilac);animation-delay:${i * 60 + 80}ms"></div>` : ""}
              </div>
              <span class="bar-val">${x.tasks + x.dsa || ""}</span>
            </div>`).join("")}
        </div>
      </div>
      <div class="chart-x-labels">${days.map((x) => `<span>${esc(x.label)}</span>`).join("")}</div>
      <div class="lab-legend" style="margin-top:10px"><span><i style="background:var(--accent)"></i>tasks</span><span><i style="background:var(--lilac)"></i>DSA</span></div>
    </div>

    <div class="card">
      <div class="card-title">${icon("box")} Project pipeline</div>
      ${totalProjects ? `
      <div class="donut-wrap" style="margin-top:18px">
        <svg class="donut-svg" viewBox="0 0 160 160">${donutSegs}</svg>
        <div class="donut-legend">
          ${statusCounts.map((s) => `<div class="dl-row"><span class="dl-dot" style="background:${DONUT_COLORS[s.label]}"></span>${esc(s.label)}<b>${s.n}</b></div>`).join("")}
        </div>
      </div>` : `<p style="color:var(--ink-3);padding:24px 0;font-family:var(--font-serif);font-style:italic">No projects to measure yet.</p>`}
      <div style="margin-top:18px">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--ink-2);margin-bottom:7px"><span>Tasks completed</span><b class="pr-flag">${donePct}%</b></div>
        <div class="progress mint" data-w="${donePct}"><i></i></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">${icon("code")} Snippet languages</div>
      ${topLangs.length ? `<div style="display:flex;flex-direction:column;gap:13px;margin-top:16px">
        ${topLangs.map(([l, n]) => `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span style="font-family:var(--font-mono)">${esc(l)}</span><span style="color:var(--ink-3);font-family:var(--font-mono)">${n}</span></div>
            <div class="progress rose" data-w="${Math.round((n / maxLang) * 100)}"><i></i></div>
          </div>`).join("")}
      </div>` : `<p style="color:var(--ink-3);padding:24px 0;font-family:var(--font-serif);font-style:italic">Save a few snippets to see the breakdown.</p>`}
    </div>

    <div class="card">
      <div class="card-title">${icon("flame")} DSA consistency <span class="title-aux">last 12 weeks</span></div>
      <div class="heat-grid" style="margin-top:16px">
        ${chunk(heat, 7).map((week) => `
          <div class="heat-row">
            ${week.map((c) => `<span class="heat-cell ${c.n ? c.n >= 4 ? "h4" : c.n >= 3 ? "h3" : c.n >= 2 ? "h2" : "h1" : ""}" title="${c.n} logged"></span>`).join("")}
          </div>`).join("")}
      </div>
      <div class="lab-legend" style="margin-top:12px">
        <span>less</span>
        <i style="background:var(--card-2)"></i><i style="background:color-mix(in srgb, var(--accent) 25%, var(--card-2))"></i><i style="background:color-mix(in srgb, var(--accent) 50%, var(--card-2))"></i><i style="background:color-mix(in srgb, var(--accent) 75%, var(--card-2))"></i><i style="background:var(--accent)"></i>
        <span>more</span>
      </div>
    </div>
  </div>`;
}

const chunk = (arr, n) => arr.reduce((acc, x, i) => (i % n ? acc[acc.length - 1].push(x) : acc.push([x]), acc), []);

/* ------------------------------------------------------------
   17. View: Settings
   ------------------------------------------------------------ */
function renderSettings() {
  const d = Store.data;
  const theme = Prefs.theme;
  const counts = ` ${d.projects.length} projects · ${d.tasks.length} tasks · ${d.snippets.length} snippets · ${d.resources.length} resources`;
  return `
  ${viewHead("Settings", "Make the vault yours.")}
  <div class="settings-wrap stagger">
    <div class="card">
      <div class="card-title">${icon("gear")} Preferences</div>
      <div class="set-row">
        <div class="set-main"><b>Display name</b><p>Used across the dashboard and greeting.</p></div>
        <div class="name-field" style="max-width:300px">
          <input id="set-name" value="${esc(d.profile.name)}" maxlength="40" placeholder="Your name" />
          <button class="btn btn-ghost btn-sm" id="set-name-save">Save</button>
        </div>
      </div>
      <div class="set-row">
        <div class="set-main"><b>Theme</b><p>Oxblood night, or a paper-warm day.</p></div>
        <div class="theme-cards" style="max-width:340px">
          <button class="theme-card ${theme === "night" ? "active" : ""}" data-set-theme="night">
            <span class="swatch swatch-night"><i></i><i></i><i></i></span>Night
          </button>
          <button class="theme-card ${theme === "day" ? "active" : ""}" data-set-theme="day">
            <span class="swatch swatch-day"><i></i><i></i><i></i></span>Day
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">${icon("download")} Your data</div>
      <p style="font-size:13px;color:var(--ink-3);margin:8px 0 4px">Everything lives in your browser's localStorage${counts}.</p>
      <div class="set-row">
        <div class="set-main"><b>Export</b><p>Download a JSON backup of the whole vault.</p></div>
        <button class="btn btn-ghost btn-sm" id="set-export">${icon("download")} Export JSON</button>
      </div>
      <div class="set-row">
        <div class="set-main"><b>Import</b><p>Restore a previous export. Current data will be replaced.</p></div>
        <button class="btn btn-ghost btn-sm" id="set-import">${icon("upload")} Import JSON</button>
      </div>
    </div>

    <div class="card" style="border-color:color-mix(in srgb, var(--bad) 35%, var(--edge))">
      <div class="card-title" style="color:var(--bad)">${icon("trash")} Danger zone</div>
      <div class="set-row">
        <div class="set-main"><b>Reset to demo data</b><p>Bring back the sample projects and tasks.</p></div>
        <button class="btn btn-ghost btn-sm" id="set-demo">Reset demo</button>
      </div>
      <div class="set-row">
        <div class="set-main"><b>Erase everything</b><p>Wipe all data and start from a clean vault.</p></div>
        <button class="btn btn-danger btn-sm" id="set-wipe">Erase all data</button>
      </div>
    </div>
  </div>`;
}

function mountSettings() {
  $("#set-name-save").addEventListener("click", () => {
    const v = $("#set-name").value.trim();
    if (!v) { toast("Name cannot be empty.", "warn"); return; }
    Store.data.profile.name = v.slice(0, 40);
    Store.commit();
    updateSideUser();
    toast("Name saved");
  });
  $("#set-name").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#set-name-save").click(); });
  $$("[data-set-theme]").forEach((b) => b.addEventListener("click", () => {
    Prefs.setTheme(b.dataset.setTheme);
    setView("settings");
    toast(`Switched to ${b.dataset.setTheme} theme`);
  }));
  $("#set-export").addEventListener("click", () => {
    try {
      const blob = new Blob([Store.exportPayload()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `devvault-backup-${todayISO()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("Backup downloaded");
    } catch { toast("Export failed.", "bad"); }
  });
  $("#set-import").addEventListener("click", () => $("#import-file").click());
  $("#set-demo").addEventListener("click", async () => {
    if (await confirmModal({ title: "Reset to demo data?", message: "Your current projects, tasks, snippets and resources will be replaced by the sample vault.", confirmLabel: "Reset demo", danger: true })) {
      Store.resetDemo(); updateSideUser(); gotoView("dashboard"); toast("Demo data restored");
    }
  });
  $("#set-wipe").addEventListener("click", async () => {
    if (await confirmModal({ title: "Erase everything?", message: "This deletes all data from this browser. There is no undo — export a backup first.", confirmLabel: "Erase all", danger: true })) {
      Store.wipeAll(); updateSideUser(); gotoView("dashboard"); toast("Vault wiped clean", "warn");
    }
  });
}

/* ------------------------------------------------------------
   18. Global search
   ------------------------------------------------------------ */
const Search = {
  open() {
    $("#search-layer").hidden = false;
    const input = $("#search-input");
    input.value = "";
    renderSearch("");
    document.body.style.overflow = "hidden";
    setTimeout(() => input.focus(), 30);
  },
  close() { $("#search-layer").hidden = true; document.body.style.overflow = ""; }
};

function markMatch(text, q) {
  if (!q) return esc(text);
  return esc(text).replace(new RegExp(`(${escapeRegExp(esc(q))})`, "ig"), "<mark>$1</mark>");
}

function renderSearch(q) {
  const body = $("#search-body");
  const query = q.trim().toLowerCase();
  if (!query) {
    const hints = ["react", "python", "css", "notes", "api"];
    body.innerHTML = `<div class="search-hint"><p><b>Pro tip:</b> everything you own lives in one vault — try <em>react</em>, <em>python</em>, or a project name.</p><div class="search-hint-tags" id="search-hint-tags">${hints.map((h) => `<button data-hint="${h}">${h}</button>`).join("")}</div></div>`;
    $$("#search-body [data-hint]").forEach((b) => b.addEventListener("click", () => { $("#search-input").value = b.dataset.hint; renderSearch(b.dataset.hint); }));
    return;
  }

  const d = Store.data;
  const groups = [
    { kind: "Projects", icon: "box", hits: d.projects.filter((p) => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query) || p.stack.some((s) => s.toLowerCase().includes(query))).slice(0, 4).map((p) => ({ id: p.id, title: p.name, sub: p.status + (p.stack.length ? " · " + p.stack.slice(0, 3).join(", ") : ""), act: () => projectDetailModal(p.id) })) },
    { kind: "Tasks", icon: "check", hits: d.tasks.filter((t) => t.title.toLowerCase().includes(query)).slice(0, 4).map((t) => ({ id: t.id, title: t.title, sub: `${t.status}${projName(t.project) ? " · " + projName(t.project) : ""}`, act: () => { location.hash = "#/tasks"; } })) },
    { kind: "Snippets", icon: "code", hits: d.snippets.filter((s) => s.title.toLowerCase().includes(query) || s.code.toLowerCase().includes(query) || s.tags.some((t) => t.toLowerCase().includes(query))).slice(0, 4).map((s) => ({ id: s.id, title: s.title, sub: s.lang + (s.tags.length ? " · #" + s.tags.join(" #") : ""), act: () => { location.hash = "#/snippets"; } })) },
    { kind: "Resources", icon: "book", hits: d.resources.filter((r) => r.title.toLowerCase().includes(query) || r.note.toLowerCase().includes(query) || r.url.toLowerCase().includes(query) || r.tags.some((t) => t.toLowerCase().includes(query))).slice(0, 4).map((r) => ({ id: r.id, title: r.title, sub: r.url, act: () => { location.hash = "#/resources"; } })) }
  ].filter((g) => g.hits.length);

  if (!groups.length) {
    body.innerHTML = `<div class="search-empty">Nothing in the vault matches "<b>${esc(q.trim())}</b>".</div>`;
    return;
  }

  body.innerHTML = groups.map((g) => `
    <div class="search-group-label">${g.kind}</div>
    ${g.hits.map((h) => `
      <button class="search-hit" data-hit="${h.id}">
        <span class="hit-ic">${icon(g.icon)}</span>
        <span class="hit-main"><span class="hit-title">${markMatch(h.title, q.trim())}</span><span class="hit-sub">${esc(h.sub)}</span></span>
        <span class="hit-kind">${g.kind}</span>
      </button>`).join("")}`).join("");

  $$("#search-body .search-hit").forEach((btn) => btn.addEventListener("click", () => {
    const hit = groups.flatMap((g) => g.hits.map((h) => ({ ...h, icon: g.icon }))).find((h) => h.id === btn.dataset.hit);
    Search.close();
    if (hit) setTimeout(hit.act, 10);
  }));
}

/* ------------------------------------------------------------
   19. Import handling
   ------------------------------------------------------------ */
function gotoView(id) {
  if (location.hash !== `#/${id}`) location.hash = `#/${id}`; else setView(id);
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      Store.importPayload(parsed);
      updateSideUser();
      gotoView("dashboard");
      toast("Import complete — welcome back.");
    } catch (err) {
      toast(err?.message || "Import failed — not a valid export.", "bad");
    }
  };
  reader.onerror = () => toast("Could not read that file.", "bad");
  reader.readAsText(file);
}

/* ------------------------------------------------------------
   20. Global event wiring
   ------------------------------------------------------------ */
function wireGlobal() {
  // delegated clicks
  document.addEventListener("click", (e) => {
    const t = e.target;

    const closest = (sel) => t.closest(sel);

    // modal close
    if (t.closest("[data-close-modal]")) {
      if (!Store.needsOnboarding()) Modal.close();
      return;
    }
    if (t.closest("[data-close-search]")) { Search.close(); return; }

    // nav / goto
    const goto = t.closest("[data-goto]");
    if (goto) {
      const dest = goto.dataset.goto;
      if (goto.hasAttribute("data-new-project") || goto.hasAttribute("data-new-task") || goto.hasAttribute("data-new-snippet") || goto.hasAttribute("data-new-resource")) {
        location.hash = `#/${dest}`;
      } else location.hash = `#/${dest}`;
      return;
    }

    // entity openers
    const openProj = t.closest("[data-open-project]");
    if (openProj && !t.closest("button")) { projectDetailModal(openProj.dataset.openProject); return; }

    const editProj = t.closest("[data-edit-project]");
    if (editProj) { e.stopPropagation(); projectModal(Store.data.projects.find((p) => p.id === editProj.dataset.editProject)); return; }

    const delProj = t.closest("[data-del-project]");
    if (delProj) {
      e.stopPropagation();
      const p = Store.data.projects.find((x) => x.id === delProj.dataset.delProject);
      if (p) confirmModal({ title: `Delete "${p.name}"?`, message: "The project and its link to tasks will be removed. Tasks stay in your task list.", confirmLabel: "Delete", danger: true }).then((yes) => {
        if (!yes) return;
        Store.data.projects = Store.data.projects.filter((x) => x.id !== p.id);
        Store.data.tasks.forEach((tk) => { if (tk.project === p.id) tk.project = null; });
        Store.logActivity("project_created", `Deleted project "${p.name}"`);
        Store.commit(); Modal.close(); toast("Project deleted", "warn"); setView(currentView);
      });
      return;
    }

    if (t.closest("[data-new-project]")) { projectModal(null); return; }
    if (t.closest("[data-new-task]")) { const forP = t.closest("[data-add-task-for]"); taskModal(null, forP ? forP.dataset.addTaskFor : null); return; }
    if (t.closest("[data-new-snippet]")) { snippetModal(null); return; }
    if (t.closest("[data-new-resource]")) { resourceModal(null); return; }

    const editTask = t.closest("[data-edit-task]");
    if (editTask) { taskModal(Store.data.tasks.find((x) => x.id === editTask.dataset.editTask)); return; }
    const delTask = t.closest("[data-del-task]");
    if (delTask) {
      const id = delTask.dataset.delTask;
      Store.data.tasks = Store.data.tasks.filter((x) => x.id !== id);
      Store.commit(); toast("Task deleted", "warn"); setView(currentView);
      return;
    }
    const toggle = t.closest("[data-toggle-task]");
    if (toggle) { toggleTask(toggle.dataset.toggleTask); return; }

    const editSnip = t.closest("[data-edit-snippet]");
    if (editSnip) { snippetModal(Store.data.snippets.find((x) => x.id === editSnip.dataset.editSnippet)); return; }
    const delSnip = t.closest("[data-del-snippet]");
    if (delSnip) {
      const id = delSnip.dataset.delSnippet;
      Store.data.snippets = Store.data.snippets.filter((x) => x.id !== id);
      Store.commit(); toast("Snippet deleted", "warn"); setView(currentView);
      return;
    }
    const copyBtn = t.closest("[data-copy-snippet]");
    if (copyBtn) { copySnippet(copyBtn.dataset.copySnippet, copyBtn); return; }

    const editRes = t.closest("[data-edit-resource]");
    if (editRes) { resourceModal(Store.data.resources.find((x) => x.id === editRes.dataset.editResource)); return; }
    const delRes = t.closest("[data-del-resource]");
    if (delRes) {
      const id = delRes.dataset.delResource;
      Store.data.resources = Store.data.resources.filter((x) => x.id !== id);
      Store.commit(); toast("Resource deleted", "warn"); setView(currentView);
      return;
    }

    // search layer scrim
    if (t.id === "search-layer" || t.classList.contains("scrim") && t.parentElement.id === "search-layer") { Search.close(); return; }
  });

  // keyboard: open projects from cards
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches?.("[data-open-project][role='button']")) {
      projectDetailModal(e.target.dataset.openProject);
    }
    if (e.key === "Escape") {
      if (!$("#search-layer").hidden) Search.close();
      else if (!$("#modal-layer").hidden && !Store.needsOnboarding()) Modal.close();
      else closeSidebar();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if ($("#search-layer").hidden) Search.open(); else Search.close();
    }
    if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName || "") && $("#search-layer").hidden && $("#modal-layer").hidden) {
      e.preventDefault(); Search.open();
    }
  });

  // search input
  $("#search-input").addEventListener("input", (e) => renderSearch(e.target.value));

  // theme toggle
  $("#theme-toggle").addEventListener("click", () => {
    const next = Prefs.theme === "day" ? "night" : "day";
    Prefs.setTheme(next);
    toast(`${next === "day" ? "Daylight" : "Night"} mode`);
  });

  // search launch
  $("#search-launch").addEventListener("click", () => Search.open());
  $("#settings-shortcut").addEventListener("click", () => { location.hash = "#/settings"; closeSidebar(); });

  // mobile sidebar
  $("#nav-toggle").addEventListener("click", () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#sidebar-scrim").classList.toggle("show", open);
    $("#nav-toggle").setAttribute("aria-expanded", String(open));
  });
  $("#sidebar-scrim").addEventListener("click", closeSidebar);

  // import file
  $("#import-file").addEventListener("change", (e) => {
    handleImportFile(e.target.files[0]);
    e.target.value = "";
  });

  // filter interactions (delegated per view mount)
  document.addEventListener("input", (e) => {
    if (e.target.id === "task-search") {
      taskQuery = e.target.value;
      const listHTML = $("#view-root");
      const rows = filterTasks();
      const container = $(".task-list", listHTML);
      if (container) container.innerHTML = rows.map(taskRow).join("");
    }
    if (e.target.id === "snip-search") {
      snipQuery = e.target.value;
      refreshSnippetGrid();
    }
    if (e.target.id === "res-search") {
      resQuery = e.target.value;
      refreshResGrid();
    }
  });

  document.addEventListener("click", (e) => {
    const segT = e.target.closest("#task-seg [data-tf]");
    if (segT) {
      taskFilter = segT.dataset.tf;
      $$("#task-seg button").forEach((b) => b.classList.toggle("active", b === segT));
      const container = $(".task-list");
      if (container) container.innerHTML = filterTasks().map(taskRow).join("");
      return;
    }
    const segL = e.target.closest("#snip-seg [data-lang]");
    if (segL) {
      snipLang = segL.dataset.lang;
      $$("#snip-seg button").forEach((b) => b.classList.toggle("active", b === segL));
      refreshSnippetGrid();
      return;
    }
    const segR = e.target.closest("#res-seg [data-cat]");
    if (segR) {
      resCat = segR.dataset.cat;
      $$("#res-seg button").forEach((b) => b.classList.toggle("active", b === segR));
      refreshResGrid();
      return;
    }
  });
}

function refreshSnippetGrid() {
  const grid = $(".snip-grid");
  if (!grid) return;
  const list = Store.data.snippets.filter((s) => {
    const q = snipQuery.toLowerCase();
    const matchQ = !q || s.title.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.tags.some((t) => t.toLowerCase().includes(q));
    return matchQ && (snipLang === "all" || s.lang === snipLang);
  });
  grid.innerHTML = list.length ? list.map(snippetCard).join("")
    : `<div class="empty" style="grid-column:1/-1"><div class="empty-art">{ }</div><h3>No matches</h3><p>Adjust the search or pick another language.</p></div>`;
}

function refreshResGrid() {
  const grid = $(".res-grid");
  if (!grid) return;
  const list = Store.data.resources.filter((r) => {
    const q = resQuery.toLowerCase();
    const matchQ = !q || r.title.toLowerCase().includes(q) || r.url.toLowerCase().includes(q) || r.note.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q));
    return matchQ && (resCat === "all" || r.category === resCat);
  });
  grid.innerHTML = list.length ? list.map(resCard).join("")
    : `<div class="empty" style="grid-column:1/-1"><div class="empty-art">{ }</div><h3>No matches</h3><p>Nothing here with that filter.</p></div>`;
}

/* ------------------------------------------------------------
   21. Animations for bars/rings after render
   ------------------------------------------------------------ */
function animateMeters() {
  $$(".progress[data-w]").forEach((p) => {
    requestAnimationFrame(() => { p.querySelector("i").style.width = `${p.dataset.w}%`; });
  });
  $$("[data-ring]").forEach((ring) => {
    const pct = Number(ring.dataset.ring);
    const r = 51, c = 2 * Math.PI * r;
    ring.style.strokeDasharray = c;
    ring.style.strokeDashoffset = c;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      ring.style.strokeDashoffset = c * (1 - pct / 100);
    }));
  });
}

/* ------------------------------------------------------------
   22. Boot
   ------------------------------------------------------------ */
const VIEW_MOUNT = { dashboard: animateMeters, analytics: animateMeters, dsa: mountDSA, settings: mountSettings };

window.addEventListener("hashchange", route);

Store.onChange(() => { buildNav(); });

(function boot() {
  Store.load();
  applyTheme();
  wireGlobal();
  updateSideUser();
  route();
  animateMeters();
  if (Store.needsOnboarding()) openOnboarding();
  setTimeout(() => $("#boot-loader").classList.add("done"), 140);
})();
