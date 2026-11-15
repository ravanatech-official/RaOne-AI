import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Request, Response } from 'express';
import { GoogleGenAI, Modality } from '@google/genai';
import { callGroqChat } from './server_groq_service.ts';
import { getActiveLocalEndpointConfig, callLocalLlmChat } from './server_local_llm.ts';
import { extractTextFromUploadedBase64 } from './server_uploads.ts';
import { SYSTEM_PROMPT, appendRuntimeMetadata } from './src/lib/systemPrompts.ts';
import type { ByokKeyMap } from './server_tenant_store.ts';
import {
  getMediaStorageProvider,
  inferMimeFromFilename,
  normalizeSafeAssetFilename,
  resolveLocalMediaFilePath,
} from './server_cloud_persistence.ts';
import {
  DEFAULT_DOCUMENT_CONFIG,
  type DocumentAuditIssue,
  type DocumentAuditReport,
  type DocumentCategory,
  type DocumentConfig,
  type DocumentEditPreset,
  type DocumentEnhanceBreakdown,
  type DocumentEnhancerMode,
} from './src/types/document.ts';
import type { DocumentCitation, DocumentItem, DocumentSlide, GraphEntityNode } from './src/types/index.ts';

const execFileAsync = promisify(execFile);

export interface DocumentPublishedSnapshot {
  shareId: string;
  tenantId: string;
  docId: string;
  title: string;
  summary: string;
  content: string;
  docType: string;
  companyName: string;
  footerNote: string;
  audioFilename?: string;
  publishedAt: string;
}

function safeSegment(value: string): string {
  return String(value || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 96);
}

export function resolveTenantDocAssetPath(tenantId: string, filename: string): string | null {
  return resolveLocalMediaFilePath(tenantId, 'documents', filename);
}

export async function saveTenantDocAssetBuffer(
  tenantId: string,
  baseId: string,
  ext: 'mp3' | 'wav' | 'md' | 'html' | 'docx' | 'pdf' | 'pptx' | 'xlsx',
  buffer: Buffer
): Promise<{ filename: string; filePath: string; url: string }> {
  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 8);
  const filename = `${safeSegment(baseId)}_${hash}.${ext}`;
  const mimeType = inferMimeFromFilename(filename);
  const meta = await getMediaStorageProvider().saveBuffer({
    tenantId,
    category: 'documents',
    filename,
    buffer,
    mimeType,
    originalName: filename,
  });
  return {
    filename,
    filePath: meta.objectPath,
    url: `/api/documents/assets/${encodeURIComponent(filename)}`,
  };
}

export async function readTenantDocAssetBuffer(
  tenantId: string,
  filename: string
): Promise<Buffer | null> {
  const clean = normalizeSafeAssetFilename(filename);
  if (!clean) return null;
  return getMediaStorageProvider().readBuffer(tenantId, 'documents', clean);
}

export async function streamDocAssetByFilename(
  req: Request,
  res: Response,
  tenantId: string,
  filename: string
): Promise<boolean> {
  const clean = normalizeSafeAssetFilename(filename);
  if (!clean) return false;
  return getMediaStorageProvider().streamHttpResponse(
    req,
    res,
    tenantId,
    'documents',
    clean,
    inferMimeFromFilename(clean, 'audio/mpeg')
  );
}

export async function deleteTenantDocAssets(
  tenantId: string,
  filenames: Array<string | undefined | null>
): Promise<void> {
  const media = getMediaStorageProvider();
  for (const name of filenames) {
    if (!name) continue;
    const clean = normalizeSafeAssetFilename(name);
    if (clean) {
      await media.deleteAsset(tenantId, 'documents', clean).catch(() => {});
    }
  }
}

export function streamDocAssetWithRange(req: Request, res: Response, filePath: string): void {
  const contentType = inferMimeFromFilename(filePath, 'audio/mpeg');
  const stat = fs.statSync(filePath);
  const totalSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match) {
      const start = Math.min(Number(match[1]), Math.max(0, totalSize - 1));
      const requestedEnd = match[2] ? Number(match[2]) : totalSize - 1;
      const end = Math.min(requestedEnd, Math.max(0, totalSize - 1));
      if (start <= end && totalSize > 0) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Content-Length', String(end - start + 1));
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }
  }

  res.setHeader('Content-Length', String(totalSize));
  fs.createReadStream(filePath).pipe(res);
}

