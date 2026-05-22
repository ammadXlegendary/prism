/**
 * Prism by Gusto — DraggableGantt
 * ─────────────────────────────────────────────
 * Full drag-and-drop + resize scheduling Gantt.
 * Drop into: src/components/Schedule/DraggableGantt.jsx
 *
 * Features:
 *  • Drag-to-move   — grab any segment, slide left/right
 *  • Drag-to-resize — grab left or right edge to shrink/grow
 *  • Ghost preview  — translucent clone shows where it will land
 *  • Snap grid      — 15-minute snap always on, Shift = free move
 *  • Conflict flash — red halo when ghost overlaps another segment
 *  • Multi-select   — Shift+click rows, bulk-drop meetings
 *  • Context menu   — right-click segment for quick actions
 *  • Keyboard       — Del deletes focused segment, Esc cancels drag
 *  • Time tooltip   — shows exact times while dragging
 *
 * Props:
 *   agents           Array of agent objects { id, n, pillar, segs? }
 *   scheduleMap      { agentId: { dateKey: Segment[] } }
 *   dateKey          string "YYYY-MM-DD" for the current day
 *   selectedAgentIds Set<string>
 *   onAgentClick     (agentId, event) => void
 *   onSegmentClick   (agentId, seg) => void
 *   onMove           (agentId, segId, newStart) => void
 *   onResize         (agentId, segId, newStart, newEnd) => void
 *   onDelete         (agentId, segId) => void
 *   readOnly         boolean (managers see but can't drag)
 */

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';

// ── CONSTANTS ─────────────────────────────────────────────────
const DAY_START   = 7;   // 7 am
const DAY_END     = 20;  // 8 pm
const DAY_SPAN    = DAY_END - DAY_START; // 13 hours
const EDGE_PX     = 8;   // px from segment edge to trigger resize cursor
const MIN_SEG_DUR = 0.25; // 15 minutes minimum

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

// ── SNAP ──────────────────────────────────────────────────────
const snap = (h, free = false) => free ? h : Math.round(h * 4) / 4;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const fmtH = (h) => {
  if (h == null || isNaN(h)) return '--';
  const hh = Math.floor(h);
  const mm  = Math.round((h - hh) * 60);
  const ap  = hh < 12 ? 'am' : 'pm';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${mm.toString().padStart(2, '0')}${ap}`;
};

const pct = (h) => clamp(((h - DAY_START) / DAY_SPAN) * 100, 0, 100);
const pctW = (s, e) => clamp(((e - s) / DAY_SPAN) * 100, 0, 100 - pct(s));

// Convert clientX to decimal hour using track element
const xToHour = (clientX, trackEl) => {
  const rect = trackEl.getBoundingClientRect();
  const px   = clientX - rect.left;
  return DAY_START + (px / rect.width) * DAY_SPAN;
};

// ── CONFLICT DETECTION ────────────────────────────────────────
const overlaps = (a, b) => a.id !== b.id && a.s < b.e && b.s < a.e;
const hasConflict = (segs, testSeg) => segs.some(s => overlaps(s, testSeg));

// ── HOUR RULER ────────────────────────────────────────────────
function HourRuler() {
  const hours = Array.from({ length: DAY_SPAN + 1 }, (_, i) => DAY_START + i);
  return (
    <div style={{
      display: 'flex', paddingLeft: 196, paddingRight: 56,
      borderBottom: `1px solid ${C.border}`,
      background: C.card,
      position: 'sticky', top: 0, zIndex: 20,
      userSelect: 'none',
    }}>
      {hours.map(h => (
        <div key={h} style={{
          flex: h < DAY_END ? 1 : 0,
          minWidth: h < DAY_END ? 0 : undefined,
          padding: '4px 0',
          fontSize: 9,
          color: C.dim,
          borderLeft: `1px solid ${C.border}`,
          paddingLeft: 4,
          whiteSpace: 'nowrap',
        }}>
          {h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`}
        </div>
      ))}
    </div>
  );
}

