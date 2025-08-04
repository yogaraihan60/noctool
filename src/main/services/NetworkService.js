const os = require('os');
const dns = require('dns').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class NetworkService {
  constructor() {
    this.config = {
      timeout: 5000,
      retries: 3
    };
  }

  /**
   * Get network interfaces information
   */
  async getNetworkInterfaces() {
    try {
      const interfaces = os.networkInterfaces();
      const result = {};

      for (const [name, nets] of Object.entries(interfaces)) {
        result[name] = nets.map(net => ({
          address: net.address,
          netmask: net.netmask,
          family: net.family,
          mac: net.mac,
          internal: net.internal,
          cidr: net.cidr
        }));
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * DNS lookup for various record types
   */
  async dnsLookup(domain, recordType = 'A') {
    try {
      console.log('🔍 [DNS] Starting DNS lookup for domain:', domain);
      const records = {};
      
      // Common record types to check
      const recordTypes = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME'];
      
      for (const type of recordTypes) {
        try {
          console.log(`🔍 [DNS] Looking up ${type} record for ${domain}`);
          const result = await dns.resolve(domain, type);
          console.log(`✅ [DNS] Found ${type} records:`, result);
          records[type] = result;
        } catch (err) {
          console.log(`⚠️ [DNS] No ${type} record found for ${domain}:`, err.message);
          // Record type not found, skip
          continue;
        }
      }

      console.log('🔍 [DNS] Final records object:', records);
      
      // Check if we found any records
      if (Object.keys(records).length === 0) {
        return { success: false, error: `No DNS records found for ${domain}` };
      }

      return { success: true, data: records };
    } catch (error) {
      console.log('❌ [DNS] DNS lookup error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * WHOIS lookup using public WHOIS servers
   */
  async whoisLookup(query) {
    try {
      console.log('🔍 [WHOIS] Starting WHOIS lookup for query:', query);
      
      // Determine if query is IP or domain
      const isIP = this.validateIP(query);
      const isDomain = this.validateDomain(query);
      
      if (!isIP && !isDomain) {
        return { success: false, error: 'Invalid query format. Please enter a valid IP address or domain name.' };
      }

      // Try multiple WHOIS servers
      const whoisServers = [
        { host: 'whois.iana.org', port: 43 },
        { host: 'whois.arin.net', port: 43 },
        { host: 'whois.ripe.net', port: 43 },
        { host: 'whois.apnic.net', port: 43 }
      ];

      for (const server of whoisServers) {
        try {
          console.log(`🔍 [WHOIS] Trying server: ${server.host}:${server.port}`);
          const result = await this.queryWhoisServer(server.host, server.port, query);
          if (result.success) {
            console.log('✅ [WHOIS] WHOIS lookup successful');
            return result;
          }
        } catch (error) {
          console.log(`⚠️ [WHOIS] Server ${server.host} failed:`, error.message);
          continue;
        }
      }

      // If all servers fail, try a simple HTTP-based approach
      console.log('🔍 [WHOIS] Trying HTTP-based WHOIS lookup');
      return await this.httpWhoisLookup(query);
      
    } catch (error) {
      console.log('❌ [WHOIS] WHOIS lookup error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Query a WHOIS server directly
   */
  async queryWhoisServer(host, port, query) {
    return new Promise((resolve) => {
      const net = require('net');
      const client = new net.Socket();
      let data = '';

      client.setTimeout(10000);

      client.connect(port, host, () => {
        console.log(`🔍 [WHOIS] Connected to ${host}:${port}`);
        client.write(query + '\r\n');
      });

      client.on('data', (chunk) => {
        data += chunk.toString();
      });

      client.on('end', () => {
        client.destroy();
        if (data.trim()) {
          resolve({ success: true, data: data.trim() });
        } else {
          resolve({ success: false, error: 'No data received from WHOIS server' });
        }
      });

      client.on('error', (error) => {
        client.destroy();
        resolve({ success: false, error: error.message });
      });

      client.on('timeout', () => {
        client.destroy();
        resolve({ success: false, error: 'WHOIS query timed out' });
      });
    });
  }

  /**
   * HTTP-based WHOIS lookup as fallback
   */
  async httpWhoisLookup(query) {
    try {
      const https = require('https');
      
      return new Promise((resolve) => {
        const options = {
          hostname: 'whois.domaintools.com',
          port: 443,
          path: `/${encodeURIComponent(query)}`,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode === 200 && data.trim()) {
              // Extract WHOIS information from the HTML response
              const whoisMatch = data.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
              if (whoisMatch && whoisMatch[1]) {
                const whoisData = whoisMatch[1].replace(/<[^>]*>/g, '').trim();
                resolve({ success: true, data: whoisData });
              } else {
                resolve({ success: false, error: 'WHOIS data not found in response' });
              }
            } else {
              resolve({ success: false, error: `HTTP ${res.statusCode}: WHOIS lookup failed` });
            }
          });
        });

        req.on('error', (error) => {
          resolve({ success: false, error: `HTTP WHOIS failed: ${error.message}` });
        });

        req.setTimeout(10000, () => {
          req.destroy();
          resolve({ success: false, error: 'HTTP WHOIS lookup timed out' });
        });

        req.end();
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get ARP table
   */
  async getArpTable() {
    try {
      let command;
      
      if (process.platform === 'win32') {
        command = 'arp -a';
      } else {
        command = 'arp -n';
      }

      const { stdout, stderr } = await execAsync(command, { timeout: 5000 });
      
      if (stderr) {
        return { success: false, error: stderr };
      }

      return { success: true, data: stdout };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate IP address format
   */
  validateIP(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Validate domain name format
   */
  validateDomain(domain) {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain);
  }

  /**
   * Resolve domain to IP
   */
  async resolveDomain(domain, family = 4) {
    try {
      const addresses = await dns.lookup(domain, { family });
      return { success: true, data: addresses };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = NetworkService; 