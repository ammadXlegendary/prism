/**
 * Prism by Gusto — WorkPatternBuilder
 * ─────────────────────────────────────────────
 * Create, edit, and assign reusable shift patterns.
 * Drop into: src/components/Schedule/WorkPatternBuilder.jsx
 *
 * A "work pattern" is a named template:
 *   - Which days of the week it applies (Mon–Sun checkboxes)
 *   - A set of activity segments (same format as schedule segments)
 *   - An optional rotation (Week A / Week B)
 *
 * Patterns can be assigned to individual agents or
 * bulk-assigned to a pillar or selection.
 *
 * Props:
 *   agents        - full agent array
 *   onAssign      - (agentIds, patternId) => void
 *   onClose       - () => void
 */

import { useState, useRef, useMemo, useCallback } from 'react';

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

const ACTIVITIES = [
  { label: 'Phone',                 color: '#0A8080' },
  { label: 'Email',                 color: '#3B82F6' },
  { label: 'Chat/Email',            color: '#06B6D4' },
  { label: 'Break',                 color: '#6B7280' },
  { label: 'Lunch',                 color: '#9CA3AF' },
  { label: 'Meeting',               color: '#7F77DD' },
  { label: '1x1 Meeting',           color: '#8B5CF6' },
  { label: 'Gustie Guide Training', color: '#EF9F27' },
  { label: 'PTO',                   color: '#0AC8A0' },
  { label: 'Admin',                 color: '#374151' },
  { label: 'Off',                   color: '#1F2937'  },
];

const DAYS_OF_WEEK = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_START = 6;
const DAY_END   = 22;
const DAY_SPAN  = DAY_END - DAY_START;