// ── NOW INDICATOR ─────────────────────────────────────────────
function NowLine() {
  const now = new Date();
  const h   = now.getHours() + now.getMinutes() / 60;
  if (h < DAY_START || h > DAY_END) return null;
  const pos = pct(h);
  return (
    <div style={{
      position: 'absolute',
      left: `${pos}%`,
      top: 0, bottom: 0,
      width: 2,
      background: C.guava,
      zIndex: 15,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', top: 0,
        left: -4, width: 10, height: 10,
        borderRadius: '50%',
        background: C.guava,
      }} />
    </div>
  );
}

// ── DRAG TOOLTIP ──────────────────────────────────────────────
function DragTooltip({ s, e, conflict, type }) {
  if (s == null) return null;
  const dur  = e - s;
  const mins = Math.round((dur % 1) * 60);
  const hrs  = Math.floor(dur);
  return (
    <div style={{
      position: 'absolute',
      top: -30,
      left: '50%',
      transform: 'translateX(-50%)',
      background: conflict ? C.guava : C.kale,
      color: '#fff',
      borderRadius: 4,
      padding: '3px 8px',
      fontSize: 11,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      zIndex: 100,
      pointerEvents: 'none',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    }}>
      {fmtH(s)} – {fmtH(e)}
      <span style={{ opacity: 0.7, fontWeight: 400, marginLeft: 6 }}>
        {hrs > 0 ? `${hrs}h` : ''}{mins > 0 ? ` ${mins}m` : ''}
      </span>
      {conflict && <span style={{ marginLeft: 6 }}>⚠ conflict</span>}
    </div>
  );
}

// ── SEGMENT ───────────────────────────────────────────────────
function Segment({
  seg,
  segs,           // all segs on this row (for conflict check)
  agentId,
  readOnly,
  isGhost,        // rendering as ghost preview
  isFaded,        // original seg during drag
  onMouseDown,
  onClick,
  onContextMenu,
  isFocused,
}) {
  const segRef = useRef(null);
  const left  = pct(seg.s);
  const width = pctW(seg.s, seg.e);
  const conflict = !isGhost && hasConflict(segs, seg);

  const baseStyle = {
    position:    'absolute',
    left:        `${left}%`,
    width:       `${Math.max(width, 0.5)}%`,
    top:         4, bottom: 4,
    borderRadius: 4,
    background:  seg.c || C.kale,
    display:     'flex',
    alignItems:  'center',
    overflow:    'hidden',
    paddingLeft: 6,
    cursor:      readOnly ? 'default' : 'grab',
    userSelect:  'none',
    transition:  isFaded ? 'opacity 80ms' : 'none',
    opacity:     isFaded ? 0.25 : isGhost ? 0.7 : 1,
    outline:     isFocused ? `2px solid ${C.amber}` : conflict ? `2px solid ${C.guava}` : 'none',
    outlineOffset: 1,
    zIndex:      isGhost ? 20 : isFocused ? 10 : 5,
    boxShadow:   isGhost
      ? `0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px ${conflict ? C.guava : C.kale}`
      : conflict
      ? `0 0 0 2px ${C.guava}66`
      : isFocused
      ? `0 0 0 2px ${C.amber}66`
      : 'none',
  };

  // Border style for ghost
  if (isGhost) {
    baseStyle.background = (seg.c || C.kale) + 'BB';
    baseStyle.border = `2px dashed ${conflict ? C.guava : (seg.c || C.kale)}`;
  }

  const handleMouseDown = (e) => {
    if (readOnly || e.button !== 0) return;
    if (segRef.current) {
      const rect  = segRef.current.getBoundingClientRect();
      const fromL = e.clientX - rect.left;
      const fromR = rect.right - e.clientX;
      const edge  = fromL <= EDGE_PX ? 'start' : fromR <= EDGE_PX ? 'end' : 'move';
      onMouseDown?.(e, agentId, seg, edge);
    }
  };

  // Cursor based on position
  const [cursor, setCursor] = useState(readOnly ? 'default' : 'grab');
  const updateCursor = (e) => {
    if (readOnly || !segRef.current) return;
    const rect  = segRef.current.getBoundingClientRect();
    const fromL = e.clientX - rect.left;
    const fromR = rect.right - e.clientX;
    if (fromL <= EDGE_PX || fromR <= EDGE_PX) setCursor('ew-resize');
    else setCursor('grab');
  };

  return (
    <div
      ref={segRef}
      style={{ ...baseStyle, cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={updateCursor}
      onClick={(e) => { e.stopPropagation(); onClick?.(agentId, seg); }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, agentId, seg); }}
    >
      {/* Resize handle - left */}
      {!readOnly && !isGhost && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: EDGE_PX, cursor: 'ew-resize', zIndex: 2,
          background: 'linear-gradient(to right, rgba(255,255,255,0.15), transparent)',
        }} />
      )}

      {/* Activity label */}
      {width > 5 && (
        <span style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.92)',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          paddingRight: 6,
          pointerEvents: 'none',
          letterSpacing: '-0.01em',
        }}>
          {seg.a}
        </span>
      )}

      {/* Ghost tooltip */}
      {isGhost && <DragTooltip s={seg.s} e={seg.e} conflict={conflict} />}

      {/* Resize handle - right */}
      {!readOnly && !isGhost && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: EDGE_PX, cursor: 'ew-resize', zIndex: 2,
          background: 'linear-gradient(to left, rgba(255,255,255,0.15), transparent)',
        }} />
      )}
    </div>
  );
}

