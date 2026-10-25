import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import HeroSection from './components/HeroSection';
import LoyaltyCard from './components/LoyaltyCard';
import SkeletonCard from './components/SkeletonCard';
import StatusMessages from './components/StatusMessages';
import { fetchLoyaltyCard } from './lib/loyaltyApi';
import type { AppState, SearchFormValues } from './types/loyalty';
import './index.css';

const queryClient = new QueryClient();

function AppContent() {
  const [search, setSearch] = useState<SearchFormValues | null>(null);
  const lookup = useQuery({
    queryKey: ['public-loyalty', search?.name, search?.last4],
    queryFn: () => fetchLoyaltyCard(search!.name, search!.last4),
    enabled: search !== null,
    staleTime: 60_000,
    gcTime: 0,
    retry: false,
    // Stay within the RPC lookup limit and never poll failed searches.
    refetchInterval: query => query.state.data?.found ? 60_000 : false,
    refetchIntervalInBackground: false,
  });

  let appState: AppState;
  if (!search) appState = { status: 'idle' };
  else if (lookup.data?.found) appState = { status: 'found', data: lookup.data };
  else if (lookup.isError) appState = { status: 'error', message: lookup.error.message };
  else if (lookup.isPending) appState = { status: 'loading' };
  else if (lookup.data?.error === 'rate_limited') appState = { status: 'rate_limited' };
  else if (lookup.data?.error === 'multiple_matches') appState = { status: 'multiple_matches' };
  else appState = { status: 'not_found' };

  const handleSearch = useCallback(async (values: SearchFormValues) => {
    setSearch(values);
  }, []);

  const handleReset = useCallback(() => {
    setSearch(null);
  }, []);

  const showHero = appState.status === 'idle' || appState.status === 'loading';

  return (
    <div className="min-h-dvh relative" style={{ background: '#FEF2DD', color: '#002C47' }}>
      {/* Ambient background glow — EL RÁPIDO AUTOLAVADO Brand */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 90% 50% at 50% 0%, rgba(30, 62, 95, 0.08) 0%, transparent 75%)',
        }}
      />
      <div
        className="fixed bottom-0 right-0 w-[600px] h-[400px] pointer-events-none opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at bottom right, rgba(200, 155, 90, 0.1) 0%, transparent 70%)',
        }}
      />

      {/* Main layout */}
      <main className="relative z-10 min-h-dvh flex flex-col items-center justify-start px-4 pt-10 pb-16 sm:pt-16">
        <div className="w-full max-w-md mx-auto space-y-6">

          <AnimatePresence mode="wait">
            {/* ── IDLE / LOADING: show hero with search form ── */}
            {showHero && (
              <motion.div
                key="hero"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
              >
                <HeroSection
                  onSearch={handleSearch}
                  isLoading={appState.status === 'loading'}
                />
              </motion.div>
            )}

            {/* ── LOADING: skeleton below form (not replacing hero) ── */}
            {appState.status === 'loading' && (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SkeletonCard />
              </motion.div>
            )}

            {/* ── FOUND: full loyalty card ── */}
            {appState.status === 'found' && (
              <motion.div
                key="card"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                {lookup.isError && (
                  <p role="status" className="mb-4 text-sm text-center">
                    No pudimos actualizar tu tarjeta. Mostramos la última consulta;
                    volveremos a intentarlo automáticamente.
                  </p>
                )}
                <LoyaltyCard data={appState.data} onReset={handleReset} />
              </motion.div>
            )}

            {/* ── NOT FOUND / ERROR / RATE LIMITED / MULTIPLE MATCHES ── */}
            {(appState.status === 'not_found' ||
              appState.status === 'error' ||
              appState.status === 'rate_limited' ||
              appState.status === 'multiple_matches') && (
              <motion.div
                key="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                <StatusMessages state={appState} onReset={handleReset} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>


      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
