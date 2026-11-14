import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Wrench,
  Terminal,
  RefreshCw,
  Loader2,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
import type { StudioAuditReport } from '../types/studio';

interface StudioAuditDrawerProps {
  hasBuiltApp: boolean;
  selectedBuildMode: string;
  providerUsed?: string;
  selectedBrain: string;
  diagnostics?: {
    syntaxOk: boolean;
    errors: string[];
    warnings: string[];
    bundleBytes: number;
    fileCount: number;
  };
  auditReport?: StudioAuditReport;
  envVariables?: string[];
  runtimeErrors: string[];
  isAutoFixing: boolean;
  isAuditing: boolean;
  isFixingAudit: boolean;
  onAutoFixRuntime: () => void;
  onRunFullAudit: () => void;
  onAutoFixAudit: () => void;
  agentSteps?: Array<{
    step: number;
    phase: string;
    title: string;
    details: string;
  }>;
  agentLogs: string[];
}

export const StudioAuditDrawer: React.FC<StudioAuditDrawerProps> = ({
  hasBuiltApp,
  selectedBuildMode,
  providerUsed,
  selectedBrain,
  diagnostics,
  auditReport,
  envVariables = [],
  runtimeErrors,
  isAutoFixing,
  isAuditing,
  isFixingAudit,
  onAutoFixRuntime,
  onRunFullAudit,
  onAutoFixAudit,
  agentSteps = [],
  agentLogs,
}) => {
  return (
    <div className="space-y-3 select-text">
      {/* 1. Preview Runtime Errors & Auto-Heal */}
      {runtimeErrors.length > 0 && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-red-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Runtime Errors ({runtimeErrors.length})</span>
            </span>
            <button
              onClick={onAutoFixRuntime}
              disabled={isAutoFixing}
              className="px-2.5 py-1 rounded-md bg-red-500 hover:bg-red-400 text-white text-[11px] font-medium flex items-center gap-1 disabled:opacity-60"
            >
              {isAutoFixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
              <span>{isAutoFixing ? 'Fixing...' : 'Auto-Fix'}</span>
            </button>
          </div>
          <div className="space-y-1 font-mono text-[11px] text-red-200 max-h-36 overflow-y-auto">
            {runtimeErrors.map((err, i) => (
              <div key={i}>{err}</div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Full Security, Syntax, Performance & SEO Audit */}
      <div className="p-3 rounded-xl bg-[#1A1B1E] border border-[#2C2D30] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-medium text-white text-xs">
            {auditReport && auditReport.criticalCount > 0 ? (
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            )}
            <span>Full Pre-Launch Audit</span>
          </div>
          <button
            onClick={onRunFullAudit}
            disabled={!hasBuiltApp || isAuditing}
            className="px-2.5 py-1 rounded-md bg-[#252629] hover:bg-[#323438] text-[#E3E3E3] text-[11px] font-medium flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isAuditing ? 'animate-spin' : ''}`} />
            <span>{isAuditing ? 'Scanning...' : 'Run Audit'}</span>
          </button>
        </div>

        {auditReport ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs pt-1 border-t border-[#252629]">
              <span className="text-[#9AA0A6]">Readiness Score</span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  auditReport.score >= 85
                    ? 'text-emerald-400'
                    : auditReport.score >= 60
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {auditReport.score}/100 · {auditReport.passedChecks}/{auditReport.totalChecks} checks
              </span>
            </div>
            <p className="text-[11px] text-[#9AA0A6] leading-relaxed">{auditReport.summary}</p>

            {auditReport.findings.length === 0 ? (
              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/50 text-[11px] text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Zero security, syntax, or readiness blockers detected.</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto chat-scroll-area">
                {auditReport.findings.map((f) => (
                  <div
                    key={f.id}
                    className={`p-2 rounded-lg border text-[11px] space-y-0.5 ${
                      f.severity === 'critical'
                        ? 'bg-red-950/30 border-red-800/60'
                        : f.severity === 'warning'
                        ? 'bg-amber-950/30 border-amber-800/60'
                        : 'bg-[#141517] border-[#2B2D32]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-medium text-white">
                      <span className="truncate">{f.title}</span>
                      <span className="font-mono text-[10px] text-[#9AA0A6] shrink-0">
                        {f.severity} · {f.file}
                      </span>
                    </div>
                    <div className="text-[#B4B7BD]">{f.description}</div>
                    <div className="text-[#8AB4F8] text-[10px]">Fix: {f.fixHint}</div>
                  </div>
                ))}
              </div>
            )}

            {auditReport.findings.length > 0 && (
              <button
                onClick={onAutoFixAudit}
                disabled={isFixingAudit}
                className="w-full py-2 rounded-lg bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#0E0F10] font-medium text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {isFixingAudit ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wrench className="w-3.5 h-3.5" />
                )}
                <span>
                  {isFixingAudit
                    ? 'Remediating Issues...'
                    : `Auto-Fix All (${auditReport.findings.length}) with AI`}
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="text-[11px] text-[#8E918F]">
            {hasBuiltApp
              ? 'Click "Run Audit" to verify security, syntax, accessibility & SEO.'
              : 'Generate a project first to run security & production readiness audits.'}
          </div>
        )}
      </div>

      {/* 3. Detected Environment Variables */}
      {envVariables.length > 0 && (
        <div className="p-3 rounded-xl bg-[#1A1B1E] border border-[#2C2D30] space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium text-white text-xs">
            <KeyRound className="w-3.5 h-3.5 text-[#8AB4F8]" />
            <span>Required Environment Keys (.env.example)</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1 font-mono text-[11px] text-[#C4C7C5]">
            {envVariables.map((env) => (
              <span key={env} className="px-2 py-0.5 rounded bg-[#131416] border border-[#2A2C30]">
                {env}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 4. Build Validation Summary */}
      <div className="p-3 rounded-xl bg-[#1E1F20] border border-[#2C2D30] space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-white text-xs">
          <Terminal className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Build & Sandbox Validation</span>
        </div>
        <div className="text-[11px] text-[#9AA0A6] tabular-nums">
          Mode: {selectedBuildMode} · Brain: {providerUsed || selectedBrain}
        </div>
        {diagnostics && (
          <div className="text-[11px] text-[#C4C7C5] pt-1 space-y-0.5 tabular-nums">
            <div>
              Syntax: {diagnostics.syntaxOk ? 'Passed' : 'Errors'} ·{' '}
              {diagnostics.fileCount} files · {(diagnostics.bundleBytes / 1024).toFixed(1)} KB
            </div>
            {diagnostics.errors.map((err, i) => (
              <div key={i} className="text-red-400 font-mono">{err}</div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Pipeline Trace */}
      {agentSteps.length > 0 && (
        <div className="space-y-1.5">
          {agentSteps.map((step, i) => (
            <div
              key={i}
              className="p-2.5 rounded-lg bg-[#1E1F20] border border-[#2C2D30] text-[11px]"
            >
              <div className="font-medium text-white">{step.phase}: {step.title}</div>
              <div className="text-[#8E918F] mt-0.5">{step.details}</div>
            </div>
          ))}
        </div>
      )}

      {agentLogs.length > 0 && (
        <div className="p-2.5 rounded-lg bg-[#0E0F10] border border-[#252629] font-mono text-[11px] text-[#9AA0A6] space-y-1 max-h-40 overflow-y-auto">
          {agentLogs.map((l, idx) => (
            <div key={idx}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
};
