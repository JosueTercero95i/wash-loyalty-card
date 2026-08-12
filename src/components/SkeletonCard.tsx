import { motion } from 'motion/react';

export default function SkeletonCard() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full space-y-4"
    >
      {/* Main card skeleton */}
      <div className="rounded-3xl overflow-hidden border border-white/10 p-6 space-y-5"
           style={{ background: 'rgba(255,255,255,0.04)' }}>
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-16 rounded-full shimmer" />
            <div className="h-7 w-36 rounded-full shimmer" />
          </div>
          <div className="h-10 w-10 rounded-full shimmer" />
        </div>

        {/* Progress dots */}
        <div className="flex gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-5 w-5 rounded-full shimmer" />
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-3 w-full rounded-full shimmer" />

        {/* Stats row */}
        <div className="flex gap-4">
          <div className="flex-1 h-16 rounded-2xl shimmer" />
          <div className="flex-1 h-16 rounded-2xl shimmer" />
          <div className="flex-1 h-16 rounded-2xl shimmer" />
        </div>
      </div>

      {/* Reward card skeleton */}
      <div className="rounded-3xl border border-white/10 p-5 space-y-3"
           style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="h-4 w-24 rounded-full shimmer" />
        <div className="h-6 w-48 rounded-full shimmer" />
        <div className="h-4 w-32 rounded-full shimmer" />
      </div>

      {/* History skeleton */}
      <div className="rounded-3xl border border-white/10 p-5 space-y-4"
           style={{ background: 'rgba(255,255,255,0.04)' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-4 w-24 rounded-full shimmer" />
            <div className="h-4 w-32 rounded-full shimmer" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
