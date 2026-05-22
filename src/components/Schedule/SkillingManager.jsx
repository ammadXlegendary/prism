/**
 * Prism by Gusto — SkillingManager
 * ─────────────────────────────────────────────
 * Team-wide skill matrix with gap analysis,
 * coverage requirements, and cross-training flags.
 *
 * Drop into: src/components/Schedule/SkillingManager.jsx
 *
 * Props:
 *   agents         - agent array
 *   onUpdateSkills - (agentId, skills) => void
 *   onOpenProfile  - (agentId) => void
 */

import { useState, useMemo } from 'react';

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

// Core skills to show in the matrix
const MATRIX_SKILLS = [
  'Phone','Email','Chat','Payroll','Benefits','R&C',
  'Time & Attendance','COBRA','Multi-EIN','International','Premier','Advanced',
];

const PROFICIENCY_COLORS = ['transparent', C.dim, C.amber, C.kale, C.green, C.purple];
const PROFICIENCY_LABELS = ['—','Learning','Developing','Proficient','Advanced','Expert'];

// Minimum coverage thresholds per skill (agents needed at proficiency ≥ 3)
const COVERAGE_TARGETS = {
  'Phone': 0.80, 'Email': 0.60, 'Chat': 0.40,
  'Payroll': 0.70, 'Benefits': 0.50, 'R&C': 0.30,
  'Time & Attendance': 0.25, 'COBRA': 0.15, 'Multi-EIN': 0.15,
  'International': 0.10, 'Premier': 0.20, 'Advanced': 0.20,
};

