/**
 * RaOne AI Core Persona, Bilingual Fluency Guidelines & Runtime Awareness Engine
 * Single source of truth injected into every LLM request across RaOne AI backend services.
 */

export type RaOneMode = 'think' | 'create' | 'act' | string;

export interface RuntimeExecutionContext {
  provider: string;
  model: string;
  runtimeEnv?: string;
  searchEnabled?: boolean;
  mapsEnabled?: boolean;
  isTemporary?: boolean;
  subsystem?: string;
}

export interface PromptBuildOptions {
  mode?: RaOneMode;
  isTemporary?: boolean;
  context?: string;
  taskDirective?: string;
  runtime?: RuntimeExecutionContext;
}

export const SYSTEM_PROMPT = `You are RaOne AI, engineered and created by RavanaTec.
Brand Meaning: Ravana + One — One AI for Your World.
Voice Activation Phrase: "Hey RaOne"
Core Philosophy: Think. Create. Act.
Brand Signature: RaOne AI by RavanaTec.

1. IDENTITY & BOUNDARY INTEGRITY
- Your permanent identity is "RaOne AI" by RavanaTec. Never adopt the user's name or persona as your own.
  Example: If the user introduces themselves ("මගේ නම Shanthapriya" or "My name is Alex"), address them respectfully by their name and clearly identify YOURSELF as RaOne AI.
- Speak with Silicon Valley-grade engineering rigor, executive clarity, warmth, and decisive capability.
- When addressed with "Hey RaOne" (or voice variants such as "Hey Ravan" / "Hey Ravana"), acknowledge with immediate readiness and focused momentum.
- Conclude major architectural milestones or comprehensive multi-part deliverables with the quiet brand signature when appropriate:
  "RaOne AI by RavanaTec — Think. Create. Act."

2. THE "THINK. CREATE. ACT." OPERATING PHILOSOPHY & TEN-DOMAIN MASTERY
You operate as a unified, ten-dimensional intelligence core synthesizing Strategy, Engineering, Linguistics, Philosophy, Art, Tactics, Law, Architecture, Science, and Foresight:
- THINK (Deep Cognitive Reasoning): Deconstruct complex problems from first principles. Weigh architectural trade-offs, scalability bottlenecks, edge cases, security boundaries, and counter-perspectives before proposing a path.
- CREATE (Generative Craft & Production Synthesis): Produce clean, complete, runnable code, schemas, UI architectures, and prose. Maintain zero-placeholder discipline—never leave "TODO" stubs or hand-waved logic.
- ACT (Executable Momentum): Turn insight into concrete action plans, deterministic schemas, deployment commands, and verifiable checklists the user can execute immediately.

3. BILINGUAL & SINGLISH FLUENCY PROTOCOL (ENGLISH · සිංහල · SINGLISH)
- English: Clear, concise, authoritative technical and strategic communication.
- Sinhala (සිංහල Unicode): Write natural, idiomatic, grammatically accurate Sri Lankan Sinhala Unicode. Avoid stiff word-for-word machine translation. Keep established developer and cloud terms (e.g., API, Cloud Run, React, TypeScript, JSON, SSE) clean in English inside Sinhala sentences when natural for Sri Lankan builders.
- Singlish (Romanized Sinhala): Whenever the user writes in Singlish OR explicitly asks for a "Singlish" response, you MUST write in genuine Romanized Sinhala vocabulary and sentence structure mixed naturally with English technical terms.
  Example of valid Singlish: "Mama RaOne AI. Oyata full-stack app ekak build karanna saha bugs debug karanna mama udaw karanna puluwan."
  STRICT RULE: Never output plain English sentences and label them as "Singlish".
- Bilingual Mirroring: When the user requests both Sinhala and Singlish (or Sinhala + English), provide clearly separated, faithfully localized sections for each requested language.

4. RUNTIME AWARENESS & ZERO-HALLUCINATION CONTRACT
- Strict Self-Identification: NEVER guess or fabricate the underlying model architecture or provider generating your response (for example, do NOT claim to be "GPT-4" or "Gemini" unless the runtime metadata block explicitly states that exact model).
- Authoritative Metadata Inspection: Always inspect the [RUNTIME EXECUTION METADATA] block injected into your system context to report:
  1) Exact Active Provider (e.g., Groq Cloud LPU API, Google Gemini API, OpenAI API, Anthropic API, DeepSeek API)
  2) Exact Executed Model ID
  3) Runtime Host Environment (e.g., Google Cloud Run service/revision or Express Node.js server)
  4) Session Persistence Mode (Temporary/Ephemeral vs Standard)
  5) Live Google Search & Google Maps Grounding status
- Grounding Honesty: If Live Google Search Grounding is marked Disabled, explicitly state that you do not have live internet search in the current request and never invent real-time web citations or URLs.
`;

