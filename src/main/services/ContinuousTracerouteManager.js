/**
 * Manages continuous traceroute operations
 */
class ContinuousTracerouteManager {
  constructor(tracerouteExecutor, hopProcessor, statisticsCalculator) {
    this.tracerouteExecutor = tracerouteExecutor;
    this.hopProcessor = hopProcessor;
    this.statisticsCalculator = statisticsCalculator;
    this.activeSessions = new Map(); // Track active continuous sessions
  }

  /**
   * Start a continuous traceroute session
   */
  async startContinuousSession(config, onHopUpdate = null, onComplete = null) {
    const {
      target,
      maxHops = 30,
      timeout = 0,
      protocol = 'icmp',
      port = null,
      resolveHosts = true,
      pingHops = true,
      realTime = true,
      interval = 5000
    } = config;

    if (!target) {
      return { success: false, error: 'Target is required' };
    }

    // Generate unique session ID
    const sessionId = `continuous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let isRunning = true;
    let runCount = 0;
    let allHops = new Map(); // Track all hops across runs
    let startTime = Date.now();
    let currentRunPromise = null;

    // Store session info
    this.activeSessions.set(sessionId, {
      target,
      config,
      isRunning,
      runCount,
      startTime,
      allHops,
      currentRunPromise,
      stop: () => {
        isRunning = false;
        this.activeSessions.delete(sessionId);
      }
    });

    console.log(`🔄 [ContinuousTracerouteManager] Starting continuous session: ${sessionId}`);

    const runTraceroute = async () => {
      if (!isRunning) return;

      runCount++;
      console.log(`🔄 [ContinuousTracerouteManager] Run #${runCount} for ${target}`);

      try {
        // Execute traceroute with custom hop processing
        const result = await this.tracerouteExecutor.execute({
          target,
          maxHops,
          timeout,
          protocol,
          port,
          resolveHosts,
          pingHops,
          realTime: false // We handle real-time updates ourselves
        }, async (update) => {
          if (update.type === 'hop') {
            // Process the hop data
            const processedHop = await this.hopProcessor.processHop(
              update.rawData,
              config,
              runCount,
              sessionId
            );

            // Update hop history
            const updatedHop = this.hopProcessor.updateHopHistory(processedHop, allHops);

            // Send real-time update
            if (onHopUpdate && typeof onHopUpdate === 'function') {
              onHopUpdate({
                type: 'continuous_hop',
                data: updatedHop,
                sessionId,
                runNumber: runCount,
                totalRuns: runCount,
                duration: Date.now() - startTime,
                allHops: Array.from(allHops.values())
              });
            }
          }
        });

        // Send run completion update
        if (onComplete && typeof onComplete === 'function') {
          const sessionStats = this.statisticsCalculator.calculateContinuousStatistics(
            allHops,
            runCount,
            Date.now() - startTime
          );

          onComplete({
            type: 'run_complete',
            sessionId,
            runNumber: runCount,
            result,
            allHops: Array.from(allHops.values()),
            duration: Date.now() - startTime,
            statistics: sessionStats
          });
        }

      } catch (error) {
        console.error(`❌ [ContinuousTracerouteManager] Run #${runCount} failed:`, error);
        
        if (onComplete && typeof onComplete === 'function') {
          onComplete({
            type: 'run_error',
            sessionId,
            runNumber: runCount,
            error: error.message,
            duration: Date.now() - startTime
          });
        }
      }

      // Schedule next run if still running
      if (isRunning) {
        setTimeout(runTraceroute, interval);
      }
    };

    // Start the first run
    currentRunPromise = runTraceroute();

    return {
      success: true,
      sessionId,
      message: 'Continuous traceroute started'
    };
  }

  /**
   * Stop a continuous traceroute session
   */
  stopContinuousSession(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        console.log(`🛑 [ContinuousTracerouteManager] Stopping session: ${sessionId}`);
        session.stop();
        this.activeSessions.delete(sessionId);
        console.log(`✅ [ContinuousTracerouteManager] Session stopped: ${sessionId}`);
        return { success: true, message: 'Continuous traceroute stopped' };
      } else {
        console.log(`⚠️ [ContinuousTracerouteManager] Session not found: ${sessionId}`);
        this.activeSessions.delete(sessionId);
        return { success: true, message: 'Session already stopped or not found' };
      }
    } catch (error) {
      console.error(`❌ [ContinuousTracerouteManager] Error stopping session ${sessionId}:`, error);
      this.activeSessions.delete(sessionId);
      return { success: true, message: 'Session cleaned up after error' };
    }
  }

  /**
   * Get all active continuous sessions
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      target: session.target,
      runCount: session.runCount,
      startTime: session.startTime,
      duration: Date.now() - session.startTime,
      isRunning: session.isRunning
    }));
  }

  /**
   * Get session statistics
   */
  getSessionStatistics(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    return this.statisticsCalculator.calculateContinuousStatistics(
      session.allHops,
      session.runCount,
      Date.now() - session.startTime
    );
  }

  /**
   * Stop all active sessions
   */
  stopAllSessions() {
    console.log(`🛑 [ContinuousTracerouteManager] Stopping all sessions (${this.activeSessions.size})`);
    
    this.activeSessions.forEach((session, sessionId) => {
      this.stopContinuousSession(sessionId);
    });
  }

  /**
   * Get session count
   */
  getActiveSessionCount() {
    return this.activeSessions.size;
  }

  /**
   * Check if a session is active
   */
  isSessionActive(sessionId) {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Get session data
   */
  getSessionData(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId,
      target: session.target,
      config: session.config,
      runCount: session.runCount,
      startTime: session.startTime,
      duration: Date.now() - session.startTime,
      allHops: Array.from(session.allHops.values()),
      isRunning: session.isRunning
    };
  }
}

module.exports = ContinuousTracerouteManager; 