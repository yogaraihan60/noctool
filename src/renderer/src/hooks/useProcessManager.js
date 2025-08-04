import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const useProcessManager = () => {
  const [activeProcesses, setActiveProcesses] = useState([]);
  const [activeCount, setActiveCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [isCheckingProcesses, setIsCheckingProcesses] = useState(false);
  const navigate = useNavigate();

  // Get active processes from main process
  const fetchActiveProcesses = useCallback(async () => {
    try {
      const processes = await window.electronAPI.getActiveProcesses();
      const activeCount = await window.electronAPI.getActiveProcessCount();
      const completedCount = await window.electronAPI.getCompletedProcessCount();
      
      setActiveProcesses(processes);
      setActiveCount(activeCount);
      setCompletedCount(completedCount);
      
      return processes;
    } catch (error) {
      console.error('Failed to fetch active processes:', error);
      return [];
    }
  }, []);

  // Stop all active processes
  const stopAllProcesses = useCallback(async () => {
    try {
      await window.electronAPI.stopAllProcesses();
      setActiveProcesses([]);
      setActiveCount(0);
      setCompletedCount(0);
      return true;
    } catch (error) {
      console.error('Failed to stop all processes:', error);
      return false;
    }
  }, []);

  // Stop a specific process
  const stopProcess = useCallback(async (sessionId) => {
    try {
      const result = await window.electronAPI.stopProcess(sessionId);
      if (result.success) {
        setActiveProcesses(prev => prev.filter(p => p.sessionId !== sessionId));
        // Refresh counts
        const newActiveCount = await window.electronAPI.getActiveProcessCount();
        const newCompletedCount = await window.electronAPI.getCompletedProcessCount();
        setActiveCount(newActiveCount);
        setCompletedCount(newCompletedCount);
      }
      return result;
    } catch (error) {
      console.error('Failed to stop process:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Clean up completed processes
  const cleanupCompletedProcesses = useCallback(async () => {
    try {
      const result = await window.electronAPI.cleanupCompletedProcesses();
      if (result.success) {
        // Refresh the active processes list and counts
        await fetchActiveProcesses();
      }
      return result;
    } catch (error) {
      console.error('Failed to cleanup completed processes:', error);
      return { success: false, error: error.message };
    }
  }, [fetchActiveProcesses]);

  // Navigate to a new tab - processes continue running in background
  const navigateWithConfirmation = useCallback(async (path) => {
    console.log('🔍 [NAVIGATION] navigateWithConfirmation called with path:', path);
    console.log('🔍 [NAVIGATION] activeCount:', activeCount);
    
    // Always allow navigation - processes will continue running in background
    console.log('🔍 [NAVIGATION] Allowing navigation - processes will continue in background');
    navigate(path);
  }, [navigate, activeCount]);

  // Refresh active processes periodically
  useEffect(() => {
    const interval = setInterval(fetchActiveProcesses, 2000); // Check every 2 seconds
    
    return () => clearInterval(interval);
  }, [fetchActiveProcesses]);

  // Initial fetch
  useEffect(() => {
    fetchActiveProcesses();
  }, [fetchActiveProcesses]);

  // Separate active and completed processes
  const activeProcessesList = activeProcesses.filter(p => p.isActive);
  const completedProcessesList = activeProcesses.filter(p => p.completed);

  return {
    activeProcesses,
    activeProcessesList,
    completedProcessesList,
    activeCount,
    completedCount,
    isCheckingProcesses,
    fetchActiveProcesses,
    stopAllProcesses,
    stopProcess,
    cleanupCompletedProcesses,
    navigateWithConfirmation,
    hasActiveProcesses: activeCount > 0,
    hasCompletedProcesses: completedCount > 0
  };
};

export default useProcessManager; 