export default function SkillingManager({ agents = [], onUpdateSkills, onOpenProfile }) {
  const [view, setView]             = useState('matrix');    // 'matrix' | 'gaps' | 'crosstraining'
  const [filterPillar, setFilterPillar] = useState(null);
  const [search, setSearch]         = useState('');
  const [editCell, setEditCell]     = useState(null);        // { agentId, skill }
  const [sortSkill, setSortSkill]   = useState(null);
  const [sortDir, setSortDir]       = useState('desc');

  const pillars = [...new Set(agents.map(a => a.pillar || a.p).filter(Boolean))];

  // Filtered + sorted agents
  const filtered = useMemo(() => {
    let list = agents.filter(a => {
      const nm = a.n?.toLowerCase() || '';
      const pl = a.pillar || a.p || '';
      return nm.includes(search.toLowerCase()) && (!filterPillar || pl === filterPillar);
    });
    if (sortSkill) {
      list = [...list].sort((a, b) => {
        const av = (a.skills || {})[sortSkill] || 0;
        const bv = (b.skills || {})[sortSkill] || 0;
        return sortDir === 'desc' ? bv - av : av - bv;
      });
    }
    return list;
  }, [agents, search, filterPillar, sortSkill, sortDir]);

  // Coverage analysis per skill
  const coverage = useMemo(() => {
    const total = filtered.length || 1;
    return Object.fromEntries(MATRIX_SKILLS.map(skill => {
      const proficient = filtered.filter(a => ((a.skills || {})[skill] || 0) >= 3).length;
      const pct = proficient / total;
      const target = COVERAGE_TARGETS[skill] || 0.5;
      return [skill, { proficient, total, pct, target, gap: Math.max(0, Math.ceil(target * total) - proficient) }];
    }));
  }, [filtered]);

  // Cross-training opportunities
  const crossTrainingOps = useMemo(() => {
    return filtered.flatMap(agent => {
      const skills = agent.skills || {};
      return MATRIX_SKILLS.filter(skill => {
        const level    = skills[skill] || 0;
        const cov      = coverage[skill];
        return level === 0 && cov.gap > 0;   // agent doesn't have it, team needs it
      }).map(skill => ({ agentId: agent.id, agentName: agent.n, skill, gap: coverage[skill].gap }));
    }).sort((a, b) => b.gap - a.gap).slice(0, 15);
  }, [filtered, coverage]);

  const handleSort = (skill) => {
    if (sortSkill === skill) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortSkill(skill); setSortDir('desc'); }
  };

  const handleCellClick = (agentId, skill) => {
    setEditCell(prev => prev?.agentId === agentId && prev?.skill === skill ? null : { agentId, skill });
  };

  const handleSetLevel = (agentId, skill, level) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    const updated = { ...(agent.skills || {}), [skill]: level };
    if (level === 0) delete updated[skill];
    onUpdateSkills?.(agentId, updated);
    setEditCell(null);
  };

  const labelSt = { fontSize: 9, color: C.dim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const inpSt = { background: C.elev, border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 8px', color: C.text, fontSize: 11, outline: 'none', fontFamily: "'DM Sans', sans-serif" };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: "'DM Sans', sans-serif", color: C.text }}>

      {/* ── Header ── */}
      <div style={{ padding: '14px 20px 10px', background: C.card, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, color: C.kale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Team Skills</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Cormorant Garamond', serif" }}>Skilling Matrix</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Coverage summary pills */}
            {Object.values(coverage).filter(c => c.gap > 0).length > 0 && (
              <div style={{
                background: `${C.guava}18`, border: `1px solid ${C.guava}44`,
                borderRadius: 6, padding: '5px 10px', fontSize: 11, color: C.guava, fontWeight: 600,
              }}>
                ⚠ {Object.values(coverage).filter(c => c.gap > 0).length} gaps
              </div>
            )}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              style={{ ...inpSt, width: 140 }}
            />
          </div>
        </div>

        {/* View tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {[
            ['matrix',        'Matrix'],
            ['gaps',          'Gap Analysis'],
            ['crosstraining', 'Cross-Training'],
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                background: 'none', border: 'none', padding: '5px 14px',
                cursor: 'pointer', fontSize: 11,
                color: view === v ? C.text : C.muted,
                fontWeight: view === v ? 600 : 400,
                borderBottom: `2px solid ${view === v ? C.kale : 'transparent'}`,
                transition: 'all 120ms',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* ── Pillar filter ── */}
      <div style={{ padding: '8px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0, background: C.card }}>
        <PillBtn active={!filterPillar} onClick={() => setFilterPillar(null)}>All ({agents.length})</PillBtn>
        {pillars.map(p => (
          <PillBtn key={p} active={filterPillar===p} color={PILLAR_COLORS[p]} onClick={() => setFilterPillar(filterPillar===p?null:p)}>
            {p.split(' ')[0]} ({agents.filter(a=>(a.pillar||a.p)===p).length})
          </PillBtn>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* MATRIX VIEW */}
        {view === 'matrix' && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
              {/* Column headers */}
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: C.card }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: C.muted, fontSize: 10, borderBottom: `2px solid ${C.border}`, minWidth: 160, whiteSpace: 'nowrap' }}>
                    Agent ({filtered.length})
                  </th>
                  {MATRIX_SKILLS.map(skill => {
                    const cov = coverage[skill];
                    const ok  = cov.gap === 0;
                    return (
                      <th
                        key={skill}
                        onClick={() => handleSort(skill)}
                        style={{
                          padding: '6px 8px', textAlign: 'center',
                          fontWeight: sortSkill === skill ? 700 : 500,
                          color: ok ? C.muted : C.guava,
                          fontSize: 9, borderBottom: `2px solid ${C.border}`,
                          cursor: 'pointer', whiteSpace: 'nowrap',
                          letterSpacing: '0.04em', textTransform: 'uppercase',
                          minWidth: 68,
                          background: sortSkill === skill ? C.elev : 'transparent',
                          transition: 'background 100ms',
                        }}
                      >
                        <div>{skill}</div>
                        {/* Coverage mini bar */}
                        <div style={{ height: 3, borderRadius: 2, background: C.border, margin: '4px 4px 2px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            width: `${Math.min(100, (cov.pct / cov.target) * 100)}%`,
                            background: cov.pct >= cov.target ? C.kale : cov.pct >= cov.target * 0.7 ? C.amber : C.guava,
                            transition: 'width 300ms',
                          }} />
                        </div>
                        <div style={{ fontSize: 8, color: ok ? C.dim : C.guava }}>
                          {cov.proficient}/{Math.ceil(cov.target * cov.total)}
                          {sortSkill === skill && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Agent rows */}
              <tbody>
                {filtered.map((agent, ri) => {
                  const pc = PILLAR_COLORS[agent.pillar || agent.p] || C.kale;
                  const skills = agent.skills || {};
                  return (
                    <tr
                      key={agent.id}
                      style={{ background: ri % 2 === 0 ? C.bg : `${C.elev}60`, borderBottom: `1px solid ${C.border}40` }}
                    >
                      {/* Agent name cell */}
                      <td style={{ padding: '6px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: pc, flexShrink: 0 }} />
                          <button
                            onClick={() => onOpenProfile?.(agent.id)}
                            style={{ background: 'none', border: 'none', color: C.text, cursor: 'pointer', fontSize: 11, fontWeight: 500, padding: 0, textAlign: 'left' }}
                          >
                            {agent.n}
                          </button>
                        </div>
                      </td>

                      {/* Skill cells */}
                      {MATRIX_SKILLS.map(skill => {
                        const level  = skills[skill] || 0;
                        const isEdit = editCell?.agentId === agent.id && editCell?.skill === skill;
                        return (
                          <td
                            key={skill}
                            onClick={() => handleCellClick(agent.id, skill)}
                            style={{
                              padding: '4px 6px', textAlign: 'center',
                              cursor: 'pointer', position: 'relative',
                            }}
                          >
                            {/* Level indicator */}
                            <div style={{
                              width: 28, height: 28, borderRadius: 4, margin: '0 auto',
                              background: level > 0 ? PROFICIENCY_COLORS[level] + '28' : C.elev,
                              border: `1px solid ${level > 0 ? PROFICIENCY_COLORS[level] + '66' : C.border}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 100ms',
                            }}>
                              {level > 0 ? (
                                <span style={{ fontSize: 11, fontWeight: 700, color: PROFICIENCY_COLORS[level] }}>{level}</span>
                              ) : (
                                <span style={{ fontSize: 9, color: C.dim }}>—</span>
                              )}
                            </div>

                            {/* Inline level picker on click */}
                            {isEdit && (
                              <div style={{
                                position: 'fixed',
                                zIndex: 9999,
                                background: C.card,
                                border: `1px solid ${C.border}`,
                                borderRadius: 8,
                                padding: '10px',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                minWidth: 160,
                              }}
                              onClick={e => e.stopPropagation()}
                              >
                                <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, fontWeight: 600 }}>
                                  {agent.n} — {skill}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {[0,1,2,3,4,5].map(lvl => (
                                    <button
                                      key={lvl}
                                      onClick={() => handleSetLevel(agent.id, skill, lvl)}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        background: lvl === level ? PROFICIENCY_COLORS[lvl] + '22' : 'none',
                                        border: `1px solid ${lvl === level ? PROFICIENCY_COLORS[lvl] : C.border}`,
                                        borderRadius: 4, padding: '5px 8px', cursor: 'pointer',
                                        color: lvl > 0 ? PROFICIENCY_COLORS[lvl] : C.dim,
                                        fontSize: 11, fontWeight: lvl === level ? 600 : 400,
                                      }}
                                    >
                                      {lvl > 0 && (
                                        <div style={{ display: 'flex', gap: 2 }}>
                                          {Array.from({ length: 5 }, (_, i) => (
                                            <div key={i} style={{ width: 6, height: 6, borderRadius: 1, background: i < lvl ? PROFICIENCY_COLORS[lvl] : C.elev }} />
                                          ))}
                                        </div>
                                      )}
                                      {lvl === 0 ? 'Not set' : `${lvl} — ${PROFICIENCY_LABELS[lvl]}`}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* GAP ANALYSIS VIEW */}
        {view === 'gaps' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {MATRIX_SKILLS.map(skill => {
                const cov    = coverage[skill];
                const target = Math.ceil(cov.target * cov.total);
                const status = cov.gap === 0 ? 'ok' : cov.gap <= 2 ? 'warn' : 'crit';
                const statusColor = { ok: C.green, warn: C.amber, crit: C.guava }[status];
                const proficientAgents = filtered
                  .filter(a => ((a.skills || {})[skill] || 0) >= 3)
                  .sort((a, b) => ((b.skills || {})[skill] || 0) - ((a.skills || {})[skill] || 0));

                return (
                  <div key={skill} style={{
                    background: C.elev, borderRadius: 8, padding: '14px',
                    border: `1px solid ${status === 'ok' ? C.border : statusColor + '44'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{skill}</div>
                      <div style={{
                        padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 700,
                        background: statusColor + '22', color: statusColor,
                      }}>
                        {status === 'ok' ? '✓ Covered' : `⚠ -${cov.gap}`}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ height: 6, background: C.card, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, (cov.proficient / target) * 100)}%`,
                          height: '100%', background: statusColor, borderRadius: 3,
                          transition: 'width 400ms',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: statusColor, fontWeight: 600 }}>{cov.proficient} proficient</span>
                        <span style={{ fontSize: 10, color: C.dim }}>target: {target}</span>
                      </div>
                    </div>

                    {/* Top skilled agents */}
                    {proficientAgents.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {proficientAgents.slice(0, 4).map(a => (
                          <button
                            key={a.id}
                            onClick={() => onOpenProfile?.(a.id)}
                            style={{
                              fontSize: 9, padding: '2px 7px', borderRadius: 20, cursor: 'pointer',
                              background: C.card, border: `1px solid ${C.border}`, color: C.muted,
                            }}
                          >
                            {a.n.split(' ')[0]} L{(a.skills || {})[skill]}
                          </button>
                        ))}
                        {proficientAgents.length > 4 && (
                          <span style={{ fontSize: 9, color: C.dim, padding: '2px 4px' }}>+{proficientAgents.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CROSS-TRAINING VIEW */}
        {view === 'crosstraining' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            <div style={{ marginBottom: 16, fontSize: 12, color: C.muted }}>
              Agents recommended for cross-training based on team skill gaps
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {crossTrainingOps.map(({ agentId, agentName, skill, gap }, i) => {
                const agent = agents.find(a => a.id === agentId);
                const pc = PILLAR_COLORS[agent?.pillar || agent?.p] || C.kale;
                return (
                  <div key={`${agentId}-${skill}`} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: C.elev, borderRadius: 8, padding: '12px 14px',
                    border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ fontSize: 14, color: C.dim, width: 24, textAlign: 'center', fontFamily: 'monospace' }}>
                      {i + 1}
                    </div>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: pc }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{agentName}</div>
                      <div style={{ fontSize: 10, color: pc }}>{agent?.pillar || agent?.p}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.amber }}>{skill}</div>
                      <div style={{ fontSize: 9, color: C.dim }}>recommended skill</div>
                    </div>
                    <div style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 10,
                      background: `${C.guava}18`, color: C.guava, fontWeight: 600,
                    }}>-{gap} agents needed</div>
                    <button
                      onClick={() => onOpenProfile?.(agentId)}
                      style={{
                        background: 'none', border: `1px solid ${C.border}`, borderRadius: 4,
                        padding: '5px 10px', fontSize: 10, color: C.muted, cursor: 'pointer',
                      }}
                    >View profile →</button>
                  </div>
                );
              })}
              {crossTrainingOps.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
                  <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>✓</div>
                  <div>No critical cross-training gaps detected.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div style={{ padding: '8px 20px', borderTop: `1px solid ${C.border}`, background: C.card, display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proficiency:</span>
        {PROFICIENCY_LABELS.slice(1).map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: PROFICIENCY_COLORS[i + 1] + '44', border: `1px solid ${PROFICIENCY_COLORS[i + 1]}` }} />
            <span style={{ fontSize: 9, color: C.muted }}>{i + 1} {label}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: C.dim }}>Click any cell to update · Click name to open profile</span>
      </div>
    </div>
  );
}

function PillBtn({ active, color, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? (color || C.kale) + '22' : 'transparent',
      border: `1px solid ${active ? (color || C.kale) : C.border}`,
      borderRadius: 20, padding: '3px 10px', fontSize: 10,
      color: active ? (color || C.kale) : C.muted,
      cursor: 'pointer', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
    }}>{children}</button>
  );
}
