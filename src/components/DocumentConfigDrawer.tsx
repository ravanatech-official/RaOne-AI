import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileUp,
  RotateCcw,
  Sliders,
  Users,
  Layers,
  BookMarked,
  Palette,
  Presentation,
  Headphones,
  ShieldAlert,
} from 'lucide-react';
import {
  DocumentConfig,
  DocumentCategory,
  DocumentTone,
  DocumentLanguage,
  DocumentLengthPreset,
  DocumentCitationStyle,
  DocumentPageSize,
  DocumentOrientation,
  DocumentVisualTheme,
  DocumentEnhancerMode,
  DEFAULT_DOCUMENT_CONFIG,
} from '../types/index.ts';

interface DocumentConfigDrawerProps {
  config: DocumentConfig;
  onChange: (updater: (prev: DocumentConfig) => DocumentConfig) => void;
  sourceText: string;
  onSourceTextChange: (text: string) => void;
  onTriggerUpload: () => void;
  isUploading?: boolean;
  onResetDefaults: () => void;
}

const CATEGORIES: { id: DocumentCategory; label: string; hint: string }[] = [
  { id: 'report', label: 'Executive Report', hint: 'Boardroom analysis & KPIs' },
  { id: 'presentation', label: 'Slide Deck', hint: 'Structured Gamma-style deck' },
  { id: 'spreadsheet', label: 'Financial Model', hint: 'Multi-table projections' },
  { id: 'notebook', label: 'Notebook Brief', hint: 'Grounded research synthesis' },
  { id: 'contract', label: 'Legal Contract', hint: 'Clauses, SLAs & terms' },
  { id: 'technical_prd', label: 'Technical PRD', hint: 'Specs, API & milestones' },
  { id: 'academic_paper', label: 'Academic Paper', hint: 'Abstract, methods & refs' },
  { id: 'sop_runbook', label: 'SOP / Runbook', hint: 'Step-by-step operations' },
  { id: 'resume_cv', label: 'Resume / CV', hint: 'Impact metrics & skills' },
  { id: 'marketing_brief', label: 'Marketing Brief', hint: 'Positioning & GTM funnel' },
  { id: 'executive_memo', label: 'Executive Memo', hint: 'Crisp decision narrative' },
  { id: 'study_guide', label: 'Study Guide', hint: 'Concepts & self-check Q&A' },
];

const ENHANCER_PROFILES: { id: DocumentEnhancerMode; label: string }[] = [
  { id: 'auto', label: 'Auto (Smart Balanced)' },
  { id: 'executive_strategy', label: 'Executive Strategy & Boardroom' },
  { id: 'technical_architecture', label: 'Technical Architecture & PRD' },
  { id: 'financial_investor', label: 'Financial & Investor Modeling' },
  { id: 'legal_compliance', label: 'Legal & Regulatory Compliance' },
  { id: 'academic_research', label: 'Academic & Deep Research' },
];

const TONES: { id: DocumentTone; label: string }[] = [
  { id: 'executive', label: 'Executive (C-Suite)' },
  { id: 'technical', label: 'Technical (Engineering)' },
  { id: 'academic', label: 'Academic (Peer-Reviewed)' },
  { id: 'persuasive', label: 'Persuasive (Investor Pitch)' },
  { id: 'legal_formal', label: 'Legal Formal (Contractual)' },
  { id: 'friendly_clear', label: 'Clear & Accessible' },
];

const LANGUAGES: DocumentLanguage[] = [
  'English',
  'Sinhala (සිංහල)',
  'Singlish',
  'Tamil',
  'Bilingual (EN + සිංහල)',
];

const LENGTHS: { id: DocumentLengthPreset; label: string; sub: string }[] = [
  { id: 'one_page_brief', label: '1-Page Brief', sub: '~500w' },
  { id: 'standard_report', label: 'Standard', sub: '~1.2Kw' },
  { id: 'deep_comprehensive', label: 'Comprehensive', sub: '2.5Kw+' },
];

const CITATION_STYLES: DocumentCitationStyle[] = [
  'None',
  'Inline',
  'APA 7',
  'IEEE',
  'MLA',
  'Chicago',
];

