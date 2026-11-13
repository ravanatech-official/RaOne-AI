import React, { useState, useEffect } from 'react';
import { X, Check, Sparkles, Zap, ShieldCheck, AlertTriangle } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: 'free' | 'plus' | 'ultimate';
  onPlanChanged: (newPlan: 'free' | 'plus' | 'ultimate') => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  currentPlan = 'free',
  onPlanChanged,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    fetch('/api/user/plan')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (typeof data?.creditsBalance === 'number') {
          setCreditsBalance(data.creditsBalance);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPlan = async (plan: 'free' | 'plus' | 'ultimate') => {
    if (plan === currentPlan) return;
    setIsUpgrading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/user/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        onPlanChanged(plan);
        if (typeof data.creditsBalance === 'number') {
          setCreditsBalance(data.creditsBalance);
        }
        setSuccessMessage(`Successfully switched to ${plan.toUpperCase()} plan!`);
        setTimeout(() => {
          setSuccessMessage(null);
          onClose();
        }, 1500);
      } else {
        setErrorMessage(
          data?.error || 'Paid tier upgrades require verified authentication and billing checkout.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to reach billing service.');
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-5xl bg-[#171717] border border-[#2d2d2d] rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#262626] flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Upgrade your plan</h2>
              {creditsBalance !== null && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                  {creditsBalance} credits available
                </span>
              )}
            </div>
            <p className="text-xs text-[#8e8e8e] mt-0.5">
              Unlock higher limits, sovereign models, and expanded synthesis capabilities.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8e8e8e] hover:text-white hover:bg-[#262626] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success / Error toast banners */}
        {successMessage && (
          <div className="mx-5 mt-2.5 p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in shrink-0">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mx-5 mt-2.5 p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-2 animate-in fade-in shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Billing cycle toggle */}
        <div className="flex justify-center pt-2.5 pb-2 shrink-0">
          <div className="bg-[#212121] p-0.5 rounded-full border border-[#333] flex items-center gap-1 text-xs font-medium">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1 rounded-full transition-all text-xs ${
                billingCycle === 'monthly'
                  ? 'bg-[#333] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white'
              }`}
            >
              Billed monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 text-xs ${
                billingCycle === 'yearly'
                  ? 'bg-[#333] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white'
              }`}
            >
              <span>Billed annually</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/40">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>

        {/* 3 Column Pricing Cards matching ChatGPT (Targeted by CSS Selector 1) */}
        <div className="p-4 sm:p-5 pt-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 flex-1">
          {/* Plan 1: Free */}
          <div className="bg-[#1f1f1f] border border-[#2f2f2f] rounded-xl p-3.5 sm:p-4 flex flex-col justify-between hover:border-[#444] transition-all">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base sm:text-lg font-bold text-white">Free</h3>
              </div>
              <div className="flex items-baseline gap-1 mb-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-white">$0</span>
                <span className="text-[11px] text-[#8e8e8e]">USD / month</span>
              </div>
              <p className="text-[11px] text-[#8e8e8e] leading-snug mb-3">
                Explore how AI can help you with everyday tasks, writing, and logic.
              </p>

              {/* Action Button */}
              <button
                disabled={currentPlan === 'free' || isUpgrading}
                onClick={() => handleSelectPlan('free')}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all mb-3.5 ${
                  currentPlan === 'free'
                    ? 'bg-[#292929] text-[#737373] border border-[#383838] cursor-default'
                    : 'bg-[#2a2a2a] hover:bg-[#333] text-white'
                }`}
              >
                {currentPlan === 'free' ? 'Your current plan' : 'Downgrade to Free'}
              </button>

              {/* Features List */}
              <div className="space-y-1.5 text-[11px] text-[#cccccc]">
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Access to RaOne Flash engine</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Standard response velocity</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Everyday coding, math & writing</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Standard web search grounding</span>
                </div>
              </div>
            </div>
            <div className="pt-2 mt-2.5 border-t border-[#2a2a2a] text-[10px] text-[#777]">
              No credit card required. Free forever.
            </div>
          </div>

          {/* Plan 2: Plus (Popular) */}
          <div className="relative bg-[#212121] border-2 border-amber-500/50 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-[0_0_25px_rgba(245,158,11,0.12)] hover:border-amber-500/80 transition-all">
            {/* Popular Badge */}
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
              <Sparkles className="w-2.5 h-2.5 fill-slate-950" />
              <span>Most Popular</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1 mt-0.5">
                <h3 className="text-base sm:text-lg font-bold text-white">Plus</h3>
              </div>
              <div className="flex items-baseline gap-1 mb-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-white">
                  ${billingCycle === 'yearly' ? '16' : '20'}
                </span>
                <span className="text-[11px] text-[#8e8e8e]">
                  USD / mo {billingCycle === 'yearly' ? '(annual)' : ''}
                </span>
              </div>
              <p className="text-[11px] text-[#8e8e8e] leading-snug mb-3">
                Boost productivity with expanded access, deep reasoning, and studios.
              </p>

              {/* Action Button */}
              <button
                disabled={currentPlan === 'plus' || isUpgrading}
                onClick={() => handleSelectPlan('plus')}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all mb-3.5 ${
                  currentPlan === 'plus'
                    ? 'bg-[#292929] text-[#737373] border border-[#383838] cursor-default'
                    : 'bg-white hover:bg-slate-200 text-slate-950 shadow-md'
                }`}
              >
                {currentPlan === 'plus' ? 'Your current plan' : 'Upgrade to Plus'}
              </button>

              {/* Features List */}
              <div className="space-y-1.5 text-[11px] text-[#cccccc]">
                <div className="text-[10px] font-semibold text-white uppercase tracking-wider">
                  Everything in Free, plus:
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>Extended limits on RaOne Argon reasoning</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>High-speed priority synthesis in peak hours</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>Unlimited high-resolution Image Generation</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>Deep Research with synthesized dossiers</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>Full file attachments & document analysis</span>
                </div>
              </div>
            </div>
            <div className="pt-2 mt-2.5 border-t border-[#2a2a2a] text-[10px] text-[#777]">
              Cancel anytime with 1-click.
            </div>
          </div>

          {/* Plan 3: Ultimate (Maximum Power) */}
          <div className="relative bg-[#1f1f1f] border-2 border-purple-500/50 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-[0_0_30px_rgba(168,85,247,0.15)] hover:border-purple-500/80 transition-all">
            {/* Ultimate Badge */}
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-amber-500 text-white text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
              <Zap className="w-2.5 h-2.5 fill-white" />
              <span>Ultimate Power</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1 mt-0.5">
                <h3 className="text-base sm:text-lg font-bold text-white">Ultimate</h3>
              </div>
              <div className="flex items-baseline gap-1 mb-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-white">
                  ${billingCycle === 'yearly' ? '160' : '200'}
                </span>
                <span className="text-[11px] text-[#8e8e8e]">
                  USD / mo {billingCycle === 'yearly' ? '(annual)' : ''}
                </span>
              </div>
              <p className="text-[11px] text-[#8e8e8e] leading-snug mb-3">
                Maximum intelligence, unlimited flagship models & autonomous synthesis.
              </p>

              {/* Action Button */}
              <button
                disabled={currentPlan === 'ultimate' || isUpgrading}
                onClick={() => handleSelectPlan('ultimate')}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all mb-3.5 ${
                  currentPlan === 'ultimate'
                    ? 'bg-[#292929] text-[#737373] border border-[#383838] cursor-default'
                    : 'bg-gradient-to-r from-purple-500 via-indigo-500 to-amber-500 text-white shadow-md hover:brightness-110'
                }`}
              >
                {currentPlan === 'ultimate' ? 'Your current plan' : 'Upgrade to Ultimate'}
              </button>

              {/* Features List */}
              <div className="space-y-1.5 text-[11px] text-[#cccccc]">
                <div className="text-[10px] font-semibold text-white uppercase tracking-wider">
                  Everything in Plus, and:
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span>Unlimited Argon, Claude 3.5, GPT-4o & DeepSeek R1</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span>Dedicated ultra-high priority compute pipeline</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span>Music generation (Lyria) & Generative video studio</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span>Autonomous agentic execution & multi-step plans</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span>Continuous ultra-low latency voice with memory</span>
                </div>
              </div>
            </div>
            <div className="pt-2 mt-2.5 border-t border-[#2a2a2a] text-[10px] text-[#777]">
              Priority 24/7 dedicated engineering support.
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="py-2.5 px-5 border-t border-[#262626] bg-[#141414] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#737373] gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted sovereign transactions · Instant activation</span>
          </div>
          <span>RaOne AI by RavanaTec — Think. Create. Act.</span>
        </div>
      </div>
    </div>
  );
};
