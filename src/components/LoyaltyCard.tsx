import { motion } from 'motion/react';
import { Car, Droplets, RefreshCw, Crown } from 'lucide-react';
import type { LoyaltyCardFound } from '@/types/loyalty';
import ProgressBar from './ProgressBar';
import WashDots from './WashDots';
import RewardBanner from './RewardBanner';
import WashHistory from './WashHistory';

interface LoyaltyCardProps {
  data: LoyaltyCardFound;
  onReset: () => void;
}

const PROGRAM_MILESTONES: Record<string, number[]> = {
  premium: [5, 9],
  nitido:  [5, 9],
};

export default function LoyaltyCard({ data, onReset }: LoyaltyCardProps) {
  const { customer, loyalty, recentWashes } = data;

  if (!loyalty) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="glass-card p-6 text-center space-y-4"
      >
        <Droplets className="w-12 h-12 mx-auto" style={{ color: '#002C47' }} />
        <div>
          <h2 className="font-outfit font-black text-xl" style={{ color: '#002C47' }}>{customer.name}</h2>
          <p className="text-sm font-inter mt-2 font-medium" style={{ color: '#456A83' }}>
            Tu cuenta existe pero aún no tenés lavados registrados en el programa de fidelidad.
          </p>
        </div>
        <button onClick={onReset} className="flw-btn-secondary mt-4 w-full justify-center">
          <RefreshCw className="w-4 h-4 text-white" />
          Consultar otra tarjeta
        </button>
      </motion.div>
    );
  }

  const { program, current, percentage, remaining, nextMilestoneAt, reward, rewardUnlocked, availableRewards, totalWashes, cycleNumber } = loyalty;
  const milestones = PROGRAM_MILESTONES[program.slug] ?? [5, 9];

  const isNitido = program.slug === 'nitido';
  const cardClass = isNitido ? 'loyalty-card-nitido' : 'loyalty-card-premium';
  const accentColor = isNitido ? '#7DB7D5' : '#C89B5A';
  const ProgramIcon = isNitido ? Droplets : Crown;
  const programTitle = isNitido ? 'Programa Nítido' : 'Programa Premium';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full space-y-5"
    >
      {/* ── Main loyalty card ────────────────────────────────────────────── */}
      <div className={`${cardClass} rounded-3xl p-6 space-y-5 relative overflow-hidden`}>
        {/* Background decoration */}
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ backgroundColor: accentColor, transform: 'translate(30%, -30%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10 blur-2xl pointer-events-none"
          style={{ backgroundColor: accentColor, transform: 'translate(-30%, 30%)' }}
        />

        {/* Card header: program badge + car icon */}
        <div className="flex items-start justify-between relative z-10">
          <div>
            <span
              className="inline-flex items-center gap-2 text-xs font-bold px-3.5 py-1 rounded-full font-inter uppercase tracking-wider shadow-xs"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                color: accentColor,
                border: `1px solid ${accentColor}50`,
              }}
            >
              <ProgramIcon className="w-3.5 h-3.5" style={{ color: accentColor }} />
              {programTitle}
            </span>
            <motion.h2
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="text-white font-outfit font-black text-2xl mt-2.5 leading-tight"
            >
              {customer.name}
            </motion.h2>
            {customer.plate && (
              <p className="text-white/80 text-xs font-inter mt-1 flex items-center gap-1.5 font-medium">
                <Car className="w-3.5 h-3.5" />
                {customer.plate}
              </p>
            )}
          </div>

          {/* Wash count badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 300 }}
            className="text-center relative z-10"
          >
            <div
              className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center border shadow-md"
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                borderColor: `${accentColor}70`,
              }}
            >
              <span className="text-white font-outfit font-black text-2xl leading-none">
                {current}
              </span>
              <span className="text-white/70 text-[10px] font-inter leading-none mt-0.5 font-bold">
                / {program.cycleSize}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Wash dots */}
        <div className="relative z-10">
          <WashDots
            current={current}
            cycleSize={program.cycleSize}
            programSlug={program.slug}
            milestones={milestones}
          />
        </div>

        {/* Progress bar */}
        <div className="relative z-10">
          <ProgressBar percentage={percentage} programSlug={program.slug} />
        </div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-3 gap-3 relative z-10"
        >
          {[
            { label: 'Total', value: totalWashes, unit: 'lavados' },
            { label: 'Ciclo', value: cycleNumber + 1, unit: 'actual' },
            { label: 'Faltan', value: remaining, unit: 'lavados' },
          ].map(({ label, value, unit }) => (
            <div
              key={label}
              className="rounded-2xl py-3 px-2 text-center border"
              style={{ background: 'rgba(0, 0, 0, 0.25)', borderColor: 'rgba(255, 255, 255, 0.12)' }}
            >
              <p className="text-white/70 text-[10px] font-inter uppercase tracking-wider font-bold">{label}</p>
              <p className="text-white font-outfit font-black text-xl leading-tight mt-0.5">{value}</p>
              <p className="text-white/60 text-[10px] font-inter font-medium">{unit}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ── Reward banner ─────────────────────────────────────────────────── */}
      <RewardBanner
        rewardUnlocked={rewardUnlocked}
        nextReward={reward}
        remaining={remaining}
        nextMilestoneAt={nextMilestoneAt}
        availableRewards={availableRewards}
        programSlug={program.slug}
      />

      {/* ── Wash history ──────────────────────────────────────────────────── */}
      <WashHistory washes={recentWashes} programSlug={program.slug} />

      {/* ── Prominent "Consultar otra tarjeta" button ──────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="text-center pt-3"
      >
        <button
          onClick={onReset}
          id="btn-nueva-consulta"
          className="flw-btn-secondary w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4 text-[#FEF2DD]" />
          Consultar otra tarjeta
        </button>
      </motion.div>
    </motion.div>
  );
}
