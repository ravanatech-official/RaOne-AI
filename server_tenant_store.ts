import crypto from 'crypto';
import { encryptSecret, decryptSecret } from './server_security.ts';
import {
  getStructuredPersistenceProvider,
  getMediaStorageProvider,
  type PaginatedCollectionResult,
} from './server_cloud_persistence.ts';

export async function readTenantCollection<T>(
  tenantId: string,
  collectionName: string,
  fallback: T
): Promise<T> {
  return getStructuredPersistenceProvider().readTenantCollection<T>(
    tenantId,
    collectionName,
    fallback
  );
}

export async function mutateTenantCollection<T>(
  tenantId: string,
  collectionName: string,
  fallback: T,
  mutator: (current: T) => T | Promise<T>
): Promise<T> {
  return getStructuredPersistenceProvider().mutateTenantCollection<T>(
    tenantId,
    collectionName,
    fallback,
    mutator
  );
}

export async function listTenantCollectionPaginated<T = any>(
  tenantId: string,
  collectionName: string,
  opts?: { limit?: number; cursor?: string | null }
): Promise<PaginatedCollectionResult<T>> {
  return getStructuredPersistenceProvider().listTenantCollectionPaginated<T>(
    tenantId,
    collectionName,
    opts
  );
}

export async function readSharedCollection<T>(collectionName: string, fallback: T): Promise<T> {
  return getStructuredPersistenceProvider().readSharedCollection<T>(collectionName, fallback);
}

export async function mutateSharedCollection<T>(
  collectionName: string,
  fallback: T,
  mutator: (current: T) => T | Promise<T>
): Promise<T> {
  return getStructuredPersistenceProvider().mutateSharedCollection<T>(
    collectionName,
    fallback,
    mutator
  );
}

// =========================================================================
// Encrypted Per-Tenant BYOK Provider Keys (A04 & A07)
// =========================================================================
export type ByokKeyMap = {
  geminiApiKey?: string;
  groqApiKey?: string;
  openAiApiKey?: string;
  anthropicApiKey?: string;
  deepSeekApiKey?: string;
  xaiApiKey?: string;
  cometApiKey?: string;
  cometApiBaseUrl?: string;
  localLlmBaseUrl?: string;
  localLlmModel?: string;
  localLlmApiKey?: string;
};

export async function getTenantByokKeys(tenantId: string): Promise<ByokKeyMap> {
  const stored = await readTenantCollection<Record<string, string>>(tenantId, 'byok_keys', {});
  return {
    geminiApiKey: stored.geminiApiKey ? decryptSecret(stored.geminiApiKey) : undefined,
    groqApiKey: stored.groqApiKey ? decryptSecret(stored.groqApiKey) : undefined,
    openAiApiKey: stored.openAiApiKey ? decryptSecret(stored.openAiApiKey) : undefined,
    anthropicApiKey: stored.anthropicApiKey ? decryptSecret(stored.anthropicApiKey) : undefined,
    deepSeekApiKey: stored.deepSeekApiKey ? decryptSecret(stored.deepSeekApiKey) : undefined,
    xaiApiKey: stored.xaiApiKey ? decryptSecret(stored.xaiApiKey) : undefined,
    cometApiKey: stored.cometApiKey ? decryptSecret(stored.cometApiKey) : undefined,
    cometApiBaseUrl: stored.cometApiBaseUrl || undefined,
    localLlmBaseUrl: stored.localLlmBaseUrl || undefined,
    localLlmModel: stored.localLlmModel || undefined,
    localLlmApiKey: stored.localLlmApiKey ? decryptSecret(stored.localLlmApiKey) : undefined,
  };
}

