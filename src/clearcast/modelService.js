// ClearCast Model Lab Service
// Talks to the FastAPI proxy's /api/models endpoints

const PROXY_URL = 'http://localhost:8000';

export const MODEL_STATUS = {
  PRODUCTION: 'production',
  IN_DEVELOPMENT: 'in_development',
  PLACEHOLDER: 'placeholder',
};

export async function listModels() {
  const resp = await fetch(`${PROXY_URL}/api/models`);
  if (!resp.ok) throw new Error(`Failed to load models: ${resp.statusText}`);
  const { models } = await resp.json();
  return models;
}

/**
 * Run a model on a set of CT IDs.
 * @param {string} codename - 'LaFlare' | 'Lola'
 * @param {number[]} ctIds - CT IDs to run on
 * @param {object} options
 * @param {number} options.forecastDays - days forward to forecast (default 30)
 * @param {string} options.pillar - informational label
 */
export async function runModel(codename, ctIds, { forecastDays = 30, pillar = null } = {}) {
  const endpoint = codename.toLowerCase();
  const resp = await fetch(`${PROXY_URL}/api/models/${endpoint}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ct_ids: ctIds, forecast_days: forecastDays, pillar }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || `Model run failed: ${resp.statusText}`);
  }
  return resp.json();
}

/**
 * Given model run results, compute summary stats for display.
 * Returns { ctCount, successCount, avgWmape, avgMae, bestModelBreakdown }
 */
export function summarizeResults(runResult) {
  if (!runResult?.results) return null;

  const entries = Object.values(runResult.results);
  const successful = entries.filter(r => !r.error);

  if (successful.length === 0) return { ctCount: entries.length, successCount: 0 };

  const wmapes = successful.map(r => r.wmape ?? r.mape).filter(v => v != null && isFinite(v));
  const maes = successful.map(r => r.mae).filter(v => v != null);

  // Which model won most often
  const modelCounts = {};
  successful.forEach(r => {
    const name = r.best_model;
    if (name) modelCounts[name] = (modelCounts[name] || 0) + 1;
  });
  const bestModelBreakdown = Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, pct: Math.round((count / successful.length) * 100) }));

  return {
    ctCount: entries.length,
    successCount: successful.length,
    avgWmape: wmapes.length ? +(wmapes.reduce((a, b) => a + b, 0) / wmapes.length).toFixed(1) : null,
    avgMae: maes.length ? Math.round(maes.reduce((a, b) => a + b, 0) / maes.length) : null,
    bestModelBreakdown,
  };
}

/**
 * Convert model run results into the same shape as ForecastContext forecastData
 * so they can be overlaid on the main forecast view.
 * Returns an array of patched CT objects.
 */
export function applyResultsToForecast(forecastData, runResult, forecastDays = 30) {
  if (!runResult?.results) return forecastData;

  return forecastData.map(ct => {
    const r = runResult.results[ct.id];
    if (!r || r.error || !r.forecast?.length) return ct;

    // Sum the forward forecast window to replace weeklyForecastVolume
    const forecastTotal = r.forecast
      .slice(0, forecastDays)
      .reduce((sum, day) => sum + (day.volume || 0), 0);

    return {
      ...ct,
      forecastVolume: forecastTotal,
      modelSource: runResult.model,
      modelBest: r.best_model,
      modelWmape: r.wmape ?? r.mape,
    };
  });
}
