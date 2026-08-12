import { motion } from 'motion/react';
import { WifiOff, SearchX, Clock, Users } from 'lucide-react';
import type { AppState } from '@/types/loyalty';

interface StatusMessagesProps {
  state: AppState;
  onReset: () => void;
}

export default function StatusMessages({ state, onReset }: StatusMessagesProps) {
  if (
    state.status !== 'not_found' &&
    state.status !== 'error' &&
    state.status !== 'rate_limited' &&
    state.status !== 'multiple_matches'
  ) {
    return null;
  }

  const config = {
    not_found: {
      icon: <SearchX className="w-12 h-12" style={{ color: '#456A83' }} />,
      title: 'No encontramos tu tarjeta',
      description:
        'No encontramos una tarjeta con esos datos. Probá con tu nombre o apellido y verificá los últimos 4 dígitos de tu teléfono.',
      hint: null,
      color: '#FFFFFF',
      border: '#E8DECC',
    },
    multiple_matches: {
      icon: <Users className="w-12 h-12" style={{ color: '#002C47' }} />,
      title: 'Se encontraron varias coincidencias',
      description:
        'Tu búsqueda coincide con más de un cliente registrado. Por favor, escribí un poco más de tu nombre para identificarte correctamente.',
      hint: 'Tip: Usá nombre y apellido juntos para una búsqueda más precisa.',
      color: '#FFFFFF',
      border: '#E8DECC',
    },
    rate_limited: {
      icon: <Clock className="w-12 h-12" style={{ color: '#7F0000' }} />,
      title: 'Demasiados intentos',
      description:
        'Realizaste varios intentos seguidos. Esperá unos minutos y volvé a intentar.',
      hint: null,
      color: '#FFF1DF',
      border: '#C89B5A',
    },
    error: {
      icon: <WifiOff className="w-12 h-12 text-red-600" />,
      title: 'Error de conexión',
      description:
        'No pudimos conectar con el servidor. Verificá tu conexión a internet e intentá de nuevo.',
      hint: null,
      color: '#FFFFFF',
      border: '#E8DECC',
    },
  }[state.status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl p-7 space-y-4 text-center shadow-md"
      style={{ background: config.color, border: `1.5px solid ${config.border}` }}
    >
      <div className="flex justify-center">{config.icon}</div>

      <div className="space-y-2">
        <h3 className="font-outfit font-black text-lg" style={{ color: '#002C47' }}>{config.title}</h3>
        <p className="text-sm font-inter leading-relaxed max-w-xs mx-auto font-medium" style={{ color: '#456A83' }}>
          {config.description}
        </p>
        {config.hint && (
          <p className="text-xs font-inter italic mt-1 font-semibold" style={{ color: '#002C47' }}>
            {config.hint}
          </p>
        )}
      </div>

      <button
        onClick={onReset}
        id="btn-reintentar"
        className="flw-btn-primary mt-2"
      >
        {state.status === 'multiple_matches' ? 'Buscar de nuevo' : 'Intentar de nuevo'}
      </button>
    </motion.div>
  );
}
