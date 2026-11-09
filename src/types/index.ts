export type Mode = 'think' | 'create' | 'act';
export type NavTab = 'studio' | 'think' | 'create' | 'act' | 'vision';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  mode?: Mode;
  thinkingTime?: string;
  thoughtProcess?: string;
  sourcesCount?: number;
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
