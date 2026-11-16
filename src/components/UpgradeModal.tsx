import React, { useState, useEffect } from 'react';
import { X, Check, Sparkles, Zap, ShieldCheck, AlertTriangle, Coins, KeyRound } from 'lucide-react';
import {
  PRICING_PLANS,
  TOPUP_PACKS,
  CREDIT_COSTS,
  type PlanId,
  type TopUpPack,
} from '../lib/pricingCatalog.ts';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: PlanId;
  onPlanChanged: (newPlan: PlanId) => void;
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
  const [checkoutConfigured, setCheckoutConfigured] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    Promise.all([
      fetch('/api/user/plan').then((res) => (res.ok ? res.json() : null)).catch(() => null),
      fetch('/api/billing/catalog').then((res) => (res.ok ? res.json() : null)).catch(() => null),
    ]).then(([planData, catalogData]) => {
      if (typeof planData?.creditsBalance === 'number') {
        setCreditsBalance(planData.creditsBalance);
      }
      if (typeof catalogData?.checkoutConfigured === 'boolean') {
        setCheckoutConfigured(catalogData.checkoutConfigured);
      }
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPlan = async (plan: PlanId) => {
    if (plan === currentPlan) return;
    setIsUpgrading(true);
    setErrorMessage(null);

    try {
      if (plan === 'free') {
        const response = await fetch('/api/user/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: 'free', billingCycle }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success) {
          onPlanChanged('free');
          setSuccessMessage('Switched to Free plan cleanly.');
          setTimeout(() => {
            setSuccessMessage(null);
            onClose();
          }, 1400);
        } else {
          setErrorMessage(data?.error || 'Could not update plan.');
        }
        return;
      }

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }

      setErrorMessage(
        data?.error ||
          'Payment checkout URL is not yet linked on this deployment. Add your own free BYOK keys in Settings for unlimited 0-credit studio access!'
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to reach billing service.');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleBuyTopUp = async (pack: TopUpPack) => {
    setIsUpgrading(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pack.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      setErrorMessage(
        data?.error ||
          `Top-up link for ${pack.name} ($${pack.priceUsd}) is not configured yet. Connect Polar or LemonSqueezy checkout URLs in Cloud Run env.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to initiate top-up checkout.');
    } finally {
      setIsUpgrading(false);
    }
  };

  const freePlan = PRICING_PLANS.free;
  const plusPlan = PRICING_PLANS.plus;
  const ultimatePlan = PRICING_PLANS.ultimate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-5xl bg-[#171717] border border-[#2d2d2d] rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#262626] flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Plans &amp; Credit Packs</h2>
              {creditsBalance !== null && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                  {creditsBalance.toLocaleString()} credits available
                </span>
              )}
            </div>
            <p className="text-xs text-[#8e8e8e] mt-0.5">
              5 AI Studios in one workspace — priced up to 70% below separate AI subscriptions, or 0 credits with BYOK.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8e8e8e] hover:text-white hover:bg-[#262626] transition-colors"
            aria-label="Close upgrade modal"
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

        <div className="flex-1 overflow-y-auto chat-scroll-area">
          {/* Billing cycle toggle */}
          <div className="flex justify-center pt-3 pb-2">
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
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/40">
                  SAVE 17%
                </span>
              </button>
            </div>
          </div>

          {/* 3 Column Pricing Cards */}
          <div className="px-4 sm:px-5 pb-4 pt-1 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {/* Plan 1: Free */}
            <div className="bg-[#1f1f1f] border border-[#2f2f2f] rounded-xl p-4 flex flex-col justify-between hover:border-[#444] transition-all">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base sm:text-lg font-bold text-white">{freePlan.name}</h3>
                  <span className="text-[10px] font-mono text-[#9ca3af]">{freePlan.monthlyCredits} cr/mo</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">${freePlan.monthlyPriceUsd}</span>
                  <span className="text-[11px] text-[#8e8e8e]">USD / month</span>
                </div>
                <p className="text-[11px] text-[#8e8e8e] leading-snug mb-3">{freePlan.tagline}</p>

                <button
                  disabled={currentPlan === 'free' || isUpgrading}
                  onClick={() => handleSelectPlan('free')}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all mb-3.5 ${
                    currentPlan === 'free'
                      ? 'bg-[#292929] text-[#737373] border border-[#383838] cursor-default'
                      : 'bg-[#2a2a2a] hover:bg-[#333] text-white'
                  }`}
                >
                  {currentPlan === 'free' ? 'Your current plan' : 'Switch to Free'}
                </button>

                <div className="space-y-1.5 text-[11px] text-[#cccccc]">
                  {freePlan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2.5 mt-3 border-t border-[#2a2a2a] text-[10px] text-[#777]">
                {freePlan.footerNote}
              </div>
            </div>

            {/* Plan 2: Plus (Popular) */}
            <div className="relative bg-[#212121] border-2 border-amber-500/50 rounded-xl p-4 flex flex-col justify-between shadow-[0_0_25px_rgba(245,158,11,0.12)] hover:border-amber-500/80 transition-all">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
                <Sparkles className="w-2.5 h-2.5 fill-slate-950" />
                <span>{plusPlan.badge || 'Most Popular'}</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1 mt-0.5">
                  <h3 className="text-base sm:text-lg font-bold text-white">{plusPlan.name}</h3>
                  <span className="text-[10px] font-mono text-amber-300">
                    {plusPlan.monthlyCredits.toLocaleString()} cr/mo
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">
                    ${billingCycle === 'yearly' ? plusPlan.annualMonthlyPriceUsd : plusPlan.monthlyPriceUsd}
                  </span>
                  <span className="text-[11px] text-[#8e8e8e]">
                    USD / mo {billingCycle === 'yearly' ? `($${plusPlan.annualTotalUsd}/yr)` : ''}
                  </span>
                </div>
                <p className="text-[11px] text-[#8e8e8e] leading-snug mb-3">{plusPlan.tagline}</p>

                <button
                  disabled={currentPlan === 'plus' || isUpgrading}
                  onClick={() => handleSelectPlan('plus')}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all mb-3.5 ${
                    currentPlan === 'plus'
                      ? 'bg-[#292929] text-[#737373] border border-[#383838] cursor-default'
                      : 'bg-white hover:bg-slate-200 text-slate-950 shadow-md'
                  }`}
                >
                  {currentPlan === 'plus'
                    ? 'Your current plan'
                    : checkoutConfigured
                    ? 'Upgrade to Plus'
                    : 'Upgrade to Plus (Checkout Pending)'}
                </button>

                <div className="space-y-1.5 text-[11px] text-[#cccccc]">
                  <div className="text-[10px] font-semibold text-white uppercase tracking-wider">
                    Everything in Free, plus:
                  </div>
                  {plusPlan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2.5 mt-3 border-t border-[#2a2a2a] text-[10px] text-[#777]">
                {plusPlan.footerNote}
              </div>
            </div>

            {/* Plan 3: Ultimate (Best Value Pro) */}
            <div className="relative bg-[#1f1f1f] border-2 border-purple-500/50 rounded-xl p-4 flex flex-col justify-between shadow-[0_0_30px_rgba(168,85,247,0.15)] hover:border-purple-500/80 transition-all">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-amber-500 text-white text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
                <Zap className="w-2.5 h-2.5 fill-white" />
                <span>{ultimatePlan.badge || 'Best Value Pro'}</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1 mt-0.5">
                  <h3 className="text-base sm:text-lg font-bold text-white">{ultimatePlan.name}</h3>
                  <span className="text-[10px] font-mono text-purple-300">
                    {ultimatePlan.monthlyCredits.toLocaleString()} cr/mo
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">
                    ${billingCycle === 'yearly' ? ultimatePlan.annualMonthlyPriceUsd : ultimatePlan.monthlyPriceUsd}
                  </span>
                  <span className="text-[11px] text-[#8e8e8e]">
                    USD / mo {billingCycle === 'yearly' ? `($${ultimatePlan.annualTotalUsd}/yr)` : ''}
                  </span>
                </div>
                <p className="text-[11px] text-[#8e8e8e] leading-snug mb-3">{ultimatePlan.tagline}</p>

                <button
                  disabled={currentPlan === 'ultimate' || isUpgrading}
                  onClick={() => handleSelectPlan('ultimate')}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all mb-3.5 ${
                    currentPlan === 'ultimate'
                      ? 'bg-[#292929] text-[#737373] border border-[#383838] cursor-default'
                      : 'bg-gradient-to-r from-purple-500 via-indigo-500 to-amber-500 text-white shadow-md hover:brightness-110'
                  }`}
                >
                  {currentPlan === 'ultimate'
                    ? 'Your current plan'
                    : checkoutConfigured
                    ? 'Upgrade to Ultimate'
                    : 'Upgrade to Ultimate (Checkout Pending)'}
                </button>

                <div className="space-y-1.5 text-[11px] text-[#cccccc]">
                  <div className="text-[10px] font-semibold text-white uppercase tracking-wider">
                    Everything in Plus, and:
                  </div>
                  {ultimatePlan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2.5 mt-3 border-t border-[#2a2a2a] text-[10px] text-[#777]">
                {ultimatePlan.footerNote}
              </div>
            </div>
          </div>

          {/* Credit Top-Ups & BYOK Zero-Credit Note */}
          <div className="px-4 sm:px-5 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-[#2b2b2b] flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-white">One-Time Credit Top-Ups</span>
                </div>
                <span className="text-[10px] text-[#8e8e8e]">
                  1K img {CREDIT_COSTS.vision1K} cr · Song {CREDIT_COSTS.musicFull} cr · Video {CREDIT_COSTS.cinemaStandard} cr
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TOPUP_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    disabled={isUpgrading}
                    onClick={() => handleBuyTopUp(pack)}
                    className="p-2.5 rounded-lg bg-[#242424] hover:bg-[#2d2d2d] border border-[#353535] text-left transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">
                        {pack.credits.toLocaleString()} credits
                      </div>
                      <div className="text-[10px] text-[#8e8e8e]">{pack.name}</div>
                    </div>
                    <span className="text-xs font-bold text-amber-300">${pack.priceUsd}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#161f1b] border border-emerald-500/25 flex items-start gap-3">
              <KeyRound className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-xs font-semibold text-white">0-Credit BYOK Vault Support</div>
                <p className="text-[11px] text-[#a7b3ad] leading-relaxed">
                  Add your own free Groq, OpenRouter, Hugging Face, Cloudflare Workers AI, or Gemini/fal.ai keys inside{' '}
                  <strong className="text-white">Settings → API Keys</strong>. When using your own provider key, RaOne charges{' '}
                  <strong className="text-emerald-300">0 workspace credits</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="py-2.5 px-5 border-t border-[#262626] bg-[#141414] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#737373] gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted sovereign transactions · Webhook-verified activation</span>
          </div>
          <span>RaOne AI by RavanaTec — Think. Create. Act.</span>
        </div>
      </div>
    </div>
  );
};
