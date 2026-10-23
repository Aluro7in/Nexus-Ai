/**
 * Nexus AI — Cloud Firestore Storage Adapter Test Suite
 *
 * Validates:
 * 1. Create, read, update, and delete (CRUD) task operations.
 * 2. Persisting tasks across simulated backend process restarts.
 * 3. Staging and retrieving shopping carts with frontend collection mirroring.
 * 4. Persisting multi-step autonomous workflow statuses and step outcomes.
 * 5. Two-phase action confirmation validation, approval, rejection, and TTL expiration.
 * 6. Multi-tenant cross-user access rejection (tasks, carts, workflows, confirmations).
 * 7. Missing Firebase credentials handling.
 * 8. Strict fail-closed behavior in production mode on connection failure.
 * 9. Correct selection of configured Firebase project ID and named database ID.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FirestoreStorageAdapter,
  createMockFirestore,
  DEFAULT_FIREBASE_PROJECT_ID,
  DEFAULT_FIRESTORE_DATABASE_ID,
} from '../src/store/firestore.js';
import { initPersistence, setStorageAdapter } from '../src/store/persistence.js';
import { setFirebaseAdminApp } from '../src/auth.js';
import type { Task, WorkflowStatus } from '../src/types.js';

describe('Nexus AI — Firestore Persistence Engine', () => {
  let mockDb: any;
  let adapter: FirestoreStorageAdapter;

  beforeEach(() => {
    mockDb = createMockFirestore();
    adapter = new FirestoreStorageAdapter({
      firestore: mockDb,
      projectId: DEFAULT_FIREBASE_PROJECT_ID,
      databaseId: DEFAULT_FIRESTORE_DATABASE_ID,
    });
    setStorageAdapter(adapter);
  });

  afterEach(() => {
    setFirebaseAdminApp(null);
  });

  describe('1. Task CRUD Operations & Idempotency', () => {
    it('creates, retrieves, updates, and deletes tasks with ownership', async () => {
      // 1. Create task
      const created = await adapter.createTask({
        title: 'Review Hackathon Architecture Slides',
        description: 'Verify MCP Streamable HTTP transport specifications.',
        priority: 'HIGH',
        userId: 'user_alex',
        dueDate: '2026-10-23T10:00:00Z',
      });

      expect(created.id).toMatch(/^task_/);
      expect(created.title).toBe('Review Hackathon Architecture Slides');
      expect(created.userId).toBe('user_alex');
      expect(created.status).toBe('PENDING');

      // 2. Read task
      const retrieved = await adapter.getTask(created.id, 'user_alex');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.priority).toBe('HIGH');

      // 3. Update task
      const updated = await adapter.updateTask(
        created.id,
        { status: 'COMPLETED', description: 'Updated specs.' },
        'user_alex'
      );
      expect(updated).not.toBeNull();
      expect(updated?.status).toBe('COMPLETED');
      expect(updated?.description).toBe('Updated specs.');

      // 4. List tasks for user
      const list = await adapter.listTasks('user_alex');
      expect(list.some((t) => t.id === created.id)).toBe(true);

      // 5. Delete task
      const deleted = await adapter.deleteTask(created.id, 'user_alex');
      expect(deleted).toBe(true);

      const afterDelete = await adapter.getTask(created.id, 'user_alex');
      expect(afterDelete).toBeNull();
    });

    it('prevents duplicate task creation when retrying with clientRequestId', async () => {
      const clientRequestId = 'req_idempotent_12345';

      const task1 = await adapter.createTask({
        title: 'Idempotent Sync Task',
        userId: 'user_alex',
        clientRequestId,
      });

      const task2 = await adapter.createTask({
        title: 'Idempotent Sync Task (Retry)',
        userId: 'user_alex',
        clientRequestId,
      });

      // Must return identical task without generating duplicate document
      expect(task2.id).toBe(task1.id);
      expect(task2.createdAt).toBe(task1.createdAt);

      const allTasks = await adapter.listTasks('user_alex');
      const matching = allTasks.filter((t) => t.clientRequestId === clientRequestId);
      expect(matching.length).toBe(1);
    });
  });

  describe('2. Persistence Across Backend Restarts', () => {
    it('persists tasks across simulated backend process restarts using the same database store', async () => {
      // Shared backing store representing durable database state
      const sharedBackingStore = new Map<string, Map<string, any>>();

      // 1. First server process instance creates a task
      const processInstance1Db = createMockFirestore({ store: sharedBackingStore });
      const processInstance1Adapter = new FirestoreStorageAdapter({
        firestore: processInstance1Db,
        projectId: DEFAULT_FIREBASE_PROJECT_ID,
        databaseId: DEFAULT_FIRESTORE_DATABASE_ID,
      });

      const initialTask = await processInstance1Adapter.createTask({
        title: 'Durable Task Across Restart',
        description: 'Verifies state survives server process termination.',
        priority: 'HIGH',
        userId: 'user_durable',
      });

      // 2. Simulate server shutdown: instance 1 is disposed
      // 3. Simulate new server process startup: instance 2 connects to the same database
      const processInstance2Db = createMockFirestore({ store: sharedBackingStore });
      const processInstance2Adapter = new FirestoreStorageAdapter({
        firestore: processInstance2Db,
        projectId: DEFAULT_FIREBASE_PROJECT_ID,
        databaseId: DEFAULT_FIRESTORE_DATABASE_ID,
      });

      const recoveredTask = await processInstance2Adapter.getTask(
        initialTask.id,
        'user_durable'
      );

      expect(recoveredTask).not.toBeNull();
      expect(recoveredTask?.id).toBe(initialTask.id);
      expect(recoveredTask?.title).toBe('Durable Task Across Restart');
      expect(recoveredTask?.userId).toBe('user_durable');

      const userTaskList = await processInstance2Adapter.listTasks('user_durable');
      expect(userTaskList.length).toBe(1);
      expect(userTaskList[0].id).toBe(initialTask.id);
    });
  });

  describe('3. Staging and Retrieving Commerce Carts', () => {
    it('stages a cart with approval hold and mirrors to frontend commerce_orders collection', async () => {
      const cart = await adapter.stageCart(
        [
          {
            id: 'item_beans',
            title: 'Ethiopian Yirgacheffe Single-Origin (Whole Bean)',
            category: 'Coffee',
            quantity: 2,
            unitPrice: 18.5,
            totalPrice: 37.0,
          },
        ],
        'user_alex'
      );

      expect(cart.stageId).toMatch(/^stage_/);
      expect(cart.confirmationToken).toMatch(/^conf_/);
      expect(cart.status).toBe('PENDING_APPROVAL');
      expect(cart.subtotal).toBe(37.0);
      expect(cart.estimatedTotal).toBeGreaterThan(37.0); // includes tax

      // Retrieve via adapter
      const retrieved = await adapter.getStagedCart(cart.stageId, 'user_alex');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.stageId).toBe(cart.stageId);
      expect(retrieved?.items.length).toBe(1);

      // Verify frontend compatibility collection /commerce_orders was populated
      const commerceOrderDoc = await mockDb
        .collection('commerce_orders')
        .doc(cart.stageId)
        .get();
      expect(commerceOrderDoc.exists).toBe(true);
      const orderData = commerceOrderDoc.data();
      expect(orderData.totalAmount).toBe(cart.estimatedTotal);
      expect(orderData.status).toBe('PENDING_APPROVAL');
      expect(orderData.approvalRequired).toBe(true);
    });
  });

  describe('4. Autonomous Workflow Status and Step Outcomes', () => {
    it('persists complete multi-step workflow outcomes and updates latest pointer', async () => {
      const workflow: WorkflowStatus = {
        workflowId: 'wf_demo_98765',
        userId: 'user_alex',
        query: 'Prepare my afternoon, check schedule, and stage coffee',
        startedAt: '2026-10-22T10:00:00Z',
        completedAt: '2026-10-22T10:00:05Z',
        state: 'AWAITING_APPROVAL',
        operations: [
          {
            step: 1,
            tool: 'nexus_get_context',
            name: 'Retrieve User Preferences',
            input: { query: 'coffee' },
            output: { preferredCoffee: 'Ethiopian' },
            status: 'SUCCESS',
            timestamp: '2026-10-22T10:00:01Z',
          },
          {
            step: 2,
            tool: 'nexus_stage_cart',
            name: 'Stage Coffee Order',
            input: { quantity: 1 },
            output: { stageId: 'stage_test_123', status: 'PENDING_APPROVAL' },
            status: 'PENDING_APPROVAL',
            timestamp: '2026-10-22T10:00:04Z',
          },
        ],
        summary: 'Prepared afternoon: workspace lights Amber, coffee order staged for $18.50.',
        pendingAction: {
          type: 'CART_CHECKOUT',
          stageId: 'stage_test_123',
          confirmationToken: 'conf_test_abc',
          description: 'Place order for Ethiopian Coffee ($18.50)',
          amount: 18.5,
        },
      };

      await adapter.saveWorkflowStatus(workflow);

      // 1. Retrieve by workflow ID
      const retrieved = await adapter.getWorkflowStatus('wf_demo_98765', 'user_alex');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.workflowId).toBe('wf_demo_98765');
      expect(retrieved?.operations.length).toBe(2);
      expect(retrieved?.state).toBe('AWAITING_APPROVAL');
      expect(retrieved?.pendingAction?.amount).toBe(18.5);

      // 2. Retrieve via latest workflow pointer
      const latest = await adapter.getLatestWorkflow('user_alex');
      expect(latest).not.toBeNull();
      expect(latest?.workflowId).toBe('wf_demo_98765');
    });
  });

  describe('5. Two-Phase Action Confirmation Engine & Expiration', () => {
    it('approves a staged cart only with valid token/stageId and updates status', async () => {
      const cart = await adapter.stageCart(
        [{ id: 'item_1', title: 'Beans', category: 'Coffee', quantity: 1, unitPrice: 20, totalPrice: 20 }],
        'user_alex'
      );

      const result = await adapter.confirmAction(cart.confirmationToken, 'APPROVE', 'user_alex');
      expect(result.success).toBe(true);
      expect(result.stage?.status).toBe('APPROVED');

      // Verify persisted state reflects approval
      const updatedCart = await adapter.getStagedCart(cart.stageId, 'user_alex');
      expect(updatedCart?.status).toBe('APPROVED');

      // Verify mirrored commerce order reflects approval
      const orderDoc = await mockDb.collection('commerce_orders').doc(cart.stageId).get();
      expect(orderDoc.data().status).toBe('APPROVED');
    });

    it('cancels a staged cart on user rejection', async () => {
      const cart = await adapter.stageCart(
        [{ id: 'item_1', title: 'Beans', category: 'Coffee', quantity: 1, unitPrice: 20, totalPrice: 20 }],
        'user_alex'
      );

      const result = await adapter.confirmAction(cart.stageId, 'REJECT', 'user_alex');
      expect(result.success).toBe(true);
      expect(result.stage?.status).toBe('CANCELLED');

      const updatedCart = await adapter.getStagedCart(cart.stageId, 'user_alex');
      expect(updatedCart?.status).toBe('CANCELLED');
    });

    it('rejects confirmation when approval token has expired (>15 min TTL)', async () => {
      const cart = await adapter.stageCart(
        [{ id: 'item_1', title: 'Beans', category: 'Coffee', quantity: 1, unitPrice: 20, totalPrice: 20 }],
        'user_alex'
      );

      // Simulate token expiration by manually winding back expiresAt in database
      const expiredDate = new Date(Date.now() - 60000).toISOString();
      await mockDb.collection('confirmations').doc(cart.confirmationToken).update({
        expiresAt: expiredDate,
      });

      const result = await adapter.confirmAction(cart.confirmationToken, 'APPROVE', 'user_alex');
      expect(result.success).toBe(false);
      expect(result.message).toContain('expired');

      const confDoc = await mockDb.collection('confirmations').doc(cart.confirmationToken).get();
      expect(confDoc.data().status).toBe('EXPIRED');
    });
  });

  describe('6. Multi-Tenant User Ownership & Isolation', () => {
    it('strictly denies cross-user task access, modification, and deletion', async () => {
      const aliceTask = await adapter.createTask({
        title: 'Alice Private Notes',
        userId: 'user_alice',
      });

      // Bob cannot view Alice's task
      const bobView = await adapter.getTask(aliceTask.id, 'user_bob');
      expect(bobView).toBeNull();

      // Bob cannot modify Alice's task
      const bobUpdate = await adapter.updateTask(
        aliceTask.id,
        { title: 'Hacked Title' },
        'user_bob'
      );
      expect(bobUpdate).toBeNull();

      // Bob cannot delete Alice's task
      const bobDelete = await adapter.deleteTask(aliceTask.id, 'user_bob');
      expect(bobDelete).toBe(false);

      // Alice can view her own task intact
      const aliceView = await adapter.getTask(aliceTask.id, 'user_alice');
      expect(aliceView?.title).toBe('Alice Private Notes');
    });

    it('prevents callers from transferring task ownership to another user', async () => {
      const aliceTask = await adapter.createTask({
        title: 'Original Task',
        userId: 'user_alice',
      });

      // Attempt to spoof ownership transfer
      await adapter.updateTask(
        aliceTask.id,
        { userId: 'user_bob' } as any,
        'user_alice'
      );

      const task = await adapter.getTask(aliceTask.id, 'user_alice');
      expect(task?.userId).toBe('user_alice');
      expect(task?.userId).not.toBe('user_bob');
    });

    it('denies cross-user cart retrieval and confirmation', async () => {
      const aliceCart = await adapter.stageCart(
        [{ id: 'item_1', title: 'Beans', category: 'Coffee', quantity: 1, unitPrice: 20, totalPrice: 20 }],
        'user_alice'
      );

      // Bob cannot read Alice's staged cart
      const bobCart = await adapter.getStagedCart(aliceCart.stageId, 'user_bob');
      expect(bobCart).toBeNull();

      // Bob cannot approve Alice's cart
      const bobConfirm = await adapter.confirmAction(aliceCart.confirmationToken, 'APPROVE', 'user_bob');
      expect(bobConfirm.success).toBe(false);
      expect(bobConfirm.message).toContain('another user');
    });

    it('denies cross-user workflow inspection and latest workflow leaks', async () => {
      await adapter.saveWorkflowStatus({
        workflowId: 'wf_alice_confidential',
        userId: 'user_alice',
        query: 'Alice private query',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        state: 'COMPLETED',
        operations: [],
        summary: 'Alice summary',
      });

      // Bob cannot read Alice's workflow
      const bobWorkflow = await adapter.getWorkflowStatus('wf_alice_confidential', 'user_bob');
      expect(bobWorkflow).toBeNull();

      // Bob's latest workflow query returns null
      const bobLatest = await adapter.getLatestWorkflow('user_bob');
      expect(bobLatest).toBeNull();
    });
  });

  describe('7. Missing Credentials & Fail-Closed Behavior', () => {
    it('throws descriptive error when initializing live Firestore without credentials', () => {
      expect(() => new FirestoreStorageAdapter({ app: null })).toThrow(
        /Live Firestore connectivity requires Application Default Credentials/
      );
    });

    it('fails closed in production mode when Firestore is unconfigured or unreachable', async () => {
      const origEnv = process.env.NODE_ENV;
      const origStorage = process.env.STORAGE_MODE;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.STORAGE_MODE;

        // In production, initPersistence must throw and fail closed (no silent in-memory fallback)
        await expect(
          initPersistence({ mode: 'firestore', force: true, app: null })
        ).rejects.toThrow(/Failed to initialize mandatory FirestoreStorageAdapter in production/);
      } finally {
        process.env.NODE_ENV = origEnv;
        process.env.STORAGE_MODE = origStorage;
      }
    });
  });

  describe('8. Database and Project Identifier Selection', () => {
    it('binds to verified project ID and named database ID', () => {
      const customDb = createMockFirestore({ databaseId: 'ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46' });
      const customAdapter = new FirestoreStorageAdapter({
        firestore: customDb,
        projectId: 'gen-lang-client-0651785302',
        databaseId: 'ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46',
      });

      expect(customAdapter.projectId).toBe('gen-lang-client-0651785302');
      expect(customAdapter.databaseId).toBe('ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46');
      expect(customAdapter.firestore.databaseId).toBe('ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46');
    });
  });
});
