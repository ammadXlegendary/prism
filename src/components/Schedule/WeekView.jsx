/**
 * Prism by Gusto — WeekView
 * ─────────────────────────────────────────────
 * 5-day (Mon–Fri) schedule grid.
 * Each cell = one agent × one day, showing mini activity bars.
 * Coverage row at top shows staffing level per day.
 * Click any cell to drill into day view.
 *
 * Drop into: src/components/Schedule/WeekView.jsx
 *
 * Props:
 *   agents          - filtered agent array
 *   scheduleMap     - { agentId: { dateKey: Segment[] } }
 *   weekStart       - Monday Date of the current week
 *   selectedAgentIds- Set of selected agent IDs
 *   onAgentClick    - (agentId, event) => void
 *   onDayClick      - (agentId, date) => void  — drill into day view
 */

import { useMemo, useState } from 'react';

// ── BRAND ─────────────────────────────────────────────────────
const C = {
  bg:     '#05080F',
  card:   '#111728',
  elev:   '#182038',
  border: '#1E2D4A',
  guava:  '#F45D48',
  kale:   '#0A8080',
  amber:  '#EF9F27',
  purple: '#7F77DD',
  green:  '#0AC8A0',
  text:   'rgba(255,255,255,0.92)',
  muted:  'rgba(255,255,255,0.55)',
  dim:    'rgba(255,255,255,0.28)',
};

const PILLAR_COLORS = {
  'BenOps':           '#0A8080',
  'Premier DSA':      '#7F77DD',
  'OCE Onboarding':   '#EF9F27',
  'SMB Sales':        '#F45D48',
  'Payroll & Taxes':  '#0AC8A0',
  'PAC':              '#3B82F6',
  'Benefits Care':    '#EC4899',
  'Partner Care':     '#8B5CF6',
  'BAC':              '#F59E0B',
  'Accountant DSA':   '#10B981',
  'Consumer Money':   '#06B6D4',
};

// ── HELPERS ───────────────────────────────────────────────────
const DAYS    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const dateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isToday = (date) => {
  const t = new Date();
  return date.getFullYear()===t.getFullYear() &&
         date.getMonth()===t.getMonth() &&
         date.getDate()===t.getDate();
};

const isWeekend = (date) => date.getDay()===0 || date.getDay()===6;

const US_HOLIDAYS = {
  '2026-01-01': "New Year's Day",
  '2026-01-19': "MLK Day",
  '2026-02-16': "Presidents' Day",
  '2026-05-25': "Memorial Day",
  '2026-06-19': "Juneteenth",
  '2026-07-04': "Independence Day",
  '2026-09-07': "Labor Day",
  '2026-11-26': "Thanksgiving",
  '2026-12-25': "Christmas Day",
};

// Productive hours for a segment list
const productiveHours = (segs) =>
  segs
    .filter(s => !['Break','Lunch','Off'].includes(s.a))
    .reduce((sum, s) => sum + (s.e - s.s), 0);

const totalHours = (segs) =>
  segs.reduce((sum, s) => sum + (s.e - s.s), 0);

// Build coverage profile for a set of agents on a date
const buildDayCoverage = (agentIds, scheduleMap, dk) => {
  let active = 0;
  let total  = 0;
  for (const id of agentIds) {
    const segs = scheduleMap[id]?.[dk] || [];
    if (segs.length) total++;
    const ph = productiveHours(segs);
    if (ph > 0) active++;
  }
  return { active, total };
};

// ── MINI ACTIVITY BAR ─────────────────────────────────────────
// One thin bar representing a day's schedule for an agent
function MiniDayBar({ segs, startH = 7, endH = 20 }) {
  const span = endH - startH;
  if (!segs?.length) return (
    <div style={{ height: 12, borderRadius: 3, background: C.elev, width: '100%', opacity: 0.5 }} />
  );

  return (
    <div style={{ height: 12, borderRadius: 3, background: C.elev, position: 'relative', overflow: 'hidden', width: '100%' }}>
      {segs.map((seg) => {
        const left  = Math.max(0, ((seg.s - startH) / span) * 100);
        const width = Math.min(100 - left, ((seg.e - seg.s) / span) * 100);
        if (width <= 0) return null;
        return (
          <div
            key={seg.id}
            style={{
              position: 'absolute',
              left: `${left}%`, width: `${width}%`,
              top: 1, bottom: 1,
              background: seg.c || C.kale,
              opacity: 0.85,
            }}
          />
        );
      })}
    </div>
  );
}

