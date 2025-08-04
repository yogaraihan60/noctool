import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Activity, 
  Route, 
  Search, 
  Network, 
  Globe, 
  Wifi,
  Clock,
  TrendingUp
} from 'lucide-react';

const Dashboard = () => {
  const [networkInterfaces, setNetworkInterfaces] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNetworkInfo();
  }, []);

  const loadNetworkInfo = async () => {
    try {
      const result = await window.electronAPI.getNetworkInterfaces();
      if (result.success) {
        setNetworkInterfaces(result.data);
      }
    } catch (error) {
      console.error('Failed to load network info:', error);
    } finally {
      setLoading(false);
    }
  };

  const tools = [
    {
      title: 'Ping Tool',
      description: 'Test connectivity and measure latency',
      icon: Activity,
      path: '/ping',
      color: 'bg-blue-500',
      features: ['HTTP Ping', 'ICMP Ping', 'Real-time stats']
    },
    {
      title: 'Traceroute',
      description: 'Map network path to destination',
      icon: Route,
      path: '/traceroute',
      color: 'bg-green-500',
      features: ['Hop-by-hop analysis', 'Latency measurement', 'Path visualization']
    },
    {
      title: 'Port Scanner',
      description: 'Discover open ports and services',
      icon: Search,
      path: '/port-scanner',
      color: 'bg-purple-500',
      features: ['TCP/UDP scanning', 'Service detection', 'Concurrent scanning']
    },
    {
      title: 'Network Info',
      description: 'View system network interfaces',
      icon: Network,
      path: '/network-info',
      color: 'bg-orange-500',
      features: ['Interface details', 'IP addresses', 'MAC addresses']
    },
    {
      title: 'DNS Lookup',
      description: 'Resolve domain names and records',
      icon: Globe,
      path: '/dns-lookup',
      color: 'bg-red-500',
      features: ['Multiple record types', 'Reverse lookup', 'WHOIS info']
    }
  ];

  const getActiveInterfaces = () => {
    if (!networkInterfaces) return 0;
    return Object.values(networkInterfaces).flat().filter(iface => !iface.internal).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-2">Network diagnostics and monitoring tools</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Active Interfaces</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : getActiveInterfaces()}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Wifi className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Available Tools</p>
              <p className="text-2xl font-bold text-white">{tools.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Platform</p>
              <p className="text-2xl font-bold text-white capitalize">
                {window.electronAPI?.platform || 'Unknown'}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Network Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <Link
              key={tool.path}
              to={tool.path}
              className="bg-dark-800 rounded-lg p-6 border border-dark-700 hover:border-primary-500 transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/10 group"
            >
              <div className="flex items-start space-x-4">
                <div className={`w-12 h-12 ${tool.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <tool.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white group-hover:text-primary-400 transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">{tool.description}</p>
                  <ul className="mt-3 space-y-1">
                    {tool.features.map((feature, index) => (
                      <li key={index} className="text-xs text-gray-500 flex items-center">
                        <div className="w-1 h-1 bg-primary-500 rounded-full mr-2"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => window.location.href = '/ping'}
            className="flex items-center space-x-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
          >
            <Activity className="w-5 h-5 text-blue-400" />
            <span className="text-blue-400 font-medium">Quick Ping</span>
          </button>
          <button
            onClick={() => window.location.href = '/traceroute'}
            className="flex items-center space-x-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors"
          >
            <Route className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-medium">Trace Route</span>
          </button>
          <button
            onClick={() => window.location.href = '/port-scanner'}
            className="flex items-center space-x-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-colors"
          >
            <Search className="w-5 h-5 text-purple-400" />
            <span className="text-purple-400 font-medium">Scan Ports</span>
          </button>
          <button
            onClick={() => window.location.href = '/dns-lookup'}
            className="flex items-center space-x-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            <Globe className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">DNS Lookup</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 