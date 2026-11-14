import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Bookmark,
  Trash2,
  ShieldCheck,
  PlugZap,
  Terminal,
} from 'lucide-react';
import { resolveApiUrl } from '../utils/api.ts';
import {
  PLUGIN_STUDIO_LABELS,
  type CustomPluginDefinition,
  type PluginPublicView,
  type PluginStudioScope,
} from '../types/plugins.ts';

const ALL_STUDIOS: PluginStudioScope[] = ['code', 'vision', 'cinema', 'music', 'document'];

interface PluginConfigModalProps {
  plugin: PluginPublicView | null;
  isCustomCreatorOpen: boolean;
  onClose: () => void;
  onUpdated: (plugin: PluginPublicView) => void;
  onDeletedCustom: (pluginId: string) => void;
}

export const PluginConfigModal: React.FC<PluginConfigModalProps> = ({
  plugin,
  isCustomCreatorOpen,
  onClose,
  onUpdated,
  onDeletedCustom,
}) => {
  // Standard connector form state
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [enabledStudios, setEnabledStudios] = useState<PluginStudioScope[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs: number;
    message: string;
    verifiedAccount?: string | null;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Custom Plugin Builder state
  const [customName, setCustomName] = useState('');
  const [customProvider, setCustomProvider] = useState('Custom REST / MCP');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customHealthPath, setCustomHealthPath] = useState('/health');
  const [customAuthScheme, setCustomAuthScheme] = useState<CustomPluginDefinition['authScheme']>('Bearer');
  const [customAuthHeader, setCustomAuthHeader] = useState('Authorization');
  const [customDescription, setCustomDescription] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customStudios, setCustomStudios] = useState<PluginStudioScope[]>(['code', 'document']);

  useEffect(() => {
    setErrorMsg(null);
    setTestResult(null);
    setRevealedKeys({});
    if (plugin) {
      const initial: Record<string, string> = {};
      for (const f of plugin.fields) {
        if (f.type === 'secret') {
          initial[f.key] = ''; // Never pre-fill plaintext secrets; show masked placeholder instead
        } else {
          initial[f.key] = plugin.publicFields?.[f.key] || '';
        }
      }
      setFieldValues(initial);
      setEnabledStudios(plugin.enabledStudios?.length ? plugin.enabledStudios : [...plugin.studios]);
      if (plugin.lastTestMessage) {
        setTestResult({
          ok: Boolean(plugin.lastTestOk),
          latencyMs: plugin.lastTestLatencyMs || 0,
          message: plugin.lastTestMessage,
          verifiedAccount: plugin.verifiedAccount,
        });
      }
    }
  }, [plugin]);

  useEffect(() => {
    if (isCustomCreatorOpen) {
      setErrorMsg(null);
      setCustomName('');
      setCustomProvider('Custom REST / MCP');
      setCustomBaseUrl('');
      setCustomHealthPath('/health');
      setCustomAuthScheme('Bearer');
      setCustomAuthHeader('Authorization');
      setCustomDescription('');
      setCustomApiKey('');
      setCustomStudios(['code', 'document']);
    }
  }, [isCustomCreatorOpen]);

  if (!plugin && !isCustomCreatorOpen) return null;

  const toggleStudioScope = (scope: PluginStudioScope) => {
    setEnabledStudios((prev) => {
      if (prev.includes(scope)) {
        return prev.length > 1 ? prev.filter((s) => s !== scope) : prev;
      }
      return [...prev, scope];
    });
  };

  const toggleCustomStudio = (scope: PluginStudioScope) => {
    setCustomStudios((prev) => {
      if (prev.includes(scope)) {
        return prev.length > 1 ? prev.filter((s) => s !== scope) : prev;
      }
      return [...prev, scope];
    });
  };

  const handleLiveTest = async () => {
    if (!plugin) return;
    setIsTesting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(resolveApiUrl('/api/plugins/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId: plugin.id,
          fields: fieldValues,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(json?.error || `Verification failed (HTTP ${res.status}).`);
        return;
      }
      setTestResult({
        ok: Boolean(json.ok),
        latencyMs: Number(json.latencyMs || 0),
        message: String(json.message || ''),
        verifiedAccount: json.verifiedAccount || null,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error running live verification.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConnect = async () => {
    if (!plugin) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(resolveApiUrl('/api/plugins/connect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId: plugin.id,
          fields: fieldValues,
          enabledStudios,
          enabled: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.plugin) {
        setErrorMsg(json?.error || 'Failed to save encrypted credentials.');
        return;
      }
      onUpdated(json.plugin);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to connect plugin.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBookmarkLater = async () => {
    if (!plugin) return;
    try {
      const res = await fetch(resolveApiUrl('/api/plugins/bookmark'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: plugin.id, bookmarked: !plugin.bookmarked }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.plugin) {
        onUpdated(json.plugin);
      }
    } catch {
      // ignore
    }
  };

  const handleDisconnect = async () => {
    if (!plugin) return;
    setIsDisconnecting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(resolveApiUrl('/api/plugins/disconnect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: plugin.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.plugin) {
        setErrorMsg(json?.error || 'Failed to disconnect plugin.');
        return;
      }
      onUpdated(json.plugin);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Disconnect failed.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleDeleteCustom = async () => {
    if (!plugin?.isCustom) return;
    setIsDisconnecting(true);
    try {
      const res = await fetch(resolveApiUrl(`/api/plugins/custom/${encodeURIComponent(plugin.id)}`), {
        method: 'DELETE',
      });
      if (res.ok) {
        onDeletedCustom(plugin.id);
        onClose();
      } else {
        const json = await res.json().catch(() => ({}));
        setErrorMsg(json?.error || 'Failed to delete custom plugin.');
      }
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSaveCustomPlugin = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(resolveApiUrl('/api/plugins/custom'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName,
          provider: customProvider,
          baseUrl: customBaseUrl,
          healthPath: customHealthPath,
          authScheme: customAuthScheme,
          authHeaderName: customAuthHeader,
          description: customDescription,
          apiKey: customApiKey,
          studios: customStudios,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.plugin) {
        setErrorMsg(json?.error || 'Failed to create custom plugin.');
        return;
      }
      onUpdated(json.plugin);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create custom plugin.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- CUSTOM PLUGIN CREATOR MODE ---
  if (isCustomCreatorOpen && !plugin) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-[#131314] border border-[#252629] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="px-6 py-4 border-b border-[#252629] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#1E1F22] border border-[#2C2E33] flex items-center justify-center text-[#8AB4F8]">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Register Custom REST / MCP Plugin</h2>
                <p className="text-xs text-[#9AA0A6]">SSRF-hardened HTTPS endpoint encrypted per-tenant with AES-256-GCM</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#1E1F22]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto chat-scroll-area text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Plugin Name *</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="My Internal Inference API"
                  className="w-full bg-[#0E0F10] border border-[#252629] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#8AB4F8]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Provider / Team</label>
                <input
                  type="text"
                  value={customProvider}
                  onChange={(e) => setCustomProvider(e.target.value)}
                  placeholder="RavanaTec Infra"
                  className="w-full bg-[#0E0F10] border border-[#252629] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#8AB4F8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Public HTTPS Base URL *</label>
                <input
                  type="url"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="w-full bg-[#0E0F10] border border-[#252629] rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-[#8AB4F8]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Health Path</label>
                <input
                  type="text"
                  value={customHealthPath}
                  onChange={(e) => setCustomHealthPath(e.target.value)}
                  placeholder="/health"
                  className="w-full bg-[#0E0F10] border border-[#252629] rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-[#8AB4F8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Auth Scheme</label>
                <select
                  value={customAuthScheme}
                  onChange={(e) => setCustomAuthScheme(e.target.value as any)}
                  className="w-full bg-[#0E0F10] border border-[#252629] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#8AB4F8]"
                >
                  <option value="Bearer">Bearer Token</option>
                  <option value="X-Api-Key">X-Api-Key Header</option>
                  <option value="Custom">Custom Header</option>
                  <option value="None">Public / No Auth</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Auth Header Name</label>
                <input
                  type="text"
                  value={customAuthHeader}
                  onChange={(e) => setCustomAuthHeader(e.target.value)}
                  disabled={customAuthScheme === 'None'}
                  className="w-full bg-[#0E0F10] border border-[#252629] rounded-lg px-3 py-2 font-mono text-white disabled:opacity-40 focus:outline-none focus:border-[#8AB4F8]"
                />
              </div>
            </div>

            {customAuthScheme !== 'None' && (
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1.5">API Secret / Token (Encrypted at Rest)</label>
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="Optional now — can connect later"
                  className="w-full bg-[#0E0F10] border border-[#252629] rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-[#8AB4F8]"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Description</label>
              <input
                type="text"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="What does this plugin supply to RaOne Studios?"
                className="w-full bg-[#0E0F10] border border-[#252629] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#8AB4F8]"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-2">Studio Scopes</label>
              <div className="grid grid-cols-3 gap-2">
                {ALL_STUDIOS.map((scope) => {
                  const active = customStudios.includes(scope);
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => toggleCustomStudio(scope)}
                      className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                        active
                          ? 'bg-[#1E1F22] border-[#8AB4F8] text-white'
                          : 'bg-[#0E0F10] border-[#252629] text-[#9AA0A6] hover:text-white'
                      }`}
                    >
                      {PLUGIN_STUDIO_LABELS[scope]}
                    </button>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-[#252629] bg-[#0E0F10] flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs text-[#9AA0A6] hover:text-white hover:bg-[#1E1F22]"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCustomPlugin}
              disabled={isSaving || !customName.trim() || !customBaseUrl.trim()}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#0E0F10] disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Custom Plugin</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!plugin) return null;

  // --- STANDARD / EXISTING CONNECTOR CONFIG MODAL ---
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#131314] border border-[#252629] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#252629] flex items-center justify-between">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white truncate">{plugin.name}</h2>
              <span className="text-xs text-[#9AA0A6] font-mono">· {plugin.provider}</span>
            </div>
            <p className="text-xs text-[#9AA0A6] mt-0.5">{plugin.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#1E1F22] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto chat-scroll-area text-xs">
          {/* Quick Links & Encryption Guarantee */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#252629] text-[11px] text-[#9AA0A6]">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>AES-256-GCM Per-Tenant Encrypted Vault</span>
            </div>
            <div className="flex items-center gap-3">
              {plugin.getKeyUrl && (
                <a
                  href={plugin.getKeyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#8AB4F8] hover:underline inline-flex items-center gap-1"
                >
                  <span>Get Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {plugin.docsUrl && (
                <a
                  href={plugin.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#C4C7C5] hover:text-white inline-flex items-center gap-1"
                >
                  <span>Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-3.5">
            {plugin.fields.map((field) => {
              const maskedSaved = plugin.maskedFields?.[field.key];
              const isSecret = field.type === 'secret';
              const revealed = Boolean(revealedKeys[field.key]);
              return (
                <div key={field.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-medium text-[#C4C7C5]">
                      {field.label} {field.required ? '*' : ''}
                    </label>
                    {isSecret && maskedSaved && (
                      <span className="font-mono text-[11px] text-emerald-400">
                        Stored: {maskedSaved}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={isSecret && !revealed ? 'password' : 'text'}
                      value={fieldValues[field.key] || ''}
                      onChange={(e) =>
                        setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={
                        isSecret && maskedSaved
                          ? `Leave blank to keep existing (${maskedSaved})`
                          : field.placeholder
                      }
                      className="w-full bg-[#0E0F10] border border-[#252629] rounded-lg px-3 py-2 pr-9 font-mono text-xs text-white placeholder-[#5F6368] focus:outline-none focus:border-[#8AB4F8]"
                    />
                    {isSecret && (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedKeys((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9AA0A6] hover:text-white"
                        title={revealed ? 'Hide value' : 'Reveal input'}
                      >
                        {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  {field.helper && (
                    <p className="text-[11px] text-[#9AA0A6] mt-1">{field.helper}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Studio Scope Routing */}
          <div>
            <div className="text-[11px] font-medium text-[#C4C7C5] mb-2">
              Active Studio Modules (where this plugin is enabled)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {plugin.studios.map((scope) => {
                const active = enabledStudios.includes(scope);
                return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => toggleStudioScope(scope)}
                    className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-[#1E1F22] border-[#8AB4F8] text-white'
                        : 'bg-[#0E0F10] border-[#252629] text-[#9AA0A6] hover:text-white'
                    }`}
                  >
                    {PLUGIN_STUDIO_LABELS[scope]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Test Outcome */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border space-y-1 ${
                testResult.ok
                  ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                  : 'bg-red-950/30 border-red-800/50 text-red-300'
              }`}
            >
              <div className="flex items-center justify-between font-medium">
                <div className="flex items-center gap-1.5">
                  {testResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{testResult.ok ? 'Live Verification Passed' : 'Verification Failed'}</span>
                </div>
                <span className="font-mono text-[11px] tabular-nums">{testResult.latencyMs} ms</span>
              </div>
              <p className="text-[11px] opacity-90">{testResult.message}</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#252629] bg-[#0E0F10] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBookmarkLater}
              className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
                plugin.bookmarked
                  ? 'bg-[#1E1F22] border-amber-500/50 text-amber-300'
                  : 'bg-[#161719] border-[#252629] text-[#C4C7C5] hover:text-white'
              }`}
              title="Save for connecting later"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>{plugin.bookmarked ? 'Bookmarked' : 'Connect Later'}</span>
            </button>

            {plugin.isConnected && (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="px-3 py-2 rounded-lg border border-red-900/50 bg-red-950/20 hover:bg-red-950/40 text-red-300 text-xs flex items-center gap-1.5"
              >
                {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Disconnect</span>
              </button>
            )}

            {plugin.isCustom && (
              <button
                type="button"
                onClick={handleDeleteCustom}
                disabled={isDisconnecting}
                className="px-3 py-2 rounded-lg border border-[#252629] bg-[#161719] hover:border-red-800 text-[#9AA0A6] hover:text-red-300 text-xs"
              >
                Delete Custom
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {plugin.supportsLiveTest && (
              <button
                type="button"
                onClick={handleLiveTest}
                disabled={isTesting}
                className="px-3.5 py-2 rounded-lg border border-[#2C2E33] bg-[#161719] hover:bg-[#1E1F22] text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />}
                <span>Test Live</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveConnect}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#0E0F10] text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{plugin.isConnected ? 'Update Vault' : 'Save & Connect'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
