const dns = require('dns').promises;
const ping = require('ping');

/**
 * Processes and enriches individual hop data
 */
class HopProcessor {
  constructor() {
    this.hopPingCounters = new Map(); // Track ping count per hop
  }

  /**
   * Process raw hop data and enrich with additional information
   */
  async processHop(hopData, config, runNumber = null, sessionId = null, pingImmediately = true) {
    try {
      // Parse the hop data
      const hop = typeof hopData === 'string' ? JSON.parse(hopData) : hopData;
      
      // Generate hop key for tracking
      const hopKey = `${hop.hop}_${hop.ip || 'unknown'}`;
      
      // Initialize or increment ping counter
      if (!this.hopPingCounters.has(hopKey)) {
        this.hopPingCounters.set(hopKey, 0);
      }
      const pingCount = this.hopPingCounters.get(hopKey) + 1;
      this.hopPingCounters.set(hopKey, pingCount);
      
      const hopInfo = {
        hop: hop.hop,
        ip: hop.ip === '*' ? null : hop.ip,
        hostname: null,
        times: hop.rtt1 === '*' ? [] : [parseFloat(hop.rtt1)],
        pingResults: null,
        isReachable: false,
        avgLatency: null,
        packetLoss: null,
        pingCount: config.continuousPing ? pingCount : null,
        hopKey: hopKey,
        runNumber,
        sessionId,
        timestamp: Date.now()
      };

      // Try to resolve hostname if IP is available
      if (hopInfo.ip && config.resolveHosts) {
        try {
          // Use configurable timeout for hostname resolution
          const hostname = await this.resolveHostnameWithTimeout(hopInfo.ip, config.hostnameTimeout || 5000);
          hopInfo.hostname = hostname;
        } catch (error) {
          // Hostname resolution failed, keep as null
          console.log(`⚠️ [HopProcessor] Could not resolve hostname for ${hopInfo.ip}: ${error.message}`);
        }
      }

      // Ping the hop if enabled, IP is available, and pingImmediately is true
      if (pingImmediately && config.pingHops && hopInfo.ip) {
        await this.pingHop(hopInfo);
      }

      return hopInfo;
    } catch (error) {
      console.error('❌ [HopProcessor] Error processing hop:', error);
      throw error;
    }
  }

  /**
   * Ping a specific hop and update hop information
   */
  async pingHop(hopInfo) {
    try {
      // Use the same ultra-aggressive timeout strategy
      const pingResult = await this.pingHopWithRetry(hopInfo.ip, 300);
      
      hopInfo.pingResults = pingResult;
      hopInfo.isReachable = pingResult.alive;
      hopInfo.avgLatency = (typeof pingResult.time === 'number' && !isNaN(pingResult.time)) ? pingResult.time : null;
      hopInfo.packetLoss = pingResult.packetLoss || null;

      // Add to ping history with timeout tracking
      this.addRecentPing(hopInfo, pingResult, 300);
      
    } catch (error) {
      console.log(`⚠️ [HopProcessor] Ping failed for ${hopInfo.ip}: ${error.message}`);
      hopInfo.pingResults = { error: error.message };
      hopInfo.isReachable = false;
      
      // Add failed ping to history
      this.addRecentPing(hopInfo, { alive: false, time: null }, 300);
    }
  }

  /**
   * Update hop with run history for continuous mode
   */
  updateHopHistory(hopData, allHops) {
    const hopKey = hopData.hopKey || `${hopData.hop}_${hopData.ip || 'unknown'}`;
    
    if (!allHops.has(hopKey)) {
      allHops.set(hopKey, {
        ...hopData,
        history: [],
        pingHistory: []
      });
    }

    const hop = allHops.get(hopKey);
    
    // Add to run history
    hop.history.push({
      runNumber: hopData.runNumber,
      timestamp: hopData.timestamp,
      times: hopData.times,
      avgLatency: hopData.avgLatency,
      isReachable: hopData.isReachable
    });

    // Add to ping history if we have latency data
    if (hopData.avgLatency && typeof hopData.avgLatency === 'number') {
      hop.pingHistory.push({
        pingNumber: hopData.pingCount || 1,
        timestamp: hopData.timestamp,
        latency: hopData.avgLatency,
        isReachable: hopData.isReachable
      });
    }

    // Keep only last 20 ping entries for performance
    if (hop.pingHistory.length > 20) {
      hop.pingHistory.shift();
    }

    // Keep only last 10 runs for performance
    if (hop.history.length > 10) {
      hop.history.shift();
    }

    return hop;
  }

