import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Paperclip, ChevronDown, ShieldCheck, ShieldAlert, ShieldX, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from './ui/badge';

interface EmailCardProps {
  email: {
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
  };
  isScanning: boolean;
}

export function EmailCard({ email, isScanning }: EmailCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getThreatStyles = () => {
    if (!email.scanned) return {
      border: 'border-slate-700',
      bg: 'bg-slate-800/50',
      glow: ''
    };
    
    switch (email.threatLevel) {
      case 'safe':
        return {
          border: 'border-green-500/50',
          bg: 'bg-gradient-to-br from-slate-800 to-green-900/20',
          glow: 'shadow-lg shadow-green-500/10'
        };
      case 'warning':
        return {
          border: 'border-yellow-500/50',
          bg: 'bg-gradient-to-br from-slate-800 to-yellow-900/20',
          glow: 'shadow-lg shadow-yellow-500/10'
        };
      case 'danger':
        return {
          border: 'border-red-500/50',
          bg: 'bg-gradient-to-br from-slate-800 to-red-900/20',
          glow: 'shadow-lg shadow-red-500/20'
        };
      default:
        return {
          border: 'border-slate-700',
          bg: 'bg-slate-800/50',
          glow: ''
        };
    }
  };

  const styles = getThreatStyles();

  const ThreatIcon = email.scanned 
    ? email.threatLevel === 'safe' 
      ? ShieldCheck 
      : email.threatLevel === 'warning'
      ? ShieldAlert
      : ShieldX
    : null;

  return (
    <motion.div
      layout
      className={`rounded-xl border-2 transition-all duration-300 hover:shadow-xl ${styles.border} ${styles.bg} ${styles.glow} backdrop-blur-sm`}
      whileHover={{ scale: 1.01 }}
    >
      <div
        className="p-5 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-4">
          {/* Email Icon with threat indicator */}
          <div className="flex-shrink-0 mt-1 relative">
            <motion.div 
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg relative overflow-hidden"
              animate={email.scanned && email.threatLevel === 'danger' ? {
                boxShadow: [
                  '0 0 0 0 rgba(239, 68, 68, 0.4)',
                  '0 0 0 10px rgba(239, 68, 68, 0)',
                ]
              } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Mail className="w-6 h-6 text-white relative z-10" />
              {email.scanned && email.threatLevel === 'danger' && (
                <motion.div
                  className="absolute inset-0 bg-red-500"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </motion.div>
            
            {/* Corner threat badge */}
            {email.scanned && (
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="absolute -top-1 -right-1"
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  email.threatLevel === 'safe' 
                    ? 'bg-green-500' 
                    : email.threatLevel === 'warning'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}>
                  {email.threatLevel === 'danger' && (
                    <AlertTriangle className="w-3 h-3 text-white" />
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Email Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-white truncate">{email.subject}</h3>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-slate-400 flex items-center gap-1 bg-slate-700/50 px-2 py-1 rounded-lg">
                  <Clock className="w-3 h-3" />
                  {email.timestamp}
                </span>
                {email.scanned && ThreatIcon && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', duration: 0.5 }}
                    className={`p-2 rounded-lg ${
                      email.threatLevel === 'safe'
                        ? 'bg-green-500/20'
                        : email.threatLevel === 'warning'
                        ? 'bg-yellow-500/20'
                        : 'bg-red-500/20'
                    }`}
                  >
                    <ThreatIcon
                      className={`w-5 h-5 ${
                        email.threatLevel === 'safe'
                          ? 'text-green-400'
                          : email.threatLevel === 'warning'
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}
                    />
                  </motion.div>
                )}
                {isScanning && !email.scanned && (
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-2">{email.sender}</p>
            <p className="text-sm text-slate-300 line-clamp-1">{email.snippet}</p>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {email.hasAttachment && (
                <Badge variant="secondary" className="text-xs bg-slate-700 text-slate-200 hover:bg-slate-600">
                  <Paperclip className="w-3 h-3 mr-1" />
                  {email.attachmentName || 'Attachment'}
                </Badge>
              )}
              
              {email.scanned && email.threatLevel && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring' }}
                >
                  <Badge
                    className={`text-xs border-2 ${
                      email.threatLevel === 'safe'
                        ? 'bg-green-500/20 text-green-300 border-green-500/50 hover:bg-green-500/30'
                        : email.threatLevel === 'warning'
                        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50 hover:bg-yellow-500/30'
                        : 'bg-red-500/20 text-red-300 border-red-500/50 hover:bg-red-500/30'
                    }`}
                  >
                    {email.threatLevel === 'safe'
                      ? '✓ SAFE'
                      : email.threatLevel === 'warning'
                      ? '⚠ SUSPICIOUS'
                      : '☠ DANGER'}
                  </Badge>
                </motion.div>
              )}

              <motion.button
                className="ml-auto text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700/50 rounded-lg"
                animate={{ rotate: isExpanded ? 180 : 0 }}
              >
                <ChevronDown className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Threat Details */}
      <AnimatePresence>
        {isExpanded && email.scanned && email.threats && email.threats.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-700"
          >
            <div className="px-5 pb-5 pt-4 bg-slate-900/50">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className={`w-4 h-4 ${
                  email.threatLevel === 'danger' ? 'text-red-400' : 'text-yellow-400'
                }`} />
                <h4 className="text-sm text-white">Threat Analysis:</h4>
              </div>
              <ul className="space-y-2">
                {email.threats.map((threat, index) => (
                  <motion.li
                    key={index}
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="text-sm text-slate-300 flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700"
                  >
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      email.threatLevel === 'danger' ? 'bg-red-500' : 'bg-yellow-500'
                    } shadow-lg ${
                      email.threatLevel === 'danger' ? 'shadow-red-500/50' : 'shadow-yellow-500/50'
                    }`} />
                    {threat}
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
