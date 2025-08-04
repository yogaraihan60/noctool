/**
 * Calculates and manages traceroute statistics
 */
class TracerouteStatistics {
  constructor() {}

  /**
   * Calculate comprehensive statistics for a set of hops
   */
  calculateStatistics(hops) {
    const stats = {
      totalHops: hops.length,
      reachableHops: 0,
      unreachableHops: 0,
      pingedHops: 0,
      avgLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      avgPingLatency: 0,
      maxPingLatency: 0,
      minPingLatency: Infinity,
      packetLossRate: 0,
      hopDistribution: {
        reachable: [],
        unreachable: [],
        pingable: []
      }
    };

    // Calculate basic hop statistics
    hops.forEach(hop => {
      // Count reachable/unreachable hops
      if (hop.times.length > 0 || hop.isReachable) {
        stats.reachableHops++;
        stats.hopDistribution.reachable.push(hop.hop);
      } else {
        stats.unreachableHops++;
        stats.hopDistribution.unreachable.push(hop.hop);
      }

      // Count pinged hops
      if (hop.pingResults !== null) {
        stats.pingedHops++;
        if (hop.isReachable) {
          stats.hopDistribution.pingable.push(hop.hop);
        }
      }
    });

    // Calculate traceroute latency statistics
    const allTimes = hops.flatMap(h => h.times);
    if (allTimes.length > 0) {
      stats.avgLatency = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
      stats.maxLatency = Math.max(...allTimes);
      stats.minLatency = Math.min(...allTimes);
    } else {
      stats.minLatency = 0;
    }

    // Calculate ping latency statistics
    const pingLatencies = hops
      .filter(h => h.avgLatency !== null && typeof h.avgLatency === 'number' && !isNaN(h.avgLatency))
      .map(h => h.avgLatency);
    
    if (pingLatencies.length > 0) {
      stats.avgPingLatency = pingLatencies.reduce((a, b) => a + b, 0) / pingLatencies.length;
      stats.maxPingLatency = Math.max(...pingLatencies);
      stats.minPingLatency = Math.min(...pingLatencies);
    } else {
      stats.minPingLatency = 0;
    }

    // Calculate packet loss rate
    const totalPings = hops.filter(h => h.pingResults !== null).length;
    const successfulPings = hops.filter(h => h.isReachable === true).length;
    stats.packetLossRate = totalPings > 0 ? ((totalPings - successfulPings) / totalPings) * 100 : 0;

    return stats;
  }

  /**
   * Calculate statistics for continuous mode
   */
  calculateContinuousStatistics(allHops, runCount, sessionDuration) {
    const baseStats = this.calculateStatistics(Array.from(allHops.values()));
    
    return {
      ...baseStats,
      runCount,
      sessionDuration,
      averageRunsPerMinute: sessionDuration > 0 ? (runCount / (sessionDuration / 60000)) : 0,
      hopStability: this.calculateHopStability(allHops),
      latencyTrends: this.calculateLatencyTrends(allHops)
    };
  }

  /**
   * Calculate hop stability across multiple runs
   */
  calculateHopStability(allHops) {
    const stability = {};
    
    allHops.forEach((hop, hopKey) => {
      if (hop.history && hop.history.length > 1) {
        const reachableCount = hop.history.filter(h => h.isReachable).length;
        const totalRuns = hop.history.length;
        stability[hopKey] = {
          stabilityRate: (reachableCount / totalRuns) * 100,
          totalRuns,
          reachableRuns: reachableCount,
          lastSeen: hop.history[hop.history.length - 1].runNumber
        };
      }
    });

    return stability;
  }

  /**
   * Calculate latency trends across multiple runs
   */
  calculateLatencyTrends(allHops) {
    const trends = {};
    
    allHops.forEach((hop, hopKey) => {
      if (hop.pingHistory && hop.pingHistory.length > 1) {
        const latencies = hop.pingHistory.map(h => h.latency);
        const recentLatencies = latencies.slice(-5); // Last 5 pings
        
        trends[hopKey] = {
          averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
          recentAverageLatency: recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length,
          latencyVariance: this.calculateVariance(latencies),
          trend: this.calculateTrend(latencies)
        };
      }
    });

    return trends;
  }

  /**
   * Calculate variance of a dataset
   */
  calculateVariance(data) {
    if (data.length < 2) return 0;
    
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / data.length;
  }

  /**
   * Calculate trend (increasing, decreasing, stable)
   */
  calculateTrend(data) {
    if (data.length < 3) return 'insufficient_data';
    
    const recent = data.slice(-3);
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate performance summary
   */
  generatePerformanceSummary(stats) {
    const summary = {
      overall: 'unknown',
      latency: 'unknown',
      reliability: 'unknown',
      recommendations: []
    };

    // Overall performance assessment
    if (stats.packetLossRate < 5 && stats.avgLatency < 50) {
      summary.overall = 'excellent';
    } else if (stats.packetLossRate < 10 && stats.avgLatency < 100) {
      summary.overall = 'good';
    } else if (stats.packetLossRate < 20 && stats.avgLatency < 200) {
      summary.overall = 'fair';
    } else {
      summary.overall = 'poor';
    }

    // Latency assessment
    if (stats.avgLatency < 20) {
      summary.latency = 'excellent';
    } else if (stats.avgLatency < 50) {
      summary.latency = 'good';
    } else if (stats.avgLatency < 100) {
      summary.latency = 'fair';
    } else {
      summary.latency = 'poor';
    }

    // Reliability assessment
    if (stats.packetLossRate < 1) {
      summary.reliability = 'excellent';
    } else if (stats.packetLossRate < 5) {
      summary.reliability = 'good';
    } else if (stats.packetLossRate < 10) {
      summary.reliability = 'fair';
    } else {
      summary.reliability = 'poor';
    }

    // Generate recommendations
    if (stats.packetLossRate > 10) {
      summary.recommendations.push('High packet loss detected. Check network stability.');
    }
    if (stats.avgLatency > 100) {
      summary.recommendations.push('High latency detected. Consider network optimization.');
    }
    if (stats.unreachableHops > stats.totalHops * 0.3) {
      summary.recommendations.push('Many unreachable hops. Network path may be unstable.');
    }

    return summary;
  }

  /**
   * Format statistics for display
   */
  formatStatistics(stats) {
    return {
      ...stats,
      avgLatencyFormatted: `${stats.avgLatency.toFixed(2)} ms`,
      maxLatencyFormatted: `${stats.maxLatency.toFixed(2)} ms`,
      minLatencyFormatted: `${stats.minLatency.toFixed(2)} ms`,
      packetLossRateFormatted: `${stats.packetLossRate.toFixed(1)}%`,
      reachabilityRate: stats.totalHops > 0 ? ((stats.reachableHops / stats.totalHops) * 100).toFixed(1) + '%' : '0%'
    };
  }
}

module.exports = TracerouteStatistics; 