export function normalizeDocumentConfig(raw?: Partial<DocumentConfig> | null): DocumentConfig {
  return {
    ...DEFAULT_DOCUMENT_CONFIG,
    ...(raw || {}),
    structure: { ...DEFAULT_DOCUMENT_CONFIG.structure, ...(raw?.structure || {}) },
    branding: { ...DEFAULT_DOCUMENT_CONFIG.branding, ...(raw?.branding || {}) },
    deck: { ...DEFAULT_DOCUMENT_CONFIG.deck, ...(raw?.deck || {}) },
    audio: { ...DEFAULT_DOCUMENT_CONFIG.audio, ...(raw?.audio || {}) },
  };
}

export function mapCategoryToLegacyDocType(
  cat: DocumentCategory
): 'report' | 'presentation' | 'spreadsheet' | 'notebook' | 'summary' {
  if (cat === 'presentation') return 'presentation';
  if (cat === 'spreadsheet') return 'spreadsheet';
  if (cat === 'notebook' || cat === 'study_guide') return 'notebook';
  if (cat === 'executive_memo') return 'summary';
  return 'report';
}

export async function runTextLlmJsonOrText(params: {
  prompt: string;
  systemPrompt: string;
  geminiClient: GoogleGenAI | null;
  byok: ByokKeyMap;
  fallbackGroqKey?: string;
  expectJson?: boolean;
}): Promise<{ text: string; providerUsed: string }> {
  if (params.geminiClient) {
    try {
      const response = await params.geminiClient.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
        config: {
          ...(params.expectJson ? { responseMimeType: 'application/json' } : {}),
          systemInstruction: appendRuntimeMetadata(SYSTEM_PROMPT, {
            provider: 'Google Gemini API',
            model: 'gemini-4-hydrogen',
            subsystem: 'RaOne Document Studio',
          }) + `\n\n${params.systemPrompt}`,
        },
      });
      const text = (response.text || '').trim();
      if (text) return { text, providerUsed: 'Gemini 4 Hydrogen' };
    } catch (err: any) {
      console.warn('Doc Studio Gemini call warning:', err?.message || err);
    }
  }

  const groqKey = params.byok?.groqApiKey || params.fallbackGroqKey;
  if (groqKey) {
    try {
      const res = await callGroqChat(
        groqKey,
        'raone-llama3-70b',
        [{ role: 'user', content: params.prompt }],
        `${SYSTEM_PROMPT}\n\n${params.systemPrompt}`,
        4096
      );
      const text = (res.text || '').trim();
      if (text) return { text, providerUsed: res.modelUsed || 'Groq' };
    } catch (err: any) {
      console.warn('Doc Studio Groq call warning:', err?.message || err);
    }
  }

  const localCfg = getActiveLocalEndpointConfig(params.byok || {});
  if (localCfg) {
    try {
      const res = await callLocalLlmChat({
        baseUrl: localCfg.baseUrl,
        modelId: localCfg.modelId,
        apiKey: localCfg.apiKey,
        messages: [],
        prompt: params.prompt,
        systemPrompt: `${SYSTEM_PROMPT}\n\n${params.systemPrompt}`,
      });
      const text = (res.text || '').trim();
      if (text) return { text, providerUsed: localCfg.modelId || 'Local LLM' };
    } catch {
      // fall through
    }
  }

  throw new Error('No AI provider responded for Document Studio.');
}

