# Nexus AI — Phase 9C: Post-Audit Triage and Frontend Readiness Report

**Audit Date:** October 23, 2026
**Auditor:** Antigravity Advanced Agentic AI Engineering
**Target Repository:** `Aluro7in/FoodMind` (`nexus-core`, `nexus-web`)
**Scope:** Triage of Phase 9B findings, user identity & tenant isolation remediation, authentication verification, external integration truth audit, frontend connection contract, and final GO / NO-GO evaluation.

---

## Executive Summary

Phase 9C triages the findings of the comprehensive Phase 9B audit and delivers all functional and architectural fixes required before connecting the frontend (including Google AI Studio) to Nexus Core.

### Key Accomplishments in Phase 9C:
1. **Persisted Audit Truth:** The complete Phase 9B report was committed to [`docs/audits/PHASE_9B_VERIFICATION_REPORT.md`](file:///c:/Users/Lenovo/Nexus%20ai/docs/audits/PHASE_9B_VERIFICATION_REPORT.md).
2. **Resolved "Alex Rivera" Identity Mystery:** Traced the ambient hackathon fixture in the persistence layer. Fixed an architectural omission in `src/index.ts` where MCP session instances were created without passing the authenticated `req.user.uid`, causing MCP tool handlers to fall back to the demo fixture. Scoped all MCP tools (`nexus_get_context`, `nexus_get_schedule`, `nexus_create_task`, `nexus_stage_cart`, etc.) to the verified Firebase token UID.
3. **Enforced Strict Multi-Tenant Isolation:** Guaranteed that client-supplied body `userId` tampering is rejected, cross-user session hijacking returns `403 Forbidden`, and staged commerce carts cannot be approved across tenants.
4. **Added REST `/api/context` Endpoint:** Provided frontend parity for fetching authenticated user profiles with provenance labels (`authenticated_user_profile` vs `nexus_demo_fixture`).
5. **Truthful External Integration Audit:** Audited OpenClaw, Hermes, Supermemory, Google Calendar, Gmail, Google Tasks, and Gemini. Classified each accurately without fabricating live status.
6. **Automated Regression Test Suite:** Expanded the test suite to **68/68 passing tests** (`vitest run` exit code 0) and clean TypeScript compilation (`tsc` exit code 0).

---

## 1. User Identity & Tenant Isolation Triage

### 1.1 The "Alex Rivera" Root Cause Analysis
During Phase 9B, invoking `nexus_get_context` returned user preferences and demo context associated with "Alex Rivera" (`user_alex_rivera`).

**Investigation Findings:**
- **Origin:** "Alex Rivera" was originally created in `LocalMemoryStorageAdapter` and `FirestoreStorageAdapter` (`createDefaultProfile()`) as a baseline ambient demo fixture for the Amazon Developer Hackathon (Alexa+ track).
- **The Defect:** In `nexus-core/src/index.ts` (line 266), when a client initiated an MCP session via `POST /mcp` (method: `initialize`), the transport was established with `(req as any).user?.uid`, but the MCP server instance itself was instantiated as:
  ```typescript
  // Before fix:
  const server = createMcpServerInstance(); // No userId provided!
  ```
  `createMcpServerInstance` called `registerNexusTools(server, undefined)`. Inside `nexus-core/src/tools/registry.ts`, tool closures captured `userId: undefined`. When tools such as `nexus_get_context`, `nexus_create_task`, or `nexus_get_schedule` executed, they invoked `persistence.getContextProfile(undefined)`. Because `userId` was undefined, persistence returned the fallback default profile for Alex Rivera.
- **The Fix:**
  1. Updated `registerNexusTools(server: McpServer, userId?: string)` in [`nexus-core/src/tools/registry.ts`](file:///c:/Users/Lenovo/Nexus%20ai/nexus-core/src/tools/registry.ts) to accept `userId` and forward it to all registered tool handlers and compatibility aliases.
  2. Updated `createMcpServerInstance(userId?: string)` in [`nexus-core/src/index.ts`](file:///c:/Users/Lenovo/Nexus%20ai/nexus-core/src/index.ts) to accept `userId`.
  3. In `POST /mcp` session initialization in `src/index.ts`, invoked:
     ```typescript
     // After fix:
     const server = createMcpServerInstance((req as any).user?.uid);
     ```
  4. Added `GET /api/context` to `src/index.ts` so REST clients can retrieve their authenticated context profile with explicit provenance labeling:
     - `provenance: 'authenticated_user_profile'` for verified users (`userId: '<firebase_uid>'`).
     - `provenance: 'nexus_demo_fixture'` for explicit unauthenticated demo mode.

### 1.2 Data Isolation & Tenant Boundaries
All stateful operations in Nexus Core are now strictly partitioned:
| Domain | Route / Tool | Tenant Scoping Rule | Verification Outcome |
| :--- | :--- | :--- | :--- |
| **Context** | `nexus_get_context`, `GET /api/context` | Scoped to authenticated token `uid`. Returns user preferences document from Firestore `/user_preferences/{uid}`. | **VERIFIED** |
| **Tasks** | `nexus_create_task`, `POST /api/tasks` | Ignores/strips any client-provided `body.userId`. Tasks are stored with `userId = req.user.uid`. | **VERIFIED** |
| **Task Access** | `GET /api/tasks/:id`, `PATCH`, `DELETE` | Access is rejected (`404 Not Found`) if `task.userId !== req.user.uid`. | **VERIFIED** |
| **Commerce Carts** | `nexus_stage_cart`, `POST /api/cart/confirm` | Cart stages are tagged with `userId`. Confirmation by another tenant returns `403 Forbidden`. | **VERIFIED** |
| **MCP Sessions** | `POST /mcp`, `DELETE /mcp` | Reusing an active `Mcp-Session-Id` with a different Bearer token returns `403 Forbidden`. | **VERIFIED** |

---

## 2. Authentication Verification Flow

### 2.1 Real Firebase ID Token Verification
Authentication in Nexus Core is governed by [`nexus-core/src/auth.ts`](file:///c:/Users/Lenovo/Nexus%20ai/nexus-core/src/auth.ts) via `createAuthMiddleware()`:
1. **Extraction:** Extracts token from `Authorization: Bearer <token>`.
2. **Cryptographic Verification:** Calls `admin.auth().verifyIdToken(token, true)` (checkRevoked = true).
3. **Rejection Matrix:**
   - Missing Header: `401 Unauthorized` (`Missing or invalid Authorization header`).
   - Forged / Corrupted Token: `401 Unauthorized` (`Invalid or forged token signature`).
   - Expired Token: `401 Unauthorized` (`Firebase ID token has expired`).
   - Revoked Token: `401 Unauthorized` (`Firebase ID token has been revoked`).
4. **RFC 9728 Compliance:** Unauthenticated requests receive `WWW-Authenticate: Bearer error="invalid_token", error_description="..."` pointing to discovery endpoints.
5. **No Production Bypass:** `DEV_AUTH_BYPASS` is rejected if `NODE_ENV === 'production'` or `DEV_AUTH_BYPASS === 'false'`.

### 2.2 Live Cloud vs. Automated Test Separation
- **Automated Tests:** In unit and integration test suites, token verification is tested using custom verifier hooks (`setCustomTokenVerifier`) to test all cryptographic edge cases (expired, revoked, malformed, forged, valid A, valid B) deterministically without hitting external Google network endpoints.
- **Live Cloud Token Test Status:** **BLOCKED**. A live end-to-end token test against Google Cloud Identity Platform requires an interactive user login session (email/password or OAuth popup) from a client application to mint a real Google-signed JWT.

---

## 3. Truthful External Integration Matrix

| Component | Status | Configured | Connected | Runtime / Dependency Prerequisite | Safe Verification Procedure |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **OpenClaw** | **NOT IMPLEMENTED** (Source Only) | No | No | Node.js `>=24.16.0` (Host has v22.14.0). Requires `npm install`, TypeScript build to generate `dist/entry.js`. No connector in `nexus-core`. | Run test script inside `backend/openclaw-main` after upgrading Node runtime. |
| **Hermes** | **NOT IMPLEMENTED** (Source Only) | No | No | Python 3.10+ virtual environment. Missing `ruamel` dependency. Bootstrap expects Node v26. No adapter in `nexus-core`. | Execute standalone Python test agent in isolated `.venv`. |
| **Supermemory** | **NOT IMPLEMENTED** (Source Only) | No | No | Cloudflare Workers runtime, Supermemory API key. Repositories `supermemory-main` and `supermemory-mcp-master` are unconfigured. Nexus Core uses Firestore `/user_preferences`. | HTTP GET probe against local Cloudflare dev worker or Supermemory API endpoint. |
| **Google Calendar** | **SAMPLE ADAPTER** | Demo Only | No (Live API) | Google Workspace OAuth 2.0 Client ID, user consent flow, `calendar.events.readonly` scope. Currently uses `sample_calendar_adapter`. | Authenticated probe to `calendar.googleapis.com/calendar/v3/users/me/calendarList`. |
| **Gmail** | **SAMPLE ADAPTER** | Demo Only | No (Live API) | Google Workspace OAuth 2.0 Client ID, user consent flow, `gmail.readonly` scope. Currently uses `sample_gmail_adapter`. | Authenticated probe to `gmail.googleapis.com/gmail/v1/users/me/threads`. |
| **Google Tasks** | **PERSISTED (FIRESTORE)** | Internal | No (Live API) | Google Tasks OAuth 2.0 scope (`tasks`). Tasks are currently persisted durably in Firestore `/tasks` collection, but not synced to Google Tasks API. | Authenticated probe to `tasks.googleapis.com/tasks/v1/lists/@default/tasks`. |
| **Gemini Chat & Voice** | **MOCK / BROWSER-BASED** | Partial | Partial | `GEMINI_API_KEY` validated as boolean in `/api/health`. Voice is handled in `nexus-web` via browser Web Speech API. No Gemini SDK in backend. | Standalone script calling Gemini API `models.generateContent` with key. |

---

## 4. Test Execution & Build Verification

### 4.1 Automated Test Suite (`npm test`)
Ran Vitest test suite on host (PowerShell, Node v22.14.0):
```
> nexus-core@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/Lenovo/Nexus ai/nexus-core

 ✓ test/firestore.test.ts (15 tests) 40ms
 ✓ test/server.test.ts (29 tests) 714ms
 ✓ test/verification.test.ts (24 tests) 847ms

 Test Files  3 passed (3)
      Tests  68 passed (68)
   Duration  5.80s
```
**Exit Code:** `0` (Success)

### 4.2 TypeScript Build (`npm run build`)
```
> nexus-core@1.0.0 build
> tsc
```
**Exit Code:** `0` (Success, no type diagnostics or emit errors)

---

## 5. Frontend & Backend MCP Connection Contract

When connecting the Google AI Studio frontend or other clients to Nexus Core, use the following contract:

### 5.1 Protocol & Base Endpoints
- **Base URL:** `http://127.0.0.1:8080` (or `process.env.PORT`)
- **Protocol:** Streamable HTTP MCP (Model Context Protocol) & REST JSON
- **CORS Allowed Origins:** `http://localhost:5173`, `http://localhost:3000`, `http://127.0.0.1:5173`, `http://127.0.0.1:3000`, plus any origin in `ALLOWED_ORIGINS`.

### 5.2 Mandatory Authentication Headers
All protected routes (`/mcp`, `/api/context`, `/api/tasks`, `/api/cart/*`, `/api/workflow/*`) require:
```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

### 5.3 MCP Lifecycle Protocol
1. **Initialize Session:**
   ```http
   POST /mcp HTTP/1.1
   Authorization: Bearer <FIREBASE_ID_TOKEN>
   Content-Type: application/json
   Accept: application/json, text/event-stream

   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "initialize",
     "params": {
       "protocolVersion": "2024-11-05",
       "capabilities": { "tools": {} },
       "clientInfo": { "name": "GoogleAIStudioFrontend", "version": "1.0.0" }
     }
   }
   ```
   **Response Headers:**
   `mcp-session-id: <SESSION_UUID>`
   `mcp-protocol-version: 2024-11-05`

2. **List Tools:**
   ```http
   POST /mcp HTTP/1.1
   Authorization: Bearer <FIREBASE_ID_TOKEN>
   Mcp-Session-Id: <SESSION_UUID>
   Content-Type: application/json

   {
     "jsonrpc": "2.0",
     "id": 2,
     "method": "tools/list",
     "params": {}
   }
   ```

3. **Call Tool:**
   ```http
   POST /mcp HTTP/1.1
   Authorization: Bearer <FIREBASE_ID_TOKEN>
   Mcp-Session-Id: <SESSION_UUID>
   Content-Type: application/json

   {
     "jsonrpc": "2.0",
     "id": 3,
     "method": "tools/call",
     "params": {
       "name": "nexus_get_context",
       "arguments": { "query": "coffee" }
     }
   }
   ```

4. **Terminate Session:**
   ```http
   DELETE /mcp HTTP/1.1
   Authorization: Bearer <FIREBASE_ID_TOKEN>
   Mcp-Session-Id: <SESSION_UUID>
   ```

### 5.4 REST Companion Endpoints
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | No | Basic process liveness probe. |
| `GET` | `/api/health` | No | Handoff readiness probe (`hasGeminiApiKey`, `mcpBackendStatus`). |
| `GET` | `/api/nexus/status` | No | Catalog of available MCP tools. |
| `GET` | `/.well-known/oauth-protected-resource/mcp` | No | RFC 9728 Protected Resource Metadata. |
| `GET` | `/api/context` | **Yes** | Returns authenticated user profile and preference context. |
| `GET` | `/api/schedule` | **Yes** | Returns schedule events (`source: sample_calendar_adapter`). |
| `GET` | `/api/tasks` | **Yes** | Lists tasks belonging to the authenticated user. |
| `POST` | `/api/tasks` | **Yes** | Creates a task for the authenticated user. |
| `GET` | `/api/tasks/:id` | **Yes** | Retrieves a task by ID (guarded to owner). |
| `PATCH` | `/api/tasks/:id` | **Yes** | Updates a task by ID (guarded to owner). |
| `DELETE` | `/api/tasks/:id` | **Yes** | Deletes a task by ID (guarded to owner). |
| `GET` | `/api/cart/:stageId` | **Yes** | Retrieves staged commerce cart details. |
| `POST` | `/api/cart/confirm` | **Yes** | Submits `APPROVE` or `REJECT` decision for staged cart. |
| `POST` | `/api/nexus/mcp-relay` | **Yes** | SSRF-safe loopback proxy to MCP endpoints. |

---

## 6. Required Environment Variables

All secrets must be provided via environment variables or secret management. No hardcoded credentials exist in source.

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional | `8080` | Port for Express & MCP HTTP server. |
| `HOST` | Optional | `0.0.0.0` | Binding host address. |
| `NODE_ENV` | Yes | `development` / `production` | When `production`, enforces strict token check & Firestore. |
| `STORAGE_MODE` | Yes | `firestore` (or `memory` for tests) | Storage adapter backend. |
| `FIREBASE_PROJECT_ID` | Yes (Firestore) | `gen-lang-client-0651785302` | Google Cloud / Firebase project ID. |
| `FIRESTORE_DATABASE_ID` | Yes (Firestore) | `ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46` | Explicit named Firestore database ID. |
| `ALLOWED_ORIGINS` | Optional | `http://localhost:5173,http://localhost:3000` | Comma-delimited list of allowed CORS web origins. |
| `TRUSTED_RELAY_HOSTS` | Optional | `localhost,127.0.0.1` | Host allowlist for SSRF-safe `/api/nexus/mcp-relay`. |
| `DEV_AUTH_BYPASS` | Development Only | `false` | Must be `false` in production. Rejects if `NODE_ENV===production`. |
| `GEMINI_API_KEY` | Optional | `AIza...` | API key for Gemini models. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional (Production) | Path to service account JSON | Used by Google Cloud SDK / ADC if running outside Cloud Run. |

---

## 7. GO / NO-GO Recommendation

### A. Local Frontend Connection to Nexus Core: **GO** ✅
- **Justification:** Nexus Core is fully stabilized, multi-tenant isolated, authenticated via Firebase ID tokens, and backed by durable named Cloud Firestore persistence. The MCP Streamable HTTP transport and companion REST endpoints adhere strictly to standards and pass all 68 automated regression tests.
- **Next Step:** Connect the Google AI Studio frontend to Nexus Core using the documented MCP and REST connection contract.

### B. Remote Cloud Run Production Deployment: **NO-GO** 🛑 (Blocked)
- **Blocker:** Google Cloud Project billing quota issue on `gen-lang-client-0651785302` must be resolved by the project owner. Cloud Run API rejected deployment until billing quota is updated.

### C. Live External Agent Runtimes & Live Google Workspace: **NO-GO** 🛑 (Phased)
- **OpenClaw & Hermes:** Blocked by runtime mismatch (Node v24 / Python venv) and lack of core adapters. Kept explicitly documented as unbuilt source.
- **Google Workspace (Calendar/Gmail):** Sample adapters are functional for demonstrations; real live Google API synchronization is reserved for Phase 2 OAuth 2.0 integration.