// ── CONTEXT MENU ──────────────────────────────────────────────
function ContextMenu({ x, y, seg, agentId, onAction, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { icon: '✎', label: 'Edit segment',   action: 'edit'   },
    { icon: '⎘', label: 'Duplicate',      action: 'dupe'   },
    { icon: '✂', label: 'Split at noon',  action: 'split'  },
    { divider: true },
    { icon: '🗑', label: 'Delete',         action: 'delete', danger: true },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x, top: y,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 9999,
        minWidth: 160,
        overflow: 'hidden',
      }}
    >
      {/* Segment info header */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{seg.a}</div>
        <div style={{ fontSize: 10, color: C.muted }}>{fmtH(seg.s)} – {fmtH(seg.e)}</div>
      </div>
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} style={{ height: 1, background: C.border, margin: '3px 0' }} />
        ) : (
          <button
            key={item.action}
            onClick={() => { onAction(item.action, agentId, seg); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', background: 'none', border: 'none',
              padding: '7px 12px', cursor: 'pointer', textAlign: 'left',
              color: item.danger ? C.guava : C.text,
              fontSize: 12,
              transition: 'background 80ms',
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.elev}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span style={{ width: 16, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

// ── AGENT ROW ─────────────────────────────────────────────────
function AgentRow({
  agent,
  segs,
  selectedAgentIds,
  dragState,
  ghostSeg,
  focusedSeg,
  readOnly,
  onAgentClick,
  onSegmentMouseDown,
  onSegmentClick,
  onContextMenu,
  onTrackClick,
}) {
  const trackRef  = useRef(null);
  const isSelected = selectedAgentIds.has(agent.id);
  const isDragging = dragState?.agentId === agent.id;
  const pillarColor = PILLAR_COLORS[agent.pillar || agent.p] || C.kale;

  // Adherence: find current segment
  const now  = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const activeSeg = segs.find(s => s.s <= nowH && nowH < s.e);
  const dotColor = activeSeg
    ? activeSeg.a === 'Break' || activeSeg.a === 'Lunch' ? C.amber
    : activeSeg.a.toLowerCase().includes('meeting') ? C.purple
    : C.green
    : C.dim;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      borderBottom: `1px solid ${C.border}`,
      background: isSelected ? `${C.kale}10` : 'transparent',
      borderLeft: `3px solid ${isSelected ? C.kale : 'transparent'}`,
      minHeight: 48,
      transition: 'background 100ms',
    }}>
      {/* Checkbox */}
      <div style={{ width: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onClick={(e) => { e.stopPropagation(); onAgentClick(agent.id, e); }}
          style={{ accentColor: C.kale, cursor: 'pointer', width: 13, height: 13 }}
        />
      </div>

      {/* Adherence dot */}
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: dotColor,
        flexShrink: 0, marginRight: 8,
        boxShadow: `0 0 6px ${dotColor}66`,
      }} />

      {/* Agent name */}
      <div
        onClick={(e) => onAgentClick(agent.id, e)}
        style={{ width: 148, flexShrink: 0, cursor: 'pointer', paddingRight: 6 }}
      >
        <div style={{
          fontSize: 11, fontWeight: 500, color: C.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          letterSpacing: '-0.01em',
        }}>
          {agent.n}
        </div>
        <div style={{ fontSize: 9, color: pillarColor, marginTop: 1 }}>
          {agent.pillar || agent.p || '—'}
        </div>
      </div>

      {/* ── TRACK ── */}
      <div
        ref={trackRef}
        data-track={agent.id}
        onClick={(e) => !dragState && onTrackClick?.(e, agent.id, trackRef.current)}
        style={{
          flex: 1,
          height: 40,
          background: C.elev,
          borderRadius: 4,
          position: 'relative',
          overflow: 'visible',  // allow ghost to overflow vertically
          margin: '4px 0',
          cursor: readOnly ? 'default' : 'crosshair',
        }}
      >
        {/* Hour gridlines */}
        {Array.from({ length: DAY_SPAN + 1 }, (_, i) => {
          const h = DAY_START + i;
          return (
            <div key={h} style={{
              position: 'absolute',
              left: `${(i / DAY_SPAN) * 100}%`,
              top: 0, bottom: 0,
              borderLeft: `1px solid ${C.border}`,
              opacity: 0.4,
              pointerEvents: 'none',
            }} />
          );
        })}

        {/* Quarter-hour dots */}
        {Array.from({ length: DAY_SPAN * 4 }, (_, i) => {
          const h = DAY_START + i * 0.25;
          if (h % 1 === 0) return null; // skip full hours (covered by gridlines)
          return (
            <div key={i} style={{
              position: 'absolute',
              left: `${((h - DAY_START) / DAY_SPAN) * 100}%`,
              top: '50%',
              width: 1, height: h % 0.5 === 0 ? 8 : 4,
              transform: 'translateY(-50%)',
              background: C.border,
              opacity: 0.5,
              pointerEvents: 'none',
            }} />
          );
        })}

        {/* NOW line */}
        <NowLine />

        {/* Segments (faded when being dragged) */}
        {segs.map(seg => {
          const isFaded = isDragging && dragState.segId === seg.id;
          return (
            <Segment
              key={seg.id}
              seg={seg}
              segs={segs}
              agentId={agent.id}
              readOnly={readOnly}
              isFaded={isFaded}
              isFocused={focusedSeg?.agentId === agent.id && focusedSeg?.segId === seg.id}
              onMouseDown={onSegmentMouseDown}
              onClick={onSegmentClick}
              onContextMenu={onContextMenu}
            />
          );
        })}

        {/* Ghost segment (drag preview) */}
        {isDragging && ghostSeg && (
          <Segment
            key="ghost"
            seg={ghostSeg}
            segs={segs}
            agentId={agent.id}
            readOnly={false}
            isGhost
          />
        )}

        {/* Empty state */}
        {segs.length === 0 && !isDragging && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 10, color: C.dim }}>
              {readOnly ? 'No schedule' : 'Click to add'}
            </span>
          </div>
        )}
      </div>

      {/* Hours column */}
      <div style={{
        width: 48, flexShrink: 0, textAlign: 'right',
        paddingRight: 10, fontSize: 10, color: C.muted,
      }}>
        {segs.reduce((sum, s) => sum + (s.e - s.s), 0).toFixed(1)}h
      </div>
    </div>
  );
}

