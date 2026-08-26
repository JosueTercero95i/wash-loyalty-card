import { supabase } from '@/lib/supabase';
import type { LoyaltyCardResponse, LoyaltyCardFound, RewardMilestone } from '@/types/loyalty';

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

  const raw = data as LoyaltyCardResponse;

  // Enrich all programs in loyaltyPrograms array
  if (raw.found) {
    // Normalize: if RPC doesn't send loyaltyPrograms yet, build from loyalty
    if (!raw.loyaltyPrograms || raw.loyaltyPrograms.length === 0) {
      raw.loyaltyPrograms = raw.loyalty ? [raw.loyalty] : [];
    }

    for (const prog of raw.loyaltyPrograms) {
      const milestones: RewardMilestone[] = prog.milestones ?? [];

      // Detect next milestone type/options from milestones array
      const nextMilestone = milestones.find(m => m.at === prog.nextMilestoneAt);
      prog.nextMilestoneType = nextMilestone?.type ?? 'fixed';
      prog.nextMilestoneOptions = nextMilestone?.options ?? [];

      // Fallback: reconstruct milestones if missing
      if (!prog.milestones || prog.milestones.length === 0) {
        prog.milestones = [
          {
            at: prog.nextMilestoneAt,
            type: 'fixed',
            reward: prog.reward,
            reward_slug: prog.rewardSlug,
          },
        ];
      }
    }

    // Keep loyalty as alias to first program
    raw.loyalty = raw.loyaltyPrograms[0] ?? null;
  }

  return raw;
}

/**
 * Type guard: checks if the response is a found card.
 */
export function isFoundCard(r: LoyaltyCardResponse): r is LoyaltyCardFound {
  return r.found === true;
}
