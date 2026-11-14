import { resolveApiUrl } from './api.ts';
import {
  DEFAULT_UNIVERSAL_SETTINGS,
  type SettingsSectionId,
  type UniversalSettingsProfile,
} from '../types/settings.ts';

const SETTINGS_EVENT = 'raone:settings-updated';

let cachedSettings: UniversalSettingsProfile | null = null;
let inflightFetch: Promise<UniversalSettingsProfile> | null = null;

export function getCachedUniversalSettings(): UniversalSettingsProfile {
  return cachedSettings || DEFAULT_UNIVERSAL_SETTINGS;
}

export function broadcastUniversalSettings(settings: UniversalSettingsProfile): void {
  cachedSettings = settings;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: settings }));
  }
}

export async function fetchUniversalSettings(force = false): Promise<UniversalSettingsProfile> {
  if (!force && cachedSettings) return cachedSettings;
  if (!force && inflightFetch) return inflightFetch;

  inflightFetch = fetch(resolveApiUrl('/api/user/settings'))
    .then(async (res) => {
      if (!res.ok) return cachedSettings || DEFAULT_UNIVERSAL_SETTINGS;
      const data = await res.json();
      if (data && typeof data === 'object') {
        const merged: UniversalSettingsProfile = {
          ...DEFAULT_UNIVERSAL_SETTINGS,
          ...data,
          studioDefaults: {
            ...DEFAULT_UNIVERSAL_SETTINGS.studioDefaults,
            ...(data.studioDefaults || {}),
          },
          libraries: {
            ...DEFAULT_UNIVERSAL_SETTINGS.libraries,
            ...(data.libraries || {}),
          },
        };
        cachedSettings = merged;
        return merged;
      }
      return cachedSettings || DEFAULT_UNIVERSAL_SETTINGS;
    })
    .catch(() => cachedSettings || DEFAULT_UNIVERSAL_SETTINGS)
    .finally(() => {
      inflightFetch = null;
    });

  return inflightFetch;
}

export async function saveUniversalSettingsPatch(
  partial: Record<string, any>
): Promise<{ ok: boolean; settings?: UniversalSettingsProfile; error?: string }> {
  try {
    const res = await fetch(resolveApiUrl('/api/user/settings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.settings) {
      return { ok: false, error: data?.error || `Failed to save settings (HTTP ${res.status}).` };
    }
    broadcastUniversalSettings(data.settings);
    return { ok: true, settings: data.settings };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error saving settings.' };
  }
}

export async function resetUniversalSection(
  section: SettingsSectionId | 'all'
): Promise<{ ok: boolean; settings?: UniversalSettingsProfile; error?: string }> {
  try {
    const res = await fetch(resolveApiUrl('/api/user/settings/reset-section'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.settings) {
      return { ok: false, error: data?.error || 'Failed to reset section.' };
    }
    broadcastUniversalSettings(data.settings);
    return { ok: true, settings: data.settings };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error resetting section.' };
  }
}

export function subscribeUniversalSettings(
  cb: (settings: UniversalSettingsProfile) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const custom = e as CustomEvent<UniversalSettingsProfile>;
    if (custom.detail) cb(custom.detail);
  };
  window.addEventListener(SETTINGS_EVENT, handler);
  return () => window.removeEventListener(SETTINGS_EVENT, handler);
}

/**
 * Helper to jump directly into the Universal Settings Center on any module tab
 * from inside any Studio or Library component.
 */
export function openUniversalSettingsAt(section: SettingsSectionId): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('raone:open-settings', { detail: { section } }));
}
