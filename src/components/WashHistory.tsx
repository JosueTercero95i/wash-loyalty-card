import { motion } from 'motion/react';
import { Clock } from 'lucide-react';
import type { RecentWash } from '@/types/loyalty';

interface WashHistoryProps {
  washes: RecentWash[];
  programSlug: string;
}

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-NI', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const ACCENT_COLORS: Record<string, string> = {
  premium: '#7F0000',
  nitido:  '#0B4968',
};

export default function WashHistory({ washes, programSlug }: WashHistoryProps) {
  const accentColor = ACCENT_COLORS[programSlug] ?? ACCENT_COLORS.premium;

  if (washes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="rounded-3xl border p-5 text-center space-y-2 shadow-xs"
        style={{ background: '#FFFFFF', borderColor: '#E8DECC' }}
      >
        <Clock className="w-8 h-8 mx-auto" style={{ color: '#456A83' }} />
        <p className="text-sm font-inter font-medium" style={{ color: '#456A83' }}>
          Sin historial de lavados aún
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.65 }}
      className="rounded-3xl border overflow-hidden"
      style={{ background: '#FFFFFF', borderColor: '#E8DECC' }}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b" style={{ backgroundColor: '#FEF2DD', borderColor: '#E8DECC' }}>
        <p className="text-xs font-inter uppercase tracking-wider font-bold flex items-center gap-2" style={{ color: '#002C47' }}>
          <Clock className="w-3.5 h-3.5" style={{ color: '#456A83' }} />
          Últimos lavados registrados
        </p>
      </div>

      {/* List */}
      <div className="divide-y" style={{ borderColor: '#E8DECC' }}>
        {washes.map((wash, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.7 + i * 0.08 }}
            className="px-5 py-3.5 flex items-center justify-between gap-4 transition-colors hover:bg-[#FEF2DD]/40"
          >
            {/* Color indicator + service */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: accentColor }}
              />
              <div className="min-w-0">
                <p className="text-sm font-inter font-bold truncate" style={{ color: '#002C47' }}>
                  {wash.service}
                </p>
                {wash.ticketNumber && (
                  <p className="text-xs font-inter" style={{ color: '#456A83' }}>{wash.ticketNumber}</p>
                )}
              </div>
            </div>

            {/* Date */}
            <span className="text-xs font-inter font-medium flex-shrink-0" style={{ color: '#456A83' }}>
              {formatDate(wash.date)}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
