# Prism by Gusto

**Workforce Management Platform — v1.0.0**

A full-featured WFM platform built for Gusto's CX org. Covers the full workforce lifecycle — forecasting (ClearCast engine), scheduling (Gantt editor), intraday ops, agent experience, and team management — with a live AI assistant (Pri), real-time metrics, three UI themes, and a gamification layer.

---

## Quick Start

```bash
npm install
npm run dev       # localhost:5173
npm run build     # production build → dist/
npm run preview   # preview production build locally
```

**To enable Pri AI (optional):**
Copy `.env.local` and replace `your_key_here` with an Anthropic API key:
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```
Pri falls back to deterministic local responses if the key is absent.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | React 19 + Vite 8 |
| Charts | Recharts 3 |
| Forecasting | ClearCast engine (internal) |
| State | React `useState` / `useEffect` / `useRef` |
| Styling | Inline styles + CSS keyframes (no CSS-in-JS lib) |
| Audio | Web Audio API (programmatic, no audio files) |
| AI | Pri — Claude Haiku via Anthropic API; falls back to `queryPrism()` |
| Build | Rolldown via Vite |

---

## Project Structure

```
src/
  PrismPlatform.jsx          ← entire app (~6,300 lines, single-file)
  clearcast/
    forecastData.js           ← 86 ClearCast forecast objects (CC_GROUPS)
    forecastService.js        ← Erlang C staffing computation
    ForecastContext.jsx       ← React context wrapper
    modelService.js           ← forecast model runner
  hooks/
    useSchedule.js            ← schedule state management hook
  components/
    Schedule/
      ScheduleContainer.jsx   ← schedule editor shell
      DraggableGantt.jsx      ← drag/resize/context-menu Gantt engine
      QuickAddModal.jsx       ← click-to-add segment modal
      WeekView.jsx            ← week-view schedule grid
      AgentProfilePanel.jsx   ← agent detail panel
    WorkPatternBuilder.jsx    ← WFM-only work pattern builder
    SkillingManager.jsx       ← team skills matrix
