export type PlanId = 'free' | 'plus' | 'ultimate';

export interface PlanCatalogEntry {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPriceUsd: number;
  annualMonthlyPriceUsd: number;
  annualTotalUsd: number;
  monthlyCredits: number;
  badge?: string;
  maxVisionResolution: '1K' | '2K' | '4K';
  maxCinemaResolution: '720p' | '1080p' | '4k';
  allowNeuralCinema: boolean;
  allowFullMusic: boolean;
  retentionPolicy: 'free_30d' | 'paid_permanent';
  features: string[];
  footerNote: string;
}

export interface TopUpPack {
  id: 'pack_1k' | 'pack_3500';
  name: string;
  credits: number;
  priceUsd: number;
  badge?: string;
}

export const PLAN_ALLOWANCES: Record<PlanId, number> = {
  free: 200,
  plus: 2500,
  ultimate: 8000,
};

export const CREDIT_COSTS = {
  chatMessage: 1,
  codeAppBuild: 10,
  codeAppRefine: 6,
  documentGenerate: 5,
  documentEdit: 4,
  documentAudioOverview: 6,
  vision1K: 5,
  vision2K: 15,
  vision4K: 30,
  visionEdit: 8,
  musicPreview: 5,
  musicFull: 25,
  cinemaMotionPreview: 15,
  cinemaStandard: 80,
  cinema4K: 200,
} as const;

export const FREE_TIER_DAILY_LIMITS = {
  vision: 8,
  music: 4,
  cinema: 2,
  documentAudio: 3,
} as const;

export const PRICING_PLANS: Record<PlanId, PlanCatalogEntry> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Chat, Coding, Docs & Free Media Previews with built-in BYOK Vault.',
    monthlyPriceUsd: 0,
    annualMonthlyPriceUsd: 0,
    annualTotalUsd: 0,
    monthlyCredits: PLAN_ALLOWANCES.free,
    maxVisionResolution: '1K',
    maxCinemaResolution: '720p',
    allowNeuralCinema: false,
    allowFullMusic: false,
    retentionPolicy: 'free_30d',
    features: [
      '200 monthly credits (Free forever)',
      'Groq & OpenRouter Free Chat, Coding & Docs',
      '1K Vision images (up to 8/day free tier)',
      'Music previews & 720p Cinema Motion previews',
      '0-credit BYOK Vault (bring your own API keys)',
    ],
    footerNote: 'No credit card required · Free forever',
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    tagline: 'Creator & Builder plan with 2,500 credits, 2K Vision, Full Music & 1080p Cinema.',
    monthlyPriceUsd: 12,
    annualMonthlyPriceUsd: 10,
    annualTotalUsd: 120,
    monthlyCredits: PLAN_ALLOWANCES.plus,
    badge: 'Most Popular',
    maxVisionResolution: '2K',
    maxCinemaResolution: '1080p',
    allowNeuralCinema: true,
    allowFullMusic: true,
    retentionPolicy: 'paid_permanent',
    features: [
      '2,500 monthly credits (~68%–80% cheaper than $20–$30 suites)',
      'Priority DeepSeek, Groq 70B & OpenRouter Code Studio',
      '2K Vision Studio renders & multi-image editing',
      'Full Music Studio tracks & Document Audio Briefings',
      'Standard 720p/1080p Cinema Studio + Permanent Cloud Storage',
    ],
    footerNote: 'Cancel anytime · Instant activation',
  },
  ultimate: {
    id: 'ultimate',
    name: 'Ultimate',
    tagline: 'Maximum intelligence, 4K Vision, 4K Neural Cinema & flagship reasoning.',
    monthlyPriceUsd: 29,
    annualMonthlyPriceUsd: 24,
    annualTotalUsd: 288,
    monthlyCredits: PLAN_ALLOWANCES.ultimate,
    badge: 'Best Value Pro',
    maxVisionResolution: '4K',
    maxCinemaResolution: '4k',
    allowNeuralCinema: true,
    allowFullMusic: true,
    retentionPolicy: 'paid_permanent',
    features: [
      '8,000 monthly credits for heavy production',
      'Flagship Claude, GPT-4o, DeepSeek R1 & Gemini Argon',
      '4K Ultra-HD Vision Studio & batch upscaling',
      '1080p/4K Neural Cinema Video + Lyria/AI Audio Sync',
      'Permanent Cloud Storage & Priority 24/7 engineering support',
    ],
    footerNote: 'Designed for studios, agencies & power builders',
  },
};

export const TOPUP_PACKS: TopUpPack[] = [
  {
    id: 'pack_1k',
    name: 'Starter Credit Pack',
    credits: 1000,
    priceUsd: 5,
  },
  {
    id: 'pack_3500',
    name: 'Studio Boost Pack',
    credits: 3500,
    priceUsd: 15,
    badge: 'Best Value',
  },
];

export function computeEffectiveCreditCost(baseCost: number, usedByok: boolean): number {
  if (usedByok) return 0;
  return Math.max(1, Math.round(baseCost));
}
