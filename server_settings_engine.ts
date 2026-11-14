import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  DEFAULT_UNIVERSAL_SETTINGS,
  type SettingsSectionId,
  type UniversalDiagnosticsSnapshot,
  type UniversalSettingsProfile,
} from './src/types/settings.ts';
import {
  getTenantByokKeys,
  getTenantCreditBalance,
  getTenantPlan,
  mutateTenantCollection,
  readTenantCollection,
} from './server_tenant_store.ts';
import { listTenantPlugins } from './server_plugins_engine.ts';
import { listUnifiedLibraryAssets } from './server_library_engine.ts';
import {
  findLlamaServerBinary,
  getManagedLlamaState,
  isCloudRunRuntime,
} from './server_local_llm.ts';

const execFileAsync = promisify(execFile);

function isPlainObject(val: unknown): val is Record<string, any> {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val));
}

/**
 * Recursive deep-merge with strict baseline defaults so new nested keys are
 * always hydrated without clobbering existing tenant customizations.
 */
export function deepMergePlain<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return base;
  }
  const out: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined) continue;
    const baseVal = (base as Record<string, any>)[k];
    if (isPlainObject(baseVal) && isPlainObject(v)) {
      out[k] = deepMergePlain(baseVal, v);
    } else if (Array.isArray(baseVal)) {
      out[k] = Array.isArray(v) ? v : baseVal;
    } else if (baseVal !== undefined) {
      out[k] = v;
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export async function getUniversalSettings(tenantId: string): Promise<UniversalSettingsProfile> {
  const stored = await readTenantCollection<Record<string, any> | null>(tenantId, 'settings', null);
  const merged = deepMergePlain(DEFAULT_UNIVERSAL_SETTINGS, stored || {});
  return merged;
}

export async function saveUniversalSettings(
  tenantId: string,
  incoming: Record<string, any>
): Promise<UniversalSettingsProfile> {
  const sanitized = { ...(incoming || {}) };
  // Never allow client spoof of verified security/MFA status
  delete sanitized.security;

  const updated = await mutateTenantCollection<Record<string, any>>(
    tenantId,
    'settings',
    DEFAULT_UNIVERSAL_SETTINGS,
    (current) => {
      const mergedCurrent = deepMergePlain(DEFAULT_UNIVERSAL_SETTINGS, current || {});
      return deepMergePlain(mergedCurrent, sanitized);
    }
  );
  return deepMergePlain(DEFAULT_UNIVERSAL_SETTINGS, updated);
}

export async function resetUniversalSettingsSection(
  tenantId: string,
  section: SettingsSectionId | 'all'
): Promise<UniversalSettingsProfile> {
  const current = await getUniversalSettings(tenantId);
  let next: UniversalSettingsProfile = structuredClone(current);

  switch (section) {
    case 'all':
      next = structuredClone(DEFAULT_UNIVERSAL_SETTINGS);
      break;
    case 'general':
      next.theme = DEFAULT_UNIVERSAL_SETTINGS.theme;
      next.language = DEFAULT_UNIVERSAL_SETTINGS.language;
      next.defaultWorkspace = DEFAULT_UNIVERSAL_SETTINGS.defaultWorkspace;
      next.alwaysShowCode = DEFAULT_UNIVERSAL_SETTINGS.alwaysShowCode;
      next.compactDensity = DEFAULT_UNIVERSAL_SETTINGS.compactDensity;
      break;
    case 'personalization':
      next.customInstructions = structuredClone(DEFAULT_UNIVERSAL_SETTINGS.customInstructions);
      next.memory = structuredClone(DEFAULT_UNIVERSAL_SETTINGS.memory);
      break;
    case 'models':
      next.activeProvider = DEFAULT_UNIVERSAL_SETTINGS.activeProvider;
      next.selectedModel = DEFAULT_UNIVERSAL_SETTINGS.selectedModel;
      next.fallbackOnRateLimit = DEFAULT_UNIVERSAL_SETTINGS.fallbackOnRateLimit;
      next.globalEnhancerDepth = DEFAULT_UNIVERSAL_SETTINGS.globalEnhancerDepth;
      break;
    case 'speech':
      next.voice = structuredClone(DEFAULT_UNIVERSAL_SETTINGS.voice);
      break;
    case 'code_studio':
      next.studioDefaults.code = structuredClone(DEFAULT_UNIVERSAL_SETTINGS.studioDefaults.code);
      break;
    case 'vision_studio':
      next.studioDefaults.vision = structuredClone(DEFAULT_UNIVERSAL_SETTINGS.studioDefaults.vision);
      break;
    case 'cinema_studio':
      next.studioDefaults.cinema = structuredClone(DEFAULT_UNIVERSAL_SETTINGS.studioDefaults.cinema);
      break;
    case 'music_studio':
      next.studioDefaults.music = structuredClone(DEFAULT_UNIVERSAL_SETTINGS.studioDefaults.music);
      break;
    case 'document_studio':
      next.studioDefaults.document = structuredClone(DEFAULT_UNIVERSAL_SETTINGS.studioDefaults.document);
      break;
    case 'files_library':
      next.libraries.files = structuredClone(DEFAULT_UNIVERSAL_SETTINGS.libraries.files);
      break;
    case 'plugins_library':
      next.libraries.plugins = structuredClone(DEFAULT_UNIVERSAL_SETTINGS.libraries.plugins);
      break;
    case 'datacontrols':
      next.dataControls = structuredClone(DEFAULT_UNIVERSAL_SETTINGS.dataControls);
      break;
    default:
      break;
  }

  await mutateTenantCollection<Record<string, any>>(tenantId, 'settings', DEFAULT_UNIVERSAL_SETTINGS, () => next);
  return next;
}

export function buildPortableProfileExport(settings: UniversalSettingsProfile) {
  const clone = structuredClone(settings);
  delete clone.security;
  return {
    schemaVersion: 'raone-universal-settings-v1',
    exportedAt: new Date().toISOString(),
    profile: clone,
  };
}

export async function importPortableSettingsProfile(
  tenantId: string,
  rawPayload: unknown
): Promise<UniversalSettingsProfile> {
  if (!isPlainObject(rawPayload)) {
    throw new Error('Invalid JSON settings profile.');
  }
  const candidate = isPlainObject(rawPayload.profile) ? rawPayload.profile : rawPayload;
  if (
    !candidate.studioDefaults &&
    !candidate.libraries &&
    !candidate.customInstructions &&
    !candidate.theme
  ) {
    throw new Error('JSON file does not contain valid RaOne Universal Settings fields.');
  }
  return saveUniversalSettings(tenantId, candidate);
}

async function checkBinaryExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync(cmd, ['-version'], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

export async function runUniversalDiagnostics(
  tenantId: string
): Promise<UniversalDiagnosticsSnapshot> {
  const [
    ffmpegAvailable,
    ffprobeAvailable,
    byok,
    pluginsResult,
    libraryResult,
    creditsResult,
    planState,
  ] = await Promise.all([
    checkBinaryExists('ffmpeg'),
    checkBinaryExists('ffprobe'),
    getTenantByokKeys(tenantId),
    listTenantPlugins(tenantId),
    listUnifiedLibraryAssets(tenantId),
    getTenantCreditBalance(tenantId),
    getTenantPlan(tenantId),
  ]);

  const managed = getManagedLlamaState();
  const byStudio = {
    code: { count: 0, bytes: 0 },
    vision: { count: 0, bytes: 0 },
    cinema: { count: 0, bytes: 0 },
    music: { count: 0, bytes: 0 },
    document: { count: 0, bytes: 0 },
  };
  let totalAssets = 0;
  let totalBytes = 0;
  let trashedCount = 0;

  for (const item of libraryResult.items) {
    if (item.trashedAt) {
      trashedCount += 1;
      continue;
    }
    totalAssets += 1;
    totalBytes += item.fileSizeBytes || 0;
    if (byStudio[item.studio]) {
      byStudio[item.studio].count += 1;
      byStudio[item.studio].bytes += item.fileSizeBytes || 0;
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    serverHealthy: true,
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      isCloudRun: isCloudRunRuntime(),
      ffmpegAvailable,
      ffprobeAvailable,
      llamaServerAvailable: Boolean(findLlamaServerBinary()),
      managedLlamaRunning: managed.running,
    },
    providers: {
      geminiReady: Boolean(byok.geminiApiKey || process.env.GEMINI_API_KEY),
      groqReady: Boolean(byok.groqApiKey || process.env.GROQ_API_KEY),
      openAiReady: Boolean(byok.openAiApiKey || process.env.OPENAI_API_KEY),
      anthropicReady: Boolean(byok.anthropicApiKey || process.env.ANTHROPIC_API_KEY),
      deepSeekReady: Boolean(byok.deepSeekApiKey || process.env.DEEPSEEK_API_KEY),
      xaiReady: Boolean(byok.xaiApiKey || process.env.XAI_API_KEY),
      cometReady: Boolean(byok.cometApiKey || process.env.COMET_API_KEY),
      localLlmReady: Boolean(byok.localLlmBaseUrl || managed.running || process.env.LOCAL_LLM_BASE_URL),
    },
    vaults: {
      pluginsTotal: pluginsResult.stats.total,
      pluginsConnected: pluginsResult.stats.connected,
      pluginsEnabled: pluginsResult.stats.enabled,
      customPlugins: pluginsResult.stats.customCount,
      creditsBalance: creditsResult.balance,
      plan: planState.plan,
    },
    storage: {
      totalAssets,
      totalBytes,
      trashedCount,
      byStudio,
    },
  };
}
