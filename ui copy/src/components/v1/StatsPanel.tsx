import { motion } from 'motion/react';
import { Shield, AlertTriangle, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';

interface StatsPanelProps {
  stats: {
    total: number;
    safe: number;
    warning: number;
    danger: number;
  };
  hasScanned: boolean;
}

export function StatsPanel({ stats, hasScanned }: StatsPanelProps) {
  const statItems = [
    {
      label: 'Total Scanned',
      value: stats.total,
      icon: Shield,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      gradient: 'from-indigo-500 to-purple-500',
    },
    {
      label: 'Safe',
      value: stats.safe,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      label: 'Suspicious',
      value: stats.warning,
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      gradient: 'from-yellow-500 to-orange-500',
    },
    {
      label: 'Dangerous',
      value: stats.danger,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      gradient: 'from-red-500 to-pink-500',
    },
  ];

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-slate-900">Security Overview</h2>
        </div>

        {!hasScanned ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Shield className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">
              Click "Scan My Inbox" to analyze your emails
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {statItems.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative overflow-hidden rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${item.bgColor}`}>
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <span className="text-sm text-slate-700">{item.label}</span>
                  </div>
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: index * 0.1 + 0.2 }}
                    className="text-2xl text-slate-900"
                  >
                    {item.value}
                  </motion.span>
                </div>

                {/* Animated background bar */}
                {stats.total > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.value / stats.total) * 100}%` }}
                    transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
                    className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r ${item.gradient} opacity-20`}
                  />
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Security Tips */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 shadow-lg text-white"
      >
        <h3 className="mb-3">🛡️ Pro Tip</h3>
        <p className="text-sm text-indigo-100 leading-relaxed">
          Always verify sender addresses before clicking links or downloading attachments. 
          Legitimate companies never ask for passwords via email.
        </p>
      </motion.div>
    </div>
  );
}
