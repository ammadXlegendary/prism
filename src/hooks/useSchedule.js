/**
 * Prism by Gusto — useSchedule
 * ─────────────────────────────────────────────
 * Central state hook for the scheduling ecosystem.
 * Drop into: src/hooks/useSchedule.js
 *
 * Manages: agents, segments, undo/redo, multi-select,
 *          drag state, publish flow, clipboard, filters.
 *
 * All schedule mutations go through this hook.
 * Child components receive slices of state + action callbacks.
 */

import { useReducer, useMemo } from 'react';

// ── HELPERS (inline so hook is self-contained) ────────────────

const uid = () => Math.random().toString(36).slice(2, 9);
const snap = (h) => Math.round(h * 4) / 4; // 15-min snap
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const overlaps = (a, b) =>
  a.s < b.e && b.s < a.e && a.id !== b.id;

const hasConflict = (segs, seg) =>
  segs.some((s) => overlaps(s, seg));

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // Monday
  return d;
};

const dateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// ── CONSTANTS ─────────────────────────────────────────────────

export const VIEW = { DAY: 'day', WEEK: 'week', PERIOD: 'period' };

export const PUBLISH = {
  DRAFT: 'draft',
  REVIEW: 'review',
  PUBLISHED: 'published',
};

const HISTORY_LIMIT = 60;

// ── INITIAL STATE ─────────────────────────────────────────────

const buildInitialState = (agents, date) => ({
  // Schedule data: agentId → dateKey → Segment[]
  // Segments: { id, a, s, e, c, locked? }
  // a=activity label, s=start decimal hour, e=end decimal hour, c=hex color
  scheduleMap: buildScheduleMap(agents, date && dateKey(date)),

  // Undo/redo
  history: { past: [], future: [] },

  // View
  viewMode: VIEW.DAY,
  selectedDate: date || new Date(),
  weekStart: startOfWeek(date || new Date()),

  // Selection
  selectedAgentIds: new Set(),
  lastSelectedId: null,

  // Clipboard (copy/paste segments)
  clipboard: null, // { segments: Segment[], sourceAgentId }

  // Publish
  publishState: PUBLISH.DRAFT,
  publishNote: '',
  publishHistory: [],

  // Filters
  filterPillar: null,
  filterSearch: '',

  // Drag (managed externally in GanttView but coordinated here)
  activeDragAgentId: null,
  activeDragSegId: null,
});

// Convert agents array to a map: agentId → dateKey → Segment[]
// Agents from v0.9 store segs directly on agent (single-day view).
// For multi-day we index by date. Default to initial view date (or today) for existing segs.
// Segments may use sh/eh (Prism) or s/e (Foundation).
function buildScheduleMap(agents, fallbackDateKey) {
  const map = {};
  const today = fallbackDateKey || dateKey(new Date());
  for (const agent of agents) {
    map[agent.id] = {};
    if (agent.segs?.length) {
      const dk = agent.schedDate || today;
      map[agent.id][dk] = agent.segs.map((s) => {
        const s0 = s.s != null ? s.s : s.sh;
        const e0 = s.e != null ? s.e : s.eh;
        return { ...s, s: s0, e: e0, id: s.id || uid() };
      });
    }
  }
  return map;
}

