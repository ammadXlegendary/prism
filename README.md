# Prism by Gusto

**Workforce Management Platform — v1.1.0**

Built from scratch for Gusto's CX org. No off-the-shelf template. No outside team. One file, one vision — a platform that covers the full WFM lifecycle and actually respects the people using it at every level.

Forecasting (ClearCast engine) → Scheduling (Gantt editor) → Intraday Ops → Agent Experience → Team Intelligence. All of it wired together, all of it live.

---

## Quick Start

```bash
npm install
npm run dev       # localhost:5173
npm run build     # production build → dist/
npm run preview   # preview production build locally
```

**To enable Pri AI (optional):**
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```
Pri falls back to deterministic local responses if no key is present. Everything else works offline.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | React 19 + Vite 8 |
| Charts | Recharts 3 |
| Forecasting | ClearCast engine (internal, 86 CT objects) |
| State | React `useState` / `useEffect` / `useRef` |
| Styling | Inline styles + CSS keyframes injected via JSX `<style>` tag |
| Audio | Web Audio API — programmatic, zero audio files |
| AI | Pri — Claude Haiku 4.5 via direct Anthropic API; falls back to `queryPrism()` |
| Build | Rolldown via Vite |

---

## Project Structure

```
src/
  PrismPlatform.jsx          ← entire app (~4,700 lines, single-file)
  clearcast/
    forecastData.js           ← 86 ClearCast forecast objects (CC_GROUPS)
    forecastService.js        ← Erlang-C staffing computation
    ForecastContext.jsx       ← React context wrapper
    modelService.js           ← forecast model runner (Amadeus/Suplex/LaFlare/Lola/A7X)
  hooks/
    useSchedule.js            ← schedule state management hook
  components/
    Schedule/
      ScheduleContainer.jsx
      DraggableGantt.jsx      ← drag/resize/context-menu Gantt engine
      QuickAddModal.jsx
      WeekView.jsx
      AgentProfilePanel.jsx
    WorkPatternBuilder.jsx
    SkillingManager.jsx
