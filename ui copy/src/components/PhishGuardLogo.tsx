import { motion } from 'motion/react';

interface PhishGuardLogoProps {
  size?: number;
  animate?: boolean;
}

export function PhishGuardLogo({ size = 120, animate = true }: PhishGuardLogoProps) {
  const MotionWrapper = animate ? motion.svg : 'svg';
  const animationProps = animate ? {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { duration: 0.5, type: 'spring' }
  } : {};

  return (
    <MotionWrapper
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...animationProps}
    >
      {/* Cape flowing behind */}
      <motion.path
        d="M70 60 L50 80 L40 140 L50 160 L70 150 L75 100 Z"
        fill="url(#capeGradient)"
        animate={animate ? { 
          d: [
            "M70 60 L50 80 L40 140 L50 160 L70 150 L75 100 Z",
            "M70 60 L45 85 L35 140 L48 165 L70 150 L75 100 Z",
            "M70 60 L50 80 L40 140 L50 160 L70 150 L75 100 Z"
          ]
        } : undefined}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.path
        d="M130 60 L150 80 L160 140 L150 160 L130 150 L125 100 Z"
        fill="url(#capeGradient)"
        animate={animate ? {
          d: [
            "M130 60 L150 80 L160 140 L150 160 L130 150 L125 100 Z",
            "M130 60 L155 85 L165 140 L152 165 L130 150 L125 100 Z",
            "M130 60 L150 80 L160 140 L150 160 L130 150 L125 100 Z"
          ]
        } : undefined}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Shield on cape */}
      <ellipse cx="100" cy="120" rx="18" ry="22" fill="url(#shieldGradient)" />
      <path
        d="M100 105 L110 115 L100 130 L90 115 Z"
        fill="#fff"
        opacity="0.3"
      />
      <motion.path
        d="M97 115 L103 115 L103 125 L97 125 Z M97 109 L103 109 L103 113 L97 113 Z"
        fill="#fff"
        animate={animate ? { opacity: [0.8, 1, 0.8] } : undefined}
        transition={{ duration: 1.5, repeat: Infinity }}
      />

      {/* Hero body */}
      <ellipse cx="100" cy="95" rx="25" ry="28" fill="url(#bodyGradient)" />
      
      {/* Hero head */}
      <circle cx="100" cy="60" r="20" fill="url(#headGradient)" />
      
      {/* Mask */}
      <path
        d="M85 55 Q100 50 115 55 L113 62 Q100 58 87 62 Z"
        fill="#1e293b"
        opacity="0.8"
      />
      
      {/* Eyes - determined look */}
      <ellipse cx="93" cy="60" rx="3" ry="4" fill="#fff" />
      <ellipse cx="107" cy="60" rx="3" ry="4" fill="#fff" />
      <circle cx="93" cy="61" r="1.5" fill="#1e293b" />
      <circle cx="107" cy="61" r="1.5" fill="#1e293b" />

      {/* Arms extended */}
      {/* Left arm holding gun */}
      <motion.path
        d="M80 95 L60 85 L55 88 L75 98 Z"
        fill="url(#armGradient)"
        animate={animate ? {
          d: [
            "M80 95 L60 85 L55 88 L75 98 Z",
            "M80 95 L58 83 L53 86 L75 98 Z",
            "M80 95 L60 85 L55 88 L75 98 Z"
          ]
        } : undefined}
        transition={{ duration: 0.3, repeat: Infinity }}
      />
      
      {/* Gun/Blaster */}
      <motion.g
        animate={animate ? {
          x: [0, -2, 0],
          y: [0, -1, 0]
        } : undefined}
        transition={{ duration: 0.3, repeat: Infinity }}
      >
        <rect x="35" y="82" width="22" height="8" rx="2" fill="#475569" />
        <rect x="35" y="84" width="8" height="4" fill="#64748b" />
        <circle cx="44" cy="86" r="2" fill="#334155" />
      </motion.g>

      {/* Laser shots/bullets */}
      <motion.g
        animate={animate ? {
          x: [-10, -60],
          opacity: [0, 1, 0]
        } : undefined}
        transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.5 }}
      >
        <circle cx="30" cy="86" r="2" fill="#ef4444" />
        <circle cx="25" cy="86" r="1.5" fill="#fca5a5" />
        <line x1="32" y1="86" x2="40" y2="86" stroke="#ef4444" strokeWidth="2" />
      </motion.g>

      {/* Right arm punching */}
      <motion.path
        d="M120 95 L145 90 L148 95 L123 100 Z"
        fill="url(#armGradient)"
        animate={animate ? {
          d: [
            "M120 95 L145 90 L148 95 L123 100 Z",
            "M120 95 L150 88 L153 93 L123 100 Z",
            "M120 95 L145 90 L148 95 L123 100 Z"
          ]
        } : undefined}
        transition={{ duration: 0.5, repeat: Infinity }}
      />
      
      {/* Fist */}
      <motion.circle
        cx="150"
        cy="92"
        r="6"
        fill="#fbbf24"
        animate={animate ? {
          cx: [150, 155, 150],
          scale: [1, 1.2, 1]
        } : undefined}
        transition={{ duration: 0.5, repeat: Infinity }}
      />

      {/* Legs in action pose */}
      <path d="M95 120 L90 150 L95 152 L100 125 Z" fill="url(#legGradient)" />
      <path d="M105 120 L110 145 L105 147 L100 125 Z" fill="url(#legGradient)" />
      
      {/* Boots */}
      <ellipse cx="92" cy="152" rx="5" ry="4" fill="#1e293b" />
      <ellipse cx="107" cy="147" rx="5" ry="4" fill="#1e293b" />

      {/* Floating enemies being destroyed */}
      {/* Phishing email */}
      <motion.g
        animate={animate ? {
          x: [20, 10, 0],
          y: [0, -5, -10],
          opacity: [1, 0.5, 0],
          rotate: [0, 45, 90]
        } : undefined}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }}
      >
        <rect x="10" y="75" width="15" height="12" rx="2" fill="#dc2626" opacity="0.8" />
        <path d="M12 77 L17.5 81 L23 77" stroke="#fff" strokeWidth="1" fill="none" />
        <text x="14" y="83" fontSize="8" fill="#fff">📧</text>
      </motion.g>

      {/* Virus */}
      <motion.g
        animate={animate ? {
          x: [0, 10, 20],
          y: [0, 5, 10],
          opacity: [1, 0.5, 0],
          scale: [1, 0.8, 0.5]
        } : undefined}
        transition={{ duration: 1, repeat: Infinity, delay: 0.6 }}
      >
        <circle cx="145" cy="70" r="6" fill="#7c3aed" />
        <circle cx="142" cy="68" r="1.5" fill="#a78bfa" />
        <circle cx="148" cy="68" r="1.5" fill="#a78bfa" />
        <line x1="145" y1="64" x2="145" y2="60" stroke="#7c3aed" strokeWidth="2" />
        <line x1="145" y1="76" x2="145" y2="80" stroke="#7c3aed" strokeWidth="2" />
        <line x1="151" y1="70" x2="155" y2="70" stroke="#7c3aed" strokeWidth="2" />
        <line x1="139" y1="70" x2="135" y2="70" stroke="#7c3aed" strokeWidth="2" />
      </motion.g>

      {/* Malware bug */}
      <motion.g
        animate={animate ? {
          x: [10, 0, -10],
          y: [0, -8, -16],
          opacity: [1, 0.6, 0],
          rotate: [0, -30, -60]
        } : undefined}
        transition={{ duration: 1.1, repeat: Infinity, delay: 0.9 }}
      >
        <ellipse cx="155" cy="100" rx="5" ry="7" fill="#f97316" />
        <circle cx="155" cy="97" r="2" fill="#fed7aa" />
        <line x1="152" y1="98" x2="150" y2="96" stroke="#f97316" strokeWidth="1.5" />
        <line x1="158" y1="98" x2="160" y2="96" stroke="#f97316" strokeWidth="1.5" />
        <line x1="152" y1="103" x2="150" y2="105" stroke="#f97316" strokeWidth="1.5" />
        <line x1="158" y1="103" x2="160" y2="105" stroke="#f97316" strokeWidth="1.5" />
      </motion.g>

      {/* Impact effects */}
      <motion.g
        animate={animate ? {
          scale: [0, 1.5, 0],
          opacity: [0, 1, 0]
        } : undefined}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
      >
        <circle cx="20" cy="78" r="8" stroke="#fbbf24" strokeWidth="2" fill="none" />
        <circle cx="20" cy="78" r="4" stroke="#fbbf24" strokeWidth="1" fill="none" />
      </motion.g>

      {/* Gradients */}
      <defs>
        <linearGradient id="capeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
        <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="headGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="armGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="legGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
      </defs>
    </MotionWrapper>
  );
}
