
import React from 'react';

const Dashboard: React.FC = () => {
  const stats = [
    { label: 'Total Scans', value: '1,284', color: 'bg-blue-500', icon: '📡' },
    { label: 'Critical Vulns', value: '12', color: 'bg-red-500', icon: '⚠️' },
    { label: 'Images Protected', value: '45', color: 'bg-green-500', icon: '🛡️' },
    { label: 'Avg Health Score', value: '82%', color: 'bg-amber-500', icon: '❤️' },
  ];

  const recentAudits = [
    { name: 'frontend-nginx:latest', type: 'Docker', score: 94, date: '2 hours ago' },
    { name: 'production-cluster-iac', type: 'Terraform', score: 68, date: '5 hours ago' },
    { name: 'redis-cache-layer', type: 'Docker', score: 81, date: 'Yesterday' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
              <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
            </div>
            <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center text-white text-xl`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Recent Audit Activity</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs uppercase text-gray-400 font-semibold border-b border-gray-100">
                  <tr>
                    <th className="pb-3">Asset Name</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Health Score</th>
                    <th className="pb-3 text-right">Last Scanned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentAudits.map((audit) => (
                    <tr key={audit.name} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 font-medium text-gray-800">{audit.name}</td>
                      <td className="py-4">
                        <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-medium">
                          {audit.type}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${audit.score > 80 ? 'bg-green-500' : audit.score > 60 ? 'bg-amber-500' : 'bg-red-500'}`} 
                              style={{ width: `${audit.score}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold">{audit.score}%</span>
                        </div>
                      </td>
                      <td className="py-4 text-right text-sm text-gray-500">{audit.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-900 p-6 rounded-xl shadow-lg text-white">
            <h3 className="text-lg font-bold mb-2">Upgrade to Pro</h3>
            <p className="text-indigo-200 text-sm mb-4">
              Get unlimited AI analysis, automated remediation PRs, and team collaboration.
            </p>
            <button className="w-full bg-white text-indigo-900 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-colors">
              Upgrade Now
            </button>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Audit Breakdown</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Dockerfiles</span>
                <span className="text-sm font-bold">65%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: '65%' }}></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Terraform</span>
                <span className="text-sm font-bold">25%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full">
                <div className="h-full bg-cyan-500 rounded-full" style={{ width: '25%' }}></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">K8s Manifests</span>
                <span className="text-sm font-bold">10%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '10%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
