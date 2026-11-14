export type DocumentCategory =
  | 'report'
  | 'presentation'
  | 'spreadsheet'
  | 'notebook'
  | 'contract'
  | 'technical_prd'
  | 'academic_paper'
  | 'sop_runbook'
  | 'resume_cv'
  | 'marketing_brief'
  | 'executive_memo'
  | 'study_guide';

export type DocumentTone =
  | 'executive'
  | 'technical'
  | 'academic'
  | 'persuasive'
  | 'legal_formal'
  | 'friendly_clear';

export type DocumentLanguage =
  | 'English'
  | 'Sinhala (සිංහල)'
  | 'Singlish'
  | 'Tamil'
  | 'Bilingual (EN + සිංහල)';

export type DocumentLengthPreset =
  | 'one_page_brief'
  | 'standard_report'
  | 'deep_comprehensive';

export type DocumentCitationStyle = 'None' | 'Inline' | 'APA 7' | 'IEEE' | 'MLA' | 'Chicago';

export type DocumentPageSize = 'A4' | 'Letter' | 'Legal';
export type DocumentOrientation = 'portrait' | 'landscape';

export type DocumentVisualTheme =
  | 'executive_obsidian'
  | 'editorial_ivory'
  | 'emerald_sovereign'
  | 'cobalt_architect';

export type DocumentEnhancerMode =
  | 'auto'
  | 'executive_strategy'
  | 'technical_architecture'
  | 'financial_investor'
  | 'legal_compliance'
  | 'academic_research';

export type DocumentEditPreset =
  | 'custom_edit'
  | 'rewrite_clarity'
  | 'expand_depth'
  | 'condense_exec'
  | 'translate_bilingual'
  | 'add_financial_tables'
  | 'convert_slides';

export type DocumentOperationType =
  | 'generate'
  | 'upload'
  | 'text_edit'
  | 'section_rewrite'
  | 'translate'
  | 'manual_save'
  | 'audit_fix'
  | 'audio_overview';

export interface DocumentStructureConfig {
  includeToc: boolean;
  includeExecutiveSummary: boolean;
  includeComparisonTables: boolean;
  includeActionChecklist: boolean;
  includeAppendix: boolean;
}

export interface DocumentBrandingConfig {
  pageSize: DocumentPageSize;
  orientation: DocumentOrientation;
  visualTheme: DocumentVisualTheme;
  companyName: string;
  authorName: string;
  footerNote: string;
}

export interface DocumentDeckConfig {
  slideCount: number;
  includeSpeakerNotes: boolean;
  autoGenerateFinancialGrid: boolean;
}

export interface DocumentAudioConfig {
  autoGenerateOverview: boolean;
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  style: 'Executive Briefing' | 'Two-Host Deep Dive' | 'Study Guide Narration';
}

export interface DocumentConfig {
  mode: 'create' | 'edit';
  category: DocumentCategory;
  model: string;
  enhancerMode: DocumentEnhancerMode;
  editPreset: DocumentEditPreset;
  tone: DocumentTone;
  language: DocumentLanguage;
  audience: string;
  lengthPreset: DocumentLengthPreset;
  citationStyle: DocumentCitationStyle;
  strictSourceGrounding: boolean;
  structure: DocumentStructureConfig;
  branding: DocumentBrandingConfig;
  deck: DocumentDeckConfig;
  audio: DocumentAudioConfig;
  negativePrompt: string;
}

export const DEFAULT_DOCUMENT_CONFIG: DocumentConfig = {
  mode: 'create',
  category: 'report',
  model: 'Gemini 4 Hydrogen Document AI',
  enhancerMode: 'auto',
  editPreset: 'custom_edit',
  tone: 'executive',
  language: 'English',
  audience: 'Executive Leadership & Stakeholders',
  lengthPreset: 'standard_report',
  citationStyle: 'Inline',
  strictSourceGrounding: false,
  structure: {
    includeToc: false,
    includeExecutiveSummary: true,
    includeComparisonTables: true,
    includeActionChecklist: true,
    includeAppendix: false,
  },
  branding: {
    pageSize: 'A4',
    orientation: 'portrait',
    visualTheme: 'executive_obsidian',
    companyName: '',
    authorName: '',
    footerNote: 'Prepared with RaOne Document Studio',
  },
  deck: {
    slideCount: 6,
    includeSpeakerNotes: true,
    autoGenerateFinancialGrid: true,
  },
  audio: {
    autoGenerateOverview: false,
    voiceName: 'Kore',
    style: 'Executive Briefing',
  },
  negativePrompt: 'Avoid vague filler, unsupported statistics, and repetitive boilerplate',
};

export interface DocumentEnhanceBreakdown {
  objective?: string;
  sections?: string[];
  keyTables?: string;
  toneNotes?: string;
}

export interface DocumentAuditIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  area: string;
  description: string;
  suggestedFix: string;
}

export interface DocumentAuditReport {
  auditedAt: string;
  wordCount: number;
  headingCount: number;
  tableCount: number;
  citationCount: number;
  issues: DocumentAuditIssue[];
  autoFixPrompt: string;
}
