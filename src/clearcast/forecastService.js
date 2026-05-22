// ClearCast Forecast Service — NICE IEX WFM live data

const NICE_PROXY_URL = 'http://localhost:8000';

export const DATA_SOURCE = {
  NICE: 'nice',
};

export const METHODOLOGY = {
  care: {
    name: 'ISO Week × YoY Trend (Top-Down)',
    description: 'Uses same ISO week from last year, adjusted by 4-week trailing YoY trend. Distributes from Pillar → CT.',
  },
  smb: {
    name: 'Weighted Rolling Average (Bottom-Up)',
    description: '4-week weighted rolling average (4-3-2-1 weighting). Direct CT-level forecasting.',
  },
  benops: {
    name: 'Top-Down + Monthly Seasonality',
    description: 'Rolling average adjusted by monthly seasonality factors.',
  },
};

let currentDataSource = DATA_SOURCE.NICE;

export function getDataSource() {
  return currentDataSource;
}

export function setDataSource(source) {
  currentDataSource = source;
}

/**
 * Fetch CT forecast and actuals from the NICE IEX WFM proxy (server/main.py),
 * then merge with CT metadata from forecastData.js (names, categories, channels, slTargets).
 *
 * Requires the proxy running: cd server && uvicorn main:app --port 8000
 */
export async function loadForecastData({ forceRefresh = false } = {}) {
  try {
    const url = forceRefresh ? `${NICE_PROXY_URL}/api/forecast/refresh` : `${NICE_PROXY_URL}/api/forecast`;
    const resp = await fetch(url, { method: forceRefresh ? 'POST' : 'GET' });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: resp.statusText }));
      throw new Error(`NICE proxy error: ${err.detail || resp.statusText}`);
    }

    const { data: niceData, lastUpdated, window: dateWindow, actualsError } = await resp.json();
    if (actualsError) console.warn('[ClearCast] Actuals unavailable:', actualsError);

    // CT metadata (names, categories, channels, slTargets) lives in forecastData.js.
    // NICE numbers overwrite the placeholder values in each CT object.
    const { forecastGroups } = await import('./forecastData.js');

    const merged = forecastGroups.map(ct => {
      const live = niceData[ct.id];
      if (!live) return ct;
      return {
        ...ct,
        forecastVolume: live.forecastVolume,
        actualVolume: live.actualVolume,
        forecastAHT: live.forecastAHT,
        actualAHT: live.actualAHT,
        weeklyForecastVolume: live.weeklyForecastVolume,
        weeklyForecastAHT: live.weeklyForecastAHT,
        weeklyTrend: live.weeklyTrend,
      };
    });

    return {
      success: true,
      source: DATA_SOURCE.NICE,
      lastUpdated,
      data: merged,
      metadata: { methodology: 'NICE IEX WFM Live Data', divisions: ['care', 'smb', 'benops'], dateWindow },
    };
  } catch (error) {
    console.error('[ForecastService] NICE load failed:', error);
    return { success: false, error: error.message, data: [] };
  }
}

export function isDataStale(lastUpdated, maxAgeDays = 1) {
  if (!lastUpdated) return true;
  const daysSince = (new Date() - new Date(lastUpdated)) / (1000 * 60 * 60 * 24);
  return daysSince > maxAgeDays;
}

export function calculateStaffing(forecastVolume, ahtMinutes, utilizationPct = 0.85) {
  const handleTimeHours = (forecastVolume * ahtMinutes) / 60;
  const staffingHours = handleTimeHours / utilizationPct;
  return {
    handleTimeHours: Math.round(handleTimeHours * 10) / 10,
    staffingHours: Math.round(staffingHours * 10) / 10,
    fte: Math.ceil(staffingHours / 8),
  };
}
