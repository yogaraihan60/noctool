const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// Manual reload for development (prevents full app restart)
if (isDev) {
  // Watch for file changes and reload only the webview
  const chokidar = require('chokidar');
  const watcher = chokidar.watch([
    'src/main/**/*.js',
    'src/main/**/*.json'
  ], {
    ignored: [
      'src/renderer/**/*',
      'node_modules/**/*',
      'dist/**/*',
      '*.log'
    ],
    persistent: true
  });

  watcher.on('change', (path) => {
    console.log(`🔄 File changed: ${path}`);
    console.log('🔄 Reloading webview only...');
    
    // Check if mainWindow exists and is not destroyed before trying to reload
    if (typeof mainWindow !== 'undefined' && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    } else {
      console.log('🔄 Main window not ready, skipping reload');
    }
  });

  // Clean up watcher on app quit
  app.on('before-quit', () => {
    console.log('🔄 [MAIN] Closing file watcher...');
    watcher.close();
  });

  console.log('✅ Hot reload configured - only webview will reload');
}

// Network service imports
const NetworkService = require('./services/NetworkService');
const PingService = require('./services/PingService');
const TracerouteService = require('./services/TracerouteService');
const PortScannerService = require('./services/PortScannerService');
const PersistentStateManager = require('./services/PersistentStateManager');
const AppStateManager = require('./services/AppStateManager');

let mainWindow;
let networkService;
let persistentStateManager;
let appStateManager;

// Process management for tab switching
let activeProcesses = new Map();
let tracerouteService = new TracerouteService();
let portScannerService = new PortScannerService();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    title: 'Noctool - Network Utility Tool (Hot Reload Active)'
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/build/index.html'));
  }

  // Initialize services
  networkService = new NetworkService();
  persistentStateManager = new PersistentStateManager();
  appStateManager = new AppStateManager();
  
  console.log('✅ [MAIN] Services initialized');
  console.log('✅ [MAIN] AppStateManager initialized:', appStateManager ? 'success' : 'failed');
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Manual reload function for development
function reloadWebview() {
  if (typeof mainWindow !== 'undefined' && mainWindow && !mainWindow.isDestroyed()) {
    console.log('🔄 Manual webview reload triggered');
    mainWindow.webContents.reload();
  } else {
    console.log('🔄 Main window not ready, cannot reload');
  }
}

// Process management functions
function addActiveProcess(type, sessionId, stopFunction) {
  const processData = {
    type,
    sessionId,
    startTime: Date.now(),
    completed: false,
    isActive: true,
    stop: stopFunction
  };
  
  appStateManager.addProcess(processData);
  console.log(`🔄 [PROCESS] Added ${type} process: ${sessionId}`);
  console.log(`🔄 [PROCESS] Total active processes: ${appStateManager.getActiveProcesses().length}`);
}

function removeActiveProcess(sessionId) {
  const process = appStateManager.getProcesses().find(p => p.sessionId === sessionId);
  if (process) {
    appStateManager.removeProcess(process.id);
    console.log(`🔄 [PROCESS] Removed ${process.type} process: ${sessionId}`);
  }
}

function markProcessCompleted(sessionId) {
  const process = appStateManager.getProcesses().find(p => p.sessionId === sessionId);
  if (process) {
    appStateManager.updateProcess(process.id, {
      completed: true,
      isActive: false,
      completionTime: Date.now()
    });
    console.log(`✅ [PROCESS] Marked ${process.type} process as completed: ${sessionId}`);
  }
}

function getActiveProcesses() {
  return appStateManager.getActiveProcesses().map(process => ({
    type: process.type,
    sessionId: process.sessionId,
    duration: Date.now() - process.startTime,
    completed: process.completed || false,
    isActive: process.isActive || false,
    completionTime: process.completionTime || null
  }));
}

function getActiveProcessCount() {
  return appStateManager.getActiveProcesses().length;
}

function getCompletedProcessCount() {
  return appStateManager.getCompletedProcesses().length;
}

function stopAllProcesses() {
  const activeProcesses = appStateManager.getActiveProcesses();
  console.log(`🔄 [PROCESS] Stopping all active processes (${activeProcesses.length} total)`);
  
  const promises = [];
  
  activeProcesses.forEach(process => {
    console.log(`🔄 [PROCESS] Stopping ${process.type} process: ${process.sessionId}`);
    if (typeof process.stop === 'function') {
      promises.push(Promise.resolve(process.stop()));
    }
  });
  
  // Clear all processes
  appStateManager.clearAllData();
  return Promise.all(promises);
}

