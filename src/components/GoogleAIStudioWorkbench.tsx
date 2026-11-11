import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Play,
  Square,
  Copy,
  Check,
  CodeXml,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  Download,
  Share2,
  ExternalLink,
  MessageSquare,
  FileText,
  Table,
  Zap,
  Clock,
  Layers,
  Terminal,
  RefreshCw,
  Search,
  BookOpen,
  Info,
  Maximize2,
  Minimize2,
  FileCode,
} from 'lucide-react';

export interface StudioPrompt {
  id: string;
  title: string;
  type: 'chat' | 'freeform' | 'structured';
  model: string;
  systemInstruction?: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  thinkingBudget: number;
  structuredColumns?: string[];
  examples?: Record<string, string>[];
  testInput?: string;
  testOutput?: string;
  freeformContent?: string;
  variables?: Record<string, string>;
  chatMessages?: { role: 'user' | 'model'; content: string }[];
  jsonSchema?: string;
  isGroundingEnabled?: boolean;
  updatedAt?: string;
}

interface GoogleAIStudioWorkbenchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleAIStudioWorkbench: React.FC<GoogleAIStudioWorkbenchProps> = ({
  isOpen,
  onClose,
}) => {
  // Navigation & Prompt state
  const [promptsList, setPromptsList] = useState<StudioPrompt[]>([]);
  const [activePromptId, setActivePromptId] = useState<string>('new-prompt');
  const [promptTitle, setPromptTitle] = useState<string>('Untitled Prompt');
  const [promptType, setPromptType] = useState<'chat' | 'freeform' | 'structured'>('chat');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');

  // UI Drawer states
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isParamsOpen, setIsParamsOpen] = useState<boolean>(true);
  const [isSystemInstructionOpen, setIsSystemInstructionOpen] = useState<boolean>(true);
  const [isGetCodeOpen, setIsGetCodeOpen] = useState<boolean>(false);
  const [codeLanguage, setCodeLanguage] = useState<'python' | 'javascript' | 'curl' | 'json'>('python');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Model Parameters state
  const [systemInstruction, setSystemInstruction] = useState<string>(
    'You are a helpful, expert AI assistant with rigorous precision and deep reasoning capabilities.'
  );
  const [temperature, setTemperature] = useState<number>(1.0);
  const [topP, setTopP] = useState<number>(0.95);
  const [topK, setTopK] = useState<number>(40);
  const [maxTokens, setMaxTokens] = useState<number>(4096);
  const [thinkingBudget, setThinkingBudget] = useState<number>(0);
  const [isGroundingEnabled, setIsGroundingEnabled] = useState<boolean>(false);
  const [isJsonSchemaEnabled, setIsJsonSchemaEnabled] = useState<boolean>(false);
  const [jsonSchema, setJsonSchema] = useState<string>(
    '{\n  "type": "object",\n  "properties": {\n    "result": { "type": "string" },\n    "confidence": { "type": "number" }\n  },\n  "required": ["result"]\n}'
  );

  // Chat Prompt Canvas State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([
    {
      role: 'user',
      content: 'Explain how attention mechanisms work in transformer architectures in simple terms.',
    },
    {
      role: 'model',
      content:
        'Attention in transformers allows the model to dynamically weigh the importance of different words in a sentence relative to each other, regardless of their position. Instead of processing sequentially like RNNs, it calculates a score between every query and key to produce context-aware values.',
    },
  ]);
  const [newChatInput, setNewChatInput] = useState<string>('');

  // Freeform Prompt Canvas State
  const [freeformContent, setFreeformContent] = useState<string>(
    'Analyze the following {{subject}} and summarize key insights:\n\n{{input_text}}'
  );
  const [freeformVariables, setFreeformVariables] = useState<Record<string, string>>({
    subject: 'Quantum Computing Breakthrough',
    input_text:
      'Researchers have demonstrated quantum supremacy in fault-tolerant logical qubits, demonstrating an error rate reduction by a factor of 10x using topological surface codes.',
  });
  const [freeformOutput, setFreeformOutput] = useState<string>('');

  // Structured Prompt Canvas State
  const [structuredColumns, setStructuredColumns] = useState<string[]>([
    'Input Text',
    'Detected Topic',
    'Sentiment',
  ]);
  const [examples, setExamples] = useState<Record<string, string>[]>([
    {
      'Input Text': 'The flight was delayed 4 hours with no explanation given at the gate.',
      'Detected Topic': 'Airline Travel',
      'Sentiment': 'Negative',
    },
    {
      'Input Text': 'The battery life on this laptop exceeds 18 hours easily.',
      'Detected Topic': 'Hardware Battery',
      'Sentiment': 'Positive',
    },
  ]);
  const [structuredTestInput, setStructuredTestInput] = useState<string>(
    'Clean interface, super intuitive shortcut keys, and fast responses.'
  );
  const [structuredTestOutput, setStructuredTestOutput] = useState<string>('');

  // Execution & Metric state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<{
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    throughput: number;
  }>({
    latencyMs: 380,
    inputTokens: 124,
    outputTokens: 88,
    throughput: 42.5,
  });
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Load Saved Prompts from API on open
  useEffect(() => {
    if (isOpen) {
      fetch('/api/studio/prompts')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setPromptsList(data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Select a prompt from Library
  const handleSelectPrompt = (prompt: StudioPrompt) => {
    setActivePromptId(prompt.id);
    setPromptTitle(prompt.title);
    setPromptType(prompt.type);
    setSelectedModel(prompt.model || 'gemini-2.5-flash');
    if (prompt.systemInstruction) setSystemInstruction(prompt.systemInstruction);
    if (typeof prompt.temperature === 'number') setTemperature(prompt.temperature);
    if (typeof prompt.topP === 'number') setTopP(prompt.topP);
    if (typeof prompt.topK === 'number') setTopK(prompt.topK);
    if (typeof prompt.maxTokens === 'number') setMaxTokens(prompt.maxTokens);
    if (typeof prompt.thinkingBudget === 'number') setThinkingBudget(prompt.thinkingBudget);

    if (prompt.type === 'chat' && Array.isArray(prompt.chatMessages)) {
      setChatMessages(prompt.chatMessages);
    } else if (prompt.type === 'freeform') {
      if (prompt.freeformContent) setFreeformContent(prompt.freeformContent);
      if (prompt.variables) setFreeformVariables(prompt.variables);
    } else if (prompt.type === 'structured') {
      if (Array.isArray(prompt.structuredColumns)) setStructuredColumns(prompt.structuredColumns);
      if (Array.isArray(prompt.examples)) setExamples(prompt.examples);
      if (prompt.testInput) setStructuredTestInput(prompt.testInput);
      if (prompt.testOutput) setStructuredTestOutput(prompt.testOutput);
    }
  };

  // Create new blank prompt
  const handleCreateNewPrompt = (type: 'chat' | 'freeform' | 'structured') => {
    const newId = `prompt-${Date.now()}`;
    const newTitle =
      type === 'chat' ? 'New Chat Prompt' : type === 'freeform' ? 'New Freeform Prompt' : 'New Structured Prompt';
    setActivePromptId(newId);
    setPromptTitle(newTitle);
    setPromptType(type);
    if (type === 'chat') {
      setChatMessages([]);
    } else if (type === 'freeform') {
      setFreeformContent('Write a comprehensive analysis about {{topic}}:\n\n{{context}}');
      setFreeformVariables({ topic: 'Artificial General Intelligence', context: 'Latest research milestones' });
      setFreeformOutput('');
    } else if (type === 'structured') {
      setStructuredColumns(['Input Text', 'Category', 'Priority']);
      setExamples([
        { 'Input Text': 'Database connection pool exhausted', 'Category': 'Infrastructure', 'Priority': 'Critical' },
      ]);
      setStructuredTestInput('CSS font layout shifted on mobile');
      setStructuredTestOutput('');
    }
  };

  // Save prompt to API database
  const handleSavePrompt = async () => {
    try {
      const payload: StudioPrompt = {
        id: activePromptId.startsWith('new-') ? `prompt-${Date.now()}` : activePromptId,
        title: promptTitle,
        type: promptType,
        model: selectedModel,
        systemInstruction,
        temperature,
        topP,
        topK,
        maxTokens,
        thinkingBudget,
        isGroundingEnabled,
        jsonSchema: isJsonSchemaEnabled ? jsonSchema : undefined,
        chatMessages: promptType === 'chat' ? chatMessages : undefined,
        freeformContent: promptType === 'freeform' ? freeformContent : undefined,
        variables: promptType === 'freeform' ? freeformVariables : undefined,
        structuredColumns: promptType === 'structured' ? structuredColumns : undefined,
        examples: promptType === 'structured' ? examples : undefined,
        testInput: promptType === 'structured' ? structuredTestInput : undefined,
        testOutput: promptType === 'structured' ? structuredTestOutput : undefined,
      };

      const res = await fetch('/api/studio/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setActivePromptId(data.prompt.id);
        setPromptsList((prev) => {
          const idx = prev.findIndex((p) => p.id === data.prompt.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = data.prompt;
            return next;
          }
          return [data.prompt, ...prev];
        });
        setSaveToast('Prompt saved to Google AI Studio Library');
        setTimeout(() => setSaveToast(null), 2500);
      }
    } catch (err) {
      console.error('Failed to save prompt:', err);
    }
  };

  // Run the prompt
  const handleRunPrompt = async () => {
    if (isRunning) return;
    setIsRunning(true);

    try {
      const payload: any = {
        model: selectedModel,
        promptType,
        systemInstruction,
        temperature,
        topP,
        topK,
        maxTokens,
        thinkingBudget,
        isGroundingEnabled,
        jsonSchema: isJsonSchemaEnabled ? jsonSchema : undefined,
      };

      if (promptType === 'chat') {
        let contents = [...chatMessages];
        if (newChatInput.trim()) {
          contents.push({ role: 'user', content: newChatInput.trim() });
          setChatMessages(contents);
          setNewChatInput('');
        }
        payload.contents = contents;
      } else if (promptType === 'freeform') {
        payload.rawText = freeformContent;
        payload.variables = freeformVariables;
      } else if (promptType === 'structured') {
        payload.examples = examples;
        payload.testInput = structuredTestInput;
      }

      const res = await fetch('/api/studio/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.content) {
        if (promptType === 'chat') {
          setChatMessages((prev) => [...prev, { role: 'model', content: data.content }]);
        } else if (promptType === 'freeform') {
          setFreeformOutput(data.content);
        } else if (promptType === 'structured') {
          setStructuredTestOutput(data.content);
        }

        const outTokens = data.outputTokens || 50;
        const latency = data.latencyMs || 400;
        const throughput = latency > 0 ? Number(((outTokens / (latency / 1000))).toFixed(1)) : 35.0;

        setMetrics({
          latencyMs: latency,
          inputTokens: data.inputTokens || 85,
          outputTokens: outTokens,
          throughput,
        });
      }
    } catch (err) {
      console.error('Run execution error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  // Generate runnable code for "Get Code" modal
  const generateCodeSnippet = () => {
    if (codeLanguage === 'python') {
      return `from google import genai
from google.genai import types

# Initialize Google GenAI client (Google AI Studio SDK)
client = genai.Client()

response = client.models.generate_content(
    model="${selectedModel}",
    contents="${promptType === 'chat' ? chatMessages[chatMessages.length - 1]?.content || 'Hello!' : promptType === 'freeform' ? freeformContent.replace(/\\n/g, '\\\\n') : structuredTestInput}",
    config=types.GenerateContentConfig(
        system_instruction="${systemInstruction}",
        temperature=${temperature},
        top_p=${topP},
        top_k=${topK},
        max_output_tokens=${maxTokens},
        ${isGroundingEnabled ? 'tools=[types.Tool(google_search=types.GoogleSearch())],' : ''}
    )
)

print(response.text)
`;
    }

    if (codeLanguage === 'javascript') {
      return `import { GoogleGenAI } from '@google/genai';

// Initialize the Google GenAI SDK client
const ai = new GoogleGenAI({});

async function runPrompt() {
  const response = await ai.models.generateContent({
    model: '${selectedModel}',
    contents: '${promptType === 'chat' ? chatMessages[chatMessages.length - 1]?.content || 'Hello!' : promptType === 'freeform' ? freeformContent.replace(/\\n/g, '\\\\n') : structuredTestInput}',
    config: {
      systemInstruction: '${systemInstruction}',
      temperature: ${temperature},
      topP: ${topP},
      topK: ${topK},
      maxOutputTokens: ${maxTokens},
      ${isGroundingEnabled ? 'tools: [{ googleSearch: {} }],' : ''}
    },
  });

  console.log(response.text);
}

runPrompt();
`;
    }

    if (codeLanguage === 'curl') {
      return `curl "https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=\${GEMINI_API_KEY}" \\
  -H 'Content-Type: application/json' \\
  -X POST \\
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{ "text": "${promptType === 'chat' ? chatMessages[chatMessages.length - 1]?.content || 'Hello!' : 'Hello from cURL'}" }]
      }
    ],
    "generationConfig": {
      "temperature": ${temperature},
      "topP": ${topP},
      "maxOutputTokens": ${maxTokens}
    }
  }'`;
    }

    // JSON Schema
    return JSON.stringify(
      {
        model: selectedModel,
        systemInstruction,
        generationConfig: {
          temperature,
          topP,
          topK,
          maxOutputTokens: maxTokens,
          thinkingBudget,
        },
        promptType,
        grounding: isGroundingEnabled,
      },
      null,
      2
    );
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generateCodeSnippet());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div
        className={`w-full h-full bg-[#131314] text-[#E3E3E3] flex flex-col overflow-hidden border border-[#2d2d2d] shadow-2xl ${
          isFullscreen ? 'p-0' : 'sm:p-1.5'
        }`}
      >
        {/* ========================================================= */}
        {/* TOP BAR: Google AI Studio Header */}
        {/* ========================================================= */}
        <header className="h-14 px-4 bg-[#1E1F20] border-b border-[#2C2D2E] flex items-center justify-between shrink-0 z-20">
          {/* Left: Google AI Studio Sparkle Badge + Prompt Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#2C2D2E] transition-colors"
              title="Toggle Library Sidebar"
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Google AI Studio Signature Sparkle */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#1A73E8] via-[#8AB4F8] to-[#EA4335] flex items-center justify-center shadow-md">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-white tracking-tight text-sm hidden md:inline">
                Google AI Studio
              </span>
              <span className="text-xs text-[#8E918F] hidden md:inline">/</span>
            </div>

            {/* Editable Prompt Title */}
            <input
              type="text"
              value={promptTitle}
              onChange={(e) => setPromptTitle(e.target.value)}
              className="bg-transparent text-white font-medium text-sm px-2 py-1 rounded-md border border-transparent hover:border-[#3C4043] focus:border-[#8AB4F8] focus:bg-[#131314] focus:outline-none transition-colors max-w-[180px] sm:max-w-[240px] truncate"
            />
          </div>

          {/* Center: Prompt Mode Switcher (Chat | Freeform | Structured) */}
          <div className="hidden lg:flex items-center bg-[#131314] p-1 rounded-full border border-[#2C2D2E]">
            <button
              onClick={() => setPromptType('chat')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                promptType === 'chat'
                  ? 'bg-[#282A2C] text-[#8AB4F8] shadow-sm'
                  : 'text-[#9AA0A6] hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat prompt</span>
            </button>

            <button
              onClick={() => setPromptType('freeform')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                promptType === 'freeform'
                  ? 'bg-[#282A2C] text-[#8AB4F8] shadow-sm'
                  : 'text-[#9AA0A6] hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Freeform prompt</span>
            </button>

            <button
              onClick={() => setPromptType('structured')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                promptType === 'structured'
                  ? 'bg-[#282A2C] text-[#8AB4F8] shadow-sm'
                  : 'text-[#9AA0A6] hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Structured prompt</span>
            </button>
          </div>

          {/* Right Actions: Model Dropdown + Get Code + Save + Run */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Model Dropdown */}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-[#282A2C] border border-[#3C4043] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8] font-medium"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="gemini-2.0-flash-thinking">Gemini 2.0 Flash (Thinking)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            </select>

            {/* Get Code Button */}
            <button
              onClick={() => setIsGetCodeOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#282A2C] hover:bg-[#35373A] border border-[#3C4043] text-white text-xs font-medium transition-colors"
              title="Export runnable code (Python, JS, cURL)"
            >
              <CodeXml className="w-3.5 h-3.5 text-[#8AB4F8]" />
              <span className="hidden sm:inline">Get Code</span>
            </button>

            {/* Save Prompt Button */}
            <button
              onClick={handleSavePrompt}
              className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#282A2C] transition-colors"
              title="Save Prompt to Library"
            >
              <Save className="w-4 h-4" />
            </button>

            {/* Toggle Run Settings Right Drawer */}
            <button
              onClick={() => setIsParamsOpen(!isParamsOpen)}
              className={`p-1.5 rounded-lg transition-colors ${
                isParamsOpen ? 'bg-[#282A2C] text-[#8AB4F8]' : 'text-[#9AA0A6] hover:text-white'
              }`}
              title="Toggle Run Parameters"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* Run Button */}
            <button
              onClick={handleRunPrompt}
              disabled={isRunning}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all ${
                isRunning
                  ? 'bg-amber-500 text-slate-950 animate-pulse'
                  : 'bg-[#1A73E8] hover:bg-[#1557B0] text-white'
              }`}
            >
              {isRunning ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#282A2C] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Save toast */}
        {saveToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2 shadow-2xl animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{saveToast}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* MAIN BODY: 3 Panels (Library, Canvas, Run Settings) */}
        {/* ========================================================= */}
        <div className="flex-1 flex overflow-hidden">
          {/* 1. LEFT PANEL: Studio Library & Quickstarts */}
          {isSidebarOpen && (
            <aside className="w-60 bg-[#1E1F20] border-r border-[#2C2D2E] flex flex-col shrink-0 select-none">
              {/* New Prompt Button */}
              <div className="p-3 border-b border-[#2C2D2E]">
                <div className="text-[11px] font-semibold text-[#8E918F] uppercase tracking-wider mb-2">
                  New Prompt
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => handleCreateNewPrompt('chat')}
                    className="p-2 rounded-lg bg-[#282A2C] hover:bg-[#35373A] text-center text-[10px] font-medium text-white flex flex-col items-center gap-1 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#8AB4F8]" />
                    <span>Chat</span>
                  </button>
                  <button
                    onClick={() => handleCreateNewPrompt('freeform')}
                    className="p-2 rounded-lg bg-[#282A2C] hover:bg-[#35373A] text-center text-[10px] font-medium text-white flex flex-col items-center gap-1 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#8AB4F8]" />
                    <span>Freeform</span>
                  </button>
                  <button
                    onClick={() => handleCreateNewPrompt('structured')}
                    className="p-2 rounded-lg bg-[#282A2C] hover:bg-[#35373A] text-center text-[10px] font-medium text-white flex flex-col items-center gap-1 transition-colors"
                  >
                    <Table className="w-3.5 h-3.5 text-[#8AB4F8]" />
                    <span>Structured</span>
                  </button>
                </div>
              </div>

              {/* My Prompts List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1 chat-scroll-area">
                <div className="text-[11px] font-semibold text-[#8E918F] uppercase tracking-wider mb-2">
                  My Library ({promptsList.length})
                </div>

                {promptsList.map((p) => {
                  const isActive = p.id === activePromptId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPrompt(p)}
                      className={`group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#282A2C] text-[#8AB4F8] font-medium'
                          : 'text-[#C4C7C5] hover:bg-[#282A2C]/60 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {p.type === 'chat' ? (
                          <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        ) : p.type === 'freeform' ? (
                          <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        ) : (
                          <Table className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        )}
                        <span className="truncate">{p.title}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Google AI Studio Resources */}
              <div className="p-3 border-t border-[#2C2D2E] bg-[#171819] text-[11px] text-[#8E918F] space-y-2">
                <div className="flex items-center justify-between">
                  <span>Gemini API Status</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Operational
                  </span>
                </div>
                <div className="text-[10px] text-[#5E6266]">
                  Full Google AI Studio Developer Workbench & Model Playground
                </div>
              </div>
            </aside>
          )}

          {/* 2. CENTER PANEL: Main Interactive Prompt Canvas */}
          <main className="flex-1 min-w-0 flex flex-col bg-[#131314] overflow-hidden">
            {/* System Instructions Collapsible Drawer */}
            <div className="border-b border-[#2C2D2E] bg-[#1E1F20]/50 shrink-0">
              <button
                onClick={() => setIsSystemInstructionOpen(!isSystemInstructionOpen)}
                className="w-full px-4 py-2 flex items-center justify-between text-xs text-[#C4C7C5] hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isSystemInstructionOpen ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  <span className="font-semibold text-white">System Instructions</span>
                  <span className="text-[11px] text-[#8E918F] hidden sm:inline">
                    (Directives that steer model behavior across all turns)
                  </span>
                </div>
                <span className="text-[10px] text-[#8E918F] font-mono">
                  {systemInstruction.length} chars
                </span>
              </button>

              {isSystemInstructionOpen && (
                <div className="px-4 pb-3">
                  <textarea
                    rows={2}
                    value={systemInstruction}
                    onChange={(e) => setSystemInstruction(e.target.value)}
                    placeholder="Provide system instructions for the model..."
                    className="w-full bg-[#131314] border border-[#2C2D2E] rounded-lg p-2.5 text-xs text-white placeholder-[#5E6266] focus:outline-none focus:border-[#8AB4F8] resize-none leading-relaxed"
                  />
                </div>
              )}
            </div>

            {/* Dynamic Content Canvas Based on Prompt Type */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 chat-scroll-area space-y-4">
              {/* CHAT PROMPT MODE */}
              {promptType === 'chat' && (
                <div className="max-w-4xl mx-auto space-y-4">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-16 text-[#8E918F]">
                      <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40 text-[#8AB4F8]" />
                      <h3 className="text-sm font-semibold text-white mb-1">Chat Prompt Sandbox</h3>
                      <p className="text-xs max-w-md mx-auto">
                        Type a user prompt below and click Run or press Ctrl+Enter to test multi-turn conversations with Gemini.
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition-all ${
                          msg.role === 'user'
                            ? 'bg-[#1E1F20] border-[#2C2D2E]'
                            : 'bg-[#1A1D20] border-[#383B3E] shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-[11px] font-bold uppercase tracking-wider ${
                              msg.role === 'user' ? 'text-[#8AB4F8]' : 'text-emerald-400'
                            }`}
                          >
                            {msg.role === 'user' ? 'User' : 'Model (Gemini)'}
                          </span>
                          <button
                            onClick={() =>
                              setChatMessages((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 rounded text-[#8E918F] hover:text-red-400 transition-colors"
                            title="Delete turn"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-xs text-white leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Add Turn Input Dock */}
                  <div className="pt-2">
                    <div className="relative bg-[#1E1F20] border border-[#3C4043] rounded-2xl p-2.5 focus-within:border-[#8AB4F8] transition-colors">
                      <textarea
                        rows={3}
                        value={newChatInput}
                        onChange={(e) => setNewChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleRunPrompt();
                          }
                        }}
                        placeholder="Type a message... (Ctrl+Enter to Run)"
                        className="w-full bg-transparent text-xs text-white placeholder-[#8E918F] focus:outline-none resize-none leading-relaxed"
                      />
                      <div className="flex items-center justify-between pt-2 border-t border-[#2C2D2E]">
                        <span className="text-[10px] text-[#8E918F] font-mono">
                          Ctrl+Enter to Run
                        </span>
                        <button
                          onClick={handleRunPrompt}
                          disabled={isRunning || !newChatInput.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Run Turn</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* FREEFORM PROMPT MODE */}
              {promptType === 'freeform' && (
                <div className="max-w-4xl mx-auto space-y-5">
                  <div className="bg-[#1E1F20] border border-[#2C2D2E] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Prompt Template</span>
                      <span className="text-[11px] text-[#8E918F]">
                        Use <code className="text-[#8AB4F8] font-mono">{'{{variable}}'}</code> to inject parameters
                      </span>
                    </div>
                    <textarea
                      rows={6}
                      value={freeformContent}
                      onChange={(e) => setFreeformContent(e.target.value)}
                      className="w-full bg-[#131314] border border-[#3C4043] rounded-lg p-3 text-xs text-white font-mono placeholder-[#5E6266] focus:outline-none focus:border-[#8AB4F8] leading-relaxed"
                    />
                  </div>

                  {/* Variables Configuration Table */}
                  <div className="bg-[#1E1F20] border border-[#2C2D2E] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Test Variables</span>
                      <button
                        onClick={() => {
                          const varName = prompt('Enter new variable name:');
                          if (varName) {
                            setFreeformVariables((prev) => ({ ...prev, [varName]: '' }));
                          }
                        }}
                        className="text-[11px] text-[#8AB4F8] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Variable</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {Object.entries(freeformVariables).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2">
                          <span className="w-28 text-xs font-mono text-[#8AB4F8] shrink-0 truncate">
                            {`{{${k}}}`}
                          </span>
                          <input
                            type="text"
                            value={v}
                            onChange={(e) =>
                              setFreeformVariables((prev) => ({ ...prev, [k]: e.target.value }))
                            }
                            className="flex-1 bg-[#131314] border border-[#3C4043] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Output Preview */}
                  {freeformOutput && (
                    <div className="bg-[#1E1F20] border border-emerald-500/30 rounded-xl p-4 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-400">Generated Output</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(freeformOutput)}
                          className="p-1 text-[#8E918F] hover:text-white"
                          title="Copy output"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-xs text-white leading-relaxed whitespace-pre-wrap font-sans">
                        {freeformOutput}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STRUCTURED PROMPT MODE */}
              {promptType === 'structured' && (
                <div className="max-w-4xl mx-auto space-y-5">
                  <div className="bg-[#1E1F20] border border-[#2C2D2E] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Few-Shot Examples Table</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const colName = prompt('Enter column header:');
                            if (colName && !structuredColumns.includes(colName)) {
                              setStructuredColumns([...structuredColumns, colName]);
                            }
                          }}
                          className="text-[11px] text-[#8AB4F8] hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Column</span>
                        </button>
                        <button
                          onClick={() => {
                            const newRow: Record<string, string> = {};
                            structuredColumns.forEach((c) => (newRow[c] = ''));
                            setExamples([...examples, newRow]);
                          }}
                          className="text-[11px] text-[#8AB4F8] hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Row</span>
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-[#3C4043] rounded-lg">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#131314] text-[#8E918F] border-b border-[#3C4043]">
                          <tr>
                            {structuredColumns.map((c, i) => (
                              <th key={i} className="p-2.5 font-semibold">
                                {c}
                              </th>
                            ))}
                            <th className="p-2.5 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {examples.map((row, rowIdx) => (
                            <tr key={rowIdx} className="border-b border-[#2C2D2E] hover:bg-[#131314]/40">
                              {structuredColumns.map((col, colIdx) => (
                                <td key={colIdx} className="p-2">
                                  <input
                                    type="text"
                                    value={row[col] || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setExamples((prev) => {
                                        const next = [...prev];
                                        next[rowIdx] = { ...next[rowIdx], [col]: val };
                                        return next;
                                      });
                                    }}
                                    className="w-full bg-[#131314] border border-[#2C2D2E] rounded px-2 py-1 text-white focus:outline-none focus:border-[#8AB4F8]"
                                  />
                                </td>
                              ))}
                              <td className="p-2 text-center">
                                <button
                                  onClick={() =>
                                    setExamples((prev) => prev.filter((_, i) => i !== rowIdx))
                                  }
                                  className="text-[#8E918F] hover:text-red-400"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Test Input & Run */}
                  <div className="bg-[#1E1F20] border border-[#2C2D2E] rounded-xl p-4 space-y-3">
                    <span className="text-xs font-semibold text-white">Test Input Query</span>
                    <textarea
                      rows={2}
                      value={structuredTestInput}
                      onChange={(e) => setStructuredTestInput(e.target.value)}
                      placeholder="Enter test input for model to predict output..."
                      className="w-full bg-[#131314] border border-[#3C4043] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                    />

                    {structuredTestOutput && (
                      <div className="p-3 rounded-lg bg-[#131314] border border-emerald-500/40 text-xs text-white">
                        <div className="text-[10px] text-emerald-400 font-bold uppercase mb-1">
                          Predicted Output
                        </div>
                        <div className="whitespace-pre-wrap">{structuredTestOutput}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Metrics Bar */}
            <div className="h-10 px-4 bg-[#1E1F20] border-t border-[#2C2D2E] flex items-center justify-between text-[11px] text-[#8E918F] shrink-0 font-mono">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-white">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>{metrics.latencyMs} ms</span>
                </span>
                <span>Prompt: {metrics.inputTokens} tok</span>
                <span>Response: {metrics.outputTokens} tok</span>
                <span className="hidden sm:inline">Speed: {metrics.throughput} tok/s</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Model: {selectedModel}</span>
              </div>
            </div>
          </main>

          {/* 3. RIGHT PANEL: Run Settings (Google AI Studio Parameters) */}
          {isParamsOpen && (
            <aside className="w-72 bg-[#1E1F20] border-l border-[#2C2D2E] flex flex-col shrink-0 select-none overflow-y-auto chat-scroll-area p-4 space-y-5 text-xs text-[#C4C7C5]">
              <div className="flex items-center justify-between pb-2 border-b border-[#2C2D2E]">
                <h3 className="font-bold text-white text-sm">Run Settings</h3>
                <span className="text-[10px] text-[#8E918F]">Parameters</span>
              </div>

              {/* Temperature */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white">Temperature</span>
                  <span className="font-mono text-xs text-[#8AB4F8]">{temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-[#1A73E8]"
                />
                <div className="flex justify-between text-[10px] text-[#8E918F]">
                  <span>Precise (0.0)</span>
                  <span>Creative (2.0)</span>
                </div>
              </div>

              {/* Top P */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white">Top P</span>
                  <span className="font-mono text-xs text-[#8AB4F8]">{topP.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={topP}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  className="w-full accent-[#1A73E8]"
                />
              </div>

              {/* Top K */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white">Top K</span>
                  <span className="font-mono text-xs text-[#8AB4F8]">{topK}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="40"
                  step="1"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full accent-[#1A73E8]"
                />
              </div>

              {/* Max Output Tokens */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white">Max Output Tokens</span>
                  <span className="font-mono text-xs text-[#8AB4F8]">{maxTokens}</span>
                </div>
                <input
                  type="range"
                  min="64"
                  max="8192"
                  step="64"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="w-full accent-[#1A73E8]"
                />
              </div>

              {/* Thinking Budget (For Thinking Models) */}
              <div className="space-y-1.5 pt-2 border-t border-[#2C2D2E]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white">Thinking Budget</span>
                  <span className="font-mono text-xs text-[#8AB4F8]">
                    {thinkingBudget === 0 ? 'Off (0)' : `${thinkingBudget} tok`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8192"
                  step="512"
                  value={thinkingBudget}
                  onChange={(e) => setThinkingBudget(parseInt(e.target.value))}
                  className="w-full accent-[#1A73E8]"
                />
              </div>

              {/* Grounding with Google Search Toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-[#2C2D2E]">
                <div>
                  <div className="text-xs text-white font-medium">Google Search Grounding</div>
                  <div className="text-[10px] text-[#8E918F]">Fetch real-time web citations</div>
                </div>
                <button
                  onClick={() => setIsGroundingEnabled(!isGroundingEnabled)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                    isGroundingEnabled ? 'bg-[#1A73E8]' : 'bg-[#3C4043]'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                      isGroundingEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Structured JSON Output Mode */}
              <div className="pt-3 border-t border-[#2C2D2E] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white font-medium">Structured JSON Output</div>
                    <div className="text-[10px] text-[#8E918F]">Enforce exact schema response</div>
                  </div>
                  <button
                    onClick={() => setIsJsonSchemaEnabled(!isJsonSchemaEnabled)}
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                      isJsonSchemaEnabled ? 'bg-[#1A73E8]' : 'bg-[#3C4043]'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                        isJsonSchemaEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {isJsonSchemaEnabled && (
                  <textarea
                    rows={4}
                    value={jsonSchema}
                    onChange={(e) => setJsonSchema(e.target.value)}
                    className="w-full bg-[#131314] border border-[#3C4043] rounded-lg p-2 text-[10px] font-mono text-emerald-300 focus:outline-none"
                  />
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* GET CODE MODAL (Python, JS/TS, cURL, JSON) */}
      {/* ========================================================= */}
      {isGetCodeOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#1E1F20] border border-[#3C4043] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-[#2C2D2E] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-[#8AB4F8]" />
                <h3 className="text-sm font-bold text-white">Get Code (Google GenAI SDK)</h3>
              </div>
              <button
                onClick={() => setIsGetCodeOpen(false)}
                className="p-1 rounded-lg text-[#9AA0A6] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Language Tabs */}
            <div className="px-5 pt-3 pb-2 border-b border-[#2C2D2E] flex items-center gap-2">
              <button
                onClick={() => setCodeLanguage('python')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  codeLanguage === 'python'
                    ? 'bg-[#1A73E8] text-white'
                    : 'text-[#9AA0A6] hover:text-white hover:bg-[#282A2C]'
                }`}
              >
                Python
              </button>
              <button
                onClick={() => setCodeLanguage('javascript')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  codeLanguage === 'javascript'
                    ? 'bg-[#1A73E8] text-white'
                    : 'text-[#9AA0A6] hover:text-white hover:bg-[#282A2C]'
                }`}
              >
                JavaScript / TypeScript
              </button>
              <button
                onClick={() => setCodeLanguage('curl')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  codeLanguage === 'curl'
                    ? 'bg-[#1A73E8] text-white'
                    : 'text-[#9AA0A6] hover:text-white hover:bg-[#282A2C]'
                }`}
              >
                cURL
              </button>
              <button
                onClick={() => setCodeLanguage('json')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  codeLanguage === 'json'
                    ? 'bg-[#1A73E8] text-white'
                    : 'text-[#9AA0A6] hover:text-white hover:bg-[#282A2C]'
                }`}
              >
                JSON Payload
              </button>
            </div>

            {/* Code Block */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#131314] chat-scroll-area">
              <pre className="text-xs font-mono text-[#E3E3E3] leading-relaxed whitespace-pre-wrap select-text">
                {generateCodeSnippet()}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-[#2C2D2E] bg-[#171819] flex items-center justify-between">
              <span className="text-[11px] text-[#8E918F]">
                Powered by Google GenAI TypeScript & Python SDK
              </span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-950 text-xs font-semibold shadow-md transition-colors"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