export async function saveTenantByokKeys(tenantId: string, updates: ByokKeyMap): Promise<void> {
  await mutateTenantCollection<Record<string, string>>(tenantId, 'byok_keys', {}, (current) => {
    const next: Record<string, string> = { ...current, updatedAt: new Date().toISOString() };
    const secretFields = [
      'geminiApiKey',
      'groqApiKey',
      'openAiApiKey',
      'anthropicApiKey',
      'deepSeekApiKey',
      'xaiApiKey',
      'cometApiKey',
      'localLlmApiKey',
    ] as const;

    for (const field of secretFields) {
      const val = updates[field];
      if (val !== undefined) {
        if (val.trim()) {
          next[field] = encryptSecret(val.trim());
        } else {
          delete next[field];
        }
      }
    }
    if (updates.cometApiBaseUrl !== undefined) {
      next.cometApiBaseUrl = updates.cometApiBaseUrl.trim();
    }
    if (updates.localLlmBaseUrl !== undefined) {
      next.localLlmBaseUrl = updates.localLlmBaseUrl.trim();
    }
    if (updates.localLlmModel !== undefined) {
      next.localLlmModel = updates.localLlmModel.trim();
    }
    return next;
  });
}

// =========================================================================
// Immutable Credit Ledger & Entitlements (A09 & Section 11 Billing)
// =========================================================================
export interface PlanState {
  plan: 'free' | 'plus' | 'ultimate';
  billingCycle: 'monthly' | 'yearly';
  status: 'active' | 'past_due' | 'canceled';
  monthlyAllowance: number;
  updatedAt: string;
  expiresAt?: string;
}

export interface CreditLedgerEntry {
  id: string;
  kind: 'grant' | 'reserve' | 'settle' | 'release' | 'refund';
  amount: number; // positive adds balance, negative deducts balance
  action: string;
  referenceId: string;
  createdAt: string;
}

export const PLAN_ALLOWANCES: Record<'free' | 'plus' | 'ultimate', number> = {
  free: 200,
  plus: 2500,
  ultimate: 12000,
};

export async function getTenantPlan(tenantId: string): Promise<PlanState> {
  return readTenantCollection<PlanState>(tenantId, 'plan', {
    plan: 'free',
    billingCycle: 'monthly',
    status: 'active',
    monthlyAllowance: PLAN_ALLOWANCES.free,
    updatedAt: new Date().toISOString(),
  });
}

export async function getTenantCreditBalance(tenantId: string): Promise<{
  balance: number;
  entries: CreditLedgerEntry[];
}> {
  const plan = await getTenantPlan(tenantId);
  return getStructuredPersistenceProvider().runCreditLedgerTransaction(
    tenantId,
    async (currentEntries, saveEntries) => {
      const entries: CreditLedgerEntry[] = [...currentEntries];
      if (entries.length === 0) {
        entries.push({
          id: `led-${crypto.randomUUID()}`,
          kind: 'grant',
          amount: plan.monthlyAllowance || PLAN_ALLOWANCES.free,
          action: 'initial_plan_allowance',
          referenceId: 'init',
          createdAt: new Date().toISOString(),
        });
        await saveEntries(entries);
      }
      const balance = entries.reduce((sum, e) => sum + e.amount, 0);
      return { balance, entries };
    }
  );
}

export async function reserveCredits(
  tenantId: string,
  cost: number,
  action: string,
  referenceId: string
): Promise<{ ok: true; balance: number } | { ok: false; balance: number }> {
  if (cost <= 0) {
    const { balance } = await getTenantCreditBalance(tenantId);
    return { ok: true, balance };
  }
  const plan = await getTenantPlan(tenantId);
  return getStructuredPersistenceProvider().runCreditLedgerTransaction(
    tenantId,
    async (currentEntries, saveEntries) => {
      const entries: CreditLedgerEntry[] = [...currentEntries];
      if (entries.length === 0) {
        entries.push({
          id: `led-${crypto.randomUUID()}`,
          kind: 'grant',
          amount: plan.monthlyAllowance || PLAN_ALLOWANCES.free,
          action: 'initial_plan_allowance',
          referenceId: 'init',
          createdAt: new Date().toISOString(),
        });
      }
      // Idempotency guard per referenceId
      if (entries.some((e) => e.referenceId === referenceId && e.kind === 'reserve')) {
        const balance = entries.reduce((s, e) => s + e.amount, 0);
        return { ok: true, balance };
      }
      const currentBalance = entries.reduce((s, e) => s + e.amount, 0);
      if (currentBalance < cost) {
        if (currentEntries.length === 0) {
          await saveEntries(entries);
        }
        return { ok: false, balance: currentBalance };
      }
      entries.push({
        id: `led-${crypto.randomUUID()}`,
        kind: 'reserve',
        amount: -cost,
        action,
        referenceId,
        createdAt: new Date().toISOString(),
      });
      await saveEntries(entries);
      return { ok: true, balance: currentBalance - cost };
    }
  );
}

