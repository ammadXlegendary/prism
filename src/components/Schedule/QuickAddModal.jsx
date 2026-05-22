/**
 * Prism by Gusto — QuickAddModal
 * ─────────────────────────────────────────────
 * Small floating modal that appears when a user
 * clicks empty track space or right-clicks to add.
 *
 * Drop into: src/components/Schedule/QuickAddModal.jsx
 *
 * Props:
 *   agentId    string
 *   agentName  string
 *   startHour  decimal hour (pre-filled from click position)
 *   onAdd      ({ agentId, seg }) => void
 *   onClose    () => void
 *   anchorX    pixel x of anchor (for positioning)
 *   anchorY    pixel y of anchor
 */

import { useState, useEffect, useRef } from 'react';

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

// Common activities with colors (top 10 most-used for quick access)
const QUICK_ACTIVITIES = [
  { label: 'Phone',                 color: '#0A8080',  emoji: '📞' },
  { label: 'Email',                 color: '#3B82F6',  emoji: '✉' },
  { label: 'Chat/Email',            color: '#06B6D4',  emoji: '💬' },
  { label: 'Break',                 color: '#6B7280',  emoji: '☕' },
  { label: 'Lunch',                 color: '#9CA3AF',  emoji: '🥗' },
  { label: 'Meeting',               color: '#7F77DD',  emoji: '📅' },
  { label: '1x1 Meeting',           color: '#8B5CF6',  emoji: '👥' },
  { label: 'Gustie Guide Training', color: '#EF9F27',  emoji: '📚' },
  { label: 'PTO',                   color: '#0AC8A0',  emoji: '🌴' },
  { label: 'Admin',                 color: '#374151',  emoji: '📋' },
];

const DURATIONS = [
  { label: '15m',  hours: 0.25 },
  { label: '30m',  hours: 0.5  },
  { label: '1h',   hours: 1    },
  { label: '2h',   hours: 2    },
  { label: '4h',   hours: 4    },
  { label: '8h',   hours: 8    },
];