// IPC Handlers for network operations
ipcMain.handle('ping:http', async (event, config) => {
  try {
    const pingService = new PingService();
    return await pingService.httpPing(config);
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('ping:icmp', async (event, config) => {
  try {
    const pingService = new PingService();
    return await pingService.icmpPing(config);
  } catch (error) {
    return { error: error.message };
  }
});

// Real-time ping handlers
ipcMain.handle('ping:http:realtime', async (event, config) => {
  try {
    const sessionId = `ping_http_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add to active processes
    addActiveProcess('ping', sessionId, () => {
      removeActiveProcess(sessionId);
      return Promise.resolve({ success: true, message: 'HTTP ping process tracked' });
    });
    
    // Set up real-time updates
    const onUpdate = (update) => {
      event.sender.send('ping:update', update);
    };
    
    const pingService = new PingService();
    const result = await pingService.httpPing(config, onUpdate);
    
    // Mark as completed but keep for monitoring
    markProcessCompleted(sessionId);
    
    return result;
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('ping:icmp:realtime', async (event, config) => {
  try {
    const sessionId = `ping_icmp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add to active processes
    addActiveProcess('ping', sessionId, () => {
      removeActiveProcess(sessionId);
      return Promise.resolve({ success: true, message: 'ICMP ping process tracked' });
    });
    
    // Set up real-time updates
    const onUpdate = (update) => {
      event.sender.send('ping:update', update);
    };
    
    const pingService = new PingService();
    const result = await pingService.icmpPing(config, onUpdate);
    
    // Mark as completed but keep for monitoring
    markProcessCompleted(sessionId);
    
    return result;
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('traceroute', async (event, config) => {
  try {
    const sessionId = `traceroute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add to active processes
    addActiveProcess('traceroute', sessionId, () => {
      // Regular traceroute is not easily cancellable, but we can track it
      removeActiveProcess(sessionId);
      return Promise.resolve({ success: true, message: 'Traceroute process tracked' });
    });
    
    const result = await tracerouteService.trace(config);
    
    // Mark as completed but keep for monitoring
    markProcessCompleted(sessionId);
    
    return result;
  } catch (error) {
    return { error: error.message };
  }
});

// Real-time traceroute with progress updates
ipcMain.handle('traceroute:realtime', async (event, config) => {
  try {
    const sessionId = `traceroute_realtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add to active processes
    addActiveProcess('traceroute', sessionId, () => {
      // Real-time traceroute is not easily cancellable, but we can track it
      removeActiveProcess(sessionId);
      return Promise.resolve({ success: true, message: 'Real-time traceroute process tracked' });
    });
    
    // Set up real-time updates
    const onHopUpdate = (update) => {
      event.sender.send('traceroute:update', update);
    };
    
    const result = await tracerouteService.trace(config, onHopUpdate);
    
    // Mark as completed but keep for monitoring
    markProcessCompleted(sessionId);
    
    return result;
  } catch (error) {
    return { error: error.message };
  }
});

// Continuous traceroute handlers
ipcMain.handle('traceroute:continuous:start', async (event, config) => {
  try {
    // Set up real-time updates for continuous mode
    const onHopUpdate = (update) => {
      event.sender.send('traceroute:continuous:update', update);
    };
    
    const onComplete = (update) => {
      event.sender.send('traceroute:continuous:complete', update);
    };
    
    const result = await tracerouteService.startContinuousTrace(config, onHopUpdate, onComplete);
    
    if (result.success) {
      // Add to active processes
      addActiveProcess('traceroute', result.sessionId, () => {
        return tracerouteService.stopContinuousTrace(result.sessionId);
      });
    }
    
    return result;
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('traceroute:continuous:stop', async (event, sessionId) => {
  try {
    const result = await tracerouteService.stopContinuousTrace(sessionId);
    removeActiveProcess(sessionId);
    return result;
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('traceroute:continuous:status', async (event) => {
  try {
    return await tracerouteService.getActiveTraceroutes();
  } catch (error) {
    return { error: error.message };
  }
});

// Ping statistics handlers
ipcMain.handle('traceroute:ping-stats', async (event, hopKey) => {
  try {
    return await tracerouteService.getHopPingStatistics(hopKey);
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('traceroute:reset-ping-counters', async (event, hopKey) => {
  try {
    tracerouteService.resetPingCounters(hopKey);
    return { success: true, message: 'Ping counters reset' };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('port-scan', async (event, config) => {
  try {
    const sessionId = `portscan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add to active processes
    addActiveProcess('portscan', sessionId, () => {
      // Port scanning is not easily cancellable, but we can track it
      removeActiveProcess(sessionId);
      return Promise.resolve({ success: true, message: 'Port scan process tracked' });
    });
    
    const result = await portScannerService.scan(config);
    
    // Mark as completed but keep for monitoring
    markProcessCompleted(sessionId);
    
    return result;
  } catch (error) {
    return { error: error.message };
  }
});

// Real-time port scan handler
ipcMain.handle('port-scan:realtime', async (event, config) => {
  try {
    const sessionId = `portscan_realtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add to active processes
    addActiveProcess('portscan', sessionId, () => {
      removeActiveProcess(sessionId);
      return Promise.resolve({ success: true, message: 'Real-time port scan process tracked' });
    });
    
    // Set up real-time updates
    const onProgress = (progress) => {
      event.sender.send('port-scan:update', progress);
    };
    
    const result = await portScannerService.scan(config, onProgress);
    
    // Mark as completed but keep for monitoring
    markProcessCompleted(sessionId);
    
    return result;
  } catch (error) {
    return { error: error.message };
  }
});

// Process management handlers
ipcMain.handle('process:get-active', async (event) => {
  return getActiveProcesses();
});

ipcMain.handle('process:get-active-count', async (event) => {
  return getActiveProcessCount();
});

ipcMain.handle('process:get-completed-count', async (event) => {
  return getCompletedProcessCount();
});

ipcMain.handle('process:stop-all', async (event) => {
  return await stopAllProcesses();
});

ipcMain.handle('process:stop', async (event, sessionId) => {
  const process = appStateManager.getProcesses().find(p => p.sessionId === sessionId);
  if (process && typeof process.stop === 'function') {
    await process.stop();
    removeActiveProcess(sessionId);
    return { success: true, message: `Stopped ${process.type} process` };
  }
  return { success: false, message: 'Process not found' };
});

// New handler to clean up completed processes
ipcMain.handle('process:cleanup-completed', async (event) => {
  const completedCount = appStateManager.clearCompletedProcesses();
  return { 
    success: true, 
    message: `Cleaned up ${completedCount} completed processes`,
    cleanedCount: completedCount
  };
});

// App State Management handlers
ipcMain.handle('app-state:get', async (event) => {
  console.log('🔄 [MAIN] app-state:get called');
  try {
    const state = appStateManager.getState();
    console.log('✅ [MAIN] app-state:get returning state:', state);
    return state;
  } catch (error) {
    console.error('❌ [MAIN] app-state:get error:', error);
    throw error;
  }
});

ipcMain.handle('app-state:update', async (event, newState) => {
  appStateManager.updateState(newState);
  return { success: true, message: 'State updated successfully' };
});

// Tab Management handlers
ipcMain.handle('tabs:get-all', async (event) => {
  return appStateManager.getTabs();
});

ipcMain.handle('tabs:add', async (event, tabData) => {
  return appStateManager.addTab(tabData);
});

ipcMain.handle('tabs:update', async (event, tabId, updates) => {
  return appStateManager.updateTab(tabId, updates);
});

ipcMain.handle('tabs:remove', async (event, tabId) => {
  return appStateManager.removeTab(tabId);
});

ipcMain.handle('tabs:activate', async (event, tabId) => {
  return appStateManager.activateTab(tabId);
});

ipcMain.handle('tabs:get-active', async (event) => {
  return appStateManager.getActiveTab();
});

// Process Management handlers (enhanced)
ipcMain.handle('processes:get-all', async (event) => {
  return appStateManager.getProcesses();
});

ipcMain.handle('processes:get-active', async (event) => {
  return appStateManager.getActiveProcesses();
});

ipcMain.handle('processes:get-completed', async (event) => {
  return appStateManager.getCompletedProcesses();
});

ipcMain.handle('processes:add', async (event, processData) => {
  return appStateManager.addProcess(processData);
});

ipcMain.handle('processes:update', async (event, processId, updates) => {
  return appStateManager.updateProcess(processId, updates);
});

ipcMain.handle('processes:remove', async (event, processId) => {
  return appStateManager.removeProcess(processId);
});

// Settings Management handlers
ipcMain.handle('settings:get', async (event) => {
  return appStateManager.getSettings();
});

ipcMain.handle('settings:update', async (event, newSettings) => {
  return appStateManager.updateSettings(newSettings);
});

// Statistics and Utility handlers
ipcMain.handle('app-state:get-statistics', async (event) => {
  return appStateManager.getStatistics();
});

ipcMain.handle('app-state:clear-all', async (event) => {
  appStateManager.clearAllData();
  return { success: true, message: 'All data cleared successfully' };
});

ipcMain.handle('app-state:export', async (event) => {
  return appStateManager.exportState();
});

ipcMain.handle('app-state:import', async (event, jsonString) => {
  const success = appStateManager.importState(jsonString);
  return { 
    success, 
    message: success ? 'State imported successfully' : 'Failed to import state'
  };
});

// Persistent state management handlers
ipcMain.handle('state:get-tab-state', async (event, tabId) => {
  return persistentStateManager.getTabState(tabId);
});

ipcMain.handle('state:get-operation-state', async (event, operationType) => {
  return persistentStateManager.getOperationState(operationType);
});

ipcMain.handle('state:update-state', async (event, tabId, operationType, updates) => {
  return persistentStateManager.updateState(tabId, operationType, updates);
});

ipcMain.handle('state:add-process', async (event, tabId, operationType, process) => {
  return persistentStateManager.addProcess(tabId, operationType, process);
});

ipcMain.handle('state:update-process', async (event, tabId, operationType, sessionId, updates) => {
  return persistentStateManager.updateProcess(tabId, operationType, sessionId, updates);
});

ipcMain.handle('state:remove-process', async (event, tabId, operationType, sessionId) => {
  return persistentStateManager.removeProcess(tabId, operationType, sessionId);
});

ipcMain.handle('state:set-data', async (event, tabId, operationType, data) => {
  return persistentStateManager.setData(tabId, operationType, data);
});

ipcMain.handle('state:clear-tab', async (event, tabId) => {
  persistentStateManager.clearTabState(tabId);
  return { success: true, message: `Cleared state for tab: ${tabId}` };
});

ipcMain.handle('state:get-statistics', async (event) => {
  return persistentStateManager.getStatistics();
});

// Tab change confirmation handler
ipcMain.handle('tab:change-confirmation', async (event, newTab) => {
  console.log('🔍 [MAIN] tab:change-confirmation called with newTab:', newTab);
  
  const activeProcesses = getActiveProcesses();
  console.log('🔍 [MAIN] activeProcesses.length:', activeProcesses.length);
  
  // Always allow tab switching - processes will continue running in background
  console.log('🔍 [MAIN] Allowing tab change - processes will continue in background');
  return { shouldProceed: true, stoppedProcesses: false };
});

ipcMain.handle('network:interfaces', async () => {
  try {
    return await networkService.getNetworkInterfaces();
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('dns:lookup', async (event, domain) => {
  try {
    return await networkService.dnsLookup(domain);
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('whois:lookup', async (event, query) => {
  try {
    return await networkService.whoisLookup(query);
  } catch (error) {
    return { error: error.message };
  }
});

// Manual reload handler for development
ipcMain.handle('reload:webview', async (event) => {
  if (isDev) {
    reloadWebview();
    return { success: true, message: 'Webview reloaded' };
  }
  return { success: false, message: 'Reload only available in development' };
});

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Graceful shutdown handling
app.on('before-quit', async (event) => {
  console.log('🔄 [MAIN] App shutting down - cleaning up processes...');
  
  // Stop all active processes
  try {
    await stopAllProcesses();
    console.log('✅ [MAIN] All processes stopped successfully');
  } catch (error) {
    console.log('⚠️ [MAIN] Error stopping processes:', error.message);
  }
  
  // Force quit after cleanup
  app.exit(0);
});

// Handle SIGTERM and SIGINT signals
process.on('SIGTERM', () => {
  console.log('🔄 [MAIN] Received SIGTERM - shutting down gracefully...');
  app.quit();
});

process.on('SIGINT', () => {
  console.log('🔄 [MAIN] Received SIGINT - shutting down gracefully...');
  app.quit();
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
}); 