import React, { useState } from 'react';
import { Loader, CheckCircle, ChevronDown, ChevronRight, XCircle, Trash2 } from 'lucide-react';
import useProcessManager from '../hooks/useProcessManager';

const StatusPill = ({ icon: Icon, label, color }) => (
  <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${color}`}>
    <Icon className="w-3.5 h-3.5 mr-1.5" />
    {label}
  </div>
);

const TabProcessContainer = ({ children }) => {
  const [showDetails, setShowDetails] = useState(false);
  const {
    activeProcessesList,
    completedProcessesList,
    activeCount,
    completedCount,
    stopAllProcesses,
    stopProcess,
    cleanupCompletedProcesses,
  } = useProcessManager();

  const hasAny = activeCount > 0 || completedCount > 0;

  return (
    <div className="h-full flex flex-col">
      {hasAny && (
        <div className="sticky top-0 z-30 bg-dark-800/95 backdrop-blur border-b border-dark-700">
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <StatusPill
                  icon={Loader}
                  label={`${activeCount} active`}
                  color="bg-blue-500/10 text-blue-300 border border-blue-500/20"
                />
              )}
              {completedCount > 0 && (
                <StatusPill
                  icon={CheckCircle}
                  label={`${completedCount} completed`}
                  color="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                />
              )}
              <button
                className="ml-2 inline-flex items-center text-xs text-gray-300 hover:text-white"
                onClick={() => setShowDetails((s) => !s)}
              >
                {showDetails ? (
                  <ChevronDown className="w-4 h-4 mr-1" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-1" />
                )}
                Details
              </button>
            </div>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <button
                  onClick={stopAllProcesses}
                  className="inline-flex items-center px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                >
                  <XCircle className="w-4 h-4 mr-1" /> Stop all
                </button>
              )}
              {completedCount > 0 && (
                <button
                  onClick={cleanupCompletedProcesses}
                  className="inline-flex items-center px-2 py-1 text-xs rounded bg-amber-600 text-white hover:bg-amber-700"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Clear completed
                </button>
              )}
            </div>
          </div>

          {showDetails && (
            <div className="px-4 pb-3">
              {activeProcessesList.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">Active</div>
                  <div className="space-y-1">
                    {activeProcessesList.map((p) => (
                      <div key={p.sessionId} className="flex items-center justify-between text-xs bg-dark-900 border border-dark-700 rounded px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-300">{p.type}</span>
                          <span className="text-gray-500">{p.sessionId}</span>
                          {typeof p.duration === 'number' && (
                            <span className="text-gray-500">{Math.floor(p.duration / 1000)}s</span>
                          )}
                        </div>
                        <button
                          onClick={() => stopProcess(p.sessionId)}
                          className="inline-flex items-center px-2 py-0.5 rounded bg-red-700/60 text-white hover:bg-red-700"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Stop
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {completedProcessesList.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-gray-400 mb-1">Completed</div>
                  <div className="space-y-1">
                    {completedProcessesList.map((p) => (
                      <div key={p.sessionId} className="text-xs bg-dark-900 border border-dark-700 rounded px-2 py-1.5 text-gray-400">
                        <span className="font-mono text-gray-300">{p.type}</span>
                        <span className="mx-2">—</span>
                        <span>{p.sessionId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
};

export default TabProcessContainer;