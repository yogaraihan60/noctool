const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Manages the entire application state with persistent storage
 * Implements the architectural approach for multi-tab state management
 */
class AppStateManager {
  constructor() {
    // Path to save session data
    this.sessionFilePath = path.join(app.getPath('userData'), 'noctool-session.json');
    
    // Main application state
    this.appState = {
      tabs: [],
      activeTabId: null,
      processes: [],
      settings: {
        theme: 'dark',
        autoSave: true,
        maxProcesses: 50
      },
      lastUpdated: null
    };

    // Debounce timer for saving
    this.saveTimeout = null;
    this.saveDelay = 500; // 500ms delay

    // Load state on initialization
    this.loadState();
  }

  /**
   * Save state to file with debouncing
   */
  saveState() {
    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Set new timeout for debounced save
    this.saveTimeout = setTimeout(() => {
      this._performSave();
    }, this.saveDelay);
  }

  /**
   * Perform the actual save operation
   */
  _performSave() {
    try {
      this.appState.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.sessionFilePath, JSON.stringify(this.appState, null, 2));
      console.log('✅ [AppStateManager] State saved successfully');
    } catch (error) {
      console.error('❌ [AppStateManager] Failed to save state:', error);
    }
  }

  /**
   * Load state from file
   */
  loadState() {
    try {
      if (fs.existsSync(this.sessionFilePath)) {
        const savedState = JSON.parse(fs.readFileSync(this.sessionFilePath, 'utf-8'));
        
        // Validate and merge saved state
        if (savedState && typeof savedState === 'object') {
          // Merge tabs if valid
          if (Array.isArray(savedState.tabs)) {
            this.appState.tabs = savedState.tabs;
          }
          
          // Set active tab if valid
          if (savedState.activeTabId && this.appState.tabs.find(t => t.id === savedState.activeTabId)) {
            this.appState.activeTabId = savedState.activeTabId;
          }
          
          // Merge processes if valid
          if (Array.isArray(savedState.processes)) {
            this.appState.processes = savedState.processes;
          }
          
          // Merge settings if valid
          if (savedState.settings && typeof savedState.settings === 'object') {
            this.appState.settings = { ...this.appState.settings, ...savedState.settings };
          }
          
          console.log('✅ [AppStateManager] State loaded successfully');
        }
      }
    } catch (error) {
      console.error('❌ [AppStateManager] Failed to load state:', error);
      // If file is corrupt, start fresh
      this.appState = {
        tabs: [],
        activeTabId: null,
        processes: [],
        settings: {
          theme: 'dark',
          autoSave: true,
          maxProcesses: 50
        },
        lastUpdated: null
      };
    }
  }

  /**
   * Get the entire application state
   */
  getState() {
    return { ...this.appState };
  }

  /**
   * Update the entire application state
   */
  updateState(newState) {
    this.appState = { ...this.appState, ...newState };
    this.saveState();
  }

  /**
   * Tab Management
   */
  
  /**
   * Add a new tab
   */
  addTab(tabData) {
    const newTab = {
      id: Date.now() + Math.random(),
      url: tabData.url,
      title: tabData.title || 'New Tab',
      isActive: false,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      ...tabData
    };

    // Deactivate all other tabs
    this.appState.tabs.forEach(tab => tab.isActive = false);
    
    // Add new tab and make it active
    this.appState.tabs.push(newTab);
    this.appState.activeTabId = newTab.id;
    newTab.isActive = true;

    this.saveState();
    return newTab;
  }

  /**
   * Update a tab
   */
  updateTab(tabId, updates) {
    const tabIndex = this.appState.tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex !== -1) {
      this.appState.tabs[tabIndex] = {
        ...this.appState.tabs[tabIndex],
        ...updates,
        lastAccessed: new Date().toISOString()
      };
      this.saveState();
      return this.appState.tabs[tabIndex];
    }
    return null;
  }

  /**
   * Remove a tab
   */
  removeTab(tabId) {
    const tabIndex = this.appState.tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex !== -1) {
      const removedTab = this.appState.tabs.splice(tabIndex, 1)[0];
      
      // If the removed tab was active, activate another tab
      if (removedTab.isActive && this.appState.tabs.length > 0) {
        const nextTab = this.appState.tabs[tabIndex] || this.appState.tabs[tabIndex - 1];
        if (nextTab) {
          nextTab.isActive = true;
          this.appState.activeTabId = nextTab.id;
        }
      }
      
      this.saveState();
      return removedTab;
    }
    return null;
  }

  /**
   * Activate a tab
   */
  activateTab(tabId) {
    // Deactivate all tabs
    this.appState.tabs.forEach(tab => tab.isActive = false);
    
    // Activate the specified tab
    const tab = this.appState.tabs.find(tab => tab.id === tabId);
    if (tab) {
      tab.isActive = true;
      tab.lastAccessed = new Date().toISOString();
      this.appState.activeTabId = tabId;
      this.saveState();
      return tab;
    }
    return null;
  }

  /**
   * Get active tab
   */
  getActiveTab() {
    return this.appState.tabs.find(tab => tab.id === this.appState.activeTabId);
  }

  /**
   * Get all tabs
   */
  getTabs() {
    return [...this.appState.tabs];
  }

  /**
   * Process Management
   */
  
  /**
   * Add a process
   */
  addProcess(processData) {
    const newProcess = {
      id: Date.now() + Math.random(),
      createdAt: new Date().toISOString(),
      isActive: true,
      completed: false,
      ...processData
    };

    this.appState.processes.push(newProcess);
    
    // Limit the number of processes
    if (this.appState.processes.length > this.appState.settings.maxProcesses) {
      this.appState.processes = this.appState.processes.slice(-this.appState.settings.maxProcesses);
    }
    
    this.saveState();
    return newProcess;
  }

  /**
   * Update a process
   */
  updateProcess(processId, updates) {
    const processIndex = this.appState.processes.findIndex(p => p.id === processId);
    if (processIndex !== -1) {
      this.appState.processes[processIndex] = {
        ...this.appState.processes[processIndex],
        ...updates,
        lastUpdated: new Date().toISOString()
      };
      this.saveState();
      return this.appState.processes[processIndex];
    }
    return null;
  }

  /**
   * Remove a process
   */
  removeProcess(processId) {
    const processIndex = this.appState.processes.findIndex(p => p.id === processId);
    if (processIndex !== -1) {
      const removedProcess = this.appState.processes.splice(processIndex, 1)[0];
      this.saveState();
      return removedProcess;
    }
    return null;
  }

  /**
   * Get all processes
   */
  getProcesses() {
    return [...this.appState.processes];
  }

  /**
   * Get active processes
   */
  getActiveProcesses() {
    return this.appState.processes.filter(p => p.isActive && !p.completed);
  }

  /**
   * Get completed processes
   */
  getCompletedProcesses() {
    return this.appState.processes.filter(p => p.completed);
  }

  /**
   * Clear completed processes
   */
  clearCompletedProcesses() {
    const completedCount = this.appState.processes.filter(p => p.completed).length;
    this.appState.processes = this.appState.processes.filter(p => !p.completed);
    this.saveState();
    return completedCount;
  }

  /**
   * Settings Management
   */
  
  /**
   * Update settings
   */
  updateSettings(newSettings) {
    this.appState.settings = { ...this.appState.settings, ...newSettings };
    this.saveState();
    return this.appState.settings;
  }

  /**
   * Get settings
   */
  getSettings() {
    return { ...this.appState.settings };
  }

  /**
   * Utility Methods
   */
  
  /**
   * Get statistics about the current state
   */
  getStatistics() {
    const activeProcesses = this.getActiveProcesses();
    const completedProcesses = this.getCompletedProcesses();
    
    return {
      tabs: {
        total: this.appState.tabs.length,
        active: this.appState.tabs.filter(t => t.isActive).length
      },
      processes: {
        total: this.appState.processes.length,
        active: activeProcesses.length,
        completed: completedProcesses.length
      },
      lastUpdated: this.appState.lastUpdated
    };
  }

  /**
   * Clear all data (reset to default state)
   */
  clearAllData() {
    this.appState = {
      tabs: [],
      activeTabId: null,
      processes: [],
      settings: {
        theme: 'dark',
        autoSave: true,
        maxProcesses: 50
      },
      lastUpdated: null
    };
    this.saveState();
  }

  /**
   * Export state to JSON
   */
  exportState() {
    return JSON.stringify(this.appState, null, 2);
  }

  /**
   * Import state from JSON
   */
  importState(jsonString) {
    try {
      const importedState = JSON.parse(jsonString);
      if (importedState && typeof importedState === 'object') {
        this.appState = { ...this.appState, ...importedState };
        this.saveState();
        return true;
      }
    } catch (error) {
      console.error('❌ [AppStateManager] Failed to import state:', error);
    }
    return false;
  }
}

module.exports = AppStateManager; 