import { motion } from 'motion/react';
import { Gift, Star, Sparkles, Flame, Droplets } from 'lucide-react';
import type { AvailableReward, RewardMilestone } from '@/types/loyalty';

interface RewardBannerProps {
  rewardUnlocked: boolean;
  nextReward: string;
  nextMilestoneType?: 'choice' | 'fixed';
  nextMilestoneOptions?: { reward: string; discount_percent: number }[];
  remaining: number;
  nextMilestoneAt: number;
  availableRewards: AvailableReward[];
  milestones: RewardMilestone[];
  programSlug: string;
}

/**
 * Detect choice groups from available rewards.
 * A choice group = 2+ rewards sharing the same optionGroup with no selectedOption.
 */
function detectChoiceGroups(rewards: AvailableReward[]): Map<string, AvailableReward[]> {
  const groups = new Map<string, AvailableReward[]>();
  for (const r of rewards) {
    if (r.optionGroup && !r.selectedOption) {
      const grp = groups.get(r.optionGroup) ?? [];
      grp.push(r);
      groups.set(r.optionGroup, grp);
    }
  }
  // Only keep groups with 2+ rewards (actual choice groups)
  for (const [key, grp] of groups) {
    if (grp.length < 2) groups.delete(key);
  }
  return groups;
}

/** Get fixed (non-choice) available rewards */
function getFixedRewards(rewards: AvailableReward[]): AvailableReward[] {
  return rewards.filter(r => !r.optionGroup || !!r.selectedOption);
}

/** Get selected choice rewards (one chosen from a group) */
function getSelectedChoiceRewards(rewards: AvailableReward[]): AvailableReward[] {
  return rewards.filter(r => r.optionGroup && r.selectedOption);
}

function getEmojiForDiscount(discountPercent?: number): string {
  return discountPercent === 100 ? '🫧' : '⭐';
}

function getEmojiForFixed(rewardSlug: string): string {
  if (rewardSlug.includes('ceramic') || rewardSlug.includes('tratamiento')) return '✨';
  if (rewardSlug.includes('pasteado')) return '🚘';
  return '✨';
}

export default function RewardBanner({
  rewardUnlocked,
  nextReward,
  nextMilestoneType,
  nextMilestoneOptions,
  remaining,
  nextMilestoneAt,
  availableRewards,
  milestones,
  programSlug,
}: RewardBannerProps) {
  const isNitido = programSlug === 'nitido';
  const primaryColor = isNitido ? '#0B4968' : '#7F0000';
  const accentColor = isNitido ? '#0B4968' : '#C89B5A';
  const cardBg = isNitido ? '#F1F7FA' : '#FFF1DF';
  const borderCol = isNitido ? '#7DB7D5' : '#E8DECC';

  if (rewardUnlocked && availableRewards.length > 0) {
    const choiceGroups = detectChoiceGroups(availableRewards);
    const fixedRewards = getFixedRewards(availableRewards);
    const selectedChoices = getSelectedChoiceRewards(availableRewards);
    const hasChoiceGroups = choiceGroups.size > 0;

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
        {/* Header */}
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

        {/* Choice groups */}
        {[...choiceGroups.entries()].map(([grp, grpRewards]) => {
          // Find the milestone for this group to get the options with discount info
          const milestone = milestones.find(m =>
            m.options?.some(opt => grpRewards.some(r => r.rewardSlug === opt.reward_slug))
          );
          const options = milestone?.options ?? [];

          return (
            <div
              key={grp}
              className="rounded-2xl px-4 py-3 border shadow-xs space-y-2"
              style={{ backgroundColor: '#FFFFFF', borderColor: borderCol }}
            >
              <p className="font-bold text-sm font-inter" style={{ color: '#002C47' }}>
                🎁 {milestone?.at ?? '?'} lavadas → Elige tu recompensa
              </p>
              <div className="space-y-1.5">
                {options.map((opt) => (
                  <div key={opt.reward_slug} className="flex items-center gap-2.5">
                    <span className="text-base">{getEmojiForDiscount(opt.discount_percent)}</span>
                    <span className="font-bold text-sm font-inter" style={{ color: '#002C47' }}>
                      {opt.reward}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Fixed rewards */}
        {fixedRewards.map((r, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 border shadow-xs"
            style={{ backgroundColor: '#FFFFFF', borderColor: borderCol }}
          >
            <span className="text-base">{getEmojiForFixed(r.rewardSlug)}</span>
            <span className="font-bold text-sm font-inter" style={{ color: '#002C47' }}>{r.rewardName}</span>
          </div>
        ))}

        {/* Selected choice rewards */}
        {selectedChoices.map((r, i) => (
          <div
            key={`sel-${i}`}
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 border shadow-xs"
            style={{ backgroundColor: '#FFFFFF', borderColor: borderCol }}
          >
            <span className="text-base">{getEmojiForDiscount(r.discountPercent)}</span>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-sm font-inter" style={{ color: '#002C47' }}>{r.rewardName}</span>
              <span className="text-xs font-inter ml-2" style={{ color: '#456A83' }}>✓ Elegido</span>
            </div>
          </div>
        ))}

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
            🎁 Próxima recompensa
          </p>
          {nextMilestoneType === 'choice' && nextMilestoneOptions && nextMilestoneOptions.length > 0 ? (
            <div className="space-y-0.5">
              <p className="font-outfit font-black text-sm leading-tight" style={{ color: '#002C47' }}>
                {nextMilestoneAt} lavadas → Elige tu recompensa
              </p>
              {nextMilestoneOptions.map((opt, i) => (
                <p key={i} className="text-xs font-inter font-medium" style={{ color: '#456A83' }}>
                  {getEmojiForDiscount(opt.discount_percent)} {opt.reward}
                </p>
              ))}
            </div>
          ) : (
            <p className="font-outfit font-black text-lg leading-tight truncate" style={{ color: '#002C47' }}>
              🎁 {nextMilestoneAt} lavadas → {nextReward}
            </p>
          )}
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
              <span className="font-medium" style={{ color: '#456A83' }}> lavados para el lavado #{nextMilestoneAt}</span>
            </>
          )}
        </p>
      </div>
    </motion.div>
  );
}
