import React, { useState } from 'react';
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
} from 'lucide-react';
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
    if (!githubRepo.trim() || !githubToken.trim()) return;
    setIsPushingGh(true);
    setGhResult(null);
    try {
      const res = await onPushToGitHub({
        repo: githubRepo.trim(),
        branch: githubBranch.trim() || 'main',
        token: githubToken.trim(),
      });
      if (res) {
        setGhResult(res);
        setGithubToken('');
      }
    } finally {
      setIsPushingGh(false);
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
              <label className="text-[11px] text-[#9AA0A6] block mb-1">
                GitHub Personal Access Token (in-memory push only, never stored)
              </label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_... or github_pat_..."
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
                disabled={isPushingGh || !githubRepo.trim() || !githubToken.trim()}
                className="py-2 rounded-lg bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#0E0F10] font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isPushingGh && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Push Code to GitHub</span>
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

        {/* Universal ZIP & HTML Export Footer */}
        <div className="pt-2 border-t border-[#252629] grid grid-cols-2 gap-2 text-xs">
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
  );
};
