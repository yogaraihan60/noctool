import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing application state using the AppStateManager
 * Implements the architectural approach for robust state management
 */
const useAppState = () => {
  const [appState, setAppState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial app state
  const loadAppState = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 [useAppState] Loading app state...');
      
      // Check if electronAPI is available
      if (!window.electronAPI) {
        console.error('❌ [useAppState] electronAPI not available');
        setError('Electron API not available');
        return;
      }
      
      const state = await window.electronAPI.getAppState();
      console.log('✅ [useAppState] App state loaded:', state);
      setAppState(state);
    } catch (err) {
      console.error('❌ [useAppState] Error loading app state:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update app state
  const updateAppState = useCallback(async (newState) => {
    try {
      await window.electronAPI.updateAppState(newState);
      await loadAppState(); // Reload to get updated state
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAppState]);

  // Tab Management
  const addTab = useCallback(async (tabData) => {
    try {
      const newTab = await window.electronAPI.addTab(tabData);
      await loadAppState();
      return newTab;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAppState]);

  const updateTab = useCallback(async (tabId, updates) => {
    try {
      const updatedTab = await window.electronAPI.updateTab(tabId, updates);
      await loadAppState();
      return updatedTab;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAppState]);

  const removeTab = useCallback(async (tabId) => {
    try {
      const removedTab = await window.electronAPI.removeTab(tabId);
      await loadAppState();
      return removedTab;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAppState]);

  const activateTab = useCallback(async (tabId) => {
    try {
      const activeTab = await window.electronAPI.activateTab(tabId);
      await loadAppState();
      return activeTab;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAppState]);

  // Process Management
  const addProcess = useCallback(async (processData) => {
    try {
      const newProcess = await window.electronAPI.addProcess(processData);
      await loadAppState();
      return newProcess;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAppState]);

  const updateProcess = useCallback(async (processId, updates) => {
    try {
      const updatedProcess = await window.electronAPI.updateProcess(processId, updates);
      await loadAppState();
      return updatedProcess;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAppState]);

  const removeProcess = useCallback(async (processId) => {
    try {
      const removedProcess = await window.electronAPI.removeProcess(processId);
      await loadAppState();
      return removedProcess;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAppState]);

  const clearCompletedProcesses = useCallback(async () => {
    try {
      const result = await window.electronAPI.cleanupCompletedProcesses();
      await loadAppState();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAppState]);

  // Settings Management
  const updateSettings = useCallback(async (newSettings) => {
    try {
      const updatedSettings = await window.electronAPI.updateSettings(newSettings);
      await loadAppState();
      return updatedSettings;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAppState]);

  // Utility Functions
  const getStatistics = useCallback(async () => {
    try {
      return await window.electronAPI.getAppStatistics();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const clearAllData = useCallback(async () => {
    try {
      const result = await window.electronAPI.clearAllData();
      await loadAppState();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAppState]);

  const exportState = useCallback(async () => {
    try {
      return await window.electronAPI.exportAppState();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const importState = useCallback(async (jsonString) => {
    try {
      const result = await window.electronAPI.importAppState(jsonString);
      if (result.success) {
        await loadAppState();
      }
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAppState]);

  // Load state on mount
  useEffect(() => {
    loadAppState();
  }, [loadAppState]);

  // Refresh state periodically
  useEffect(() => {
    const interval = setInterval(loadAppState, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, [loadAppState]);

  // Computed values
  const tabs = appState?.tabs || [];
  const processes = appState?.processes || [];
  const settings = appState?.settings || {};
  const activeTab = tabs.find(tab => tab.isActive);
  const activeProcesses = processes.filter(p => p.isActive && !p.completed);
  const completedProcesses = processes.filter(p => p.completed);

  return {
    // State
    appState,
    tabs,
    processes,
    settings,
    activeTab,
    activeProcesses,
    completedProcesses,
    loading,
    error,

    // Actions
    loadAppState,
    updateAppState,

    // Tab Management
    addTab,
    updateTab,
    removeTab,
    activateTab,

    // Process Management
    addProcess,
    updateProcess,
    removeProcess,
    clearCompletedProcesses,

    // Settings Management
    updateSettings,

    // Utility Functions
    getStatistics,
    clearAllData,
    exportState,
    importState,

    // Computed values
    hasActiveProcesses: activeProcesses.length > 0,
    hasCompletedProcesses: completedProcesses.length > 0,
    totalProcesses: processes.length,
    totalTabs: tabs.length
  };
};

export default useAppState; 