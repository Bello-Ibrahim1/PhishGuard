import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Paperclip, ChevronDown, ShieldCheck, ShieldAlert, ShieldX, Clock, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';

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

  const getThreatColor = () => {
    if (!email.scanned) return 'border-slate-200 bg-white';
    switch (email.threatLevel) {
      case 'safe':
        return 'border-green-200 bg-green-50/30';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50/30';
      case 'danger':
        return 'border-red-200 bg-red-50/30';
      default:
        return 'border-slate-200 bg-white';
    }
  };

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
      className={`rounded-xl border-2 transition-all duration-300 shadow-sm hover:shadow-md ${getThreatColor()}`}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-4">
          {/* Email Icon */}
          <div className="flex-shrink-0 mt-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
              <Mail className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Email Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-slate-900 truncate">{email.subject}</h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {email.timestamp}
                </span>
                {email.scanned && ThreatIcon && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', duration: 0.5 }}
                  >
                    <ThreatIcon
                      className={`w-5 h-5 ${
                        email.threatLevel === 'safe'
                          ? 'text-green-600'
                          : email.threatLevel === 'warning'
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    />
                  </motion.div>
                )}
                {isScanning && !email.scanned && (
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                )}
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-2">{email.sender}</p>
            <p className="text-sm text-slate-500 line-clamp-1">{email.snippet}</p>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {email.hasAttachment && (
                <Badge variant="secondary" className="text-xs">
                  <Paperclip className="w-3 h-3 mr-1" />
                  {email.attachmentName || 'Attachment'}
                </Badge>
              )}
              
              {email.scanned && email.threatLevel && (
                <Badge
                  variant={
                    email.threatLevel === 'safe'
                      ? 'default'
                      : email.threatLevel === 'warning'
                      ? 'secondary'
                      : 'destructive'
                  }
                  className={`text-xs ${
                    email.threatLevel === 'safe'
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : email.threatLevel === 'warning'
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  {email.threatLevel === 'safe'
                    ? 'Safe'
                    : email.threatLevel === 'warning'
                    ? 'Suspicious'
                    : 'Danger'}
                </Badge>
              )}

              <motion.button
                className="ml-auto text-slate-400 hover:text-slate-600 transition-colors"
                animate={{ rotate: isExpanded ? 180 : 0 }}
              >
                <ChevronDown className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && email.scanned && email.threats && email.threats.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-slate-200">
              <h4 className="text-sm text-slate-700 mb-2">Detected Threats:</h4>
              <ul className="space-y-1">
                {email.threats.map((threat, index) => (
                  <motion.li
                    key={index}
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="text-sm text-slate-600 flex items-start gap-2"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      email.threatLevel === 'danger' ? 'bg-red-500' : 'bg-yellow-500'
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
