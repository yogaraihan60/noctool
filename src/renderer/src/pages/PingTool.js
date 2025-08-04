import React, { useState, useEffect } from 'react';
import { Activity, Globe, Wifi, Clock, BarChart3 } from 'lucide-react';
import usePersistentState from '../hooks/usePersistentState';

const PingTool = () => {
  // Use persistent state to maintain results across tab switches
  const { state, setData, addProcess, updateProcess } = usePersistentState('ping', 'ping-tool');
  
  const [pingType, setPingType] = useState('icmp');
  const [target, setTarget] = useState('');
  const [count, setCount] = useState(4);
  const [timeout, setTimeout] = useState(5000);
  const [interval, setInterval] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);

  // HTTP ping specific fields
  const [method, setMethod] = useState('GET');
  const [headers, setHeaders] = useState('');

  // ICMP ping specific fields
  const [packetSize, setPacketSize] = useState(56);
  const [ttl, setTtl] = useState(128);

  // Initialize results and statistics from persistent state
  const [results, setResults] = useState(state?.data?.results || []);
  const [statistics, setStatistics] = useState(state?.data?.statistics || null);

  // Update local state when persistent state changes
  useEffect(() => {
    if (state?.data) {
      setResults(state.data.results || []);
      setStatistics(state.data.statistics || null);
    }
  }, [state]);

  // Cleanup function for real-time listeners
  useEffect(() => {
    return () => {
      // Clean up listeners when component unmounts
      if (window.electronAPI && window.electronAPI.removePingUpdate) {
        window.electronAPI.removePingUpdate();
      }
    };
  }, []);

  const handlePing = async () => {
    console.log('🚀 [PING] Button clicked - Starting real-time ping operation');
    console.log('📊 [PING] Configuration:', {
      pingType,
      target,
      count,
      timeout,
      interval,
      method,
      headers,
      packetSize,
      ttl
    });

    if (!target.trim()) {
      console.log('❌ [PING] Error: No target specified');
      setError('Please enter a target');
      return;
    }

    console.log('⏳ [PING] Setting loading state and clearing previous results');
    setLoading(true);
    setError('');
    setResults([]);
    setStatistics(null);
    setProgress(null);

    // Clear persistent state for new operation
    await setData({ results: [], statistics: null });

    // Set up real-time update listener
    if (window.electronAPI && window.electronAPI.onPingUpdate) {
      window.electronAPI.onPingUpdate(async (update) => {
        console.log('📡 [PING] Received real-time update:', update);
        
        if (update.completed) {
          // Final update with complete results
          console.log('✅ [PING] Operation completed');
          setLoading(false);
          setStatistics(update.finalResult.statistics);
          setProgress(null);
          
          // Save final results to persistent state
          await setData({
            results: update.finalResult.results,
            statistics: update.finalResult.statistics,
            target: update.finalResult.target,
            timestamp: new Date().toISOString()
          });
        } else {
          // Individual ping result update
          const newResults = [...results];
          const existingIndex = newResults.findIndex(r => r.sequence === update.result.sequence);
          
          if (existingIndex >= 0) {
            // Update existing result
            newResults[existingIndex] = update.result;
          } else {
            // Add new result
            newResults.push(update.result);
          }
          
          // Sort by sequence number
          const sortedResults = newResults.sort((a, b) => a.sequence - b.sequence);
          setResults(sortedResults);
          setProgress(update.progress);
          
          // Save intermediate results to persistent state
          await setData({
            results: sortedResults,
            progress: update.progress,
            target: target,
            timestamp: new Date().toISOString()
          });
        }
      });
    }

    try {
      console.log('🔧 [PING] Building configuration object');
      let config = {
        count: parseInt(count),
        timeout: parseInt(timeout),
        interval: parseInt(interval)
      };

      if (pingType === 'http') {
        console.log('🌐 [PING] Configuring HTTP ping');
        config = {
          ...config,
          url: target,
          method: method,
          headers: parseHeaders(headers)
        };
        console.log('📡 [PING] Calling real-time HTTP ping API with config:', config);
        const result = await window.electronAPI.httpPingRealtime(config);
        console.log('✅ [PING] HTTP ping completed:', result);
      } else {
        console.log('📡 [PING] Configuring ICMP ping');
        config = {
          ...config,
          target: target,
          packetSize: parseInt(packetSize),
          ttl: parseInt(ttl)
        };
        console.log('📡 [PING] Calling real-time ICMP ping API with config:', config);
        const result = await window.electronAPI.icmpPingRealtime(config);
        console.log('✅ [PING] ICMP ping completed:', result);
      }
    } catch (err) {
      console.log('❌ [PING] Error occurred:', err);
      setError(err.message || 'Ping failed');
      setLoading(false);
      setProgress(null);
    }
  };

  const clearResults = () => {
    setResults([]);
    setStatistics(null);
    setProgress(null);
    setError('');
    // Clear persistent state
    setData({ results: [], statistics: null, progress: null });
  };

  const parseHeaders = (headerString) => {
    if (!headerString.trim()) return {};
    
    const headers = {};
    headerString.split('\n').forEach(line => {
      const [key, value] = line.split(':').map(s => s.trim());
      if (key && value) {
        headers[key] = value;
      }
    });
    return headers;
  };

  const formatLatency = (latency) => {
    if (latency === null || latency === undefined) return 'N/A';
    if (typeof latency !== 'number' || isNaN(latency)) return 'N/A';
    return `${latency.toFixed(2)} ms`;
  };

  const getStatusColor = (statusCode) => {
    if (statusCode >= 200 && statusCode < 300) return 'text-green-400';
    if (statusCode >= 300 && statusCode < 400) return 'text-yellow-400';
    if (statusCode >= 400 && statusCode < 500) return 'text-orange-400';
    if (statusCode >= 500) return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Ping Tool</h1>
        <p className="text-gray-400 mt-2">Test connectivity and measure latency</p>
      </div>

      {/* Configuration */}
      <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
        <h2 className="text-xl font-semibold text-white mb-4">Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ping Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Ping Type</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="icmp"
                  checked={pingType === 'icmp'}
                  onChange={(e) => {
                    console.log('🔄 [PING] Ping type changed to:', e.target.value);
                    setPingType(e.target.value);
                  }}
                  className="mr-2"
                />
                <Wifi className="w-4 h-4 mr-1" />
                ICMP Ping
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="http"
                  checked={pingType === 'http'}
                  onChange={(e) => {
                    console.log('🔄 [PING] Ping type changed to:', e.target.value);
                    setPingType(e.target.value);
                  }}
                  className="mr-2"
                />
                <Globe className="w-4 h-4 mr-1" />
                HTTP Ping
              </label>
            </div>
          </div>

          {/* Target */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Target {pingType === 'http' ? 'URL' : 'Host/IP'}
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => {
                console.log('🎯 [PING] Target changed to:', e.target.value);
                setTarget(e.target.value);
              }}
              placeholder={pingType === 'http' ? 'https://example.com' : '192.168.1.1 or example.com'}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          {/* Common Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Count</label>
            <input
              type="number"
              value={count}
              onChange={(e) => {
                console.log('🔢 [PING] Count changed to:', e.target.value);
                setCount(e.target.value);
              }}
              min="1"
              max="100"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Timeout (ms)</label>
            <input
              type="number"
              value={timeout}
              onChange={(e) => {
                console.log('⏱️ [PING] Timeout changed to:', e.target.value);
                setTimeout(e.target.value);
              }}
              min="1000"
              max="30000"
              step="1000"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Interval (ms)</label>
            <input
              type="number"
              value={interval}
              onChange={(e) => {
                console.log('⏰ [PING] Interval changed to:', e.target.value);
                setInterval(e.target.value);
              }}
              min="100"
              max="10000"
              step="100"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          {/* Type-specific settings */}
          {pingType === 'http' ? (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">HTTP Method</label>
              <select
                value={method}
                onChange={(e) => {
                  console.log('🌐 [PING] HTTP method changed to:', e.target.value);
                  setMethod(e.target.value);
                }}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Packet Size (bytes)</label>
                <input
                  type="number"
                  value={packetSize}
                  onChange={(e) => {
                    console.log('📦 [PING] Packet size changed to:', e.target.value);
                    setPacketSize(e.target.value);
                  }}
                  min="32"
                  max="65507"
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">TTL</label>
                <input
                  type="number"
                  value={ttl}
                  onChange={(e) => {
                    console.log('⏳ [PING] TTL changed to:', e.target.value);
                    setTtl(e.target.value);
                  }}
                  min="1"
                  max="255"
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* HTTP Headers */}
        {pingType === 'http' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Custom Headers (optional)</label>
            <textarea
              value={headers}
              onChange={(e) => {
                console.log('📋 [PING] Headers changed to:', e.target.value);
                setHeaders(e.target.value);
              }}
              placeholder="Content-Type: application/json&#10;User-Agent: Noctool/1.0"
              rows="3"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>
        )}

        <button
          onClick={handlePing}
          disabled={loading}
          className="mt-6 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {loading ? (
            <>
              <div className="spinner"></div>
              <span>Pinging in Real-time...</span>
            </>
          ) : (
            <>
              <Activity className="w-5 h-5" />
              <span>Start Real-time Ping</span>
            </>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Progress Indicator */}
      {progress && (
        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-white">Progress</h3>
            <span className="text-sm text-gray-400">
              {progress.current} / {progress.total} ({progress.percentage.toFixed(1)}%)
            </span>
          </div>
          <div className="w-full bg-dark-700 rounded-full h-2">
            <div 
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Results */}
      {(results.length > 0 || statistics) && (
        <div className="space-y-6">
          {/* Results Header with Clear Button */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Ping Results</h2>
            <button
              onClick={clearResults}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Clear Results
            </button>
          </div>

          {/* Summary Statistics */}
          {statistics && (
            <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Summary Statistics
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{statistics.total || 0}</p>
                  <p className="text-sm text-gray-400">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{statistics.successful || 0}</p>
                  <p className="text-sm text-gray-400">Successful</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">{statistics.failed || 0}</p>
                  <p className="text-sm text-gray-400">Failed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-400">
                    {statistics.avgLatency ? formatLatency(statistics.avgLatency) : 'N/A'}
                  </p>
                  <p className="text-sm text-gray-400">Avg Latency</p>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Results */}
          {results.length > 0 && (
            <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Ping Results ({results.length} received)
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-600">
                      <th className="text-left py-2 text-gray-300">#</th>
                      <th className="text-left py-2 text-gray-300">Latency</th>
                      {pingType === 'http' && (
                        <>
                          <th className="text-left py-2 text-gray-300">Status</th>
                          <th className="text-left py-2 text-gray-300">Size</th>
                        </>
                      )}
                      <th className="text-left py-2 text-gray-300">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr key={index} className="border-b border-dark-700">
                        <td className="py-2 text-white">{result.sequence}</td>
                        <td className="py-2 text-green-400">
                          {result.error ? (
                            <span className="text-red-400">Failed</span>
                          ) : result.alive === false ? (
                            <span className="text-red-400">No Response</span>
                          ) : (
                            pingType === 'http' 
                              ? formatLatency(result.latency)
                              : formatLatency(result.time)
                          )}
                        </td>
                        {pingType === 'http' && (
                          <>
                            <td className={`py-2 ${getStatusColor(result.statusCode)}`}>
                              {result.statusCode} {result.statusText}
                            </td>
                            <td className="py-2 text-gray-400">
                              {result.responseSize ? `${result.responseSize} bytes` : 'N/A'}
                            </td>
                          </>
                        )}
                        <td className="py-2 text-gray-400">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PingTool; 