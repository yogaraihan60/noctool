import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const HopChart = ({ hop, isExpanded = false }) => {
  if (!hop || !hop.pingHistory || hop.pingHistory.length === 0) {
    return null;
  }

  const chartData = {
    labels: hop.pingHistory.map((ping, index) => `P${ping.pingNumber}`),
    datasets: [
      {
        label: 'Latency (ms)',
        data: hop.pingHistory.map(ping => ping.latency),
        borderColor: hop.pingHistory.map(ping => {
          if (ping.isLongTimeout) return 'rgb(220, 38, 38)'; // Dark red for 1000ms+ timeouts
          if (ping.isSlowPing) return 'rgb(239, 68, 68)'; // Red for slow pings >100ms
          if (ping.isTimeout) return 'rgb(239, 68, 68)'; // Red for regular timeouts
          return 'rgb(34, 197, 94)'; // Green for successful pings
        }),
        backgroundColor: hop.pingHistory.map(ping => {
          if (ping.isLongTimeout) return 'rgba(220, 38, 38, 0.2)'; // Dark red background for 1000ms+ timeouts
          if (ping.isSlowPing) return 'rgba(239, 68, 68, 0.15)'; // Red background for slow pings >100ms
          if (ping.isTimeout) return 'rgba(239, 68, 68, 0.1)'; // Red background for regular timeouts
          return 'rgba(34, 197, 94, 0.1)'; // Green background for successful pings
        }),
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (context) => `Ping ${context[0].label}`,
          label: (context) => `${context.parsed.y.toFixed(1)}ms`
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Ping Number',
          color: '#9ca3af'
        },
        ticks: {
          color: '#9ca3af',
          maxTicksLimit: 10
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.1)'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Latency (ms)',
          color: '#9ca3af'
        },
        ticks: {
          color: '#9ca3af'
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.1)'
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  const stats = {
    totalPings: hop.pingHistory.length,
    avgLatency: hop.pingHistory.reduce((sum, ping) => sum + ping.latency, 0) / hop.pingHistory.length,
    minLatency: Math.min(...hop.pingHistory.map(ping => ping.latency)),
    maxLatency: Math.max(...hop.pingHistory.map(ping => ping.latency)),
    reachablePings: hop.pingHistory.filter(ping => ping.isReachable).length
  };

  return (
    <div className={`bg-dark-700 rounded-lg p-4 border border-dark-600 transition-all duration-300 ${isExpanded ? 'col-span-full' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {hop.hop}
          </div>
          <div>
            <h4 className="text-white font-semibold">
              Hop {hop.hop} - {hop.hostname || hop.ip || 'Unknown'}
            </h4>
            <p className="text-gray-400 text-sm">
              Ping Count: {hop.pingCount || stats.totalPings}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="text-center">
            <div className="text-white font-semibold">{stats.avgLatency.toFixed(1)}ms</div>
            <div className="text-gray-400">Avg</div>
          </div>
          <div className="text-center">
            <div className="text-white font-semibold">{stats.minLatency.toFixed(1)}ms</div>
            <div className="text-gray-400">Min</div>
          </div>
          <div className="text-center">
            <div className="text-white font-semibold">{stats.maxLatency.toFixed(1)}ms</div>
            <div className="text-gray-400">Max</div>
          </div>
          <div className="text-center">
            <div className="text-white font-semibold">{stats.reachablePings}/{stats.totalPings}</div>
            <div className="text-gray-400">Success</div>
          </div>
        </div>
      </div>
      
      <div className="h-48">
        <Line data={chartData} options={options} />
      </div>
      
             {/* Ping History Table */}
       <div className="mt-4">
         <h5 className="text-white font-semibold mb-2">Recent Pings</h5>
         <div className="grid grid-cols-5 gap-2 text-xs">
           {hop.pingHistory.slice(-10).map((ping, index) => (
             <div
               key={index}
               className={`p-2 rounded text-center ${
                 ping.isLongTimeout 
                   ? 'bg-red-800 text-red-100 border border-red-600' // Dark red for 1000ms+ timeouts
                   : ping.isSlowPing 
                   ? 'bg-red-700 text-red-100 border border-red-500' // Red for slow pings >100ms
                   : ping.isTimeout 
                   ? 'bg-red-900 text-red-100' // Red for regular timeouts
                   : 'bg-green-900 text-green-100' // Green for successful pings
               }`}
               title={ping.isLongTimeout ? '1000ms+ Timeout' : ping.isSlowPing ? 'Slow Ping >100ms' : ping.isTimeout ? 'Timeout' : 'Success'}
             >
               <div className="font-bold">P{ping.pingNumber}</div>
               <div>{ping.latency ? ping.latency.toFixed(1) + 'ms' : 'TO'}</div>
             </div>
           ))}
         </div>
       </div>
    </div>
  );
};

export default HopChart; 