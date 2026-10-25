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
  optionGroup?: string | null;
  optionSlug?: string | null;
  selectedOption?: string | null;
  discountPercent?: number;
}

export interface RewardMilestoneOption {
  reward: string;
  reward_slug: string;
  service_name_like: string;
  discount_percent: number;
  target_service_slug: string | null;
}

export interface RewardMilestone {
  at: number;
  type?: 'choice' | 'fixed';
  reward?: string;
  reward_slug?: string;
  options?: RewardMilestoneOption[];
}

export interface ChoiceGroup {
  optionGroup: string;
  milestoneAt: number;
  rewards: AvailableReward[];
  options: RewardMilestoneOption[];
}

export interface LoyaltyData {
  program: LoyaltyProgram;
  current: number;        // washes_in_cycle (0..8)
  required: number;       // cycle_size (9)
  percentage: number;     // 0..100
  remaining: number;      // cycle_size - washes_in_cycle
  remainingForReward?: number; // next milestone - washes_in_cycle (RPC v4)
  nextMilestoneAt: number;  // "at" value of next reward (e.g. 5 or 9)
  nextMilestoneType?: 'choice' | 'fixed';
  nextMilestoneOptions?: RewardMilestoneOption[];
  reward: string;           // e.g. "Tratamiento Cerámico GRATIS"
  rewardSlug: string;
  rewardUnlocked: boolean;
  availableRewards: AvailableReward[];
  milestones: RewardMilestone[];
  totalWashes: number;
  cycleNumber: number;
  recentWashes?: RecentWash[];  // per-program wash history (from RPC loop)
}

export interface RecentWash {
  date: string;     // "YYYY-MM-DD"
  service: string;  // e.g. "Lavado Premium"
  ticketNumber?: string;
}

export interface LoyaltyCardCustomer {
  name: string;
  plate: string | null;
  lastVisit?: string | null;
}

export interface LegacyWashVisit {
  visitNumber: number;
  service: string;
  earnedFreeWash: boolean;
  date: string;
}

export interface LegacyLoyaltyData {
  visits: number;
  earned: number;
  used: number;
  available: number;
  cycleSize: number;
  progressInCycle: number;
  remainingForReward: number;
  lastVisit: string | null;
  visitsLog: LegacyWashVisit[];
}

// ── RPC Response shapes ──────────────────────────────────────────────────────

export interface LoyaltyCardFound {
  found: true;
  customer: LoyaltyCardCustomer;
  loyalty: LoyaltyData | null;          // alias al primer programa (compat)
  loyaltyPrograms: LoyaltyData[];       // todos los programas activos del cliente
  recentWashes: RecentWash[];
  legacy: LegacyLoyaltyData | null;
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

