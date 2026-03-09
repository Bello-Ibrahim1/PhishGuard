import { motion } from 'motion/react';
import { Zap, Activity } from 'lucide-react';
import { PhishGuardLogo } from './PhishGuardLogo';

export function Header() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-8 shadow-2xl border border-blue-500/20"
    >
      {/* Animated grid background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.5) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Glowing orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }} />
      
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <motion.div
              className="relative"
              animate={{ 
                y: [0, -5, 0],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute inset-0 bg-yellow-400 rounded-3xl blur-2xl opacity-30" />
              <div className="relative bg-gradient-to-br from-white to-blue-100 p-4 rounded-3xl shadow-2xl border-4 border-yellow-400">
                <PhishGuardLogo size={80} animate={true} />
              </div>
            </motion.div>
            
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-white text-4xl tracking-tight">PhishGuard</h1>
                <motion.div
                  animate={{ 
                    scale: [1, 1.3, 1],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Zap className="w-7 h-7 text-yellow-400 fill-yellow-400" />
                </motion.div>
              </div>
              <p className="text-blue-200 text-lg">Elite Email Threat Neutralizer</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
                <span className="text-yellow-400 text-sm">AI-Powered Defense Active</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 bg-green-500/20 backdrop-blur-sm px-5 py-3 rounded-2xl border border-green-400/30 shadow-lg">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="w-3 h-3 bg-green-400 rounded-full shadow-lg shadow-green-400/50" />
              </motion.div>
              <div>
                <div className="text-green-300 text-xs">System Status</div>
                <div className="text-white">PROTECTED</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-blue-500/20 backdrop-blur-sm px-5 py-3 rounded-2xl border border-blue-400/30">
              <Activity className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-blue-300 text-xs">Threats Blocked</div>
                <motion.div 
                  className="text-white"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  1,247 Today
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
