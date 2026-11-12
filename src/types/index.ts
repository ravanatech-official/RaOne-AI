export type Mode = 'think' | 'create' | 'act';
export type NavTab = 'studio' | 'think' | 'create' | 'act' | 'vision';

export interface GroundingSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  mode?: Mode;
  model?: string;
  thinkingTime?: string;
  thoughtProcess?: string;
  sourcesCount?: number;
  groundingSources?: GroundingSource[];
  mapsSources?: GroundingSource[];
  generatedImage?: {
    url: string;
    prompt: string;
    aspectRatio?: string;
  };
  generatedAudio?: {
    url: string;
    lyrics?: string;
    prompt: string;
  };
  generatedVideo?: {
    url?: string;
    prompt: string;
    storyboard?: string[];
  };
  outputs?: {
    id: string;
    title: string;
    type: 'code' | 'artifact' | 'blueprint' | 'document';
    content: string;
    language?: string;
  }[];
  attachments?: {
    id: string;
    name: string;
    type: string;
    size?: string;
  }[];
  isTemporary?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  section: 'pinned' | 'projects' | 'recents';
  projectName?: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  modelId: string;
  isTemporary?: boolean;
}

export interface IntellectFacet {
  id: string;
  name: string;
  sinhalaName: string;
  domain: string;
  description: string;
  iconName: string;
}

export interface ExecutionTask {
  id: string;
  title: string;
  description: string;
  category: 'strategy' | 'code' | 'automation' | 'analysis';
  status: 'todo' | 'executing' | 'done';
  outputPreview?: string;
}

export interface StudioAppFileMap {
  'index.html': string;
  'app.js'?: string;
  'styles.css'?: string;
  'architecture.md'?: string;
  'schema.json'?: string;
  [filename: string]: string | undefined;
}

export interface AgentStep {
  step: number;
  phase: string;
  title: string;
  status: 'complete' | 'in_progress' | 'pending';
  details: string;
  timestamp: string;
}

export interface StudioApp {
  id: string;
  title: string;
  description: string;
  category: string;
  icon?: string;
  tag?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  code: string;
  files?: StudioAppFileMap;
  agentSteps?: AgentStep[];
  version?: number;
}

export interface GeneratedImageItem {
  id: string;
  prompt: string;
  negativePrompt?: string;
  model: string;
  style: string;
  aspectRatio: string;
  dimensions: string;
  cfgScale: number;
  steps: number;
  seed: number;
  imageUrl: string;
  createdAt: string;
  isFavorite?: boolean;
  alchemy?: boolean;
  photoReal?: boolean;
  promptMagic?: boolean;
  upscaled?: boolean;
}

export interface ImageGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  style?: string;
  aspectRatio?: string;
  dimensions?: string;
  cfgScale?: number;
  steps?: number;
  seed?: number;
  numImages?: number;
  alchemy?: boolean;
  photoReal?: boolean;
  promptMagic?: boolean;
  referenceImage?: string | null;
}

export interface GeneratedVideoItem {
  id: string;
  prompt: string;
  negativePrompt?: string;
  model: string;
  cameraMotion: string;
  motionStrength: number;
  duration: number; // in seconds, e.g. 5, 10
  fps: number; // 24, 30, 60
  aspectRatio: string;
  dimensions: string;
  videoUrl: string;
  posterUrl: string;
  mode: 'text-to-video' | 'image-to-video';
  referenceImage?: string | null;
  seed: number;
  createdAt: string;
  isFavorite?: boolean;
  upscaled?: boolean;
  extended?: boolean;
  interpolated?: boolean;
}

export interface VideoGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  cameraMotion?: string;
  motionStrength?: number;
  duration?: number;
  fps?: number;
  aspectRatio?: string;
  dimensions?: string;
  mode?: 'text-to-video' | 'image-to-video';
  referenceImage?: string | null;
  seed?: number;
}

export interface GeneratedAudioItem {
  id: string;
  title: string;
  prompt: string;
  lyrics?: string;
  styleTags: string[];
  model: string;
  isInstrumental: boolean;
  duration: number; // in seconds, e.g. 120, 240
  bpm?: number;
  keySignature?: string;
  audioUrl: string;
  coverUrl: string;
  vocalStemUrl?: string;
  instrumentalStemUrl?: string;
  stemsSeparated?: boolean;
  createdAt: string;
  isFavorite?: boolean;
  extended?: boolean;
  playCount?: number;
}

export interface AudioGenerationOptions {
  prompt: string;
  lyrics?: string;
  title?: string;
  styleTags?: string[];
  model?: string;
  isInstrumental?: boolean;
  customMode?: boolean;
  duration?: number;
  bpm?: number;
  keySignature?: string;
}

export interface DocumentSlide {
  id: string;
  slideNumber: number;
  title: string;
  subtitle?: string;
  bulletPoints: string[];
  callout?: string;
  themeColor?: string;
}

export interface DocumentCitation {
  id: string;
  sourceTitle: string;
  snippet: string;
  pageOrSection?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  docType: 'report' | 'presentation' | 'spreadsheet' | 'notebook' | 'summary';
  prompt: string;
  content: string; // Markdown / HTML formatted
  summary?: string;
  slides?: DocumentSlide[];
  citations?: DocumentCitation[];
  audioOverviewUrl?: string; // NotebookLM deep dive podcast URL
  audioOverviewTranscript?: string;
  model: string;
  tags: string[];
  pageCount?: number;
  wordCount?: number;
  createdAt: string;
  isFavorite?: boolean;
  sourceFile?: string;
}

export interface DocumentGenerationOptions {
  prompt: string;
  docType: 'report' | 'presentation' | 'spreadsheet' | 'notebook' | 'summary';
  tone?: 'executive' | 'academic' | 'technical' | 'creative';
  model?: string;
  sourceText?: string;
  includeSlides?: boolean;
  includeAudioOverview?: boolean;
}



