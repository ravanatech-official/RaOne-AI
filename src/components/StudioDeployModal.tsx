import React, { useState, useEffect } from 'react';
import {
  Globe,
  Flame,
  Cloud,
  GitBranch,
  X,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  FolderArchive,
  Download,
  Rocket,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { resolveApiUrl } from '../utils/api';
import type { DeployTargetId, StudioProjectConfig } from '../types/studio';

interface StudioDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  appTitle: string;
  config: StudioProjectConfig;
  publishMeta?: {
    isPublished: boolean;
    shareId?: string;
    shareUrl?: string;
    publishedAt?: string;
  };
  isPublishing: boolean;
  onPublishLiveSnapshot: () => void;
  onPrepareDeployArtifacts: (opts: {
    target: DeployTargetId;
    firebaseProjectId?: string;
    gcpRegion?: string;
    cloudRunService?: string;
    githubRepo?: string;
    githubBranch?: string;
  }) => Promise<{ commands: string[]; checklist: string[] } | null>;
  onPushToGitHub: (opts: {
    repo: string;
    branch: string;
    token: string;
  }) => Promise<{ repoUrl: string; pushedCount: number } | null>;
  onDownloadZip: () => void;
  onDownloadHtml: () => void;
}

export const StudioDeployModal: React.FC<StudioDeployModalProps> = ({
  isOpen,
  onClose,
  appTitle,
  config,
  publishMeta,
  isPublishing,
  onPublishLiveSnapshot,
  onPrepareDeployArtifacts,
  onPushToGitHub,
  onDownloadZip,
  onDownloadHtml,
}) => {
  const [activeTab, setActiveTab] = useState<DeployTargetId>('raone_live');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const [firebaseProjectId, setFirebaseProjectId] = useState(
    config.deployConfig?.firebaseProjectId || 'raoneai'
  );
  const [gcpRegion, setGcpRegion] = useState(config.deployConfig?.gcpRegion || 'us-central1');
  const [cloudRunService, setCloudRunService] = useState(
    config.deployConfig?.cloudRunService ||
      appTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
      'raone-app'
  );
  const [githubRepo, setGithubRepo] = useState(config.deployConfig?.githubRepo || '');
  const [githubBranch, setGithubBranch] = useState(config.deployConfig?.githubBranch || 'main');
  const [githubToken, setGithubToken] = useState('');

  const [isPreparing, setIsPreparing] = useState(false);
  const [isPushingGh, setIsPushingGh] = useState(false);
  const [prepResult, setPrepResult] = useState<{ commands: string[]; checklist: string[] } | null>(null);
  const [ghResult, setGhResult] = useState<{ repoUrl: string; pushedCount: number } | null>(null);
  const [hasGitHubVaultPlugin, setHasGitHubVaultPlugin] = useState(false);
  const [ghVaultAccount, setGhVaultAccount] = useState<string | null>(null);
  const [hasWebhookPlugin, setHasWebhookPlugin] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch(resolveApiUrl('/api/plugins?studio=code&connected=true'))
      .then((r) => r.json())
      .then((json) => {
        if (!json?.success || !Array.isArray(json.plugins)) return;
        const gh = json.plugins.find((p: any) => p.id === 'github' && p.enabled && p.enabledStudios?.includes('code'));
        setHasGitHubVaultPlugin(Boolean(gh));
        setGhVaultAccount(gh?.verifiedAccount || gh?.publicFields?.defaultOwner || null);
        if (gh?.publicFields?.defaultOwner && !githubRepo) {
          const slug = appTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'raone-app';
          setGithubRepo(`${gh.publicFields.defaultOwner}/${slug}`);
        }
        const fb = json.plugins.find((p: any) => p.id === 'firebase' && p.enabled);
        if (fb?.publicFields?.projectId) setFirebaseProjectId(fb.publicFields.projectId);
        if (fb?.publicFields?.region) setGcpRegion(fb.publicFields.region);
        const wh = json.plugins.find((p: any) => p.id === 'slack_discord' && p.enabled && p.enabledStudios?.includes('code'));
        setHasWebhookPlugin(Boolean(wh));
      })
      .catch(() => {});
  }, [isOpen, appTitle]);

  if (!isOpen) return null;

  const fullShareUrl = publishMeta?.shareUrl
    ? `${window.location.origin}${publishMeta.shareUrl}`
    : '';

  const handlePrepare = async (target: DeployTargetId) => {
    setIsPreparing(true);
    setPrepResult(null);
    try {
      const out = await onPrepareDeployArtifacts({
        target,
        firebaseProjectId,
        gcpRegion,
        cloudRunService,
        githubRepo,
        githubBranch,
      });
      if (out) setPrepResult(out);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleGitHubPush = async () => {
    if (!githubRepo.trim() || (!githubToken.trim() && !hasGitHubVaultPlugin)) return;
    setIsPushingGh(true);
    setGhResult(null);
    try {
      const res = await onPushToGitHub({
        repo: githubRepo.trim(),
        branch: githubBranch.trim() || 'main',
        token: githubToken.trim() || '__USE_VAULT__',
      });
      if (res) {
        setGhResult(res);
        setGithubToken('');
      }
    } finally {
      setIsPushingGh(false);
    }
  };

  const handleSendDeployWebhook = async () => {
    setWebhookStatus('Sending...');
    try {
      const res = await fetch(resolveApiUrl('/api/plugins/webhook-dispatch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId: 'slack_discord',
          studio: 'code',
          eventTitle: `Code Studio Deploy: ${appTitle}`,
          summary: fullShareUrl
            ? `Live app published from RaOne Code Studio.`
            : `Build artifacts prepared for ${githubRepo || firebaseProjectId || cloudRunService}.`,
          url: fullShareUrl || ghResult?.repoUrl || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      setWebhookStatus(json?.ok ? 'Notified team channel.' : json?.error || 'Webhook failed.');
    } catch {
      setWebhookStatus('Webhook dispatch failed.');
    }
  };

  const tabs: Array<{ id: DeployTargetId; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'raone_live', label: 'Live URL', Icon: Globe },
    { id: 'firebase', label: 'Firebase', Icon: Flame },
    { id: 'cloud_run', label: 'Google Cloud', Icon: Cloud },
    { id: 'github', label: 'GitHub', Icon: GitBranch },
  ];

  return (
    <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#18191B] border border-[#2F3135] p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#252629] pb-3">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-[#8AB4F8]" />
            <h3 className="text-sm font-medium text-white">Deploy & Launch Project</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#8E918F] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Switcher */}
        <div className="grid grid-cols-4 gap-1 bg-[#121315] p-1 rounded-xl border border-[#282A2E]">
          {tabs.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => {
                  setActiveTab(id);
                  setPrepResult(null);
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  active ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* 1. RaOne Instant Live Share */}
        {activeTab === 'raone_live' && (
          <div className="space-y-3 text-xs">
            {isPublishing ? (
              <div className="py-6 flex items-center justify-center gap-2 text-[#C4C7C5]">
                <Loader2 className="w-4 h-4 animate-spin text-[#8AB4F8]" />
                <span>Deploying sandboxed live snapshot...</span>
              </div>
            ) : publishMeta?.shareUrl ? (
              <>
                <div className="text-[#9AA0A6]">Standalone sandboxed live URL ready:</div>
                <div className="flex items-center gap-1.5 bg-[#111214] border border-[#2C2D30] rounded-lg p-1.5">
                  <input
                    type="text"
                    readOnly
                    value={fullShareUrl}
                    className="flex-1 bg-transparent px-2 text-xs font-mono text-[#E3E3E3] focus:outline-none select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(fullShareUrl).catch(() => {});
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 1800);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#2B2D30] hover:bg-[#383A40] text-white font-medium shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <a
                  href={publishMeta.shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 rounded-lg bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#0E0F10] font-medium flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Live Published App</span>
                </a>
              </>
            ) : (
              <button
                onClick={onPublishLiveSnapshot}
                className="w-full py-2 rounded-lg bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#0E0F10] font-medium"
              >
                Publish Instant Live URL
              </button>
            )}
          </div>
        )}

        {/* 2. Firebase Hosting & Firestore */}
        {activeTab === 'firebase' && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Firebase Project ID</label>
              <input
                type="text"
                value={firebaseProjectId}
                onChange={(e) => setFirebaseProjectId(e.target.value)}
                placeholder="my-firebase-project"
                className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
              />
            </div>
            <button
              onClick={() => handlePrepare('firebase')}
              disabled={isPreparing}
              className="w-full py-2 rounded-lg bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#0E0F10] font-medium flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {isPreparing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Generate firebase.json, .firebaserc & firestore.rules</span>
            </button>
          </div>
        )}

        {/* 3. Google Cloud Run */}
        {activeTab === 'cloud_run' && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Cloud Run Service</label>
                <input
                  type="text"
                  value={cloudRunService}
                  onChange={(e) => setCloudRunService(e.target.value)}
                  className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">GCP Region</label>
                <input
                  type="text"
                  value={gcpRegion}
                  onChange={(e) => setGcpRegion(e.target.value)}
                  className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                />
              </div>
            </div>
            <button
              onClick={() => handlePrepare('cloud_run')}
              disabled={isPreparing}
              className="w-full py-2 rounded-lg bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#0E0F10] font-medium flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {isPreparing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Generate Production Dockerfile & cloudbuild.yaml</span>
            </button>
          </div>
        )}

        {/* 4. GitHub Repository Push & CI/CD */}
        {activeTab === 'github' && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[11px] text-[#9AA0A6] block mb-1">GitHub Repo (owner/repo)</label>
                <input
                  type="text"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="ravanatech/my-app"
                  className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Branch</label>
                <input
                  type="text"
                  value={githubBranch}
                  onChange={(e) => setGithubBranch(e.target.value)}
                  className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-[#9AA0A6]">
                  GitHub Personal Access Token
                </label>
                {hasGitHubVaultPlugin && (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Vault Active {ghVaultAccount ? `(${ghVaultAccount})` : ''}</span>
                  </span>
                )}
              </div>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder={
                  hasGitHubVaultPlugin
                    ? 'Leave blank to use encrypted GitHub plugin token'
                    : 'ghp_... or github_pat_...'
                }
                className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handlePrepare('github')}
                disabled={isPreparing}
                className="py-2 rounded-lg bg-[#2B2D30] hover:bg-[#383A40] text-white font-medium flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {isPreparing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Add GitHub CI/CD</span>
              </button>
              <button
                onClick={handleGitHubPush}
                disabled={isPushingGh || !githubRepo.trim() || (!githubToken.trim() && !hasGitHubVaultPlugin)}
                className="py-2 rounded-lg bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#0E0F10] font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isPushingGh && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{githubToken.trim() || !hasGitHubVaultPlugin ? 'Push Code to GitHub' : 'Push via GitHub Plugin'}</span>
              </button>
            </div>

            {ghResult && (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 space-y-1">
                <div className="font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Pushed {ghResult.pushedCount} files to GitHub</span>
                </div>
                <a
                  href={ghResult.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#8AB4F8] hover:underline inline-flex items-center gap-1"
                >
                  <span>{ghResult.repoUrl}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Synthesized Artifact Summary + CLI Commands */}
        {prepResult && (
          <div className="p-3 rounded-xl bg-[#121315] border border-[#2A2C30] space-y-2 text-xs">
            <div className="space-y-1">
              {prepResult.checklist.map((item, i) => (
                <div key={i} className="text-emerald-300 flex items-center gap-1.5 text-[11px]">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="p-2 rounded-lg bg-[#0B0C0E] border border-[#222428] font-mono text-[11px] text-[#C4C7C5] space-y-1 overflow-x-auto">
              {prepResult.commands.map((cmd, idx) => (
                <div key={idx}>$ {cmd}</div>
              ))}
            </div>
          </div>
        )}

        {/* Webhook Notification Bridge & Universal ZIP / HTML Export Footer */}
        <div className="pt-2 border-t border-[#252629] space-y-2 text-xs">
          {hasWebhookPlugin && (
            <div className="flex items-center justify-between gap-2 pb-1">
              <button
                onClick={handleSendDeployWebhook}
                className="px-3 py-1.5 rounded-lg bg-[#1E1F22] hover:bg-[#2C2E33] border border-[#323438] text-[#8AB4F8] font-medium"
              >
                Notify Connected Team Webhook
              </button>
              {webhookStatus && <span className="text-[11px] text-[#9AA0A6]">{webhookStatus}</span>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onDownloadZip}
              className="py-2 rounded-lg bg-[#222428] hover:bg-[#2C2E33] border border-[#323438] text-[#E3E3E3] flex items-center justify-center gap-1.5"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Export Full Repo ZIP</span>
            </button>
            <button
              onClick={onDownloadHtml}
              className="py-2 rounded-lg bg-[#222428] hover:bg-[#2C2E33] border border-[#323438] text-[#E3E3E3] flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export HTML Bundle</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
