const TracerouteConfig = require('./TracerouteConfig');
const TracerouteExecutor = require('./TracerouteExecutor');
const HopProcessor = require('./HopProcessor');
const TracerouteStatistics = require('./TracerouteStatistics');
const ContinuousTracerouteManager = require('./ContinuousTracerouteManager');

/**
 * Main TracerouteService that orchestrates all traceroute operations
 * Uses dependency injection pattern for better testability and modularity
 */
class TracerouteService {
  constructor() {
    // Initialize dependencies
    this.configManager = new TracerouteConfig();
    this.executor = new TracerouteExecutor();
    this.hopProcessor = new HopProcessor();
    this.statisticsCalculator = new TracerouteStatistics();
    this.continuousManager = new ContinuousTracerouteManager(
      this.executor,
      this.hopProcessor,
      this.statisticsCalculator
    );
  }

  /**
   * Perform traceroute to target with real-time updates and hop pinging
   * Maintains backward compatibility with existing API
   */
  async trace(config, onHopUpdate = null) {
    try {
      // Validate and normalize configuration
      const validatedConfig = this.configManager.validateConfig(config);
      
      // Resolve target if needed
      const resolvedTarget = await this.configManager.resolveTarget(validatedConfig.target);
      
      console.log(`🚀 [TracerouteService] Starting traceroute to ${resolvedTarget.ip}`);

      return new Promise((resolve, reject) => {
        const hops = [];
        let destination = null;
        let pid = null;
        let isCompleted = false;

        // Execute traceroute with custom hop processing
        this.executor.execute(validatedConfig, async (update) => {
          try {
            if (update.type === 'hop') {
              // Process the hop data (without pinging yet)
              const processedHop = await this.hopProcessor.processHop(
                update.rawData,
                validatedConfig,
                null,
                null,
                false // Don't ping immediately
              );

              hops.push(processedHop);

              // Send real-time update if callback provided
              if (onHopUpdate && typeof onHopUpdate === 'function') {
                onHopUpdate({
                  type: 'hop',
                  data: processedHop,
                  progress: update.progress
                });
              }
            } else if (update.type === 'complete' && !isCompleted) {
              isCompleted = true;
              destination = update.data.ipAddress;
              pid = update.data.pid;

              // Collect all valid IPs for simultaneous pinging
              const validHops = hops.filter(hop => 
                hop.ip && 
                hop.ip !== 'Request timed out.' && 
                hop.ip !== '*' && 
                hop.ip !== 'unknown'
              );

              console.log(`📊 [TracerouteService] Traceroute completed. Found ${hops.length} total hops, ${validHops.length} valid IPs for pinging`);

              // Ping all valid hops with smart filtering and prioritization
              if (validatedConfig.pingHops && validHops.length > 0) {
                console.log(`🚀 [TracerouteService] Analyzing ${validHops.length} valid IPs for smart filtering...`);
                
                // Analyze hops and determine which to skip
                const hopAnalysis = validHops.map(hop => ({
                  hop,
                  analysis: this.hopProcessor.shouldSkipHop(hop, validatedConfig),
                  priority: this.hopProcessor.getHopPriority(hop, validatedConfig)
                }));
                
                // Filter out hops that should be skipped
                const hopsToPing = hopAnalysis.filter(item => !item.analysis.shouldSkip);
                const skippedHops = hopAnalysis.filter(item => item.analysis.shouldSkip);
                
                if (skippedHops.length > 0) {
                  console.log(`⏭️ [TracerouteService] Skipping ${skippedHops.length} slow hops for faster results:`);
                  skippedHops.forEach(item => {
                    console.log(`   - Hop ${item.hop.hop} (${item.hop.ip}): ${item.analysis.reason}`);
                  });
                }
                
                // Apply maximum hop limit
                let finalHopsToPing = hopsToPing;
                let limitedHops = [];
                
                if (validatedConfig.maxHopsToProcess && hopsToPing.length > validatedConfig.maxHopsToProcess) {
                  // Sort by priority and take only the best hops
                  const sortedHops = hopsToPing.sort((a, b) => a.priority - b.priority);
                  finalHopsToPing = sortedHops.slice(0, validatedConfig.maxHopsToProcess);
                  limitedHops = sortedHops.slice(validatedConfig.maxHopsToProcess);
                  
                  console.log(`📊 [TracerouteService] Limiting to ${validatedConfig.maxHopsToProcess} best hops (${limitedHops.length} additional hops limited):`);
                  limitedHops.forEach(item => {
                    console.log(`   - Hop ${item.hop.hop} (${item.hop.ip}): Priority ${item.priority} (limited by maxHopsToProcess)`);
                  });
                }
                
                console.log(`🚀 [TracerouteService] Pinging ${finalHopsToPing.length} final IPs in parallel with 1000ms timeout (${skippedHops.length} skipped, ${limitedHops.length} limited)...`);
                
                const pingStartTime = Date.now();
                
                // Create truly parallel ping promises - all pings start simultaneously with 1000ms timeout
                const pingPromises = finalHopsToPing.map(async (item) => {
                  const hop = item.hop;
                  try {
                    // Perform single ping with 1000ms timeout for better network tolerance
                    const pingResult = await this.hopProcessor.pingHopWithRetry(hop.ip, 1000); // 1000ms timeout
                    
                    // Calculate average latency
                    const avgLatency = (pingResult.alive && pingResult.time) ? pingResult.time : null;
                    
                    // Update hop with comprehensive ping data
                    hop.pingResults = [pingResult];
                    hop.avgLatency = avgLatency;
                    hop.isReachable = pingResult.alive;
                    hop.packetLoss = pingResult.alive ? 0 : 100;
                    hop.pingCount = 1;
                    hop.successfulPings = pingResult.alive ? 1 : 0;
                    
                    // Add latency discrepancy analysis
                    hop.latencyAnalysis = this.hopProcessor.analyzeLatencyDiscrepancy(hop);
                    hop.networkBehavior = this.hopProcessor.getNetworkBehaviorAnalysis(hop);
                    
                    // Add ping result to history for better graphing with 1000ms timeout detection
                    this.hopProcessor.addRecentPing(hop, pingResult, 1000, 1);
                    
                    console.log(`✅ [TracerouteService] Hop ${hop.hop} (${hop.ip}): ${pingResult.alive ? 'SUCCESS' : 'TIMEOUT'}, avg: ${avgLatency?.toFixed(1) || 'N/A'}ms`);
                    
                  } catch (error) {
                    console.log(`⚠️ [TracerouteService] Error pinging hop ${hop.hop} (${hop.ip}): ${error.message}`);
                    hop.isReachable = false;
                    hop.avgLatency = null;
                    hop.pingCount = 0;
                    hop.successfulPings = 0;
                    
                    // Add timeout ping to history
                    this.hopProcessor.addTimeoutPing(hop, 1000, 1);
                  }
                  
                  return hop;
                });

                // Use Promise.allSettled for truly parallel execution - all pings run simultaneously
                // This ensures we don't wait for slow/timeout pings and continue with responsive ones
                const pingResults = await Promise.allSettled(pingPromises);
                
                const pingDuration = Date.now() - pingStartTime;
                const successfulPings = pingResults.filter(result => result.status === 'fulfilled' && result.value.isReachable).length;
                console.log(`✅ [TracerouteService] All ${finalHopsToPing.length} parallel pings completed in ${pingDuration}ms (${successfulPings} successful, ${finalHopsToPing.length - successfulPings} timed out)`);
                
                // Ensure all hops have ping history populated for graphing
                hops.forEach(hop => {
                  if (!hop.pingHistory || hop.pingHistory.length === 0) {
                    this.hopProcessor.populatePingHistory(hop);
                  }
                  
                  // Add timeout pings for hops that failed to respond
                  if (hop.ip && hop.ip !== 'Request timed out.' && hop.ip !== '*' && !hop.isReachable) {
                    this.hopProcessor.addTimeoutPing(hop, 1000, 1);
                  }
                });
              }

              // Calculate statistics
              const stats = this.statisticsCalculator.calculateStatistics(hops);
              
              const result = {
                success: true,
                target: validatedConfig.target,
                ipAddress: destination || resolvedTarget.ip,
                hops: hops,
                totalHops: hops.length,
                pid: pid,
                statistics: stats
              };

              // Send final update
              if (onHopUpdate && typeof onHopUpdate === 'function') {
                onHopUpdate({
                  type: 'complete',
                  data: result
                });
              }

              resolve(result);
            }
          } catch (error) {
            console.error('❌ [TracerouteService] Error processing update:', error);
            if (!isCompleted) {
              isCompleted = true;
              reject(error);
            }
          }
        }).catch(error => {
          console.error('❌ [TracerouteService] Traceroute execution failed:', error);
          if (!isCompleted) {
            isCompleted = true;
            resolve({
              success: false,
              error: error.message || 'Traceroute failed'
            });
          }
        });
      });

    } catch (error) {
      console.error('❌ [TracerouteService] Error in trace method:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start continuous traceroute that runs until stopped
   * Maintains backward compatibility with existing API
   */
  async startContinuousTrace(config, onHopUpdate = null, onComplete = null) {
    try {
      // Validate and normalize configuration for continuous mode
      const validatedConfig = this.configManager.validateContinuousConfig(config);
      
      console.log(`🔄 [TracerouteService] Starting continuous traceroute to ${validatedConfig.target}`);

      return await this.continuousManager.startContinuousSession(
        validatedConfig,
        onHopUpdate,
        onComplete
      );

    } catch (error) {
      console.error('❌ [TracerouteService] Error starting continuous trace:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop continuous traceroute by session ID
   * Maintains backward compatibility with existing API
   */
  stopContinuousTrace(sessionId) {
    try {
      console.log(`🛑 [TracerouteService] Stopping continuous traceroute: ${sessionId}`);
      return this.continuousManager.stopContinuousSession(sessionId);
    } catch (error) {
      console.error('❌ [TracerouteService] Error stopping continuous trace:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all active continuous traceroutes
   * Maintains backward compatibility with existing API
   */
  getActiveTraceroutes() {
    try {
      return this.continuousManager.getActiveSessions();
    } catch (error) {
      console.error('❌ [TracerouteService] Error getting active traceroutes:', error);
      return [];
    }
  }

  /**
   * Get ping statistics for a specific hop
   * Maintains backward compatibility with existing API
   */
  getHopPingStatistics(hopKey) {
    try {
      return this.hopProcessor.getHopPingStatistics(hopKey);
    } catch (error) {
      console.error('❌ [TracerouteService] Error getting hop ping statistics:', error);
      return { totalPings: 0, pingCount: 0 };
    }
  }

  /**
   * Reset ping counters for a specific hop or all hops
   * Maintains backward compatibility with existing API
   */
  resetPingCounters(hopKey = null) {
    try {
      this.hopProcessor.resetPingCounters(hopKey);
    } catch (error) {
      console.error('❌ [TracerouteService] Error resetting ping counters:', error);
    }
  }

  // New methods for enhanced functionality

  /**
   * Get comprehensive statistics for a set of hops
   */
  getStatistics(hops) {
    try {
      return this.statisticsCalculator.calculateStatistics(hops);
    } catch (error) {
      console.error('❌ [TracerouteService] Error calculating statistics:', error);
      return null;
    }
  }

  /**
   * Get performance summary for traceroute results
   */
  getPerformanceSummary(hops) {
    try {
      const stats = this.statisticsCalculator.calculateStatistics(hops);
      return this.statisticsCalculator.generatePerformanceSummary(stats);
    } catch (error) {
      console.error('❌ [TracerouteService] Error generating performance summary:', error);
      return null;
    }
  }

  /**
   * Get session statistics for continuous mode
   */
  getSessionStatistics(sessionId) {
    try {
      return this.continuousManager.getSessionStatistics(sessionId);
    } catch (error) {
      console.error('❌ [TracerouteService] Error getting session statistics:', error);
      return null;
    }
  }

  /**
   * Get session data for continuous mode
   */
  getSessionData(sessionId) {
    try {
      return this.continuousManager.getSessionData(sessionId);
    } catch (error) {
      console.error('❌ [TracerouteService] Error getting session data:', error);
      return null;
    }
  }

  /**
   * Stop all active processes and sessions
   */
  stopAll() {
    try {
      console.log('🛑 [TracerouteService] Stopping all active operations');
      this.executor.stopAllProcesses();
      this.continuousManager.stopAllSessions();
    } catch (error) {
      console.error('❌ [TracerouteService] Error stopping all operations:', error);
    }
  }

  /**
   * Get system status
   */
  getSystemStatus() {
    try {
      return {
        activeProcesses: this.executor.getActiveProcessCount(),
        activeSessions: this.continuousManager.getActiveSessionCount(),
        processInfo: this.executor.getActiveProcesses(),
        sessionInfo: this.continuousManager.getActiveSessions()
      };
    } catch (error) {
      console.error('❌ [TracerouteService] Error getting system status:', error);
      return {
        activeProcesses: 0,
        activeSessions: 0,
        processInfo: [],
        sessionInfo: []
      };
    }
  }

  /**
   * Validate configuration without executing
   */
  validateConfiguration(config) {
    try {
      return {
        success: true,
        config: this.configManager.validateConfig(config)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Resolve target without executing traceroute
   */
  async resolveTarget(target) {
    try {
      return await this.configManager.resolveTarget(target);
    } catch (error) {
      console.error('❌ [TracerouteService] Error resolving target:', error);
      throw error;
    }
  }
}

module.exports = TracerouteService; 