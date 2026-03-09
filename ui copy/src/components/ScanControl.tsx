import { motion } from 'motion/react';
import { Scan, Loader2, CheckCircle2, Crosshair, Shield } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ExportButton } from './ExportButton';

interface Email {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  timestamp: string;
  hasAttachment: boolean;
  attachmentName?: string;
  threatLevel?: 'safe' | 'warning' | 'danger';
  threats?: string[];
  scanned?: boolean;
}

interface ScanControlProps {
  onScan: () => void;
  isScanning: boolean;
  progress: number;
  emailCount: number;
  emails: Email[];
}

export function ScanControl({ onScan, isScanning, progress, emailCount, emails }: ScanControlProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700"
    >
      {/* Tech grid background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.5) 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        }} />
      </div>

      <div className="relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: isScanning ? 360 : 0 }}
                transition={{ duration: 2, repeat: isScanning ? Infinity : 0, ease: "linear" }}
              >
                <Crosshair className="w-6 h-6 text-yellow-400" />
              </motion.div>
              <h2 className="text-white text-xl">Threat Detection System</h2>
            </div>
            
            <p className="text-slate-300">
              {isScanning 
                ? `🎯 Hunting threats in ${emailCount} emails...`
                : progress === 100
                ? '✅ Mission complete! Inbox secured.'
                : `Ready to scan ${emailCount} emails for threats`
              }
            </p>

            {isScanning && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm text-blue-400"
              >
                <Shield className="w-4 h-4 animate-pulse" />
                <span>AI analyzing patterns, domains, and attachments...</span>
              </motion.div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <ExportButton emails={emails} disabled={isScanning} />
            
            <motion.div
              whileHover={{ scale: isScanning ? 1 : 1.05 }}
              whileTap={{ scale: isScanning ? 1 : 0.95 }}
            >
              <Button
                onClick={onScan}
                disabled={isScanning}
                className="relative overflow-hidden bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 text-white px-10 py-7 rounded-2xl shadow-2xl shadow-orange-500/30 disabled:opacity-70 border-2 border-yellow-400/50"
              >
                <div className="relative z-10 flex items-center gap-3">
                  {isScanning ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="text-lg">Hunting...</span>
                    </>
                  ) : progress === 100 ? (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      <span className="text-lg">Hunt Again</span>
                    </>
                  ) : (
                    <>
                      <Scan className="w-6 h-6" />
                      <span className="text-lg">Start Hunt</span>
                    </>
                  )}
                </div>
                
                {/* Animated shine effect */}
                {!isScanning && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                    animate={{ x: ['-200%', '200%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                  />
                )}

                {/* Pulse effect when ready */}
                {!isScanning && progress !== 100 && (
                  <motion.div
                    className="absolute inset-0 bg-yellow-400/20 rounded-2xl"
                    animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </Button>
            </motion.div>
          </div>
        </div>
        
        {isScanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-6 space-y-3"
          >
            <div className="relative">
              <Progress value={progress} className="h-3 bg-slate-700" />
              <motion.div
                className="absolute inset-0 h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
                style={{ width: `${progress}%` }}
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{Math.round(progress)}% Complete</span>
              <motion.span 
                className="text-yellow-400"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                ⚡ Processing...
              </motion.span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
