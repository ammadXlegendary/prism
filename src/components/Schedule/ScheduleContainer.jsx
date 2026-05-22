/**
 * Prism by Gusto — ScheduleContainer
 * ─────────────────────────────────────────────
 * Main scheduling shell. Owns the toolbar, view routing,
 * keyboard shortcuts, and side panels.
 *
 * Drop into: src/components/Schedule/ScheduleContainer.jsx
 *
 * Props:
 *   agents         - full agent array from roster
 *   currentUser    - { id, name, role } for publish attribution
 *   onClose        - optional (reserved for host shell back navigation)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSchedule, VIEW, PUBLISH } from '../../hooks/useSchedule';
import WeekView from './WeekView';
import DraggableGantt from './DraggableGantt';
import QuickAddModal  from './QuickAddModal';

// ── BRAND ─────────────────────────────────────────────────────
const C = {
  bg:      '#05080F',
  card:    '#111728',
  elev:    '#182038',
  border:  '#1E2D4A',
  guava:   '#F45D48',
  kale:    '#0A8080',
  amber:   '#EF9F27',
  purple:  '#7F77DD',
  green:   '#0AC8A0',
  text:    'rgba(255,255,255,0.92)',
  muted:   'rgba(255,255,255,0.55)',
  dim:     'rgba(255,255,255,0.28)',
};

// ── PILLAR COLORS (matches roster) ───────────────────────────
const PILLAR_COLORS = {
  'BenOps':              '#0A8080',
  'Premier DSA':         '#7F77DD',
  'OCE Onboarding':      '#EF9F27',
  'SMB Sales':           '#F45D48',
  'Payroll & Taxes':     '#0AC8A0',
  'PAC':                 '#3B82F6',
  'Benefits Care':       '#EC4899',
  'Partner Care':        '#8B5CF6',
  'BAC':                 '#F59E0B',
  'Accountant DSA':      '#10B981',
  'Consumer Money':      '#06B6D4',
};

// Get unique pillars from agents list
const getPillars = (agents) =>
  [...new Set(agents.map((a) => a.pillar || a.p).filter(Boolean))].sort();

// ── AUX CODE COLORS (55 Gusto codes) ─────────────────────────
const AUX_CODES = [
  { label: 'Phone',                color: '#0A8080' },
  { label: 'Email',                color: '#3B82F6' },
  { label: 'Chat/Email',           color: '#06B6D4' },
  { label: 'Break',                color: '#6B7280' },
  { label: 'Lunch',                color: '#9CA3AF' },
  { label: 'Meeting',              color: '#7F77DD' },
  { label: '1x1 Meeting',          color: '#8B5CF6' },
  { label: 'Gustie Guide Training',color: '#EF9F27' },
  { label: 'COBRA/Continuation',   color: '#EC4899' },
  { label: 'FEIN',                 color: '#F59E0B' },
  { label: 'Cancellations',        color: '#F45D48' },
  { label: 'EE Termination',       color: '#DC2626' },
  { label: 'Nesting',              color: '#059669' },
  { label: 'Overtime',             color: '#D97706' },
  { label: 'Shadowing',            color: '#7C3AED' },
  { label: 'Admin',                color: '#374151' },
  { label: 'Off',                  color: '#1F2937' },
  { label: 'PTO',                  color: '#0AC8A0' },
  { label: 'LOA',                  color: '#6B7280' },
];

// ── FORMAT HELPERS ────────────────────────────────────────────
const fmtDate = (d) => {
  const days  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const fmtWeekRange = (weekStart) => {
  const months= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  if (weekStart.getMonth() === end.getMonth()) {
    return `${months[weekStart.getMonth()]} ${weekStart.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${months[weekStart.getMonth()]} ${weekStart.getDate()} – ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
};

const isToday = (date) => {
  const t = new Date();
  return date.getFullYear()===t.getFullYear() &&
         date.getMonth()===t.getMonth() &&
         date.getDate()===t.getDate();
};

function fmtH(h) {
  if (h == null) return '--';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const ap = hh < 12 ? 'am' : 'pm';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${mm.toString().padStart(2,'0')}${ap}`;
}

// ── ADD SEGMENT PANEL ─────────────────────────────────────────
function AddSegmentPanel({ agents, selectedAgentIds, onAdd, onClose }) {
  const [form, setForm] = useState({
    activityIdx: 0,
    startH: 9,
    startM: 0,
    endH: 10,
    endM: 0,
    skipConflicts: true,
  });

  const startDec = form.startH + form.startM / 60;
  const endDec   = form.endH   + form.endM   / 60;

  const handleAdd = () => {
    const aux = AUX_CODES[form.activityIdx];
    onAdd({
      a: aux.label,
      c: aux.color,
      s: startDec,
      e: endDec,
    }, form.skipConflicts);
    onClose();
  };

  const sel = [...selectedAgentIds];
  const label = sel.length === 1
    ? `Adding to ${agents.find(a=>a.id===sel[0])?.n || '1 agent'}`
    : `Adding to ${sel.length} agents`;

  return (
    <Panel title="Add Segment" subtitle={label} onClose={onClose}>
      <FieldRow label="Activity">
        <select value={form.activityIdx} onChange={e=>setForm(f=>({...f,activityIdx:+e.target.value}))} style={selectStyle}>
          {AUX_CODES.map((ax,i) => <option key={ax.label} value={i}>{ax.label}</option>)}
        </select>
      </FieldRow>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>Start</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" min={0} max={23} value={form.startH} onChange={e=>setForm(f=>({...f,startH:+e.target.value}))} style={{...inputStyle, width: 52}} />
            <select value={form.startM} onChange={e=>setForm(f=>({...f,startM:+e.target.value}))} style={{...selectStyle, flex:1}}>
              {[0,15,30,45].map(m=><option key={m} value={m}>{m.toString().padStart(2,'0')}</option>)}
            </select>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>End</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" min={0} max={24} value={form.endH} onChange={e=>setForm(f=>({...f,endH:+e.target.value}))} style={{...inputStyle, width: 52}} />
            <select value={form.endM} onChange={e=>setForm(f=>({...f,endM:+e.target.value}))} style={{...selectStyle, flex:1}}>
              {[0,15,30,45].map(m=><option key={m} value={m}>{m.toString().padStart(2,'0')}</option>)}
            </select>
          </div>
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.skipConflicts} onChange={e=>setForm(f=>({...f,skipConflicts:e.target.checked}))} />
        <span style={{ fontSize: 12, color: C.muted }}>Skip agents with conflicts</span>
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleAdd} disabled={endDec <= startDec} style={primaryBtn}>Add Segment</button>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
      </div>
    </Panel>
  );
}

// ── EDIT SEGMENT PANEL ────────────────────────────────────────
function EditSegmentPanel({ seg, agentId, agentName, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    activityIdx: AUX_CODES.findIndex(a => a.label === seg?.a) ?? 0,
    startH: Math.floor(seg?.s ?? 9),
    startM: Math.round(((seg?.s ?? 9) % 1) * 60),
    endH:   Math.floor(seg?.e ?? 10),
    endM:   Math.round(((seg?.e ?? 10) % 1) * 60),
  });
  if (!seg) return null;

  const startDec = form.startH + form.startM / 60;
  const endDec   = form.endH   + form.endM   / 60;
  const dur = endDec - startDec;

  const handleSave = () => {
    const aux = AUX_CODES[form.activityIdx] || AUX_CODES[0];
    onSave(agentId, seg.id, { a: aux.label, c: aux.color, s: startDec, e: endDec });
    onClose();
  };

  return (
    <Panel title="Edit Segment" subtitle={agentName} onClose={onClose}>
      <FieldRow label="Activity">
        <select value={form.activityIdx} onChange={e=>setForm(f=>({...f,activityIdx:+e.target.value}))} style={selectStyle}>
          {AUX_CODES.map((ax,i) => <option key={ax.label} value={i}>{ax.label}</option>)}
        </select>
      </FieldRow>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>Start</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" min={0} max={23} value={form.startH} onChange={e=>setForm(f=>({...f,startH:+e.target.value}))} style={{...inputStyle, width:52}} />
            <select value={form.startM} onChange={e=>setForm(f=>({...f,startM:+e.target.value}))} style={{...selectStyle,flex:1}}>
              {[0,15,30,45].map(m=><option key={m} value={m}>{m.toString().padStart(2,'0')}</option>)}
            </select>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>End</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" min={0} max={24} value={form.endH} onChange={e=>setForm(f=>({...f,endH:+e.target.value}))} style={{...inputStyle, width:52}} />
            <select value={form.endM} onChange={e=>setForm(f=>({...f,endM:+e.target.value}))} style={{...selectStyle,flex:1}}>
              {[0,15,30,45].map(m=><option key={m} value={m}>{m.toString().padStart(2,'0')}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
        Duration: {Math.floor(dur)}h {Math.round((dur%1)*60)}m
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSave} disabled={endDec <= startDec} style={primaryBtn}>Save Changes</button>
        <button onClick={() => { onDelete(agentId, seg.id); onClose(); }} style={dangerBtn}>Delete</button>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
      </div>
    </Panel>
  );
}

// ── PUBLISH PANEL ─────────────────────────────────────────────
function PublishPanel({ publishState, publishNote, publishHistory, actions, currentUser, onClose }) {
  const steps = [
    { key: PUBLISH.DRAFT,      label: 'Draft',      icon: '✎',  desc: 'Schedule is being built'        },
    { key: PUBLISH.REVIEW,     label: 'In Review',  icon: '◎',  desc: 'Awaiting final approval'        },
    { key: PUBLISH.PUBLISHED,  label: 'Published',  icon: '✓',  desc: 'Live — agents can see it'       },
  ];
  const stepIdx = steps.findIndex(s => s.key === publishState);
  const [showHistory, setShowHistory] = useState(false);

  const canAdvance = publishState !== PUBLISH.PUBLISHED;
  const nextState  = steps[stepIdx + 1]?.key;

  const advance = () => {
    if (nextState) actions.setPublishState(nextState, currentUser?.name);
    if (nextState === PUBLISH.PUBLISHED) onClose();
  };

  const fmtTs = (iso) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
  };

  return (
    <Panel title="Publish Schedule" onClose={onClose}>
      {/* Pipeline */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        {steps.map((step, i) => (
          <>
            <div key={step.key} style={{ textAlign: 'center', opacity: i <= stepIdx ? 1 : 0.4 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i <= stepIdx ? C.kale : C.elev,
                border: `2px solid ${i <= stepIdx ? C.kale : C.border}`,
                fontSize: 16, margin: '0 auto 4px', fontWeight: 700, color: C.text,
              }}>{step.icon}</div>
              <div style={{ fontSize: 10, color: i === stepIdx ? C.kale : C.muted, fontWeight: i===stepIdx?700:400 }}>{step.label}</div>
            </div>
            {i < steps.length - 1 && (
              <div key={`line-${i}`} style={{ flex: 1, height: 2, background: i < stepIdx ? C.kale : C.border, margin: '0 6px', marginBottom: 18 }} />
            )}
          </>
        ))}
      </div>

      {/* Current state description */}
      <div style={{ padding: '10px 12px', background: C.elev, borderRadius: 6, marginBottom: 14, fontSize: 12, color: C.muted }}>
        {steps[stepIdx]?.desc}
      </div>

      {/* Note */}
      {publishState !== PUBLISH.PUBLISHED && (
        <FieldRow label="Note (optional)">
          <textarea
            value={publishNote}
            onChange={e => actions.setPublishNote(e.target.value)}
            placeholder="Add context for this publish..."
            style={{ ...inputStyle, width: '100%', height: 64, resize: 'vertical', fontFamily: 'DM Sans' }}
          />
        </FieldRow>
      )}

      {canAdvance && (
        <button onClick={advance} style={{ ...primaryBtn, width: '100%', marginBottom: 8 }}>
          {nextState === PUBLISH.REVIEW ? 'Submit for Review' : 'Publish Live →'}
        </button>
      )}
      {publishState === PUBLISH.PUBLISHED && (
        <div style={{ textAlign: 'center', padding: 12, color: C.green, fontSize: 13, fontWeight: 600 }}>
          ✓ Schedule is live. Agents can see their shifts.
        </div>
      )}

      {/* Version history */}
      {publishHistory.length > 0 && (
        <>
          <button onClick={() => setShowHistory(h=>!h)} style={{ ...ghostBtn, width: '100%', marginTop: 8 }}>
            {showHistory ? 'Hide' : 'Show'} version history ({publishHistory.length})
          </button>
          {showHistory && (
            <div style={{ marginTop: 10, maxHeight: 200, overflowY: 'auto' }}>
              {publishHistory.map(ph => (
                <div key={ph.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 11 }}>
                  <div style={{ color: C.text, fontWeight: 500 }}>Published by {ph.publishedBy}</div>
                  <div style={{ color: C.muted }}>{fmtTs(ph.publishedAt)} · {ph.agentCount} agents</div>
                  {ph.note && <div style={{ color: C.muted, marginTop: 2, fontStyle: 'italic' }}>"{ph.note}"</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

// ── SHARED PANEL WRAPPER ──────────────────────────────────────
function Panel({ title, subtitle, onClose, children }) {
  return (
    <div style={{
      width: 300, background: C.card, borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>{children}</div>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  );
}

// ── STYLE ATOMS ───────────────────────────────────────────────
const labelStyle = { fontSize: 11, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };
const inputStyle  = { background: C.elev, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px', color: C.text, fontSize: 12, outline: 'none', width: '100%' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const primaryBtn  = { background: C.kale, color: C.text, border: 'none', borderRadius: 4, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const ghostBtn    = { background: C.elev, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 4, padding: '8px 14px', fontSize: 12, cursor: 'pointer' };
const dangerBtn   = { ...ghostBtn, color: C.guava, borderColor: C.guava };

// ── TOOLBAR ───────────────────────────────────────────────────
function Toolbar({
  viewMode, onSetView, selectedDate, weekStart,
  onStepDate, onGoToday,
  filterPillar, onSetFilterPillar,
  filterSearch, onSetFilterSearch,
  selectedCount, onClearSelection, onSelectAll,
  publishState, onOpenPublish,
  canUndo, canRedo, onUndo, onRedo,
  onOpenAdd,
  pillars,
  onGenerate,
}) {
  const dateLabel = viewMode === VIEW.WEEK
    ? fmtWeekRange(weekStart)
    : fmtDate(selectedDate);
  const todayActive = viewMode === VIEW.WEEK
    ? isToday(weekStart) || isToday(new Date(weekStart.getTime() + 6*86400000))
    : isToday(selectedDate);

  const publishColor = {
    [PUBLISH.DRAFT]:     C.muted,
    [PUBLISH.REVIEW]:    C.amber,
    [PUBLISH.PUBLISHED]: C.green,
  }[publishState] || C.muted;

  const publishLabel = {
    [PUBLISH.DRAFT]:    'Draft',
    [PUBLISH.REVIEW]:   'In Review',
    [PUBLISH.PUBLISHED]:'Published',
  }[publishState] || 'Draft';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px',
      background: C.card,
      borderBottom: `1px solid ${C.border}`,
      flexWrap: 'wrap',
      flexShrink: 0,
    }}>
      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <ToolBtn onClick={() => onStepDate(-1)} title="Previous">‹</ToolBtn>
        <ToolBtn onClick={() => onStepDate(1)}  title="Next">›</ToolBtn>
        <button
          onClick={onGoToday}
          style={{
            ...ghostBtn,
            padding: '5px 10px',
            fontSize: 11,
            opacity: todayActive ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >Today</button>
      </div>

      {/* Date label */}
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, minWidth: 180 }}>
        {dateLabel}
      </div>

      <div style={{ flex: 1 }} />

      {/* Search */}
      <input
        value={filterSearch}
        onChange={e => onSetFilterSearch(e.target.value)}
        placeholder="Search agents..."
        style={{ ...inputStyle, width: 160, fontSize: 11, padding: '5px 10px' }}
      />

      {/* Pillar filter pills */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <PillBtn active={!filterPillar} onClick={() => onSetFilterPillar(null)}>All</PillBtn>
        {pillars.slice(0, 5).map(p => (
          <PillBtn key={p} active={filterPillar === p} color={PILLAR_COLORS[p]} onClick={() => onSetFilterPillar(filterPillar===p ? null : p)}>
            {p.split(' ')[0]}
          </PillBtn>
        ))}
      </div>

      <div style={{ width: 1, height: 20, background: C.border }} />

      {/* View toggle */}
      <div style={{ display: 'flex', background: C.elev, borderRadius: 4, overflow: 'hidden', border: `1px solid ${C.border}` }}>
        {[VIEW.DAY, VIEW.WEEK].map(v => (
          <button
            key={v}
            onClick={() => onSetView(v)}
            style={{
              background: viewMode === v ? C.kale : 'transparent',
              color: viewMode === v ? C.text : C.muted,
              border: 'none', padding: '5px 12px', fontSize: 11,
              fontWeight: viewMode === v ? 600 : 400,
              cursor: 'pointer', textTransform: 'capitalize',
              transition: 'all 150ms',
            }}
          >{v}</button>
        ))}
      </div>

      {/* Undo/redo */}
      <div style={{ display: 'flex', gap: 2 }}>
        <ToolBtn onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">↩</ToolBtn>
        <ToolBtn onClick={onRedo} disabled={!canRedo} title="Redo (⌘Y)">↪</ToolBtn>
      </div>

      {/* Generate schedules */}
      {onGenerate && publishState !== PUBLISH.PUBLISHED && (
        <button
          onClick={onGenerate}
          title="Generate schedules for all visible agents on this date"
          style={{ ...primaryBtn, padding: '5px 12px', fontSize: 11, background: C.purple }}
        >
          ⚡ Generate
        </button>
      )}

      {/* Selection actions */}
      {selectedCount > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.amber, fontWeight: 600 }}>{selectedCount} selected</span>
          <button onClick={onOpenAdd} style={{ ...ghostBtn, padding: '5px 10px', fontSize: 11, borderColor: C.amber, color: C.amber }}>+ Add to All</button>
          <button onClick={onClearSelection} style={{ ...ghostBtn, padding: '5px 8px', fontSize: 11 }}>✕</button>
        </div>
      )}

      {selectedCount === 0 && (
        <button onClick={onSelectAll} style={{ ...ghostBtn, padding: '5px 10px', fontSize: 11 }}>Select All</button>
      )}

      <div style={{ width: 1, height: 20, background: C.border }} />

      {/* Publish state + button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: publishColor }} />
          <span style={{ fontSize: 11, color: publishColor, fontWeight: 500 }}>{publishLabel}</span>
        </div>
        <button onClick={onOpenPublish} style={{ ...primaryBtn, padding: '5px 12px', fontSize: 11 }}>
          {publishState === PUBLISH.DRAFT ? 'Review & Publish' : publishState === PUBLISH.REVIEW ? 'Publish →' : '✓ Published'}
        </button>
      </div>
    </div>
  );
}

function ToolBtn({ onClick, disabled, title, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: C.elev, border: `1px solid ${C.border}`, borderRadius: 4,
        color: disabled ? C.dim : C.muted, cursor: disabled ? 'not-allowed' : 'pointer',
        width: 28, height: 28, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 120ms',
      }}
    >{children}</button>
  );
}

function PillBtn({ active, color, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? (color || C.kale) + '22' : 'transparent',
        border: `1px solid ${active ? (color || C.kale) : C.border}`,
        borderRadius: 20, padding: '3px 10px', fontSize: 10,
        color: active ? (color || C.kale) : C.muted,
        cursor: 'pointer', transition: 'all 120ms', fontWeight: active ? 600 : 400,
        whiteSpace: 'nowrap',
      }}
    >{children}</button>
  );
}

// ── COVERAGE BAR (above agent list) ──────────────────────────
function CoverageBar({ coverage, startH = 7, endH = 20, target = 10 }) {
  const hours = [];
  for (let h = startH; h <= endH; h++) hours.push(h);
  const peak = Math.max(...Object.values(coverage), 1);

  return (
    <div style={{ padding: '8px 0 4px', borderBottom: `1px solid ${C.border}`, marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', paddingLeft: 176, paddingRight: 12, gap: 1, height: 32 }}>
        {hours.map((h) => {
          if (h === endH) return null;
          // Average coverage for this hour (4 slots)
          let sum = 0, count = 0;
          for (let q = 0; q < 4; q++) {
            const slot = Math.round((h + q * 0.25) * 100) / 100;
            if (coverage[slot] !== undefined) { sum += coverage[slot]; count++; }
          }
          const avg = count > 0 ? sum / count : 0;
          const pct = Math.min(100, (avg / Math.max(peak, target)) * 100);
          const color = avg >= target ? C.kale : avg >= target * 0.8 ? C.amber : C.guava;
          return (
            <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <div title={`${Math.round(avg)} agents`} style={{
                width: '90%', background: color + '99',
                height: `${Math.max(2, pct)}%`, borderRadius: '2px 2px 0 0',
                minHeight: avg > 0 ? 2 : 0,
                transition: 'height 300ms',
              }} />
            </div>
          );
        })}
      </div>
      {/* Hour labels */}
      <div style={{ display: 'flex', paddingLeft: 176, paddingRight: 12 }}>
        {hours.map(h => (
          <div key={h} style={{ flex: 1, fontSize: 9, color: C.dim, textAlign: 'left', paddingLeft: 2 }}>
            {h === 12 ? '12p' : h > 12 ? `${h-12}p` : `${h}a`}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN CONTAINER ────────────────────────────────────────────
export default function ScheduleContainer({ agents = [], currentUser, initialDate, onGenerateSchedules }) {
  const { state, actions, derived } = useSchedule(agents, {
    initialDate: initialDate ?? new Date(2026, 4, 4),
  });

  const [panel, setPanel] = useState(null); // 'add' | 'edit' | 'publish' | null
  const [editTarget, setEditTarget] = useState(null); // { agentId, seg }
  const [quickAdd, setQuickAdd] = useState(null); // { agentId, agentName, startHour, anchorX, anchorY }
  const containerRef = useRef(null);
  const pillars = getPillars(agents);

  const filteredAgents = agents.filter(a => {
    const pillarMatch = !state.filterPillar || (a.pillar || a.p) === state.filterPillar;
    const searchMatch = !state.filterSearch ||
      a.n?.toLowerCase().includes(state.filterSearch.toLowerCase()) ||
      (a.pillar || a.p)?.toLowerCase().includes(state.filterSearch.toLowerCase());
    return pillarMatch && searchMatch;
  });

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === 'z' && !e.shiftKey) { e.preventDefault(); actions.undo(); }
      if (meta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); actions.redo(); }
      if (e.key === 'Escape') { setPanel(null); actions.clearSelection(); }
      if (meta && e.key === 'a') { e.preventDefault(); actions.selectAll(filteredAgents); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions, filteredAgents]);

  // ── Coverage for visible agents ────────────────────────────
  const coverage = derived.buildCoverage(filteredAgents.map(a => a.id));

  // ── Handlers ───────────────────────────────────────────────
  const handleAgentClick = useCallback((agentId, e) => {
    actions.selectAgent(agentId, e.metaKey || e.ctrlKey, e.shiftKey, filteredAgents);
  }, [actions, filteredAgents]);

  const handleSegmentClick = useCallback((agentId, seg) => {
    setEditTarget({ agentId, seg });
    setPanel('edit');
  }, []);

  const handleBulkAdd = useCallback((seg, skipConflicts) => {
    const ids = [...state.selectedAgentIds];
    actions.bulkAdd(ids, seg, null, skipConflicts);
  }, [actions, state.selectedAgentIds]);

  const handleSaveSegment = useCallback((agentId, segId, patch) => {
    actions.updateSegment(agentId, segId, patch);
  }, [actions]);

  const handleDeleteSegment = useCallback((agentId, segId) => {
    actions.deleteSegment(agentId, segId);
  }, [actions]);

  const handleTrackAdd = useCallback((agentId, hour, anchorX, anchorY) => {
    const agent = agents.find(a => a.id === agentId);
    setQuickAdd({ agentId, agentName: agent?.n || '', startHour: hour, anchorX, anchorY });
  }, [agents]);

  const handleQuickAdd = useCallback(({ agentId, seg }) => {
    actions.addSegment(agentId, seg);
  }, [actions]);

  const handleGenerate = useCallback(() => {
    if (!onGenerateSchedules) return;
    const segsMap = onGenerateSchedules(filteredAgents);
    if (segsMap) actions.generateSchedules(segsMap, derived.dk);
  }, [onGenerateSchedules, filteredAgents, derived.dk, actions]);

  return (
    <div
      ref={containerRef}
      onMouseMove={e => { window.lastMouseEvent = e; }}
      style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', background: C.bg, color: C.text,
        fontFamily: "'DM Sans', sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* ── Toolbar ── */}
      <Toolbar
        viewMode={state.viewMode}
        onSetView={actions.setView}
        selectedDate={state.selectedDate}
        weekStart={state.weekStart}
        onStepDate={actions.stepDate}
        onGoToday={actions.goToday}
        filterPillar={state.filterPillar}
        onSetFilterPillar={actions.setFilterPillar}
        filterSearch={state.filterSearch}
        onSetFilterSearch={actions.setFilterSearch}
        selectedCount={state.selectedAgentIds.size}
        onClearSelection={actions.clearSelection}
        onSelectAll={() => actions.selectAll(filteredAgents)}
        publishState={state.publishState}
        onOpenPublish={() => setPanel('publish')}
        canUndo={derived.canUndo}
        canRedo={derived.canRedo}
        onUndo={actions.undo}
        onRedo={actions.redo}
        onOpenAdd={() => setPanel('add')}
        pillars={pillars}
        onGenerate={onGenerateSchedules ? handleGenerate : undefined}
      />

      {/* ── Content + Panel ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Main view ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Coverage bar */}
          <CoverageBar coverage={coverage} />

          {/* Agent list / view */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {state.viewMode === VIEW.WEEK ? (
              <WeekView
                agents={filteredAgents}
                scheduleMap={state.scheduleMap}
                weekStart={state.weekStart}
                selectedAgentIds={state.selectedAgentIds}
                onAgentClick={handleAgentClick}
                onDayClick={(agentId, date) => {
                  actions.setDate(date);
                  actions.setView(VIEW.DAY);
                }}
              />
            ) : (
              <DraggableGantt
                agents={filteredAgents}
                scheduleMap={state.scheduleMap}
                dateKey={derived.dk}
                selectedAgentIds={state.selectedAgentIds}
                onAgentClick={handleAgentClick}
                onSegmentClick={handleSegmentClick}
                onMove={(agentId, segId, newStart) =>
                  actions.moveSegment(agentId, segId, newStart)
                }
                onResize={(agentId, segId, newS, newE) =>
                  actions.resizeSegment(agentId, segId, newS, newE)
                }
                onDelete={(agentId, segId) =>
                  actions.deleteSegment(agentId, segId)
                }
                onAdd={(agentId, hour, preFilled) => {
                  if (preFilled) {
                    actions.addSegment(agentId, preFilled);
                  } else {
                    const e = window.lastMouseEvent || {};
                    handleTrackAdd(agentId, hour, e.clientX || 400, e.clientY || 200);
                  }
                }}
                readOnly={state.publishState === 'published' || currentUser?.role === 'manager'}
              />
            )}

            {filteredAgents.length === 0 && (
              <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>◌</div>
                <div style={{ fontSize: 14 }}>No agents match this filter</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Side panel ── */}
        {panel === 'add' && state.selectedAgentIds.size > 0 && (
          <AddSegmentPanel
            agents={filteredAgents}
            selectedAgentIds={state.selectedAgentIds}
            onAdd={handleBulkAdd}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'edit' && editTarget && (
          <EditSegmentPanel
            seg={editTarget.seg}
            agentId={editTarget.agentId}
            agentName={agents.find(a => a.id === editTarget.agentId)?.n || ''}
            onSave={handleSaveSegment}
            onDelete={handleDeleteSegment}
            onClose={() => { setPanel(null); setEditTarget(null); }}
          />
        )}
        {panel === 'publish' && (
          <PublishPanel
            publishState={state.publishState}
            publishNote={state.publishNote}
            publishHistory={state.publishHistory}
            actions={actions}
            currentUser={currentUser}
            onClose={() => setPanel(null)}
          />
        )}
      </div>

      {quickAdd && (
        <QuickAddModal
          agentId={quickAdd.agentId}
          agentName={quickAdd.agentName}
          startHour={quickAdd.startHour}
          anchorX={quickAdd.anchorX}
          anchorY={quickAdd.anchorY}
          onAdd={handleQuickAdd}
          onClose={() => setQuickAdd(null)}
        />
      )}

      {/* ── Keyboard hint strip ── */}
      <div style={{
        display: 'flex', gap: 16, padding: '5px 16px',
        borderTop: `1px solid ${C.border}`, background: C.card,
        flexShrink: 0,
      }}>
        {[
          ['⌘Z', 'Undo'], ['⌘Y', 'Redo'], ['⌘A', 'Select all'],
          ['Esc', 'Clear'], ['Click seg', 'Edit'],
          [`${state.selectedAgentIds.size > 0 ? state.selectedAgentIds.size+' selected' : '0 selected'}`, ''],
        ].map(([key, label]) => (
          <div key={key} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <kbd style={{ background: C.elev, border: `1px solid ${C.border}`, borderRadius: 3, padding: '1px 5px', fontSize: 9, color: C.muted, fontFamily: 'monospace' }}>{key}</kbd>
            {label && <span style={{ fontSize: 10, color: C.dim }}>{label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
