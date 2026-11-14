import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { encryptSecret, decryptSecret } from './server_security.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_ROOT = path.join(__dirname, 'data', 'tenants');

// Per-file async mutex queue to prevent concurrent read-modify-write race conditions (A08)
const writeLocks = new Map<string, Promise<unknown>>();

async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(filePath) || Promise.resolve();
  const next = prev.then(fn, fn);
  writeLocks.set(filePath, next.catch(() => {}));
  return next;
}

function safeTenantDir(tenantId: string): string {
  const cleaned = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96) || 'guest_workspace';
  const dir = path.join(DATA_ROOT, cleaned);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getTenantFile(tenantId: string, filename: string): string {
  return path.join(safeTenantDir(tenantId), filename);
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Persistence read error (${filePath}):`, err);
    throw err;
  }
}

async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.promises.rename(tmpPath, filePath);
}

export async function readTenantCollection<T>(
  tenantId: string,
  collectionName: string,
  fallback: T
): Promise<T> {
  const filePath = getTenantFile(tenantId, `${collectionName}.json`);
  return readJsonFile<T>(filePath, fallback);
}

export async function mutateTenantCollection<T>(
  tenantId: string,
  collectionName: string,
  fallback: T,
  mutator: (current: T) => T | Promise<T>
): Promise<T> {
  const filePath = getTenantFile(tenantId, `${collectionName}.json`);
  return withFileLock(filePath, async () => {
    const current = await readJsonFile<T>(filePath, fallback);
    const updated = await mutator(current);
    await atomicWriteJson(filePath, updated);
    return updated;
  });
}

const SHARED_DATA_ROOT = path.join(__dirname, 'data', 'shared');

function getSharedFile(filename: string): string {
  if (!fs.existsSync(SHARED_DATA_ROOT)) {
    fs.mkdirSync(SHARED_DATA_ROOT, { recursive: true });
  }
  return path.join(SHARED_DATA_ROOT, filename);
}

export async function readSharedCollection<T>(collectionName: string, fallback: T): Promise<T> {
  const filePath = getSharedFile(`${collectionName}.json`);
  return readJsonFile<T>(filePath, fallback);
}

export async function mutateSharedCollection<T>(
  collectionName: string,
  fallback: T,
  mutator: (current: T) => T | Promise<T>
): Promise<T> {
  const filePath = getSharedFile(`${collectionName}.json`);
  return withFileLock(filePath, async () => {
    const current = await readJsonFile<T>(filePath, fallback);
    const updated = await mutator(current);
    await atomicWriteJson(filePath, updated);
    return updated;
  });
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
  const filePath = getTenantFile(tenantId, 'credit_ledger.json');
  return withFileLock(filePath, async () => {
    let entries = await readJsonFile<CreditLedgerEntry[]>(filePath, []);
    if (entries.length === 0) {
      const plan = await getTenantPlan(tenantId);
      entries = [
        {
          id: `led-${crypto.randomUUID()}`,
          kind: 'grant',
          amount: plan.monthlyAllowance || PLAN_ALLOWANCES.free,
          action: 'initial_plan_allowance',
          referenceId: 'init',
          createdAt: new Date().toISOString(),
        },
      ];
      await atomicWriteJson(filePath, entries);
    }
    const balance = entries.reduce((sum, e) => sum + e.amount, 0);
    return { balance, entries };
  });
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
  const filePath = getTenantFile(tenantId, 'credit_ledger.json');
  return withFileLock(filePath, async () => {
    const entries = await readJsonFile<CreditLedgerEntry[]>(filePath, []);
    if (entries.length === 0) {
      const plan = await getTenantPlan(tenantId);
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
    await atomicWriteJson(filePath, entries);
    return { ok: true, balance: currentBalance - cost };
  });
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
  const filePath = getTenantFile(tenantId, 'credit_ledger.json');
  return withFileLock(filePath, async () => {
    const entries = await readJsonFile<CreditLedgerEntry[]>(filePath, []);
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
    await atomicWriteJson(filePath, entries);
    return entries.reduce((s, e) => s + e.amount, 0);
  });
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
  const dir = safeTenantDir(tenantId);
  await withFileLock(dir, async () => {
    if (fs.existsSync(dir)) {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  });
}