.env.local                    ← VITE_ANTHROPIC_API_KEY (gitignored)
```

---

## Roles & Demo Logins

| Role | Login | Access |
|---|---|---|
| `agent` | Jordan Taylor | Daily schedule, swaps, time off, profile |
| `manager` | Marcus Webb | Team health, queue alerts, approvals, schedule |
| `wfm` | Ammad Williams | Full platform — forecasting through ops, work patterns, roster admin |

Work patterns are WFM-only. Managers can approve time off and schedule adjustments but cannot edit shift templates.

---

## Feature Map

### Agent Layer
- **My Day dashboard** — live current-segment card, next-segment countdown, quick-action row
- **Quick actions** — Swap shift, Request adjustment, Request time off, Ask Pri (all wired)
- **Schedule view** — color-coded Gantt bar with live NOW indicator
- **Schedule adjustment modal** — type selector (swap / VTO / OT / adjust / WFH) + note to WFM
- **Shift Swap Marketplace** — browse open swaps, claim, post your own
- **VTO Widget** — one-tap accept/decline from dashboard
- **Time Off view** — PTO / Sick / Personal balances, request form, request history
- **My Profile** — work pattern (view only), skills with proficiency editor, team info, transfer request

### Manager Layer
- **Right Now live strip** — SL%, adherence, queue depth, ASA — refreshes every 5s with live-pulse glow
- **Prism Score** — team health ring with breakdown bars (SL, adherence, coverage, approval speed)
- **Live queue alerts** — critical/warning queue cards with direct nav
- **Pillar coverage bars** — per-pillar staffing at a glance
- **Intraday Ops Center** — 12-agent live grid with real Payroll & Taxes agents, 5-metric strip, SL projection sparkline, OT/VTO controls — ticks every 5s
- **Coverage Heatmap** — hour × pillar grid, color-coded staffing levels
- **Coverage Calendar** — month view with drill-down
- **Schedule Publish Workflow** — Draft → Review (diff view) → Published

### WFM Layer
- **Platform health dashboard** — Prism Score 87, live ops snapshot (5s tick), pillar overview, SmartSync migration tracker
- **ClearCast forecast view** — 86 CT objects, F vs A, pillar breakdowns
- **Forecast vs Actuals view** — By Pillar tab (click-to-drilldown daily Mon–Sun) + Weekly Trend tab (5-week BarChart + accuracy% LineChart with 95% ReferenceLine)
- **Forecast Intelligence** — 5-week trend chart, miss-pattern detection, Pri recommendations
- **Work Pattern Builder** — assign patterns to agents (WFM-only)
- **Skilling Manager** — full team skills matrix, gap detection
- **Approvals** — PTO / swap / VTO / sick with auto-approval rules and rule warnings
- **Roster + Admin Panel** — 732 agents, profile panel, skills editor, manager reassignment, two-step terminate flow
- **Live Connections** — 12 MCP connector stubs (Workday, IEX, Slack, BigQuery, Level AI, etc.)

### AI & Intelligence
- **Pri Drawer** — right-side AI assistant, 380px, opens from topbar ✦ button; waveform animation while thinking; powered by Claude Haiku via direct Anthropic API call with full WFM knowledge base baked into system prompt; falls back to deterministic `queryPrism()` if no API key
- **AI Command Palette** (⌘K) — natural-language query detection with structured responses; Work Patterns entry gated to WFM role only
- **`queryPrism(q, role)`** — deterministic NLP fallback covering SL, adherence, forecast accuracy, PTO, coverage, top performers, approvals, OT, queue depth, pillar breakdowns, Prism Score

### Notifications & UX
- **Toast notifications** — pill-shaped floating confirmations for every action (swap claim, PTO submit, approval, feedback, etc.)
- **Notification Center** — all / alerts / schedule / broadcasts tabs, mark-read, pulsing bell
- **Broadcast compose** — WFM/Manager only; audience selector
- **Feedback modal** — floating 💬 button, type selector (idea / bug / praise)

### Gamification
- **Achievements view** — badge grid with zoom-in detail modal, Bronze/Silver/Gold Gustie tiers
- **Particle burst** — `ParticleBurst` component fires on badge click (14 particles) and in modal (22 particles); div-based, no canvas
- **Prism Score** — SVG arc ring used on all three dashboards
- **CountUp** — ease-out animated number counter on all stat cards
- **XP tracking** — per-agent XP on agent dashboard and leaderboard

### Themes
Three built-in themes, toggled via 🌙/☀️/🎉 in the topbar, persisted to `localStorage`:
- **Dark** — default deep navy palette
- **Light** — white/slate card surfaces, dark text
- **Festive** — deep purple-black base, hot pink / gold / bright teal accents

### Sound & Polish
- **Web Audio API** — chime, badge unlock, approve tones; gated behind 🔊 toggle
- **Button tactility** — global `button:active { scale(.962) }` for physical press feel
- **Stagger entrance animations** — dashboard stat grids and badge grid cascade in at 60ms intervals
- **Card micro-gradients** — `card`, `surf`, `elev` are diagonal `linear-gradient` strings
- **Snappy view transitions** — `cubic-bezier(.4,0,.2,1)` scale+translateY on every view change
- **Custom scrollbars** — 4px, brand-colored, hover brightens
- **Gustification language** — Gustie, Gustified, Gustie Guide Training throughout

---

## Color Palette

```js
// Three themes — toggled at runtime, stored in localStorage
THEMES.dark   // default: deep navy
THEMES.light  // white/slate surfaces
THEMES.festive // deep purple, vibrant accents

