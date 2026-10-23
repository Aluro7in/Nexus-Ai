/**
 * Nexus MCP Client
 * 
 * Implements Model Context Protocol (MCP) Streamable HTTP protocol (spec version: 2025-11-25).
 * Connects frontend to the Antigravity nexus-core backend without replacing or duplicating it.
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  category: string;
  approvalRequired: boolean;
}

export interface MCPInvocationResult {
  tool: string;
  status: 'running' | 'completed' | 'failed' | 'pending_approval';
  result?: any;
  error?: string;
  isDemoAdapter: boolean;
  timestamp: string;
}

export interface MCPInitializeResponse {
  protocolVersion: string;
  capabilities: Record<string, any>;
  serverInfo: {
    name: string;
    version: string;
  };
}

export class NexusMcpClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  private isConnected = false;
  private protocolVersion: string = '2025-11-25';
  private rpcIdCounter: number = 1;

  constructor(baseUrl: string = 'http://localhost:8080/mcp') {
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.trim();
    this.sessionId = null;
    this.isConnected = false;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getProtocolVersion(): string {
    return this.protocolVersion;
  }

  /**
   * Dispatches JSON-RPC 2.0 payload via server-side relay to avoid browser mixed-content restrictions
   */
  private async dispatchJsonRpc(payload: any): Promise<any> {
    const res = await fetch('/api/nexus/mcp-relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: this.baseUrl,
        payload,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `MCP relay responded with status ${res.status}`);
    }

    const relayResult = await res.json();
    return relayResult.data;
  }

  /**
   * Initializes MCP session with nexus-core following MCP Streamable HTTP 2025-11-25
   */
  async initializeSession(): Promise<{
    connected: boolean;
    serverInfo?: { name: string; version: string };
    protocolVersion?: string;
    message: string;
  }> {
    try {
      const initPayload = {
        jsonrpc: '2.0',
        id: this.rpcIdCounter++,
        method: 'initialize',
        params: {
          protocolVersion: this.protocolVersion,
          capabilities: {
            roots: { listChanged: false },
            sampling: {},
          },
          clientInfo: {
            name: 'nexus-ambient-os-client',
            version: '1.0.0',
          },
        },
      };

      const data = await this.dispatchJsonRpc(initPayload);

      if (data?.result) {
        this.isConnected = true;
        this.protocolVersion = data.result.protocolVersion || this.protocolVersion;
        return {
          connected: true,
          serverInfo: data.result.serverInfo,
          protocolVersion: this.protocolVersion,
          message: `Negotiated MCP Streamable HTTP (${this.protocolVersion}) with ${data.result.serverInfo?.name || 'nexus-core'}.`,
        };
      }
    } catch {
      // Fall through to standby demo adapter
    }

    this.isConnected = false;
    return {
      connected: false,
      message: `nexus-core at ${this.baseUrl} is on standby. Labeled Demo Adapter active.`,
    };
  }

  async checkStatus(): Promise<{
    connected: boolean;
    mode: 'live_nexus_core' | 'demo_adapter';
    message: string;
  }> {
    const init = await this.initializeSession();
    if (init.connected) {
      return {
        connected: true,
        mode: 'live_nexus_core',
        message: init.message,
      };
    }
    return {
      connected: false,
      mode: 'demo_adapter',
      message: init.message,
    };
  }

  async listTools(): Promise<MCPTool[]> {
    const defaultTools: MCPTool[] = [
      {
        name: 'workspace.calendar.list_events',
        description: 'Read upcoming calendar entries for schedule awareness',
        inputSchema: { type: 'object', properties: { timeMin: { type: 'string' } } },
        category: 'Workspace',
        approvalRequired: false,
      },
      {
        name: 'workspace.gmail.summarize_threads',
        description: 'Summarize unread high-priority inbox emails',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
        category: 'Communication',
        approvalRequired: false,
      },
      {
        name: 'workspace.tasks.create',
        description: 'Create a new synchronized task in Google Tasks',
        inputSchema: { type: 'object', required: ['title'], properties: { title: { type: 'string' } } },
        category: 'Tasks',
        approvalRequired: true,
      },
      {
        name: 'smarthome.scenes.activate',
        description: 'Activate ambient lighting and environmental scenes',
        inputSchema: { type: 'object', required: ['sceneId'], properties: { sceneId: { type: 'string' } } },
        category: 'Smart Home',
        approvalRequired: false,
      },
      {
        name: 'commerce.cart.prepare_checkout',
        description: 'Stage an order for physical items and request user confirmation',
        inputSchema: { type: 'object', required: ['items'], properties: { items: { type: 'array' } } },
        category: 'Commerce',
        approvalRequired: true,
      },
    ];

    if (!this.isConnected) {
      return defaultTools;
    }

    try {
      const payload = {
        jsonrpc: '2.0',
        id: this.rpcIdCounter++,
        method: 'tools/list',
        params: {},
      };
      const data = await this.dispatchJsonRpc(payload);
      if (data?.result?.tools) {
        return data.result.tools;
      }
    } catch {
      // Fallback
    }
    return defaultTools;
  }

  async invokeTool(toolName: string, args: Record<string, any>): Promise<MCPInvocationResult> {
    const timestamp = new Date().toLocaleTimeString();

    if (this.isConnected) {
      try {
        const payload = {
          jsonrpc: '2.0',
          id: this.rpcIdCounter++,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args,
          },
        };
        const data = await this.dispatchJsonRpc(payload);
        if (data?.result) {
          return {
            tool: toolName,
            status: 'completed',
            result: data.result,
            isDemoAdapter: false,
            timestamp,
          };
        }
      } catch (err: any) {
        console.warn('MCP tool invocation failed:', err);
      }
    }

    // Explicitly labeled Demo Adapter
    let simulatedResult: any = { status: 'acknowledged', params: args };
    let status: MCPInvocationResult['status'] = 'completed';

    if (toolName.includes('create') || toolName.includes('checkout') || toolName.includes('send')) {
      status = 'pending_approval';
      simulatedResult = {
        action: 'Awaiting User Confirmation',
        details: args,
        notice: 'Human-in-the-loop gate triggered. Explicit confirmation required before committing.',
      };
    } else if (toolName.includes('scenes')) {
      simulatedResult = { activeScene: args.sceneId || 'Focus Ambient Glow', lightsAdjusted: 4 };
    } else if (toolName.includes('calendar')) {
      simulatedResult = { synchronizedEvents: 3, nextConflict: null };
    }

    return {
      tool: toolName,
      status,
      result: simulatedResult,
      isDemoAdapter: true,
      timestamp,
    };
  }
}

export const mcpClient = new NexusMcpClient();
