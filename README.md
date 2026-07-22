# Kavach — Frontend

**AI Shield Against Digital Fraud.** React + Vite web app for the Kavach scam-detection platform. Detects scam calls & messages in 8+ Indian languages, warns victims, alerts families, and gives cyber cells a live intelligence dashboard.

## Stack

- **React 18** + **Vite 5**
- **Tailwind CSS 3** — dark "command centre" theme
- **Framer Motion** — page transitions, card animations, count-ups
- **react-force-graph-2d** — fraud network graph
- **Recharts** — threat activity chart
- **lucide-react** — icons
- **react-router-dom** — client-side routing
- **axios** — API client (swappable mock ↔ real backend)

## Setup

```bash
# 1. Install
npm install

# 2. Run dev server
npm run dev
# → http://localhost:5173
```

That's it. The app runs entirely on **mock data** out of the box — no backend needed.

## Structure

```
src/
├── main.jsx              # React entry
├── App.jsx               # Router shell + layout
├── index.css             # Tailwind + base styles
├── lib/
│   ├── api.js            # API client (mock ↔ real toggle)
│   └── utils.js          # cn(), formatNumber(), timeAgo()
├── components/
│   ├── Sidebar.jsx       # Persistent nav
│   ├── StatCard.jsx      # Animated count-up cards
│   ├── AlertsFeed.jsx    # Live scam alerts stream
│   ├── FraudGraph.jsx    # Force-directed network graph
│   ├── ThreatChart.jsx   # 24h activity area chart
│   └── ui/               # Button, Card, Badge primitives
└── pages/
    ├── Landing.jsx       # Hero / overview
    ├── Detector.jsx      # Live scam classifier demo
    ├── Dashboard.jsx     # Cyber Cell command console
    ├── CitizenApp.jsx    # Phone-frame consumer preview
    └── HowItWorks.jsx    # Flow + privacy explainer
```

## Screens

| Route | Screen | Highlights |
|-------|--------|-----------|
| `/` | Landing | Hero, animated stat highlights, capability cards |
| `/detector` | Live Scam Detector | Text input → animated SCAM/SAFE verdict, language badge, example chips |
| `/dashboard` | Cyber Cell Console | Stat cards, live alerts feed, fraud network graph, 24h chart, hotspots |
| `/citizen` | Citizen App | Phone-frame mockup — call warning, WhatsApp bot, family alert, privacy toggle |
| `/how-it-works` | How & Privacy | 5-step flow diagram, privacy-by-design cards |

## Switching to the real backend

The frontend uses **mock data by default**. To point at the real FastAPI backend:

Create `.env`:

```
VITE_USE_MOCK=false
VITE_API_BASE=http://localhost:8000
```

That's the only change. All API calls go through `src/lib/api.js` which respects these two vars.

### API contract expected

```
POST /check
  body:    { "text": "…" }
  returns: { "verdict": "scam"|"safe", "confidence": 0..1, "language": "en"|"hi"|… }

GET /alerts
  returns: [{ "id", "type", "number", "location", "language", "time", "status" }]

GET /stats
  returns: { "active_threats", "blocked_today", "victims_protected", "rings_tracked" }

GET /fraud-graph
  returns: { "nodes": [{ "id", "label", "type" }], "links": [{ "source", "target" }] }
```

## Design tokens

Defined in `tailwind.config.js`. Change them there — every component picks up the update.

- **Backgrounds:** `bg` `#0A0E1A`, `bg-deep` `#070A13`, `bg-navy` `#0F1629`
- **Surfaces:** `surface` `#141B2D`, `surface-raised` `#1A2338`
- **Border:** `border` `#1E293B`, `border-bright` `#2A3654`
- **Accents:** `accent-blue` `#3B82F6`, `accent-cyan` `#22D3EE`
- **States:** `threat` `#EF4444`, `safe` `#22C55E`, `warn` `#F59E0B`
- **Text:** `ink` `#F8FAFC`, `ink-muted` `#94A3B8`, `ink-dim` `#64748B`

Font: **Inter** (via Google Fonts), monospace: **JetBrains Mono** for numbers and IDs.

## Build

```bash
npm run build      # → dist/
npm run preview    # serve the build locally
```

## Notes

- Fully responsive — sidebar collapses to a top bar under `lg` (1024px).
- `prefers-reduced-motion` respected app-wide.
- Focus rings visible on keyboard navigation.
- Mock alerts stream advances every 4 seconds — dashboard feels genuinely live during demos.