.env.local                    ← VITE_ANTHROPIC_API_KEY (gitignored)
```

---

## Roles & Demo Logins

| Role | Login | Access |
|---|---|---|
| `agent` | Jordan Taylor | My Day, schedule, swaps, time off, profile, achievements |
| `manager` | Marcus Webb | Team health, queue alerts, intraday ops, approvals, schedule |
| `wfm` | Ammad Williams | Full platform — forecasting through ops, patterns, roster admin, roles |
| `wfm` | Tammie Zapata | Intraday Analyst, L4 |
| `wfm` | Dwight Simpson | Workforce Lead, L6 |
| `wfm` | David Percival | WFM Analyst, L4 |
| `wfm` | Bunny Bates | Data Science, L4 |

Login groups: **Gustie** (agents) · **Manager** · **Workforce Intelligence** (WFM)

---

## Feature Map

---

### Gustie Layer — Agent Experience

This is the part of the platform agents actually live in. Every element was designed to answer a real question agents have but usually can't get answered until after the fact: *Am I doing okay right now? Does my work matter? Am I getting anywhere?*

#### My Day Dashboard

- **Daily insight hero card** — The first thing you see when you log in. Dynamic, coaching-voice callout based on your actual stats that day: momentum check, streak celebration, Gold Gustie countdown, day-of-week energy. 7 conditions. Full-width gradient. Not a widget — a signal.
- **Live self-awareness strip** — AHT, Adherence%, time in current state, contacts today. Ticks every 5 seconds. You know exactly where you stand without asking anyone.
- **Smart schedule nudge** — When you're 12 minutes or less from a segment transition, your current segment card tells you. No surprises.
- **Current segment card** — What you're in, how long you've been in it, what's next and when.
- **Quick actions** — Swap shift · Request adjustment · Time off · Ask Pri. One tap each.

#### Floor Impact Card

Sits right below the live strip. Shows the floor SL ticking in real time. Shows how many agents are holding 95%+ adherence right now. Shows what happens if two of you drop — floor SL falls to ~82%.

This is the one nobody builds. Agents always know their own adherence number. They almost never see what that number actually *does* to the people sitting next to them. Now they do.

#### In-Call Quick Reference

Collapsible accordion below the schedule. Three sections: Escalation Guide, Quick Scripts, Key Policies. Each expands to a two-column reference table. Stays out of the way until you need it. When you need it, it's right there.

#### Goal Tracking — Your Gustie Journey

Bronze → Silver → Gold → Platinum. Progress bar, projected Gold date, XP pace indicator ("At ~420 XP/mo, Gold in X months"). You know where you are, you know where you're going, you know how fast you're moving.

#### Peer Kudos

Send kudos to teammates with one of four emoji chips (🎯💜⚡🤝) and a freeform message. See the kudos you've received. Real names, real moments. Not a survey — an actual human thing.

#### Team Presence

Who's on the floor right now. Avatar grid with SUP and CAP callouts. Green/amber status dots. Active/break/off count at a glance.

#### Performance Stats

Three periods (Today / This Week / This Month). Each one shows Adherence%, AHT, Contacts, and a trend line vs. the prior period: "↑ Adh +2pp · AHT −8s." Context, not just a number.

#### Pri — Your Personal Coach

Pri knows who you are before you say a word. When you open the Pri drawer as an agent, she already has your adherence, your streak, your XP, your tier, your Gold Gustie timeline, your contacts today, and your floor SL loaded. The greeting reflects all of it. Every response is coached to your specific situation, not generic WFM advice.

---

### Manager Layer

- **Right Now live strip** — SL%, adherence, queue depth, ASA. Ticks every 5s with live-pulse border glow and value pop animation.
- **Prism Score ring** — Team health score (82) with breakdown bars: SL, adherence, coverage, approval speed.
- **Live queue alert cards** — Critical/warning cards with direct nav to ops.
- **Pillar coverage bars** — Per-pillar staffing at a glance.
- **Intraday Ops Center** — 12-agent live grid, 5-metric strip, SL projection sparkline, OT/VTO controls. Ticks every 5s with organic variance.
- **Supervisor alert system** — Per-alert Ack buttons. OT/VTO modal: type selector, scope (all/pillar), max hours, send + response tracking.
- **Historical comparison** — KPI cards with delta vs. prior period.
- **Interval F vs A chart** — 30-min interval bar chart in live ops.
- **Coverage Heatmap** — Hour × pillar grid, color-coded staffing.
- **Coverage Calendar** — Month view with drill-down.
- **Schedule Publish Workflow** — Draft → Review (diff view) → Published.

---

### Workforce Intelligence Layer

- **Platform health dashboard** — Prism Score 87, live ops snapshot (5s tick), pillar overview, SmartSync migration tracker.
- **ClearCast forecast view** — 86 CT objects, F vs A, pillar breakdowns.
- **Forecast vs Actuals** (`view "fvsa"`) — By Pillar (click-to-drilldown daily) + Weekly Trend (5-week BarChart + accuracy% LineChart with 95% ReferenceLine).
- **ClearCast Model Lab** — LaFlare, Lola, A7X, Amadeus + Suplex Mode. Lock In applies overlay to the live forecast.
- **CCTheRead** — 5-section inline forecast narrative.
- **CCParlay** — 3-pick prediction widget.
- **Real Time Management** (`view "ops"`) — 4 tabs: Live, Queues, Agents, Skills.
- **Reports view** — CSV export.
- **Capacity Planning** — Headcount preview, Q3/Q4 2026 roadmap grid.
- **Roles & Perms view** — Structure, Permissions, Members tabs. WFM-only.
- **Work Pattern Builder** — Assign patterns to agents.
- **Skilling Manager** — Full team skills matrix, gap detection.
- **Approvals** — PTO/swap/VTO/sick with auto-approval rules and rule warnings.
- **Roster + Admin Panel** — 732 agents, profile panel, skills editor, manager reassignment, two-step terminate flow.
- **Live Connections** — 12 MCP connector stubs (Workday, IEX, Slack, BigQuery, Level AI, etc.).

---

### AI & Intelligence

- **Pri Drawer** — Right-side 380px drawer, opens from ✦ topbar button. Waveform animation while thinking. Powered by Claude Haiku 4.5 with full WFM knowledge + agent context injection baked into system prompt. Falls back to `queryPrism()` if no API key.
- **AI Command Palette** (⌘K) — Natural-language query detection with structured responses.
- **`queryPrism(q, role)`** — Deterministic NLP fallback covering SL, adherence, forecast accuracy, PTO, coverage, top performers, approvals, OT, queue depth, pillar breakdowns, Prism Score.

---

### Gamification & Achievement System

#### XP Tiers

| Tier | XP Required |
|---|---|
| Rookie | 0 |
| Bronze Gustie | 1,000 |
| Silver Gustie | 2,500 |
| Gold Gustie | 5,000 |
| Platinum | 10,000 |

XP accumulates through badge tiers. Each badge tier multiplies its base XP: Bronze = 1×, Silver = 2×, Gold = 3×. Monthly pace is ~420 XP for an active agent.

#### Badge Set

**Gustie Badges (Agent)**

| Badge | What It Takes | Why It Matters |
|---|---|---|
| Daily Devotion | 7 / 14 / 30-day adherence streak | Streaks build habits. Habits build performance. The floor feels it when you're locked in. |
| Clockwork | 5 / 10 / 20 perfect adherence days | Precision over time is what gets you to Gold. Every perfect day banks trust. |
| Volume Operator | 200 / 500 / 1,000 contacts handled | The floor runs on volume. This is what it looks like to carry your weight. |
| Closer | 60% / 75% / 85% FCR rate | Every contact you resolve the first time is one fewer callback — and one fewer Gustie stuck in a queue. |
| Triple Threat | 3 / 5 / 8 cross-skill contacts | Versatility keeps coverage healthy when anyone calls out. You're the insurance policy. |
| The Grind | 10 / 25 / 50 OT hours accepted | Showing up when it's hard is exactly what keeps SL from falling apart. |
| Early Adopter | Feature usage milestones | You're helping build the tool by actually using it. That matters more than it sounds. |
| Floor Anchor | Team SL support contributions | Some agents make everyone around them better just by being consistent. This is that badge. |

**Manager Badges (6):** Fast Approver · SL Guardian · Team Builder · Zero Escalations · Coaching Champion · Coverage Architect

**Workforce Intelligence Badges (6):** The Oracle · SL Slayer · Schedule Publisher · Automator · Data Analyst · System Architect

#### Loot Box Reveal Modal

When you unlock a badge, the app doesn't just show a popup. It makes a moment out of it.

1. **Sealed** — Dark screen. Giant 🎁 shaking. "ACHIEVEMENT UNLOCKED." You can't skip it.
2. **Burst** — Fanfare fires (bass boom + rising arpeggio). Particle explosion in your badge's color. Badge icon drops in.
3. **Settled** — Full detail. Badge name, rarity, **WHY IT MATTERS** coaching copy, tier progression, total XP earned.

Locked badges skip the reveal and show you exactly what it takes to get there.

---

### Themes

Three themes cycle via 🌙/☀️/🎉 in the topbar (persisted to `localStorage`):
- **Dark** — Near-black deep navy. Default.
- **Light** — White/slate, high-contrast.
- **Festive** — 11 holiday skins auto-detected by date range: Memorial Day, Juneteenth, 4th of July, Labor Day, Halloween, Thanksgiving, Christmas, New Year's Eve, New Year's, Valentine's Day, St. Patrick's Day.

---

### Sound & Polish

- **Web Audio API** — Programmatic tones: chime, badge unlock, approve, fanfare (bass boom + rising arpeggio). Zero audio files. Gated behind 🔊 toggle.
- **Particle burst** — `ParticleBurst` component: 22 particles (modal), 14 (badge card click). Div-based, no canvas.
- **Live ticking** — Every live data strip runs a `setInterval` at 5s with `val-pop` animation on value changes.
- **View transitions** — `cubic-bezier(.4,0,.2,1)` scale+translateY on every view change.
- **Stagger entrance** — Dashboard stat grids and badge grids cascade in at 60ms intervals.
- **Custom scrollbars** — 4px, brand-colored, hover brightens.
- **Button tactility** — Global `button:active { scale(.962) }` for physical press feel.
- **Tooltip layer** — `Tip` component on all topbar buttons.

---

## Roles & Permissions Framework

```js
ROLES_CONFIG    // 3 roles × sub-roles × levels × feature permissions
hasPermission(user, feature)  // role + subRole + level gate check
```

**Sub-roles:** `wfm` (analyst · intraday · lead · forecast) · `manager` (supervisor · senior_mgr · director) · `agent` (agent · senior · captain)

**Levels:** L1–L8. Level gates premium features (advanced forecast, bulk actions, admin).

`RolesAdminView` (WFM only, `view "roles"`) — Structure, Permissions, Members tabs.

---

## Color Palette

```js
// Three themes toggled at runtime, persisted to localStorage
THEMES.dark    // default: deep navy
THEMES.light   // white/slate surfaces
THEMES.festive // deep purple base, holiday color overrides

