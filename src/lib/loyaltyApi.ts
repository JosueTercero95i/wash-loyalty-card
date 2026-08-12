import { supabase } from '@/lib/supabase';
import type { LoyaltyCardResponse, LoyaltyCardFound } from '@/types/loyalty';

/**
 * Calls the SECURITY DEFINER RPC get_public_loyalty_card.
 * This is the ONLY way the frontend communicates with the database.
 * No direct table access is ever made.
 */
export async function fetchLoyaltyCard(
  name: string,
  last4: string
): Promise<LoyaltyCardResponse> {
  // Normalize inputs before sending
  const cleanName = name.trim().replace(/\s+/g, ' ');
  const cleanLast4 = last4.trim();

  // Try to get client IP for rate limiting (best-effort)
  let clientIp = 'unknown';
  try {
    const ipRes = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(2000),
    });
    if (ipRes.ok) {
      const { ip } = await ipRes.json();
      clientIp = ip;
    }
  } catch {
    // IP fetch failed — rate limiting uses 'unknown' key (shared limit)
  }

  const { data, error } = await supabase.rpc('get_public_loyalty_card', {
    p_name:      cleanName,
    p_last4:     cleanLast4,
    p_client_ip: clientIp,
  });

  if (error) {
    console.error('[useLoyaltyCard] RPC error:', error);
    throw new Error(error.message || 'Connection error');
  }

  return data as LoyaltyCardResponse;
}

/**
 * Type guard: checks if the response is a found card.
 */
export function isFoundCard(r: LoyaltyCardResponse): r is LoyaltyCardFound {
  return r.found === true;
}
