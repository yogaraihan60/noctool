import React, { useState, useEffect } from 'react';
import { Network, RefreshCw, Wifi, Server, Clock } from 'lucide-react';

const NetworkInfo = () => {
  const [networkInterfaces, setNetworkInterfaces] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNetworkInfo();
  }, []);

  const loadNetworkInfo = async () => {
    console.log('🚀 [NETWORKINFO] Button clicked - Loading network information');
    console.log('⏳ [NETWORKINFO] Setting loading state');
    setLoading(true);
    setError('');
    
    try {
      console.log('📡 [NETWORKINFO] Calling getNetworkInterfaces API');
      const interfacesResult = await window.electronAPI.getNetworkInterfaces();
      console.log('✅ [NETWORKINFO] Network interfaces loaded:', interfacesResult);
      
      if (interfacesResult.success) {
        setNetworkInterfaces(interfacesResult.data);
      } else {
        console.log('❌ [NETWORKINFO] Error loading interfaces:', interfacesResult.error);
        setError(interfacesResult.error);
      }
    } catch (err) {
      console.log('❌ [NETWORKINFO] Exception occurred:', err);
      setError('Failed to load network information');
    } finally {
      console.log('🏁 [NETWORKINFO] Operation completed, setting loading to false');
      setLoading(false);
    }
  };

  const getInterfaceStatus = (iface) => {
    if (iface.internal) return 'Loopback';
    if (iface.address && iface.address !== '127.0.0.1') return 'Active';
    return 'Inactive';
  };



  const getStatusBgColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-green-500/20 text-green-400';
      case 'Loopback': return 'bg-blue-500/20 text-blue-400';
      case 'Inactive': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatMAC = (mac) => {
    if (!mac) return 'N/A';
    return mac.toUpperCase().replace(/(.{2})/g, '$1:').slice(0, -1);
  };

  const getActiveInterfaces = () => {
    if (!networkInterfaces) return 0;
    return Object.values(networkInterfaces).flat().filter(iface => 
      !iface.internal && iface.address && iface.address !== '127.0.0.1'
    ).length;
  };

  const getTotalInterfaces = () => {
    if (!networkInterfaces) return 0;
    return Object.values(networkInterfaces).flat().length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Network Information</h1>
          <p className="text-gray-400 mt-2">System network interfaces and configuration</p>
        </div>
        <button
          onClick={loadNetworkInfo}
          disabled={loading}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Interfaces</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : getTotalInterfaces()}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Active Interfaces</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : getActiveInterfaces()}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Wifi className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Last Updated</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : new Date().toLocaleTimeString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Network Interfaces */}
      {networkInterfaces && (
        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Server className="w-5 h-5 mr-2" />
            Network Interfaces
          </h2>
          
          <div className="space-y-4">
            {Object.entries(networkInterfaces).map(([name, interfaces]) => (
              <div key={name} className="border border-dark-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-white mb-3">{name}</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {interfaces.map((iface, index) => {
                    const status = getInterfaceStatus(iface);
                    return (
                      <div key={index} className="bg-dark-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-300">
                            {iface.family === 'IPv4' ? 'IPv4' : 'IPv6'}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${getStatusBgColor(status)}`}>
                            {status}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Address:</span>
                            <span className="text-white font-mono">{iface.address || 'N/A'}</span>
                          </div>
                          
                          {iface.netmask && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Netmask:</span>
                              <span className="text-white font-mono">{iface.netmask}</span>
                            </div>
                          )}
                          
                          {iface.cidr && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">CIDR:</span>
                              <span className="text-white font-mono">{iface.cidr}</span>
                            </div>
                          )}
                          
                          {iface.mac && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">MAC:</span>
                              <span className="text-white font-mono">{formatMAC(iface.mac)}</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between">
                            <span className="text-gray-400">Internal:</span>
                            <span className={iface.internal ? 'text-yellow-400' : 'text-green-400'}>
                              {iface.internal ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <div className="flex items-center justify-center py-8">
            <div className="spinner mr-4"></div>
            <span className="text-gray-400">Loading network information...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkInfo; 