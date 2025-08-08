import React from 'react';
import { 
  Home, 
  Wifi, 
  Route, 
  Search, 
  Network, 
  Globe,
  Activity,
  AlertTriangle,
  Loader,
  CheckCircle,
  Trash2
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import useProcessManager from '../hooks/useProcessManager';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { navigateWithConfirmation } = useProcessManager();

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/ping', icon: Activity, label: 'Ping Tool' },
    { path: '/traceroute', icon: Route, label: 'Traceroute' },
    { path: '/port-scanner', icon: Search, label: 'Port Scanner' },
    { path: '/network-info', icon: Network, label: 'Network Info' },
    { path: '/dns-lookup', icon: Globe, label: 'DNS Lookup' },
  ];

  const handleNavClick = (e, path) => {
    e.preventDefault();
    console.log('🧪 [Sidebar] Navigating to:', path);
    navigateWithConfirmation(path);
  };

  return (
    <div className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col">
      <div className="p-6 border-b border-dark-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Wifi className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Noctool</h1>
        </div>
        <p className="text-sm text-gray-400 mt-1">Network Utility Tool</p>
        
        {/* Current Location Display */}
        <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="text-xs text-blue-400">
            Current: {location.pathname}
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <a
                href={item.path}
                onClick={(e) => handleNavClick(e, item.path)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-dark-700 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
        
        {/* Navigation Test Buttons */}
        <div className="mt-4 space-y-2">
          <button
            onClick={() => {
              console.log('🧪 [Sidebar] Test navigation to /ping');
              navigateWithConfirmation('/ping');
            }}
            className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Test Ping
          </button>
          <button
            onClick={() => {
              console.log('🧪 [Sidebar] Test navigation to /traceroute');
              navigateWithConfirmation('/traceroute');
            }}
            className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            Test Traceroute
          </button>
        </div>
      </nav>
      
      <div className="p-4 border-t border-dark-700">
        <div className="text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>Status</span>
            <span className="font-mono text-green-400">Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar; 