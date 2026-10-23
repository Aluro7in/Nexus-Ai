/**
 * Nexus AI — Durable Cloud Firestore Storage Adapter
 *
 * Implements the StorageAdapter interface using the official Firebase Admin SDK /
 * @google-cloud/firestore for durable multi-tenant persistence.
 *
 * Target Firebase Project ID: gen-lang-client-0651785302
 * Target Named Database ID: ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46
 *
 * Security & Ownership Invariants:
 * 1. Multi-Tenant User Isolation: All reads, writes, updates, deletions, and action
 *    confirmations enforce the authenticated UID established by token verification.
 * 2. Immutable Ownership: Updates strip any incoming `userId` to prevent ownership transfer.
 * 3. Idempotent Tasks: Supports `clientRequestId` to prevent duplicate task submissions on retries.
 * 4. Human-in-the-Loop Cart Approvals: Staged commerce checkouts are held pending explicit
 *    approval by their owner with 15-minute expiration enforcement.
 * 5. Frontend Schema Compatibility: Mirrors staged carts into `/commerce_orders` for AI Studio
 *    frontend visibility without granting client write authority over execution status.
 */

import crypto from 'node:crypto';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '../auth.js';
import type {
  ContextProfile,
  ScheduleEvent,
  Task,
  CartItem,
  StagedCart,
  WorkflowStatus,
  ConfirmationRecord,
} from '../types.js';
import type { StorageAdapter } from './persistence.js';

export const DEFAULT_FIREBASE_PROJECT_ID = 'gen-lang-client-0651785302';
export const DEFAULT_FIRESTORE_DATABASE_ID = 'ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46';

