/**
 * Nexus AI — Streamable HTTP MCP Client
 *
 * Implements a genuine Model Context Protocol (MCP) client running in the
 * browser that connects directly to the Nexus MCP server over Streamable HTTP.
 *
 * Supports:
 * - MCP Handshake / `initialize`
 * - Tool discovery / `tools/list`
 * - Tool execution / `tools/call`
 * - JSON-RPC 2.0 wire validation
 * - Session header tracking (`Mcp-Session-Id`)
 */

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpToolCallResponse {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
  }>;
  isError?: boolean;
}

export class StreamableHttpMcpClient {
  private endpointUrl: string;
  private sessionId: string | null = null;
  private requestId = 1;
  private isInitialized = false;

  constructor(endpointUrl = '/mcp') {
    this.endpointUrl = endpointUrl;
  }

  /**
   * Send a JSON-RPC 2.0 request over Streamable HTTP POST.
   */
  private async postJsonRpc(method: string, params?: Record<string, unknown>): Promise<any> {
    const id = `req_${this.requestId++}`;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || {},
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const response = await fetch(this.endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    // Capture session ID if returned by server
    const serverSessionId = response.headers.get('Mcp-Session-Id');
    if (serverSessionId) {
      this.sessionId = serverSessionId;
    }

    if (!response.ok) {
      throw new Error(`MCP HTTP error ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      // Chunked stream handling: read text chunk and parse last JSON-RPC line
      const rawText = await response.text();
      const lines = rawText.split('\n');
      for (const line of lines) {
        if (line.startsWith('data:')) {
          try {
            return JSON.parse(line.replace('data:', '').trim()).result;
          } catch {
            // continue looking
          }
        }
      }
      return { raw: rawText };
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(`MCP Error [${json.error.code}]: ${json.error.message}`);
    }

    return json.result;
  }

  /**
   * Perform MCP protocol handshake.
   */
  async initialize(): Promise<{
    serverInfo: { name: string; version: string };
    capabilities: Record<string, unknown>;
  }> {
    const result = await this.postJsonRpc('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
      },
      clientInfo: {
        name: 'nexus-alexa-web-simulator',
        version: '1.0.0',
      },
    });

    // Notify server of completed initialization
    await fetch(this.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    }).catch(() => {});

    this.isInitialized = true;
    return result;
  }

  /**
   * Discover available tools from the Nexus MCP Server.
   */
  async listTools(): Promise<McpToolDefinition[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    const result = await this.postJsonRpc('tools/list');
    return result?.tools || [];
  }

  /**
   * Execute an MCP tool by name with arguments.
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpToolCallResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return await this.postJsonRpc('tools/call', {
      name,
      arguments: args,
    });
  }

  /**
   * Check connection status to Nexus MCP server.
   */
  async ping(): Promise<boolean> {
    try {
      const res = await fetch('/health');
      return res.ok;
    } catch {
      return false;
    }
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

// Global MCP Client singleton for frontend
export const mcpClient = new StreamableHttpMcpClient();
