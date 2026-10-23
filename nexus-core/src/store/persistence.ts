/**
 * Nexus AI — Modular Persistence Layer
 *
 * Implements a clean StorageAdapter pattern. In demo mode, provides
 * persistent in-memory / local JSON storage. Modularly swappable for
 * Firebase Firestore without modifying any MCP tool handlers.
 */

import crypto from 'node:crypto';
import type {
  ContextProfile,
  ScheduleEvent,
  Task,
  CartItem,
  StagedCart,
  WorkflowStatus,
  ConfirmationRecord,
} from '../types.js';

export interface StorageAdapter {
  getContextProfile(userId?: string): Promise<ContextProfile>;
  updateContextProfile(updates: Partial<ContextProfile>, userId?: string): Promise<ContextProfile>;
  getSchedule(targetDate?: string, userId?: string): Promise<ScheduleEvent[]>;
  createTask(taskData: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    userId?: string;
    clientRequestId?: string;
    googleTaskId?: string;
  }): Promise<Task>;
  listTasks(userId?: string): Promise<Task[]>;
  getTask(id: string, userId?: string): Promise<Task | null>;
  updateTask(id: string, updates: Partial<Task>, userId?: string): Promise<Task | null>;
  deleteTask(id: string, userId?: string): Promise<boolean>;
  stageCart(items: CartItem[], userId?: string): Promise<StagedCart>;
  getStagedCart(stageId: string, userId?: string): Promise<StagedCart | null>;
  confirmAction(tokenOrStageId: string, decision: 'APPROVE' | 'REJECT', userId?: string): Promise<{ success: boolean; message: string; stage?: StagedCart }>;
  saveWorkflowStatus(status: WorkflowStatus): Promise<void>;
  getWorkflowStatus(workflowId: string, userId?: string): Promise<WorkflowStatus | null>;
  getLatestWorkflow(userId?: string): Promise<WorkflowStatus | null>;
  resetDemoData(): Promise<void>;
}

export class LocalMemoryStorageAdapter implements StorageAdapter {
  private profile: ContextProfile;
  private schedule: ScheduleEvent[] = [];
  private tasks: Map<string, Task> = new Map();
  private stagedCarts: Map<string, StagedCart> = new Map();
  private confirmations: Map<string, ConfirmationRecord> = new Map();
  private workflows: Map<string, WorkflowStatus> = new Map();
  private latestWorkflowId: string | null = null;

  constructor() {
    this.profile = this.createDefaultProfile();
    this.initDefaultData();
  }

  private createDefaultProfile(): ContextProfile {
    return {
      userId: 'user_alex_rivera',
      userName: 'Alex Rivera',
      preferences: {
        coffee: {
          preferredBean: 'Ethiopian Yirgacheffe Single-Origin (Whole Bean)',
          bagSize: '12 oz (340g)',
          roastLevel: 'Medium-Light / Fruity & Floral',
          usualQuantity: 1,
          estimatedPrice: 18.50,
        },
        workspace: {
          focusModeScene: 'Deep Focus (Warm Amber)',
          colorTemperatureK: 2700,
          brightnessPercent: 30,
          dndEnabled: true,
        },
        calendar: {
          prepBufferMinutes: 15,
          workingHoursStart: '08:30',
          workingHoursEnd: '17:30',
        },
      },
      demoMode: true,
      notes: 'Configured for Amazon Developer Hackathon — Alexa+ track demonstration.',
    };
  }