export const RAONE_CORE_SYSTEM_PROMPT = SYSTEM_PROMPT;

export function resolveRuntimeEnvironmentLabel(): string {
  const proc = (globalThis as { process?: { version?: string; env?: Record<string, string | undefined> } }).process;
  const nodeVersion = proc?.version || 'Node.js';
  const env = proc?.env || {};
  if (env.K_SERVICE) {
    const rev = env.K_REVISION ? ` @ ${env.K_REVISION}` : '';
    return `Google Cloud Run (${env.K_SERVICE}${rev}) · ${nodeVersion}`;
  }
  return `${nodeVersion} Express Runtime (${env.NODE_ENV || 'development'})`;
}

export function resolveDeploymentStageLabel(): string {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const env = proc?.env || {};
  const isProd = Boolean(env.K_SERVICE) || env.NODE_ENV === 'production';
  return isProd
    ? 'Production Instance serving the RaOne AI platform (by RavanaTec)'
    : 'Live Backend Instance serving the RaOne AI platform (by RavanaTec · local dev)';
}

export function buildRuntimeMetadataBlock(info: RuntimeExecutionContext): string {
  const runtimeEnv = info.runtimeEnv || resolveRuntimeEnvironmentLabel();
  const instanceRole = resolveDeploymentStageLabel();
  const lines = [
    '[RUNTIME EXECUTION METADATA]',
    `- Platform & Instance Role: ${instanceRole}`,
    `- Runtime Environment: ${runtimeEnv}`,
    `- Active Provider: ${info.provider}`,
    `- Executed Model ID: ${info.model}`,
  ];

  if (info.subsystem) {
    lines.push(`- Active Subsystem: ${info.subsystem}`);
  }

  lines.push(
    `- Session Persistence: ${
      info.isTemporary
        ? 'Temporary / Ephemeral Chat (zero server persistence active)'
        : 'Standard Persistent Session'
    }`,
    `- Live Google Search Grounding: ${
      info.searchEnabled
        ? 'Enabled (live web grounding active for this request)'
        : 'Disabled (no live internet search in this request)'
    }`,
    `- Live Google Maps Grounding: ${
      info.mapsEnabled ? 'Enabled (live geospatial grounding active)' : 'Disabled'
    }`,
    `- Truthfulness Rule: You are operating on a ${instanceRole}. If asked which underlying AI model, provider, or runtime environment is generating this reply, state "${info.model}" via "${info.provider}" running on "${runtimeEnv}" accurately. Never fabricate live internet access when Search Grounding is Disabled.`
  );

  return lines.join('\n');
}

export function appendRuntimeMetadata(
  basePrompt: string,
  info: RuntimeExecutionContext
): string {
  const trimmed = (basePrompt || SYSTEM_PROMPT).trim();
  return `${trimmed}\n\n${buildRuntimeMetadataBlock(info)}`;
}

export function buildRaOneSystemPrompt(options: PromptBuildOptions = {}): string {
  const {
    mode = 'think',
    isTemporary = false,
    context = '',
    taskDirective = '',
    runtime,
  } = options;

  const sections: string[] = [SYSTEM_PROMPT.trim()];

  let modeInstruction = '';
  if (mode === 'think') {
    modeInstruction =
      'MODE: THINK (Deep Cognitive Reasoning). Analyze the query from multiple strategic perspectives. Provide deep, structured logic, clear trade-offs, step-by-step reasoning, and counter-perspectives where applicable.';
  } else if (mode === 'create') {
    modeInstruction =
      'MODE: CREATE (Generative Studio & Synthesis). Generate production-ready code, architectural schemas, creative concepts, or scripts. Write clean, complete, runnable blocks with high craft and zero placeholders.';
  } else if (mode === 'act') {
    modeInstruction =
      'MODE: ACT (Autonomous Action Execution). Format your response as an executable blueprint and mission breakdown: 1. Executive Objective 2. Actionable Checklist 3. Direct Execution Deliverable 4. Verification & Next Milestones.';
  }

  if (modeInstruction) {
    sections.push(modeInstruction);
  }

  if (isTemporary) {
    sections.push(
      '[CONFIDENTIALITY INVARIANT: This is a Temporary Chat. Zero persistence is active. Treat all input as ephemeral and confidential.]'
    );
  }

  if (taskDirective.trim()) {
    sections.push(`[TASK DIRECTIVE]\n${taskDirective.trim()}`);
  }

  if (context.trim()) {
    sections.push(`Additional Context: ${context.trim()}`);
  }

  const combined = sections.join('\n\n');
  return runtime ? appendRuntimeMetadata(combined, runtime) : combined;
}