const fmtH = (h) => {
  if (h == null || isNaN(h)) return '--';
  const hh = Math.floor(h);
  const mm  = Math.round((h - hh) * 60);
  const ap  = hh < 12 ? 'am' : 'pm';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${mm.toString().padStart(2, '0')}${ap}`;
};

const snap = (h) => Math.round(h * 4) / 4;
const uid  = () => Math.random().toString(36).slice(2, 9);

export default function QuickAddModal({
  agentId,
  agentName,
  startHour = 9,
  onAdd,
  onClose,
  anchorX = 400,
  anchorY = 200,
}) {
  const ref = useRef(null);
  const [selected, setSelected] = useState(0);       // activity index
  const [durIdx,   setDurIdx]   = useState(2);        // duration index (default 1h)
  const [customS,  setCustomS]  = useState(snap(startHour));
  const [customE,  setCustomE]  = useState(snap(startHour + 1));
  const [customMode, setCustomMode] = useState(false);

  const activity = QUICK_ACTIVITIES[selected];
  const startH   = customMode ? customS : snap(startHour);
  const endH     = customMode ? customE : snap(startHour + DURATIONS[durIdx].hours);

  // Close on outside click or Esc
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const keyHandler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') handleAdd();
    };
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', keyHandler);
    };
  }, [selected, durIdx, customS, customE, customMode]);

  // Position: clamp to viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const W  = 280;
  const H  = 320;
  const left = Math.min(anchorX, vw - W - 12);
  const top  = anchorY + 8 + H > vh ? anchorY - H - 8 : anchorY + 8;

  const handleAdd = () => {
    onAdd({
      agentId,
      seg: {
        id: uid(),
        a: activity.label,
        c: activity.color,
        s: startH,
        e: endH,
      }
    });
    onClose();
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left,
        top,
        width: W,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        zIndex: 9999,
        overflow: 'hidden',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{
        padding: '10px 12px 8px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Add segment</div>
          <div style={{ fontSize: 10, color: C.muted }}>
            {agentName} · {fmtH(startH)}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16 }}>×</button>
      </div>

      <div style={{ padding: '10px 12px' }}>
        {/* Activity quick pick */}
        <div style={{ fontSize: 9, color: C.dim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activity</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
          {QUICK_ACTIVITIES.map((a, i) => (
            <button
              key={a.label}
              onClick={() => setSelected(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 8px', borderRadius: 4,
                background: selected === i ? `${a.color}22` : C.elev,
                border: `1px solid ${selected === i ? a.color : C.border}`,
                color: selected === i ? a.color : C.muted,
                cursor: 'pointer', fontSize: 10, fontWeight: selected === i ? 600 : 400,
                transition: 'all 80ms',
              }}
            >
              <span style={{ fontSize: 11 }}>{a.emoji}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Duration / time */}
        {!customMode ? (
          <>
            <div style={{ fontSize: 9, color: C.dim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {DURATIONS.map((d, i) => (
                <button
                  key={d.label}
                  onClick={() => setDurIdx(i)}
                  style={{
                    flex: 1, padding: '4px 0', borderRadius: 4,
                    background: durIdx === i ? C.kale : C.elev,
                    border: `1px solid ${durIdx === i ? C.kale : C.border}`,
                    color: durIdx === i ? '#fff' : C.muted,
                    cursor: 'pointer', fontSize: 10, fontWeight: durIdx === i ? 600 : 400,
                  }}
                >{d.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textAlign: 'center' }}>
              {fmtH(startH)} → {fmtH(endH)}
              <button onClick={() => { setCustomS(startH); setCustomE(endH); setCustomMode(true); }}
                style={{ marginLeft: 8, background: 'none', border: 'none', color: C.kale, cursor: 'pointer', fontSize: 10 }}>
                Custom
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: C.dim, marginBottom: 4 }}>START</div>
                <input
                  type="number" step="0.25" min={7} max={20}
                  value={customS}
                  onChange={e => setCustomS(snap(+e.target.value))}
                  style={{ width: '100%', background: C.elev, border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 8px', color: C.text, fontSize: 11 }}
                />
                <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{fmtH(customS)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: C.dim, marginBottom: 4 }}>END</div>
                <input
                  type="number" step="0.25" min={customS + 0.25} max={20}
                  value={customE}
                  onChange={e => setCustomE(snap(+e.target.value))}
                  style={{ width: '100%', background: C.elev, border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 8px', color: C.text, fontSize: 11 }}
                />
                <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{fmtH(customE)}</div>
              </div>
            </div>
            <button onClick={() => setCustomMode(false)} style={{ background: 'none', border: 'none', color: C.kale, cursor: 'pointer', fontSize: 10, marginBottom: 4 }}>← Back to quick</button>
          </>
        )}

        {/* Preview bar */}
        <div style={{
          height: 12, borderRadius: 6, background: C.elev,
          position: 'relative', overflow: 'hidden', marginBottom: 10,
        }}>
          <div style={{
            position: 'absolute',
            left: `${((startH - 7) / 13) * 100}%`,
            width: `${((endH - startH) / 13) * 100}%`,
            top: 1, bottom: 1,
            background: activity.color,
            borderRadius: 4,
            transition: 'all 150ms',
          }} />
        </div>

        {/* Add button */}
        <button
          onClick={handleAdd}
          disabled={endH <= startH}
          style={{
            width: '100%', padding: '8px', borderRadius: 4,
            background: activity.color,
            border: 'none', color: '#fff',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            opacity: endH <= startH ? 0.5 : 1,
          }}
        >
          Add {activity.label} · {fmtH(startH)}–{fmtH(endH)}
        </button>
        <div style={{ textAlign: 'center', fontSize: 9, color: C.dim, marginTop: 6 }}>Enter to confirm · Esc to cancel</div>
      </div>
    </div>
  );
}
