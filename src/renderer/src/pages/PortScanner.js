import React, { useState, useEffect } from 'react';
import { Search, Settings, BarChart3, Clock } from 'lucide-react';

const PortScanner = () => {
  const [target, setTarget] = useState('');
  const [ports, setPorts] = useState('1-1024');
  const [scanType, setScanType] = useState('connect');
  const [timeout, setTimeout] = useState(5000);
  const [concurrency, setConcurrency] = useState(10);
  const [serviceDetection, setServiceDetection] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [openPorts, setOpenPorts] = useState([]);
  const [showOnlyOpen, setShowOnlyOpen] = useState(true);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 [PORTSCANNER] Component unmounting - cleaning up');
      if (window.electronAPI && window.electronAPI.removePortScanUpdate) {
        window.electronAPI.removePortScanUpdate();
      }
    };
  }, []);

  const handleScan = async () => {
    console.log('🚀 [PORTSCANNER] Button clicked - Starting real-time port scan operation');
    console.log('📊 [PORTSCANNER] Configuration:', {
      target,
      ports,
      scanType,
      timeout,
      concurrency,
      serviceDetection
    });

    if (!target.trim()) {
      console.log('❌ [PORTSCANNER] Error: No target specified');
      setError('Please enter a target');
      return;
    }

    // Check if this is a large port scan and ask for confirmation
    const portCount = calculatePortCount(ports);
    if (portCount > 1000) {
      const confirmed = window.confirm(
        `This will scan ${portCount} ports, which may take a long time and could be detected by security systems. Do you want to continue?`
      );
      if (!confirmed) {
        return;
      }
    }

    console.log('⏳ [PORTSCANNER] Setting loading state and clearing previous results');
    setLoading(true);
    setError('');
    setResults(null);
    setProgress(null);
    setOpenPorts([]);

    // Set up real-time update listener
    if (window.electronAPI && window.electronAPI.onPortScanUpdate) {
      window.electronAPI.onPortScanUpdate((update) => {
        console.log('📡 [PORTSCANNER] Received real-time update:', update);
        
        setProgress(update);
        
        // Update open ports list with newly discovered open ports
        if (update.recentResults) {
          const newOpenPorts = update.recentResults.filter(port => port.state === 'open');
          if (newOpenPorts.length > 0) {
            setOpenPorts(prevOpenPorts => {
              const existingPorts = new Set(prevOpenPorts.map(p => p.port));
              const uniqueNewPorts = newOpenPorts.filter(port => !existingPorts.has(port.port));
              return [...prevOpenPorts, ...uniqueNewPorts];
            });
          }
        }
      });
    }

    try {
      console.log('🔧 [PORTSCANNER] Building configuration object');
      const config = {
        target: target.trim(),
        ports: ports,
        scanType: scanType,
        timeout: parseInt(timeout),
        concurrency: parseInt(concurrency),
        serviceDetection: serviceDetection
      };

      console.log('📡 [PORTSCANNER] Calling real-time port scan API with config:', config);
      const result = await window.electronAPI.portScanRealtime(config);
      console.log('✅ [PORTSCANNER] Port scan completed:', result);

      if (result.success) {
        setResults(result);
        // Update open ports with final results
        const finalOpenPorts = result.results.filter(port => port.state === 'open');
        setOpenPorts(finalOpenPorts);
      } else {
        setError(result.error || 'Port scan failed');
      }
    } catch (err) {
      console.log('❌ [PORTSCANNER] Error occurred:', err);
      setError(err.message || 'Port scan failed');
    } finally {
      console.log('🏁 [PORTSCANNER] Operation completed, setting loading to false');
      setLoading(false);
      setProgress(null);
    }
  };

  const formatLatency = (latency) => {
    if (latency === null || latency === undefined) return 'N/A';
    if (typeof latency !== 'number' || isNaN(latency)) return 'N/A';
    return `${latency.toFixed(2)} ms`;
  };

  const calculatePortCount = (portString) => {
    if (!portString) return 0;
    
    let total = 0;
    const parts = portString.split(',').map(p => p.trim());
    
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(p => parseInt(p.trim()));
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          total += (end - start + 1);
        }
      } else {
        const port = parseInt(part);
        if (!isNaN(port)) {
          total += 1;
        }
      }
    }
    
    return total;
  };

  const getStateBgColor = (state) => {
    switch (state) {
      case 'open': return 'bg-green-500/20 text-green-400';
      case 'closed': return 'bg-red-500/20 text-red-400';
      case 'error': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Port Scanner</h1>
        <p className="text-gray-400 mt-2">Discover open ports and services</p>
      </div>

      {/* Configuration */}
      <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          Configuration
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Target Host/IP</label>
            <input
              type="text"
              value={target}
              onChange={(e) => {
                console.log('🎯 [PORTSCANNER] Target changed to:', e.target.value);
                setTarget(e.target.value);
              }}
              placeholder="example.com or 192.168.1.1"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Port Range</label>
            <input
              type="text"
              value={ports}
              onChange={(e) => {
                console.log('🔌 [PORTSCANNER] Port range changed to:', e.target.value);
                setPorts(e.target.value);
              }}
              placeholder="1-1024, 80, 443, 8080-8090"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Scan Type</label>
            <select
              value={scanType}
              onChange={(e) => {
                console.log('🔍 [PORTSCANNER] Scan type changed to:', e.target.value);
                setScanType(e.target.value);
              }}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            >
              <option value="connect">TCP Connect</option>
              <option value="syn">TCP SYN (Stealth)</option>
              <option value="udp">UDP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Timeout (ms)</label>
            <input
              type="number"
              value={timeout}
              onChange={(e) => {
                console.log('⏱️ [PORTSCANNER] Timeout changed to:', e.target.value);
                setTimeout(e.target.value);
              }}
              min="1000"
              max="30000"
              step="1000"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Concurrency</label>
            <input
              type="number"
              value={concurrency}
              onChange={(e) => {
                console.log('⚡ [PORTSCANNER] Concurrency changed to:', e.target.value);
                setConcurrency(e.target.value);
              }}
              min="1"
              max="100"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={serviceDetection}
                onChange={(e) => {
                  console.log('🔍 [PORTSCANNER] Service detection changed to:', e.target.checked);
                  setServiceDetection(e.target.checked);
                }}
                className="mr-2"
              />
              <span className="text-sm text-gray-300">Service Detection</span>
            </label>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleScan}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Search className="w-5 h-5" />
            <span>{loading ? 'Scanning in Real-time...' : 'Start Real-time Scan'}</span>
          </button>
        </div>
      </div>

      {/* Progress Indicator */}
      {progress && (
        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-white">Scan Progress</h3>
            <span className="text-sm text-gray-400">
              {progress.completed} / {progress.total} ({progress.percentage.toFixed(1)}%)
            </span>
          </div>
          <div className="w-full bg-dark-700 rounded-full h-2">
            <div 
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
          <div className="mt-2 text-sm text-gray-400">
            Chunk {progress.currentChunk} of {progress.totalChunks} • {openPorts.length} open ports found
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="text-red-400 font-medium">Error</div>
          <div className="text-red-300 text-sm mt-1">{error}</div>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="space-y-6">
          {/* Statistics */}
          <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Scan Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-400">{results.statistics.total}</div>
                <div className="text-sm text-gray-400">Total Ports</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{results.statistics.open}</div>
                <div className="text-sm text-gray-400">Open</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{results.statistics.closed}</div>
                <div className="text-sm text-gray-400">Closed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{results.statistics.error}</div>
                <div className="text-sm text-gray-400">Errors</div>
              </div>
            </div>
            {results.statistics.avgLatency && (
              <div className="mt-4 text-center">
                <div className="text-lg font-bold text-blue-400">
                  {formatLatency(results.statistics.avgLatency)}
                </div>
                <div className="text-sm text-gray-400">Average Latency</div>
              </div>
            )}
          </div>

          {/* Port Results */}
          <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {showOnlyOpen ? 'Open Ports' : 'All Port Results'} 
                {showOnlyOpen && openPorts.length > 0 && (
                  <span className="text-sm text-gray-400 ml-2">({openPorts.length} found)</span>
                )}
              </h3>
              <button
                onClick={() => setShowOnlyOpen(!showOnlyOpen)}
                className="px-3 py-1 text-sm bg-dark-700 text-gray-300 rounded hover:bg-dark-600 transition-colors"
              >
                {showOnlyOpen ? 'Show All' : 'Show Open Only'}
              </button>
            </div>
            
            <div className="space-y-2">
              {(showOnlyOpen ? openPorts : results.results).map((port, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 text-sm text-gray-400 font-mono">
                      {port.port}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">
                        {port.service || 'Unknown Service'}
                      </div>
                      <div className="text-sm text-gray-400">
                        {port.state === 'open' ? 'Port is open and accepting connections' : 
                         port.state === 'closed' ? 'Port is closed' : 
                         'Connection error'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium px-2 py-1 rounded ${getStateBgColor(port.state)}`}>
                      {port.state.toUpperCase()}
                    </div>
                    {port.latency && (
                      <div className="text-xs text-gray-400 mt-1">
                        {formatLatency(port.latency)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {showOnlyOpen && openPorts.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-lg font-medium mb-2">No Open Ports Found</div>
                  <div className="text-sm">All scanned ports appear to be closed or filtered.</div>
                </div>
              )}
            </div>
          </div>

          {/* Scan Info */}
          <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Scan Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-gray-400">Target:</span>
                <span className="text-white ml-2">{results.target}</span>
              </div>
              <div>
                <span className="text-gray-400">IP Address:</span>
                <span className="text-white ml-2">{results.ipAddress}</span>
              </div>
              <div>
                <span className="text-gray-400">Scan Type:</span>
                <span className="text-white ml-2">{results.scanType}</span>
              </div>
              <div>
                <span className="text-gray-400">Timestamp:</span>
                <span className="text-white ml-2">{new Date(results.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortScanner; 