  /**
   * Get ping statistics for a specific hop
   */
  getHopPingStatistics(hopKey) {
    const pingCount = this.hopPingCounters.get(hopKey) || 0;
    return {
      totalPings: pingCount,
      pingCount: pingCount
    };
  }

  /**
   * Resolve hostname with timeout
   */
  async resolveHostnameWithTimeout(ip, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Hostname resolution timeout'));
      }, timeoutMs);

      dns.reverse(ip)
        .then((hostnames) => {
          clearTimeout(timeout);
          resolve(hostnames[0] || null);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Reset ping counters for a specific hop or all hops
   */
  resetPingCounters(hopKey = null) {
    if (hopKey) {
      this.hopPingCounters.delete(hopKey);
    } else {
      this.hopPingCounters.clear();
    }
  }

  /**
   * Format latency for display
   */
  formatLatency(times) {
    if (!times || times.length === 0) return 'N/A';
    const validTimes = times.filter(t => typeof t === 'number' && !isNaN(t));
    if (validTimes.length === 0) return 'N/A';
    const avg = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    return `${avg.toFixed(2)} ms`;
  }

  /**
   * Get hop status for display with enhanced analysis
   */
  getHopStatus(hop) {
    if (hop.isReachable === true) return 'pingable';
    if (hop.isReachable === false) return 'unreachable';
    if (hop.times && hop.times.length > 0) return 'reachable';
    return 'unknown';
  }

  /**
   * Analyze latency discrepancy between traceroute and ping
   */
  analyzeLatencyDiscrepancy(hop) {
    const tracerouteLatency = hop.times && hop.times.length > 0 
      ? Math.max(...hop.times.filter(t => typeof t === 'number'))
      : null;
    
    const pingLatency = hop.avgLatency;
    
    if (tracerouteLatency && pingLatency && typeof pingLatency === 'number') {
      const discrepancy = Math.abs(tracerouteLatency - pingLatency);
      const discrepancyPercent = (discrepancy / Math.max(tracerouteLatency, pingLatency)) * 100;
      
      return {
        tracerouteLatency,
        pingLatency,
        discrepancy,
        discrepancyPercent,
        isSignificant: discrepancyPercent > 50, // More than 50% difference
        analysis: this.getDiscrepancyAnalysis(tracerouteLatency, pingLatency, discrepancyPercent)
      };
    }
    
    return null;
  }

  /**
   * Get analysis of latency discrepancy
   */
  getDiscrepancyAnalysis(tracerouteLatency, pingLatency, discrepancyPercent) {
    if (discrepancyPercent > 200) {
      return 'SEVERE_DISCREPANCY'; // More than 200% difference
    } else if (discrepancyPercent > 100) {
      return 'HIGH_DISCREPANCY'; // More than 100% difference
    } else if (discrepancyPercent > 50) {
      return 'MODERATE_DISCREPANCY'; // More than 50% difference
    } else if (discrepancyPercent > 20) {
      return 'LOW_DISCREPANCY'; // More than 20% difference
    } else {
      return 'NORMAL'; // Less than 20% difference
    }
  }

  /**
   * Get network behavior analysis with slow hop detection
   */
  getNetworkBehaviorAnalysis(hop) {
    const discrepancy = this.analyzeLatencyDiscrepancy(hop);
    const slowHopAnalysis = this.analyzeSlowHop(hop);
    
    if (!discrepancy && !slowHopAnalysis) {
      return {
        behavior: 'UNKNOWN',
        reason: 'Insufficient data for analysis',
        recommendations: []
      };
    }

    // If it's a slow hop, prioritize that analysis
    if (slowHopAnalysis && slowHopAnalysis.isSlow) {
      return {
        behavior: slowHopAnalysis.behavior,
        reason: slowHopAnalysis.reason,
        recommendations: slowHopAnalysis.recommendations,
        slowHop: slowHopAnalysis,
        discrepancy: discrepancy
      };
    }

    // Otherwise, use discrepancy analysis
    if (discrepancy) {
      const { tracerouteLatency, pingLatency, analysis } = discrepancy;
      
      let behavior, reason, recommendations = [];

      switch (analysis) {
        case 'SEVERE_DISCREPANCY':
          behavior = 'PROTOCOL_FILTERING';
          reason = 'Severe latency difference suggests protocol-specific filtering or rate limiting';
          recommendations = [
            'Check firewall rules for this hop',
            'Verify ICMP vs UDP/TCP handling',
            'Consider using different traceroute methods'
          ];
          break;
          
        case 'HIGH_DISCREPANCY':
          behavior = 'RATE_LIMITING';
          reason = 'High latency difference indicates possible rate limiting or congestion';
          recommendations = [
            'Wait and retry traceroute',
            'Check for network congestion',
            'Verify router configuration'
          ];
          break;
          
        case 'MODERATE_DISCREPANCY':
          behavior = 'LOAD_BALANCING';
          reason = 'Moderate difference suggests load balancing or path changes';
          recommendations = [
            'Run multiple traceroutes to verify consistency',
            'Check for dynamic routing changes',
            'Monitor for path stability'
          ];
          break;
          
        case 'LOW_DISCREPANCY':
          behavior = 'NORMAL_VARIATION';
          reason = 'Minor difference is within normal network variation';
          recommendations = [
            'Continue monitoring',
            'No action required'
          ];
          break;
          
        default:
          behavior = 'NORMAL';
          reason = 'Latency values are consistent';
          recommendations = [
            'Network behavior is normal'
          ];
      }

      return {
        behavior,
        reason,
        recommendations,
        discrepancy,
        slowHop: slowHopAnalysis
      };
    }

    return {
      behavior: 'UNKNOWN',
      reason: 'Insufficient data for analysis',
      recommendations: [],
      slowHop: slowHopAnalysis
    };
  }

  /**
   * Analyze if a hop is slow and why
   */
  analyzeSlowHop(hop) {
    const pingLatency = hop.avgLatency;
    const tracerouteLatency = hop.times && hop.times.length > 0 
      ? Math.max(...hop.times.filter(t => typeof t === 'number'))
      : null;
    
    // Check if ping latency is high
    if (pingLatency && typeof pingLatency === 'number') {
      let behavior, reason, recommendations = [];
      let isSlow = false;
      let shouldSkip = false; // New flag for hop skipping
      
      if (pingLatency > 100) {
        isSlow = true;
        shouldSkip = true; // Skip very slow hops
        behavior = 'VERY_SLOW_HOP';
        reason = `Very high ping latency (${pingLatency.toFixed(1)}ms) - possible network congestion or overloaded router`;
        recommendations = [
          'Skip this hop for faster results',
          'Check for network congestion',
          'Verify router load and capacity',
          'Consider alternative routes',
          'Monitor for sustained high latency'
        ];
      } else if (pingLatency > 50) {
        isSlow = true;
        shouldSkip = true; // Skip slow hops
        behavior = 'SLOW_HOP';
        reason = `High ping latency (${pingLatency.toFixed(1)}ms) - possible network issues or router delays`;
        recommendations = [
          'Skip this hop for faster results',
          'Monitor latency trends',
          'Check for intermittent congestion',
          'Verify router performance',
          'Consider if this is normal for this hop'
        ];
      } else if (pingLatency > 20) {
        isSlow = true;
        shouldSkip = false; // Don't skip moderately slow hops
        behavior = 'MODERATELY_SLOW_HOP';
        reason = `Moderate ping latency (${pingLatency.toFixed(1)}ms) - slightly above normal but acceptable`;
        recommendations = [
          'Continue monitoring',
          'Check if this is consistent behavior',
          'No immediate action required'
        ];
      }
      
      // Check for ping history patterns
      if (hop.pingHistory && hop.pingHistory.length > 0) {
        const recentPings = hop.pingHistory.slice(-3); // Last 3 pings
        const avgRecentLatency = recentPings.reduce((sum, p) => sum + (p.latency || 0), 0) / recentPings.length;
        
        if (avgRecentLatency > pingLatency * 1.5) {
          isSlow = true;
          shouldSkip = true; // Skip hops with increasing latency
          behavior = 'INCREASING_LATENCY';
          reason = `Latency is increasing (current: ${pingLatency.toFixed(1)}ms, recent avg: ${avgRecentLatency.toFixed(1)}ms) - possible degradation`;
          recommendations = [
            'Skip this hop for faster results',
            'Monitor for continued degradation',
            'Check for network congestion',
            'Verify router performance',
            'Consider if this is temporary'
          ];
        }
      }
      
      // Check for packet loss
      if (hop.packetLoss && parseFloat(hop.packetLoss) > 0) {
        isSlow = true;
        shouldSkip = true; // Skip hops with packet loss
        behavior = 'PACKET_LOSS';
        reason = `Packet loss detected (${hop.packetLoss}%) - causing retransmissions and increased latency`;
        recommendations = [
          'Skip this hop for faster results',
          'Investigate packet loss causes',
          'Check network stability',
          'Verify router configuration',
          'Consider alternative routes'
        ];
      }
      
      if (isSlow) {
        return {
          isSlow: true,
          shouldSkip,
          behavior,
          reason,
          recommendations,
          pingLatency,
          tracerouteLatency,
          packetLoss: hop.packetLoss,
          pingHistory: hop.pingHistory ? hop.pingHistory.length : 0
        };
      }
    }
    
    return {
      isSlow: false,
      shouldSkip: false,
      pingLatency,
      tracerouteLatency,
      packetLoss: hop.packetLoss,
      pingHistory: hop.pingHistory ? hop.pingHistory.length : 0
    };
  }

  /**
   * Check if a hop should be skipped based on performance
   */
  shouldSkipHop(hop, config = {}) {
    const slowHopAnalysis = this.analyzeSlowHop(hop);
    
    // Skip if explicitly marked as shouldSkip
    if (slowHopAnalysis.shouldSkip) {
      return {
        shouldSkip: true,
        reason: slowHopAnalysis.reason,
        behavior: slowHopAnalysis.behavior
      };
    }
    
    // Skip based on configurable thresholds
    if (config.skipSlowHops) {
      const pingLatency = hop.avgLatency;
      if (pingLatency && pingLatency > (config.slowHopThreshold || 50)) {
        return {
          shouldSkip: true,
          reason: `Latency (${pingLatency.toFixed(1)}ms) exceeds threshold (${config.slowHopThreshold || 50}ms)`,
          behavior: 'CONFIGURED_SKIP'
        };
      }
    }
    
    // Skip based on packet loss
    if (config.skipPacketLoss && hop.packetLoss && parseFloat(hop.packetLoss) > 0) {
      return {
        shouldSkip: true,
        reason: `Packet loss detected (${hop.packetLoss}%)`,
        behavior: 'PACKET_LOSS_SKIP'
      };
    }
    
    return {
      shouldSkip: false,
      reason: 'Hop performance is acceptable',
      behavior: 'NORMAL'
    };
  }

  /**
   * Check if a hop is limited by maximum hop count
   */
  isLimitedByMaxHops(hop, hopIndex, maxHopsToProcess) {
    if (maxHopsToProcess && hopIndex >= maxHopsToProcess) {
      return {
        isLimited: true,
        reason: `Hop ${hop.hop} exceeds maximum hop limit (${maxHopsToProcess})`,
        behavior: 'LIMITED_BY_MAX_HOPS'
      };
    }
    
    return {
      isLimited: false,
      reason: 'Hop within processing limit',
      behavior: 'NORMAL'
    };
  }

  /**
   * Get hop priority for processing order
   */
  getHopPriority(hop, config = {}) {
    const slowHopAnalysis = this.analyzeSlowHop(hop);
    const pingLatency = hop.avgLatency || 0;
    
    // Priority 1: Very fast hops (< 5ms)
    if (pingLatency < 5) return 1;
    
    // Priority 2: Fast hops (< 10ms)
    if (pingLatency < 10) return 2;
    
    // Priority 3: Normal hops (< 20ms)
    if (pingLatency < 20) return 3;
    
    // Priority 4: Moderately slow hops (< 50ms)
    if (pingLatency < 50) return 4;
    
    // Priority 5: Slow hops (should be skipped)
    if (slowHopAnalysis.shouldSkip) return 999; // Lowest priority
    
    return 5; // Default priority
  }

  /**
   * Populate ping history for a hop (for regular traceroute)
   */
  populatePingHistory(hop) {
    if (!hop.pingHistory) {
      hop.pingHistory = [];
    }

    // Add current ping result to history if we have valid latency data
    if (hop.avgLatency && typeof hop.avgLatency === 'number') {
      // Check if this ping is already in history to avoid duplicates
      const existingPing = hop.pingHistory.find(p => 
        p.pingNumber === (hop.pingCount || 1) && 
        p.timestamp === hop.timestamp
      );

      if (!existingPing) {
        const isLongTimeout = hop.avgLatency >= 1000; // Detect 1000ms+ timeouts
        const isSlowPing = hop.avgLatency > 100; // Detect slow pings >100ms
        
        hop.pingHistory.push({
          pingNumber: hop.pingCount || 1,
          timestamp: hop.timestamp || Date.now(),
          latency: hop.avgLatency,
          isReachable: hop.isReachable,
          timeout: 1000,
          responseTime: hop.avgLatency,
          isTimeout: !hop.isReachable,
          isLongTimeout: isLongTimeout, // New field for 1000ms+ timeouts
          isSlowPing: isSlowPing // New field for slow pings >100ms
        });

        // Keep only last 20 ping entries for performance
        if (hop.pingHistory.length > 20) {
          hop.pingHistory.shift();
        }
      }
    }

    return hop;
  }

  /**
   * Add recent ping to history with timeout tracking
   */
  addRecentPing(hop, pingResult, timeout = 1000, pingNumber = null) {
    if (!hop.pingHistory) {
      hop.pingHistory = [];
    }

    const isTimeout = !pingResult.alive || pingResult.time === null;
    const isLongTimeout = isTimeout && timeout >= 1000; // Detect 1000ms+ timeouts
    const isSlowPing = pingResult.alive && pingResult.time && pingResult.time > 100; // Detect slow pings >100ms

    const pingEntry = {
      pingNumber: pingNumber || hop.pingCount || 1,
      timestamp: Date.now(),
      latency: pingResult.time || null,
      isReachable: pingResult.alive || false,
      timeout: timeout,
      responseTime: pingResult.time || 'timeout',
      isTimeout: isTimeout,
      isLongTimeout: isLongTimeout, // New field for 1000ms+ timeouts
      isSlowPing: isSlowPing // New field for slow pings >100ms
    };

    hop.pingHistory.push(pingEntry);

    // Keep only last 20 ping entries for performance
    if (hop.pingHistory.length > 20) {
      hop.pingHistory.shift();
    }

    return hop;
  }

  /**
   * Add timeout ping to history
   */
  addTimeoutPing(hop, timeout = 1000, pingNumber = null) {
    if (!hop.pingHistory) {
      hop.pingHistory = [];
    }

    const isLongTimeout = timeout >= 1000; // Detect 1000ms+ timeouts

    const timeoutEntry = {
      pingNumber: pingNumber || hop.pingCount || 1,
      timestamp: Date.now(),
      latency: null,
      isReachable: false,
      timeout: timeout,
      responseTime: 'timeout',
      isTimeout: true,
      isLongTimeout: isLongTimeout, // New field for 1000ms+ timeouts
      isSlowPing: false // Timeouts are not slow pings
    };

    hop.pingHistory.push(timeoutEntry);

    // Keep only last 20 ping entries for performance
    if (hop.pingHistory.length > 20) {
      hop.pingHistory.shift();
    }

    return hop;
  }

  /**
   * Ping a specific IP with ultra-aggressive timeout - abandon unresponsive hops immediately
   */
  async pingHopWithRetry(ip, timeout = 300, retries = 0) {
    try {
      // Create a timeout promise that rejects after the specified timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Ping timeout')), timeout);
      });

             // Create the ping promise with ultra-fast timeout
       const pingPromise = ping.promise.probe(ip, {
         timeout: Math.max(timeout / 1000, 0.05), // Minimum 50ms timeout for ultra-speed
         min_reply: 1
       });

      // Race between ping and timeout - whichever resolves first wins
      const pingResult = await Promise.race([pingPromise, timeoutPromise]);
      
      return pingResult;
    } catch (error) {
      // Return error result immediately - no retries to keep going to next IPs
      return {
        alive: false,
        time: null,
        error: error.message
      };
    }
  }
}

module.exports = HopProcessor; 