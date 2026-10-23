/**
 * Nexus AI — Phase 9B Comprehensive Verification Test Suite
 *
 * Runs end-to-end operational audits across:
 * 1. Health Probes & Public Metadata Discovery (GET /health, GET /api/health, GET /api/nexus/status, GET /.well-known/oauth-protected-resource/mcp)
 * 2. Authentication & Token Rejection (missing Bearer, invalid/forged Bearer, expired, revoked)
 * 3. Protected endpoint security (GET /api/tasks, POST /api/tasks, POST /api/reset in production)
 * 4. MCP Streamable HTTP Protocol & Lifecycle (initialize, session ID, tools/list, tools/call, cross-user session rejection, DELETE /mcp, 404 on closed session)
 * 5. Registered Tool Execution & Schema Enforcement (nexus_get_context, nexus_get_schedule, nexus_create_task, nexus_stage_cart, nexus_confirm_action, invalid params rejection, unknown tool rejection)
 * 6. Compatibility Aliases (workspace.calendar.list_events, workspace.tasks.create, commerce.cart.prepare_checkout, workspace.gmail.summarize_threads, smarthome.scenes.activate)
 * 7. Multi-Tenant User Isolation & Ownership Invariants (token-derived UID, cross-user read/update/delete rejection, cart approval hijacking rejection)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { createNexusApp } from '../src/index.js';
import { setCustomTokenVerifier, resetAuthState } from '../src/auth.js';
import { persistence } from '../src/store/persistence.js';

describe('Nexus AI — Phase 9B Verification Audit Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const userA = { uid: 'audit_user_alpha_123', email: 'alpha@test.nexus.ai', name: 'User Alpha' };
  const userB = { uid: 'audit_user_beta_456', email: 'beta@test.nexus.ai', name: 'User Beta' };
  const validTokenA = 'valid-token-user-a';
  const validTokenB = 'valid-token-user-b';

  beforeEach(async () => {
    process.env.STORAGE_MODE = 'memory';
    process.env.DEV_AUTH_BYPASS = 'false'; // Strictly disable dev bypass to test real token validation

    setCustomTokenVerifier(async (token: string) => {
      if (token === validTokenA) return userA;
      if (token === validTokenB) return userB;
      if (token === 'expired-token') throw new Error('Firebase ID token has expired');
      if (token === 'revoked-token') throw new Error('Firebase ID token has been revoked');
      if (token === 'malformed-token') throw new Error('Malformed token payload');
      throw new Error('Invalid or forged token signature');
    });

    await persistence.resetDemoData();

    const { app } = await createNexusApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    resetAuthState();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function api(path: string, options: RequestInit = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let body: any = null;
    try {
      if (text.startsWith('event:') || text.startsWith('data:') || res.headers.get('content-type')?.includes('text/event-stream')) {
        for (const line of text.split('\n')) {
          if (line.trim().startsWith('data:')) {
            const raw = line.trim().slice(5).trim();
            if (raw) {
              body = JSON.parse(raw);
              break;
            }
          }
        }
      } else {
        body = JSON.parse(text);
      }
    } catch {
      body = text;
    }
    return { status: res.status, headers: res.headers, body };
  }

  describe('1. Health Probes & Public Metadata Discovery', () => {
    it('GET /health returns 200 with UP status and uptime', async () => {
      const res = await api('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(typeof res.body.uptimeSeconds).toBe('number');
    });

    it('GET /api/health returns 200 with readiness probe and version', async () => {
      const res = await api('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.mcpBackendStatus).toBe('ready');
      expect(res.body.version).toBe('1.0.0');
    });

    it('GET /api/nexus/status returns 200 with tool catalog advertisement', async () => {
      const res = await api('/api/nexus/status');
      expect(res.status).toBe(200);
      expect(res.body.backendName).toBe('nexus-core');
      expect(res.body.protocol).toBe('MCP-Streamable-HTTP');
      expect(Array.isArray(res.body.toolsAvailable)).toBe(true);
      expect(res.body.toolsAvailable.length).toBeGreaterThanOrEqual(6);
    });

    it('GET /.well-known/oauth-protected-resource/mcp returns RFC 9728 PRM metadata', async () => {
      const res = await api('/.well-known/oauth-protected-resource/mcp');
      expect(res.status).toBe(200);
      expect(res.body.resource).toContain('/mcp');
      expect(res.body.scopes_supported).toContain('alexa::mcp:read');
      expect(res.body.scopes_supported).toContain('alexa::mcp:write');
    });
  });

  describe('2. Authentication & Token Rejection', () => {
    it('rejects unauthenticated request to /mcp with 401', async () => {
      const res = await api('/mcp', {
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
      });
      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Unauthorized');
    });

    it('rejects unauthenticated request to /api/tasks with 401', async () => {
      const res = await api('/api/tasks');
      expect(res.status).toBe(401);
    });

    it('rejects forged Bearer token with 401', async () => {
      const res = await api('/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer forged-fake-token' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
      });
      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Invalid or forged');
    });

    it('rejects expired Bearer token with 401', async () => {
      const res = await api('/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer expired-token' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
      });
      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('expired');
    });

    it('rejects revoked Bearer token with 401', async () => {
      const res = await api('/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer revoked-token' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
      });
      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('revoked');
    });

    it('disables /api/reset in production mode with 403 Forbidden', async () => {
      const orig = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const res = await api('/api/reset', {
          method: 'POST',
          headers: { Authorization: `Bearer ${validTokenA}` },
        });
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('disabled in production');
      } finally {
        process.env.NODE_ENV = orig;
      }
    });
  });

  describe('3. MCP Streamable HTTP Protocol & Tool Discovery', () => {
    it('completes initialize handshake, discovers tools, and prevents cross-user hijacking', async () => {
      // 1. Initialize session for User A
      const initRes = await api('/mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${validTokenA}` },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            clientInfo: { name: 'AuditClient', version: '1.0.0' },
          },
        }),
      });

      expect(initRes.status).toBe(200);
      const sessionId = initRes.headers.get('mcp-session-id')!;
      expect(sessionId).toBeDefined();
      expect(initRes.body.result?.serverInfo?.name).toBe('nexus-core');

      // 2. Discover tools via tools/list
      const listRes = await api('/mcp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
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
      const tools = listRes.body.result?.tools || [];
      const toolNames = tools.map((t: any) => t.name);
      expect(toolNames).toContain('nexus_get_context');
      expect(toolNames).toContain('nexus_get_schedule');
      expect(toolNames).toContain('nexus_create_task');
      expect(toolNames).toContain('nexus_stage_cart');
      expect(toolNames).toContain('nexus_get_workflow_status');
      expect(toolNames).toContain('nexus_confirm_action');
      expect(toolNames).toContain('workspace.calendar.list_events');
      expect(toolNames).toContain('workspace.tasks.create');
      expect(toolNames).toContain('commerce.cart.prepare_checkout');
      expect(toolNames).toContain('workspace.gmail.summarize_threads');
      expect(toolNames).toContain('smarthome.scenes.activate');

      // 3. User B attempts to hijack User A session -> 403 Forbidden
      const hijackRes = await api('/mcp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenB}`,
          'Mcp-Session-Id': sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/list',
          params: {},
        }),
      });

      expect(hijackRes.status).toBe(403);
      expect(hijackRes.body.error.message).toContain('another authenticated user');

      // 4. Clean session termination via DELETE /mcp
      const delRes = await api('/mcp', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Mcp-Session-Id': sessionId,
        },
      });
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      // 5. Subsequent request returns 404 (-32001 Session not found)
      const closedRes = await api('/mcp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Mcp-Session-Id': sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/list',
          params: {},
        }),
      });
      expect(closedRes.status).toBe(404);
      expect(closedRes.body.error.code).toBe(-32001);
    });
  });

  describe('4. Tool Execution & Schema Enforcement', () => {
    let sid: string;

    beforeEach(async () => {
      const init = await api('/mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${validTokenA}` },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            clientInfo: { name: 'AuditClient', version: '1.0.0' },
          },
        }),
      });
      sid = init.headers.get('mcp-session-id')!;
    });

    async function call(name: string, args: Record<string, any>) {
      return await api('/mcp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Mcp-Session-Id': sid,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Math.floor(Math.random() * 10000),
          method: 'tools/call',
          params: { name, arguments: args },
        }),
      });
    }

    it('executes nexus_get_context with query parameter and verified user scoping', async () => {
      const res = await call('nexus_get_context', { query: 'coffee' });
      expect(res.status).toBe(200);
      const text = res.body.result?.content?.[0]?.text;
      expect(text).toContain('SUCCESS');
      expect(text).toContain('Ethiopian');
      const parsed = JSON.parse(text);
      expect(parsed.provenance).toBe('authenticated_user_profile');
      expect(parsed.data.userId).toBe(userA.uid);
      expect(parsed.data.userName).toContain(userA.uid);
    });

    it('executes nexus_get_schedule and identifies first meeting', async () => {
      const res = await call('nexus_get_schedule', { targetDate: 'tomorrow' });
      expect(res.status).toBe(200);
      const text = res.body.result?.content?.[0]?.text;
      expect(text).toContain('SUCCESS');
      expect(text).toContain('sample_calendar_adapter');
      expect(text).toContain('Product Strategy Review');
    });

    it('executes nexus_create_task and rejects missing required title', async () => {
      // Valid call
      const okRes = await call('nexus_create_task', {
        title: 'Complete Phase 9B Verification',
        priority: 'HIGH',
      });
      expect(okRes.status).toBe(200);
      const text = okRes.body.result?.content?.[0]?.text;
      expect(text).toContain('SUCCESS');
      expect(text).toContain('Complete Phase 9B Verification');

      // Invalid call (missing title)
      const badRes = await call('nexus_create_task', {
        description: 'Missing title property',
      });
      expect(badRes.body.error || badRes.body.result?.isError).toBeTruthy();
    });

    it('stages cart and requires two-phase confirmation before approval', async () => {
      const stageRes = await call('nexus_stage_cart', {
        items: [{ title: 'Specialty Beans', quantity: 2, unitPrice: 16.0, category: 'Coffee' }],
      });
      expect(stageRes.status).toBe(200);
      const stageText = stageRes.body.result?.content?.[0]?.text;
      expect(stageText).toContain('PENDING_APPROVAL');
      const stageData = JSON.parse(stageText);
      const token = stageData.confirmationToken;
      expect(token).toBeDefined();

      // Confirm approval
      const confirmRes = await call('nexus_confirm_action', {
        tokenOrStageId: token,
        decision: 'APPROVE',
      });
      expect(confirmRes.status).toBe(200);
      const confirmText = confirmRes.body.result?.content?.[0]?.text;
      expect(confirmText).toContain('Action approved');
    });

    it('rejects unknown tool name with -32601 Method/Tool not found', async () => {
      const res = await call('unknown_fake_tool_xyz', {});
      expect(res.body.error?.code === -32601 || res.body.result?.isError).toBe(true);
    });

    it('executes compatibility alias workspace.calendar.list_events', async () => {
      const res = await call('workspace.calendar.list_events', { targetDate: 'tomorrow' });
      expect(res.status).toBe(200);
      const text = res.body.result?.content?.[0]?.text;
      expect(text).toContain('SUCCESS');
      expect(text).toContain('sample_calendar_adapter');
    });

    it('executes compatibility alias workspace.tasks.create', async () => {
      const res = await call('workspace.tasks.create', {
        title: 'Review Amazon Developer Handoff',
        notes: 'Check all MCP endpoints',
      });
      expect(res.status).toBe(200);
      const text = res.body.result?.content?.[0]?.text;
      expect(text).toContain('SUCCESS');
      expect(text).toContain('Review Amazon Developer Handoff');
    });

    it('executes compatibility alias workspace.gmail.summarize_threads', async () => {
      const res = await call('workspace.gmail.summarize_threads', { query: 'deck' });
      expect(res.status).toBe(200);
      const text = res.body.result?.content?.[0]?.text;
      expect(text).toContain('threadsFound');
      expect(text).toContain('sample_gmail_adapter');
    });

    it('executes compatibility alias smarthome.scenes.activate', async () => {
      const res = await call('smarthome.scenes.activate', { sceneId: 'Deep Focus' });
      expect(res.status).toBe(200);
      const text = res.body.result?.content?.[0]?.text;
      expect(text).toContain('activated');
    });
  });

  describe('5. Multi-Tenant User Isolation & Ownership Invariants', () => {
    it('strictly isolates tasks between User A and User B and rejects body userId tampering', async () => {
      // 1. User A creates task with spoofed userId in body
      const createRes = await api('/api/tasks', {
        method: 'POST',
        headers: { Authorization: `Bearer ${validTokenA}` },
        body: JSON.stringify({
          title: 'User A Confidential Task',
          priority: 'HIGH',
          userId: 'spoofed_user_id_evil',
        }),
      });

      expect(createRes.status).toBe(200);
      const task = createRes.body.task;
      expect(task.id).toBeDefined();
      expect(task.userId).toBe(userA.uid); // Strictly bound to verified token

      // 2. User B attempts to read User A task -> 404
      const readRes = await api(`/api/tasks/${task.id}`, {
        headers: { Authorization: `Bearer ${validTokenB}` },
      });
      expect(readRes.status).toBe(404);

      // 3. User B attempts to update User A task -> 404
      const updateRes = await api(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${validTokenB}` },
        body: JSON.stringify({ title: 'Tampered' }),
      });
      expect(updateRes.status).toBe(404);

      // 4. User B attempts to delete User A task -> 404
      const deleteRes = await api(`/api/tasks/${task.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${validTokenB}` },
      });
      expect(deleteRes.status).toBe(404);

      // 5. User A deletes their own task -> 200
      const ownDeleteRes = await api(`/api/tasks/${task.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      expect(ownDeleteRes.status).toBe(200);
      expect(ownDeleteRes.body.success).toBe(true);
    });

    it('rejects cross-user approval of staged commerce carts', async () => {
      // User A stages a cart
      const cart = await persistence.stageCart(
        [{ id: '1', title: 'Coffee', quantity: 1, unitPrice: 20, totalPrice: 20 }],
        userA.uid
      );

      // User B attempts to approve User A cart
      const hijackApproval = await api('/api/cart/confirm', {
        method: 'POST',
        headers: { Authorization: `Bearer ${validTokenB}` },
        body: JSON.stringify({
          tokenOrStageId: cart.stageId,
          decision: 'APPROVE',
        }),
      });

      expect(hijackApproval.status).toBe(403);
      expect(hijackApproval.body.message).toContain('belongs to another user');
    });

    it('isolates context profiles across users via GET /api/context and rejects unauthenticated requests', async () => {
      // 1. Unauthenticated request -> 401
      const anonRes = await api('/api/context');
      expect(anonRes.status).toBe(401);

      // 2. User A profile
      const userARes = await api('/api/context', {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      expect(userARes.status).toBe(200);
      expect(userARes.body.profile.userId).toBe(userA.uid);
      expect(userARes.body.provenance).toBe('authenticated_user_profile');

      // 3. User B profile
      const userBRes = await api('/api/context', {
        headers: { Authorization: `Bearer ${validTokenB}` },
      });
      expect(userBRes.status).toBe(200);
      expect(userBRes.body.profile.userId).toBe(userB.uid);
      expect(userBRes.body.provenance).toBe('authenticated_user_profile');
      expect(userBRes.body.profile.userId).not.toBe(userARes.body.profile.userId);
    });

    it('ensures tasks created via MCP tool calls are scoped to the authenticated session user', async () => {
      // Initialize MCP session for User A
      const initA = await api('/mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${validTokenA}` },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            clientInfo: { name: 'AuditClientA', version: '1.0.0' },
          },
        }),
      });
      const sidA = initA.headers.get('mcp-session-id')!;

      // Call nexus_create_task via User A's MCP session
      const createRes = await api('/mcp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Mcp-Session-Id': sidA,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 10,
          method: 'tools/call',
          params: {
            name: 'nexus_create_task',
            arguments: {
              title: 'MCP Scoped Task for User A',
              priority: 'HIGH',
            },
          },
        }),
      });
      expect(createRes.status).toBe(200);
      const text = createRes.body.result?.content?.[0]?.text;
      const parsed = JSON.parse(text);
      expect(parsed.status).toBe('SUCCESS');
      expect(parsed.task.userId).toBe(userA.uid);

      // Verify User B cannot access this task via REST
      const userBRead = await api(`/api/tasks/${parsed.task.id}`, {
        headers: { Authorization: `Bearer ${validTokenB}` },
      });
      expect(userBRead.status).toBe(404);

      // Verify User A can access it via REST
      const userARead = await api(`/api/tasks/${parsed.task.id}`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      expect(userARead.status).toBe(200);
      expect(userARead.body.task.userId).toBe(userA.uid);
    });
  });
});