function parseJsonSafe<T = any>(rawText: string): T | null {
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const match = /\{[\s\S]*\}/.exec(cleaned);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

export async function enhanceDocumentPromptServer(params: {
  prompt: string;
  enhancerMode?: DocumentEnhancerMode;
  config?: DocumentConfig;
  geminiClient: GoogleGenAI | null;
  byok: ByokKeyMap;
  fallbackGroqKey?: string;
}): Promise<{
  enhancedPrompt: string;
  suggestedTitle: string;
  suggestedCategory: DocumentCategory;
  suggestedTone: DocumentConfig['tone'];
  suggestedTags: string[];
  suggestedNegativePrompt: string;
  providerUsed: string;
  breakdown: DocumentEnhanceBreakdown;
}> {
  const cfg = normalizeDocumentConfig(params.config);
  const mode = params.enhancerMode || cfg.enhancerMode || 'auto';
  const cleanPrompt = String(params.prompt || '').trim();

  const profiles: Record<DocumentEnhancerMode, string> = {
    auto: 'Balanced Fortune-500 strategist adapting depth, tables, and visual structure automatically.',
    executive_strategy: 'McKinsey/BCG C-suite strategic memo with clear KPIs, risk matrices, and quarterly roadmap.',
    technical_architecture: 'Senior Principal Engineer PRD/RFC with system architecture tables, API specs, SLAs, and edge cases.',
    financial_investor: 'Investment banking financial brief with unit economics, sensitivity table, ARR projections, and use-of-funds.',
    legal_compliance: 'Corporate legal counsel clarity with numbered clauses, obligations, definitions, and SLA governance.',
    academic_research: 'Peer-reviewed structured paper with abstract, methodology, comparative tables, citations, and conclusions.',
  };

  const sys = `You are a Principal Document Architect.
Expand even a 2-word user idea into a comprehensive, production-grade document directive.
Context:
- Profile: ${profiles[mode]}
- Target Output Language: ${cfg.language}
- Audience: ${cfg.audience}

Return STRICT VALID JSON with keys:
{
  "enhancedPrompt": "detailed 2-4 sentence prompt specifying sections, financial/comparison tables, analytical depth, and deliverable structure",
  "suggestedTitle": "clean executive document title (3-7 words)",
  "suggestedCategory": "report|presentation|spreadsheet|notebook|contract|technical_prd|academic_paper|sop_runbook|resume_cv|marketing_brief|executive_memo|study_guide",
  "suggestedTone": "executive|technical|academic|persuasive|legal_formal|friendly_clear",
  "suggestedTags": ["Tag1", "Tag2", "Tag3"],
  "suggestedNegativePrompt": "concise things to exclude",
  "breakdown": {
    "objective": "...",
    "sections": ["Section 1", "Section 2", "Section 3", "Section 4"],
    "keyTables": "...",
    "toneNotes": "..."
  }
}`;

  try {
    const res = await runTextLlmJsonOrText({
      prompt: `User short document seed: "${cleanPrompt}"\nOutput strictly valid JSON.`,
      systemPrompt: sys,
      geminiClient: params.geminiClient,
      byok: params.byok,
      fallbackGroqKey: params.fallbackGroqKey,
      expectJson: true,
    });
    const parsed = parseJsonSafe<any>(res.text);
    if (parsed?.enhancedPrompt) {
      return {
        enhancedPrompt: String(parsed.enhancedPrompt).trim(),
        suggestedTitle: String(parsed.suggestedTitle || cleanPrompt).trim().slice(0, 80),
        suggestedCategory: (parsed.suggestedCategory || cfg.category) as DocumentCategory,
        suggestedTone: parsed.suggestedTone || cfg.tone,
        suggestedTags: Array.isArray(parsed.suggestedTags)
          ? parsed.suggestedTags.map((x: any) => String(x).trim()).filter(Boolean)
          : [cfg.category, cfg.tone],
        suggestedNegativePrompt: String(parsed.suggestedNegativePrompt || cfg.negativePrompt).trim(),
        providerUsed: res.providerUsed,
        breakdown: (parsed.breakdown || {}) as DocumentEnhanceBreakdown,
      };
    }
  } catch {
    // fallback below
  }

  return {
    enhancedPrompt: `Create a comprehensive ${cfg.category.replace(/_/g, ' ')} on "${cleanPrompt}" tailored for ${cfg.audience} in ${cfg.language}. Include an executive summary, clearly numbered structured sections, Markdown comparison and KPI tables, actionable risk mitigation steps, and a concrete implementation timeline.`,
    suggestedTitle:
      cleanPrompt
        .split(/\s+/)
        .slice(0, 6)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') || 'Executive Document Brief',
    suggestedCategory: cfg.category,
    suggestedTone: cfg.tone,
    suggestedTags: [cfg.category.toUpperCase(), cfg.tone, cfg.language],
    suggestedNegativePrompt: cfg.negativePrompt,
    providerUsed: 'RaOne Deterministic Document Architect',
    breakdown: {
      objective: `Deliver complete structured ${cfg.category} on "${cleanPrompt}"`,
      sections: ['Executive Summary', 'Core Analysis & Framework', 'Data & Metrics Table', 'Execution Roadmap'],
      keyTables: 'KPI Benchmarks & Action Matrix',
      toneNotes: `${cfg.tone} tone in ${cfg.language}`,
    },
  };
}

export function compileDocumentPrompt(params: {
  prompt: string;
  config: DocumentConfig;
  sourceText?: string;
}): string {
  const { config: cfg } = params;
  const lenGuide =
    cfg.lengthPreset === 'one_page_brief'
      ? 'Concise 1-page high-density executive brief (~400-600 words)'
      : cfg.lengthPreset === 'deep_comprehensive'
      ? 'Comprehensive deep-dive multi-section dossier (~1600-2400 words)'
      : 'Well-balanced standard 3-5 page document (~900-1300 words)';

  const structuralDirectives = [
    cfg.structure.includeToc ? 'Include a clickable-style Table of Contents at the top.' : '',
    cfg.structure.includeExecutiveSummary ? 'Start with a crisp Executive Summary.' : '',
    cfg.structure.includeComparisonTables ? 'Include well-formatted Markdown tables (`| Col | Col |`) with realistic structured columns.' : '',
    cfg.structure.includeActionChecklist ? 'End with an actionable checklist / next steps with owners and timelines.' : '',
    cfg.structure.includeAppendix ? 'Include an Appendix section with glossary and assumptions.' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const sourceBlock = params.sourceText?.trim()
    ? `\nSource Grounding Material (Cite ONLY facts actually present in this text; do NOT fabricate external quotes):\n"""\n${params.sourceText.trim().slice(0, 24000)}\n"""\nCitation Format: ${cfg.citationStyle}. Strict Source Grounding: ${cfg.strictSourceGrounding ? 'YES — only state claims verifiable from source material.' : 'Assisted synthesis permitted.'}`
    : '\nNo external uploaded source supplied: leave citations array empty `[]` (or list verified internal references only).';

  return `You are an elite Document Strategist & Technical Author.
Generate a complete ${cfg.category.replace(/_/g, ' ').toUpperCase()} based on the user's request:
Prompt: "${params.prompt}"

Configuration:
- Target Language: ${cfg.language}
- Tone & Voice: ${cfg.tone}
- Target Audience: ${cfg.audience}
- Length Target: ${lenGuide}
- Organization / Author Context: ${cfg.branding.companyName || 'Independent'} / ${cfg.branding.authorName || 'Author'}
- Structure Requirements: ${structuralDirectives}
- Presentation Slides to Generate: ${cfg.deck.slideCount} slides (${cfg.deck.includeSpeakerNotes ? 'include concise speakerNotes per slide' : 'skip speakerNotes'})
- Constraints / Avoid: ${cfg.negativePrompt || 'None'}
${sourceBlock}

Respond strictly in valid JSON matching:
{
  "title": "Document Title",
  "summary": "2-3 sentence executive summary",
  "content": "Full well-structured Markdown content using # ## ### headings, tables, and lists",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide Headline",
      "subtitle": "Sub-headline",
      "bulletPoints": ["Point 1", "Point 2", "Point 3"],
      "callout": "Key highlight",
      "speakerNotes": "Presenter talking points",
      "themeColor": "emerald"
    }
  ],
  "graphEntities": [
    { "id": "e1", "name": "Entity Name", "type": "concept|metric|organization|milestone|regulation", "connections": ["e2"] }
  ],
  "citations": [
    { "id": "c1", "sourceTitle": "Source Name", "snippet": "Direct quote", "pageOrSection": "Sec 1" }
  ]
}`;
}

export function compileDocumentEditPrompt(params: {
  sourceDoc: DocumentItem;
  instruction: string;
  preset: DocumentEditPreset;
  targetSection?: string;
  config: DocumentConfig;
}): string {
  const presetHints: Record<DocumentEditPreset, string> = {
    custom_edit: 'Follow the exact edit instruction faithfully while preserving clean document structure.',
    rewrite_clarity: 'Improve clarity, precision, active voice, and readability while keeping all factual content intact.',
    expand_depth: 'Significantly expand explanations, add concrete examples, sub-headings, and analytical depth.',
    condense_exec: 'Tighten and condense verbose paragraphs into high-signal executive bullet points (~40% shorter).',
    translate_bilingual: `Translate cleanly into ${params.config.language}, preserving all headings, markdown tables, and technical accuracy.`,
    add_financial_tables: 'Enrich the document with structured Markdown comparison/financial KPI tables based on the topic.',
    convert_slides: 'Reorganize and synthesize crisp presentation slides alongside updated summary and structured bullets.',
  };

  const sectionScope = params.targetSection?.trim()
    ? `SCOPE: Focus the transformation primarily on the section titled "${params.targetSection.trim()}", keeping the rest of the document coherent.`
    : 'SCOPE: Apply edits across the entire document.';

  return `You are a Senior Document Editor & Strategist.
Transform the existing document below according to the instruction.

Document Title: "${params.sourceDoc.title}"
Preset Mode: ${params.preset} — ${presetHints[params.preset]}
User Edit Instruction: "${params.instruction}"
Target Language: ${params.config.language} · Tone: ${params.config.tone}
${sectionScope}

EXISTING DOCUMENT CONTENT (Markdown):
"""
${String(params.sourceDoc.content || '').slice(0, 26000)}
"""

Return STRICT VALID JSON with the updated document:
{
  "title": "Updated Title",
  "summary": "Updated concise executive summary",
  "content": "Complete updated Markdown document (never truncate unchanged parts unless asked to condense)",
  "slides": ${JSON.stringify((params.sourceDoc.slides || []).slice(0, 8)).slice(0, 2000)},
  "changeSummary": "1-sentence summary of what changed"
}`;
}

export async function generateDocumentPodcastAudio(params: {
  tenantId: string;
  docId: string;
  title: string;
  content: string;
  summary?: string;
  voiceName?: string;
  style?: string;
  geminiClient: GoogleGenAI | null;
  byok: ByokKeyMap;
  fallbackGroqKey?: string;
}): Promise<{ audioUrl: string; audioFilename: string; transcript: string }> {
  if (!params.geminiClient) {
    throw new Error('Gemini API key is required for Studio Audio Overview generation.');
  }

  let script = '';
  try {
    const scriptRes = await runTextLlmJsonOrText({
      prompt: `Write a crisp 140-180 word spoken ${params.style || 'Executive Briefing'} narration summarizing the document "${params.title}".
Summary: ${params.summary || ''}
Excerpt: ${params.content.slice(0, 6000)}
Output ONLY natural spoken narration text suitable for voice synthesis (no markdown symbols or asterisks).`,
      systemPrompt: 'Write clear, warm, natural broadcast narration without markdown syntax.',
      geminiClient: params.geminiClient,
      byok: params.byok,
      fallbackGroqKey: params.fallbackGroqKey,
    });
    script = scriptRes.text.replace(/[#*_`]/g, '').trim();
  } catch {
    script = `${params.title}. ${params.summary || params.content.slice(0, 500).replace(/[#*_`]/g, '')}`;
  }

  const ttsRes = await params.geminiClient.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: script,
            speechMetadata: { style: 'Clear warm executive podcast presenter' },
          } as any,
        ],
      },
    ],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: params.voiceName || 'Kore' },
        },
      },
    },
  });

  const base64Audio = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('TTS service returned no audio bytes.');
  }

  const wavBuf = Buffer.from(base64Audio, 'base64');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raone-docpod-'));
  try {
    const wavPath = path.join(tmpDir, 'overview.wav');
    const mp3Path = path.join(tmpDir, 'overview.mp3');
    await fs.promises.writeFile(wavPath, wavBuf);
    await execFileAsync(
      'ffmpeg',
      ['-y', '-i', wavPath, '-af', 'loudnorm=I=-14:TP=-1.5', '-c:a', 'libmp3lame', '-b:a', '192k', mp3Path],
      { timeout: 45000 }
    );
    const mp3Buf = await fs.promises.readFile(mp3Path);
    const saved = await saveTenantDocAssetBuffer(params.tenantId, `${params.docId}_pod`, 'mp3', mp3Buf);
    return { audioUrl: saved.url, audioFilename: saved.filename, transcript: script };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function auditDocumentQuality(params: {
  doc: DocumentItem;
  geminiClient: GoogleGenAI | null;
  byok: ByokKeyMap;
  fallbackGroqKey?: string;
}): Promise<DocumentAuditReport> {
  const content = String(params.doc.content || '');
  const words = content.split(/\s+/).filter(Boolean);
  const headings = (content.match(/^#{1,3}\s+/gm) || []).length;
  const tableRows = (content.match(/^\|.*\|$/gm) || []).length;
  const tableCount = Math.floor(tableRows / 2);
  const citationCount = (params.doc.citations || []).length;

  const issues: DocumentAuditIssue[] = [];
  if (words.length < 150) {
    issues.push({
      id: 'len_low',
      severity: 'medium',
      area: 'Content Depth',
      description: `Document is relatively short (${words.length} words) for a full standalone deliverable.`,
      suggestedFix: 'Expand core sections with concrete analysis, milestones, and supporting context.',
    });
  }
  if (headings < 2) {
    issues.push({
      id: 'struct_headings',
      severity: 'high',
      area: 'Hierarchy & Readability',
      description: 'Missing clear Markdown section headings (# / ##) for visual hierarchy.',
      suggestedFix: 'Organize the document into Executive Summary, Key Analysis, and Recommendations headings.',
    });
  }
  if (tableCount === 0 && params.doc.docType !== 'presentation') {
    issues.push({
      id: 'missing_tables',
      severity: 'low',
      area: 'Structured Data',
      description: 'No comparison or KPI tables found.',
      suggestedFix: 'Add at least one Markdown summary or KPI comparison table.',
    });
  }
  if (params.doc.sourceFile && citationCount === 0) {
    issues.push({
      id: 'grounding_cits',
      severity: 'medium',
      area: 'Source Citations',
      description: 'Uploaded source attached, but no inline citations or snippets are recorded.',
      suggestedFix: 'Attach explicit grounded quotes linking key claims back to the uploaded source.',
    });
  }

  // Optional LLM quick polish check if provider configured
  if (params.geminiClient || params.byok?.groqApiKey || params.fallbackGroqKey) {
    try {
      const auditRes = await runTextLlmJsonOrText({
        prompt: `Review this document snippet for structural, logical, or formatting gaps (max 2 concrete issues).
Title: "${params.doc.title}"
Content:\n${content.slice(0, 6000)}

Return JSON: { "issues": [{ "severity": "medium", "area": "...", "description": "...", "suggestedFix": "..." }], "autoFixPrompt": "Single concise edit instruction fixing the top gaps" }`,
        systemPrompt: 'Be concise, factual, and constructive. Output strict JSON.',
        geminiClient: params.geminiClient,
        byok: params.byok,
        fallbackGroqKey: params.fallbackGroqKey,
        expectJson: true,
      });
      const parsed = parseJsonSafe<any>(auditRes.text);
      if (Array.isArray(parsed?.issues)) {
        parsed.issues.slice(0, 2).forEach((iss: any, idx: number) => {
          if (iss?.description) {
            issues.push({
              id: `ai_iss_${idx}`,
              severity: iss.severity === 'high' || iss.severity === 'low' ? iss.severity : 'medium',
              area: String(iss.area || 'Quality Check'),
              description: String(iss.description),
              suggestedFix: String(iss.suggestedFix || 'Refine wording and structure.'),
            });
          }
        });
      }
      if (parsed?.autoFixPrompt && issues.length > 0) {
        return {
          auditedAt: new Date().toISOString(),
          wordCount: words.length,
          headingCount: headings,
          tableCount,
          citationCount,
          issues,
          autoFixPrompt: String(parsed.autoFixPrompt),
        };
      }
    } catch {
      // keep deterministic checks
    }
  }

  return {
    auditedAt: new Date().toISOString(),
    wordCount: words.length,
    headingCount: headings,
    tableCount,
    citationCount,
    issues,
    autoFixPrompt:
      issues.map((i) => i.suggestedFix).join(' ') ||
      'Polish formatting, tighten executive transitions, and verify consistent Markdown tables.',
  };
}

export async function extractUploadedDocumentWithOcrFallback(params: {
  filename: string;
  mimeType?: string;
  base64Data: string;
  geminiClient: GoogleGenAI | null;
}): Promise<{
  filename: string;
  extractedText: string;
  pageCount?: number;
  ocrEngine: string;
}> {
  const cleanName = String(params.filename || 'document').replace(/[\\/:*?"<>|]/g, '_');
  const ext = (cleanName.split('.').pop() || '').toLowerCase();
  const isImage =
    ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ||
    String(params.mimeType || '').startsWith('image/');

  if (isImage) {
    if (!params.geminiClient) {
      throw new Error('Gemini API key is required for OCR extraction from image documents.');
    }
    const rawB64 = String(params.base64Data || '').replace(/^data:[^;]+;base64,/, '');
    const res = await params.geminiClient.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: params.mimeType || (ext === 'png' ? 'image/png' : 'image/jpeg'),
              data: rawB64,
            },
          },
          {
            text: 'Perform high-precision OCR and transcribe ALL text, tables (as Markdown tables), headings, and lists from this document image verbatim.',
          },
        ],
      },
    });
    const text = (res.text || '').trim();
    if (!text) throw new Error('OCR could not read text from the uploaded image.');
    return { filename: cleanName, extractedText: text, pageCount: 1, ocrEngine: 'Gemini Multimodal OCR' };
  }

  try {
    const res = await extractTextFromUploadedBase64(params);
    return {
      filename: res.filename,
      extractedText: res.extractedText,
      pageCount: res.pageCount,
      ocrEngine: ext === 'pdf' ? 'unpdf Native Parser' : ext === 'docx' ? 'Mammoth OOXML' : 'UTF-8 Text Parser',
    };
  } catch (err: any) {
    // Scanned PDF fallback to Gemini PDF reader
    if (ext === 'pdf' && params.geminiClient) {
      const rawB64 = String(params.base64Data || '').replace(/^data:[^;]+;base64,/, '');
      const res = await params.geminiClient.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: rawB64 } },
            {
              text: 'Extract all readable text, headings, and Markdown tables faithfully from this PDF document.',
            },
          ],
        },
      });
      const text = (res.text || '').trim();
      if (text) {
        return { filename: cleanName, extractedText: text, ocrEngine: 'Gemini Multimodal PDF OCR' };
      }
    }
    throw err;
  }
}

export function buildPublishedDocumentHtml(snap: DocumentPublishedSnapshot): string {
  const safe = (s: string) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const lines = (snap.content || '').split(/\r?\n/);
  const bodyHtml = lines
    .map((raw) => {
      const line = raw.trim();
      if (!line) return '';
      if (line.startsWith('# ')) return `<h1>${safe(line.slice(2))}</h1>`;
      if (line.startsWith('## ')) return `<h2>${safe(line.slice(3))}</h2>`;
      if (line.startsWith('### ')) return `<h3>${safe(line.slice(4))}</h3>`;
      if (line.startsWith('- ') || line.startsWith('* ')) return `<li>${safe(line.slice(2))}</li>`;
      return `<p>${safe(line).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safe(snap.title)} — RaOne Document Studio</title>
<style>
  body { margin: 0; background: #0e0f12; color: #e5e7eb; font-family: system-ui, -apple-system, sans-serif; line-height: 1.68; padding: 32px 16px; }
  .sheet { max-width: 820px; margin: 0 auto; background: #16181c; border: 1px solid #262930; border-radius: 16px; padding: 36px 40px; }
  .meta { font-size: 12px; color: #9ca3af; margin-bottom: 18px; }
  .summary { background: #1d2026; border: 1px solid #2a2e38; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; font-size: 14px; color: #d1d5db; }
  h1 { color: #fff; font-size: 26px; margin-top: 0; }
  h2 { color: #f3f4f6; font-size: 18px; margin-top: 26px; border-bottom: 1px solid #262930; padding-bottom: 6px; }
  h3 { color: #e5e7eb; font-size: 15px; }
  p, li { font-size: 14px; color: #d1d5db; }
  audio { width: 100%; margin: 12px 0 20px; }
</style></head>
<body><article class="sheet">
  ${snap.companyName ? `<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8ab4f8;margin-bottom:6px">${safe(snap.companyName)}</div>` : ''}
  <h1>${safe(snap.title)}</h1>
  <div class="meta">${safe(snap.docType)} · Published ${safe(snap.publishedAt.slice(0, 10))}</div>
  ${snap.audioFilename ? `<audio src="/api/documents/share/${encodeURIComponent(snap.shareId)}/audio" controls></audio>` : ''}
  ${snap.summary ? `<div class="summary">${safe(snap.summary)}</div>` : ''}
  ${bodyHtml}
  ${snap.footerNote ? `<footer style="margin-top:32px;font-size:12px;color:#6b7280;text-align:center">${safe(snap.footerNote)}</footer>` : ''}
</article></body></html>`;
}

export function buildDocumentRecord(params: {
  id: string;
  parentId?: string | null;
  rootId?: string | null;
  version?: number;
  operationType: DocumentItem['operationType'];
  title: string;
  prompt: string;
  compiledPrompt?: string;
  enhancedFrom?: string;
  editInstruction?: string;
  content: string;
  summary?: string;
  slides?: DocumentSlide[];
  citations?: DocumentCitation[];
  graphEntities?: GraphEntityNode[];
  config: DocumentConfig;
  sourceFile?: string;
  ocrEngine?: string;
  audioOverviewUrl?: string;
  audioOverviewFilename?: string;
  audioOverviewTranscript?: string;
  tags?: string[];
  aiNotes?: string;
}): DocumentItem {
  const words = String(params.content || '').split(/\s+/).filter(Boolean).length;
  const legacyType = mapCategoryToLegacyDocType(params.config.category);

  return {
    id: params.id,
    parentId: params.parentId ?? null,
    rootId: params.rootId ?? params.id,
    version: params.version ?? 1,
    operationType: params.operationType,
    title: params.title,
    docType: legacyType,
    docCategory: params.config.category,
    prompt: params.prompt,
    compiledPrompt: params.compiledPrompt,
    enhancedFrom: params.enhancedFrom,
    editInstruction: params.editInstruction,
    content: params.content,
    summary: params.summary,
    slides: params.slides || [],
    citations: params.citations || [],
    graphEntities: params.graphEntities || [],
    audioOverviewUrl: params.audioOverviewUrl,
    audioOverviewFilename: params.audioOverviewFilename,
    audioOverviewTranscript: params.audioOverviewTranscript,
    model: params.config.model,
    language: params.config.language,
    tags: params.tags || [params.config.category, params.config.tone, params.config.language],
    pageCount: Math.max(1, Math.ceil(words / 280)),
    wordCount: words,
    sourceFile: params.sourceFile,
    ocrEngine: params.ocrEngine,
    aiNotes: params.aiNotes,
    configSnapshot: params.config,
    officeExportUrls: {
      docx: `/api/documents/export/docx?id=${params.id}`,
      pptx: `/api/documents/export/pptx?id=${params.id}`,
      xlsx: `/api/documents/export/xlsx?id=${params.id}`,
      pdf: `/api/documents/export/pdf?id=${params.id}`,
      html: `/api/documents/export/html?id=${params.id}`,
      md: `/api/documents/export/md?id=${params.id}`,
    },
    createdAt: new Date().toISOString(),
    isFavorite: false,
  };
}
