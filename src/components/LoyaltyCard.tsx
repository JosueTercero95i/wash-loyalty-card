import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Car, Droplets, RefreshCw, Crown, Calendar, History, Sparkles } from 'lucide-react';
import type { LoyaltyCardFound, LoyaltyData, RecentWash } from '@/types/loyalty';
import ProgressBar from './ProgressBar';
import WashDots from './WashDots';
import RewardBanner from './RewardBanner';
import WashHistory from './WashHistory';
import LegacyLoyaltySection from './LegacyLoyaltySection';

interface LoyaltyCardProps {
  data: LoyaltyCardFound;
  onReset: () => void;
}

const PROGRAM_MILESTONES: Record<string, number[]> = {
  premium: [5, 9],
  nitido:  [5, 9],
};

function formatLastVisit(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  try {
    const cleanStr = dateStr.replace(' ', 'T');
    const date = new Date(cleanStr);
    if (isNaN(date.getTime())) {
      const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        return `${parseInt(m[3], 10)}/${parseInt(m[2], 10)}/${m[1]}`;
      }
      return dateStr;
    }
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  } catch {
    return null;
  }
}

// ── Internal: renders one program card + reward banner + wash history ─────────
interface LoyaltyProgramCardProps {
  loyalty: LoyaltyData;
  customerName: string;
  customerPlate: string | null;
  recentWashes: RecentWash[];
  index: number;
}

