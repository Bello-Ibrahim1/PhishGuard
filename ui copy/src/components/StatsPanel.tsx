import { motion } from 'motion/react';
import { Shield, AlertTriangle, AlertCircle, CheckCircle2, Target, Crosshair } from 'lucide-react';
import { PhishGuardLogo } from './PhishGuardLogo';

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
      label: 'Emails Scanned',
      value: stats.total,
      icon: Target,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/50',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'Safe & Clean',
      value: stats.safe,
      icon: CheckCircle2,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/50',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      label: 'Suspicious',
      value: stats.warning,
      icon: AlertTriangle,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/50',
      gradient: 'from-yellow-500 to-orange-500',
    },
    {
      label: 'Threats Detected',
      value: stats.danger,
      icon: AlertCircle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/50',
      gradient: 'from-red-500 to-pink-500',
    },
  ];

  const threatScore = hasScanned && stats.total > 0 
    ? Math.round(((stats.safe / stats.total) * 100))
    : 0;

  return (
    <div className="space-y-4">
      {/* Main Stats Panel */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-white text-xl">Battle Report</h2>
        </div>

        {!hasScanned ? (
          <div className="text-center py-8">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-24 mx-auto mb-4"
            >
              <PhishGuardLogo size={96} animate={false} />
            </motion.div>
            <p className="text-slate-400 mb-2">Ready for Action</p>
            <p className="text-slate-500 text-sm">
              Start the hunt to analyze your inbox
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {statItems.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative overflow-hidden rounded-xl border-2 ${item.borderColor} ${item.bgColor} p-4 hover:shadow-lg transition-all backdrop-blur-sm`}
              >
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <motion.div 
                      className={`p-2 rounded-lg ${item.bgColor} border ${item.borderColor}`}
                      animate={item.value > 0 && item.label === 'Threats Detected' ? {
                        scale: [1, 1.1, 1],
                      } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                    </motion.div>
                    <span className="text-sm text-slate-300">{item.label}</span>
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: index * 0.1 + 0.2 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-3xl text-white">{item.value}</span>
                  </motion.div>
                </div>

                {/* Animated background bar */}
                {stats.total > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.value / stats.total) * 100}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                    className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r ${item.gradient} opacity-50`}
                  />
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Security Score */}
      {hasScanned && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700"
        >
          <div className="flex items-center gap-3 mb-4">
            <Crosshair className="w-5 h-5 text-yellow-400" />
            <h3 className="text-white">Security Score</h3>
          </div>
          
          <div className="relative">
            <div className="flex items-end justify-center mb-2">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.5 }}
                className={`text-6xl ${
                  threatScore >= 80 ? 'text-green-400' :
                  threatScore >= 50 ? 'text-yellow-400' :
                  'text-red-400'
                }`}
              >
                {threatScore}
              </motion.span>
              <span className="text-2xl text-slate-400 mb-2">/100</span>
            </div>
            
            <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${threatScore}%` }}
                transition={{ duration: 1, delay: 0.6 }}
                className={`h-full rounded-full ${
                  threatScore >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                  threatScore >= 50 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                  'bg-gradient-to-r from-red-500 to-pink-500'
                }`}
              />
            </div>
            
            <p className="text-center text-slate-400 text-sm mt-3">
              {threatScore >= 80 ? '🛡️ Excellent Protection' :
               threatScore >= 50 ? '⚠️ Moderate Risk Detected' :
               '☠️ High Threat Level'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Mission Brief */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="relative overflow-hidden bg-gradient-to-br from-yellow-600 to-orange-600 rounded-2xl p-6 shadow-2xl text-white"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10">
          <h3 className="mb-3 flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <span>Mission Brief</span>
          </h3>
          <p className="text-sm text-yellow-100 leading-relaxed">
            PhishGuard neutralizes email threats using advanced AI pattern recognition. 
            Never trust suspicious links or unexpected attachments. Stay vigilant, stay protected!
          </p>
        </div>
      </motion.div>
    </div>
  );
}
