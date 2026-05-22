// ClearCast Forecast Context
// Provides forecast data and metadata to the app

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  loadForecastData,
  getDataSource,
  setDataSource,
  DATA_SOURCE,
  METHODOLOGY,
  isDataStale
} from './forecastService';

const ForecastContext = createContext(null);

export function ForecastProvider({ children }) {
  const [forecastData, setForecastData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSourceState] = useState(getDataSource());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isStale, setIsStale] = useState(false);

  // Load data on mount and when source changes
  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await loadForecastData();

      if (result.success) {
        setForecastData(result.data);
        setLastUpdated(result.lastUpdated);
        setIsStale(isDataStale(result.lastUpdated));
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData, dataSource]);

  // Change data source
  const changeDataSource = useCallback((newSource) => {
    setDataSource(newSource);
    setDataSourceState(newSource);
  }, []);

  const value = {
    // Data
    forecastData,
    loading,
    error,

    // Metadata
    dataSource,
    lastUpdated,
    isStale,
    methodology: METHODOLOGY,

    // Actions
    refreshData,
    changeDataSource,
    patchForecastData: setForecastData,

    // Constants
    DATA_SOURCE
  };

  return (
    <ForecastContext.Provider value={value}>
      {children}
    </ForecastContext.Provider>
  );
}

export function useForecast() {
  const context = useContext(ForecastContext);
  if (!context) {
    throw new Error('useForecast must be used within a ForecastProvider');
  }
  return context;
}

export { DATA_SOURCE, METHODOLOGY };
