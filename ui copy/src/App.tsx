import { useState } from 'react';
import { Header } from './components/Header';
import { ScanControl } from './components/ScanControl';
import { EmailList } from './components/EmailList';
import { StatsPanel } from './components/StatsPanel';
import { Toaster } from './components/ui/sonner';

// Mock email data
const mockEmails = [
  {
    id: '1',
    sender: 'support@paypal-secure.com',
    subject: 'Urgent: Verify Your Account',
    snippet: 'Your account has been limited. Click here to verify...',
    timestamp: '2 min ago',
    hasAttachment: true,
    attachmentName: 'verification.pdf',
  },
  {
    id: '2',
    sender: 'newsletter@company.com',
    subject: 'Weekly Newsletter - Product Updates',
    snippet: 'Check out our latest features and improvements...',
    timestamp: '1 hour ago',
    hasAttachment: false,
  },
  {
    id: '3',
    sender: 'john.doe@legitcompany.com',
    subject: 'Q4 Report Review',
    snippet: 'Please review the attached quarterly report...',
    timestamp: '3 hours ago',
    hasAttachment: true,
    attachmentName: 'Q4_Report.xlsx',
  },
  {
    id: '4',
    sender: 'noreply@amazon-security.net',
    subject: 'Your order has been shipped!',
    snippet: 'Track your package using the link below...',
    timestamp: '5 hours ago',
    hasAttachment: false,
  },
  {
    id: '5',
    sender: 'hr@company.com',
    subject: 'Team Meeting Tomorrow',
    snippet: 'Reminder: Team sync at 10 AM in Conference Room B...',
    timestamp: '1 day ago',
    hasAttachment: false,
  },
];

export default function App() {
  const [emails, setEmails] = useState(mockEmails);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scannedEmails, setScannedEmails] = useState<Set<string>>(new Set());

  const handleScan = async () => {
    setIsScanning(true);
    setScanProgress(0);
    const newScannedEmails = new Set<string>();

    // Simulate scanning emails one by one
    for (let i = 0; i < emails.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setScanProgress(((i + 1) / emails.length) * 100);
      newScannedEmails.add(emails[i].id);
      setScannedEmails(new Set(newScannedEmails));
      
      // Mock threat detection
      const email = emails[i];
      let threatLevel: 'safe' | 'warning' | 'danger' = 'safe';
      let threats: string[] = [];

      // Simple mock logic for threat detection
      if (email.sender.includes('paypal-secure') || email.subject.toLowerCase().includes('urgent')) {
        threatLevel = 'danger';
        threats = ['Suspicious sender domain', 'Phishing attempt detected', 'Urgency manipulation'];
      } else if (email.sender.includes('amazon-security.net')) {
        threatLevel = 'warning';
        threats = ['Domain mismatch', 'Possible spoofing'];
      }

      setEmails(prev => prev.map(e => 
        e.id === email.id 
          ? { ...e, threatLevel, threats, scanned: true }
          : e
      ));
    }

    setIsScanning(false);
  };

  const threatStats = {
    total: scannedEmails.size,
    safe: emails.filter(e => e.scanned && e.threatLevel === 'safe').length,
    warning: emails.filter(e => e.scanned && e.threatLevel === 'warning').length,
    danger: emails.filter(e => e.scanned && e.threatLevel === 'danger').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Animated background grid */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-6">
        <Header />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <ScanControl 
              onScan={handleScan}
              isScanning={isScanning}
              progress={scanProgress}
              emailCount={emails.length}
              emails={emails}
            />
            
            <EmailList emails={emails} isScanning={isScanning} />
          </div>
          
          <div className="lg:col-span-1">
            <StatsPanel stats={threatStats} hasScanned={scannedEmails.size > 0} />
          </div>
        </div>
      </div>
      
      <Toaster />
    </div>
  );
}
