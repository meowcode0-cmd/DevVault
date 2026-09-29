# DevVault — Developer Command Center

DevVault is a personal developer command center: one warm-ink workspace for your **projects, coding tasks, code snippets, learning resources, DSA practice and overall progress**. It runs entirely in the browser — no backend, no account, no build step — and persists everything in `localStorage`.

Open `index.html` and the vault is yours.

---

## Why DevVault

Most task trackers feel like spreadsheets. DevVault is built to feel like a place you *want* to open every morning:

- A **dashboard** that greets you, summarizes your momentum, and surfaces recent activity and active projects.
- A **DSA Lab** with an interactive sorting visualizer (5 algorithms, adjustable speed, step-by-step animation) — because understanding beats memorizing.
- **Analytics** drawn with pure SVG/CSS: weekly momentum bars, a project-pipeline donut, language breakdowns and a 12-week DSA heatmap.
- A **global search** (`Ctrl/⌘ + K`, or `/`) across projects, tasks, snippets and resources.

## Features

| Area | What you get |
|---|---|
| **Dashboard** | Greeting, project/task/learning statistics, recent activity feed, active project list, quick actions, "vault fuel" progress meter |
| **Projects** | Full CRUD, tech stack chips, status (exploring / building / shipped / paused), progress %, priority, deadline with overdue detection, detail modal with linked tasks |
| **Tasks** | Full CRUD, priority, status, due dates, project linking, one-click complete, search + status filters |
| **Snippets** | Save code with language + tags, numbered syntax-highlighted presentation, search, copy-to-clipboard |
| **Resources** | Bookmark sites/docs/tutorials with category, tags and a personal note; open in a new tab; search + category filters |
| **DSA Lab** | Bubble, Selection, Insertion, Merge and Quick sort visualizers. Generate random arrays, play/pause/reset, speed & size sliders, live complexity table, practice logging |
| **Analytics** | Weekly momentum chart, project status donut, snippet language bars, 12-week DSA heatmap — all vanilla SVG/CSS, zero chart libraries |
| **Global search** | Categorized, highlighted results across every entity, keyboard-driven |
| **Settings** | Theme (warm-ink night / paper-warm day), display name, JSON export/import, demo reset, full wipe |

## Technologies

- **HTML5** — semantic, single entry point, inline SVG icon sprite (no icon library)
- **CSS3** — design tokens, grid/flex layouts, custom properties for theming, micro-interactions; no framework
- **Vanilla JavaScript (ES2020+)** — hash-based router, store module, step-generator driven visualizer; no React, no jQuery, no build tools
- **Google Fonts** — Space Grotesk, Newsreader, JetBrains Mono (system fallbacks included)
- **localStorage** — the only persistence layer

## How localStorage works

DevVault stores two keys in your browser:

| Key | Contents |
|---|---|
| `devvault:data:v1` | The full vault — profile, projects, tasks, snippets, resources, DSA log, activity feed (versioned schema) |
| `devvault:prefs:v1` | UI preference mirror (theme) |

- **First launch** seeds attractive demo data so the dashboard never looks empty; you can reset or wipe it from Settings.
- **Every mutation** is validated, normalized and saved immediately. All reads/writes are wrapped in `try/catch`, so private-browsing modes degrade gracefully instead of crashing.
- **Imports** are strictly validated (types, lengths, enums, URL shapes, date formats) before replacing anything — a bad file can never corrupt the vault.
- Your data never leaves the browser. Clearing site data in your browser is equivalent to wiping the vault, which is why **Export JSON** exists.

## Run locally

```bash
git clone https://github.com/<you>/devvault.git
cd devvault
# open index.html directly, or serve the folder:
python3 -m http.server 8000
# → http://localhost:8000
```

No install, no build, no dependencies.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. **Settings → Pages → Source**: choose your branch (`main`) and the `/ (root)` folder.
3. Save. Your vault is live at `https://<username>.github.io/<repo>/`.

All paths are relative and routing is hash-based (`#/projects`), so it works from any subpath — no server config needed.

## Project structure

```
DevVault/
├── index.html          # app shell, SVG icon sprite, view containers
├── style.css           # design tokens, layout, components, themes, responsive rules
├── script.js           # store, router, views, DSA engine, search, import/export
├── assets/
│   └── icons/          # reserved for supplementary static icons (core icons are inlined)
└── README.md
```

## Future improvements

- Spaced-repetition flashcards for DSA patterns
- Per-project notes with markdown support
- Streak tracking with milestone badges
- Optional end-to-end encryption for exported backups
- Drag-to-reorder tasks and multi-select bulk actions
- A "weekly digest" view generated from the activity feed

---

Built to be read as well as used — the whole codebase is two files of hand-rolled HTML/CSS/JS.
