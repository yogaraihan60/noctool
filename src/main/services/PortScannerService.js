const net = require('net');
const dns = require('dns').promises;
const findPort = require('find-open-port');

class PortScannerService {
  constructor() {
    this.defaultConfig = {
      timeout: 5000,
      concurrency: 10,
      scanType: 'connect'
    };
  }

  /**
   * Scan ports on target host
   */
  async scan(config, onProgress = null) {
    const {
      target,
      ports = '1-1024',
      scanType = 'connect',
      timeout = 5000,
      concurrency = 10,
      serviceDetection = false
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

      // Parse port range
      const portList = this.parsePortRange(ports);
      if (!portList.length) {
        return { success: false, error: 'Invalid port range' };
      }

      const results = await this.scanPorts(ipAddress, portList, {
        scanType,
        timeout,
        concurrency,
        serviceDetection
      }, onProgress);

      const statistics = this.calculateScanStatistics(results);

      return {
        success: true,
        target: target,
        ipAddress: ipAddress,
        scanType: scanType,
        ports: portList,
        results: results,
        statistics: statistics,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse port range string into array of ports
   */
  parsePortRange(ports) {
    const portList = [];
    const parts = ports.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(p => parseInt(p.trim()));
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= 65535) {
              portList.push(i);
            }
          }
        }
      } else {
        const port = parseInt(trimmed);
        if (!isNaN(port) && port >= 1 && port <= 65535) {
          portList.push(port);
        }
      }
    }

    return [...new Set(portList)].sort((a, b) => a - b);
  }

  /**
   * Scan ports with specified configuration
   */
  async scanPorts(target, ports, config, onProgress) {
    const { scanType, timeout, concurrency, serviceDetection } = config;
    const results = [];
    const chunks = this.chunkArray(ports, concurrency);
    let completedPorts = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const promises = chunk.map(port => this.scanPort(target, port, scanType, timeout, serviceDetection));
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
      
      completedPorts += chunkResults.length;
      
      // Report progress
      if (onProgress && typeof onProgress === 'function') {
        onProgress({
          completed: completedPorts,
          total: ports.length,
          percentage: (completedPorts / ports.length) * 100,
          currentChunk: i + 1,
          totalChunks: chunks.length,
          recentResults: chunkResults
        });
      }
    }

    return results;
  }

  /**
   * Scan individual port
   */
  async scanPort(target, port, scanType, timeout, serviceDetection) {
    const result = {
      port: port,
      state: 'closed',
      service: null,
      latency: null,
      timestamp: new Date().toISOString()
    };

    try {
      const startTime = Date.now();
      
      if (scanType === 'connect') {
        const isOpen = await this.tcpConnect(target, port, timeout);
        result.state = isOpen ? 'open' : 'closed';
        
        if (isOpen) {
          result.latency = Date.now() - startTime;
          
          if (serviceDetection) {
            result.service = this.detectService(port);
          }
        }
      } else if (scanType === 'syn') {
        // SYN scan requires raw sockets - simplified implementation
        const isOpen = await this.tcpConnect(target, port, timeout);
        result.state = isOpen ? 'open' : 'closed';
        
        if (isOpen) {
          result.latency = Date.now() - startTime;
          
          if (serviceDetection) {
            result.service = this.detectService(port);
          }
        }
      }

    } catch (error) {
      result.state = 'error';
      result.error = error.message;
    }

    return result;
  }

  /**
   * TCP connect scan
   */
  async tcpConnect(target, port, timeout) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      }, timeout);

      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          socket.destroy();
          resolve(true);
        }
      });

      socket.on('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          socket.destroy();
          resolve(false);
        }
      });

      socket.on('timeout', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          socket.destroy();
          resolve(false);
        }
      });

      socket.connect(port, target);
    });
  }

  /**
   * Check if a port is available on localhost using find-open-port
   */
  async checkPortAvailability(port) {
    try {
      const isAvailable = await findPort.isAvailable(port);
      return isAvailable;
    } catch (error) {
      // Fallback to TCP connect method if find-open-port fails
      return this.tcpConnect('localhost', port, 1000);
    }
  }

  /**
   * Find an open port on localhost
   */
  async findOpenPort() {
    try {
      const port = await findPort();
      return port;
    } catch (error) {
      // Fallback: try common ports
      const commonPorts = [3000, 3001, 8080, 8000, 5000, 4000];
      for (const port of commonPorts) {
        const isAvailable = await this.checkPortAvailability(port);
        if (isAvailable) {
          return port;
        }
      }
      throw new Error('No open ports found');
    }
  }

  /**
   * Detect service based on port number
   */
  detectService(port) {
    const commonServices = {
      20: 'FTP-DATA',
      21: 'FTP',
      22: 'SSH',
      23: 'TELNET',
      25: 'SMTP',
      53: 'DNS',
      67: 'DHCP',
      68: 'DHCP',
      69: 'TFTP',
      80: 'HTTP',
      110: 'POP3',
      119: 'NNTP',
      123: 'NTP',
      135: 'RPC',
      137: 'NetBIOS',
      138: 'NetBIOS',
      139: 'NetBIOS',
      143: 'IMAP',
      161: 'SNMP',
      162: 'SNMP-TRAP',
      389: 'LDAP',
      443: 'HTTPS',
      445: 'SMB',
      465: 'SMTPS',
      514: 'Syslog',
      515: 'LPR',
      587: 'SMTP',
      631: 'IPP',
      636: 'LDAPS',
      993: 'IMAPS',
      995: 'POP3S',
      1433: 'MSSQL',
      1521: 'Oracle',
      1723: 'PPTP',
      3306: 'MySQL',
      3389: 'RDP',
      5432: 'PostgreSQL',
      5900: 'VNC',
      6379: 'Redis',
      8080: 'HTTP-Alt',
      8443: 'HTTPS-Alt',
      9000: 'Webmin'
    };

    return commonServices[port] || 'Unknown';
  }

  /**
   * Calculate scan statistics
   */
  calculateScanStatistics(results) {
    const stats = {
      total: results.length,
      open: results.filter(r => r.state === 'open').length,
      closed: results.filter(r => r.state === 'closed').length,
      error: results.filter(r => r.state === 'error').length,
      openRate: 0
    };

    if (stats.total > 0) {
      stats.openRate = (stats.open / stats.total) * 100;
    }

    const openPorts = results.filter(r => r.state === 'open');
    if (openPorts.length > 0) {
      const latencies = openPorts.map(r => r.latency).filter(l => l !== null);
      if (latencies.length > 0) {
        stats.avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        stats.minLatency = Math.min(...latencies);
        stats.maxLatency = Math.max(...latencies);
      }
    }

    return stats;
  }

  /**
   * Split array into chunks for concurrent processing
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
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

module.exports = PortScannerService; 