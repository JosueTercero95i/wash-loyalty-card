import { motion } from 'motion/react';
import { Car, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { SearchFormValues } from '@/types/loyalty';

// Mínimo 2 caracteres: permite buscar con un nombre corto ("Ana", "Al")
// La búsqueda flexible en el backend maneja el resto.
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Ingresá al menos 2 caracteres')
    .max(100, 'Nombre muy largo'),
  last4: z
    .string()
    .trim()
    .length(4, 'Ingresá exactamente 4 dígitos')
    .regex(/^\d{4}$/, 'Solo números'),
});

interface SearchFormProps {
  onSearch: (values: SearchFormValues) => void;
  isLoading: boolean;
}

export default function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: zodResolver(schema),
  });

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      onSubmit={handleSubmit(onSearch)}
      className="w-full space-y-4"
      noValidate
    >
      {/* Name field */}
      <div className="space-y-1.5">
        <label
          htmlFor="search-name"
          className="block text-sm font-medium text-flw-muted font-inter tracking-wide"
        >
          Nombre o apellido
        </label>
        <input
          id="search-name"
          type="text"
          autoCapitalize="words"
          autoComplete="name"
          placeholder="Ej. Juan, Pérez, Carlos González..."
          className="flw-input"
          disabled={isLoading}
          {...register('name')}
        />
        {errors.name ? (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
            <span>⚠</span> {errors.name.message}
          </p>
        ) : (
          <p className="text-xs text-flw-muted/60 font-inter mt-1">
            Podés escribir solo tu nombre, apellido o ambos
          </p>
        )}
      </div>

      {/* Last 4 digits */}
      <div className="space-y-1.5">
        <label
          htmlFor="search-last4"
          className="block text-sm font-medium text-flw-muted font-inter tracking-wide"
        >
          Últimos 4 dígitos de tu teléfono
        </label>
        <input
          id="search-last4"
          type="tel"
          inputMode="numeric"
          maxLength={4}
          placeholder="Ej. 4821"
          className="flw-input tracking-[0.4em] text-center text-xl font-outfit font-bold"
          disabled={isLoading}
          {...register('last4')}
        />
        {errors.last4 ? (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
            <span>⚠</span> {errors.last4.message}
          </p>
        ) : (
          <p className="text-xs text-flw-muted/60 font-inter mt-1">
            Usá los últimos 4 dígitos para confirmar tu identidad
          </p>
        )}
      </div>

      {/* Submit button */}
      <motion.button
        id="btn-consultar"
        type="submit"
        disabled={isLoading}
        whileHover={{ scale: isLoading ? 1 : 1.02 }}
        whileTap={{ scale: isLoading ? 1 : 0.97 }}
        className="flw-btn-primary flex items-center justify-center gap-3 mt-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Consultando...
          </>
        ) : (
          <>
            <Car className="w-5 h-5" />
            Consultar mi progreso
          </>
        )}
      </motion.button>
    </motion.form>
  );
}
