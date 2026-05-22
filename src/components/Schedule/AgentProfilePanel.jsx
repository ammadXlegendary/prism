/**
 * Prism by Gusto — AgentProfilePanel
 * ─────────────────────────────────────────────
 * Full agent profile: personal info, assigned work pattern,
 * skill proficiencies, ClearCast group assignments,
 * performance summary, and schedule notes.
 *
 * Drop into: src/components/Schedule/AgentProfilePanel.jsx
 *
 * Props:
 *   agent         - agent object from roster
 *   patterns      - all work patterns (for assignment)
 *   onAssignPattern - (agentId, patternId) => void
 *   onUpdateSkills  - (agentId, skills) => void
 *   onUpdateGroups  - (agentId, groups) => void
 *   onClose       - () => void
 */

import { useState, useMemo } from 'react';

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

// ClearCast groups (from real data)
const CLEARCAST_GROUPS = [
  'Payroll/Taxes','Benefits','Onboarding','Sales','Partner','Accountant',
  'International','Premier','Advanced Care','Consumer','Members','COBRA',
  'Multi-EIN','Cancellations','Terminations','Time & Attendance','Integrations','Chat',
];

// Skills taxonomy
const SKILLS = {
  'Channels': ['Phone','Email','Chat','Live Chat'],
  'Products': ['Payroll','Benefits','R&C','Time & Attendance','Integrations','Contractors'],
  'Specialties': ['COBRA','Multi-EIN','International','Nesting','Premier','Advanced'],
  'Systems': ['Zendesk','Salesforce','Looker','Verint','Genesys'],
};

const PROFICIENCY_LABELS = ['','Learning','Developing','Proficient','Advanced','Expert'];
const PROFICIENCY_COLORS = ['',C.dim,C.amber,'#0A8080',C.green,C.purple];

// ── ATOMS ─────────────────────────────────────────────────────
const labelSt = { fontSize: 9, color: C.dim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };
const inpSt = { background: C.elev, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px', color: C.text, fontSize: 12, outline: 'none', width: '100%', fontFamily: "'DM Sans', sans-serif" };
const btnSt = (bg, fg='#fff') => ({ background: bg, color: fg, border: 'none', borderRadius: 4, padding: '7px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer' });
const ghostSt = { background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 4, padding: '7px 12px', fontSize: 11, cursor: 'pointer' };

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || C.text, fontFamily: "'Cormorant Garamond', serif" }}>{value}</div>
      <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── PROFICIENCY SELECTOR ──────────────────────────────────────
function ProficiencyPicker({ value = 0, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1,2,3,4,5].map(lvl => (
        <button
          key={lvl}
          onClick={() => onChange(lvl === value ? 0 : lvl)}
          title={PROFICIENCY_LABELS[lvl]}
          style={{
            width: 18, height: 18,
            borderRadius: 3,
            background: lvl <= value ? PROFICIENCY_COLORS[value] : C.elev,
            border: `1px solid ${lvl <= value ? PROFICIENCY_COLORS[value] : C.border}`,
            cursor: 'pointer',
            padding: 0,
            transition: 'all 100ms',
          }}
        />
      ))}
    </div>
  );
}

// ── MINI PATTERN PREVIEW ──────────────────────────────────────
function MiniPatternBar({ segments = [] }) {
  const DAY_START = 6, DAY_SPAN = 16;
  return (
    <div style={{ height: 14, background: C.elev, borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
      {segments.map(seg => {
        const left  = Math.max(0, ((seg.s - DAY_START) / DAY_SPAN) * 100);
        const width = Math.min(100 - left, ((seg.e - seg.s) / DAY_SPAN) * 100);
        if (width <= 0) return null;
        return (
          <div key={seg.id} style={{
            position: 'absolute', left: `${left}%`, width: `${width}%`,
            top: 2, bottom: 2, background: seg.c || C.kale, borderRadius: 2, opacity: 0.88,
          }} />
        );
      })}
      {segments.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 9, color: C.dim }}>No pattern</span>
        </div>
      )}
    </div>
  );
}

