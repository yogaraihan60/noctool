/**
 * Manages persistent state for each tab and operation type
 */
class PersistentStateManager {
  constructor() {
    this.state = new Map();
    this.subscribers = new Map();
  }

  /**
   * Get or create state for a specific tab and operation type
   */
  getState(tabId, operationType) {
    const key = `${tabId}_${operationType}`;
    if (!this.state.has(key)) {
      this.state.set(key, {
        tabId,
        operationType,
        data: null,
        processes: [],
        lastUpdated: null,
        isActive: false
      });
    }
    return this.state.get(key);
  }

  /**
   * Update state for a specific tab and operation type
   */
  updateState(tabId, operationType, updates) {
    const state = this.getState(tabId, operationType);
    const updatedState = { ...state, ...updates, lastUpdated: Date.now() };
    this.state.set(`${tabId}_${operationType}`, updatedState);
    
    // Notify subscribers
    this.notifySubscribers(tabId, operationType, updatedState);
    
    return updatedState;
  }

  /**
   * Add a process to the state
   */
  addProcess(tabId, operationType, process) {
    const state = this.getState(tabId, operationType);
    const processes = [...state.processes, process];
    return this.updateState(tabId, operationType, { processes, isActive: true });
  }

  /**
   * Update a process in the state
   */
  updateProcess(tabId, operationType, sessionId, updates) {
    const state = this.getState(tabId, operationType);
    const processes = state.processes.map(p => 
      p.sessionId === sessionId ? { ...p, ...updates } : p
    );
    return this.updateState(tabId, operationType, { processes });
  }

  /**
   * Remove a process from the state
   */
  removeProcess(tabId, operationType, sessionId) {
    const state = this.getState(tabId, operationType);
    const processes = state.processes.filter(p => p.sessionId !== sessionId);
    const isActive = processes.some(p => !p.completed);
    return this.updateState(tabId, operationType, { processes, isActive });
  }

  /**
   * Set data for a tab/operation
   */
  setData(tabId, operationType, data) {
    return this.updateState(tabId, operationType, { data });
  }

  /**
   * Get all state for a specific tab
   */
  getTabState(tabId) {
    const tabStates = [];
    for (const [key, state] of this.state) {
      if (state.tabId === tabId) {
        tabStates.push(state);
      }
    }
    return tabStates;
  }

  /**
   * Get all state for a specific operation type
   */
  getOperationState(operationType) {
    const operationStates = [];
    for (const [key, state] of this.state) {
      if (state.operationType === operationType) {
        operationStates.push(state);
      }
    }
    return operationStates;
  }

  /**
   * Clear state for a specific tab
   */
  clearTabState(tabId) {
    const keysToDelete = [];
    for (const [key, state] of this.state) {
      if (state.tabId === tabId) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.state.delete(key));
  }

  /**
   * Clear state for a specific operation type
   */
  clearOperationState(operationType) {
    const keysToDelete = [];
    for (const [key, state] of this.state) {
      if (state.operationType === operationType) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.state.delete(key));
  }

  /**
   * Subscribe to state changes
   */
  subscribe(tabId, operationType, callback) {
    const key = `${tabId}_${operationType}`;
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      const subscribers = this.subscribers.get(key);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  /**
   * Notify subscribers of state changes
   */
  notifySubscribers(tabId, operationType, state) {
    const key = `${tabId}_${operationType}`;
    const subscribers = this.subscribers.get(key);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          console.error('Error in state subscriber callback:', error);
        }
      });
    }
  }

  /**
   * Get all active states
   */
  getAllActiveStates() {
    const activeStates = [];
    for (const [key, state] of this.state) {
      if (state.isActive) {
        activeStates.push(state);
      }
    }
    return activeStates;
  }

  /**
   * Get statistics about the state
   */
  getStatistics() {
    const stats = {
      totalStates: this.state.size,
      activeStates: 0,
      totalProcesses: 0,
      completedProcesses: 0,
      byTab: {},
      byOperation: {}
    };

    for (const [key, state] of this.state) {
      if (state.isActive) {
        stats.activeStates++;
      }
      
      stats.totalProcesses += state.processes.length;
      stats.completedProcesses += state.processes.filter(p => p.completed).length;
      
      // Count by tab
      if (!stats.byTab[state.tabId]) {
        stats.byTab[state.tabId] = 0;
      }
      stats.byTab[state.tabId]++;
      
      // Count by operation
      if (!stats.byOperation[state.operationType]) {
        stats.byOperation[state.operationType] = 0;
      }
      stats.byOperation[state.operationType]++;
    }

    return stats;
  }
}

module.exports = PersistentStateManager; 