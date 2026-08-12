// ── Types for the public loyalty card web ────────────────────────────────────
// These mirror the JSON returned by the RPC get_public_loyalty_card.
// NEVER access Supabase tables directly from the frontend — only via the RPC.

export interface LoyaltyProgram {
  name: string;       // "Premium" | "Nítido"
  slug: string;       // "premium" | "nitido"
  cycleSize: number;  // 9
}

export interface AvailableReward {
  rewardName: string;
  rewardSlug: string;
  earnedAt: string;   // ISO date string
}

export interface LoyaltyData {
  program: LoyaltyProgram;
  current: number;        // washes_in_cycle (0..8)
  required: number;       // cycle_size (9)
  percentage: number;     // 0..100
  remaining: number;      // cycle_size - washes_in_cycle
  nextMilestoneAt: number;  // "at" value of next reward (e.g. 5 or 9)
  reward: string;           // e.g. "Tratamiento Cerámico GRATIS"
  rewardSlug: string;
  rewardUnlocked: boolean;
  availableRewards: AvailableReward[];
  totalWashes: number;
  cycleNumber: number;
}

export interface RecentWash {
  date: string;     // "YYYY-MM-DD"
  service: string;  // e.g. "Lavado Premium"
}

export interface LoyaltyCardCustomer {
  name: string;
  plate: string | null;
}

// ── RPC Response shapes ──────────────────────────────────────────────────────

export interface LoyaltyCardFound {
  found: true;
  customer: LoyaltyCardCustomer;
  loyalty: LoyaltyData | null;   // null if customer exists but has no progress
  recentWashes: RecentWash[];
}

export interface LoyaltyCardNotFound {
  found: false;
  error?: 'invalid_input' | 'rate_limited' | 'multiple_matches' | string;
}

export type LoyaltyCardResponse = LoyaltyCardFound | LoyaltyCardNotFound;

// ── App State ────────────────────────────────────────────────────────────────

export type AppState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; data: LoyaltyCardFound }
  | { status: 'not_found' }
  | { status: 'rate_limited' }
  | { status: 'multiple_matches' }   // búsqueda ambigua → pedir más nombre
  | { status: 'error'; message?: string };

export interface SearchFormValues {
  name: string;
  last4: string;
}