function LoyaltyProgramCard({
  loyalty,
  customerName,
  customerPlate,
  recentWashes,
  index,
}: LoyaltyProgramCardProps) {
  const {
    program,
    current,
    percentage,
    remaining,
    nextMilestoneAt,
    nextMilestoneType,
    nextMilestoneOptions,
    reward,
    rewardUnlocked,
    availableRewards,
    milestones: loyaltyMilestones,
    totalWashes,
    cycleNumber,
  } = loyalty;

  const milestones = PROGRAM_MILESTONES[program.slug] ?? [5, 9];
  const isNitido = program.slug === 'nitido';
  const cardClass = isNitido ? 'loyalty-card-nitido' : 'loyalty-card-premium';
  const accentColor = isNitido ? '#7DB7D5' : '#C89B5A';
  const ProgramIcon = isNitido ? Droplets : Crown;
  const programTitle = isNitido ? 'Programa Nítido' : 'Programa Premium';

  // Per-program wash history: prefer loyalty.recentWashes (from RPC loop),
  // fall back to top-level recentWashes for first program.
  const programWashes = loyalty.recentWashes ?? (index === 0 ? recentWashes : []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.12 }}
      className="space-y-4"
    >
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

        {/* Card header: program badge + wash count badge */}
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
            <motion.h3
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + index * 0.1 }}
              className="text-white font-outfit font-black text-2xl mt-2.5 leading-tight"
            >
              {customerName}
            </motion.h3>
            {customerPlate && (
              <p className="text-white/80 text-xs font-inter mt-1 flex items-center gap-1.5 font-medium">
                <Car className="w-3.5 h-3.5" />
                {customerPlate}
              </p>
            )}
          </div>

          {/* Wash count badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.25 + index * 0.1, type: 'spring', stiffness: 300 }}
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
          transition={{ delay: 0.4 + index * 0.1 }}
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

      {/* Reward banner */}
      <RewardBanner
        rewardUnlocked={rewardUnlocked}
        nextReward={reward}
        nextMilestoneType={nextMilestoneType}
        nextMilestoneOptions={nextMilestoneOptions}
        remaining={Math.max(0, nextMilestoneAt - current)}
        nextMilestoneAt={nextMilestoneAt}
        availableRewards={availableRewards}
        milestones={loyaltyMilestones}
        programSlug={program.slug}
      />

      {/* Wash history */}
      <WashHistory washes={programWashes} programSlug={program.slug} />
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LoyaltyCard({ data, onReset }: LoyaltyCardProps) {
  const { customer, loyaltyPrograms, recentWashes, legacy } = data;

  // loyaltyPrograms may be missing on old RPC — fall back to loyalty
  const programs = loyaltyPrograms?.length > 0
    ? loyaltyPrograms
    : (data.loyalty ? [data.loyalty] : []);

  const hasModern = programs.length > 0;
  const hasLegacy = !!legacy;
  const [activeTab, setActiveTab] = useState<'current' | 'legacy'>(hasModern ? 'current' : 'legacy');

  const lastVisitFormatted = formatLastVisit(customer.lastVisit || legacy?.lastVisit);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full space-y-4"
    >
      {/* ── Customer Header Card ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-5 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
        style={{ background: '#FFFFFF', borderColor: '#E8DECC' }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
              style={{ background: '#FEEDD3', color: '#002C47' }}
            >
              Estado de Lealtad
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-outfit font-black leading-tight" style={{ color: '#002C47' }}>
            {customer.name}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs font-inter font-medium" style={{ color: '#456A83' }}>
            {customer.plate && (
              <span className="flex items-center gap-1 font-bold text-[#002C47]">
                <Car className="w-3.5 h-3.5" />
                {customer.plate}
              </span>
            )}
            {lastVisitFormatted && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Última visita: {lastVisitFormatted}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Tab Switcher (Programa Actual vs Historial Anterior) ─────────── */}
      <div
        className="flex rounded-2xl p-1 border shadow-xs"
        style={{ background: '#FEEDD3', borderColor: '#E8DECC' }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('current')}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-3 rounded-xl font-outfit font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
            activeTab === 'current'
              ? 'bg-[#002C47] text-[#FEF2DD] shadow-sm'
              : 'text-[#456A83] hover:text-[#002C47]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Programa Actual</span>
          {programs.length > 1 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                activeTab === 'current' ? 'bg-[#FEF2DD] text-[#002C47]' : 'bg-[#E8DECC] text-[#002C47]'
              }`}
            >
              {programs.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('legacy')}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-3 rounded-xl font-outfit font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
            activeTab === 'legacy'
              ? 'bg-[#002C47] text-[#FEF2DD] shadow-sm'
              : 'text-[#456A83] hover:text-[#002C47]'
          }`}
        >
          <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Historial Anterior (Legacy)</span>
          {legacy && legacy.visits > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === 'legacy' ? 'bg-[#FEF2DD] text-[#002C47]' : 'bg-[#E8DECC] text-[#002C47]'
              }`}
            >
              {legacy.visits}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab Contents ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'current' ? (
          <motion.div
            key="tab-current"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {programs.length > 0 ? (
              programs.map((prog, i) => (
                <LoyaltyProgramCard
                  key={prog.program.slug}
                  loyalty={prog}
                  customerName={customer.name}
                  customerPlate={customer.plate}
                  recentWashes={recentWashes}
                  index={i}
                />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-3xl border p-7 text-center space-y-3"
                style={{ background: '#FFFFFF', borderColor: '#E8DECC' }}
              >
                <Droplets className="w-10 h-10 mx-auto" style={{ color: '#002C47' }} />
                <div>
                  <h3 className="font-outfit font-black text-lg" style={{ color: '#002C47' }}>
                    Sin lavados en el programa actual
                  </h3>
                  <p className="text-sm font-inter mt-1.5 font-medium max-w-sm mx-auto" style={{ color: '#456A83' }}>
                    Tu cuenta aún no registra lavados en el nuevo programa de fidelidad. Podés revisar tu historial en la pestaña anterior.
                  </p>
                </div>
                {hasLegacy && (
                  <button
                    onClick={() => setActiveTab('legacy')}
                    className="flw-btn-secondary mt-2 inline-flex items-center gap-2"
                  >
                    <History className="w-4 h-4 text-[#FEF2DD]" />
                    Ver Historial Anterior
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="tab-legacy"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
          >
            <LegacyLoyaltySection legacy={legacy} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Botón "Consultar otra tarjeta" ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center pt-2"
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
