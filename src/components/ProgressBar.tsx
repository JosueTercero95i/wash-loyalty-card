import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface ProgressBarProps {
  percentage: number;       // 0..100
  programSlug: 'premium' | 'nitido' | string;
}

const SLUG_COLORS: Record<string, string> = {
  premium: 'linear-gradient(90deg, #7F0000 0%, #C89B5A 100%)',
  nitido:  'linear-gradient(90deg, #0B4968 0%, #7DB7D5 100%)',
};

export default function ProgressBar({ percentage, programSlug }: ProgressBarProps) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDisplayed(percentage), 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const barColor = SLUG_COLORS[programSlug] ?? SLUG_COLORS.premium;
  const percentageColor = programSlug === 'nitido' ? '#7DB7D5' : '#C89B5A';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="font-inter opacity-80" style={{ color: '#FEEDD3' }}>Progreso del ciclo</span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-outfit font-black text-sm"
          style={{ color: percentageColor }}
        >
          {percentage}%
        </motion.span>
      </div>

      <div className="progress-track">
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: `${displayed}%` }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
          style={{ background: barColor }}
          className="h-full rounded-full relative overflow-hidden"
        >
          <span
            className="absolute inset-0 opacity-40"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s linear infinite',
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
