import { motion } from 'motion/react';
import { Droplets, Search } from 'lucide-react';
import SearchForm from './SearchForm';
import type { SearchFormValues } from '@/types/loyalty';

interface HeroSectionProps {
  onSearch: (values: SearchFormValues) => void;
  isLoading: boolean;
}

export default function HeroSection({ onSearch, isLoading }: HeroSectionProps) {
  return (
    <div className="text-center space-y-8">
      {/* Logo / Brand */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-3"
      >
        {/* Logo mark with EL RÁPIDO AUTOLAVADO primary blue */}
        <div className="flex justify-center">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 rounded-3xl flex items-center justify-center relative shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #002C47 0%, #1E3E5F 100%)',
            }}
          >
            <Droplets className="w-10 h-10 text-white" />
          </motion.div>
        </div>

        {/* Business name */}
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xs font-inter uppercase tracking-[0.3em] mb-1 font-bold"
            style={{ color: '#456A83' }}
          >
            El Rápido Autolavado
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="font-outfit font-black text-3xl sm:text-4xl leading-tight"
            style={{ color: '#002C47' }}
          >
            Programa de{' '}
            <span
              className="inline-block"
              style={{
                background: 'linear-gradient(90deg, #002C47 0%, #1E3E5F 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Fidelidad
            </span>
          </motion.h1>
        </div>
      </motion.div>

      {/* Taglines */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="space-y-1"
      >
        <p className="font-outfit font-bold text-base sm:text-lg" style={{ color: '#002C47' }}>
          Tu auto también acumula recompensas.
        </p>
        <p className="text-sm font-inter max-w-xs mx-auto leading-relaxed font-medium" style={{ color: '#456A83' }}>
          Consultá tu progreso y descubrí cuánto te falta para tu próximo beneficio.
        </p>
      </motion.div>

      {/* Search form card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
        className="glass-card p-6 sm:p-8 text-left"
      >
        <p className="font-outfit font-bold text-base mb-5 flex items-center gap-2" style={{ color: '#002C47' }}>
          <Search className="w-5 h-5" style={{ color: '#002C47' }} />
          Encontrá tu tarjeta
        </p>
        <SearchForm onSearch={onSearch} isLoading={isLoading} />
      </motion.div>
    </div>
  );
}