// Active palette (C object — reassigned on every theme change):
C.guava   // "#F45D48"  — alerts, critical
C.kale    // "#0A8080"  — primary actions, ClearCast
C.amber   // "#EF9F27"  — warnings, WFM amber
C.purple  // "#7F77DD"  — time off, personal
C.bg      // page background
C.surf    // linear-gradient — sidebar/secondary bg
C.card    // linear-gradient — card background
C.elev    // linear-gradient — elevated surfaces (modals)
C.bd      // rgba border color
C.tx0 / C.tx1 / C.tx2  // primary / secondary / tertiary text
```

`card`, `surf`, and `elev` are gradient strings — use as CSS `background` only. Never `color` or `border-color`. Never store `C.xxx` values inside `useState()` initializers.

---

## Dynamic Dates

Nothing is hardcoded. All dates derive from `new Date()` at runtime.

```js
NOW_H                    // current hour as decimal (14.5 = 2:30 PM)
TODAY_LABEL              // "Tue May 20" — updates daily
fmtRelDate(n)            // date N days from today
SCHEDULE_ANCHOR_DATE     // always new Date() — schedule opens on today
```

---

## CSS Keyframes Reference

| Keyframe | Used for |
|---|---|
| `view-in` | Page transition (scale + translateY) |
| `fade-up` | Card entrance |
| `card-rise` | Modal/card pop-in |
| `badge-zoom` | Badge modal open, burst phase icon drop |
| `crate-shake` | Loot box sealed phase — 🎁 shake before reveal |
| `val-pop` | Live metric value change on 5s tick |
| `live-pulse` | Border glow on live data cards |
| `particle-fly` / `particle-fly-sm` | Badge unlock particle burst (22/14 particles) |
| `pri-wave` | Pri waveform bars |
| `pri-slide` | Pri drawer open animation |
| `shimmer` | Loading shimmer, insight card sweep |
| `lp` | Pulse dot on live indicators |
| `count-rise` | CountUp number entrance |
| `spin` | Loading spinner |

---

## Data Model (demo — no backend required)

```
ALL_AGENTS           ~140 agents across 6 pillars, full shift segments
FULL_ROSTER          pillar → agent list with skills
CC_GROUPS            86 ClearCast forecast objects
INIT_NOTIFS          6 pre-seeded notifications
APPROVAL_DATA        5 approval items (dates relative to today)
OPS_AGENTS           12 Payroll & Taxes agents for intraday ops demo
WEEKLY_FVA           5-week forecast vs actuals
DAILY_FVA_BY_PILLAR  Mon–Sun F vs A breakdown keyed by pillar
ALL_BADGES           20 badges across 3 roles, each with why coaching copy
BADGE_PROGRESS       per-user badge tier state (keyed by user ID)
```

---

## ClearCast — Amadeus + Suplex Mode

Judgment-driven forecasting built by Ammad Williams. Named methodologies, documented logic.

- **Amadeus mode** (~65%): coherent trailing WoW averages → apply growth rate to prior-year anchor
- **Suplex mode** (~35%): incoherent spread >10pp → use most-recent WoW as strongest signal
- **Cornerwork mode**: runs alongside LaFlare/Lola/A7X as a shadow — logs disagreement %
- **Confidence bands**: weekly total ± ~6.8% sigma

Backend API: `GET /api/models`, `POST /api/models/amadeus/run`, `POST /api/the_read/{ct_id}`
Offline fallback: `_simulateAmadeus()` in `modelService.js` — deterministic math seeded on CT ID.

---

## Build Stats

```
dist/assets/index.js   ~1,135 kB (~309 kB gzip)
Build time             ~220ms
External APIs          1 (Anthropic, optional — graceful fallback)
Audio files            0
CSS files              0 (all inline + keyframes in JSX)
```

---

## Security Notes

- No PII, no customer data, no financial data
- All roster data is synthetic (simulated agent names)
- `VITE_ANTHROPIC_API_KEY` stored in `.env.local` only — never committed
- Pri sends only the user's typed message to Anthropic — no Gusto data in API calls
- No backend, no database, no write surface in production
- Intended to run behind Cloudflare Access (Gusto SSO) when deployed internally

---

## What's Next

- Manager section upgrades — floor-level depth matching the Gustie enhancements
- WFM section upgrades — same energy, different lens
- SmartSync full retirement (5/8 done)
- Live ACD feed integration
- Workday HR sync
- Schedule preference bidding
- Capacity Planning (Q3/Q4 2026) — Erlang-C modeling, hiring plan builder, gap analysis, PDF export
- Hype docs — role-specific launch materials for Gusties, Managers, and Workforce Intelligence

---

*Built by Ammad Williams — Gusto WFM · May 2026 · v1.1.0*

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
  Chicago · May 2026 · v1.1.0

  "The tools we had weren't good enough. So I built something that was."

  This platform was designed, architected, and built from scratch
  in a single React file. No team. No template. No playbook.
  Just a problem worth solving and the will to ship.

  If you're reading this in the source, you found the easy one.
  The real one lives inside the app.
  (hint: the logo knows who built it)

  QW1tYWQgV2lsbGlhbXMgYnVpbHQgdGhpcy4gRnVsbCBzdG9wLg==
-->

