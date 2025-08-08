import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import PingTool from './pages/PingTool';
import TracerouteTool from './pages/TracerouteTool';
import PortScanner from './pages/PortScanner';
import NetworkInfo from './pages/NetworkInfo';
import DnsLookup from './pages/DnsLookup';
import TabProcessContainer from './components/TabProcessContainer';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-dark-900 text-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <TabProcessContainer>
            <div className="p-6">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/ping" element={<PingTool />} />
                <Route path="/traceroute" element={<TracerouteTool />} />
                <Route path="/port-scanner" element={<PortScanner />} />
                <Route path="/network-info" element={<NetworkInfo />} />
                <Route path="/dns-lookup" element={<DnsLookup />} />
              </Routes>
            </div>
          </TabProcessContainer>
        </main>
      </div>
    </Router>
  );
}

export default App; 