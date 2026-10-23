export type VoiceName = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserPreference {
  userId: string;
  voiceName: VoiceName;
  ambientTheme: 'cyber-dark' | 'nebula-indigo' | 'slate-minimal' | 'emerald-glow';
  autoSpeak: boolean;
  mcpBackendUrl: string;
  speechRate?: number;
  updatedAt?: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  toolCalls?: Array<{
    name: string;
    args?: Record<string, any>;
    result?: Record<string, any>;
    status?: 'pending' | 'success' | 'approval_required';
  }>;
  audioUrl?: string;
}

export interface ConversationThread {
  id: string;
  userId: string;
  title: string;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface TaskItem {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  dueDate?: string;
  category: 'workspace' | 'personal' | 'home' | 'commerce' | 'meeting';
  googleTaskId?: string;
  createdAt: string;
  updatedAt?: string;
}

export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed' | 'pending_approval';

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  service: 'google_calendar' | 'gmail' | 'google_drive' | 'google_tasks' | 'smart_home' | 'commerce' | 'mcp_core';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'approval_required';
  input?: Record<string, any>;
  output?: Record<string, any>;
  timestamp?: string;
  durationMs?: number;
}

export interface WorkflowExecution {
  id: string;
  userId: string;
  title: string;
  triggerType: 'voice_command' | 'scheduled' | 'sensor_event' | 'manual';
  status: WorkflowStatus;
  steps: WorkflowStep[];
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryItem {
  id: string;
  userId: string;
  category: 'preference' | 'schedule' | 'family' | 'home' | 'work' | 'dietary';
  key: string;
  value: string;
  confidence: number;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category: string;
  image?: string;
}

export interface CommerceOrder {
  id: string;
  userId: string;
  title: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'fulfilled' | 'cancelled';
  approvalRequired: boolean;
  createdAt: string;
  shippingAddress?: string;
}

export interface IntegrationService {
  id: string;
  name: string;
  provider: 'google' | 'amazon' | 'mcp' | 'smartthings' | 'web';
  category: 'communication' | 'productivity' | 'storage' | 'smart_home' | 'commerce' | 'orchestration';
  icon: string;
  description: string;
  status: 'connected' | 'demo' | 'not_connected' | 'authorizing';
  scopes?: string[];
  lastSyncedAt?: string;
  isRealIntegration: boolean;
}