// ── TABS ──────────────────────────────────────────────────────
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'pattern',  label: 'Work Pattern' },
  { key: 'skills',   label: 'Skills' },
  { key: 'groups',   label: 'Groups' },
  { key: 'notes',    label: 'Notes' },
];

// ── OVERVIEW TAB ──────────────────────────────────────────────
function OverviewTab({ agent, pattern, pillarColor }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    email:    agent.email    || `${agent.n?.split(' ')[0]?.toLowerCase() || 'agent'}@gusto.com`,
    timezone: agent.timezone || 'America/Los_Angeles',
    location: agent.location || 'Remote',
    hireDate: agent.hireDate || '2023-01-01',
    phone:    agent.phone    || '',
  });

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Agent header card */}
      <div style={{ background: C.elev, borderRadius: 10, padding: '20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Avatar */}
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: `linear-gradient(135deg, ${pillarColor}44, ${pillarColor}22)`,
          border: `2px solid ${pillarColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: pillarColor,
          fontFamily: "'Cormorant Garamond', serif",
          flexShrink: 0,
        }}>
          {(agent.n || 'A').split(' ').map(w => w[0]).slice(0, 2).join('')}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", color: C.text, marginBottom: 2 }}>
            {agent.n}
          </div>
          <div style={{ fontSize: 12, color: pillarColor, fontWeight: 500, marginBottom: 4 }}>
            {agent.pillar || agent.p || 'No Pillar'}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted }}>
            <span>{agent.pe || agent.manager || 'No PE assigned'}</span>
            <span>·</span>
            <span>{form.timezone}</span>
            <span>·</span>
            <span>{form.location}</span>
          </div>
        </div>

        {/* Pattern badge */}
        {pattern && (
          <div style={{
            background: `${pattern.color}22`,
            border: `1px solid ${pattern.color}44`,
            borderRadius: 6, padding: '6px 10px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: pattern.color, fontWeight: 600 }}>{pattern.name}</div>
            <div style={{ fontSize: 9, color: C.dim }}>work pattern</div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1, background: C.border, borderRadius: 8, overflow: 'hidden',
      }}>
        {[
          ['Adherence', agent.adherence || '94%', C.green],
          ['AHT',       agent.aht       || '6.2m', C.kale],
          ['SL Contrib',agent.sl        || '92%',  C.purple],
          ['XP',        agent.xp        || '1,240', C.amber],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: C.card, padding: '14px 12px', textAlign: 'center' }}>
            <Stat label={label} value={val} color={color} />
          </div>
        ))}
      </div>

      {/* Personal info */}
      <div style={{ background: C.elev, borderRadius: 8, padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Contact & Info</div>
          <button onClick={() => setEditing(e => !e)} style={editing ? btnSt(C.kale) : ghostSt}>
            {editing ? 'Save' : 'Edit'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['Email',     'email'],
            ['Timezone',  'timezone'],
            ['Location',  'location'],
            ['Hire Date', 'hireDate'],
          ].map(([label, field]) => (
            <div key={field}>
              <div style={labelSt}>{label}</div>
              {editing ? (
                <input
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  style={inpSt}
                />
              ) : (
                <div style={{ fontSize: 12, color: C.text }}>{form[field] || '—'}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* PTO balance */}
      <div style={{ background: C.elev, borderRadius: 8, padding: '16px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 12 }}>PTO Balance</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            ['Available', agent.ptoAvail   || '8.5d', C.green],
            ['Used YTD',  agent.ptoUsed    || '3d',   C.amber],
            ['Accruing',  agent.ptoAccrual || '1.5d/mo', C.kale],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: C.card, borderRadius: 6, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'Cormorant Garamond', serif" }}>{val}</div>
              <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PATTERN TAB ───────────────────────────────────────────────
function PatternTab({ agent, pattern, patterns, onAssignPattern }) {
  const [showPicker, setShowPicker] = useState(false);
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const DAY_START = 6, DAY_SPAN = 16;

  const fmtH = (h) => {
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    const ap = hh < 12 ? 'am' : 'pm';
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    return `${h12}:${mm.toString().padStart(2,'0')}${ap}`;
  };

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Current pattern */}
      <div style={{ background: C.elev, borderRadius: 8, padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Current Work Pattern</div>
          <button onClick={() => setShowPicker(p => !p)} style={btnSt(C.kale, '#fff')}>
            Change Pattern
          </button>
        </div>

        {pattern ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: pattern.color }} />
              <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Cormorant Garamond', serif", color: C.text }}>{pattern.name}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{pattern.days.join(' · ')}</span>
            </div>
            <MiniPatternBar segments={pattern.segments} />

            {/* Segment breakdown */}
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[...pattern.segments].sort((a,b) => a.s - b.s).map(seg => (
                <div key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.c, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 11, color: C.text }}>{seg.a}</span>
                  <span style={{ fontSize: 10, color: C.muted }}>{fmtH(seg.s)} – {fmtH(seg.e)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>◈</div>
            <div style={{ fontSize: 12 }}>No pattern assigned</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>Assign a pattern to generate schedules automatically</div>
          </div>
        )}
      </div>

      {/* Pattern picker */}
      {showPicker && (
        <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
            Select a pattern to assign
          </div>
          {patterns.map(pat => (
            <div
              key={pat.id}
              onClick={() => { onAssignPattern(agent.id, pat.id); setShowPicker(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', cursor: 'pointer',
                background: pat.id === pattern?.id ? `${pat.color}18` : 'transparent',
                borderBottom: `1px solid ${C.border}`,
                transition: 'background 80ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.elev}
              onMouseLeave={e => e.currentTarget.style.background = pat.id === pattern?.id ? `${pat.color}18` : 'transparent'}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: pat.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{pat.name}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{pat.days.join(' · ')}</div>
              </div>
              <div style={{ flex: 2 }}>
                <MiniPatternBar segments={pat.segments} />
              </div>
              {pat.id === pattern?.id && <span style={{ fontSize: 10, color: pat.color, fontWeight: 600 }}>Current</span>}
            </div>
          ))}
        </div>
      )}

      {/* Week overview */}
      {pattern && (
        <div style={{ background: C.elev, borderRadius: 8, padding: '16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 12 }}>Week Schedule</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {DAYS.map(d => {
              const active = pattern.days.includes(d);
              return (
                <div key={d} style={{ flex: 1, opacity: active ? 1 : 0.3 }}>
                  <div style={{ textAlign: 'center', fontSize: 9, color: active ? pattern.color : C.dim, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>{d}</div>
                  <MiniPatternBar segments={active ? pattern.segments : []} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SKILLS TAB ────────────────────────────────────────────────
function SkillsTab({ agent, onUpdateSkills }) {
  const [skills, setSkills] = useState(agent.skills || {});
  const [dirty, setDirty]   = useState(false);

  const setSkill = (key, val) => {
    setSkills(prev => { const next = { ...prev, [key]: val }; if (val === 0) delete next[key]; return next; });
    setDirty(true);
  };

  const save = () => { onUpdateSkills?.(agent.id, skills); setDirty(false); };

  const totalSkills    = Object.keys(skills).length;
  const avgProficiency = totalSkills > 0
    ? (Object.values(skills).reduce((s, v) => s + v, 0) / totalSkills).toFixed(1)
    : 0;

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.kale, fontFamily: "'Cormorant Garamond', serif" }}>{totalSkills}</div>
            <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Skills</div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.amber, fontFamily: "'Cormorant Garamond', serif" }}>{avgProficiency}</div>
            <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg level</div>
          </div>
        </div>
        {dirty && (
          <button onClick={save} style={btnSt(C.kale)}>Save changes</button>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {PROFICIENCY_LABELS.slice(1).map((lbl, i) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: C.muted }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: PROFICIENCY_COLORS[i + 1] }} />
            {i + 1} {lbl}
          </div>
        ))}
      </div>

      {/* Skill categories */}
      {Object.entries(SKILLS).map(([category, skillList]) => (
        <div key={category} style={{ background: C.elev, borderRadius: 8, padding: '14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 10 }}>{category}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {skillList.map(skill => {
              const level = skills[skill] || 0;
              return (
                <div key={skill} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 140, fontSize: 11, color: level > 0 ? C.text : C.muted }}>
                    {skill}
                  </div>
                  <ProficiencyPicker value={level} onChange={(v) => setSkill(skill, v)} />
                  <div style={{ fontSize: 10, color: level > 0 ? PROFICIENCY_COLORS[level] : C.dim, width: 80 }}>
                    {level > 0 ? PROFICIENCY_LABELS[level] : 'Not set'}
                  </div>
                  {/* Proficiency bar */}
                  <div style={{ flex: 1, height: 4, background: C.card, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${(level / 5) * 100}%`,
                      height: '100%',
                      background: level > 0 ? PROFICIENCY_COLORS[level] : 'transparent',
                      borderRadius: 2,
                      transition: 'all 200ms',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── GROUPS TAB ────────────────────────────────────────────────
function GroupsTab({ agent, onUpdateGroups }) {
  const [groups, setGroups]   = useState(new Set(agent.groups || []));
  const [primary, setPrimary] = useState(agent.primaryGroup || null);
  const [dirty, setDirty]     = useState(false);

  const toggle = (g) => {
    setGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) { next.delete(g); if (primary === g) setPrimary(null); }
      else next.add(g);
      return next;
    });
    setDirty(true);
  };

  const save = () => { onUpdateGroups?.(agent.id, { groups: [...groups], primaryGroup: primary }); setDirty(false); };

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>ClearCast Group Assignments</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {groups.size} groups · Primary: {primary || 'none'}
          </div>
        </div>
        {dirty && <button onClick={save} style={btnSt(C.kale)}>Save changes</button>}
      </div>

      {/* Primary group selector */}
      {groups.size > 0 && (
        <div style={{ background: C.elev, borderRadius: 8, padding: '12px 14px' }}>
          <div style={labelSt}>Primary group (for routing)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {[...groups].map(g => (
              <button
                key={g}
                onClick={() => { setPrimary(g); setDirty(true); }}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 10,
                  background: primary === g ? C.kale + '22' : 'transparent',
                  border: `1px solid ${primary === g ? C.kale : C.border}`,
                  color: primary === g ? C.kale : C.muted,
                  cursor: 'pointer', fontWeight: primary === g ? 600 : 400,
                }}
              >{g}</button>
            ))}
          </div>
        </div>
      )}

      {/* Group grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {CLEARCAST_GROUPS.map(g => {
          const isIn  = groups.has(g);
          const isPri = primary === g;
          return (
            <div
              key={g}
              onClick={() => toggle(g)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                background: isIn ? `${C.kale}14` : C.elev,
                border: `1px solid ${isPri ? C.kale : isIn ? C.kale + '44' : C.border}`,
                transition: 'all 120ms',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 3,
                background: isIn ? C.kale : 'transparent',
                border: `1.5px solid ${isIn ? C.kale : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {isIn && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 11, color: isIn ? C.text : C.muted, fontWeight: isIn ? 500 : 400, flex: 1 }}>{g}</span>
              {isPri && <span style={{ fontSize: 9, color: C.kale, fontWeight: 700 }}>PRIMARY</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── NOTES TAB ─────────────────────────────────────────────────
function NotesTab({ agent }) {
  const [notes, setNotes] = useState(agent.notes || [
    { id: '1', author: 'Ammad Williams', date: '2026-04-15', text: 'Strong performer. Ready for cross-training on Premier queue.', type: 'general' },
    { id: '2', author: 'Cyndy Boerger', date: '2026-03-28', text: '1x1 complete. Working on AHT improvement. Target 5.8min.', type: 'performance' },
  ]);
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('general');

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes(prev => [{
      id: Date.now().toString(),
      author: 'Ammad Williams',
      date: new Date().toISOString().slice(0, 10),
      text: newNote,
      type: noteType,
    }, ...prev]);
    setNewNote('');
  };

  const typeColors = { general: C.kale, performance: C.amber, concern: C.guava, kudos: C.green };

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Add note */}
      <div style={{ background: C.elev, borderRadius: 8, padding: '14px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 10 }}>Add Note</div>
        <textarea
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          placeholder="Add a note about this agent..."
          style={{ ...inpSt, height: 72, resize: 'vertical', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {Object.entries(typeColors).map(([type, color]) => (
            <button
              key={type}
              onClick={() => setNoteType(type)}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 10,
                background: noteType === type ? color + '22' : 'transparent',
                border: `1px solid ${noteType === type ? color : C.border}`,
                color: noteType === type ? color : C.muted,
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >{type}</button>
          ))}
          <button onClick={addNote} disabled={!newNote.trim()} style={{ ...btnSt(C.kale), marginLeft: 'auto', fontSize: 11 }}>
            Add Note
          </button>
        </div>
      </div>

      {/* Notes list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.map(note => (
          <div key={note.id} style={{
            background: C.elev, borderRadius: 8, padding: '12px 14px',
            borderLeft: `3px solid ${typeColors[note.type] || C.kale}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: C.text }}>{note.author}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  fontSize: 9, color: typeColors[note.type], fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{note.type}</span>
                <span style={{ fontSize: 10, color: C.dim }}>{note.date}</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{note.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function AgentProfilePanel({
  agent,
  patterns = [],
  onAssignPattern,
  onUpdateSkills,
  onUpdateGroups,
  onClose,
}) {
  const [tab, setTab] = useState('overview');
  const [localPattern, setLocalPattern] = useState(
    patterns.find(p => p.id === agent?.patternId) || null
  );

  if (!agent) return null;

  const pillarColor = PILLAR_COLORS[agent.pillar || agent.p] || C.kale;

  const handleAssignPattern = (agentId, patternId) => {
    const pat = patterns.find(p => p.id === patternId);
    setLocalPattern(pat || null);
    onAssignPattern?.(agentId, patternId);
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: C.bg,
      fontFamily: "'DM Sans', sans-serif",
      color: C.text,
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '14px 24px 0',
        background: C.card,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Color stripe */}
            <div style={{ width: 4, height: 28, background: pillarColor, borderRadius: 2 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", color: C.text, lineHeight: 1.2 }}>
                {agent.n}
              </div>
              <div style={{ fontSize: 10, color: pillarColor }}>{agent.pillar || agent.p}</div>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'none', border: 'none',
                padding: '6px 14px', cursor: 'pointer',
                fontSize: 11, fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? C.text : C.muted,
                borderBottom: `2px solid ${tab === t.key ? pillarColor : 'transparent'}`,
                transition: 'all 120ms',
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'overview' && (
          <OverviewTab agent={agent} pattern={localPattern} pillarColor={pillarColor} />
        )}
        {tab === 'pattern' && (
          <PatternTab agent={agent} pattern={localPattern} patterns={patterns} onAssignPattern={handleAssignPattern} />
        )}
        {tab === 'skills' && (
          <SkillsTab agent={agent} onUpdateSkills={onUpdateSkills} />
        )}
        {tab === 'groups' && (
          <GroupsTab agent={agent} onUpdateGroups={onUpdateGroups} />
        )}
        {tab === 'notes' && (
          <NotesTab agent={agent} />
        )}
      </div>
    </div>
  );
}
