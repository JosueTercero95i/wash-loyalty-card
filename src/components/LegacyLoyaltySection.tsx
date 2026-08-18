import { motion } from 'motion/react';
import { History, Sparkles, Gift, CheckCircle2, AlertCircle } from 'lucide-react';
import type { LegacyLoyaltyData } from '@/types/loyalty';

interface LegacyLoyaltySectionProps {
  legacy: LegacyLoyaltyData | null;
}

function formatLegacyDateTime(dateStr: string): string {
  try {
    const cleanStr = dateStr.replace(' ', 'T');
    const date = new Date(cleanStr);
    if (isNaN(date.getTime())) {
      const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (m) {
        const [, y, mo, d, h, mi] = m;
        const hourNum = parseInt(h, 10);
        const ampm = hourNum >= 12 ? 'p. m.' : 'a. m.';
        const h12 = hourNum % 12 || 12;
        return `${parseInt(d, 10)}/${parseInt(mo, 10)}/${y} ${h12.toString().padStart(2, '0')}:${mi} ${ampm}`;
      }
      return dateStr;
    }
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
    hours = hours % 12 || 12;
    const hoursStr = hours.toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
}

export default function LegacyLoyaltySection({ legacy }: LegacyLoyaltySectionProps) {
  if (!legacy) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border p-6 text-center space-y-2"
        style={{ background: '#FFFFFF', borderColor: '#E8DECC' }}
      >
        <History className="w-8 h-8 mx-auto" style={{ color: '#456A83' }} />
        <p className="text-sm font-inter font-medium" style={{ color: '#456A83' }}>
          No hay registros en el historial anterior (Legacy).
        </p>
      </motion.div>
    );
  }

  const {
    visits,
    earned,
    used,
    available,
    cycleSize = 8,
    progressInCycle = visits % 8,
    remainingForReward = 8 - (visits % 8),
    visitsLog = [],
  } = legacy;

  const percentage = Math.min(100, Math.round((progressInCycle / cycleSize) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="space-y-4"
    >
      {/* ── 4 Tarjetas de Estadísticas Principales ──────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Servicios */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl p-3.5 text-center border shadow-xs"
          style={{ background: '#FFFFFF', borderColor: '#E8DECC' }}
        >
          <p className="text-2xl sm:text-3xl font-outfit font-black" style={{ color: '#002C47' }}>
            {visits}
          </p>
          <p className="text-xs font-inter font-bold uppercase tracking-wider mt-0.5" style={{ color: '#456A83' }}>
            Servicios
          </p>
        </motion.div>

        {/* Ganados */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-3.5 text-center border shadow-xs"
          style={{ background: '#FFFFFF', borderColor: '#E8DECC' }}
        >
          <p className="text-2xl sm:text-3xl font-outfit font-black" style={{ color: '#002C47' }}>
            {earned}
          </p>
          <p className="text-xs font-inter font-bold uppercase tracking-wider mt-0.5" style={{ color: '#456A83' }}>
            Ganados
          </p>
        </motion.div>

        {/* Usados */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl p-3.5 text-center border shadow-xs"
          style={{ background: '#FFFFFF', borderColor: '#E8DECC' }}
        >
          <p className="text-2xl sm:text-3xl font-outfit font-black" style={{ color: '#002C47' }}>
            {used}
          </p>
          <p className="text-xs font-inter font-bold uppercase tracking-wider mt-0.5" style={{ color: '#456A83' }}>
            Usados
          </p>
        </motion.div>

        {/* Disponibles */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-3.5 text-center border shadow-xs"
          style={{
            background: available > 0 ? '#FFF1DF' : '#FFFFFF',
            borderColor: available > 0 ? '#C89B5A' : '#E8DECC',
          }}
        >
          <p
            className="text-2xl sm:text-3xl font-outfit font-black"
            style={{ color: available > 0 ? '#7F0000' : '#002C47' }}
          >
            {available}
          </p>
          <p
            className="text-xs font-inter font-bold uppercase tracking-wider mt-0.5"
            style={{ color: available > 0 ? '#7F0000' : '#456A83' }}
          >
            Disponibles
          </p>
        </motion.div>
      </div>

      {/* ── Progreso al próximo gratis (anterior) ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-3xl p-5 border space-y-3.5 shadow-xs"
        style={{ background: '#FFFFFF', borderColor: '#E8DECC' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: '#FEEDD3' }}
            >
              <Gift className="w-4 h-4" style={{ color: '#002C47' }} />
            </div>
            <p className="text-xs font-inter font-bold uppercase tracking-wider" style={{ color: '#002C47' }}>
              Progreso al próximo gratis (anterior)
            </p>
          </div>

          <div
            className="px-3 py-1 rounded-full font-outfit font-black text-sm border"
            style={{ background: '#FEEDD3', color: '#002C47', borderColor: '#E8DECC' }}
          >
            {progressInCycle}/{cycleSize}
          </div>
        </div>

        {/* Progress Track */}
        <div className="w-full bg-[#FEEDD3] h-3 rounded-full overflow-hidden p-0.5 border border-[#E8DECC]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #002C47 0%, #1E3E5F 100%)',
            }}
          />
        </div>

        <div className="flex items-center justify-between text-xs font-inter">
          <p className="font-semibold flex items-center gap-1.5" style={{ color: '#456A83' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: '#C89B5A' }} />
            {remainingForReward === 0 ? (
              <span className="font-bold text-green-700">¡Pasteado gratis alcanzado!</span>
            ) : (
              <span>
                <strong className="font-black text-[#002C47]">{remainingForReward}</strong>{' '}
                {remainingForReward === 1 ? 'servicio' : 'servicios'} para pasteado gratis
              </span>
            )}
          </p>
          <span className="font-bold font-outfit" style={{ color: '#002C47' }}>
            {percentage}%
          </span>
        </div>
      </motion.div>

      {/* ── Historial de servicios (Legacy) ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-3xl border overflow-hidden shadow-xs"
        style={{ background: '#FFFFFF', borderColor: '#E8DECC' }}
      >
        {/* Header */}
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between"
          style={{ background: '#FEF2DD', borderColor: '#E8DECC' }}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" style={{ color: '#002C47' }} />
            <h4 className="text-xs font-inter font-bold uppercase tracking-wider" style={{ color: '#002C47' }}>
              Historial de servicios (Legacy)
            </h4>
          </div>
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-outfit font-black"
            style={{ background: '#FEEDD3', color: '#002C47' }}
          >
            ({visitsLog.length})
          </span>
        </div>

        {/* Tabla / Lista */}
        {visitsLog.length === 0 ? (
          <div className="p-6 text-center space-y-1">
            <AlertCircle className="w-6 h-6 mx-auto opacity-50" style={{ color: '#456A83' }} />
            <p className="text-xs font-inter font-medium" style={{ color: '#456A83' }}>
              0 servicios registrados en el historial anterior
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-inter">
              <thead>
                <tr className="border-b" style={{ borderColor: '#E8DECC', background: '#FFFDF9' }}>
                  <th className="py-2.5 px-4 font-bold text-center w-12" style={{ color: '#456A83' }}>
                    #
                  </th>
                  <th className="py-2.5 px-4 font-bold" style={{ color: '#456A83' }}>
                    Servicio
                  </th>
                  <th className="py-2.5 px-4 font-bold text-center w-16" style={{ color: '#456A83' }}>
                    Gratis
                  </th>
                  <th className="py-2.5 px-4 font-bold text-right" style={{ color: '#456A83' }}>
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#E8DECC' }}>
                {visitsLog.map((visit, index) => (
                  <tr
                    key={index}
                    className="transition-colors hover:bg-[#FEF2DD]/30"
                  >
                    {/* # Número */}
                    <td className="py-3 px-4 font-outfit font-black text-center" style={{ color: '#002C47' }}>
                      {visit.visitNumber}
                    </td>

                    {/* Servicio */}
                    <td className="py-3 px-4 font-semibold" style={{ color: '#002C47' }}>
                      {visit.service}
                    </td>

                    {/* Gratis */}
                    <td className="py-3 px-4 text-center">
                      {visit.earnedFreeWash ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Sí
                        </span>
                      ) : (
                        <span className="font-bold text-base" style={{ color: '#456A83' }}>
                          —
                        </span>
                      )}
                    </td>

                    {/* Fecha */}
                    <td className="py-3 px-4 text-right font-medium" style={{ color: '#456A83' }}>
                      {formatLegacyDateTime(visit.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