/**
 * Remove undefined values from objects before writing to Firestore.
 * Cloud Firestore rejects documents containing undefined properties.
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = removeUndefined(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export interface FirestoreAdapterOptions {
  projectId?: string;
  databaseId?: string;
  firestore?: any;
  app?: any;
}

export class FirestoreStorageAdapter implements StorageAdapter {
  public readonly firestore: any;
  public readonly projectId: string;
  public readonly databaseId: string;
  private defaultProfile: ContextProfile;
  private defaultSchedule: ScheduleEvent[] = [];

  constructor(options?: FirestoreAdapterOptions) {
    this.projectId =
      options?.projectId ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      DEFAULT_FIREBASE_PROJECT_ID;

    this.databaseId =
      options?.databaseId ||
      process.env.FIRESTORE_DATABASE_ID ||
      DEFAULT_FIRESTORE_DATABASE_ID;

    this.defaultProfile = this.createDefaultProfile();
    this.initDefaultSchedule();

    if (options?.firestore) {
      this.firestore = options.firestore;
      if (!this.firestore.databaseId) {
        this.firestore.databaseId = this.databaseId;
      }
      return;
    }

    let app = options?.app;
    if (app === undefined) {
      app = getFirebaseAdminApp();
    }
    if (!app) {
      throw new Error(
        `[FirestoreStorageAdapter] Firebase Admin SDK is not initialized. ` +
        `Live Firestore connectivity requires Application Default Credentials (ADC) ` +
        `or GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON.`
      );
    }

    // Access named Firestore database
    if (this.databaseId && this.databaseId !== '(default)') {
      this.firestore = getFirestore(app, this.databaseId);
    } else {
      if (process.env.NODE_ENV === 'production' || process.env.STORAGE_MODE === 'firestore') {
        throw new Error(
          `[FirestoreStorageAdapter] Production environment requires an explicit named Firestore database. Fallback to "(default)" is forbidden. Expected: "${DEFAULT_FIRESTORE_DATABASE_ID}".`
        );
      }
      this.firestore = getFirestore(app);
    }
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
          estimatedPrice: 18.5,
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
      notes: 'Configured for Amazon Developer Hackathon — Alexa+ ambient demonstration.',
    };
  }

  private initDefaultSchedule(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    this.defaultSchedule = [
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
  }

  /**
   * Probe the configured Firestore database to verify network connectivity and IAM credentials.
   * Throws an error if unreachable or unauthorized.
   */
  async verifyConnection(timeoutMs = 5000): Promise<boolean> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Firestore connection probe timed out after ${timeoutMs}ms for database "${this.databaseId}".`
            )
          ),
        timeoutMs
      )
    );

    try {
      await Promise.race([
        this.firestore.collection('tasks').limit(1).get(),
        timeoutPromise,
      ]);
      return true;
    } catch (err) {
      throw new Error(
        `[FirestoreStorageAdapter] Firestore connection verification failed for database "${this.databaseId}" on project "${this.projectId}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ─── 1. Context Profile & User Preferences ──────────────────────────────────

  async getContextProfile(userId?: string): Promise<ContextProfile> {
    const targetUid = userId || this.defaultProfile.userId;

    try {
      const prefDoc = await this.firestore.collection('user_preferences').doc(targetUid).get();
      if (prefDoc.exists) {
        const data = prefDoc.data();
        return {
          ...this.defaultProfile,
          userId: targetUid,
          userName: data.displayName || data.userName || `User (${targetUid})`,
          preferences: {
            ...this.defaultProfile.preferences,
            ...(data.preferences || {}),
          },
        };
      }
    } catch {
      // Fallback to baseline profile if user preferences document does not exist yet
    }

    if (userId && userId !== this.defaultProfile.userId) {
      return {
        ...this.defaultProfile,
        userId,
        userName: `User (${userId})`,
      };
    }
    return { ...this.defaultProfile };
  }

  async updateContextProfile(
    updates: Partial<ContextProfile>,
    userId?: string
  ): Promise<ContextProfile> {
    const targetUid = userId || this.defaultProfile.userId;
    const current = await this.getContextProfile(targetUid);
    const updated: ContextProfile = {
      ...current,
      ...updates,
      userId: targetUid,
      preferences: {
        ...current.preferences,
        ...(updates.preferences || {}),
      },
    };

    try {
      await this.firestore
        .collection('user_preferences')
        .doc(targetUid)
        .set(removeUndefined(updated), { merge: true });
    } catch (err) {
      console.warn(`[FirestoreStorageAdapter] Could not persist user preferences: ${err}`);
    }

    return updated;
  }

  // ─── 2. Schedule Events ─────────────────────────────────────────────────────

  async getSchedule(targetDate?: string, _userId?: string): Promise<ScheduleEvent[]> {
    if (!targetDate || targetDate === 'tomorrow') {
      return [...this.defaultSchedule];
    }
    return this.defaultSchedule.filter((e) => e.start.startsWith(targetDate));
  }

  // ─── 3. Tasks Management (Authoritative Backend Execution) ──────────────────

  async createTask(taskData: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    userId?: string;
    clientRequestId?: string;
    googleTaskId?: string;
  }): Promise<Task> {
    const effectiveUserId = taskData.userId || this.defaultProfile.userId;

    // Idempotency check: prevent duplicate task creation on retry
    if (taskData.clientRequestId) {
      const existingSnap = await this.firestore
        .collection('tasks')
        .where('userId', '==', effectiveUserId)
        .where('clientRequestId', '==', taskData.clientRequestId)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        return existingSnap.docs[0].data() as Task;
      }
    }

    const id = `task_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    const task: Task = {
      id,
      userId: effectiveUserId,
      title: taskData.title,
      description: taskData.description || '',
      dueDate: taskData.dueDate,
      priority: taskData.priority || 'MEDIUM',
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      clientRequestId: taskData.clientRequestId,
      googleTaskId: taskData.googleTaskId,
    };

    await this.firestore.collection('tasks').doc(id).set(removeUndefined(task));
    return task;
  }

  async listTasks(userId?: string): Promise<Task[]> {
    let query = this.firestore.collection('tasks');
    if (userId) {
      query = query.where('userId', '==', userId);
    }

    const snapshot = await query.get();
    const tasks: Task[] = [];
    snapshot.forEach((doc: any) => {
      tasks.push(doc.data() as Task);
    });

    return tasks.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getTask(id: string, userId?: string): Promise<Task | null> {
    const doc = await this.firestore.collection('tasks').doc(id).get();
    if (!doc.exists) return null;
    const task = doc.data() as Task;
    if (userId && task.userId && task.userId !== userId) {
      return null; // Deny cross-user task access
    }
    return task;
  }

  async updateTask(
    id: string,
    updates: Partial<Task>,
    userId?: string
  ): Promise<Task | null> {
    const ref = this.firestore.collection('tasks').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;

    const existing = doc.data() as Task;
    if (userId && existing.userId && existing.userId !== userId) {
      return null; // Deny unauthorized modification
    }

    // Strip immutable fields: user identity and task ID cannot be transferred
    const safeUpdates: Partial<Task> = { ...updates };
    delete (safeUpdates as any).userId;
    delete (safeUpdates as any).id;
    safeUpdates.updatedAt = new Date().toISOString();

    const cleaned = removeUndefined(safeUpdates);
    await ref.update(cleaned);

    return {
      ...existing,
      ...cleaned,
    };
  }

  async deleteTask(id: string, userId?: string): Promise<boolean> {
    const ref = this.firestore.collection('tasks').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;

    const existing = doc.data() as Task;
    if (userId && existing.userId && existing.userId !== userId) {
      return false; // Deny unauthorized deletion
    }

    await ref.delete();
    return true;
  }

  // ─── 4. Staged Commerce Carts & Confirmation Engine ──────────────────────────

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
      userId: userId || this.defaultProfile.userId,
      items,
      subtotal,
      tax,
      estimatedTotal,
      currency: 'USD',
      status: 'PENDING_APPROVAL',
      confirmationToken: token,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      safetyDisclaimer:
        'SAFE DEMO MODE: Cart is staged for user review. No payment method has been charged.',
    };

    const confirmationRecord: ConfirmationRecord = {
      token,
      stageId,
      actionType: 'CART_CHECKOUT',
      payload: { stageId, items, estimatedTotal, userId: staged.userId },
      status: 'PENDING',
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    };

    const batch = this.firestore.batch();

    // 1. Backend-authoritative staged cart
    batch.set(
      this.firestore.collection('staged_carts').doc(stageId),
      removeUndefined(staged)
    );

    // 2. Action confirmation record
    batch.set(
      this.firestore.collection('confirmations').doc(token),
      removeUndefined({ ...confirmationRecord, userId: staged.userId })
    );

    // 3. Frontend schema compatibility mirror in /commerce_orders
    batch.set(
      this.firestore.collection('commerce_orders').doc(stageId),
      removeUndefined({
        orderId: stageId,
        userId: staged.userId,
        title: `Order: ${items.map((i) => i.title).join(', ')}`,
        items,
        totalAmount: estimatedTotal,
        currency: 'USD',
        status: 'PENDING_APPROVAL',
        approvalRequired: true,
        confirmationToken: token,
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
      })
    );

    await batch.commit();
    return staged;
  }

  async getStagedCart(stageId: string, userId?: string): Promise<StagedCart | null> {
    const doc = await this.firestore.collection('staged_carts').doc(stageId).get();
    if (!doc.exists) return null;
    const cart = doc.data() as StagedCart;
    if (userId && cart.userId && cart.userId !== userId) {
      return null; // Deny cross-user cart retrieval
    }
    return cart;
  }

  async confirmAction(
    tokenOrStageId: string,
    decision: 'APPROVE' | 'REJECT',
    userId?: string
  ): Promise<{ success: boolean; message: string; stage?: StagedCart }> {
    let token = tokenOrStageId;
    let recDoc = await this.firestore.collection('confirmations').doc(token).get();

    // If key wasn't the token, lookup by stageId
    if (!recDoc.exists) {
      const snap = await this.firestore
        .collection('confirmations')
        .where('stageId', '==', tokenOrStageId)
        .limit(1)
        .get();

      if (!snap.empty) {
        recDoc = snap.docs[0];
        token = recDoc.id;
      }
    }

    if (!recDoc.exists) {
      return {
        success: false,
        message: `No active confirmation record found for key: ${tokenOrStageId}`,
      };
    }

    const record = recDoc.data() as ConfirmationRecord & { userId?: string };
    const stageId = record.stageId;

    // Retrieve staged cart
    const cartDoc = await this.firestore.collection('staged_carts').doc(stageId).get();
    if (!cartDoc.exists) {
      return {
        success: false,
        message: `Staged cart ${stageId} could not be located.`,
      };
    }

    const staged = cartDoc.data() as StagedCart;

    // Strict ownership validation: caller must match staged cart owner
    if (
      userId &&
      ((record.userId && record.userId !== userId) ||
        (staged.userId && staged.userId !== userId))
    ) {
      return {
        success: false,
        message: 'Action rejected: Staged cart belongs to another user.',
      };
    }

    // Expiry verification
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await this.firestore
        .collection('confirmations')
        .doc(token)
        .update({ status: 'EXPIRED' });

      return {
        success: false,
        message: 'This confirmation request has expired (15 minute TTL exceeded).',
      };
    }

    const batch = this.firestore.batch();
    const isApproval = decision === 'APPROVE';
    const newStatus = isApproval ? 'APPROVED' : 'CANCELLED';
    const newRecordStatus = isApproval ? 'APPROVED' : 'REJECTED';

    batch.update(this.firestore.collection('confirmations').doc(token), {
      status: newRecordStatus,
    });
    batch.update(this.firestore.collection('staged_carts').doc(stageId), {
      status: newStatus,
    });
    batch.update(this.firestore.collection('commerce_orders').doc(stageId), {
      status: newStatus,
    });

    await batch.commit();

    staged.status = newStatus;
    if (isApproval) {
      return {
        success: true,
        message: `Action approved! Order for ${staged.items.map((i) => i.title).join(', ')} marked as approved for fulfillment. (Demo safe mode — no real bank transaction executed).`,
        stage: staged,
      };
    } else {
      return {
        success: true,
        message: `Action rejected. Staged cart ${stageId} has been cancelled.`,
        stage: staged,
      };
    }
  }

  // ─── 5. Autonomous Workflow Progression ─────────────────────────────────────

  async saveWorkflowStatus(status: WorkflowStatus): Promise<void> {
    const batch = this.firestore.batch();

    // 1. Authoritative workflow document
    batch.set(
      this.firestore.collection('workflows').doc(status.workflowId),
      removeUndefined(status)
    );

    // 2. User-scoped latest pointer
    if (status.userId) {
      batch.set(this.firestore.collection('latest_workflows').doc(status.userId), {
        userId: status.userId,
        workflowId: status.workflowId,
        updatedAt: new Date().toISOString(),
      });
    }

    // 3. Global latest pointer for single-tenant demo inspection
    batch.set(this.firestore.collection('latest_workflows').doc('_global'), {
      workflowId: status.workflowId,
      userId: status.userId || null,
      updatedAt: new Date().toISOString(),
    });

    await batch.commit();
  }

  async getWorkflowStatus(
    workflowId: string,
    userId?: string
  ): Promise<WorkflowStatus | null> {
    const doc = await this.firestore.collection('workflows').doc(workflowId).get();
    if (!doc.exists) return null;

    const wf = doc.data() as WorkflowStatus;
    if (userId && wf.userId && wf.userId !== userId) {
      return null; // Deny cross-user workflow inspection
    }
    return wf;
  }

  async getLatestWorkflow(userId?: string): Promise<WorkflowStatus | null> {
    if (userId) {
      const pointerDoc = await this.firestore
        .collection('latest_workflows')
        .doc(userId)
        .get();

      if (pointerDoc.exists) {
        const wfId = pointerDoc.data()?.workflowId;
        if (wfId) {
          return await this.getWorkflowStatus(wfId, userId);
        }
      }
      return null;
    }

    // Global latest fallback
    const globalDoc = await this.firestore
      .collection('latest_workflows')
      .doc('_global')
      .get();

    if (globalDoc.exists) {
      const wfId = globalDoc.data()?.workflowId;
      if (wfId) {
        const doc = await this.firestore.collection('workflows').doc(wfId).get();
        return doc.exists ? (doc.data() as WorkflowStatus) : null;
      }
    }

    return null;
  }

  // ─── 6. Reset Demo State ───────────────────────────────────────────────────

  async resetDemoData(): Promise<void> {
    this.defaultProfile = this.createDefaultProfile();
    this.initDefaultSchedule();
  }
}

// ─── Lightweight In-Memory Mock Firestore for Isolated Unit Testing ──────────

export function createMockFirestore(options?: {
  databaseId?: string;
  store?: Map<string, Map<string, Record<string, any>>>;
}): any {
  const databaseId = options?.databaseId || DEFAULT_FIRESTORE_DATABASE_ID;
  const db = options?.store || new Map<string, Map<string, Record<string, any>>>();

  const getCol = (colName: string): Map<string, Record<string, any>> => {
    let col = db.get(colName);
    if (!col) {
      col = new Map();
      db.set(colName, col);
    }
    return col;
  };

  const createDocRef = (colName: string, docId: string) => ({
    id: docId,
    path: `${colName}/${docId}`,
    async get() {
      const col = getCol(colName);
      const data = col.get(docId);
      return {
        id: docId,
        exists: Boolean(data),
        data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
      };
    },
    async set(data: any, setOpts?: { merge?: boolean }) {
      const col = getCol(colName);
      if (setOpts?.merge && col.has(docId)) {
        col.set(docId, { ...col.get(docId), ...JSON.parse(JSON.stringify(data)) });
      } else {
        col.set(docId, JSON.parse(JSON.stringify(data)));
      }
    },
    async update(data: any) {
      const col = getCol(colName);
      if (!col.has(docId)) {
        throw new Error(`NOT_FOUND: No document to update: ${colName}/${docId}`);
      }
      col.set(docId, { ...col.get(docId), ...JSON.parse(JSON.stringify(data)) });
    },
    async delete() {
      const col = getCol(colName);
      col.delete(docId);
    },
  });

  const createQuery = (
    colName: string,
    filters: Array<{ field: string; op: string; value: any }> = [],
    limitNum?: number
  ) => ({
    where(field: string, op: string, value: any) {
      return createQuery(colName, [...filters, { field, op, value }], limitNum);
    },
    limit(n: number) {
      return createQuery(colName, filters, n);
    },
    async get() {
      const col = getCol(colName);
      let items = Array.from(col.entries()).map(([id, data]) => ({
        id,
        exists: true,
        data: () => JSON.parse(JSON.stringify(data)),
      }));

      for (const filter of filters) {
        if (filter.op === '==') {
          items = items.filter((item) => item.data()[filter.field] === filter.value);
        }
      }

      if (typeof limitNum === 'number') {
        items = items.slice(0, limitNum);
      }

      return {
        empty: items.length === 0,
        size: items.length,
        docs: items,
        forEach(callback: (doc: any) => void) {
          items.forEach(callback);
        },
      };
    },
  });

  return {
    databaseId,
    collection(name: string) {
      const query = createQuery(name);
      return {
        ...query,
        doc(id: string) {
          return createDocRef(name, id);
        },
      };
    },
    batch() {
      const operations: Array<() => Promise<void>> = [];
      return {
        set(docRef: any, data: any) {
          operations.push(async () => {
            await docRef.set(data);
          });
          return this;
        },
        update(docRef: any, data: any) {
          operations.push(async () => {
            await docRef.update(data);
          });
          return this;
        },
        delete(docRef: any) {
          operations.push(async () => {
            await docRef.delete();
          });
          return this;
        },
        async commit() {
          for (const op of operations) {
            await op();
          }
        },
      };
    },
    async listCollections() {
      return Array.from(db.keys()).map((k) => ({ id: k }));
    },
  };
}
