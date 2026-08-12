import { motion } from 'motion/react';
import { Gift, Star, Sparkles, Flame, Droplets } from 'lucide-react';
import type { AvailableReward } from '@/types/loyalty';

interface RewardBannerProps {
  rewardUnlocked: boolean;
  nextReward: string;
  remaining: number;
  nextMilestoneAt: number;
  availableRewards: AvailableReward[];
  programSlug: string;
}

export default function RewardBanner({
  rewardUnlocked,
  nextReward,
  remaining,
  nextMilestoneAt,
  availableRewards,
  programSlug,
}: RewardBannerProps) {
  const isNitido = programSlug === 'nitido';
  const primaryColor = isNitido ? '#0B4968' : '#7F0000';
  const accentColor = isNitido ? '#0B4968' : '#C89B5A';
  const cardBg = isNitido ? '#F1F7FA' : '#FFF1DF';
  const borderCol = isNitido ? '#7DB7D5' : '#E8DECC';

  if (rewardUnlocked && availableRewards.length > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="rounded-3xl p-5 space-y-3 border"
        style={{
          backgroundColor: cardBg,
          borderColor: borderCol,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            <Star className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <p className="font-outfit font-black text-base leading-tight" style={{ color: primaryColor }}>
              ¡Recompensa desbloqueada!
            </p>
            <p className="text-xs font-inter mt-0.5 font-semibold" style={{ color: '#456A83' }}>
              Tenés {availableRewards.length} beneficio{availableRewards.length > 1 ? 's' : ''} disponible{availableRewards.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="space-y-2 mt-1">
          {availableRewards.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-2xl px-4 py-3 border shadow-xs"
              style={{ backgroundColor: '#FFFFFF', borderColor: borderCol }}
            >
              <Sparkles className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
              <span className="font-bold text-sm font-inter" style={{ color: '#002C47' }}>{r.rewardName}</span>
            </div>
          ))}
        </div>

        <p className="text-xs font-inter px-1 font-medium" style={{ color: '#456A83' }}>
          Presentá tu nombre al llegar al autolavado para canjear tu premio.
        </p>
      </motion.div>
    );
  }

  const isClose = remaining <= 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.55 }}
      className="rounded-3xl p-5 space-y-3.5 border"
      style={{ backgroundColor: cardBg, borderColor: borderCol }}
    >
      {/* Top row: Gift Icon + Next reward */}
      <div className="flex items-center gap-3.5">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
          style={{ backgroundColor: primaryColor }}
        >
          <Gift className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold font-inter uppercase tracking-wider mb-0.5" style={{ color: '#456A83' }}>
            Próxima recompensa
          </p>
          <p className="font-outfit font-black text-lg leading-tight truncate" style={{ color: '#002C47' }}>
            {nextReward}
          </p>
        </div>
      </div>

      {/* Progress to next milestone with crisp contrast */}
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3 border shadow-xs"
        style={{ backgroundColor: '#FFFFFF', borderColor: borderCol }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: isClose ? '#FFF1DF' : '#F1F7FA' }}
        >
          {isClose ? (
            <Flame className="w-4 h-4 text-orange-600" />
          ) : (
            <Droplets className="w-4 h-4 text-sky-600" />
          )}
        </div>
        <p className="text-sm font-inter leading-tight" style={{ color: '#002C47' }}>
          {isClose ? (
            <span className="font-bold text-orange-700">
              ¡Solo te faltan <strong>{remaining}</strong> {remaining === 1 ? 'lavado' : 'lavados'}!
            </span>
          ) : (
            <>
              <span className="font-medium" style={{ color: '#456A83' }}>Te faltan </span>
              <strong className="font-black" style={{ color: primaryColor }}>{remaining}</strong>
              <span className="font-medium" style={{ color: '#456A83' }}> lavados para la recompensa del lavado #{nextMilestoneAt}</span>
            </>
          )}
        </p>
      </div>
    </motion.div>
  );
}