// ── REDUCER ───────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {

    // ── Segment mutations ───────────────────────────────────

    case 'MOVE_SEGMENT': {
      const { agentId, segId, newStart, date } = action;
      const dk = date || dateKey(state.selectedDate);
      const segs = (state.scheduleMap[agentId]?.[dk] || []);
      const seg = segs.find((s) => s.id === segId);
      if (!seg) return state;
      const dur = seg.e - seg.s;
      const ns = snap(clamp(newStart, 0, 24 - dur));
      const ne = snap(ns + dur);
      const updated = segs.map((s) =>
        s.id === segId ? { ...s, s: ns, e: ne } : s
      );
      return pushHistory(setSegs(state, agentId, dk, updated));
    }

    case 'RESIZE_SEGMENT': {
      const { agentId, segId, newStart, newEnd, date } = action;
      const dk = date || dateKey(state.selectedDate);
      const segs = (state.scheduleMap[agentId]?.[dk] || []);
      const ns = snap(clamp(newStart ?? segs.find(s=>s.id===segId)?.s ?? 0, 0, 23.75));
      const ne = snap(clamp(newEnd   ?? segs.find(s=>s.id===segId)?.e ?? 0, ns + 0.25, 24));
      const updated = segs.map((s) =>
        s.id === segId ? { ...s, s: ns, e: ne } : s
      );
      return pushHistory(setSegs(state, agentId, dk, updated));
    }

    case 'ADD_SEGMENT': {
      const { agentId, seg, date } = action;
      const dk = date || dateKey(state.selectedDate);
      const segs = state.scheduleMap[agentId]?.[dk] || [];
      const newSeg = { ...seg, id: seg.id || uid() };
      return pushHistory(setSegs(state, agentId, dk, [...segs, newSeg]));
    }

    case 'DELETE_SEGMENT': {
      const { agentId, segId, date } = action;
      const dk = date || dateKey(state.selectedDate);
      const segs = (state.scheduleMap[agentId]?.[dk] || []).filter(
        (s) => s.id !== segId
      );
      return pushHistory(setSegs(state, agentId, dk, segs));
    }

    case 'UPDATE_SEGMENT': {
      const { agentId, segId, patch, date } = action;
      const dk = date || dateKey(state.selectedDate);
      const segs = (state.scheduleMap[agentId]?.[dk] || []).map((s) =>
        s.id === segId ? { ...s, ...patch } : s
      );
      return pushHistory(setSegs(state, agentId, dk, segs));
    }

    // ── Bulk operations ──────────────────────────────────────

    case 'BULK_ADD': {
      const { agentIds, seg, date, skipConflicts } = action;
      const dk = date || dateKey(state.selectedDate);
      let next = { ...state.scheduleMap };
      for (const agentId of agentIds) {
        const segs = next[agentId]?.[dk] || [];
        const newSeg = { ...seg, id: uid() };
        if (skipConflicts && hasConflict(segs, newSeg)) continue;
        next[agentId] = {
          ...(next[agentId] || {}),
          [dk]: [...segs, newSeg],
        };
      }
      return pushHistory({ ...state, scheduleMap: next });
    }

    case 'BULK_DELETE_ACTIVITY': {
      const { agentIds, activityLabel, date } = action;
      const dk = date || dateKey(state.selectedDate);
      let next = { ...state.scheduleMap };
      for (const agentId of agentIds) {
        const segs = (next[agentId]?.[dk] || []).filter(
          (s) => s.a !== activityLabel
        );
        next[agentId] = { ...(next[agentId] || {}), [dk]: segs };
      }
      return pushHistory({ ...state, scheduleMap: next });
    }

    case 'COPY_DAY': {
      const { sourceAgentId, targetAgentIds, sourceDate, targetDate } = action;
      const sdk = sourceDate || dateKey(state.selectedDate);
      const tdk = targetDate || dateKey(state.selectedDate);
      const sourceSegs = state.scheduleMap[sourceAgentId]?.[sdk] || [];
      let next = { ...state.scheduleMap };
      for (const agentId of targetAgentIds) {
        next[agentId] = {
          ...(next[agentId] || {}),
          [tdk]: sourceSegs.map((s) => ({ ...s, id: uid() })),
        };
      }
      return pushHistory({ ...state, scheduleMap: next });
    }

    case 'GENERATE_ALL': {
      const { segsMap, dk } = action;
      const next = { ...state, scheduleMap: { ...state.scheduleMap } };
      for (const [agentId, segs] of Object.entries(segsMap)) {
        next.scheduleMap[agentId] = {
          ...(next.scheduleMap[agentId] || {}),
          [dk]: segs.map(s => ({ ...s, id: s.id || uid() })),
        };
      }
      return pushHistory(next);
    }

    // ── Clipboard ────────────────────────────────────────────

    case 'COPY_SEGMENTS': {
      const { agentId, segIds, date } = action;
      const dk = date || dateKey(state.selectedDate);
      const segs = (state.scheduleMap[agentId]?.[dk] || []).filter(
        (s) => segIds.includes(s.id)
      );
      return { ...state, clipboard: { segments: segs, sourceAgentId: agentId } };
    }

    case 'PASTE_SEGMENTS': {
      const { agentId, date } = action;
      if (!state.clipboard) return state;
      const dk = date || dateKey(state.selectedDate);
      const segs = state.scheduleMap[agentId]?.[dk] || [];
      const pasted = state.clipboard.segments.map((s) => ({ ...s, id: uid() }));
      return pushHistory(setSegs(state, agentId, dk, [...segs, ...pasted]));
    }

    // ── History ──────────────────────────────────────────────

    case 'UNDO': {
      if (!state.history.past.length) return state;
      const past = [...state.history.past];
      const scheduleMap = past.pop();
      return {
        ...state,
        scheduleMap,
        history: { past, future: [state.scheduleMap, ...state.history.future] },
      };
    }

    case 'REDO': {
      if (!state.history.future.length) return state;
      const future = [...state.history.future];
      const scheduleMap = future.shift();
      return {
        ...state,
        scheduleMap,
        history: { past: [...state.history.past, state.scheduleMap], future },
      };
    }

    // ── View ─────────────────────────────────────────────────

    case 'SET_VIEW': {
      return { ...state, viewMode: action.viewMode };
    }

    case 'SET_DATE': {
      const d = action.date instanceof Date ? action.date : new Date(action.date);
      return {
        ...state,
        selectedDate: d,
        weekStart: startOfWeek(d),
      };
    }

    case 'STEP_DATE': {
      const unit = state.viewMode === VIEW.WEEK ? 7 : 1;
      const d = addDays(state.selectedDate, action.n * unit);
      return {
        ...state,
        selectedDate: d,
        weekStart: startOfWeek(d),
      };
    }

    case 'GO_TODAY': {
      const today = new Date();
      return { ...state, selectedDate: today, weekStart: startOfWeek(today) };
    }

    // ── Selection ────────────────────────────────────────────

    case 'SELECT_AGENT': {
      const { agentId, multi, range, agents } = action;
      let next = new Set(state.selectedAgentIds);

      if (range && state.lastSelectedId && agents) {
        // Shift+click: select range between lastSelected and agentId
        const ids = agents.map((a) => a.id);
        const a = ids.indexOf(state.lastSelectedId);
        const b = ids.indexOf(agentId);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        ids.slice(lo, hi + 1).forEach((id) => next.add(id));
      } else if (multi) {
        if (next.has(agentId)) next.delete(agentId);
        else next.add(agentId);
      } else {
        next = next.has(agentId) && next.size === 1
          ? new Set()
          : new Set([agentId]);
      }

      return { ...state, selectedAgentIds: next, lastSelectedId: agentId };
    }

    case 'SELECT_ALL': {
      const ids = (action.agents || []).map((a) => a.id);
      return { ...state, selectedAgentIds: new Set(ids) };
    }

    case 'CLEAR_SELECTION': {
      return { ...state, selectedAgentIds: new Set(), lastSelectedId: null };
    }

    // ── Publish ──────────────────────────────────────────────

    case 'SET_PUBLISH_STATE': {
      const { publishState, publishedBy } = action;
      let publishHistory = [...state.publishHistory];
      if (publishState === PUBLISH.PUBLISHED) {
        publishHistory = [
          {
            id: uid(),
            publishedAt: new Date().toISOString(),
            publishedBy: publishedBy || 'WFM',
            note: state.publishNote,
            agentCount: Object.keys(state.scheduleMap).length,
            week: dateKey(state.weekStart),
          },
          ...publishHistory,
        ].slice(0, 20);
      }
      return { ...state, publishState, publishHistory };
    }

    case 'SET_PUBLISH_NOTE': {
      return { ...state, publishNote: action.note };
    }

    // ── Filters ──────────────────────────────────────────────

    case 'SET_FILTER_PILLAR': {
      return { ...state, filterPillar: action.pillar };
    }

    case 'SET_FILTER_SEARCH': {
      return { ...state, filterSearch: action.search };
    }

    // ── Drag coordination ────────────────────────────────────

    case 'SET_ACTIVE_DRAG': {
      return {
        ...state,
        activeDragAgentId: action.agentId,
        activeDragSegId: action.segId,
      };
    }

    case 'CLEAR_ACTIVE_DRAG': {
      return { ...state, activeDragAgentId: null, activeDragSegId: null };
    }

    default:
      return state;
  }
}

