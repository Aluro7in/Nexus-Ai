/**
 * Nexus MCP Client
 * 
 * Implements Model Context Protocol (MCP) Streamable HTTP client.
 * Connects the frontend to the production Nexus Core backend (https://nexus-core-v4j3.onrender.com)
 * via secure server-side proxies, preventing credential leakage and browser CORS failures.
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: Record<string, any>;
  category: string;
  permissions?: 'read' | 'write_guarded' | 'execute' | 'approval_required';
  approvalRequired: boolean;
}

export interface MCPInvocationResult {
  tool: string;
  status: 'running' | 'completed' | 'failed' | 'pending_approval';
  result?: any;
  error?: string;
  isDemoAdapter: boolean;
  timestamp: string;
  warning?: string;
}

export interface MCPInitializeResponse {
  protocolVersion: string;
  capabilities: Record<string, any>;
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface OAuthAuditData {
  advertisedAuthServer: string;
  isResourceMetadataAvailable: boolean;
  scopesSupported: string[];
  endpointsChecked: {
    authorize: { url: string; status: number; implemented: boolean };
    token: { url: string; status: number; implemented: boolean };
    wellKnown: { url: string; status: number; implemented: boolean };
  };
  isOAuthFullyImplemented: boolean;
  missingComponents: string[];
}

export type McpConnectionState =
  | 'connected'
  | 'auth_required'
  | 'permission_denied'
  | 'standby'
  | 'error'
  | 'loading';

export class NexusMcpClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  private isConnected = false;
  private protocolVersion: string = '2024-11-05';
  private rpcIdCounter: number = 1;
  private connectionState: McpConnectionState = 'loading';
  private lastAuditResult: OAuthAuditData | null = null;
  private discoveredTools: MCPTool[] = [];

  constructor(baseUrl: string = 'https://nexus-core-v4j3.onrender.com') {
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.trim();
    this.sessionId = null;
    this.isConnected = false;
    this.connectionState = 'loading';
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getProtocolVersion(): string {
    return this.protocolVersion;
  }

  getConnectionState(): McpConnectionState {
    return this.connectionState;
  }

  getLastAuditResult(): OAuthAuditData | null {
    return this.lastAuditResult;
  }

  /**
   * Probes backend health, status catalog, and OAuth capabilities
   */
  async checkStatus(): Promise<{
    connected: boolean;
    mode: 'live_nexus_core' | 'demo_adapter';
    state: McpConnectionState;
    message: string;
    toolsCount: number;
    oauthImplemented: boolean;
    missingComponents?: string[];
  }> {
    try {
      this.connectionState = 'loading';

      // 1. Fetch live status & tool catalog from server proxy
      const [statusRes, auditRes, initRes] = await Promise.all([
        fetch('/api/nexus/status').then((r) => r.json()).catch(() => null),
        fetch('/api/nexus/oauth-audit').then((r) => r.json()).catch(() => null),
        fetch('/api/nexus/initialize', { method: 'POST' }).then((r) => r.json()).catch(() => null),
      ]);

      if (auditRes) {
        this.lastAuditResult = auditRes;
      }

      // Check if backend responded to initialize
      if (initRes?.connected) {
        this.isConnected = true;
        this.connectionState = 'connected';
        this.protocolVersion = initRes.protocolVersion || this.protocolVersion;

        return {
          connected: true,
          mode: 'live_nexus_core',
          state: 'connected',
          message: `Connected to live Nexus Core (${this.protocolVersion}). All tools active.`,
          toolsCount: statusRes?.toolsAvailable?.length || 7,
          oauthImplemented: auditRes?.isOAuthFullyImplemented ?? false,
        };
      }

      // If backend responded with 401: Authentication Required
      if (initRes?.status === 'auth_required' || initRes?.httpStatus === 401) {
        this.isConnected = false;
        this.connectionState = 'auth_required';

        const missingNote = auditRes?.missingComponents?.length
          ? `Backend advertises OAuth at ${auditRes.advertisedAuthServer}, but endpoints are missing: ${auditRes.missingComponents.join(', ')}.`
          : 'Backend requires a Bearer token in production.';

        return {
          connected: false,
          mode: 'live_nexus_core',
          state: 'auth_required',
          message: `Nexus Core reachable. Authentication Required (401). ${missingNote}`,
          toolsCount: statusRes?.toolsAvailable?.length || 7,
          oauthImplemented: false,
          missingComponents: auditRes?.missingComponents || ['OAuth authorization endpoints not implemented on backend'],
        };
      }

      // If backend is standby
      this.isConnected = false;
      this.connectionState = 'standby';
      return {
        connected: false,
        mode: 'demo_adapter',
        state: 'standby',
        message: 'Nexus Core is on standby. Ambient compatibility adapter active.',
        toolsCount: 7,
        oauthImplemented: false,
      };
    } catch (err: any) {
      this.isConnected = false;
      this.connectionState = 'error';
      return {
        connected: false,
        mode: 'demo_adapter',
        state: 'error',
        message: `Connection error: ${err.message}`,
        toolsCount: 0,
        oauthImplemented: false,
      };
    }
  }

  /**
   * Initializes MCP session with nexus-core following MCP Streamable HTTP
   */
  async initializeSession(): Promise<{
    connected: boolean;
    serverInfo?: { name: string; version: string };
    protocolVersion?: string;
    message: string;
  }> {
    const status = await this.checkStatus();
    return {
      connected: status.connected,
      protocolVersion: this.protocolVersion,
      message: status.message,
    };
  }

  /**
   * Discovers tools from live backend
   */
  async listTools(): Promise<MCPTool[]> {
    try {
      const res = await fetch('/api/nexus/tools');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tools)) {
          this.discoveredTools = data.tools.map((t: any) => ({
            name: t.name,
            description: t.description || `${t.name} (${t.permissions || 'tool'})`,
            inputSchema: t.inputSchema || { type: 'object' },
            category: t.category || 'System',
            permissions: t.permissions,
            approvalRequired: t.permissions === 'write_guarded' || t.permissions === 'approval_required' || t.permissions === 'execute',
          }));
          return this.discoveredTools;
        }
      }
    } catch {
      // Fall through to fallback
    }

    return [
      {
        name: 'workspace.calendar.list_events',
        description: 'Read upcoming calendar entries for schedule awareness',
        inputSchema: { type: 'object', properties: { timeMin: { type: 'string' } } },
        category: 'Workspace',
        permissions: 'read',
        approvalRequired: false,
      },
      {
        name: 'workspace.gmail.summarize_threads',
        description: 'Summarize unread high-priority inbox emails',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
        category: 'Communication',
        permissions: 'read',
        approvalRequired: false,
      },
      {
        name: 'workspace.tasks.create',
        description: 'Create a new synchronized task in Google Tasks',
        inputSchema: { type: 'object', required: ['title'], properties: { title: { type: 'string' } } },
        category: 'Tasks',
        permissions: 'write_guarded',
        approvalRequired: true,
      },
      {
        name: 'smarthome.scenes.activate',
        description: 'Activate ambient lighting and environmental scenes',
        inputSchema: { type: 'object', required: ['sceneId'], properties: { sceneId: { type: 'string' } } },
        category: 'Smart Home',
        permissions: 'execute',
        approvalRequired: true,
      },
      {
        name: 'commerce.cart.prepare_checkout',
        description: 'Stage an order for physical items and request user confirmation',
        inputSchema: { type: 'object', required: ['items'], properties: { items: { type: 'array' } } },
        category: 'Commerce',
        permissions: 'approval_required',
        approvalRequired: true,
      },
      {
        name: 'nexus_get_context',
        description: 'Retrieve ambient digital operating context and schedule overview',
        inputSchema: { type: 'object' },
        category: 'Context',
        permissions: 'read',
        approvalRequired: false,
      },
      {
        name: 'nexus_confirm_action',
        description: 'Explicit user authorization gatekeeper for staged actions',
        inputSchema: { type: 'object', required: ['actionId'], properties: { actionId: { type: 'string' } } },
        category: 'Safety',
        permissions: 'execute',
        approvalRequired: true,
      },
    ];
  }

  /**
   * Invokes an MCP tool safely through the server gatekeeper.
   * If confirmation is required, returns 'pending_approval' unless confirmed is true.
   */
  async invokeTool(
    toolName: string,
    args: Record<string, any>,
    confirmed: boolean = false
  ): Promise<MCPInvocationResult> {
    const timestamp = new Date().toLocaleTimeString();

    // Human-in-the-loop protection: Consequential actions require explicit user confirmation
    const requiresConfirmation =
      toolName.includes('create') ||
      toolName.includes('checkout') ||
      toolName.includes('send') ||
      toolName.includes('order') ||
      toolName.includes('activate') ||
      toolName.includes('delete');

    if (requiresConfirmation && !confirmed) {
      return {
        tool: toolName,
        status: 'pending_approval',
        result: {
          action: 'Awaiting User Confirmation',
          details: args,
          warning: 'Human-in-the-loop security gate: explicit user confirmation is required before committing external changes.',
        },
        warning: 'Explicit user confirmation required.',
        isDemoAdapter: false,
        timestamp,
      };
    }

    try {
      const res = await fetch('/api/nexus/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: toolName,
          arguments: args,
          confirmed,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          tool: toolName,
          status: data.status || 'completed',
          result: data.result,
          isDemoAdapter: Boolean(data.isDemoAdapter),
          warning: data.warning,
          timestamp,
        };
      }
    } catch (err: any) {
      console.warn('Tool call error:', err);
    }

    // Fallback safe simulation
    return {
      tool: toolName,
      status: 'completed',
      result: { status: 'acknowledged', params: args },
      isDemoAdapter: true,
      timestamp,
    };
  }
}

export const mcpClient = new NexusMcpClient();
