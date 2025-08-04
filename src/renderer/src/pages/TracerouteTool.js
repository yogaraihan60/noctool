import React, { useState, useEffect } from 'react';
import { Route, Settings, BarChart3, Activity, Maximize2, Minimize2, Globe, Wifi, Zap, RotateCcw, BarChart, TrendingUp } from 'lucide-react';
import HopChart from '../components/HopChart';
import usePersistentState from '../hooks/usePersistentState';

const TracerouteTool = () => {
  // Use persistent state to maintain results across tab switches
  const { state, setData, addProcess, updateProcess } = usePersistentState('traceroute', 'traceroute-tool');
  
  const [target, setTarget] = useState('');
  const [maxHops, setMaxHops] = useState(30);
  const [timeout] = useState(0); // No timeout by default
  const [protocol, setProtocol] = useState('icmp');
  const [port, setPort] = useState('');
  const [resolveHosts, setResolveHosts] = useState(true);
  const [hostnameTimeout, setHostnameTimeout] = useState(5000);
  const [pingHops, setPingHops] = useState(true);
  const [realTime, setRealTime] = useState(true);
  const [continuous, setContinuous] = useState(false);
  const [interval, setInterval] = useState(5000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [showGraph, setShowGraph] = useState(false);
  const [continuousSession, setContinuousSession] = useState(null);
  const [runCount, setRunCount] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);
  // eslint-disable-next-line no-unused-vars
  const [expandedHop, setExpandedHop] = useState(null);
  const [showHopCharts, setShowHopCharts] = useState(true);
  // Hop filtering options
  const [skipSlowHops, setSkipSlowHops] = useState(true);
  const [slowHopThreshold, setSlowHopThreshold] = useState(50);
  const [skipPacketLoss, setSkipPacketLoss] = useState(true);
  const [prioritizeFastHops, setPrioritizeFastHops] = useState(true);
  const [maxHopsToProcess, setMaxHopsToProcess] = useState(15);

  // Initialize results and current hops from persistent state
  const [results, setResults] = useState(state?.data?.results || null);
  const [currentHops, setCurrentHops] = useState(state?.data?.currentHops || []);
  const [continuousData, setContinuousData] = useState(state?.data?.continuousData || []);

  // Update local state when persistent state changes
  useEffect(() => {
    if (state?.data) {
      setResults(state.data.results || null);
      setCurrentHops(state.data.currentHops || []);
      setContinuousData(state.data.continuousData || []);
      setShowGraph(!!state.data.results);
    }
  }, [state]);

  // Clean up listeners and processes on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 [TRACEROUTE] Component unmounting - cleaning up');
      window.electronAPI.removeTracerouteUpdate();
      window.electronAPI.removeContinuousTracerouteListeners();
      
      // Stop continuous traceroute if running
      if (continuousSession) {
        console.log('🔄 [TRACEROUTE] Stopping continuous traceroute on unmount');
        window.electronAPI.stopContinuousTraceroute(continuousSession);
      }
      
      // Reset loading state on unmount
      setLoading(false);
    };
  }, [continuousSession]);

  // Set up all traceroute listeners
  useEffect(() => {
    // Set up continuous traceroute listeners
    window.electronAPI.onContinuousTracerouteUpdate(async (update) => {
      console.log('📡 [TRACEROUTE] Continuous update received:', update);
      
      if (update.type === 'continuous_hop') {
        setContinuousData(update.allHops);
        setRunCount(update.runNumber);
        setSessionDuration(update.duration);
        
        // Save to persistent state
        await setData({
          continuousData: update.allHops,
          runCount: update.runNumber,
          sessionDuration: update.duration,
          target: target,
          timestamp: new Date().toISOString()
        });
      }
    });

    window.electronAPI.onContinuousTracerouteComplete(async (update) => {
      console.log('✅ [TRACEROUTE] Continuous traceroute completed:', update);
      setLoading(false);
      
      // Save final results to persistent state
      await setData({
        results: update.data,
        continuousData: update.allHops,
        loading: false,
        target: target,
        timestamp: new Date().toISOString()
      });
    });

    // Set up real-time traceroute listeners
    window.electronAPI.onTracerouteUpdate(async (update) => {
      console.log('📡 [TRACEROUTE] Real-time update received:', update);
      
      if (update.type === 'hop') {
        const newCurrentHops = [...currentHops, update.data];
        setCurrentHops(newCurrentHops);
        setProgress(update.progress);
        
        // Save intermediate results to persistent state
        await setData({
          currentHops: newCurrentHops,
          progress: update.progress,
          target: target,
          timestamp: new Date().toISOString()
        });
      } else if (update.type === 'complete') {
        setResults(update.data);
        setLoading(false);
        setShowGraph(true);
        
        // Save final results to persistent state
        await setData({
          results: update.data,
          currentHops: currentHops,
          loading: false,
          showGraph: true,
          target: target,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Safety mechanism: reset loading state if it gets stuck
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.log('⚠️ [TRACEROUTE] Loading state stuck for too long, resetting...');
        setLoading(false);
        setError('Operation timed out. Please try again.');
      }
    }, 30000); // 30 seconds timeout

    return () => {
      window.electronAPI.removeContinuousTracerouteListeners();
      window.electronAPI.removeTracerouteUpdate();
      clearTimeout(loadingTimeout);
    };
  }, [loading]); // Include loading in dependencies to reset timeout when loading changes

  const handleTraceroute = async () => {
    console.log('🚀 [TRACEROUTE] Button clicked - Starting traceroute operation');
    console.log('📊 [TRACEROUTE] Configuration:', {
      target,
      maxHops,
      skipSlowHops,
      slowHopThreshold,
      skipPacketLoss,
      prioritizeFastHops,
      maxHopsToProcess,
      timeout,
      protocol,
      port,
      resolveHosts,
      pingHops,
      realTime,
      continuous,
      interval
    });

    if (!target.trim()) {
      console.log('❌ [TRACEROUTE] Error: No target specified');
      setError('Please enter a target');
      return;
    }

    // Ask for confirmation for continuous mode
    if (continuous) {
      const confirmed = window.confirm(
        'Continuous mode will run indefinitely until manually stopped. This may generate significant network traffic. Do you want to continue?'
      );
      if (!confirmed) {
        return;
      }
    }

    console.log('⏳ [TRACEROUTE] Setting loading state and clearing previous results');
    setLoading(true);
    setError('');
    setResults(null);
    setProgress(null);
    setCurrentHops([]);
    setShowGraph(false);
    
    if (continuous) {
      setContinuousData([]);
      setRunCount(0);
      setSessionDuration(0);
    }

    // Clear persistent state for new operation
    await setData({
      results: null,
      currentHops: [],
      continuousData: continuous ? [] : undefined,
      progress: null,
      loading: true
    });

    // Clear previous results and set up for new run
    setCurrentHops([]);
    setProgress(null);

    try {
      console.log('🔧 [TRACEROUTE] Building configuration object');
      const config = {
        target: target,
        maxHops: parseInt(maxHops),
        timeout: parseInt(timeout),
        protocol: protocol,
        port: port ? parseInt(port) : null,
        resolveHosts: resolveHosts,
        hostnameTimeout: parseInt(hostnameTimeout),
        pingHops: pingHops,
        realTime: realTime,
        interval: parseInt(interval),
        skipSlowHops: skipSlowHops,
        slowHopThreshold: parseInt(slowHopThreshold),
        skipPacketLoss: skipPacketLoss,
        prioritizeFastHops: prioritizeFastHops,
        maxHopsToProcess: parseInt(maxHopsToProcess)
      };

      console.log('📡 [TRACEROUTE] Calling traceroute API with config:', config);
      
      if (continuous) {
        // Use continuous traceroute
        const result = await window.electronAPI.startContinuousTraceroute(config);
        console.log('✅ [TRACEROUTE] Continuous traceroute started:', result);
        if (result.success) {
          setContinuousSession(result.sessionId);
          setLoading(false);
          setShowGraph(true);
        } else {
          setError(result.error || 'Continuous traceroute failed');
          setLoading(false);
        }
      } else if (realTime) {
        // Use real-time traceroute
        const result = await window.electronAPI.tracerouteRealtime(config);
        console.log('✅ [TRACEROUTE] Real-time traceroute completed:', result);
        if (!result.success) {
          setError(result.error || 'Traceroute failed');
          setLoading(false);
        }
      } else {
        // Use regular traceroute
        const result = await window.electronAPI.traceroute(config);
        console.log('✅ [TRACEROUTE] Traceroute completed:', result);
        setResults(result);
        setLoading(false);
        setShowGraph(true);
      }
    } catch (err) {
      console.log('❌ [TRACEROUTE] Error occurred:', err);
      setError(err.message || 'Traceroute failed');
      setLoading(false);
    }
  };

  const handleStopContinuous = async () => {
    console.log('🛑 [TRACEROUTE] Stopping continuous traceroute');
    
    // Force reset loading state immediately
    setLoading(false);
    
    if (continuousSession) {
      try {
        const result = await window.electronAPI.stopContinuousTraceroute(continuousSession);
        console.log('✅ [TRACEROUTE] Continuous traceroute stopped:', result);
        setContinuousSession(null);
      } catch (err) {
        console.log('❌ [TRACEROUTE] Error stopping continuous traceroute:', err);
        setError('Failed to stop continuous traceroute');
        setContinuousSession(null);
      }
    } else {
      // If no session, just reset the state
      setContinuousSession(null);
    }
  };

  const handleForceReset = () => {
    console.log('🔄 [TRACEROUTE] Force reset triggered');
    setLoading(false);
    setError('');
    setProgress(null);
    setCurrentHops([]);
    setResults(null);
    setShowGraph(false);
    setContinuousData([]);
    setRunCount(0);
    setSessionDuration(0);
    setContinuousSession(null);
    
    // Clear persistent state
    setData({
      results: null,
      currentHops: [],
      continuousData: [],
      progress: null
    });
  };

  const clearResults = () => {
    setResults(null);
    setCurrentHops([]);
    setContinuousData([]);
    setShowGraph(false);
    setRunCount(0);
    setSessionDuration(0);
    setError('');
    setProgress(null);
    
    // Clear persistent state
    setData({
      results: null,
      currentHops: [],
      continuousData: [],
      progress: null
    });
  };

  const formatLatency = (times) => {
    if (!times || times.length === 0) return 'N/A';
    const validTimes = times.filter(t => typeof t === 'number' && !isNaN(t));
    if (validTimes.length === 0) return 'N/A';
    const avg = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    return `${avg.toFixed(2)} ms`;
  };

  const getHopStatus = (hop) => {
    if (hop.isReachable === true) return 'pingable';
    if (hop.isReachable === false) return 'unreachable';
    if (hop.times && hop.times.length > 0) return 'reachable';
    return 'unknown';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'reachable':
      case 'pingable':
        return 'text-green-400';
      case 'unreachable':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusBgColor = (status) => {
    switch (status) {
      case 'reachable':
      case 'pingable':
        return 'bg-green-500/20 text-green-400';
      case 'unreachable':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const renderLatencyGraph = () => {
    if (!displayHops || displayHops.length === 0) return null;

    // Calculate max latency from ping history or fallback to avgLatency
    const maxLatency = Math.max(...displayHops.map(hop => {
      // First try to get latency from ping history
      if (hop.pingHistory && hop.pingHistory.length > 0) {
        const validPings = hop.pingHistory.filter(p => p.latency && typeof p.latency === 'number');
        if (validPings.length > 0) {
          return Math.max(...validPings.map(p => p.latency));
        }
      }
      
      // Fallback to avgLatency or times
      const latency = hop.times && hop.times.length > 0
        ? Math.max(...hop.times.filter(t => typeof t === 'number'))
        : (typeof hop.avgLatency === 'number' && !isNaN(hop.avgLatency) ? hop.avgLatency : 0);
      return latency;
    }));

    return (
      <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2" />
          Latency Graph
        </h3>
        <div className="space-y-2">
          {displayHops.map((hop, index) => {
            // Get latency from ping history first, then fallback
            let latency = 0;
            let pingCount = 0;
            let timeoutCount = 0;
            let slowPingCount = 0; // Declare slowPingCount in outer scope
            
            if (hop.pingHistory && hop.pingHistory.length > 0) {
              const validPings = hop.pingHistory.filter(p => p.latency && typeof p.latency === 'number');
              timeoutCount = hop.pingHistory.filter(p => p.isLongTimeout).length; // Count 1000ms+ timeouts
              slowPingCount = hop.pingHistory.filter(p => p.isSlowPing).length; // Count slow pings >100ms
              pingCount = hop.pingHistory.length;
              
              if (validPings.length > 0) {
                latency = validPings.reduce((sum, p) => sum + p.latency, 0) / validPings.length;
              }
            } else {
              // Initialize variables for hops without ping history
              timeoutCount = 0;
              slowPingCount = 0;
              pingCount = 0;
              // Fallback to original method
              latency = hop.times && hop.times.length > 0
                ? Math.max(...hop.times.filter(t => typeof t === 'number'))
                : (typeof hop.avgLatency === 'number' && !isNaN(hop.avgLatency) ? hop.avgLatency : 0);
            }
            
            const percentage = maxLatency > 0 ? (latency / maxLatency) * 100 : 0;
            
            return (
              <div key={index} className="flex items-center space-x-4">
                <div className="w-12 text-sm text-gray-400 font-mono">
                  {hop.hop}
                </div>
                <div className="flex-1 bg-dark-700 rounded-full h-4 overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-300 ${
                      timeoutCount > 0 ? 'bg-red-500' : 
                      slowPingCount > 0 ? 'bg-orange-500' : 'bg-primary-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                  {/* Red dots for timeout entries above 1000ms */}
                  {hop.pingHistory && hop.pingHistory.length > 0 && hop.pingHistory.some(p => p.isLongTimeout) && (
                    <div className="absolute top-0 right-0 w-2 h-2 bg-red-800 rounded-full border border-white transform translate-x-1 -translate-y-1" 
                         title={`${hop.pingHistory.filter(p => p.isLongTimeout).length} timeout(s) at 1000ms+`} />
                  )}
                  {/* Red dots for slow ping entries above 100ms */}
                  {hop.pingHistory && hop.pingHistory.length > 0 && hop.pingHistory.some(p => p.isSlowPing) && (
                    <div className="absolute top-0 right-1 w-2 h-2 bg-red-600 rounded-full border border-white transform translate-x-1 -translate-y-1" 
                         title={`${hop.pingHistory.filter(p => p.isSlowPing).length} slow ping(s) >100ms`} />
                  )}
                </div>
                <div className="w-24 text-sm text-gray-300 font-mono">
                  {latency > 0 ? `${latency.toFixed(1)}ms` : 'N/A'}
                  {pingCount > 0 && (
                    <span className="text-xs text-gray-500 ml-1">
                      ({pingCount - timeoutCount}/{pingCount})
                      {timeoutCount > 0 && (
                        <span className="text-red-400 font-semibold"> 1000ms+</span>
                      )}
                      {slowPingCount > 0 && (
                        <span className="text-orange-400 font-semibold"> SLOW</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const displayHops = continuous ? continuousData : (realTime && loading ? currentHops : (results?.hops || []));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Traceroute</h1>
        <p className="text-gray-400 mt-2">Map network path to destination with real-time updates</p>
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
                console.log('🎯 [TRACEROUTE] Target changed to:', e.target.value);
                setTarget(e.target.value);
              }}
              placeholder="example.com or 192.168.1.1"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Max Hops</label>
            <input
              type="number"
              value={maxHops}
              onChange={(e) => {
                console.log('🔢 [TRACEROUTE] Max hops changed to:', e.target.value);
                setMaxHops(e.target.value);
              }}
              min="1"
              max="64"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Protocol</label>
            <select
              value={protocol}
              onChange={(e) => {
                console.log('🌐 [TRACEROUTE] Protocol changed to:', e.target.value);
                setProtocol(e.target.value);
              }}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            >
              <option value="icmp">ICMP</option>
              <option value="udp">UDP</option>
              <option value="tcp">TCP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Port (for TCP/UDP)</label>
            <input
              type="number"
              value={port}
              onChange={(e) => {
                console.log('🔌 [TRACEROUTE] Port changed to:', e.target.value);
                setPort(e.target.value);
              }}
              placeholder="80"
              min="1"
              max="65535"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="bg-dark-700 rounded-lg p-6 border border-dark-600 col-span-full">
            <label className="block text-sm font-medium text-gray-300 mb-4">Configuration Options</label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Network Options */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Network</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => {
                      console.log('🔍 [TRACEROUTE] Resolve hosts changed to:', !resolveHosts);
                      setResolveHosts(!resolveHosts);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                      resolveHosts
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                        : 'bg-dark-600 text-gray-400 border border-dark-500 hover:bg-dark-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="flex items-center">
                      <Globe className={`w-4 h-4 mr-2 ${resolveHosts ? 'text-white' : 'text-gray-500'}`} />
                      Resolve Hostnames
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      console.log('🏓 [TRACEROUTE] Ping hops changed to:', !pingHops);
                      setPingHops(!pingHops);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                      pingHops
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                        : 'bg-dark-600 text-gray-400 border border-dark-500 hover:bg-dark-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="flex items-center">
                      <Wifi className={`w-4 h-4 mr-2 ${pingHops ? 'text-white' : 'text-gray-500'}`} />
                      Ping Each Hop
                    </span>
                  </button>
                </div>
              </div>

              {/* Execution Mode */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Execution</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => {
                      console.log('⚡ [TRACEROUTE] Real-time changed to:', !realTime);
                      setRealTime(!realTime);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                      realTime
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                        : 'bg-dark-600 text-gray-400 border border-dark-500 hover:bg-dark-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="flex items-center">
                      <Zap className={`w-4 h-4 mr-2 ${realTime ? 'text-white' : 'text-gray-500'}`} />
                      Real-time Updates
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      console.log('🔄 [TRACEROUTE] Continuous mode changed to:', !continuous);
                      setContinuous(!continuous);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                      continuous
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                        : 'bg-dark-600 text-gray-400 border border-dark-500 hover:bg-dark-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="flex items-center">
                      <RotateCcw className={`w-4 h-4 mr-2 ${continuous ? 'text-white' : 'text-gray-500'}`} />
                      Continuous Mode
                    </span>
                  </button>
                </div>
              </div>

              {/* Hop Filtering */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Hop Filtering</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => {
                      console.log('⏭️ [TRACEROUTE] Skip slow hops changed to:', !skipSlowHops);
                      setSkipSlowHops(!skipSlowHops);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                      skipSlowHops
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                        : 'bg-dark-600 text-gray-400 border border-dark-500 hover:bg-dark-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="flex items-center">
                      <Activity className={`w-4 h-4 mr-2 ${skipSlowHops ? 'text-white' : 'text-gray-500'}`} />
                      Skip Slow Hops
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      console.log('📦 [TRACEROUTE] Skip packet loss changed to:', !skipPacketLoss);
                      setSkipPacketLoss(!skipPacketLoss);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                      skipPacketLoss
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                        : 'bg-dark-600 text-gray-400 border border-dark-500 hover:bg-dark-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="flex items-center">
                      <TrendingUp className={`w-4 h-4 mr-2 ${skipPacketLoss ? 'text-white' : 'text-gray-500'}`} />
                      Skip Packet Loss
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      console.log('⚡ [TRACEROUTE] Prioritize fast hops changed to:', !prioritizeFastHops);
                      setPrioritizeFastHops(!prioritizeFastHops);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                      prioritizeFastHops
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                        : 'bg-dark-600 text-gray-400 border border-dark-500 hover:bg-dark-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="flex items-center">
                      <BarChart className={`w-4 h-4 mr-2 ${prioritizeFastHops ? 'text-white' : 'text-gray-500'}`} />
                      Prioritize Fast Hops
                    </span>
                  </button>
                </div>
              </div>

              {/* Visualization Options */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Visualization</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => {
                      console.log('📊 [TRACEROUTE] Show graph changed to:', !showGraph);
                      setShowGraph(!showGraph);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                      showGraph
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                        : 'bg-dark-600 text-gray-400 border border-dark-500 hover:bg-dark-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="flex items-center">
                      <BarChart className={`w-4 h-4 mr-2 ${showGraph ? 'text-white' : 'text-gray-500'}`} />
                      Show Latency Graph
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      console.log('📈 [TRACEROUTE] Show hop charts changed to:', !showHopCharts);
                      setShowHopCharts(!showHopCharts);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                      showHopCharts
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                        : 'bg-dark-600 text-gray-400 border border-dark-500 hover:bg-dark-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="flex items-center">
                      <TrendingUp className={`w-4 h-4 mr-2 ${showHopCharts ? 'text-white' : 'text-gray-500'}`} />
                      Show Hop Charts
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {continuous && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Update Interval (ms)</label>
              <input
                type="number"
                value={interval}
                onChange={(e) => {
                  console.log('⏱️ [TRACEROUTE] Interval changed to:', e.target.value);
                  setInterval(e.target.value);
                }}
                min="1000"
                max="60000"
                step="1000"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
              />
            </div>
          )}

          {resolveHosts && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Hostname Resolution Timeout (ms)</label>
              <input
                type="number"
                value={hostnameTimeout}
                onChange={(e) => {
                  console.log('⏱️ [TRACEROUTE] Hostname timeout changed to:', e.target.value);
                  setHostnameTimeout(e.target.value);
                }}
                min="1000"
                max="30000"
                step="1000"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
              />
            </div>
          )}

          {skipSlowHops && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Slow Hop Threshold (ms)</label>
              <input
                type="number"
                value={slowHopThreshold}
                onChange={(e) => {
                  console.log('⏭️ [TRACEROUTE] Slow hop threshold changed to:', e.target.value);
                  setSlowHopThreshold(e.target.value);
                }}
                min="10"
                max="500"
                step="10"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Max Hops to Process</label>
            <input
              type="number"
              value={maxHopsToProcess}
              onChange={(e) => {
                console.log('📊 [TRACEROUTE] Max hops to process changed to:', e.target.value);
                setMaxHopsToProcess(e.target.value);
              }}
              min="1"
              max={maxHops}
              step="1"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>

        <div className="mt-6 flex space-x-4">
          {!continuous || !continuousSession ? (
            <button
              onClick={handleTraceroute}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Route className="w-5 h-5" />
              <span>{loading ? 'Running...' : 'Start Traceroute'}</span>
            </button>
          ) : (
            <button
              onClick={handleStopContinuous}
              className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Activity className="w-5 h-5" />
              <span>Stop Continuous</span>
            </button>
          )}
          
          {/* Force Reset Button - Always visible for emergency situations */}
          <button
            onClick={handleForceReset}
            className="flex items-center space-x-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            title="Force reset all states (emergency use)"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Force Reset</span>
          </button>
        </div>
      </div>

      {/* Continuous Mode Status */}
      {continuous && continuousSession && (
        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Continuous Mode Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-400">{runCount}</div>
              <div className="text-sm text-gray-400">Runs Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{continuousData.length}</div>
              <div className="text-sm text-gray-400">Hops Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {Math.round(sessionDuration / 1000)}s
              </div>
              <div className="text-sm text-gray-400">Session Duration</div>
            </div>
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

      {/* Progress Display */}
      {progress && (
        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <h3 className="text-lg font-semibold text-white mb-4">Progress</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Current Hop</span>
              <span className="text-white">{progress.currentHop}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Max Hops</span>
              <span className="text-white">{progress.maxHops}</span>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.currentHop / progress.maxHops) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {displayHops && displayHops.length > 0 && (
        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <h3 className="text-lg font-semibold text-white mb-4">Traceroute Results</h3>
          <div className="space-y-2">
            {displayHops.map((hop, index) => (
              <div key={index} className="flex items-center space-x-4 p-3 bg-dark-700 rounded-lg">
                <div className="w-12 text-sm text-gray-400 font-mono">
                  {hop.hop}
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">
                    {hop.hostname || hop.ip || 'Unknown'}
                  </div>
                  {hop.ip && hop.hostname && (
                    <div className="text-sm text-gray-400">{hop.ip}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${getStatusColor(getHopStatus(hop))}`}>
                    {formatLatency(hop.times)}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${getStatusBgColor(getHopStatus(hop))}`}>
                    {getHopStatus(hop)}
                  </div>
                </div>
                
                {/* Hop Details for Continuous Mode */}
                {continuous && hop.history && hop.history.length > 0 && (
                  <div className="text-sm text-gray-400">
                    <div>Last seen: Run #{hop.history[hop.history.length - 1].runNumber}</div>
                    <div>History: {hop.history.length} entries</div>
                  </div>
                )}
                
                {/* Ping Results */}
                {hop.avgLatency && typeof hop.avgLatency === 'number' && !isNaN(hop.avgLatency) && (
                  <div className="text-sm text-gray-400">
                    <div>Ping: {hop.avgLatency.toFixed(1)}ms</div>
                    {hop.pingCount && (
                      <div className="text-primary-400 font-semibold">P#{hop.pingCount}</div>
                    )}
                    {/* Hop Filtering Status */}
                    {hop.networkBehavior && hop.networkBehavior.slowHop && hop.networkBehavior.slowHop.shouldSkip && (
                      <div className="text-red-400 text-xs font-medium">⏭️ SKIPPED</div>
                    )}
                    {hop.networkBehavior && hop.networkBehavior.behavior === 'LIMITED_BY_MAX_HOPS' && (
                      <div className="text-yellow-400 text-xs font-medium">📊 LIMITED</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hop Charts */}
      {showHopCharts && displayHops && displayHops.length > 0 && (
        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Individual Hop Statistics
            </h3>
            <button
              onClick={() => setShowHopCharts(!showHopCharts)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {showHopCharts ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayHops
              .filter(hop => hop.pingHistory && hop.pingHistory.length > 0)
              .map((hop, index) => (
                <div key={hop.hopKey || `${hop.hop}_${hop.ip || 'unknown'}`}>
                  <HopChart 
                    hop={hop} 
                    isExpanded={expandedHop === hop.hopKey || expandedHop === `${hop.hop}_${hop.ip || 'unknown'}`}
                  />
                </div>
              ))}
          </div>
          
          {displayHops.filter(hop => hop.pingHistory && hop.pingHistory.length > 0).length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No ping history available yet. Start a continuous traceroute to see individual hop statistics.</p>
            </div>
          )}
        </div>
      )}

      {/* Latency Graph */}
      {showGraph && displayHops && displayHops.length > 0 && renderLatencyGraph()}
    </div>
  );
};

export default TracerouteTool; 