const VISUAL_THEMES: { id: DocumentVisualTheme; label: string; swatch: string }[] = [
  { id: 'executive_obsidian', label: 'Executive Obsidian', swatch: 'bg-[#1F2937]' },
  { id: 'editorial_ivory', label: 'Editorial Ivory', swatch: 'bg-[#D6CFC2]' },
  { id: 'emerald_sovereign', label: 'Emerald Sovereign', swatch: 'bg-[#065F46]' },
  { id: 'cobalt_architect', label: 'Cobalt Architect', swatch: 'bg-[#1D4ED8]' },
];

type SectionKey =
  | 'category'
  | 'audience'
  | 'structure'
  | 'grounding'
  | 'branding'
  | 'deck'
  | 'audio'
  | 'constraints';

export const DocumentConfigDrawer: React.FC<DocumentConfigDrawerProps> = ({
  config,
  onChange,
  sourceText,
  onSourceTextChange,
  onTriggerUpload,
  isUploading = false,
  onResetDefaults,
}) => {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    category: true,
    audience: true,
    structure: false,
    grounding: false,
    branding: false,
    deck: false,
    audio: false,
    constraints: false,
  });

  const toggle = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const SectionHeader: React.FC<{
    section: SectionKey;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }> = ({ section, title, subtitle, icon }) => {
    const isOpen = openSections[section];
    return (
      <button
        type="button"
        onClick={() => toggle(section)}
        className="w-full flex items-center justify-between py-2.5 px-3 text-left hover:bg-[#1E1F22] transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[#8AB4F8] shrink-0">{icon}</span>
          <div className="min-w-0">
            <div className="text-xs font-medium text-[#E3E3E3] truncate">{title}</div>
            <div className="text-[11px] text-[#8E918F] truncate">{subtitle}</div>
          </div>
        </div>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#8E918F] shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#8E918F] shrink-0" />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-2.5 text-xs">
      {/* Top Action Strip */}
      <div className="flex items-center justify-between pb-2 border-b border-[#252629]">
        <button
          type="button"
          onClick={onTriggerUpload}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] border border-[#35373B] text-xs font-medium text-[#E3E3E3] disabled:opacity-50"
        >
          <FileUp className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>{isUploading ? 'Extracting...' : 'Import Doc / OCR'}</span>
        </button>

        <button
          type="button"
          onClick={onResetDefaults}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] text-[#9AA0A6] hover:text-white hover:bg-[#1E1F20]"
          title="Reset all parameters to defaults"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* 1. Category, Mode & Enhancer */}
      <div className="rounded-xl bg-[#18191C] border border-[#282A2E] overflow-hidden">
        <SectionHeader
          section="category"
          title="1. Category & Mode"
          subtitle={`${config.mode === 'edit' ? 'Edit Mode' : 'Create Mode'} · ${config.category.replace(/_/g, ' ')}`}
          icon={<Sliders className="w-3.5 h-3.5" />}
        />
        {openSections.category && (
          <div className="px-3 pb-3 pt-1 space-y-3 border-t border-[#252629]">
            {/* Create vs Edit */}
            <div className="grid grid-cols-2 gap-1 bg-[#131314] p-1 rounded-lg border border-[#252629]">
              <button
                type="button"
                onClick={() => onChange((p) => ({ ...p, mode: 'create' }))}
                className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                  config.mode === 'create'
                    ? 'bg-[#2B2D30] text-white'
                    : 'text-[#8E918F] hover:text-white'
                }`}
              >
                Create New Doc
              </button>
              <button
                type="button"
                onClick={() => onChange((p) => ({ ...p, mode: 'edit' }))}
                className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                  config.mode === 'edit'
                    ? 'bg-[#2B2D30] text-white'
                    : 'text-[#8E918F] hover:text-white'
                }`}
              >
                Edit Active Doc
              </button>
            </div>

            {/* 12 Categories Grid */}
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1.5">
                Deliverable Category
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {CATEGORIES.map((cat) => {
                  const active = config.category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => onChange((p) => ({ ...p, category: cat.id }))}
                      className={`p-2 rounded-lg border text-left transition-colors ${
                        active
                          ? 'bg-[#2B2D30] border-[#8AB4F8] text-white'
                          : 'bg-[#131314] border-[#282A2E] text-[#C4C7C5] hover:border-[#3E4046]'
                      }`}
                    >
                      <div className="text-[11px] font-medium truncate">{cat.label}</div>
                      <div className="text-[10px] text-[#8E918F] truncate">{cat.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt Enhancer Profile */}
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">
                Prompt Enhancer Profile
              </label>
              <select
                value={config.enhancerMode}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    enhancerMode: e.target.value as DocumentEnhancerMode,
                  }))
                }
                className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
              >
                {ENHANCER_PROFILES.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 2. Audience, Tone & Language */}
      <div className="rounded-xl bg-[#18191C] border border-[#282A2E] overflow-hidden">
        <SectionHeader
          section="audience"
          title="2. Audience, Tone & Language"
          subtitle={`${config.tone.replace(/_/g, ' ')} · ${config.language}`}
          icon={<Users className="w-3.5 h-3.5" />}
        />
        {openSections.audience && (
          <div className="px-3 pb-3 pt-2 space-y-2.5 border-t border-[#252629]">
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">
                Target Reader / Audience
              </label>
              <input
                type="text"
                value={config.audience}
                onChange={(e) => onChange((p) => ({ ...p, audience: e.target.value }))}
                placeholder="e.g., Series A Investors, Engineering Leads"
                className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Voice & Tone</label>
              <select
                value={config.tone}
                onChange={(e) =>
                  onChange((p) => ({ ...p, tone: e.target.value as DocumentTone }))
                }
                className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
              >
                {TONES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">
                Output Language
              </label>
              <div className="grid grid-cols-1 gap-1">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => onChange((p) => ({ ...p, language: lang }))}
                    className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] transition-colors ${
                      config.language === lang
                        ? 'bg-[#2B2D30] border-[#8AB4F8] text-white font-medium'
                        : 'bg-[#131314] border-[#282A2E] text-[#C4C7C5] hover:border-[#3E4046]'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Structure & Length */}
      <div className="rounded-xl bg-[#18191C] border border-[#282A2E] overflow-hidden">
        <SectionHeader
          section="structure"
          title="3. Structure & Length"
          subtitle={`${config.lengthPreset.replace(/_/g, ' ')}`}
          icon={<Layers className="w-3.5 h-3.5" />}
        />
        {openSections.structure && (
          <div className="px-3 pb-3 pt-2 space-y-2.5 border-t border-[#252629]">
            <div className="grid grid-cols-3 gap-1.5">
              {LENGTHS.map((len) => (
                <button
                  key={len.id}
                  type="button"
                  onClick={() => onChange((p) => ({ ...p, lengthPreset: len.id }))}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    config.lengthPreset === len.id
                      ? 'bg-[#2B2D30] border-[#8AB4F8] text-white'
                      : 'bg-[#131314] border-[#282A2E] text-[#C4C7C5]'
                  }`}
                >
                  <div className="text-[11px] font-medium truncate">{len.label}</div>
                  <div className="text-[10px] text-[#8E918F] tabular-nums">{len.sub}</div>
                </button>
              ))}
            </div>

            <div className="space-y-1.5 pt-1">
              {(
                [
                  ['includeToc', 'Table of Contents'],
                  ['includeExecutiveSummary', 'Executive Summary Callout'],
                  ['includeComparisonTables', 'Structured Markdown Tables'],
                  ['includeActionChecklist', 'Actionable Roadmap & Owners'],
                  ['includeAppendix', 'Methodology & Appendix'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#131314] border border-[#252629] cursor-pointer"
                >
                  <span className="text-[11px] text-[#D8DADF]">{label}</span>
                  <input
                    type="checkbox"
                    checked={config.structure[key]}
                    onChange={(e) =>
                      onChange((p) => ({
                        ...p,
                        structure: { ...p.structure, [key]: e.target.checked },
                      }))
                    }
                    className="accent-[#8AB4F8]"
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Citations & Grounding */}
      <div className="rounded-xl bg-[#18191C] border border-[#282A2E] overflow-hidden">
        <SectionHeader
          section="grounding"
          title="4. Grounding & Citations"
          subtitle={`${config.citationStyle}${sourceText.trim() ? ' · Source attached' : ''}`}
          icon={<BookMarked className="w-3.5 h-3.5" />}
        />
        {openSections.grounding && (
          <div className="px-3 pb-3 pt-2 space-y-2.5 border-t border-[#252629]">
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">
                Citation Standard
              </label>
              <select
                value={config.citationStyle}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    citationStyle: e.target.value as DocumentCitationStyle,
                  }))
                }
                className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                {CITATION_STYLES.map((cs) => (
                  <option key={cs} value={cs}>
                    {cs}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center justify-between p-2 rounded-lg bg-[#131314] border border-[#252629] cursor-pointer">
              <span className="text-[11px] text-[#D8DADF]">
                Strict Source-Only Grounding
              </span>
              <input
                type="checkbox"
                checked={config.strictSourceGrounding}
                onChange={(e) =>
                  onChange((p) => ({ ...p, strictSourceGrounding: e.target.checked }))
                }
                className="accent-[#8AB4F8]"
              />
            </label>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-[#9AA0A6]">
                  Reference Facts / Source Text
                </label>
                {sourceText.trim() && (
                  <button
                    type="button"
                    onClick={() => onSourceTextChange('')}
                    className="text-[10px] text-[#9AA0A6] hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>
              <textarea
                rows={4}
                value={sourceText}
                onChange={(e) => onSourceTextChange(e.target.value)}
                placeholder="Paste raw metrics, interview notes, or legal clauses to ground claims..."
                className="w-full bg-[#131314] border border-[#2F3135] rounded-lg p-2 text-[11px] text-[#E3E3E3] focus:outline-none resize-none font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. Layout, Visual Theme & Branding */}
      <div className="rounded-xl bg-[#18191C] border border-[#282A2E] overflow-hidden">
        <SectionHeader
          section="branding"
          title="5. Layout & Branding"
          subtitle={`${config.branding.pageSize} ${config.branding.orientation} · ${config.branding.visualTheme.replace(/_/g, ' ')}`}
          icon={<Palette className="w-3.5 h-3.5" />}
        />
        {openSections.branding && (
          <div className="px-3 pb-3 pt-2 space-y-2.5 border-t border-[#252629]">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Page Size</label>
                <select
                  value={config.branding.pageSize}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      branding: { ...p.branding, pageSize: e.target.value as DocumentPageSize },
                    }))
                  }
                  className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="A4">A4 (International)</option>
                  <option value="Letter">US Letter</option>
                  <option value="Legal">US Legal</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Orientation</label>
                <select
                  value={config.branding.orientation}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      branding: {
                        ...p.branding,
                        orientation: e.target.value as DocumentOrientation,
                      },
                    }))
                  }
                  className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">
                Visual Theme (PPTX & PDF)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {VISUAL_THEMES.map((vt) => (
                  <button
                    key={vt.id}
                    type="button"
                    onClick={() =>
                      onChange((p) => ({
                        ...p,
                        branding: { ...p.branding, visualTheme: vt.id },
                      }))
                    }
                    className={`p-2 rounded-lg border flex items-center gap-2 text-left text-[11px] ${
                      config.branding.visualTheme === vt.id
                        ? 'bg-[#2B2D30] border-[#8AB4F8] text-white'
                        : 'bg-[#131314] border-[#282A2E] text-[#C4C7C5]'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-sm shrink-0 ${vt.swatch}`} />
                    <span className="truncate">{vt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={config.branding.companyName}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    branding: { ...p.branding, companyName: e.target.value },
                  }))
                }
                placeholder="Organization / Brand"
                className="bg-[#131314] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
              <input
                type="text"
                value={config.branding.authorName}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    branding: { ...p.branding, authorName: e.target.value },
                  }))
                }
                placeholder="Author / Prepared By"
                className="bg-[#131314] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>

            <input
              type="text"
              value={config.branding.footerNote}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  branding: { ...p.branding, footerNote: e.target.value },
                }))
              }
              placeholder="Document Footer Note"
              className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* 6. Deck & Financial Grid Options */}
      <div className="rounded-xl bg-[#18191C] border border-[#282A2E] overflow-hidden">
        <SectionHeader
          section="deck"
          title="6. Slides & Financial Grid"
          subtitle={`${config.deck.slideCount} slides · Speaker notes ${config.deck.includeSpeakerNotes ? 'on' : 'off'}`}
          icon={<Presentation className="w-3.5 h-3.5" />}
        />
        {openSections.deck && (
          <div className="px-3 pb-3 pt-2 space-y-2.5 border-t border-[#252629]">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#9AA0A6]">Presentation Slide Count</span>
                <span className="font-mono text-white tabular-nums">{config.deck.slideCount}</span>
              </div>
              <input
                type="range"
                min={4}
                max={16}
                value={config.deck.slideCount}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    deck: { ...p.deck, slideCount: Number(e.target.value) },
                  }))
                }
                className="w-full accent-[#8AB4F8]"
              />
            </div>

            <label className="flex items-center justify-between p-2 rounded-lg bg-[#131314] border border-[#252629] cursor-pointer">
              <span className="text-[11px] text-[#D8DADF]">Include Presenter Speaker Notes</span>
              <input
                type="checkbox"
                checked={config.deck.includeSpeakerNotes}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    deck: { ...p.deck, includeSpeakerNotes: e.target.checked },
                  }))
                }
                className="accent-[#8AB4F8]"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-[#131314] border border-[#252629] cursor-pointer">
              <span className="text-[11px] text-[#D8DADF]">Auto-Generate Financial / KPI Grid</span>
              <input
                type="checkbox"
                checked={config.deck.autoGenerateFinancialGrid}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    deck: { ...p.deck, autoGenerateFinancialGrid: e.target.checked },
                  }))
                }
                className="accent-[#8AB4F8]"
              />
            </label>
          </div>
        )}
      </div>

      {/* 7. Audio Podcast Overview (TTS) */}
      <div className="rounded-xl bg-[#18191C] border border-[#282A2E] overflow-hidden">
        <SectionHeader
          section="audio"
          title="7. Audio Podcast Overview"
          subtitle={`${config.audio.autoGenerateOverview ? 'Auto MP3' : 'Manual MP3'} · ${config.audio.voiceName}`}
          icon={<Headphones className="w-3.5 h-3.5" />}
        />
        {openSections.audio && (
          <div className="px-3 pb-3 pt-2 space-y-2.5 border-t border-[#252629]">
            <label className="flex items-center justify-between p-2 rounded-lg bg-[#131314] border border-[#252629] cursor-pointer">
              <span className="text-[11px] text-[#D8DADF]">Auto-Synthesize MP3 Overview</span>
              <input
                type="checkbox"
                checked={config.audio.autoGenerateOverview}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    audio: { ...p.audio, autoGenerateOverview: e.target.checked },
                  }))
                }
                className="accent-[#8AB4F8]"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">TTS Voice</label>
                <select
                  value={config.audio.voiceName}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      audio: {
                        ...p.audio,
                        voiceName: e.target.value as DocumentConfig['audio']['voiceName'],
                      },
                    }))
                  }
                  className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="Kore">Kore (Balanced)</option>
                  <option value="Puck">Puck (Energetic)</option>
                  <option value="Charon">Charon (Deep)</option>
                  <option value="Fenrir">Fenrir (Crisp)</option>
                  <option value="Zephyr">Zephyr (Warm)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Format Style</label>
                <select
                  value={config.audio.style}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      audio: {
                        ...p.audio,
                        style: e.target.value as DocumentConfig['audio']['style'],
                      },
                    }))
                  }
                  className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="Executive Briefing">Executive Briefing</option>
                  <option value="Two-Host Deep Dive">Deep Dive</option>
                  <option value="Study Guide Narration">Study Guide</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 8. Negative Constraints */}
      <div className="rounded-xl bg-[#18191C] border border-[#282A2E] overflow-hidden">
        <SectionHeader
          section="constraints"
          title="8. Guardrails & Constraints"
          subtitle="Anti-filler & negative directives"
          icon={<ShieldAlert className="w-3.5 h-3.5" />}
        />
        {openSections.constraints && (
          <div className="px-3 pb-3 pt-2 space-y-2 border-t border-[#252629]">
            <textarea
              rows={3}
              value={config.negativePrompt}
              onChange={(e) => onChange((p) => ({ ...p, negativePrompt: e.target.value }))}
              placeholder={DEFAULT_DOCUMENT_CONFIG.negativePrompt}
              className="w-full bg-[#131314] border border-[#2F3135] rounded-lg p-2 text-[11px] text-[#E3E3E3] focus:outline-none resize-none"
            />
          </div>
        )}
      </div>
    </div>
  );
};
