import { motion } from 'motion/react';
import { Gift, Check } from 'lucide-react';

interface WashDotsProps {
  current: number;   // washes_in_cycle (0..8)
  cycleSize: number; // 9
  programSlug: 'premium' | 'nitido' | string;
  milestones?: number[]; // [5, 9]
}

const THEME_DOTS: Record<
  string,
  { active: string; accent: string; bgPending: string; borderPending: string }
> = {
  premium: {
    active: '#7F0000',
    accent: '#C89B5A',
    bgPending: 'rgba(255, 255, 255, 0.12)',
    borderPending: 'rgba(200, 155, 90, 0.4)',
  },
  nitido: {
    active: '#0B4968',
    accent: '#7DB7D5',
    bgPending: 'rgba(255, 255, 255, 0.12)',
    borderPending: 'rgba(125, 183, 213, 0.4)',
  },
};

export default function WashDots({
  current,
  cycleSize,
  programSlug,
  milestones = [5, 9],
}: WashDotsProps) {
  const theme = THEME_DOTS[programSlug] ?? THEME_DOTS.premium;

  return (
    <div className="flex items-center justify-between gap-1.5 w-full py-1">
      {Array.from({ length: cycleSize }).map((_, index) => {
        const position = index + 1;
        const isDone = position <= current;
        const isMilestone = milestones.includes(position);

        return (
          <motion.div
            key={index}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: 0.04 * index + 0.25,
              type: 'spring',
              stiffness: 400,
              damping: 22,
            }}
            className="flex-1 flex justify-center"
          >
            <div
              className={`relative flex items-center justify-center rounded-full transition-all duration-300 font-outfit font-black ${
                isMilestone ? 'w-8 h-8 sm:w-9 sm:h-9' : 'w-7 h-7 sm:w-8 sm:h-8'
              }`}
              style={{
                backgroundColor: isDone
                  ? isMilestone
                    ? theme.accent
                    : theme.active
                  : theme.bgPending,
                color: isDone ? '#FFFFFF' : '#FFFFFF',
                border: isMilestone
                  ? `2px solid ${theme.accent}`
                  : `1.5px solid ${isDone ? theme.accent : theme.borderPending}`,
                boxShadow: isDone
                  ? `0 0 12px ${isMilestone ? theme.accent : theme.active}80`
                  : 'none',
              }}
              title={
                isMilestone
                  ? `Recompensa en lavado ${position}`
                  : `Lavado ${position}`
              }
            >
              {/* ── Content perfectly centered INSIDE circle ── */}
              {isMilestone ? (
                <Gift
                  className={`${
                    isMilestone ? 'w-4 h-4 sm:w-4.5 sm:h-4.5' : 'w-3.5 h-3.5'
                  }`}
                  style={{
                    color: isDone ? '#FFFFFF' : theme.accent,
                  }}
                />
              ) : (
                <span className="text-xs sm:text-sm font-black leading-none">
                  {position}
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