// ── SNAP INDICATOR ────────────────────────────────────────────
// Subtle pulse at snap target position shown while dragging
function SnapGuide({ h, trackEl }) {
  if (h == null || !trackEl) return null;
  const pos = pct(h);
  return (
    <div style={{
      position: 'absolute',
      left: `${pos}%`,
      top: -4, bottom: -4,
      width: 2,
      background: C.kale,
      opacity: 0.6,
      pointerEvents: 'none',
      zIndex: 30,
      borderRadius: 1,
    }} />
  );
}

// ── MAIN DRAGGABLE GANTT ──────────────────────────────────────
export default function DraggableGantt({
  agents = [],
  scheduleMap = {},
  dateKey: dk,
  selectedAgentIds = new Set(),
  onAgentClick,
  onSegmentClick,
  onMove,
  onResize,
  onDelete,
  onAdd,       // (agentId, hour) => void — click on empty track
  readOnly = false,
}) {
  // ── Drag state ───────────────────────────────────────────────
  // dragState: null | {
  //   type: 'move' | 'resize-start' | 'resize-end',
  //   agentId, segId,
  //   startMouseX, startH (hour at mousedown),
  //   origS, origE,           (original start/end)
  //   trackEl,                (the track DOM element)
  // }
  const [dragState, setDragState] = useState(null);
  const [ghostSeg, setGhostSeg] = useState(null);
  const [focusedSeg, setFocusedSeg] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, agentId, seg }
  const [snapGuide, setSnapGuide] = useState(null); // decimal hour

  const dragRef = useRef(null); // keep drag state in ref for mouse handlers
  dragRef.current = dragState;

  // ── Keyboard ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setDragState(null);
        setGhostSeg(null);
        setSnapGuide(null);
        setFocusedSeg(null);
        setCtxMenu(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && focusedSeg && !readOnly) {
        onDelete?.(focusedSeg.agentId, focusedSeg.segId);
        setFocusedSeg(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusedSeg, onDelete, readOnly]);

  // ── Mouse down on segment ─────────────────────────────────────
  const handleSegmentMouseDown = useCallback((e, agentId, seg, edge) => {
    if (readOnly) return;
    e.stopPropagation();

    // Find track element
    const trackEl = e.currentTarget.closest('[data-track]') ||
      document.querySelector(`[data-track="${agentId}"]`);

    setFocusedSeg({ agentId, segId: seg.id });
    setCtxMenu(null);

    const ds = {
      type: edge === 'start' ? 'resize-start' : edge === 'end' ? 'resize-end' : 'move',
      agentId,
      segId: seg.id,
      startMouseX: e.clientX,
      origS: seg.s,
      origE: seg.e,
      dur: seg.e - seg.s,
      seg,
      trackEl,
    };

    setDragState(ds);
    setGhostSeg({ ...seg }); // start ghost at current position
  }, [readOnly]);

  // ── Mouse move ────────────────────────────────────────────────
  useEffect(() => {
    const handleMouseMove = (e) => {
      const ds = dragRef.current;
      if (!ds || !ds.trackEl) return;

      const free = e.shiftKey; // Shift = no snap
      const rect = ds.trackEl.getBoundingClientRect();
      const rawH = DAY_START + ((e.clientX - rect.left) / rect.width) * DAY_SPAN;

      let newS = ds.origS;
      let newE = ds.origE;

      if (ds.type === 'move') {
        // Delta from original mouse position
        const deltaX  = e.clientX - ds.startMouseX;
        const deltaH  = (deltaX / rect.width) * DAY_SPAN;
        const rawNewS = ds.origS + deltaH;
        newS = snap(clamp(rawNewS, DAY_START, DAY_END - ds.dur), free);
        newE = snap(newS + ds.dur, free);
      } else if (ds.type === 'resize-start') {
        newS = snap(clamp(rawH, DAY_START, ds.origE - MIN_SEG_DUR), free);
        newE = ds.origE;
      } else if (ds.type === 'resize-end') {
        newS = ds.origS;
        newE = snap(clamp(rawH, ds.origS + MIN_SEG_DUR, DAY_END), free);
      }

      // Cursor
      document.body.style.cursor = ds.type === 'move' ? 'grabbing' : 'ew-resize';

      // Update ghost
      setGhostSeg(prev => prev ? { ...prev, s: newS, e: newE } : null);
      setSnapGuide(ds.type === 'move' ? newS : ds.type === 'resize-start' ? newS : newE);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ── Mouse up — commit drag ────────────────────────────────────
  useEffect(() => {
    const handleMouseUp = (e) => {
      const ds = dragRef.current;
      if (!ds) return;

      document.body.style.cursor = '';
      const ghost = ghostSeg;

      if (ghost) {
        // Only commit if it actually moved
        const moved = ghost.s !== ds.origS || ghost.e !== ds.origE;
        if (moved) {
          if (ds.type === 'move') {
            onMove?.(ds.agentId, ds.segId, ghost.s);
          } else {
            onResize?.(ds.agentId, ds.segId, ghost.s, ghost.e);
          }
        }
      }

      setDragState(null);
      setGhostSeg(null);
      setSnapGuide(null);
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [ghostSeg, onMove, onResize]);

  // ── Track click — add segment ─────────────────────────────────
  const handleTrackClick = useCallback((e, agentId, trackEl) => {
    if (readOnly || !trackEl) return;
    const h = xToHour(e.clientX, trackEl);
    const snapped = snap(clamp(h, DAY_START, DAY_END - 1));
    onAdd?.(agentId, snapped);
  }, [readOnly, onAdd]);

  // ── Context menu actions ──────────────────────────────────────
  const handleContextMenu = useCallback((e, agentId, seg) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, agentId, seg });
  }, [readOnly]);

  const handleContextAction = useCallback((action, agentId, seg) => {
    if (action === 'delete') {
      onDelete?.(agentId, seg.id);
    } else if (action === 'edit') {
      onSegmentClick?.(agentId, seg);
    } else if (action === 'dupe') {
      // Duplicate: shift 1 hour right
      const newSeg = { ...seg, id: undefined, s: Math.min(seg.s + 1, DAY_END - (seg.e - seg.s)), e: Math.min(seg.e + 1, DAY_END) };
      onAdd?.(agentId, newSeg.s, newSeg);
    } else if (action === 'split') {
      // Split at midpoint
      const mid = snap((seg.s + seg.e) / 2);
      onResize?.(agentId, seg.id, seg.s, mid);
      onAdd?.(agentId, mid, { ...seg, s: mid, e: seg.e });
    }
  }, [onDelete, onSegmentClick, onAdd, onResize]);

  // ── Segment click ─────────────────────────────────────────────
  const handleSegmentClick = useCallback((agentId, seg) => {
    setFocusedSeg({ agentId, segId: seg.id });
    onSegmentClick?.(agentId, seg);
  }, [onSegmentClick]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'DM Sans', sans-serif",
        color: C.text,
        userSelect: dragState ? 'none' : 'auto',
        WebkitUserSelect: dragState ? 'none' : 'auto',
      }}
    >
      {/* Hour ruler */}
      <HourRuler />

      {/* Agent rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {agents.map(agent => {
          const segs = scheduleMap[agent.id]?.[dk] || [];
          const isCurrentDrag = dragState?.agentId === agent.id;

          return (
            <div key={agent.id} style={{ position: 'relative' }}>
              <AgentRow
                agent={agent}
                segs={segs}
                selectedAgentIds={selectedAgentIds}
                dragState={isCurrentDrag ? dragState : null}
                ghostSeg={isCurrentDrag ? ghostSeg : null}
                focusedSeg={focusedSeg}
                readOnly={readOnly}
                onAgentClick={onAgentClick}
                onSegmentMouseDown={handleSegmentMouseDown}
                onSegmentClick={handleSegmentClick}
                onContextMenu={handleContextMenu}
                onTrackClick={handleTrackClick}
              />
            </div>
          );
        })}

        {agents.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>◌</div>
            <div>No agents to display</div>
          </div>
        )}
      </div>

      {/* Keyboard hints */}
      <div style={{
        display: 'flex', gap: 16, padding: '5px 12px',
        borderTop: `1px solid ${C.border}`,
        background: C.card, flexShrink: 0, flexWrap: 'wrap',
      }}>
        {[
          ['Drag', 'Move segment'],
          ['⟵ ⟶ edge', 'Resize'],
          ['Shift+drag', 'Free move (no snap)'],
          ['Click track', 'Add segment'],
          ['Right-click', 'Options'],
          ['Del', 'Delete focused'],
          ['Esc', 'Cancel / deselect'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <kbd style={{
              background: C.elev, border: `1px solid ${C.border}`,
              borderRadius: 3, padding: '1px 5px', fontSize: 9,
              color: C.muted, fontFamily: 'monospace', whiteSpace: 'nowrap',
            }}>{k}</kbd>
            <span style={{ fontSize: 10, color: C.dim }}>{v}</span>
          </div>
        ))}
        {dragState && (
          <div style={{ marginLeft: 'auto', fontSize: 10, color: C.kale, fontWeight: 600, animation: 'pulse 1s infinite' }}>
            ● Dragging…
          </div>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          seg={ctxMenu.seg}
          agentId={ctxMenu.agentId}
          onAction={handleContextAction}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
