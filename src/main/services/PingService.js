const ping = require('ping');
const axios = require('axios');
const dns = require('dns').promises;

class PingService {
  constructor() {
    this.defaultConfig = {
      timeout: 5000,
      count: 4,
      interval: 1000,
      packetSize: 56
    };
  }

  /**
   * HTTP Ping - Test web server response time
   */
  async httpPing(config, onUpdate = null) {
    const {
      url,
      count = 4,
      timeout = 5000,
      method = 'GET',
      headers = {},
      body = null
    } = config;

    if (!url) {
      return { success: false, error: 'URL is required' };
    }

    const results = [];
    const startTime = Date.now();

    try {
      for (let i = 0; i < count; i++) {
        const pingStart = Date.now();
        
        try {
          const response = await axios({
            method: method.toLowerCase(),
            url: url,
            headers: headers,
            data: body,
            timeout: timeout,
            validateStatus: () => true // Accept all status codes
          });

          const pingEnd = Date.now();
          const latency = pingEnd - pingStart;

          const result = {
            sequence: i + 1,
            latency: latency,
            statusCode: response.status,
            statusText: response.statusText,
            responseSize: response.data ? JSON.stringify(response.data).length : 0,
            timestamp: new Date().toISOString()
          };

          results.push(result);

          // Send real-time update if callback provided
          if (onUpdate && typeof onUpdate === 'function') {
            onUpdate({
              type: 'http',
              result: result,
              progress: {
                current: i + 1,
                total: count,
                percentage: ((i + 1) / count) * 100
              }
            });
          }

        } catch (error) {
          const result = {
            sequence: i + 1,
            error: error.message,
            timestamp: new Date().toISOString()
          };

          results.push(result);

          // Send real-time update if callback provided
          if (onUpdate && typeof onUpdate === 'function') {
            onUpdate({
              type: 'http',
              result: result,
              progress: {
                current: i + 1,
                total: count,
                percentage: ((i + 1) / count) * 100
              }
            });
          }
        }

        // Wait between pings
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Calculate statistics
      const successfulPings = results.filter(r => !r.error);
      const failedPings = results.filter(r => r.error);
      
      const stats = {
        total: count,
        successful: successfulPings.length,
        failed: failedPings.length,
        lossRate: (failedPings.length / count) * 100
      };

      if (successfulPings.length > 0) {
        const latencies = successfulPings.map(r => r.latency);
        stats.minLatency = Math.min(...latencies);
        stats.maxLatency = Math.max(...latencies);
        stats.avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        stats.jitter = this.calculateJitter(latencies);
      }

      const finalResult = {
        success: true,
        target: url,
        method: method,
        results: results,
        statistics: stats,
        totalTime: totalTime
      };

      // Send completion update if callback provided
      if (onUpdate && typeof onUpdate === 'function') {
        onUpdate({
          type: 'http',
          completed: true,
          finalResult: finalResult
        });
      }

      return finalResult;

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ICMP Ping - Traditional network ping
   */
  async icmpPing(config, onUpdate = null) {
    const {
      target,
      count = 4,
      timeout = 5000,
      interval = 1000,
      packetSize = 56,
      ttl = 128
    } = config;

    if (!target) {
      return { success: false, error: 'Target is required' };
    }

    try {
      // Resolve domain to IP if needed
      let ipAddress = target;
      if (!this.isIPAddress(target)) {
        try {
          const resolved = await dns.lookup(target);
          ipAddress = resolved.address;
        } catch (error) {
          return { success: false, error: `Cannot resolve ${target}: ${error.message}` };
        }
      }

      const results = [];
      const startTime = Date.now();

      for (let i = 0; i < count; i++) {
        try {
          const result = await ping.promise.probe(ipAddress, {
            timeout: timeout / 1000, // ping library expects seconds
            min_reply: 1
          });

          const pingResult = {
            sequence: i + 1,
            alive: result.alive,
            time: result.time || null,
            min: result.min || null,
            max: result.max || null,
            avg: result.avg || null,
            packetLoss: result.packetLoss || null,
            timestamp: new Date().toISOString()
          };

          results.push(pingResult);

          // Send real-time update if callback provided
          if (onUpdate && typeof onUpdate === 'function') {
            onUpdate({
              type: 'icmp',
              result: pingResult,
              progress: {
                current: i + 1,
                total: count,
                percentage: ((i + 1) / count) * 100
              }
            });
          }

        } catch (error) {
          const pingResult = {
            sequence: i + 1,
            error: error.message,
            timestamp: new Date().toISOString()
          };

          results.push(pingResult);

          // Send real-time update if callback provided
          if (onUpdate && typeof onUpdate === 'function') {
            onUpdate({
              type: 'icmp',
              result: pingResult,
              progress: {
                current: i + 1,
                total: count,
                percentage: ((i + 1) / count) * 100
              }
            });
          }
        }

        // Wait between pings
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Calculate statistics
      const successfulPings = results.filter(r => r.alive);
      const failedPings = results.filter(r => !r.alive || r.error);

      const stats = {
        total: count,
        successful: successfulPings.length,
        failed: failedPings.length,
        lossRate: (failedPings.length / count) * 100
      };

      if (successfulPings.length > 0) {
        const times = successfulPings.map(r => r.time).filter(t => t !== null && t !== undefined && typeof t === 'number');

        if (times.length > 0) {
          stats.minLatency = Math.min(...times);
          stats.maxLatency = Math.max(...times);
          stats.avgLatency = times.reduce((a, b) => a + b, 0) / times.length;
          stats.jitter = this.calculateJitter(times);
        }
      }

      const finalResult = {
        success: true,
        target: target,
        ipAddress: ipAddress,
        results: results,
        statistics: stats,
        totalTime: totalTime
      };

      // Send completion update if callback provided
      if (onUpdate && typeof onUpdate === 'function') {
        onUpdate({
          type: 'icmp',
          completed: true,
          finalResult: finalResult
        });
      }

      return finalResult;

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate jitter (standard deviation of latency)
   */
  calculateJitter(latencies) {
    if (latencies.length < 2) return 0;
    
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const squaredDiffs = latencies.map(l => Math.pow(l - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / latencies.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Check if string is a valid IP address
   */
  isIPAddress(str) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(str) || ipv6Regex.test(str);
  }
}

module.exports = PingService; 