// ── DAY COLUMN HEADER ─────────────────────────────────────────
function DayHeader({ date, coverage }) {
  const dk    = dateKey(date);
  const holiday = US_HOLIDAYS[dk];
  const today   = isToday(date);
  const weekend = isWeekend(date);
  const { active, total } = coverage;
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;

  return (
    <div style={{
      padding: '10px 8px 8px',
      background: today ? `${C.kale}12` : 'transparent',
      borderBottom: `2px solid ${today ? C.kale : C.border}`,
      textAlign: 'center',
      position: 'relative',
    }}>
      {/* Day name */}
      <div style={{ fontSize: 10, color: today ? C.kale : C.muted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1]}
      </div>

      {/* Date number */}
      <div style={{
        fontSize: 20, fontWeight: 700,
        color: today ? C.text : weekend ? C.dim : C.text,
        fontFamily: "'Cormorant Garamond', serif",
        lineHeight: 1.2, margin: '2px 0',
      }}>
        {date.getDate()}
      </div>

      {/* Month */}
      <div style={{ fontSize: 9, color: C.dim, marginBottom: 6 }}>
        {MONTHS[date.getMonth()]}
      </div>

      {/* Coverage pill */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: pct >= 80 ? `${C.kale}22` : pct >= 60 ? `${C.amber}22` : `${C.guava}22`,
        border: `1px solid ${pct >= 80 ? C.kale : pct >= 60 ? C.amber : C.guava}44`,
        borderRadius: 20, padding: '2px 7px', fontSize: 9,
        color: pct >= 80 ? C.kale : pct >= 60 ? C.amber : C.guava,
        fontWeight: 600,
      }}>
        {active}/{total} <span style={{ fontWeight: 400, opacity: 0.7 }}>sched</span>
      </div>

      {/* Holiday badge */}
      {holiday && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          background: `${C.guava}22`, border: `1px solid ${C.guava}44`,
          borderRadius: 3, padding: '1px 4px', fontSize: 8,
          color: C.guava, fontWeight: 600,
        }}>★</div>
      )}
    </div>
  );
}

