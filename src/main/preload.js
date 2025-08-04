const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Ping operations
  httpPing: (config) => ipcRenderer.invoke('ping:http', config),
  icmpPing: (config) => ipcRenderer.invoke('ping:icmp', config),
  
  // Real-time ping operations
  httpPingRealtime: (config) => ipcRenderer.invoke('ping:http:realtime', config),
  icmpPingRealtime: (config) => ipcRenderer.invoke('ping:icmp:realtime', config),
  
  // Traceroute
  traceroute: (config) => ipcRenderer.invoke('traceroute', config),
  tracerouteRealtime: (config) => ipcRenderer.invoke('traceroute:realtime', config),
  
  // Continuous traceroute
  startContinuousTraceroute: (config) => ipcRenderer.invoke('traceroute:continuous:start', config),
  stopContinuousTraceroute: (sessionId) => ipcRenderer.invoke('traceroute:continuous:stop', sessionId),
  getContinuousTracerouteStatus: () => ipcRenderer.invoke('traceroute:continuous:status'),
  
  // Ping statistics
  getHopPingStats: (hopKey) => ipcRenderer.invoke('traceroute:ping-stats', hopKey),
  resetPingCounters: (hopKey) => ipcRenderer.invoke('traceroute:reset-ping-counters', hopKey),
  
  // Real-time updates
  onTracerouteUpdate: (callback) => {
    ipcRenderer.on('traceroute:update', (event, data) => callback(data));
  },
  removeTracerouteUpdate: () => {
    ipcRenderer.removeAllListeners('traceroute:update');
  },
  
  // Ping real-time updates
  onPingUpdate: (callback) => {
    ipcRenderer.on('ping:update', (event, data) => callback(data));
  },
  removePingUpdate: () => {
    ipcRenderer.removeAllListeners('ping:update');
  },
  
  // Port scan real-time updates
  onPortScanUpdate: (callback) => {
    ipcRenderer.on('port-scan:update', (event, data) => callback(data));
  },
  removePortScanUpdate: () => {
    ipcRenderer.removeAllListeners('port-scan:update');
  },
  
  // Continuous traceroute updates
  onContinuousTracerouteUpdate: (callback) => {
    ipcRenderer.on('traceroute:continuous:update', (event, data) => callback(data));
  },
  onContinuousTracerouteComplete: (callback) => {
    ipcRenderer.on('traceroute:continuous:complete', (event, data) => callback(data));
  },
  removeContinuousTracerouteListeners: () => {
    ipcRenderer.removeAllListeners('traceroute:continuous:update');
    ipcRenderer.removeAllListeners('traceroute:continuous:complete');
  },

  // Port scanning
  portScan: (config) => ipcRenderer.invoke('port-scan', config),
  portScanRealtime: (config) => ipcRenderer.invoke('port-scan:realtime', config),

  // Network information
  getNetworkInterfaces: () => ipcRenderer.invoke('network:interfaces'),

  // DNS and WHOIS
  dnsLookup: (domain) => ipcRenderer.invoke('dns:lookup', domain),
  whoisLookup: (query) => ipcRenderer.invoke('whois:lookup', query),

  // Process management
  getActiveProcesses: () => ipcRenderer.invoke('process:get-active'),
  getActiveProcessCount: () => ipcRenderer.invoke('process:get-active-count'),
  getCompletedProcessCount: () => ipcRenderer.invoke('process:get-completed-count'),
  stopAllProcesses: () => ipcRenderer.invoke('process:stop-all'),
  stopProcess: (sessionId) => ipcRenderer.invoke('process:stop', sessionId),
  cleanupCompletedProcesses: () => ipcRenderer.invoke('process:cleanup-completed'),

  // App State Management
  getAppState: () => ipcRenderer.invoke('app-state:get'),
  updateAppState: (newState) => ipcRenderer.invoke('app-state:update', newState),
  getAppStatistics: () => ipcRenderer.invoke('app-state:get-statistics'),
  clearAllData: () => ipcRenderer.invoke('app-state:clear-all'),
  exportAppState: () => ipcRenderer.invoke('app-state:export'),
  importAppState: (jsonString) => ipcRenderer.invoke('app-state:import', jsonString),

  // Tab Management
  getTabs: () => ipcRenderer.invoke('tabs:get-all'),
  addTab: (tabData) => ipcRenderer.invoke('tabs:add', tabData),
  updateTab: (tabId, updates) => ipcRenderer.invoke('tabs:update', tabId, updates),
  removeTab: (tabId) => ipcRenderer.invoke('tabs:remove', tabId),
  activateTab: (tabId) => ipcRenderer.invoke('tabs:activate', tabId),
  getActiveTab: () => ipcRenderer.invoke('tabs:get-active'),

  // Enhanced Process Management
  getAllProcesses: () => ipcRenderer.invoke('processes:get-all'),
  getActiveProcessesList: () => ipcRenderer.invoke('processes:get-active'),
  getCompletedProcessesList: () => ipcRenderer.invoke('processes:get-completed'),
  addProcess: (processData) => ipcRenderer.invoke('processes:add', processData),
  updateProcess: (processId, updates) => ipcRenderer.invoke('processes:update', processId, updates),
  removeProcess: (processId) => ipcRenderer.invoke('processes:remove', processId),

  // Settings Management
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (newSettings) => ipcRenderer.invoke('settings:update', newSettings),

  // Persistent state management
  getTabState: (tabId) => ipcRenderer.invoke('state:get-tab-state', tabId),
  getOperationState: (operationType) => ipcRenderer.invoke('state:get-operation-state', operationType),
  updateState: (tabId, operationType, updates) => ipcRenderer.invoke('state:update-state', tabId, operationType, updates),
  addProcess: (tabId, operationType, process) => ipcRenderer.invoke('state:add-process', tabId, operationType, process),
  updateProcess: (tabId, operationType, sessionId, updates) => ipcRenderer.invoke('state:update-process', tabId, operationType, sessionId, updates),
  removeProcess: (tabId, operationType, sessionId) => ipcRenderer.invoke('state:remove-process', tabId, operationType, sessionId),
  setData: (tabId, operationType, data) => ipcRenderer.invoke('state:set-data', tabId, operationType, data),
  clearTabState: (tabId) => ipcRenderer.invoke('state:clear-tab', tabId),
  getStateStatistics: () => ipcRenderer.invoke('state:get-statistics'),

  // Tab change confirmation
  confirmTabChange: (newTab) => ipcRenderer.invoke('tab:change-confirmation', newTab),

  // Utility functions
  platform: process.platform,
  version: process.versions.electron,

  // Development utilities
  reloadWebview: () => ipcRenderer.invoke('reload:webview')
}); 