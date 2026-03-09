import { motion, AnimatePresence } from 'motion/react';
import { EmailCard } from './EmailCard';

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

interface EmailListProps {
  emails: Email[];
  isScanning: boolean;
}

export function EmailList({ emails, isScanning }: EmailListProps) {
  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {emails.map((email, index) => (
          <motion.div
            key={email.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.05 }}
          >
            <EmailCard email={email} isScanning={isScanning} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
