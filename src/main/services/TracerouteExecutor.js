const Traceroute = require('nodejs-traceroute');

/**
 * Handles core traceroute execution
 */
class TracerouteExecutor {
  constructor() {
    this.activeProcesses = new Map(); // Track active traceroute processes
  }

  /**
   * Execute a single traceroute operation
   */
  async execute(config, onHopUpdate = null) {
    const {
      target,
      maxHops = 30,
      timeout = 0,
      protocol = 'icmp',
      port = null,
      resolveHosts = true,
      pingHops = true,
      realTime = true
    } = config;

    if (!target) {
      return { success: false, error: 'Target is required' };
    }

    return new Promise((resolve, reject) => {
      const hops = [];
      let destination = null;
      let pid = null;
      let isCompleted = false;
      let processId = null;

      const tracer = new Traceroute();

      // Set up timeout if specified
      let timeoutId = null;
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          if (!isCompleted) {
            isCompleted = true;
            this.cleanupProcess(processId);
            resolve({
              success: false,
              error: 'Traceroute operation timed out'
            });
          }
        }, timeout);
      }

      // Store process reference
      processId = `traceroute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.activeProcesses.set(processId, {
        tracer,
        isCompleted: false,
        startTime: Date.now()
      });

      tracer
        .on('pid', (processId) => {
          pid = processId;
          console.log(`🚀 [TracerouteExecutor] Process started with PID: ${pid}`);
        })
        .on('destination', (dest) => {
          destination = dest;
          console.log(`🎯 [TracerouteExecutor] Destination reached: ${dest}`);
        })
        .on('hop', async (hop) => {
          try {
            // Send raw hop data to callback for processing
            if (onHopUpdate && typeof onHopUpdate === 'function') {
              onHopUpdate({
                type: 'hop',
                rawData: hop,
                progress: {
                  current: hops.length + 1,
                  total: maxHops,
                  percentage: Math.round(((hops.length + 1) / maxHops) * 100)
                }
              });
            }

            // Store raw hop data
            hops.push(hop);

          } catch (error) {
            console.error('❌ [TracerouteExecutor] Error processing hop:', error);
          }
        })
        .on('close', (code) => {
          if (timeoutId) clearTimeout(timeoutId);
          
          if (!isCompleted) {
            isCompleted = true;
            this.cleanupProcess(processId);
            
            if (code === 0 || hops.length > 0) {
              const result = {
                success: true,
                target: target,
                ipAddress: destination,
                rawHops: hops,
                totalHops: hops.length,
                pid: pid,
                exitCode: code
              };

              // Send final update
              if (onHopUpdate && typeof onHopUpdate === 'function') {
                onHopUpdate({
                  type: 'complete',
                  data: result
                });
              }

              resolve(result);
            } else {
              resolve({
                success: false,
                error: `Traceroute failed with exit code ${code}`
              });
            }
          }
        })
        .on('error', (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          
          if (!isCompleted) {
            isCompleted = true;
            this.cleanupProcess(processId);
            console.error('❌ [TracerouteExecutor] Traceroute error:', error);
            resolve({
              success: false,
              error: error.message || 'Traceroute failed'
            });
          }
        });

      // Start the traceroute
      try {
        console.log(`🚀 [TracerouteExecutor] Starting traceroute to ${target}`);
        tracer.trace(target);
      } catch (error) {
        this.cleanupProcess(processId);
        reject(error);
      }
    });
  }

  /**
   * Clean up a traceroute process
   */
  cleanupProcess(processId) {
    if (processId && this.activeProcesses.has(processId)) {
      const process = this.activeProcesses.get(processId);
      if (process.tracer && !process.isCompleted) {
        try {
          // Attempt to stop the traceroute process
          if (process.tracer.stop) {
            process.tracer.stop();
          }
        } catch (error) {
          console.log(`⚠️ [TracerouteExecutor] Error stopping process ${processId}:`, error);
        }
      }
      this.activeProcesses.delete(processId);
      console.log(`🧹 [TracerouteExecutor] Cleaned up process: ${processId}`);
    }
  }

  /**
   * Stop all active traceroute processes
   */
  stopAllProcesses() {
    console.log(`🛑 [TracerouteExecutor] Stopping all active processes (${this.activeProcesses.size})`);
    
    this.activeProcesses.forEach((process, processId) => {
      this.cleanupProcess(processId);
    });
  }

  /**
   * Get active process count
   */
  getActiveProcessCount() {
    return this.activeProcesses.size;
  }

  /**
   * Get active process information
   */
  getActiveProcesses() {
    return Array.from(this.activeProcesses.entries()).map(([processId, process]) => ({
      processId,
      startTime: process.startTime,
      duration: Date.now() - process.startTime,
      isCompleted: process.isCompleted
    }));
  }

  /**
   * Check if a process is still active
   */
  isProcessActive(processId) {
    return this.activeProcesses.has(processId);
  }
}

module.exports = TracerouteExecutor; 