export async function refundCredits(
  tenantId: string,
  cost: number,
  action: string,
  referenceId: string
): Promise<number> {
  if (cost <= 0) {
    const { balance } = await getTenantCreditBalance(tenantId);
    return balance;
  }
  return getStructuredPersistenceProvider().runCreditLedgerTransaction(
    tenantId,
    async (currentEntries, saveEntries) => {
      const entries: CreditLedgerEntry[] = [...currentEntries];
      if (entries.some((e) => e.referenceId === referenceId && e.kind === 'refund')) {
        return entries.reduce((s, e) => s + e.amount, 0);
      }
      entries.push({
        id: `led-${crypto.randomUUID()}`,
        kind: 'refund',
        amount: cost,
        action,
        referenceId,
        createdAt: new Date().toISOString(),
      });
      await saveEntries(entries);
      return entries.reduce((s, e) => s + e.amount, 0);
    }
  );
}

// =========================================================================
// Full Tenant Export & Complete Deletion (A10)
// =========================================================================
export async function exportAllTenantData(tenantId: string, email: string | null) {
  const [
    plan,
    ledger,
    settings,
    conversations,
    projects,
    studioApps,
    studioPrompts,
    visionImages,
    motionVideos,
    audioTracks,
    documents,
    libraryFolders,
  ] = await Promise.all([
    getTenantPlan(tenantId),
    getTenantCreditBalance(tenantId),
    readTenantCollection<Record<string, any>>(tenantId, 'settings', {}),
    readTenantCollection<any[]>(tenantId, 'conversations', []),
    readTenantCollection<any[]>(tenantId, 'projects', []),
    readTenantCollection<any[]>(tenantId, 'studio_apps', []),
    readTenantCollection<any[]>(tenantId, 'studio_prompts', []),
    readTenantCollection<any[]>(tenantId, 'vision_images', []),
    readTenantCollection<any[]>(tenantId, 'motion_videos', []),
    readTenantCollection<any[]>(tenantId, 'audio_tracks', []),
    readTenantCollection<any[]>(tenantId, 'documents', []),
    readTenantCollection<any[]>(tenantId, 'library_folders', []),
  ]);

  return {
    exportDate: new Date().toISOString(),
    tenantId,
    user: { email, plan: plan.plan },
    plan,
    creditsBalance: ledger.balance,
    settings,
    counts: {
      conversations: conversations.length,
      projects: projects.length,
      studioApps: studioApps.length,
      visionImages: visionImages.length,
      motionVideos: motionVideos.length,
      audioTracks: audioTracks.length,
      documents: documents.length,
      libraryFolders: libraryFolders.length,
    },
    conversations,
    projects,
    studioApps,
    studioPrompts,
    visionImages,
    motionVideos,
    audioTracks,
    documents,
    libraryFolders,
  };
}

export async function purgeAllTenantData(tenantId: string): Promise<void> {
  await Promise.all([
    getMediaStorageProvider().deleteTenantMedia(tenantId),
    getStructuredPersistenceProvider().purgeTenantStructuredData(tenantId),
  ]);
}
