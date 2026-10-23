/**
 * Nexus AI — Automated Test Suite
 *
 * Validates:
 * 1. Health check & PRM discovery endpoints.
 * 2. Official MCP tools registration and schema discovery.
 * 3. Individual tool execution (nexus_get_context, nexus_get_schedule, nexus_create_task, nexus_stage_cart).
 * 4. Two-phase confirmation safety gate (pending status, approval, rejection, and expiration).
 * 5. Full end-to-end multi-step workflow execution with failure isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { persistence } from '../src/store/persistence.js';
import { orchestrator } from '../src/orchestrator/workflow.js';
import { createNexusApp } from '../src/index.js';
import { setCustomTokenVerifier, resetAuthState } from '../src/auth.js';

describe('Nexus AI — Core Verification Suite', () => {
  beforeEach(async () => {
    process.env.DEV_AUTH_BYPASS = 'true';
    process.env.NODE_ENV = 'test';
    process.env.STORAGE_MODE = 'memory';
    resetAuthState();
    await persistence.resetDemoData();
  });

  afterEach(() => {
    resetAuthState();
  });

  describe('1. Persistence and Context Store', () => {
    it('retrieves default demo context profile with coffee and focus settings', async () => {
      const profile = await persistence.getContextProfile();
      expect(profile).toBeDefined();
      expect(profile.userName).toBe('Alex Rivera');
      expect(profile.preferences.coffee.preferredBean).toContain('Ethiopian');
      expect(profile.preferences.workspace.focusModeScene).toContain('Focus');
      expect(profile.demoMode).toBe(true);
    });

    it('returns tomorrow schedule with sample calendar adapter provenance', async () => {
      const events = await persistence.getSchedule('tomorrow');
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[0].source).toBe('sample_calendar_adapter');
      expect(events[0].title).toContain('Product Strategy Review');
    });

    it('creates, retrieves, and updates persistent tasks', async () => {
      const task = await persistence.createTask({
        title: 'Prepare demo slide deck',
        priority: 'HIGH',
      });

      expect(task.id).toMatch(/^task_/);
      expect(task.status).toBe('PENDING');

      const retrieved = await persistence.getTask(task.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Prepare demo slide deck');

      const updated = await persistence.updateTask(task.id, { status: 'COMPLETED' });
      expect(updated?.status).toBe('COMPLETED');
    });
  });

  describe('2. Safety Gate and Consequential Action State Machine', () => {
    it('stages a shopping cart in PENDING_APPROVAL status without making a transaction', async () => {
      const cart = await persistence.stageCart([
        {
          id: 'item_1',
          title: 'Ethiopian Single-Origin Beans',
          category: 'Coffee',
          quantity: 2,
          unitPrice: 18.5,
          totalPrice: 37.0,
        },
      ]);

      expect(cart.stageId).toMatch(/^stage_/);
      expect(cart.status).toBe('PENDING_APPROVAL');
      expect(cart.confirmationToken).toMatch(/^conf_/);
      expect(cart.subtotal).toBe(37.0);
      expect(cart.estimatedTotal).toBeGreaterThan(37.0); // includes tax
      expect(cart.safetyDisclaimer).toContain('SAFE DEMO MODE');
    });

    it('approves a staged cart only when confirmed with valid token or stageId', async () => {
      const cart = await persistence.stageCart([
        {
          id: 'item_1',
          title: 'Coffee Beans',
          category: 'Coffee',
          quantity: 1,
          unitPrice: 18.5,
          totalPrice: 18.5,
        },
      ]);

      // Confirm approval
      const approval = await persistence.confirmAction(cart.stageId, 'APPROVE');
      expect(approval.success).toBe(true);
      expect(approval.stage?.status).toBe('APPROVED');

      // Verify stored state reflects approval
      const updated = await persistence.getStagedCart(cart.stageId);
      expect(updated?.status).toBe('APPROVED');
    });

    it('cancels a staged cart when rejected', async () => {
      const cart = await persistence.stageCart([
        {
          id: 'item_1',
          title: 'Coffee Beans',
          category: 'Coffee',
          quantity: 1,
          unitPrice: 18.5,
          totalPrice: 18.5,
        },
      ]);

      const rejection = await persistence.confirmAction(cart.confirmationToken, 'REJECT');
      expect(rejection.success).toBe(true);
      expect(rejection.stage?.status).toBe('CANCELLED');

      const updated = await persistence.getStagedCart(cart.stageId);
      expect(updated?.status).toBe('CANCELLED');
    });

    it('rejects confirmation with unknown token', async () => {
      const result = await persistence.confirmAction('invalid_token_xyz', 'APPROVE');
      expect(result.success).toBe(false);
      expect(result.message).toContain('No active confirmation record found');
    });
  });

  describe('3. Multi-Step Orchestrator Workflow', () => {
    it('executes full demo workflow and coordinates multiple operations into unified summary', async () => {
      const query =
        "Prepare my afternoon, check tomorrow's schedule, create a reminder to prepare for my first meeting, and stage my usual coffee order.";

      const status = await orchestrator.executeDemonstrationWorkflow(query);

      expect(status.workflowId).toMatch(/^wf_/);
      expect(status.state).toBe('AWAITING_APPROVAL');
      expect(status.operations.length).toBe(4);

      // Verify Step 1: Context
      const op1 = status.operations[0];
      expect(op1.tool).toBe('nexus_get_context');
      expect(op1.status).toBe('SUCCESS');

      // Verify Step 2: Schedule
      const op2 = status.operations[1];
      expect(op2.tool).toBe('nexus_get_schedule');
      expect(op2.status).toBe('SUCCESS');
      expect(op2.output?.events).toBeDefined();

      // Verify Step 3: Task
      const op3 = status.operations[2];
      expect(op3.tool).toBe('nexus_create_task');
      expect(op3.status).toBe('SUCCESS');
      expect(op3.output?.taskId).toBeDefined();

      // Verify task was actually persisted in storage
      const persistedTask = await persistence.getTask(op3.output?.taskId as string);
      expect(persistedTask).toBeDefined();

      // Verify Step 4: Staged Cart
      const op4 = status.operations[3];
      expect(op4.tool).toBe('nexus_stage_cart');
      expect(op4.status).toBe('PENDING_APPROVAL');
      expect(op4.output?.stageId).toBeDefined();

      // Verify pendingAction for UI
      expect(status.pendingAction).toBeDefined();
      expect(status.pendingAction?.type).toBe('CART_CHECKOUT');
      expect(status.pendingAction?.amount).toBeGreaterThan(0);

      // Verify natural language summary
      expect(status.summary).toContain('Focus');
      expect(status.summary).toContain('calendar');
      expect(status.summary).toContain('Ethiopian');
    });
  });

  describe('4. Server Initialization & HTTP API', () => {
    it('initializes the server app without errors and exposes PRM discovery and health', async () => {
      const { app, mcpServer } = await createNexusApp();
      expect(app).toBeDefined();
      expect(mcpServer).toBeDefined();

      const server = app.listen(0);
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // Test /health
        const healthRes = await fetch(`${baseUrl}/health`);
        expect(healthRes.status).toBe(200);
        const healthData = (await healthRes.json()) as { status: string };
        expect(healthData.status).toBe('UP');

        // Test PRM discovery
        const prmRes = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
        expect(prmRes.status).toBe(200);
        const prmData = (await prmRes.json()) as { resource: string; scopes_supported: string[] };
        expect(prmData.resource).toContain('/mcp');
        expect(prmData.scopes_supported).toContain('alexa::mcp:read');

        // Test /api/workflow/run
        const runRes = await fetch(`${baseUrl}/api/workflow/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'Prepare my afternoon' }),
        });
        expect(runRes.status).toBe(200);
        const runData = (await runRes.json()) as { success: boolean; result: { state: string } };
        expect(runData.success).toBe(true);
        expect(runData.result.state).toBe('AWAITING_APPROVAL');

        // Test compatibility shims: /api/health and /api/nexus/status
        const apiHealthRes = await fetch(`${baseUrl}/api/health`);
        expect(apiHealthRes.status).toBe(200);
        const apiHealthData = (await apiHealthRes.json()) as { status: string; mcpBackendStatus: string };
        expect(apiHealthData.status).toBe('ok');
        expect(apiHealthData.mcpBackendStatus).toBe('ready');

        const apiStatusRes = await fetch(`${baseUrl}/api/nexus/status`);
        expect(apiStatusRes.status).toBe(200);
        const apiStatusData = (await apiStatusRes.json()) as { backendName: string; toolsAvailable: any[] };
        expect(apiStatusData.backendName).toBe('nexus-core');
        expect(apiStatusData.toolsAvailable.length).toBeGreaterThan(0);
      } finally {
        server.close();
      }
    });
  });

  async function parseMcpResponse(res: Response): Promise<any> {
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    if (contentType.includes('text/event-stream') || text.startsWith('event:') || text.startsWith('data:')) {
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr) {
            try {
              return JSON.parse(jsonStr);
            } catch {
              // continue
            }
          }
        }
      }
    }
    return JSON.parse(text);
  }

  describe('5. Streamable HTTP MCP Protocol & Tool Execution', () => {
    it('initializes MCP session using protocol 2025-11-25 and returns Mcp-Session-Id', async () => {
      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const initRes = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2025-11-25',
              capabilities: {},
              clientInfo: { name: 'nexus-test-client', version: '1.0.0' },
            },
          }),
        });

        expect(initRes.status).toBe(200);
        const sessionId = initRes.headers.get('mcp-session-id');
        expect(sessionId).toBeDefined();
        expect(typeof sessionId).toBe('string');

        const initBody = await parseMcpResponse(initRes);
        expect(initBody.jsonrpc).toBe('2.0');
        expect(initBody.result?.serverInfo?.name).toBe('nexus-core');
        expect(initBody.result?.protocolVersion).toBe('2025-11-25');
      } finally {
        server.close();
      }
    });

    it('discovers tools and executes workspace.tasks.create alias tool via tools/call', async () => {
      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // Step 1: Initialize session
        const initRes = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2025-11-25',
              capabilities: {},
              clientInfo: { name: 'nexus-test-client', version: '1.0.0' },
            },
          }),
        });

        const sessionId = initRes.headers.get('mcp-session-id')!;
        expect(sessionId).toBeDefined();

        // Step 2: Discover tools via tools/list
        const listRes = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {},
          }),
        });

        expect(listRes.status).toBe(200);
        const listBody = await parseMcpResponse(listRes);
        const toolNames = listBody.result?.tools?.map((t: any) => t.name) || [];

        // Verify both original and namespaced alias tools are registered
        expect(toolNames).toContain('nexus_create_task');
        expect(toolNames).toContain('workspace.tasks.create');
        expect(toolNames).toContain('workspace.calendar.list_events');
        expect(toolNames).toContain('commerce.cart.prepare_checkout');

        // Step 3: Call workspace.tasks.create with frontend schema (title and notes)
        const callRes = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
              name: 'workspace.tasks.create',
              arguments: {
                title: 'Review Amazon Developer submission guidelines',
                notes: 'Check all MCP Streamable HTTP and safety gate requirements',
                priority: 'HIGH',
              },
            },
          }),
        });

        expect(callRes.status).toBe(200);
        const callBody = await parseMcpResponse(callRes);
        expect(callBody.result?.isError).toBeFalsy();
        const contentText = callBody.result?.content?.[0]?.text;
        expect(contentText).toBeDefined();

        const parsedContent = JSON.parse(contentText);
        expect(parsedContent.status).toBe('SUCCESS');
        expect(parsedContent.task?.title).toContain('Amazon Developer');
        expect(parsedContent.task?.description).toContain('Streamable HTTP');

        // Step 4: Verify task is retrievable via REST API
        const tasksRes = await fetch(`${baseUrl}/api/tasks`);
        const tasksData = (await tasksRes.json()) as any;
        const found = tasksData.tasks?.find((t: any) => t.title.includes('Amazon Developer'));
        expect(found).toBeDefined();
        expect(found.priority).toBe('HIGH');
      } finally {
        server.close();
      }
    });

    it('returns structured JSON-RPC errors for invalid tools and parameters', async () => {
      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const initRes = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2025-11-25',
              capabilities: {},
              clientInfo: { name: 'nexus-test-client', version: '1.0.0' },
            },
          }),
        });

        const sessionId = initRes.headers.get('mcp-session-id')!;

        // Call non-existent tool
        const badToolRes = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: 'non_existent_tool_xyz',
              arguments: {},
            },
          }),
        });

        const badToolBody = await parseMcpResponse(badToolRes);
        expect(badToolBody.result?.isError || badToolBody.error).toBeTruthy();
        if (badToolBody.result?.isError) {
          expect(badToolBody.result?.content?.[0]?.text).toContain('not found');
        }

        // Call tool with missing required arguments
        const badParamRes = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
              name: 'workspace.tasks.create',
              arguments: {}, // Missing required 'title'
            },
          }),
        });

        const badParamBody = await parseMcpResponse(badParamRes);
        expect(badParamBody.error || badParamBody.result?.isError).toBeTruthy();

        // Call non-existent JSON-RPC method to test protocol error code -32601
        const badMethodRes = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 4,
            method: 'unknown/method',
            params: {},
          }),
        });

        const badMethodBody = await parseMcpResponse(badMethodRes);
        expect(badMethodBody.error).toBeDefined();
        expect(badMethodBody.error?.code).toBe(-32601);
      } finally {
        server.close();
      }
    });
  });

  describe('6. Security, Authentication & User Ownership Isolation', () => {
    it('enforces multi-tenant task and cart data isolation between users at the persistence layer', async () => {
      // User A creates a task and stages a cart
      const taskA = await persistence.createTask({
        title: 'User A confidential task',
        userId: 'user_A',
      });
      const cartA = await persistence.stageCart(
        [{ id: 'item_1', title: 'Beans', category: 'Coffee', quantity: 1, unitPrice: 15, totalPrice: 15 }],
        'user_A'
      );

      // User B creates a task
      const taskB = await persistence.createTask({
        title: 'User B private task',
        userId: 'user_B',
      });

      // User A should only see User A tasks
      const listA = await persistence.listTasks('user_A');
      expect(listA.some((t) => t.id === taskA.id)).toBe(true);
      expect(listA.some((t) => t.id === taskB.id)).toBe(false);

      // User B should only see User B tasks
      const listB = await persistence.listTasks('user_B');
      expect(listB.some((t) => t.id === taskB.id)).toBe(true);
      expect(listB.some((t) => t.id === taskA.id)).toBe(false);

      // User B cannot get User A's task directly
      const getFromB = await persistence.getTask(taskA.id, 'user_B');
      expect(getFromB).toBeNull();

      // User B cannot delete User A's task
      const deleteFromB = await persistence.deleteTask(taskA.id, 'user_B');
      expect(deleteFromB).toBe(false);
      expect(await persistence.getTask(taskA.id, 'user_A')).toBeDefined();

      // User B cannot confirm User A's staged cart
      const confirmFromB = await persistence.confirmAction(cartA.stageId, 'APPROVE', 'user_B');
      expect(confirmFromB.success).toBe(false);
      expect(confirmFromB.message).toContain('another user');

      // User A can approve their own cart
      const confirmFromA = await persistence.confirmAction(cartA.stageId, 'APPROVE', 'user_A');
      expect(confirmFromA.success).toBe(true);
    });

    it('authenticates valid Firebase ID tokens and strictly derives user UID from verified token', async () => {
      setCustomTokenVerifier(async (token) => {
        if (token === 'firebase_token_alice_valid') {
          return { uid: 'user_alice_verified', email: 'alice@example.com', name: 'Alice' };
        }
        throw new Error('Invalid token');
      });

      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const res = await fetch(`${baseUrl}/api/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer firebase_token_alice_valid',
          },
          body: JSON.stringify({ title: 'Task by Alice' }),
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as any;
        expect(data.success).toBe(true);
        expect(data.task.userId).toBe('user_alice_verified');
        expect(data.task.title).toBe('Task by Alice');
      } finally {
        server.close();
      }
    });

    it('rejects invalid or forged tokens with 401 and does not expose secrets', async () => {
      setCustomTokenVerifier(async () => {
        throw new Error('Decoding Firebase ID token failed: signature verification failed');
      });

      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const res = await fetch(`${baseUrl}/api/tasks`, {
          headers: {
            Authorization: 'Bearer forged_or_tampered_token',
          },
        });

        expect(res.status).toBe(401);
        const data = (await res.json()) as any;
        expect(data.error.message).toContain('Invalid or forged token');
        expect(JSON.stringify(data)).not.toContain('forged_or_tampered_token');
      } finally {
        server.close();
      }
    });

    it('rejects expired Firebase ID tokens with 401', async () => {
      setCustomTokenVerifier(async () => {
        throw new Error('Firebase ID token has expired at 1700000000');
      });

      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const res = await fetch(`${baseUrl}/api/tasks`, {
          headers: {
            Authorization: 'Bearer expired_token',
          },
        });

        expect(res.status).toBe(401);
        const data = (await res.json()) as any;
        expect(data.error.message).toContain('Token has expired');
      } finally {
        server.close();
      }
    });

    it('rejects missing or empty Bearer tokens when bypass is disabled', async () => {
      process.env.DEV_AUTH_BYPASS = 'false';

      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // Missing token
        const resMissing = await fetch(`${baseUrl}/api/tasks`);
        expect(resMissing.status).toBe(401);
        const dataMissing = (await resMissing.json()) as any;
        expect(dataMissing.error.message).toContain('Bearer token required');

        // Empty token
        const resEmpty = await fetch(`${baseUrl}/api/tasks`, {
          headers: { Authorization: 'Bearer   ' },
        });
        expect(resEmpty.status).toBe(401);
      } finally {
        process.env.DEV_AUTH_BYPASS = 'true';
        server.close();
      }
    });

    it('prevents callers from spoofing identity by overriding userId in request body', async () => {
      setCustomTokenVerifier(async () => ({
        uid: 'legitimate_user_alice',
        email: 'alice@example.com',
      }));

      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const res = await fetch(`${baseUrl}/api/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({
            title: 'Attempted Spoofed Task',
            userId: 'impersonated_victim_bob', // Spoofed UID attempt
          }),
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as any;
        // Must match token UID, ignoring request body attempt
        expect(data.task.userId).toBe('legitimate_user_alice');
        expect(data.task.userId).not.toBe('impersonated_victim_bob');
      } finally {
        server.close();
      }
    });

    it('prevents cross-user task access, modification, and deletion over HTTP', async () => {
      setCustomTokenVerifier(async (token) => {
        if (token === 'alice_token') return { uid: 'user_alice' };
        if (token === 'bob_token') return { uid: 'user_bob' };
        throw new Error('Invalid token');
      });

      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // Alice creates task
        const createRes = await fetch(`${baseUrl}/api/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer alice_token',
          },
          body: JSON.stringify({ title: 'Alice Confidential Plan' }),
        });
        const taskData = (await createRes.json()) as any;
        const taskId = taskData.task.id;

        // Bob tries to GET Alice's task -> 404
        const getRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
          headers: { Authorization: 'Bearer bob_token' },
        });
        expect(getRes.status).toBe(404);

        // Bob tries to PATCH Alice's task -> 404
        const patchRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer bob_token',
          },
          body: JSON.stringify({ title: 'Hacked by Bob' }),
        });
        expect(patchRes.status).toBe(404);

        // Bob tries to DELETE Alice's task -> 404
        const deleteRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer bob_token' },
        });
        expect(deleteRes.status).toBe(404);

        // Alice can still retrieve her task intact
        const aliceGetRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
          headers: { Authorization: 'Bearer alice_token' },
        });
        expect(aliceGetRes.status).toBe(200);
        const aliceData = (await aliceGetRes.json()) as any;
        expect(aliceData.task.title).toBe('Alice Confidential Plan');
      } finally {
        server.close();
      }
    });

    it('blocks cross-user cart confirmation attempts with 403 Forbidden', async () => {
      setCustomTokenVerifier(async (token) => {
        if (token === 'alice_token') return { uid: 'user_alice' };
        if (token === 'bob_token') return { uid: 'user_bob' };
        throw new Error('Invalid token');
      });

      // Alice stages a cart in persistence
      const stagedCart = await persistence.stageCart(
        [{ id: 'item_1', title: 'Espresso', category: 'Coffee', quantity: 1, unitPrice: 20, totalPrice: 20 }],
        'user_alice'
      );

      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // Bob attempts to confirm Alice's cart
        const res = await fetch(`${baseUrl}/api/cart/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer bob_token',
          },
          body: JSON.stringify({
            tokenOrStageId: stagedCart.stageId,
            decision: 'APPROVE',
          }),
        });

        expect(res.status).toBe(403);
        const data = (await res.json()) as any;
        expect(data.success).toBe(false);
        expect(data.message).toContain('another user');
      } finally {
        server.close();
      }
    });

    it('prevents MCP session hijacking across different authenticated users', async () => {
      setCustomTokenVerifier(async (token) => {
        if (token === 'alice_token') return { uid: 'user_alice' };
        if (token === 'bob_token') return { uid: 'user_bob' };
        throw new Error('Invalid token');
      });

      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // Alice initializes MCP session
        const initRes = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            Authorization: 'Bearer alice_token',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2025-11-25',
              capabilities: {},
              clientInfo: { name: 'alice-client', version: '1.0.0' },
            },
          }),
        });

        const aliceSessionId = initRes.headers.get('mcp-session-id');
        expect(aliceSessionId).toBeTruthy();

        // Bob attempts to call tools using Alice's session ID -> 403 Forbidden
        const hijackRes = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'Mcp-Session-Id': aliceSessionId!,
            Authorization: 'Bearer bob_token',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {},
          }),
        });

        expect(hijackRes.status).toBe(403);
        const hijackData = (await hijackRes.json()) as any;
        expect(hijackData.error.message).toContain('another authenticated user');
      } finally {
        server.close();
      }
    });

    it('strictly disables development auth bypass in production environment (NODE_ENV=production)', async () => {
      const origEnv = process.env.NODE_ENV;
      const origStorage = process.env.STORAGE_MODE;
      process.env.NODE_ENV = 'production';
      process.env.STORAGE_MODE = 'memory';
      process.env.DEV_AUTH_BYPASS = 'true'; // Attempt bypass in production

      const { app } = await createNexusApp({ persistenceOptions: { mode: 'memory' } });
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // Even from loopback, production must reject unauthenticated requests
        const res = await fetch(`${baseUrl}/api/tasks`);
        expect(res.status).toBe(401);
        const data = (await res.json()) as any;
        expect(data.error.message).toContain('Bearer token required in production');
      } finally {
        process.env.NODE_ENV = origEnv;
        process.env.STORAGE_MODE = origStorage;
        process.env.DEV_AUTH_BYPASS = 'true';
        server.close();
      }
    });

    it('rejects malformed token payloads missing required uid with 401', async () => {
      setCustomTokenVerifier(async () => ({
        uid: '', // Missing / empty uid
        email: 'attacker@example.com',
      }));

      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const res = await fetch(`${baseUrl}/api/tasks`, {
          headers: { Authorization: 'Bearer malformed_token_no_uid' },
        });

        expect(res.status).toBe(401);
        const data = (await res.json()) as any;
        expect(data.error.message).toContain('Malformed token payload');
      } finally {
        server.close();
      }
    });

    it('prevents cross-user access to staged shopping carts (GET /api/cart/:stageId)', async () => {
      setCustomTokenVerifier(async (token) => {
        if (token === 'alice_token') return { uid: 'user_alice' };
        if (token === 'bob_token') return { uid: 'user_bob' };
        throw new Error('Invalid token');
      });

      // Alice stages a cart
      const stagedCart = await persistence.stageCart(
        [{ id: 'item_beans', title: 'Ethiopian Roast', category: 'Coffee', quantity: 1, unitPrice: 18.5, totalPrice: 18.5 }],
        'user_alice'
      );

      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // Alice can access her staged cart
        const aliceRes = await fetch(`${baseUrl}/api/cart/${stagedCart.stageId}`, {
          headers: { Authorization: 'Bearer alice_token' },
        });
        expect(aliceRes.status).toBe(200);
        const aliceData = (await aliceRes.json()) as any;
        expect(aliceData.cart.stageId).toBe(stagedCart.stageId);

        // Bob attempts to read Alice's staged cart -> 404
        const bobRes = await fetch(`${baseUrl}/api/cart/${stagedCart.stageId}`, {
          headers: { Authorization: 'Bearer bob_token' },
        });
        expect(bobRes.status).toBe(404);
        const bobData = (await bobRes.json()) as any;
        expect(bobData.error).toContain('not found or unauthorized');
      } finally {
        server.close();
      }
    });

    it('enforces cross-user workflow isolation (cannot view another user’s workflow status or latest workflow)', async () => {
      setCustomTokenVerifier(async (token) => {
        if (token === 'alice_token') return { uid: 'user_alice' };
        if (token === 'bob_token') return { uid: 'user_bob' };
        throw new Error('Invalid token');
      });

      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // Alice runs a workflow
        const runRes = await fetch(`${baseUrl}/api/workflow/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer alice_token',
          },
          body: JSON.stringify({ query: 'Prepare my afternoon' }),
        });
        expect(runRes.status).toBe(200);
        const runData = (await runRes.json()) as any;
        const workflowId = runData.result.workflowId;
        expect(workflowId).toBeDefined();

        // Alice can query status by workflowId
        const aliceStatusRes = await fetch(`${baseUrl}/api/workflow/status?workflowId=${workflowId}`, {
          headers: { Authorization: 'Bearer alice_token' },
        });
        expect(aliceStatusRes.status).toBe(200);
        const aliceStatusData = (await aliceStatusRes.json()) as any;
        expect(aliceStatusData.status?.workflowId).toBe(workflowId);

        // Bob queries Alice's workflowId -> status is null
        const bobStatusRes = await fetch(`${baseUrl}/api/workflow/status?workflowId=${workflowId}`, {
          headers: { Authorization: 'Bearer bob_token' },
        });
        expect(bobStatusRes.status).toBe(200);
        const bobStatusData = (await bobStatusRes.json()) as any;
        expect(bobStatusData.status).toBeNull();

        // Bob queries latest workflow -> status is null (does not leak Alice's workflow)
        const bobLatestRes = await fetch(`${baseUrl}/api/workflow/status`, {
          headers: { Authorization: 'Bearer bob_token' },
        });
        expect(bobLatestRes.status).toBe(200);
        const bobLatestData = (await bobLatestRes.json()) as any;
        expect(bobLatestData.status).toBeNull();
      } finally {
        server.close();
      }
    });

    it('rejects remote non-loopback requests when dev bypass is enabled without a valid token', async () => {
      const { createAuthMiddleware } = await import('../src/auth.js');
      const middleware = createAuthMiddleware();

      let statusCode: number | null = null;
      let jsonResponse: any = null;
      let nextCalled = false;

      const mockReq: any = {
        headers: {},
        socket: { remoteAddress: '198.51.100.25' }, // Public external IP
        ip: '198.51.100.25',
      };

      const mockRes: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(payload: any) {
          jsonResponse = payload;
          return this;
        },
      };

      const mockNext = () => {
        nextCalled = true;
      };

      await middleware(mockReq, mockRes, mockNext);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(401);
      expect(jsonResponse.error.message).toContain('Development bypass is strictly restricted to local loopback');
    });
  });

  describe('7. Safe MCP Relay & SSRF Protection', () => {
    it('safely forwards valid requests to local MCP endpoint and returns 200', async () => {
      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const relayRes = await fetch(`${baseUrl}/api/nexus/mcp-relay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUrl: `${baseUrl}/mcp`,
            payload: {
              jsonrpc: '2.0',
              id: 1,
              method: 'initialize',
              params: {
                protocolVersion: '2025-11-25',
                capabilities: {},
                clientInfo: { name: 'relay-test', version: '1.0.0' },
              },
            },
          }),
        });

        expect(relayRes.status).toBe(200);
        const relayData = (await relayRes.json()) as any;
        expect(relayData.isReachable).toBe(true);
        expect(relayData.data?.result?.serverInfo?.name).toBe('nexus-core');
      } finally {
        server.close();
      }
    });

    it('blocks SSRF requests targeting cloud metadata IP 169.254.169.254 with 403', async () => {
      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const relayRes = await fetch(`${baseUrl}/api/nexus/mcp-relay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUrl: 'http://169.254.169.254/latest/meta-data/',
            payload: { jsonrpc: '2.0', id: 1, method: 'initialize' },
          }),
        });

        expect(relayRes.status).toBe(403);
        const relayData = (await relayRes.json()) as any;
        expect(relayData.isReachable).toBe(false);
        expect(relayData.error).toContain('SSRF blocked');
      } finally {
        server.close();
      }
    });

    it('blocks SSRF requests targeting unwhitelisted external hosts with 403', async () => {
      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const relayRes = await fetch(`${baseUrl}/api/nexus/mcp-relay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUrl: 'http://malicious-external-site.com/evil-mcp',
            payload: { jsonrpc: '2.0', id: 1, method: 'initialize' },
          }),
        });

        expect(relayRes.status).toBe(403);
        const relayData = (await relayRes.json()) as any;
        expect(relayData.isReachable).toBe(false);
        expect(relayData.error).toContain('SSRF blocked');
      } finally {
        server.close();
      }
    });
  });

  describe('10. Render Deployment & CORS Origin Protection Suite', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('allows explicitly configured Vercel production origin in ALLOWED_ORIGINS', async () => {
      process.env.ALLOWED_ORIGINS = 'https://nexus-ai-web.vercel.app';
      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const res = await fetch(`${baseUrl}/health`, {
          headers: { Origin: 'https://nexus-ai-web.vercel.app' },
        });
        expect(res.status).toBe(200);
        expect(res.headers.get('access-control-allow-origin')).toBe('https://nexus-ai-web.vercel.app');
      } finally {
        server.close();
      }
    });

    it('does not reflect arbitrary origins or set access-control-allow-origin for unallowed origins', async () => {
      process.env.ALLOWED_ORIGINS = 'https://nexus-ai-web.vercel.app';
      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const res = await fetch(`${baseUrl}/health`, {
          headers: { Origin: 'https://malicious-attacker.com' },
        });
        expect(res.status).toBe(200);
        // Arbitrary origin is NOT reflected
        expect(res.headers.get('access-control-allow-origin')).toBeNull();
      } finally {
        server.close();
      }
    });

    it('strictly confines allowed origins in production mode when ALLOWED_ORIGINS is configured', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://nexus-ai-web.vercel.app';
      process.env.STORAGE_MODE = 'memory'; // For isolated unit test
      const { app } = await createNexusApp({ persistenceOptions: { mode: 'memory' } });
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // Disallowed local origin in production
        const localRes = await fetch(`${baseUrl}/health`, {
          headers: { Origin: 'http://localhost:5173' },
        });
        expect(localRes.headers.get('access-control-allow-origin')).toBeNull();

        // Allowed production origin
        const prodRes = await fetch(`${baseUrl}/health`, {
          headers: { Origin: 'https://nexus-ai-web.vercel.app' },
        });
        expect(prodRes.headers.get('access-control-allow-origin')).toBe('https://nexus-ai-web.vercel.app');
      } finally {
        server.close();
      }
    });

    it('/health endpoint exposes no secret credentials, API keys, or private fields', async () => {
      const { app } = await createNexusApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        const res = await fetch(`${baseUrl}/health`);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.status).toBe('UP');
        expect(typeof data.uptimeSeconds).toBe('number');
        expect(data.token).toBeUndefined();
        expect(data.credentials).toBeUndefined();
        expect(data.privateKey).toBeUndefined();
        expect(data.apiKey).toBeUndefined();
      } finally {
        server.close();
      }
    });
  });
});