// ── AGENT ROW (week view) ─────────────────────────────────────
function WeekAgentRow({ agent, weekDates, scheduleMap, isSelected, onAgentClick, onDayClick }) {
  const pillarColor = PILLAR_COLORS[agent.pillar || agent.p] || C.kale;
  const [hoveredDay, setHoveredDay] = useState(null);

  return (
    <div
      style={{
        display: 'flex',
        background: isSelected ? `${C.kale}10` : 'transparent',
        borderLeft: `3px solid ${isSelected ? C.kale : 'transparent'}`,
        borderBottom: `1px solid ${C.border}`,
        minHeight: 44,
        transition: 'all 120ms',
      }}
    >
      {/* Agent name column */}
      <div
        onClick={(e) => onAgentClick(agent.id, e)}
        style={{
          width: 160,
          flexShrink: 0,
          padding: '8px 10px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          borderRight: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: pillarColor, flexShrink: 0 }} />
          <div style={{
            fontSize: 11, fontWeight: 500, color: C.text,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {agent.n}
          </div>
        </div>
        <div style={{ fontSize: 9, color: C.muted, marginTop: 2, paddingLeft: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {agent.pillar || agent.p || '—'}
        </div>
      </div>

      {/* Day cells */}
      {weekDates.map((date, di) => {
        const dk     = dateKey(date);
        const segs   = scheduleMap[agent.id]?.[dk] || [];
        const today  = isToday(date);
        const wknd   = isWeekend(date);
        const holiday = US_HOLIDAYS[dk];
        const hours  = totalHours(segs);
        const isHovered = hoveredDay === di;

        return (
          <div
            key={dk}
            onClick={() => onDayClick(agent.id, date)}
            onMouseEnter={() => setHoveredDay(di)}
            onMouseLeave={() => setHoveredDay(null)}
            style={{
              flex: 1,
              padding: '6px 6px',
              cursor: 'pointer',
              borderRight: `1px solid ${C.border}`,
              background: isHovered ? C.elev : today ? `${C.kale}08` : wknd ? `${C.bg}88` : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 3,
              position: 'relative',
              transition: 'background 100ms',
              opacity: wknd && !segs.length ? 0.5 : 1,
            }}
          >
            {/* Mini bar */}
            <MiniDayBar segs={segs} />

            {/* Hours or status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {hours > 0 ? (
                <span style={{ fontSize: 9, color: C.muted }}>{hours.toFixed(1)}h</span>
              ) : (
                <span style={{ fontSize: 9, color: C.dim }}>—</span>
              )}
              {segs.some(s => s.a === 'PTO') && (
                <span style={{ fontSize: 8, color: C.green, fontWeight: 600 }}>PTO</span>
              )}
              {segs.some(s => s.a === 'LOA') && (
                <span style={{ fontSize: 8, color: C.muted, fontWeight: 600 }}>LOA</span>
              )}
            </div>

            {/* Holiday dot */}
            {holiday && (
              <div title={holiday} style={{
                position: 'absolute', top: 3, right: 3,
                width: 4, height: 4, borderRadius: '50%', background: C.guava,
              }} />
            )}

            {/* Drill hint on hover */}
            {isHovered && (
              <div style={{
                position: 'absolute', bottom: 2, right: 4,
                fontSize: 8, color: C.kale, opacity: 0.7,
              }}>↗ day</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── WEEK SUMMARY ROW ──────────────────────────────────────────
function WeekSummaryRow({ weekDates, agents, scheduleMap }) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: `2px solid ${C.border}`,
      background: C.card,
      position: 'sticky', bottom: 0, zIndex: 5,
    }}>
      <div style={{ width: 160, flexShrink: 0, padding: '6px 10px', borderRight: `1px solid ${C.border}`, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>TOTALS</span>
      </div>
      {weekDates.map((date) => {
        const dk = dateKey(date);
        let totalH = 0, agentsWithSchedule = 0;
        for (const agent of agents) {
          const segs = scheduleMap[agent.id]?.[dk] || [];
          if (segs.length) { agentsWithSchedule++; totalH += totalHours(segs); }
        }
        const avgH = agentsWithSchedule > 0 ? totalH / agentsWithSchedule : 0;
        return (
          <div key={dk} style={{ flex: 1, padding: '6px', borderRight: `1px solid ${C.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.text, fontWeight: 600 }}>{agentsWithSchedule}</div>
            <div style={{ fontSize: 9, color: C.dim }}>agents · {avgH.toFixed(1)}h avg</div>
          </div>
        );
      })}
    </div>
  );
}

// ── WEEK COVERAGE BAR ─────────────────────────────────────────
function WeekCoverageRow({ weekDates, agents, scheduleMap }) {
  const coverages = weekDates.map(date => {
    const dk = dateKey(date);
    return buildDayCoverage(agents.map(a=>a.id), scheduleMap, dk);
  });

  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, height: 48 }}>
      {/* Label */}
      <div style={{ width: 163, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 10px', borderRight: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coverage</span>
      </div>
      {/* Day bars */}
      {weekDates.map((date, i) => {
        const { active, total } = coverages[i];
        const pct = total > 0 ? (active / total) * 100 : 0;
        const color = pct >= 80 ? C.kale : pct >= 60 ? C.amber : pct > 0 ? C.guava : C.dim;
        const today = isToday(date);
        return (
          <div key={dateKey(date)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
            padding: '4px 6px', borderRight: `1px solid ${C.border}`,
            background: today ? `${C.kale}06` : 'transparent',
          }}>
            <div style={{
              width: '60%', borderRadius: '3px 3px 0 0',
              height: `${Math.max(4, pct * 0.32)}px`,
              background: color + '99',
              transition: 'height 300ms',
              marginBottom: 3,
            }} />
            <div style={{ fontSize: 9, color, fontWeight: 600 }}>
              {pct > 0 ? `${Math.round(pct)}%` : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── MAIN WEEK VIEW ────────────────────────────────────────────
export default function WeekView({
  agents = [],
  scheduleMap = {},
  weekStart,
  selectedAgentIds = new Set(),
  onAgentClick,
  onDayClick,
}) {
  // Build 7 days (Mon–Sun) from weekStart
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Show Mon–Fri by default (5 days), expand on request
  const [showWeekend, setShowWeekend] = useState(false);
  const visibleDates = showWeekend ? weekDates : weekDates.slice(0, 5);

  // Coverage data per day header
  const dayCoverages = useMemo(
    () => visibleDates.map(date => {
      const dk = dateKey(date);
      return buildDayCoverage(agents.map(a=>a.id), scheduleMap, dk);
    }),
    [visibleDates, agents, scheduleMap]
  );

  // Group agents by pillar for section headers
  const grouped = useMemo(() => {
    const map = {};
    for (const agent of agents) {
      const pillar = agent.pillar || agent.p || 'Other';
      if (!map[pillar]) map[pillar] = [];
      map[pillar].push(agent);
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [agents]);

  const [collapsedPillars, setCollapsedPillars] = useState(new Set());
  const togglePillar = (pillar) => {
    setCollapsedPillars(prev => {
      const next = new Set(prev);
      if (next.has(pillar)) next.delete(pillar);
      else next.add(pillar);
      return next;
    });
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'DM Sans', sans-serif",
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* ── Sticky header ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: C.card }}>
        {/* Column headers */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
          {/* Agent name header */}
          <div style={{
            width: 163, flexShrink: 0, padding: '10px',
            borderRight: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>
              {agents.length} AGENTS
            </span>
            <button
              onClick={() => setShowWeekend(w => !w)}
              style={{
                background: showWeekend ? `${C.kale}22` : 'transparent',
                border: `1px solid ${showWeekend ? C.kale : C.border}`,
                borderRadius: 3, padding: '2px 6px',
                fontSize: 9, color: showWeekend ? C.kale : C.muted,
                cursor: 'pointer',
              }}
            >{showWeekend ? 'Hide' : '+Wknd'}</button>
          </div>

          {/* Day headers */}
          {visibleDates.map((date, i) => (
            <div key={dateKey(date)} style={{ flex: 1, borderRight: `1px solid ${C.border}` }}>
              <DayHeader date={date} coverage={dayCoverages[i]} />
            </div>
          ))}
        </div>

        {/* Coverage bar */}
        <WeekCoverageRow weekDates={visibleDates} agents={agents} scheduleMap={scheduleMap} />
      </div>

      {/* ── Agent rows, grouped by pillar ── */}
      {grouped.map(([pillar, pillarAgents]) => {
        const collapsed = collapsedPillars.has(pillar);
        const pillarColor = PILLAR_COLORS[pillar] || C.kale;
        const scheduledCount = pillarAgents.filter(a =>
          visibleDates.some(d => (scheduleMap[a.id]?.[dateKey(d)]?.length || 0) > 0)
        ).length;

        return (
          <div key={pillar}>
            {/* Pillar group header */}
            <div
              onClick={() => togglePillar(pillar)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px',
                background: `${pillarColor}10`,
                borderBottom: `1px solid ${C.border}`,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span style={{ color: pillarColor, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>
                {collapsed ? '▸' : '▾'} {pillar.toUpperCase()}
              </span>
              <span style={{ fontSize: 10, color: C.muted }}>
                {pillarAgents.length} agents · {scheduledCount} scheduled this week
              </span>
              {/* Mini coverage dots for each day */}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {visibleDates.map(date => {
                  const dk = dateKey(date);
                  const sched = pillarAgents.filter(a => (scheduleMap[a.id]?.[dk]?.length || 0) > 0).length;
                  const pct = pillarAgents.length > 0 ? sched / pillarAgents.length : 0;
                  return (
                    <div key={dk} title={`${sched}/${pillarAgents.length} on ${dk}`} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: pct > 0 ? pillarColor : C.elev,
                      opacity: pct > 0 ? 0.5 + pct * 0.5 : 0.3,
                    }} />
                  );
                })}
              </div>
            </div>

            {/* Agent rows */}
            {!collapsed && pillarAgents.map(agent => (
              <WeekAgentRow
                key={agent.id}
                agent={agent}
                weekDates={visibleDates}
                scheduleMap={scheduleMap}
                isSelected={selectedAgentIds.has(agent.id)}
                onAgentClick={onAgentClick}
                onDayClick={onDayClick}
              />
            ))}
          </div>
        );
      })}

      {/* ── Summary footer ── */}
      <WeekSummaryRow
        weekDates={visibleDates}
        agents={agents}
        scheduleMap={scheduleMap}
      />

      {/* Weekend note */}
      {!showWeekend && (
        <div style={{ textAlign: 'center', padding: '10px', fontSize: 10, color: C.dim }}>
          Showing Mon–Fri · <button onClick={() => setShowWeekend(true)} style={{ background: 'none', border: 'none', color: C.kale, cursor: 'pointer', fontSize: 10 }}>Show full week</button>
        </div>
      )}
    </div>
  );
}
