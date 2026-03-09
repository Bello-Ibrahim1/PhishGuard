import { motion } from 'motion/react';
import { Download, FileText } from 'lucide-react';
import { Button } from './ui/button';

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

interface ExportButtonProps {
  emails: Email[];
  disabled?: boolean;
}

export function ExportButton({ emails, disabled = false }: ExportButtonProps) {
  const exportToCSV = () => {
    // Filter only scanned emails
    const scannedEmails = emails.filter(email => email.scanned);
    
    if (scannedEmails.length === 0) {
      alert('No scanned emails to export. Please run a scan first.');
      return;
    }

    // CSV Headers
    const headers = [
      'Email ID',
      'Sender',
      'Subject',
      'Timestamp',
      'Has Attachment',
      'Attachment Name',
      'Threat Level',
      'Risk Score',
      'Threats Detected',
      'Snippet'
    ];

    // Map emails to CSV rows
    const rows = scannedEmails.map(email => {
      const riskScore = 
        email.threatLevel === 'danger' ? '90-100' :
        email.threatLevel === 'warning' ? '50-75' :
        '0-25';
      
      const threatsText = email.threats && email.threats.length > 0
        ? `"${email.threats.join('; ')}"` // Wrap in quotes and join with semicolons
        : 'None';
      
      return [
        email.id,
        `"${email.sender}"`, // Wrap in quotes for CSV safety
        `"${email.subject}"`,
        email.timestamp,
        email.hasAttachment ? 'Yes' : 'No',
        email.attachmentName ? `"${email.attachmentName}"` : 'N/A',
        email.threatLevel ? email.threatLevel.toUpperCase() : 'UNKNOWN',
        riskScore,
        threatsText,
        `"${email.snippet}"` // Wrap snippet in quotes
      ].join(',');
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `PhishGuard_Threat_Report_${timestamp}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const scannedCount = emails.filter(e => e.scanned).length;

  return (
    <motion.div
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
    >
      <Button
        onClick={exportToCSV}
        disabled={disabled || scannedCount === 0}
        className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-6 py-6 rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400/30"
      >
        <div className="relative z-10 flex items-center gap-2">
          <Download className="w-5 h-5" />
          <div className="flex flex-col items-start">
            <span className="text-sm">Export Report</span>
            <span className="text-xs text-blue-200">
              {scannedCount > 0 ? `${scannedCount} emails` : 'No data'}
            </span>
          </div>
          <FileText className="w-4 h-4 ml-1 text-blue-200" />
        </div>
        
        {/* Shimmer effect when enabled */}
        {!disabled && scannedCount > 0 && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
            animate={{ x: ['-200%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
          />
        )}
      </Button>
    </motion.div>
  );
}
