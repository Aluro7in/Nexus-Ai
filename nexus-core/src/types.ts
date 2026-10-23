/**
 * Nexus AI — Core Types and Domain Models
 */

export interface ContextProfile {
  userId: string;
  userName: string;
  preferences: {
    coffee: {
      preferredBean: string;
      bagSize: string;
      roastLevel: string;
      usualQuantity: number;
      estimatedPrice: number;
    };
    workspace: {
      focusModeScene: string;
      colorTemperatureK: number;
      brightnessPercent: number;
      dndEnabled: boolean;
    };
    calendar: {
      prepBufferMinutes: number;
      workingHoursStart: string;
      workingHoursEnd: string;
    };
  };
  demoMode: boolean;
  notes: string;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  start: string; // ISO string
  end: string;   // ISO string
  location?: string;
  description?: string;
  attendees?: string[];
  isFirstMeeting?: boolean;
  source: 'sample_calendar_adapter' | 'google_calendar';
}

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface AuthUser {
  uid: string;
  email?: string;
  name?: string;
}

export interface Task {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  clientRequestId?: string;
  googleTaskId?: string;
  metadata?: Record<string, unknown>;
}

export interface CartItem {
  id: string;
  title: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type StagedCartStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED';

export interface StagedCart {
  stageId: string;
  userId?: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  estimatedTotal: number;
  currency: string;
  status: StagedCartStatus;
  confirmationToken: string;
  createdAt: string;
  expiresAt: string;
  safetyDisclaimer: string;
}

export type OperationStatus = 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL';

export interface WorkflowOperation {
  step: number;
  tool: string;
  name: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: OperationStatus;
  timestamp: string;
  error?: string;
}

export type WorkflowState = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'AWAITING_APPROVAL' | 'FAILED';

export interface WorkflowStatus {
  workflowId: string;
  userId?: string;
  query: string;
  startedAt: string;
  completedAt?: string;
  state: WorkflowState;
  operations: WorkflowOperation[];
  summary: string;
  pendingAction?: {
    type: 'CART_CHECKOUT';
    stageId: string;
    confirmationToken: string;
    description: string;
    amount: number;
  };
}

export interface ConfirmationRecord {
  token: string;
  stageId: string;
  actionType: 'CART_CHECKOUT' | 'DEVICE_AUTOMATION';
  payload: Record<string, unknown>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string;
}

// JSON-RPC 2.0 Types
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// MCP Content Block
export interface McpContentBlock {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface McpToolResult {
  content: McpContentBlock[];
  isError?: boolean;
  _meta?: Record<string, unknown>;
}
