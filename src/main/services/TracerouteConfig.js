const dns = require('dns').promises;

/**
 * Configuration management for traceroute operations
 */
class TracerouteConfig {
  constructor() {
    this.defaultConfig = {
      maxHops: 30,
      timeout: 0, // No timeout by default
      protocol: 'icmp',
      resolveHosts: true,
      hostnameTimeout: 5000, // 5 seconds timeout for hostname resolution
      pingHops: true,
      realTime: true,
      continuousPing: true,
      interval: 1000, // For continuous mode - faster for better user experience
      // Hop filtering options for faster results
      skipSlowHops: true, // Enable automatic slow hop skipping
      slowHopThreshold: 50, // Skip hops with latency > 50ms
      skipPacketLoss: true, // Skip hops with packet loss
      prioritizeFastHops: true, // Process fastest hops first
      maxHopsToProcess: 15 // Maximum number of hops to process (for faster results)
    };
  }

  /**
   * Validate and normalize configuration
   */
  validateConfig(config) {
    const {
      target,
      maxHops = this.defaultConfig.maxHops,
      timeout = this.defaultConfig.timeout,
      protocol = this.defaultConfig.protocol,
      port = null,
      resolveHosts = this.defaultConfig.resolveHosts,
      hostnameTimeout = this.defaultConfig.hostnameTimeout,
      pingHops = this.defaultConfig.pingHops,
      realTime = this.defaultConfig.realTime,
      interval = this.defaultConfig.interval,
      skipSlowHops = this.defaultConfig.skipSlowHops,
      slowHopThreshold = this.defaultConfig.slowHopThreshold,
      skipPacketLoss = this.defaultConfig.skipPacketLoss,
      prioritizeFastHops = this.defaultConfig.prioritizeFastHops,
      maxHopsToProcess = this.defaultConfig.maxHopsToProcess
    } = config;

    // Validate required fields
    if (!target || typeof target !== 'string') {
      throw new Error('Target is required and must be a string');
    }

    // Validate numeric fields
    if (maxHops < 1 || maxHops > 64) {
      throw new Error('Max hops must be between 1 and 64');
    }

    if (timeout < 0) {
      throw new Error('Timeout must be non-negative');
    }

    // Validate hostnameTimeout
    if (hostnameTimeout < 1000 || hostnameTimeout > 30000) {
      throw new Error('Hostname timeout must be between 1000 and 30000 ms');
    }

    // Validate maxHopsToProcess
    if (maxHopsToProcess < 1 || maxHopsToProcess > maxHops) {
      throw new Error(`Max hops to process must be between 1 and ${maxHops}`);
    }

    // Only validate interval if it's provided (for continuous mode)
    if (interval !== undefined && interval !== null) {
      if (interval < 1000 || interval > 60000) {
        throw new Error('Interval must be between 1000 and 60000 ms');
      }
    }

    // Validate protocol
    const validProtocols = ['icmp', 'udp', 'tcp'];
    if (!validProtocols.includes(protocol)) {
      throw new Error(`Protocol must be one of: ${validProtocols.join(', ')}`);
    }

    // Validate port for TCP/UDP
    if ((protocol === 'tcp' || protocol === 'udp') && port) {
      if (port < 1 || port > 65535) {
        throw new Error('Port must be between 1 and 65535');
      }
    }

    return {
      target: target.trim(),
      maxHops: parseInt(maxHops),
      timeout: parseInt(timeout),
      protocol,
      port: port ? parseInt(port) : null,
      resolveHosts: Boolean(resolveHosts),
      hostnameTimeout: parseInt(hostnameTimeout),
      pingHops: Boolean(pingHops),
      realTime: Boolean(realTime),
      interval: parseInt(interval),
      skipSlowHops: Boolean(skipSlowHops),
      slowHopThreshold: parseInt(slowHopThreshold),
      skipPacketLoss: Boolean(skipPacketLoss),
      prioritizeFastHops: Boolean(prioritizeFastHops),
      maxHopsToProcess: parseInt(maxHopsToProcess)
    };
  }

  /**
   * Resolve domain to IP address
   */
  async resolveTarget(target) {
    if (this.isIPAddress(target)) {
      return { ip: target, hostname: null };
    }

    try {
      const resolved = await dns.lookup(target);
      return { ip: resolved.address, hostname: target };
    } catch (error) {
      throw new Error(`Cannot resolve ${target}: ${error.message}`);
    }
  }

  /**
   * Check if string is a valid IP address
   */
  isIPAddress(str) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(str) || ipv6Regex.test(str);
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return { ...this.defaultConfig };
  }

  /**
   * Validate configuration specifically for continuous mode
   */
  validateContinuousConfig(config) {
    const validatedConfig = this.validateConfig(config);
    
    // Additional validation for continuous mode
    if (!validatedConfig.interval || validatedConfig.interval < 1000 || validatedConfig.interval > 60000) {
      throw new Error('Interval must be between 1000 and 60000 ms for continuous mode');
    }
    
    return validatedConfig;
  }

  /**
   * Merge configuration with defaults
   */
  mergeWithDefaults(config) {
    return {
      ...this.defaultConfig,
      ...config
    };
  }
}

module.exports = TracerouteConfig; 