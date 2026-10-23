/**
 * Nexus AI — Streamable HTTP MCP Server and Application Gateway
 *
 * Implements:
 * 1. Compliant MCP Streamable HTTP endpoint on `/mcp` using official @modelcontextprotocol/sdk.
 *    - Full multi-session support with stateful session tracking.
 *    - Negotiates MCP specification 2025-11-25 and 2024-11-05.
 * 2. RFC 9728 Protected Resource Metadata (PRM) on `/.well-known/oauth-protected-resource/mcp`.
 * 3. Registered tools with Zod validation + Namespaced compatibility aliases.
 * 4. Origin-restricted CORS and multi-tenant Bearer authentication.
 * 5. SSRF-safe MCP Relay on `/api/nexus/mcp-relay`.
 * 6. Two-phase confirmation safety engine for consequential actions.
 * 7. REST compatibility endpoints for the companion web simulator.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerNexusTools } from './tools/registry.js';
import { orchestrator } from './orchestrator/workflow.js';
import {
  persistence,
  initPersistence,
  setStorageAdapter,
  type StorageAdapter,
  type PersistenceInitOptions,
} from './store/persistence.js';
import { createAuthMiddleware } from './auth.js';
import type { Task } from './types.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

export interface ActiveSession {
  sessionId: string;
  userId?: string;
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  createdAt: number;
  lastActive: number;
}

export function createMcpServerInstance(userId?: string): McpServer {
  const server = new McpServer(
    {
      name: 'nexus-core',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: { listChanged: true },
        prompts: {},
        resources: {},
        logging: {},
      },
    }
  );

  registerNexusTools(server, userId);
  return server;
}

export async function createNexusApp(options?: {
  storageAdapter?: StorageAdapter;
  persistenceOptions?: PersistenceInitOptions;
}) {
  if (options?.storageAdapter) {
    setStorageAdapter(options.storageAdapter);
  } else {
    await initPersistence(options?.persistenceOptions);
  }

  const app = express();

  // ─── 1. Security: Origin-Restricted CORS ────────────────────────────────────
  const defaultAllowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];
  const envAllowed = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  // In production, when ALLOWED_ORIGINS is configured, strictly allow only those explicit origins
  const allowedOrigins =
    process.env.NODE_ENV === 'production' && envAllowed.length > 0
      ? [...new Set(envAllowed)]
      : [...new Set([...defaultAllowedOrigins, ...envAllowed])];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server, curl, CLI)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Mcp-Session-Id',
        'Mcp-Protocol-Version',
        'Origin',
      ],
      exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id', 'Mcp-Protocol-Version'],
    })
  );

  app.use(express.json());

  // ─── 2. Security: Request Authentication Middleware ────────────────────────
  const authMiddleware = createAuthMiddleware();

  // ─── 3. Root & Health Probes ───────────────────────────────────────────────
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'nexus-core',
      version: '1.0.0',
      description: 'Nexus AI — Model Context Protocol (MCP) Streamable HTTP Server for Alexa+',
      status: 'HEALTHY',
      endpoints: {
        mcp: `http://${HOST}:${PORT}/mcp`,
        relay: `http://${HOST}:${PORT}/api/nexus/mcp-relay`,
        prm: `http://${HOST}:${PORT}/.well-known/oauth-protected-resource/mcp`,
        health: `http://${HOST}:${PORT}/health`,
        status: `http://${HOST}:${PORT}/api/nexus/status`,
        workflow: `http://${HOST}:${PORT}/api/workflow/run`,
      },
      tools: [
        'nexus_get_context',
        'nexus_get_schedule',
        'nexus_create_task',
        'nexus_stage_cart',
        'nexus_get_workflow_status',
        'nexus_confirm_action',
        'workspace.calendar.list_events',
        'workspace.tasks.create',
        'commerce.cart.prepare_checkout',
        'workspace.gmail.summarize_threads',
        'smarthome.scenes.activate',
      ],
    });
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // Handoff-compatible /api/health probe
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY),
      mcpBackendStatus: 'ready',
      version: '1.0.0',
    });
  });

  // Handoff-compatible /api/nexus/status tool catalog advertisement
  app.get('/api/nexus/status', (_req: Request, res: Response) => {
    res.json({
      backendName: 'nexus-core',
      protocol: 'MCP-Streamable-HTTP',
      status: 'standby',
      toolsAvailable: [
        { name: 'workspace.calendar.list_events', category: 'productivity', permissions: 'read' },
        { name: 'workspace.gmail.summarize_threads', category: 'communication', permissions: 'read' },
        { name: 'workspace.tasks.create', category: 'productivity', permissions: 'write_guarded' },
        { name: 'smarthome.scenes.activate', category: 'iot', permissions: 'execute' },
        { name: 'commerce.cart.prepare_checkout', category: 'commerce', permissions: 'approval_required' },
        { name: 'nexus_get_context', category: 'context', permissions: 'read' },
        { name: 'nexus_confirm_action', category: 'safety', permissions: 'execute' },
      ],
      note: 'Nexus Core MCP server connection ready. Compatibility adapter active.',
    });
  });

  // ─── 4. RFC 9728 Protected Resource Metadata (PRM) ────────────────────────
  const prmHandler = (req: Request, res: Response) => {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || `${HOST}:${PORT}`;
    const baseUrl = `${protocol}://${host}`;

    res.json({
      resource: `${baseUrl}/mcp`,
      authorization_servers: [`${baseUrl}/oauth`],
      scopes_supported: ['alexa::mcp:read', 'alexa::mcp:write'],
      bearer_methods_supported: ['header'],
      resource_documentation: 'https://github.com/Aluro7in/FoodMind',
    });
  };

  app.get('/.well-known/oauth-protected-resource', prmHandler);
  app.get('/.well-known/oauth-protected-resource/mcp', prmHandler);

  // ─── 5. Multi-Session MCP Streamable HTTP Transport ────────────────────────
  const sessions = new Map<string, ActiveSession>();

  app.post('/mcp', authMiddleware, async (req: Request, res: Response) => {
    const sessionId = (req.headers['mcp-session-id'] as string) || undefined;

    try {
      const messages = Array.isArray(req.body) ? req.body : [req.body];
      const isInit = messages.some((m: any) => m?.method === 'initialize');

      // Case A: Existing session request
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (!session) {
          return res.status(404).json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Session not found' },
            id: null,
          });
        }

        // Cross-user session hijacking protection
        const currentUid = (req as any).user?.uid;
        if (session.userId && currentUid && session.userId !== currentUid) {
          return res.status(403).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Forbidden: Session belongs to another authenticated user' },
            id: null,
          });
        }

        session.lastActive = Date.now();
        await session.transport.handleRequest(req, res, req.body);
        return;
      }

      // Case B: New initialization request
      if (isInit) {
        let sidAssigned: string | undefined;

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            sidAssigned = sid;
            sessions.set(sid, {
              sessionId: sid,
              userId: (req as any).user?.uid,
              transport,
              server,
              createdAt: Date.now(),
              lastActive: Date.now(),
            });
          },
        });

        transport.onclose = () => {
          if (sidAssigned) {
            sessions.delete(sidAssigned);
          }
        };

        const server = createMcpServerInstance((req as any).user?.uid);
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // Case C: Non-init request without session ID
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
        id: null,
      });
    } catch (err) {
      console.error('[MCP POST Error]:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal MCP transport error',
            data: err instanceof Error ? err.message : String(err),
          },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', authMiddleware, async (req: Request, res: Response) => {
    const sessionId = (req.headers['mcp-session-id'] as string) || undefined;
    if (!sessionId) {
      return res.status(400).send('Missing session ID');
    }
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session not found' },
        id: null,
      });
    }
    // Cross-user session protection
    const currentUid = (req as any).user?.uid;
    if (session.userId && currentUid && session.userId !== currentUid) {
      return res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Forbidden: Session belongs to another authenticated user' },
        id: null,
      });
    }
    session.lastActive = Date.now();
    await session.transport.handleRequest(req, res);
  });

  app.delete('/mcp', authMiddleware, async (req: Request, res: Response) => {
    const sessionId = (req.headers['mcp-session-id'] as string) || undefined;
    if (!sessionId) {
      return res.status(400).send('Missing session ID');
    }
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session not found' },
        id: null,
      });
    }
    const currentUid = (req as any).user?.uid;
    if (session.userId && currentUid && session.userId !== currentUid) {
      return res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Forbidden: Session belongs to another authenticated user' },
        id: null,
      });
    }
    sessions.delete(sessionId);
    await session.transport.close();
    res.status(200).json({ success: true, message: 'Session terminated' });
  });

  // ─── 6. SSRF-Safe MCP Relay ────────────────────────────────────────────────
  app.post('/api/nexus/mcp-relay', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { targetUrl, payload } = req.body;
      if (!payload) {
        return res.status(400).json({ isReachable: false, error: 'Payload is required' });
      }

      // Default target is the local verified MCP endpoint
      const defaultTarget = `http://${HOST}:${PORT}/mcp`;
      const destination = targetUrl || defaultTarget;

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(destination);
      } catch {
        return res.status(400).json({ isReachable: false, error: 'Invalid targetUrl format' });
      }

      const hostname = parsedUrl.hostname.toLowerCase();

      // Block cloud metadata services and arbitrary internal networks
      const blockedHosts = [
        '169.254.169.254',
        'metadata.google.internal',
        'metadata',
        'instance-data',
      ];
      if (blockedHosts.includes(hostname)) {
        return res.status(403).json({
          isReachable: false,
          error: `SSRF blocked: Target ${hostname} is restricted.`,
        });
      }

      // Trusted hosts whitelist
      const trustedHosts = ['127.0.0.1', 'localhost', HOST.toLowerCase()];
      if (process.env.TRUSTED_RELAY_HOSTS) {
        trustedHosts.push(
          ...process.env.TRUSTED_RELAY_HOSTS.split(',').map((h) => h.trim().toLowerCase())
        );
      }

      if (!trustedHosts.includes(hostname)) {
        return res.status(403).json({
          isReachable: false,
          error: `SSRF blocked: Target host "${hostname}" is not in the trusted allowlist.`,
        });
      }

      // Forward safely
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const forwardHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      };
      if (req.headers['mcp-session-id']) {
        forwardHeaders['Mcp-Session-Id'] = req.headers['mcp-session-id'] as string;
      }
      if (req.headers.authorization) {
        forwardHeaders['Authorization'] = req.headers.authorization;
      }

      const upstreamRes = await fetch(destination, {
        method: 'POST',
        headers: forwardHeaders,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const rawText = await upstreamRes.text();
      let data: any = null;
      if (rawText.startsWith('event:') || rawText.startsWith('data:') || upstreamRes.headers.get('content-type')?.includes('text/event-stream')) {
        for (const line of rawText.split('\n')) {
          if (line.startsWith('data:')) {
            const jsonStr = line.substring(5).trim();
            if (jsonStr) {
              try {
                data = JSON.parse(jsonStr);
                break;
              } catch {}
            }
          }
        }
      } else {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { raw: rawText };
        }
      }

      res.status(upstreamRes.status).json({
        isReachable: true,
        status: upstreamRes.status,
        data,
      });
    } catch (err: any) {
      res.status(502).json({
        isReachable: false,
        error: `Unable to reach MCP backend: ${err?.message || String(err)}`,
      });
    }
  });

  // ─── 7. REST Endpoints for Companion Web Simulator ────────────────────────
  app.post('/api/workflow/run', authMiddleware, async (req: Request, res: Response) => {
    try {
      const query = req.body?.query;
      const userId = (req as any).user?.uid;
      const result = await orchestrator.executeDemonstrationWorkflow(query, userId);
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/api/workflow/status', authMiddleware, async (req: Request, res: Response) => {
    try {
      const workflowId = req.query.workflowId as string | undefined;
      const userId = (req as any).user?.uid;
      const status = workflowId
        ? await persistence.getWorkflowStatus(workflowId, userId)
        : await persistence.getLatestWorkflow(userId);
      res.json({ success: true, status });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/api/tasks', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.uid;
      const tasks = await persistence.listTasks(userId);
      res.json({ success: true, tasks });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  app.post('/api/tasks', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { title, description, priority, dueDate } = req.body;
      const userId = (req as any).user?.uid;
      if (!title) {
        return res.status(400).json({ success: false, error: 'Title is required' });
      }
      // Strictly use authenticated user UID, ignoring any client-provided body.userId
      const task = await persistence.createTask({
        title,
        description,
        priority,
        dueDate,
        userId,
      });
      res.json({ success: true, task });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  app.get('/api/tasks/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.uid;
      const task = await persistence.getTask(String(id), userId);
      if (!task) {
        return res.status(404).json({ success: false, error: 'Task not found or access denied' });
      }
      res.json({ success: true, task });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  app.patch('/api/tasks/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.uid;
      const updates = { ...req.body };
      delete updates.userId; // Prevent user identity spoofing or transferring
      const task = await persistence.updateTask(String(id), updates, userId);
      if (!task) {
        return res.status(404).json({ success: false, error: 'Task not found or unauthorized' });
      }
      res.json({ success: true, task });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  app.delete('/api/tasks/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.uid;
      const deleted = await persistence.deleteTask(String(id), userId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Task not found or unauthorized' });
      }
      res.json({ success: deleted });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  app.get('/api/context', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.uid;
      const profile = await persistence.getContextProfile(userId);
      const isDemo = profile.userId === 'user_alex_rivera';
      res.json({
        success: true,
        profile,
        provenance: isDemo ? 'nexus_demo_fixture' : 'authenticated_user_profile',
      });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  app.get('/api/schedule', authMiddleware, async (req: Request, res: Response) => {
    try {
      const targetDate = req.query.targetDate as string | undefined;
      const userId = (req as any).user?.uid;
      const events = await persistence.getSchedule(targetDate, userId);
      res.json({ success: true, events, source: 'sample_calendar_adapter' });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  app.get('/api/cart/:stageId', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { stageId } = req.params;
      const userId = (req as any).user?.uid;
      const cart = await persistence.getStagedCart(String(stageId), userId);
      if (!cart) {
        return res.status(404).json({ success: false, error: 'Staged cart not found or unauthorized' });
      }
      res.json({ success: true, cart });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  app.post('/api/cart/confirm', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { tokenOrStageId, decision } = req.body;
      const userId = (req as any).user?.uid;
      if (!tokenOrStageId || !decision) {
        return res.status(400).json({
          success: false,
          error: 'tokenOrStageId and decision ("APPROVE" | "REJECT") are required',
        });
      }
      const result = await persistence.confirmAction(tokenOrStageId, decision, userId);
      if (!result.success && result.message.includes('belongs to another user')) {
        return res.status(403).json(result);
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  app.post('/api/reset', authMiddleware, async (_req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Reset endpoint is disabled in production',
      });
    }
    try {
      await persistence.resetDemoData();
      res.json({ success: true, message: 'Demo data reset to clean baseline state.' });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  // ─── 8. Global Error Handler ──────────────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Avoid leaking stack traces or internal secrets
    const statusCode = typeof err?.status === 'number' ? err.status : 500;
    const message = statusCode < 500 ? (err?.message || 'Bad Request') : 'Internal Server Error';
    if (!res.headersSent) {
      res.status(statusCode).json({
        success: false,
        error: message,
      });
    }
  });

  return { app, sessions, createMcpServerInstance, mcpServer: createMcpServerInstance() };
}

// Start standalone server when executed directly
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  createNexusApp()
    .then(({ app }) => {
      const server = app.listen(PORT, HOST, () => {
        console.log(`\n======================================================`);
        console.log(`🚀 Nexus AI — MCP Server Running!`);
        console.log(`📡 Streamable HTTP MCP Endpoint: http://${HOST}:${PORT}/mcp`);
        console.log(`🛡️  Safe MCP Relay Endpoint: http://${HOST}:${PORT}/api/nexus/mcp-relay`);
        console.log(`🔍 Protected Resource Metadata: http://${HOST}:${PORT}/.well-known/oauth-protected-resource/mcp`);
        console.log(`💓 Health Check: http://${HOST}:${PORT}/health`);
        console.log(`📋 Status Tool Catalog: http://${HOST}:${PORT}/api/nexus/status`);
        console.log(`======================================================\n`);
      });

      // Graceful shutdown handling for container and cloud orchestrators (Render / SIGTERM)
      const shutdown = (signal: string) => {
        console.log(`[Server] Received ${signal}. Initiating graceful shutdown...`);
        server.close(() => {
          console.log('[Server] HTTP server closed cleanly.');
          process.exit(0);
        });
        setTimeout(() => {
          console.error('[Server] Forcing shutdown after timeout.');
          process.exit(1);
        }, 10000).unref();
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    })
    .catch((err) => {
      console.error('Fatal startup error in Nexus Core:', err);
      process.exit(1);
    });
}
