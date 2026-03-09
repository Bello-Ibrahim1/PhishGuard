import { motion } from 'motion/react';
import { Scan, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';

interface ScanControlProps {
  onScan: () => void;
  isScanning: boolean;
  progress: number;
  emailCount: number;
}

export function ScanControl({ onScan, isScanning, progress, emailCount }: ScanControlProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200"
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-slate-900 mb-1">Inbox Scanner</h2>
          <p className="text-slate-600 text-sm">
            {isScanning 
              ? `Analyzing ${emailCount} emails for threats...`
              : progress === 100
              ? 'Scan complete! All emails analyzed.'
              : `Ready to scan ${emailCount} emails in your inbox`
            }
          </p>
        </div>
        
        <motion.div
          whileHover={{ scale: isScanning ? 1 : 1.05 }}
          whileTap={{ scale: isScanning ? 1 : 0.95 }}
        >
          <Button
            onClick={onScan}
            disabled={isScanning}
            className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-6 rounded-xl shadow-lg disabled:opacity-70"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Scanning...
              </>
            ) : progress === 100 ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Scan Again
              </>
            ) : (
              <>
                <Scan className="w-5 h-5 mr-2" />
                Scan My Inbox
              </>
            )}
            
            {/* Shimmer effect */}
            {!isScanning && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-200%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </Button>
        </motion.div>
      </div>
      
      {isScanning && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4"
        >
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-slate-500 mt-2 text-center">
            {Math.round(progress)}% Complete
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