  private initDefaultData(): void {
    // Tomorrow's date helper
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    // Seed realistic schedule for tomorrow
    this.schedule = [
      {
        id: 'evt_001',
        title: 'Q3 Product Strategy Review with Maya & Tech Leads',
        start: `${dateStr}T09:00:00.000Z`,
        end: `${dateStr}T10:00:00.000Z`,
        location: 'Virtual / Room 4B',
        description: 'Review architectural slides and milestone timeline for Nexus AI release.',
        attendees: ['maya.k@company.com', 'david.l@company.com', 'alex.r@company.com'],
        isFirstMeeting: true,
        source: 'sample_calendar_adapter',
      },
      {
        id: 'evt_002',
        title: 'Cross-Functional Team Standup',
        start: `${dateStr}T11:30:00.000Z`,
        end: `${dateStr}T12:00:00.000Z`,
        location: 'Team Bridge',
        attendees: ['team-all@company.com'],
        source: 'sample_calendar_adapter',
      },
      {
        id: 'evt_003',
        title: 'Deep Architecture Focus Block',
        start: `${dateStr}T14:00:00.000Z`,
        end: `${dateStr}T16:00:00.000Z`,
        description: 'Reserved focus window for MCP Streamable HTTP protocol hardening.',
        source: 'sample_calendar_adapter',
      },
    ];

    // Seed 1 existing baseline task
    const baselineTaskId = 'task_base_01';
    this.tasks.set(baselineTaskId, {
      id: baselineTaskId,
      title: 'Complete Alexa+ Hackathon submission checklist',
      description: 'Review architecture diagram, write demo plan, and test MCP client in simulator.',
      dueDate: `${dateStr}T17:00:00.000Z`,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async getContextProfile(userId?: string): Promise<ContextProfile> {
    if (userId && userId !== this.profile.userId) {
      return {
        ...this.profile,
        userId,
        userName: `User (${userId})`,
      };
    }
    return { ...this.profile };
  }

  async updateContextProfile(updates: Partial<ContextProfile>, userId?: string): Promise<ContextProfile> {
    this.profile = {
      ...this.profile,
      ...updates,
      userId: userId || this.profile.userId,
      preferences: {
        ...this.profile.preferences,
        ...(updates.preferences || {}),
      },
    };
    return { ...this.profile };
  }

  async getSchedule(targetDate?: string, _userId?: string): Promise<ScheduleEvent[]> {
    if (!targetDate || targetDate === 'tomorrow') {
      return [...this.schedule];
    }
    return this.schedule.filter((e) => e.start.startsWith(targetDate));
  }

  async createTask(taskData: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    userId?: string;
    clientRequestId?: string;
    googleTaskId?: string;
  }): Promise<Task> {
    const effectiveUserId = taskData.userId || this.profile.userId;

    // Idempotency check: prevent duplicate task creation on retries
    if (taskData.clientRequestId) {
      for (const t of this.tasks.values()) {
        if (t.userId === effectiveUserId && t.clientRequestId === taskData.clientRequestId) {
          return t;
        }
      }
    }

    const id = `task_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    const task: Task = {
      id,
      userId: effectiveUserId,
      title: taskData.title,
      description: taskData.description,
      dueDate: taskData.dueDate,
      priority: taskData.priority || 'MEDIUM',
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      clientRequestId: taskData.clientRequestId,
      googleTaskId: taskData.googleTaskId,
    };
    this.tasks.set(id, task);
    return task;
  }

  async listTasks(userId?: string): Promise<Task[]> {
    const all = Array.from(this.tasks.values());
    const filtered = userId ? all.filter((t) => !t.userId || t.userId === userId) : all;
    return filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getTask(id: string, userId?: string): Promise<Task | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    if (userId && task.userId && task.userId !== userId) {
      return null; // Deny access to other users' tasks
    }
    return task;
  }

  async updateTask(id: string, updates: Partial<Task>, userId?: string): Promise<Task | null> {
    const existing = this.tasks.get(id);
    if (!existing) return null;
    if (userId && existing.userId && existing.userId !== userId) {
      return null; // Deny update to other users' tasks
    }
    const updated: Task = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string, userId?: string): Promise<boolean> {
    const existing = this.tasks.get(id);
    if (!existing) return false;
    if (userId && existing.userId && existing.userId !== userId) {
      return false; // Deny deletion of other users' tasks
    }
    return this.tasks.delete(id);
  }

  async stageCart(items: CartItem[], userId?: string): Promise<StagedCart> {
    const stageId = `stage_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const token = `conf_${crypto.randomBytes(16).toString('hex')}`;
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = Math.round(subtotal * 0.0825 * 100) / 100;
    const estimatedTotal = Math.round((subtotal + tax) * 100) / 100;
    const now = new Date();
    const expires = new Date(now.getTime() + 15 * 60 * 1000); // 15 min TTL

    const staged: StagedCart = {
      stageId,
      userId: userId || this.profile.userId,
      items,
      subtotal,
      tax,
      estimatedTotal,
      currency: 'USD',
      status: 'PENDING_APPROVAL',
      confirmationToken: token,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      safetyDisclaimer: 'SAFE DEMO MODE: Cart is staged for user review. No payment method has been charged.',
    };

    this.stagedCarts.set(stageId, staged);

    this.confirmations.set(token, {
      token,
      stageId,
      actionType: 'CART_CHECKOUT',
      payload: { stageId, items, estimatedTotal, userId: staged.userId },
      status: 'PENDING',
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    });

    return staged;
  }

  async getStagedCart(stageId: string, userId?: string): Promise<StagedCart | null> {
    const cart = this.stagedCarts.get(stageId) || null;
    if (!cart) return null;
    if (userId && cart.userId && cart.userId !== userId) {
      return null;
    }
    return cart;
  }

  async confirmAction(
    tokenOrStageId: string,
    decision: 'APPROVE' | 'REJECT',
    userId?: string
  ): Promise<{ success: boolean; message: string; stage?: StagedCart }> {
    // Match either token or stageId for convenience
    let record: ConfirmationRecord | undefined = this.confirmations.get(tokenOrStageId);
    let stageId = record?.stageId;

    if (!record) {
      // Try looking up by stageId directly
      for (const rec of this.confirmations.values()) {
        if (rec.stageId === tokenOrStageId) {
          record = rec;
          stageId = rec.stageId;
          break;
        }
      }
    }

    if (!record || !stageId) {
      return {
        success: false,
        message: `No active confirmation record found for key: ${tokenOrStageId}`,
      };
    }

    const staged = this.stagedCarts.get(stageId);
    if (!staged) {
      return {
        success: false,
        message: `Staged cart ${stageId} could not be located.`,
      };
    }

    // Ownership check
    if (userId && staged.userId && staged.userId !== userId) {
      return {
        success: false,
        message: 'Action rejected: Staged cart belongs to another user.',
      };
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      record.status = 'EXPIRED';
      return {
        success: false,
        message: 'This confirmation request has expired (15 minute TTL exceeded).',
      };
    }

    if (decision === 'APPROVE') {
      record.status = 'APPROVED';
      staged.status = 'APPROVED';
      return {
        success: true,
        message: `Action approved! Order for ${staged.items.map((i) => i.title).join(', ')} marked as approved for fulfillment. (Demo safe mode — no real bank transaction executed).`,
        stage: staged,
      };
    } else {
      record.status = 'REJECTED';
      staged.status = 'CANCELLED';
      return {
        success: true,
        message: `Action rejected. Staged cart ${stageId} has been cancelled.`,
        stage: staged,
      };
    }
  }

  async saveWorkflowStatus(status: WorkflowStatus): Promise<void> {
    this.workflows.set(status.workflowId, status);
    this.latestWorkflowId = status.workflowId;
  }

  async getWorkflowStatus(workflowId: string, userId?: string): Promise<WorkflowStatus | null> {
    const wf = this.workflows.get(workflowId) || null;
    if (!wf) return null;
    if (userId && wf.userId && wf.userId !== userId) {
      return null;
    }
    return wf;
  }

  async getLatestWorkflow(userId?: string): Promise<WorkflowStatus | null> {
    if (!this.latestWorkflowId) return null;
    const wf = this.workflows.get(this.latestWorkflowId) || null;
    if (!wf) return null;
    if (userId && wf.userId && wf.userId !== userId) {
      return null;
    }
    return wf;
  }

  async resetDemoData(): Promise<void> {
    this.tasks.clear();
    this.stagedCarts.clear();
    this.confirmations.clear();
    this.workflows.clear();
    this.latestWorkflowId = null;
    this.profile = this.createDefaultProfile();
    this.initDefaultData();
  }
}

export {
  FirestoreStorageAdapter,
  createMockFirestore,
  DEFAULT_FIREBASE_PROJECT_ID,
  DEFAULT_FIRESTORE_DATABASE_ID,
  type FirestoreAdapterOptions,
} from './firestore.js';

// Global singleton instance for nexus-core
export let persistence: StorageAdapter = new LocalMemoryStorageAdapter();

export function setStorageAdapter(adapter: StorageAdapter): void {
  persistence = adapter;
}

export function getStorageAdapter(): StorageAdapter {
  return persistence;
}

export interface PersistenceInitOptions {
  mode?: 'firestore' | 'memory';
  databaseId?: string;
  projectId?: string;
  firestore?: any;
  app?: any;
  verifyOnStartup?: boolean;
  force?: boolean;
}

/**
 * Initialize backend persistence.
 *
 * Rules:
 * - Production (`NODE_ENV === 'production'`) or `STORAGE_MODE === 'firestore'`:
 *     Requires FirestoreStorageAdapter. FAILS CLOSED if Firestore is unconfigured
 *     or unreachable. Does NOT silently fallback to in-memory.
 * - Test / Development (`STORAGE_MODE === 'memory'` or `NODE_ENV === 'test'`):
 *     Uses LocalMemoryStorageAdapter for fast, isolated testing.
 */
export async function initPersistence(
  options?: PersistenceInitOptions
): Promise<StorageAdapter> {
  const isProduction = process.env.NODE_ENV === 'production';
  const mode =
    options?.mode ||
    process.env.STORAGE_MODE ||
    (isProduction ? 'firestore' : 'memory');

  if (mode === 'firestore') {
    try {
      const { FirestoreStorageAdapter } = await import('./firestore.js');
      const adapter = new FirestoreStorageAdapter({
        projectId: options?.projectId,
        databaseId: options?.databaseId,
        firestore: options?.firestore,
        app: options?.app,
      });

      // Verify live connectivity in production or when explicitly requested
      if (options?.verifyOnStartup !== false && (isProduction || options?.verifyOnStartup === true)) {
        await adapter.verifyConnection();
      }

      persistence = adapter;
      console.log(
        `[Persistence] FirestoreStorageAdapter active on database "${adapter.databaseId}" (project: "${adapter.projectId}").`
      );
      return adapter;
    } catch (err) {
      if (isProduction || process.env.STORAGE_MODE === 'firestore') {
        // Strict Fail Closed: Never silently fallback to in-memory in production
        throw new Error(
          `[Persistence] Failed to initialize mandatory FirestoreStorageAdapter in production: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      console.warn(
        `[Persistence] Firestore initialization failed in development: ${err instanceof Error ? err.message : String(err)}. Falling back to LocalMemoryStorageAdapter.`
      );
      const fallback = new LocalMemoryStorageAdapter();
      persistence = fallback;
      return fallback;
    }
  }

  // Explicit in-memory adapter for testing / dev loopback demo
  if (!options?.force && persistence instanceof LocalMemoryStorageAdapter) {
    return persistence;
  }
  const memAdapter = new LocalMemoryStorageAdapter();
  persistence = memAdapter;
  return memAdapter;
}
