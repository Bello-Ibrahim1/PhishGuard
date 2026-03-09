import { Shield, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export function Header() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 shadow-2xl"
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.div 
            className="relative"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="absolute inset-0 bg-white rounded-2xl blur-xl opacity-50" />
            <div className="relative bg-white p-3 rounded-2xl shadow-lg">
              <Shield className="w-8 h-8 text-indigo-600" />
            </div>
          </motion.div>
          
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white text-3xl tracking-tight">PhishGuard</h1>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-5 h-5 text-yellow-300" />
              </motion.div>
            </div>
            <p className="text-indigo-100 mt-1">AI-Powered Email Security Guardian</p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-white text-sm">Active Protection</span>
        </div>
      </div>
    </motion.div>
  );
}