// ── PURE HELPERS ──────────────────────────────────────────────

function setSegs(state, agentId, dk, segs) {
  return {
    ...state,
    scheduleMap: {
      ...state.scheduleMap,
      [agentId]: {
        ...(state.scheduleMap[agentId] || {}),
        [dk]: segs,
      },
    },
  };
}

function pushHistory(state) {
  const past = [...state.history.past, state.scheduleMap].slice(-HISTORY_LIMIT);
  return {
    ...state,
    history: { past, future: [] },
  };
}

// ── HOOK ──────────────────────────────────────────────────────

/**
 * useSchedule(agents, options)
 *
 * @param {Array}  agents  - Agent array from roster (with id, n, pillar, pe, segs)
 * @param {Object} options - { initialDate, viewMode }
 *
 * Returns: { state, actions, derived }
 */
export function useSchedule(agents = [], options = {}) {
  const [state, dispatch] = useReducer(
    reducer,
    null,
    () => buildInitialState(agents, options.initialDate)
  );

  // ── ACTIONS ───────────────────────────────────────────────

  const actions = useMemo(() => ({
    // Segment mutations
    moveSegment:   (agentId, segId, newStart, date) =>
      dispatch({ type: 'MOVE_SEGMENT', agentId, segId, newStart, date }),
    resizeSegment: (agentId, segId, newStart, newEnd, date) =>
      dispatch({ type: 'RESIZE_SEGMENT', agentId, segId, newStart, newEnd, date }),
    addSegment:    (agentId, seg, date) =>
      dispatch({ type: 'ADD_SEGMENT', agentId, seg, date }),
    deleteSegment: (agentId, segId, date) =>
      dispatch({ type: 'DELETE_SEGMENT', agentId, segId, date }),
    updateSegment: (agentId, segId, patch, date) =>
      dispatch({ type: 'UPDATE_SEGMENT', agentId, segId, patch, date }),

    // Bulk
    bulkAdd:            (agentIds, seg, date, skipConflicts = true) =>
      dispatch({ type: 'BULK_ADD', agentIds, seg, date, skipConflicts }),
    bulkDeleteActivity: (agentIds, activityLabel, date) =>
      dispatch({ type: 'BULK_DELETE_ACTIVITY', agentIds, activityLabel, date }),
    copyDay:            (sourceAgentId, targetAgentIds, sourceDate, targetDate) =>
      dispatch({ type: 'COPY_DAY', sourceAgentId, targetAgentIds, sourceDate, targetDate }),
    generateSchedules:  (segsMap, dk) =>
      dispatch({ type: 'GENERATE_ALL', segsMap, dk }),

    // Clipboard
    copySegments:  (agentId, segIds, date) =>
      dispatch({ type: 'COPY_SEGMENTS', agentId, segIds, date }),
    pasteSegments: (agentId, date) =>
      dispatch({ type: 'PASTE_SEGMENTS', agentId, date }),

    // History
    undo: () => dispatch({ type: 'UNDO' }),
    redo: () => dispatch({ type: 'REDO' }),

    // View
    setView:   (viewMode) => dispatch({ type: 'SET_VIEW', viewMode }),
    setDate:   (date)     => dispatch({ type: 'SET_DATE', date }),
    stepDate:  (n)        => dispatch({ type: 'STEP_DATE', n }),
    goToday:   ()         => dispatch({ type: 'GO_TODAY' }),

    // Selection
    selectAgent:    (agentId, multi, range, agentsList) =>
      dispatch({ type: 'SELECT_AGENT', agentId, multi, range, agents: agentsList }),
    selectAll:      (agentsList) =>
      dispatch({ type: 'SELECT_ALL', agents: agentsList }),
    clearSelection: () => dispatch({ type: 'CLEAR_SELECTION' }),

    // Publish
    setPublishState: (publishState, publishedBy) =>
      dispatch({ type: 'SET_PUBLISH_STATE', publishState, publishedBy }),
    setPublishNote:  (note) => dispatch({ type: 'SET_PUBLISH_NOTE', note }),

    // Filters
    setFilterPillar: (pillar) => dispatch({ type: 'SET_FILTER_PILLAR', pillar }),
    setFilterSearch: (search) => dispatch({ type: 'SET_FILTER_SEARCH', search }),

    // Drag coordination
    setActiveDrag:   (agentId, segId) =>
      dispatch({ type: 'SET_ACTIVE_DRAG', agentId, segId }),
    clearActiveDrag: () => dispatch({ type: 'CLEAR_ACTIVE_DRAG' }),
  }), []);

  // ── DERIVED / COMPUTED ────────────────────────────────────

  const derived = useMemo(() => {
    const dk = dateKey(state.selectedDate);

    // Get segments for an agent on a date
    const getSegs = (agentId, date) => {
      const key = date ? dateKey(date) : dk;
      return state.scheduleMap[agentId]?.[key] || [];
    };

    // Get segments for current date
    const getDaySegs = (agentId) => getSegs(agentId, null);

    // Coverage profile: for each 15-min slot in a day, how many agents are active
    const buildCoverage = (agentIds, date) => {
      const key = date ? dateKey(date) : dk;
      const slots = {};
      for (let h = 0; h < 24; h += 0.25) {
        const slot = Math.round(h * 100) / 100;
        slots[slot] = 0;
      }
      for (const agentId of agentIds) {
        const segs = state.scheduleMap[agentId]?.[key] || [];
        for (const seg of segs) {
          if (seg.a === 'Break' || seg.a === 'Lunch' || seg.a === 'Off') continue;
          for (let h = seg.s; h < seg.e; h = Math.round((h + 0.25) * 100) / 100) {
            if (slots[h] !== undefined) slots[h]++;
          }
        }
      }
      return slots;
    };

    // Check if agent has a schedule for the given date
    const hasSchedule = (agentId, date) => {
      const key = date ? dateKey(date) : dk;
      return (state.scheduleMap[agentId]?.[key]?.length || 0) > 0;
    };

    // Total scheduled hours for an agent on a date
    const scheduledHours = (agentId, date) => {
      const segs = getSegs(agentId, date);
      return segs.reduce((sum, s) => sum + (s.e - s.s), 0);
    };

    // Productive hours (excluding break/lunch)
    const productiveHours = (agentId, date) => {
      const segs = getSegs(agentId, date);
      return segs
        .filter((s) => !['Break', 'Lunch'].includes(s.a))
        .reduce((sum, s) => sum + (s.e - s.s), 0);
    };

    // Current activity for an agent (based on current time)
    const currentActivity = (agentId) => {
      const now = new Date();
      const h = now.getHours() + now.getMinutes() / 60;
      const segs = getDaySegs(agentId);
      return segs.find((s) => s.s <= h && h < s.e) || null;
    };

    // Adherence status
    const adherenceStatus = (agentId) => {
      const act = currentActivity(agentId);
      if (!act) return 'off';
      if (['Break', 'Lunch'].includes(act.a)) return 'break';
      if (act.a.toLowerCase().includes('meeting')) return 'meeting';
      return 'active';
    };

    // Conflict check
    const conflicts = (agentId, date) => {
      const segs = getSegs(agentId, date);
      const found = [];
      for (let i = 0; i < segs.length; i++) {
        for (let j = i + 1; j < segs.length; j++) {
          if (overlaps(segs[i], segs[j])) found.push([segs[i].id, segs[j].id]);
        }
      }
      return found;
    };

    // History flags
    const canUndo = state.history.past.length > 0;
    const canRedo  = state.history.future.length > 0;

    return {
      dk,
      getSegs,
      getDaySegs,
      buildCoverage,
      hasSchedule,
      scheduledHours,
      productiveHours,
      currentActivity,
      adherenceStatus,
      conflicts,
      canUndo,
      canRedo,
    };
  }, [state]);

  return { state, actions, derived };
}
