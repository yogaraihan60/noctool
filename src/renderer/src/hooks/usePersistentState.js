import { useState, useEffect, useCallback } from 'react';

const usePersistentState = (tabId, operationType) => {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial state
  const loadState = useCallback(async () => {
    try {
      setLoading(true);
      const tabState = await window.electronAPI.getTabState(tabId);
      const operationState = tabState.find(s => s.operationType === operationType);
      
      if (operationState) {
        setState(operationState);
      } else {
        // Initialize empty state
        setState({
          tabId,
          operationType,
          data: null,
          processes: [],
          lastUpdated: null,
          isActive: false
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tabId, operationType]);

  // Update state
  const updateState = useCallback(async (updates) => {
    try {
      const updatedState = await window.electronAPI.updateState(tabId, operationType, updates);
      setState(updatedState);
      return updatedState;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [tabId, operationType]);

  // Add process
  const addProcess = useCallback(async (process) => {
    try {
      const updatedState = await window.electronAPI.addProcess(tabId, operationType, process);
      setState(updatedState);
      return updatedState;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [tabId, operationType]);

  // Update process
  const updateProcess = useCallback(async (sessionId, updates) => {
    try {
      const updatedState = await window.electronAPI.updateProcess(tabId, operationType, sessionId, updates);
      setState(updatedState);
      return updatedState;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [tabId, operationType]);

  // Remove process
  const removeProcess = useCallback(async (sessionId) => {
    try {
      const updatedState = await window.electronAPI.removeProcess(tabId, operationType, sessionId);
      setState(updatedState);
      return updatedState;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [tabId, operationType]);

  // Set data
  const setData = useCallback(async (data) => {
    try {
      const updatedState = await window.electronAPI.setData(tabId, operationType, data);
      setState(updatedState);
      return updatedState;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [tabId, operationType]);

  // Clear state
  const clearState = useCallback(async () => {
    try {
      await window.electronAPI.clearTabState(tabId);
      setState({
        tabId,
        operationType,
        data: null,
        processes: [],
        lastUpdated: null,
        isActive: false
      });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [tabId, operationType]);

  // Load state on mount
  useEffect(() => {
    loadState();
  }, [loadState]);

  // Refresh state periodically
  useEffect(() => {
    const interval = setInterval(loadState, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [loadState]);

  return {
    state,
    loading,
    error,
    updateState,
    addProcess,
    updateProcess,
    removeProcess,
    setData,
    clearState,
    refresh: loadState
  };
};

export default usePersistentState; 