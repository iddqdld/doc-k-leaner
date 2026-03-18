
import React from 'react';

const nodes = [
  { id: 'node-01', status: 'Ready', cpu: '45%', ram: '62%', type: 'Master' },
  { id: 'node-02', status: 'Ready', cpu: '88%', ram: '55%', type: 'Worker' },
  { id: 'node-03', status: 'NotReady', cpu: '0%', ram: '0%', type: 'Worker' },
];

const Infrastructure: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Kubernetes Cluster Overview</h2>
          <p className="text-gray-500">Real-time status of your connected infrastructure nodes.</p>
        </div>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
          Connect New Cluster
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {nodes.map((node) => (
          <div key={node.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${node.status === 'Ready' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <h3 className="font-bold text-gray-900">{node.id}</h3>
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded">
                {node.type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">CPU Load</p>
                <p className="text-lg font-bold text-gray-800">{node.cpu}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">RAM Usage</p>
                <p className="text-lg font-bold text-gray-800">{node.ram}</p>
              </div>
            </div>

            <button className="w-full py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
              Node Details
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-bold text-gray-900">Infrastructure Logs</h3>
          <span className="text-xs text-gray-400">Last 10 events</span>
        </div>
        <div className="p-0">
          <div className="bg-slate-900 p-6 text-indigo-400 font-mono text-sm h-64 overflow-y-auto">
            <p>[2023-10-24 14:22:01] <span className="text-green-400">INFO</span>: Reconciling ingress controller in 'prod' namespace.</p>
            <p>[2023-10-24 14:22:05] <span className="text-green-400">INFO</span>: Node 'node-02' reported 88% CPU utilization.</p>
            <p>[2023-10-24 14:23:12] <span className="text-red-400">ERROR</span>: Node 'node-03' heartbeats lost. Initiating failover.</p>
            <p>[2023-10-24 14:24:45] <span className="text-amber-400">WARN</span>: Image 'registry.dockleaner.io/api:v2.1' has high-severity CVE-2023-0192.</p>
            <p>[2023-10-24 14:25:00] <span className="text-green-400">INFO</span>: Initializing automated security scan for 'infrastructure-as-code' repository...</p>
            <p className="animate-pulse">_</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Infrastructure;
