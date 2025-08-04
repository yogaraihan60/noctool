import React, { useState } from 'react';
import { Globe, Search, Settings, FileText } from 'lucide-react';

const DnsLookup = () => {
  const [domain, setDomain] = useState('');
  const [whoisQuery, setWhoisQuery] = useState('');
  const [dnsResults, setDnsResults] = useState(null);
  const [whoisResults, setWhoisResults] = useState(null);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [whoisLoading, setWhoisLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDnsLookup = async () => {
    console.log('🚀 [DNS] Button clicked - Starting DNS lookup operation');
    console.log('📊 [DNS] Domain:', domain);

    if (!domain.trim()) {
      console.log('❌ [DNS] Error: No domain specified');
      setError('Please enter a domain');
      return;
    }

    console.log('⏳ [DNS] Setting loading state and clearing previous results');
    setDnsLoading(true);
    setError('');
    setDnsResults(null);

    try {
      console.log('📡 [DNS] Calling DNS lookup API for domain:', domain);
      const result = await window.electronAPI.dnsLookup(domain);
      console.log('✅ [DNS] DNS lookup completed:', result);
      
      if (result && result.success) {
        console.log('✅ [DNS] DNS lookup successful, data:', result.data);
        setDnsResults(result);
      } else {
        console.log('❌ [DNS] DNS lookup failed:', result?.error || 'Unknown error');
        setError(result?.error || 'DNS lookup failed');
      }
    } catch (err) {
      console.log('❌ [DNS] Error occurred:', err);
      setError(err.message || 'DNS lookup failed');
    } finally {
      console.log('🏁 [DNS] Operation completed, setting loading to false');
      setDnsLoading(false);
    }
  };

  const handleWhoisLookup = async () => {
    console.log('🚀 [WHOIS] Button clicked - Starting WHOIS lookup operation');
    console.log('📊 [WHOIS] Query:', whoisQuery);

    if (!whoisQuery.trim()) {
      console.log('❌ [WHOIS] Error: No query specified');
      setError('Please enter a domain or IP for WHOIS lookup');
      return;
    }

    console.log('⏳ [WHOIS] Setting loading state and clearing previous results');
    setWhoisLoading(true);
    setError('');
    setWhoisResults(null);

    try {
      console.log('📡 [WHOIS] Calling WHOIS lookup API for query:', whoisQuery);
      const result = await window.electronAPI.whoisLookup(whoisQuery);
      console.log('✅ [WHOIS] WHOIS lookup completed:', result);
      
      if (result && result.success) {
        console.log('✅ [WHOIS] WHOIS lookup successful, data length:', result.data?.length || 0);
        setWhoisResults(result);
      } else {
        console.log('❌ [WHOIS] WHOIS lookup failed:', result?.error || 'Unknown error');
        setError(result?.error || 'WHOIS lookup failed');
      }
    } catch (err) {
      console.log('❌ [WHOIS] Error occurred:', err);
      setError(err.message || 'WHOIS lookup failed');
    } finally {
      console.log('🏁 [WHOIS] Operation completed, setting loading to false');
      setWhoisLoading(false);
    }
  };

  const formatRecordType = (type) => {
    const colors = {
      'A': 'text-green-400',
      'AAAA': 'text-blue-400',
      'MX': 'text-purple-400',
      'NS': 'text-yellow-400',
      'TXT': 'text-orange-400',
      'CNAME': 'text-pink-400'
    };
    return colors[type] || 'text-gray-400';
  };

  const getRecordDescription = (type) => {
    const descriptions = {
      'A': 'IPv4 Address Record',
      'AAAA': 'IPv6 Address Record',
      'MX': 'Mail Exchange Record',
      'NS': 'Name Server Record',
      'TXT': 'Text Record',
      'CNAME': 'Canonical Name Record'
    };
    return descriptions[type] || 'Unknown Record Type';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">DNS Lookup</h1>
        <p className="text-gray-400 mt-2">Resolve domain names and query DNS records</p>
      </div>

      {/* DNS Lookup */}
      <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
          <Globe className="w-5 h-5 mr-2" />
          DNS Lookup
        </h2>
        
        <div className="flex space-x-4 mb-4">
          <input
            type="text"
            value={domain}
            onChange={(e) => {
              console.log('🌐 [DNS] Domain changed to:', e.target.value);
              setDomain(e.target.value);
              // Clear error when user starts typing
              if (error) setError('');
            }}
            placeholder="example.com"
            disabled={dnsLoading}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !dnsLoading && domain.trim()) {
                handleDnsLookup();
              }
            }}
            className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleDnsLookup}
            disabled={dnsLoading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {dnsLoading ? (
              <>
                <div className="spinner"></div>
                <span>Looking up...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Lookup</span>
              </>
            )}
          </button>
        </div>

        {/* DNS Results */}
        {dnsResults && (
          <div className="mt-6">
            {dnsResults.success ? (
              <div className="space-y-4">
                {Object.entries(dnsResults.data).map(([recordType, records]) => (
                  <div key={recordType} className="bg-dark-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`text-lg font-semibold ${formatRecordType(recordType)}`}>
                        {recordType}
                      </h3>
                      <span className="text-sm text-gray-400">
                        {getRecordDescription(recordType)}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      {Array.isArray(records) ? (
                        records.map((record, index) => (
                          <div key={index} className="bg-dark-600 rounded p-3">
                            <span className="text-white font-mono break-all">
                              {typeof record === 'object' && record.exchange ? 
                                `${record.exchange} (Priority: ${record.priority})` : 
                                Array.isArray(record) ? 
                                  record.join(' ') : 
                                  String(record)
                              }
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="bg-dark-600 rounded p-3">
                          <span className="text-white font-mono break-all">
                            {typeof records === 'object' && records.exchange ? 
                              `${records.exchange} (Priority: ${records.priority})` : 
                              Array.isArray(records) ? 
                                records.join(' ') : 
                                String(records)
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-400">{dnsResults.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* WHOIS Lookup */}
      <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          WHOIS Lookup
        </h2>
        
        <div className="flex space-x-4 mb-4">
          <input
            type="text"
            value={whoisQuery}
            onChange={(e) => {
              console.log('🔍 [WHOIS] Query changed to:', e.target.value);
              setWhoisQuery(e.target.value);
              // Clear error when user starts typing
              if (error) setError('');
            }}
            placeholder="example.com or 192.168.1.1"
            disabled={whoisLoading}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !whoisLoading && whoisQuery.trim()) {
                handleWhoisLookup();
              }
            }}
            className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleWhoisLookup}
            disabled={whoisLoading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {whoisLoading ? (
              <>
                <div className="spinner"></div>
                <span>Querying...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>WHOIS</span>
              </>
            )}
          </button>
        </div>

        {/* WHOIS Results */}
        {whoisResults && (
          <div className="mt-6">
            {whoisResults.success ? (
              <div className="bg-dark-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">WHOIS Information</h3>
                <pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-x-auto">
                  {whoisResults.data}
                </pre>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-400">{whoisResults.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Quick Examples */}
      <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          Quick Examples
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-dark-700 rounded-lg p-4">
            <h4 className="text-white font-medium mb-2">Popular Domains</h4>
            <div className="space-y-2">
              {['google.com', 'github.com', 'stackoverflow.com', 'reddit.com'].map((example) => (
                <button
                  key={example}
                  onClick={() => setDomain(example)}
                  className="block w-full text-left text-blue-400 hover:text-blue-300 text-sm"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
          
          <div className="bg-dark-700 rounded-lg p-4">
            <h4 className="text-white font-medium mb-2">Common Services</h4>
            <div className="space-y-2">
              {['cloudflare.com', 'amazon.com', 'microsoft.com', 'apple.com'].map((example) => (
                <button
                  key={example}
                  onClick={() => setDomain(example)}
                  className="block w-full text-left text-green-400 hover:text-green-300 text-sm"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DnsLookup; 