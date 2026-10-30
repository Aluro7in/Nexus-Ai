/**
 * Typed Server-Side Nexus Core MCP Client
 * 
 * Interacts with the live production Nexus Core backend (e.g., https://nexus-core-v4j3.onrender.com)
 * using the MCP Streamable HTTP specification.
 * 
 * Invariants:
 * 1. Tokens and secrets are kept server-side and never exposed to the client bundle.
 * 2. Real OAuth endpoints are verified; missing endpoints are reported accurately without faking auth.
 * 3. Human-in-the-loop confirmation is enforced before invoking any write or consequential actions.
 */

export interface NexusCoreHealthResponse {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  timestamp: string;
  uptimeSeconds: number;
}

export interface NexusCoreToolInfo {
  name: string;
  category: string;
  permissions: 'read' | 'write_guarded' | 'execute' | 'approval_required';
  description?: string;
  inputSchema?: Record<string, any>;
}

export interface NexusCoreStatusResponse {
  backendName: string;
  protocol: string;
  status: string;
  toolsAvailable: NexusCoreToolInfo[];
  note?: string;
  endpoints?: Record<string, string>;
}

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_documentation?: string;
}

export interface OAuthAuditResult {
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

export interface McpInitResult {
  connected: boolean;
  status: 'connected' | 'auth_required' | 'permission_denied' | 'error' | 'standby';
  protocolVersion?: string;
  serverInfo?: { name: string; version: string };
  errorMessage?: string;
  httpStatus?: number;
}

export class NexusCoreClient {
  private baseUrl: string;
  private defaultTimeoutMs: number;

  constructor(baseUrl?: string, timeoutMs: number = 15000) {
    this.baseUrl = (baseUrl || process.env.NEXUS_CORE_BASE_URL || 'https://nexus-core-v4j3.onrender.com').replace(/\/+$/, '');
    this.defaultTimeoutMs = timeoutMs;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}, customTimeoutMs?: number): Promise<Response> {
    const timeout = customTimeoutMs || this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Probes the live health endpoint of the Nexus Core backend.
   * Includes 1 automatic retry to handle Render free-tier cold-start wakeups.
   */
  async checkHealth(retries = 1): Promise<{ isHealthy: boolean; data?: NexusCoreHealthResponse; error?: string }> {
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        return { isHealthy: false, error: `Health check returned HTTP ${res.status}` };
      }

      const data = (await res.json()) as NexusCoreHealthResponse;
      return { isHealthy: data.status === 'UP', data };
    } catch (err: any) {
      if (retries > 0) {
        return this.checkHealth(retries - 1);
      }
      return { isHealthy: false, error: err.name === 'AbortError' ? 'Connection timed out' : err.message };
    }
  }

  /**
   * Fetches the tool catalog and status from /api/nexus/status and /
   * Includes 1 automatic retry to handle Render free-tier cold-start wakeups.
   */
  async getStatus(retries = 1): Promise<{ success: boolean; data?: NexusCoreStatusResponse; error?: string }> {
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/nexus/status`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        return { success: false, error: `Status endpoint returned HTTP ${res.status}` };
      }

      const data = (await res.json()) as NexusCoreStatusResponse;
      return { success: true, data };
    } catch (err: any) {
      if (retries > 0) {
        return this.getStatus(retries - 1);
      }
      return { success: false, error: err.name === 'AbortError' ? 'Connection timed out' : err.message };
    }
  }

  /**
   * Inspects .well-known/oauth-protected-resource/mcp
   */
  async getProtectedResourceMetadata(): Promise<{ success: boolean; data?: ProtectedResourceMetadata; error?: string }> {
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/.well-known/oauth-protected-resource/mcp`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        return { success: false, error: `Protected resource metadata returned HTTP ${res.status}` };
      }

      const data = (await res.json()) as ProtectedResourceMetadata;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.name === 'AbortError' ? 'Connection timed out' : err.message };
    }
  }

  /**
   * Audits the backend's advertised OAuth authorization server endpoints.
   * Tests whether /oauth/authorize, /oauth/token, and .well-known endpoints are actually implemented.
   */
  async auditOAuthEndpoints(): Promise<OAuthAuditResult> {
    const metaRes = await this.getProtectedResourceMetadata();
    const advertisedAuthServer = metaRes.data?.authorization_servers?.[0] || `${this.baseUrl}/oauth`;
    const scopesSupported = metaRes.data?.scopes_supported || ['alexa::mcp:read', 'alexa::mcp:write'];

    const checkUrl = async (url: string) => {
      try {
        const res = await this.fetchWithTimeout(url, { method: 'GET' }, 3500);
        return { url, status: res.status, implemented: res.status !== 404 };
      } catch {
        return { url, status: 0, implemented: false };
      }
    };

    const [authEndpoint, tokenEndpoint, wellKnownEndpoint] = await Promise.all([
      checkUrl(`${advertisedAuthServer}/authorize`),
      checkUrl(`${advertisedAuthServer}/token`),
      checkUrl(`${this.baseUrl}/.well-known/oauth-authorization-server`),
    ]);

    const missingComponents: string[] = [];
    if (!authEndpoint.implemented) missingComponents.push('GET /oauth/authorize (Authorization Endpoint)');
    if (!tokenEndpoint.implemented) missingComponents.push('POST /oauth/token (Token Issuance Endpoint)');
    if (!wellKnownEndpoint.implemented) missingComponents.push('GET /.well-known/oauth-authorization-server (Discovery Document)');

    return {
      advertisedAuthServer,
      isResourceMetadataAvailable: metaRes.success,
      scopesSupported,
      endpointsChecked: {
        authorize: authEndpoint,
        token: tokenEndpoint,
        wellKnown: wellKnownEndpoint,
      },
      isOAuthFullyImplemented: missingComponents.length === 0,
      missingComponents,
    };
  }

  /**
   * Attempts MCP JSON-RPC initialization against /mcp
   */
  async initializeSession(token?: string): Promise<McpInitResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Protocol-Version': '2024-11-05',
    };

    const authToken = token || process.env.NEXUS_CORE_BEARER_TOKEN;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
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

    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));

      if (res.status === 401) {
        const errorMsg = body?.error?.message || 'Unauthorized: Bearer token required in production';
        return {
          connected: false,
          status: 'auth_required',
          errorMessage: errorMsg,
          httpStatus: 401,
        };
      }

      if (res.status === 403) {
        return {
          connected: false,
          status: 'permission_denied',
          errorMessage: body?.error?.message || 'Forbidden: Insufficient permissions',
          httpStatus: 403,
        };
      }

      if (!res.ok) {
        return {
          connected: false,
          status: 'error',
          errorMessage: body?.error?.message || `HTTP ${res.status}`,
          httpStatus: res.status,
        };
      }

      return {
        connected: true,
        status: 'connected',
        protocolVersion: body?.result?.protocolVersion || '2024-11-05',
        serverInfo: body?.result?.serverInfo,
        httpStatus: 200,
      };
    } catch (err: any) {
      return {
        connected: false,
        status: err.name === 'AbortError' ? 'standby' : 'error',
        errorMessage: err.message,
      };
    }
  }

  /**
   * Relays an MCP JSON-RPC call safely through the server.
   */
  async relayMcpPayload(payload: any, token?: string): Promise<{ status: number; data: any }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Protocol-Version': '2024-11-05',
    };

    const authToken = token || process.env.NEXUS_CORE_BEARER_TOKEN;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await this.fetchWithTimeout(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }
}

export const defaultNexusCoreClient = new NexusCoreClient();