// Active palette (C object — reassigned on theme change):
C.guava   // "#F45D48"  — alerts, critical
C.kale    // "#0A8080"  — primary actions, ClearCast
C.amber   // "#EF9F27"  — warnings, WFM
C.purple  // "#7F77DD"  — time off, personal
C.bg      // page background
C.surf    // linear-gradient — sidebar/secondary bg
C.card    // linear-gradient — card background
C.elev    // linear-gradient — elevated surfaces
C.bd      // border color (rgba)
C.tx0 / C.tx1 / C.tx2  // primary / secondary / tertiary text
```

`card`, `surf`, and `elev` are gradient strings — use as CSS `background`, never as `color` or `border-color`.

---

## Activity Codes

Real WFM activity codes from Gusto's aux coding reference, organized by semantic color family:

- **Phone family** (teals) — Phone, Phone AHOD, Phone Shadowing, Nesting Phone, Overtime Phone
- **Email family** (blues) — Email, Cancellations, COBRA/Continuation, EE Termination, NHE, QLE
- **Chat family** (cyan-greens) — Chat, Chat/Email, Core Work, FEIN
- **Break/Admin family** (ambers) — Break, Lunch, Meeting, 1:1 Meeting, Team Meeting
- **Training family** (oranges) — Gustie Guide Training, Training, Approved Project
- **Exception family** (grays/reds) — Tech Issues, Unavailable, LOA, Planned Time Off, Sick, NCNS

---

## Data Model (demo)

All data is static/deterministic — no backend required.

```
ALL_AGENTS       ~140 agents across 6 pillars, each with full shift segments
FULL_ROSTER      pillar → agent list mapping with skills data
CC_GROUPS        86 ClearCast forecast objects (from clearcast/forecastData.js)
INIT_NOTIFS      6 pre-seeded notifications
APPROVAL_DATA    5 approval items (dates computed relative to today)
SWAP_POSTS       shift swap marketplace listings
OPS_AGENTS       12 real Payroll & Taxes agents for intraday ops demo
WEEKLY_FVA       5-week forecast vs actuals data
DAILY_FVA_BY_PILLAR  Mon–Sun F vs A breakdown keyed by pillar
```

---

## Dynamic Dates

All dates derive from `new Date()` — nothing is hardcoded.

```js
NOW_H             // current hour as decimal (e.g. 14.5 = 2:30 PM)
TODAY_LABEL       // "Tue May 20" — updates daily
fmtRelDate(n)     // date N days from today, formatted "May 22"
SCHEDULE_ANCHOR_DATE = new Date()  // schedule editor always opens on today
```

---

## CSS Keyframes

All animations injected via `<style>` tag in JSX. Key animations:

| Keyframe | Used for |
|---|---|
| `view-in` | Page transition (scale + translateY, cubic-bezier) |
| `fade-up` | Card entrance |
| `card-rise` | Modal/card pop-in |
| `badge-zoom` | Badge detail modal open |
| `count-rise` | CountUp number entrance |
| `val-pop` | Live metric value change (5s tick) |
| `live-pulse` | Border glow on live data cards |
| `particle-fly` / `particle-fly-sm` | Badge unlock particle burst |
| `pri-wave` | Pri waveform bars |
| `pri-slide` | Pri drawer open |
| `toast-in` | Toast notification entrance |
| `lp` | Pulse dot on live indicators |
| `shimmer` | Loading shimmer |

---

## Build Stats

```
dist/assets/index.js   ~1,033 kB (~285 kB gzip)
Build time             ~200ms
External APIs          1 (Anthropic, optional — falls back gracefully)
Audio files            0
CSS files              0 (all inline styles + keyframes in JSX)
```

---

## Security Notes

- No PII, no customer data, no financial data
- All roster data is synthetic (simulated agent names)
- `VITE_ANTHROPIC_API_KEY` stored in `.env.local` only — never committed to source control
- Pri AI sends only the user's typed message to Anthropic — no Gusto data included in API calls
- No backend, no database, no write surface
- Intended to run behind Cloudflare Access (Gusto SSO) when deployed

---

## Deployment (In Progress)

Target: Gusto Switchboard via `byo-code` template, Tier 3 (Experimental).
Security review in progress via `#security-help`.
See the Tactical Model Path doc for the full submission.

---

*Built by Ammad Williams — Gusto WFM · May 2026*

---

<!--
  ✦ ✦ ✦  F O U N D E R ' S  M A R K  ✦ ✦ ✦

      ██████╗ ██████╗ ██╗███████╗███╗   ███╗
      ██╔══██╗██╔══██╗██║██╔════╝████╗ ████║
      ██████╔╝██████╔╝██║███████╗██╔████╔██║
      ██╔═══╝ ██╔══██╗██║╚════██║██║╚██╔╝██║
      ██║     ██║  ██║██║███████║██║ ╚═╝ ██║
      ╚═╝     ╚═╝  ╚═╝╚═╝╚══════╝╚═╝     ╚═╝

  Ammad Williams — WFM Analyst, Platform Builder, Gusto CX
  Chicago · May 2026 · v1.0.0

  "The tools we had weren't good enough. So I built something that was."

  This platform was designed, architected, and built from scratch
  in a single React file. No team. No template. No playbook.
  Just a problem worth solving and the will to ship.

  If you're reading this in the source, you found the easy one.
  The real one lives inside the app.
  (hint: the logo knows who built it)

  QW1tYWQgV2lsbGlhbXMgYnVpbHQgdGhpcy4gRnVsbCBzdG9wLg==
-->