const uid  = () => Math.random().toString(36).slice(2, 9);
const snap = (h) => Math.round(h * 4) / 4;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const fmtH = (h) => {
  if (h == null) return '--';
  const hh = Math.floor(h);
  const mm  = Math.round((h - hh) * 60);
  const ap  = hh < 12 ? 'am' : 'pm';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${mm.toString().padStart(2,'0')}${ap}`;
};

const fmtDur = (h) => {
  const hr = Math.floor(h);
  const mn = Math.round((h - hr) * 60);
  return hr > 0 && mn > 0 ? `${hr}h ${mn}m` : hr > 0 ? `${hr}h` : `${mn}m`;
};

// ── SEED DATA — starter patterns ──────────────────────────────
const SEED_PATTERNS = [
  {
    id: 'pat-morning',
    name: 'Morning Shift',
    color: '#0A8080',
    days: ['Mon','Tue','Wed','Thu','Fri'],
    rotation: null,
    segments: [
      { id: uid(), a: 'Gustie Guide Training', c: '#EF9F27', s: 8,    e: 8.5  },
      { id: uid(), a: 'Phone',                 c: '#0A8080', s: 8.5,  e: 12   },
      { id: uid(), a: 'Lunch',                 c: '#9CA3AF', s: 12,   e: 12.5 },
      { id: uid(), a: 'Phone',                 c: '#0A8080', s: 12.5, e: 15   },
      { id: uid(), a: 'Break',                 c: '#6B7280', s: 15,   e: 15.25},
      { id: uid(), a: 'Phone',                 c: '#0A8080', s: 15.25,e: 17   },
    ],
    assignedCount: 0,
    createdBy: 'Ammad Williams',
  },
  {
    id: 'pat-mid',
    name: 'Mid Shift',
    color: '#7F77DD',
    days: ['Mon','Tue','Wed','Thu','Fri'],
    rotation: null,
    segments: [
      { id: uid(), a: 'Phone',   c: '#0A8080', s: 10,   e: 12   },
      { id: uid(), a: 'Lunch',   c: '#9CA3AF', s: 12,   e: 12.5 },
      { id: uid(), a: 'Phone',   c: '#0A8080', s: 12.5, e: 16   },
      { id: uid(), a: 'Break',   c: '#6B7280', s: 14,   e: 14.25},
      { id: uid(), a: 'Chat/Email', c: '#06B6D4', s: 16, e: 18   },
    ],
    assignedCount: 0,
    createdBy: 'Ammad Williams',
  },
  {
    id: 'pat-late',
    name: 'Late Shift',
    color: '#F45D48',
    days: ['Mon','Tue','Wed','Thu','Fri'],
    rotation: null,
    segments: [
      { id: uid(), a: 'Phone',   c: '#0A8080', s: 12,   e: 15.5 },
      { id: uid(), a: 'Lunch',   c: '#9CA3AF', s: 13,   e: 13.5 },
      { id: uid(), a: 'Break',   c: '#6B7280', s: 15.5, e: 15.75},
      { id: uid(), a: 'Chat/Email', c: '#06B6D4', s: 15.75, e: 19},
    ],
    assignedCount: 0,
    createdBy: 'Ammad Williams',
  },
  {
    id: 'pat-flex',
    name: 'Flex 4×10',
    color: '#EF9F27',
    days: ['Mon','Tue','Wed','Thu'],
    rotation: null,
    segments: [
      { id: uid(), a: 'Phone',      c: '#0A8080', s: 7,    e: 12   },
      { id: uid(), a: 'Lunch',      c: '#9CA3AF', s: 11.5, e: 12   },
      { id: uid(), a: 'Phone',      c: '#0A8080', s: 12,   e: 17   },
      { id: uid(), a: 'Break',      c: '#6B7280', s: 9.5,  e: 9.75 },
      { id: uid(), a: 'Break',      c: '#6B7280', s: 14.5, e: 14.75},
    ],
    assignedCount: 0,
    createdBy: 'Ammad Williams',
  },
];

// ── MINI PATTERN GANTT ────────────────────────────────────────
function PatternGantt({ segments, compact = false }) {
  const h = compact ? 16 : 28;
  return (
    <div style={{ position: 'relative', height: h, background: C.elev, borderRadius: compact ? 3 : 4, overflow: 'hidden' }}>
      {/* Hour marks */}
      {!compact && Array.from({ length: DAY_SPAN + 1 }, (_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${(i / DAY_SPAN) * 100}%`,
          top: 0, bottom: 0,
          borderLeft: `1px solid ${C.border}`,
          opacity: 0.4,
        }} />
      ))}
      {segments.map(seg => {
        const left  = Math.max(0, ((seg.s - DAY_START) / DAY_SPAN) * 100);
        const width = Math.min(100 - left, ((seg.e - seg.s) / DAY_SPAN) * 100);
        if (width <= 0) return null;
        return (
          <div key={seg.id} title={`${seg.a} ${fmtH(seg.s)}–${fmtH(seg.e)}`} style={{
            position: 'absolute',
            left: `${left}%`, width: `${width}%`,
            top: compact ? 2 : 3, bottom: compact ? 2 : 3,
            background: seg.c || C.kale,
            borderRadius: 2,
            opacity: 0.88,
            display: 'flex', alignItems: 'center', overflow: 'hidden', paddingLeft: 3,
          }}>
            {!compact && width > 8 && (
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {seg.a}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── PATTERN CARD ──────────────────────────────────────────────
function PatternCard({ pattern, selected, onSelect, onEdit }) {
  const totalH = pattern.segments.reduce((s, sg) => s + (sg.e - sg.s), 0);
  const prodH  = pattern.segments.filter(sg => !['Break','Lunch','Off'].includes(sg.a))
                                  .reduce((s, sg) => s + (sg.e - sg.s), 0);

  return (
    <div
      onClick={onSelect}
      style={{
        background: selected ? `${pattern.color}18` : C.elev,
        border: `2px solid ${selected ? pattern.color : C.border}`,
        borderRadius: 8,
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 150ms',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: pattern.color }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{pattern.name}</span>
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>
            {pattern.days.join(' · ')}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 8px', color: C.muted, cursor: 'pointer', fontSize: 10 }}
        >Edit</button>
      </div>

      {/* Mini gantt */}
      <PatternGantt segments={pattern.segments} />

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        {[
          ['Total', fmtDur(totalH)],
          ['Productive', fmtDur(prodH)],
          ['Agents', pattern.assignedCount],
        ].map(([label, val]) => (
          <div key={label}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{val}</div>
            <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
          </div>
        ))}
      </div>

      {selected && (
        <div style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: '50%', background: pattern.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>
        </div>
      )}
    </div>
  );
}

// ── PATTERN EDITOR ────────────────────────────────────────────
function PatternEditor({ pattern, onSave, onCancel }) {
  const [name, setName]     = useState(pattern?.name || 'New Pattern');
  const [color, setColor]   = useState(pattern?.color || C.kale);
  const [days, setDays]     = useState(pattern?.days || ['Mon','Tue','Wed','Thu','Fri']);
  const [segs, setSegs]     = useState(pattern?.segments || []);
  const [editSeg, setEditSeg] = useState(null); // { idx, seg }
  const [addForm, setAddForm] = useState({ actIdx: 0, s: 9, e: 10 });

  const toggleDay = (d) => setDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev, d]);

  const addSeg = () => {
    const act = ACTIVITIES[addForm.actIdx];
    const ns = snap(addForm.s);
    const ne = snap(addForm.e);
    if (ne <= ns) return;
    setSegs(prev => [...prev, { id: uid(), a: act.label, c: act.color, s: ns, e: ne }]);
  };

  const deleteSeg = (id) => setSegs(prev => prev.filter(s => s.id !== id));

  const updateSeg = (id, patch) => setSegs(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));

  const totalH = segs.reduce((t, s) => t + (s.e - s.s), 0);

  const PALETTE = ['#0A8080','#7F77DD','#F45D48','#EF9F27','#0AC8A0','#3B82F6','#EC4899','#8B5CF6','#F59E0B','#10B981'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Editor header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {pattern?.id ? 'Edit Pattern' : 'New Pattern'}
        </div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          style={{
            background: 'none', border: 'none', outline: 'none',
            fontSize: 22, fontWeight: 700, color: C.text,
            fontFamily: "'Cormorant Garamond', serif",
            width: '100%',
          }}
          placeholder="Pattern name..."
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Color */}
        <div>
          <div style={labelSt}>Color</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PALETTE.map(c => (
              <div key={c} onClick={() => setColor(c)} style={{
                width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                border: `2px solid ${color === c ? '#fff' : 'transparent'}`,
                boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                transition: 'all 100ms',
              }} />
            ))}
          </div>
        </div>

        {/* Days */}
        <div>
          <div style={labelSt}>Days of week</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {DAYS_OF_WEEK.map(d => (
              <button key={d} onClick={() => toggleDay(d)} style={{
                width: 36, height: 36, borderRadius: 6,
                background: days.includes(d) ? color + '22' : C.elev,
                border: `1px solid ${days.includes(d) ? color : C.border}`,
                color: days.includes(d) ? color : C.muted,
                fontSize: 10, fontWeight: days.includes(d) ? 700 : 400,
                cursor: 'pointer', transition: 'all 120ms',
              }}>{d}</button>
            ))}
          </div>
        </div>

        {/* Segments */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={labelSt}>Segments · {fmtDur(totalH)} total</div>
          </div>

          {/* Preview Gantt */}
          <div style={{ marginBottom: 12 }}>
            <PatternGantt segments={segs} />
            {/* Time axis */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
              {Array.from({ length: 9 }, (_, i) => DAY_START + i * 2).map(h => (
                <span key={h} style={{ fontSize: 8, color: C.dim }}>
                  {h > 12 ? `${h-12}p` : h === 12 ? '12p' : `${h}a`}
                </span>
              ))}
            </div>
          </div>

          {/* Segment list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {[...segs].sort((a,b) => a.s - b.s).map(seg => (
              <div key={seg.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px',
                background: C.elev,
                borderRadius: 4,
                border: editSeg?.id === seg.id ? `1px solid ${seg.c}` : `1px solid ${C.border}`,
              }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.c, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 11, color: C.text, fontWeight: 500 }}>{seg.a}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{fmtH(seg.s)} – {fmtH(seg.e)}</div>
                <div style={{ fontSize: 10, color: C.dim }}>{fmtDur(seg.e - seg.s)}</div>
                <button onClick={() => deleteSeg(seg.id)} style={{ background: 'none', border: 'none', color: C.guava, cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>
              </div>
            ))}
            {segs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px', color: C.dim, fontSize: 12 }}>
                No segments yet. Add one below.
              </div>
            )}
          </div>

          {/* Add segment form */}
          <div style={{ background: C.card, borderRadius: 6, padding: '10px 12px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.kale, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>+ Add Segment</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 120px' }}>
                <div style={labelSt}>Activity</div>
                <select
                  value={addForm.actIdx}
                  onChange={e => setAddForm(f => ({ ...f, actIdx: +e.target.value }))}
                  style={selSt}
                >
                  {ACTIVITIES.map((a,i) => <option key={a.label} value={i}>{a.label}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 60px' }}>
                <div style={labelSt}>Start</div>
                <input type="number" step="0.25" min={DAY_START} max={DAY_END - 0.25}
                  value={addForm.s}
                  onChange={e => setAddForm(f => ({ ...f, s: +e.target.value }))}
                  style={inpSt}
                />
                <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{fmtH(snap(addForm.s))}</div>
              </div>
              <div style={{ flex: '1 1 60px' }}>
                <div style={labelSt}>End</div>
                <input type="number" step="0.25" min={DAY_START + 0.25} max={DAY_END}
                  value={addForm.e}
                  onChange={e => setAddForm(f => ({ ...f, e: +e.target.value }))}
                  style={inpSt}
                />
                <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{fmtH(snap(addForm.e))}</div>
              </div>
              <button onClick={addSeg} disabled={addForm.e <= addForm.s} style={{ ...btnSt(C.kale), alignSelf: 'center', marginTop: 12 }}>Add</button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
        <button onClick={() => onSave({ name, color, days, segments: segs, id: pattern?.id || uid() })} style={{ ...btnSt(C.kale), flex: 1 }}>
          Save Pattern
        </button>
        <button onClick={onCancel} style={ghostBtnSt}>Cancel</button>
      </div>
    </div>
  );
}

// ── ASSIGN PANEL ──────────────────────────────────────────────
function AssignPanel({ pattern, agents, onAssign, onClose }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [filterPillar, setFilterPillar] = useState(null);

  const pillars = [...new Set(agents.map(a => a.pillar || a.p).filter(Boolean))];

  const filtered = agents.filter(a => {
    const nm = a.n?.toLowerCase() || '';
    const pl = (a.pillar || a.p) || '';
    return nm.includes(search.toLowerCase()) &&
      (!filterPillar || pl === filterPillar);
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(a => a.id)));
  };

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 2 }}>Assign Pattern</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: pattern.color }} />
          <span style={{ fontSize: 12, color: pattern.color, fontWeight: 500 }}>{pattern.name}</span>
        </div>
      </div>

      <div style={{ padding: '10px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search agents..."
          style={{ ...inpSt, width: '100%' }}
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <PillBtn active={!filterPillar} onClick={() => setFilterPillar(null)}>All</PillBtn>
          {pillars.map(p => (
            <PillBtn key={p} active={filterPillar===p} color={PILLAR_COLORS[p]} onClick={() => setFilterPillar(filterPillar===p?null:p)}>
              {p.split(' ')[0]}
            </PillBtn>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: C.muted }}>{filtered.length} agents</span>
          <button onClick={toggleAll} style={{ background: 'none', border: 'none', color: C.kale, cursor: 'pointer', fontSize: 10 }}>
            {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.map(agent => {
          const isSel = selected.has(agent.id);
          const pc = PILLAR_COLORS[agent.pillar || agent.p] || C.kale;
          return (
            <div
              key={agent.id}
              onClick={() => toggle(agent.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 20px',
                cursor: 'pointer',
                background: isSel ? `${C.kale}10` : 'transparent',
                borderBottom: `1px solid ${C.border}`,
                transition: 'background 80ms',
              }}
            >
              <input type="checkbox" checked={isSel} onChange={() => {}} style={{ accentColor: C.kale }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: pc, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{agent.n}</div>
                <div style={{ fontSize: 10, color: pc }}>{agent.pillar || agent.p}</div>
              </div>
              {agent.pattern && (
                <div style={{ fontSize: 9, color: C.dim, fontStyle: 'italic' }}>has pattern</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
        <button
          onClick={() => { onAssign([...selected], pattern.id); onClose(); }}
          disabled={selected.size === 0}
          style={{ ...btnSt(C.kale), flex: 1 }}
        >
          Assign to {selected.size} agent{selected.size !== 1 ? 's' : ''}
        </button>
        <button onClick={onClose} style={ghostBtnSt}>Cancel</button>
      </div>
    </div>
  );
}

// ── SHARED ATOMS ──────────────────────────────────────────────
const labelSt = { fontSize: 9, color: C.dim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };
const inpSt   = { background: C.elev, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px', color: C.text, fontSize: 11, outline: 'none', width: '100%', fontFamily: "'DM Sans', sans-serif" };
const selSt   = { ...inpSt, cursor: 'pointer' };
const btnSt   = (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' });
const ghostBtnSt = { background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 4, padding: '8px 14px', fontSize: 12, cursor: 'pointer' };

function PillBtn({ active, color, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? (color || C.kale) + '22' : 'transparent',
      border: `1px solid ${active ? (color || C.kale) : C.border}`,
      borderRadius: 20, padding: '2px 10px', fontSize: 9,
      color: active ? (color || C.kale) : C.muted,
      cursor: 'pointer', fontWeight: active ? 600 : 400,
    }}>{children}</button>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function WorkPatternBuilder({ agents = [], onAssign, onClose }) {
  const [patterns, setPatterns] = useState(SEED_PATTERNS);
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [view, setView] = useState('library'); // 'library' | 'editor' | 'assign'
  const [editingPattern, setEditingPattern] = useState(null);

  const handleSave = (patData) => {
    setPatterns(prev => {
      const existing = prev.find(p => p.id === patData.id);
      if (existing) return prev.map(p => p.id === patData.id ? { ...p, ...patData } : p);
      return [...prev, { ...patData, assignedCount: 0, createdBy: 'Ammad Williams' }];
    });
    setView('library');
    setEditingPattern(null);
  };

  const handleAssign = (agentIds, patternId) => {
    setPatterns(prev => prev.map(p =>
      p.id === patternId ? { ...p, assignedCount: p.assignedCount + agentIds.length } : p
    ));
    onAssign?.(agentIds, patternId);
  };

  const handleDelete = (patId) => {
    setPatterns(prev => prev.filter(p => p.id !== patId));
    if (selectedPattern?.id === patId) setSelectedPattern(null);
  };

  const selPat = patterns.find(p => p.id === selectedPattern?.id);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      background: C.bg,
      fontFamily: "'DM Sans', sans-serif",
      color: C.text,
      overflow: 'hidden',
    }}>
      {/* ── Left: Pattern Library ── */}
      <div style={{
        width: 360,
        flexShrink: 0,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 9, color: C.kale, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Work Patterns</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", color: C.text }}>Pattern Library</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => { setEditingPattern(null); setView('editor'); }}
                style={{ ...btnSt(C.kale), padding: '6px 12px', fontSize: 11 }}
              >+ New</button>
              {onClose && <button onClick={onClose} style={ghostBtnSt}>✕</button>}
            </div>
          </div>
        </div>

        {/* Pattern list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {patterns.map(pat => (
            <PatternCard
              key={pat.id}
              pattern={pat}
              selected={selectedPattern?.id === pat.id}
              onSelect={() => setSelectedPattern(pat)}
              onEdit={() => { setEditingPattern(pat); setView('editor'); }}
            />
          ))}
        </div>

        {/* Summary */}
        <div style={{ padding: '10px 20px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: C.muted }}>
            <span>{patterns.length} patterns</span>
            <span>{patterns.reduce((s, p) => s + p.assignedCount, 0)} assignments</span>
          </div>
        </div>
      </div>

      {/* ── Right: Detail / Editor / Assign ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* No selection */}
        {view === 'library' && !selPat && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>◈</div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>Select a pattern to preview</div>
            <div style={{ fontSize: 12, color: C.dim }}>or create a new one</div>
          </div>
        )}

        {/* Pattern detail */}
        {view === 'library' && selPat && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
            {/* Detail header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: selPat.color }} />
                  <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", color: C.text }}>{selPat.name}</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {selPat.days.join(' · ')} · {selPat.assignedCount} agents · Created by {selPat.createdBy}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setEditingPattern(selPat); setView('editor'); }} style={ghostBtnSt}>Edit</button>
                <button onClick={() => setView('assign')} style={{ ...btnSt(selPat.color), padding: '8px 16px' }}>Assign to agents →</button>
              </div>
            </div>

            {/* Full Gantt */}
            <div style={{ marginBottom: 20 }}>
              <div style={labelSt}>Schedule preview</div>
              <PatternGantt segments={selPat.segments} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {Array.from({ length: 9 }, (_, i) => DAY_START + i * 2).map(h => (
                  <span key={h} style={{ fontSize: 9, color: C.dim }}>
                    {h > 12 ? `${h-12}p` : h === 12 ? '12p' : `${h}a`}
                  </span>
                ))}
              </div>
            </div>

            {/* Week preview: show pattern per day */}
            <div style={{ marginBottom: 20 }}>
              <div style={labelSt}>Week preview</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {DAYS_OF_WEEK.map(d => {
                  const active = selPat.days.includes(d);
                  return (
                    <div key={d} style={{ flex: 1 }}>
                      <div style={{
                        textAlign: 'center', fontSize: 9, fontWeight: 600,
                        color: active ? selPat.color : C.dim,
                        marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{d}</div>
                      <div style={{ borderRadius: 4, overflow: 'hidden', opacity: active ? 1 : 0.25 }}>
                        <PatternGantt segments={active ? selPat.segments : []} compact />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Segment breakdown */}
            <div style={{ marginBottom: 20 }}>
              <div style={labelSt}>Segment breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...selPat.segments].sort((a,b) => a.s - b.s).map(seg => {
                  const dur   = seg.e - seg.s;
                  const total = selPat.segments.reduce((s, x) => s + (x.e - x.s), 0);
                  const pct   = total > 0 ? (dur / total) * 100 : 0;
                  return (
                    <div key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.c, flexShrink: 0 }} />
                      <div style={{ width: 140, fontSize: 11, color: C.text }}>{seg.a}</div>
                      <div style={{ flex: 1, height: 8, background: C.elev, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: seg.c, opacity: 0.8, transition: 'width 300ms' }} />
                      </div>
                      <div style={{ width: 60, fontSize: 10, color: C.muted, textAlign: 'right' }}>{fmtH(seg.s)} – {fmtH(seg.e)}</div>
                      <div style={{ width: 36, fontSize: 10, color: C.dim, textAlign: 'right' }}>{fmtDur(dur)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Danger zone */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <button onClick={() => handleDelete(selPat.id)} style={{ background: 'none', border: `1px solid ${C.guava}44`, borderRadius: 4, padding: '6px 12px', color: C.guava, cursor: 'pointer', fontSize: 11 }}>
                Delete pattern
              </button>
            </div>
          </div>
        )}

        {/* Editor */}
        {view === 'editor' && (
          <PatternEditor
            pattern={editingPattern}
            onSave={handleSave}
            onCancel={() => { setView('library'); setEditingPattern(null); }}
          />
        )}

        {/* Assign */}
        {view === 'assign' && selPat && (
          <AssignPanel
            pattern={selPat}
            agents={agents}
            onAssign={handleAssign}
            onClose={() => setView('library')}
          />
        )}
      </div>
    </div>
  );
}
