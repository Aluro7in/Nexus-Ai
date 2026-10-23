# Nexus AI — Phase 7A: Frontend-to-Backend Integration Gap Report

**Document Version:** 1.0.0
**Audit Date:** October 21, 2026
**Auditor:** Antigravity AI Assistant
**Source Specification:** `docs/handoff.md` (internally titled `docs/NEXUS_BACKEND_HANDOFF.md`, v1.0.0)
**Target Backend:** `nexus-core/` (Node.js/TypeScript MCP Server & Orchestrator)
**Target Frontend:** `nexus-web/` (React/Vite Web Simulator)
**Audit Type:** Read-Only Static and Architectural Verification

---

## Executive Summary

This report provides a formal, forensic audit comparing the frontend handoff specification (`docs/handoff.md` / `docs/NEXUS_BACKEND_HANDOFF.md`, generated from a Google AI Studio project) with the actual codebase in `nexus-core/` and `nexus-web/`.

The handoff document describes an advanced ambient web client featuring Google Workspace API integrations (Calendar, Gmail, Tasks, Drive), Firebase Authentication and Firestore persistence, Gemini 3.8 Live & TTS voice services, and a server-side MCP relay proxy (`/api/nexus/mcp-relay`).

**Critical Finding:** A profound architectural and file boundary exists between the handoff specification and the local repository. The actual `nexus-core` backend is a functional in-memory Streamable HTTP MCP server on port 3001 exposing 6 `nexus_*` tools and demo REST routes, while the actual `nexus-web` workspace is a 4-component React/Vite dashboard. The handoff document describes an AI Studio Express proxy server (port 3000), client-side Google OAuth libraries, and Firestore rules that **do not exist in the repository filesystem**. Furthermore, tool naming schemas, protocol versions, ports, and authentication models are completely mismatched.

---

## 1. Actual File and Endpoint Inventory

### 1.1 File Existence and Physical Location Audit

The table below reconciles every source file referenced in `docs/handoff.md` against the real repository files.

| File Path Claimed in Handoff | Actual Workspace Status | Real File Path / Replacement | Findings & Notes |
| :--- | :--- | :--- | :--- |
| `docs/NEXUS_BACKEND_HANDOFF.md` | **Renamed / Divergent Path** | `docs/handoff.md` | Present at `docs/handoff.md` (26.6 KB, 468 lines). Internal header cites `NEXUS_BACKEND_HANDOFF.md`. |
| `server.ts` & `server/api.ts` (port 3000) | **MISSING** | `nexus-core/src/index.ts` (port 3001) | The AI Studio Express proxy server is absent. Backend runs from `nexus-core/src/index.ts`. |
| `src/lib/gemini.ts` | **MISSING** | None | No Gemini SDK calls exist in frontend or backend. |
| `src/lib/workspace.ts` | **MISSING** | None | Client-side Google Workspace API fetch functions are not present. |
| `src/lib/auth.ts` | **MISSING** | None | In-memory token store (`cachedAccessToken`) and Firebase Google Auth popup are missing. |
| `src/lib/firebase.ts` | **MISSING** | None | Firebase Client SDK configuration for project `gen-lang-client-0651785302` is missing. |
| `src/lib/mcpClient.ts` | **Partially Present** | `nexus-web/src/mcp/client.ts` | `nexus-web` has `StreamableHttpMcpClient`, but it connects directly to `/mcp`, not via `/api/nexus/mcp-relay`. |
| `src/lib/liveVoice.ts` | **MISSING** | None | Audio PCM stream capture and Gemini Live WebSocket client are missing. |
| `src/components/GenuineWorkspaceWorkflow.tsx` | **MISSING** | None | The 3-step Calendar → Gmail → Tasks pipeline component is absent. |
| `src/components/VoiceAssistantPanel.tsx` | **Present (Divergent)** | `nexus-web/src/components/VoiceAssistantPanel.tsx` | Present, but uses browser `SpeechRecognition` and `window.speechSynthesis`, not Gemini Live or TTS. |
| `src/components/VoiceOrb.tsx` | **Present as Sub-element** | Inside `VoiceAssistantPanel.tsx` | Visual CSS orb implemented inside `VoiceAssistantPanel.tsx`. |
| `src/components/ConversationsView.tsx` | **MISSING** | None | Conversation history view not implemented. |
| `src/components/views/IntegrationsView.tsx` | **MISSING** | None | View for `/api/nexus/status` tool catalog is absent. |
| `src/components/views/SettingsView.tsx` | **MISSING** | None | Backend URL configuration view is absent. |
| `firestore.rules` | **MISSING** | None | Security rules file is not present anywhere in the repo. |
| `nexus-core/src/index.ts` | **Present & Verified** | `nexus-core/src/index.ts` | MCP server, PRM endpoint, and REST API on port 3001. |
| `nexus-core/src/types.ts` | **Present & Verified** | `nexus-core/src/types.ts` | Domain types for context, schedule, tasks, staged carts, workflows. |
| `nexus-core/src/tools/registry.ts` | **Present & Verified** | `nexus-core/src/tools/registry.ts` | 6 tools registered with Zod schemas (`nexus_*`). |
| `nexus-core/src/orchestrator/workflow.ts` | **Present & Verified** | `nexus-core/src/orchestrator/workflow.ts` | 4-step sequential demo orchestrator. |
| `nexus-core/src/store/persistence.ts` | **Present & Verified** | `nexus-core/src/store/persistence.ts` | In-memory storage adapter (`LocalMemoryStorageAdapter`). |
| `nexus-core/test/server.test.ts` | **Present & Verified** | `nexus-core/test/server.test.ts` | 9 Vitest integration tests. |

---

### 1.2 Endpoint Inventory: Claimed vs. Actual

| Route | Claimed in Handoff | Actual Backend (`nexus-core`) | Status | Divergence / Impact |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/health` | System readiness, Gemini key presence, MCP standby (`port 3000`) | **NOT IMPLEMENTED** (`nexus-core` exposes `GET /health` on `port 3001`) | **Incompatible** | Path and payload mismatch. Handoff expects `{ status: "ok", hasGeminiApiKey: true, ... }`, core returns `{ status: "UP", uptimeSeconds: ... }`. |
| `POST /api/gemini/chat` | Turn-based Gemini 3.8 Flash natural language endpoint | **NOT IMPLEMENTED** | **Missing** | No Gemini conversational endpoint exists on `nexus-core`. |
| `POST /api/gemini/tts` | Gemini 3.8 Flash Lite text-to-speech endpoint | **NOT IMPLEMENTED** | **Missing** | No voice synthesis endpoint exists on `nexus-core`. |
| `GET /api/nexus/status` | Protocol capability and tool catalog advertisement | **NOT IMPLEMENTED** (`nexus-core` exposes `GET /`) | **Incompatible** | Frontend views relying on `/api/nexus/status` will receive 404. |
| `GET /api/gemini/voice-config` | Real-time audio configuration parameters | **NOT IMPLEMENTED** | **Missing** | No configuration provider for Gemini Live. |
| `POST /api/gemini/session-token` | Ephemeral WebSocket session token generator | **NOT IMPLEMENTED** | **Missing** | No token issuer for Gemini Live sessions. |
| `POST /api/nexus/mcp-relay` | Server-side JSON-RPC forwarder to backend target URL | **NOT IMPLEMENTED** | **Missing** | Relay route does not exist. Frontend must connect directly to `/mcp`. |
| `POST /mcp` | MCP Streamable HTTP endpoint (`port 8080`) | **IMPLEMENTED** on `http://127.0.0.1:3001/mcp` | **Active (Port Divergence)** | Server runs on 3001, not 8080. Accepts JSON-RPC 2.0 with proper `Accept` header. |
| `GET /mcp` | MCP Streamable HTTP session stream | **IMPLEMENTED** on `http://127.0.0.1:3001/mcp` | **Active** | Returns SSE stream or transport handling. |
| `GET /.well-known/oauth-protected-resource/mcp` | RFC 9728 Protected Resource Metadata (PRM) | **IMPLEMENTED** on `http://127.0.0.1:3001` | **Active** | Advertises `alexa::mcp:read` and `alexa::mcp:write`. |
| `POST /api/workflow/run` | Not mentioned in handoff | **IMPLEMENTED** | **Active (Backend-Only)** | Runs the 4-step sequential orchestrator. |
| `GET /api/workflow/status` | Not mentioned in handoff | **IMPLEMENTED** | **Active (Backend-Only)** | Retrieves status of specific or latest workflow. |
| `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id` | Handled via Firestore or Google Tasks | **IMPLEMENTED** (in-memory) | **Active (Backend-Only)** | Direct REST CRUD for demo tasks in `persistence.ts`. |
| `GET /api/schedule` | Handled via Google Calendar API | **IMPLEMENTED** (sample adapter) | **Active (Backend-Only)** | Returns mock calendar events. |
| `GET /api/cart/:stageId`, `POST /api/cart/confirm` | Handled via `commerce.cart.*` | **IMPLEMENTED** | **Active (Backend-Only)** | Backs the two-phase approval gate. |
| `POST /api/reset` | Not mentioned in handoff | **IMPLEMENTED** | **Active (Backend-Only)** | Resets in-memory storage to clean baseline. |

---

## 2. Frontend-to-Backend Capability Mapping

| Capability | Implementation Status | Real Backend Tool or API | Real Frontend Component | Argument / Schema Comparison | Auth & Error Handling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MCP initialization & tool discovery** | **Partially Implemented** | `nexus-core` on `/mcp` (`StreamableHTTPServerTransport`) | `nexus-web/src/mcp/client.ts` (`StreamableHttpMcpClient`) | **Mismatched:** Handoff expects MCP version `2025-11-25` and tool names `workspace.*`. Backend implements version `2024-11-05` and `nexus_*` tools. | Direct HTTP over `/mcp`. `App.tsx` does not currently invoke `mcpClient` (uses REST `/api/workflow/run`). |
| **Task creation, retrieval & updating** | **Implemented (In-Memory)** | Tool: `nexus_create_task`<br>REST: `/api/tasks` | `SmartDisplayHub.tsx`, `App.tsx` | **Mismatched:** Handoff specifies `workspace.tasks.create` with `{ title, notes }`. Core tool requires `{ title, description?, dueDate?, priority? }`. | Open access (no auth checks). Failures return `{ success: false, error: string }`. |
| **Workflow execution & progress tracking** | **Implemented (Hardcoded Orchestrator)** | REST: `/api/workflow/run`<br>Tool: `nexus_get_workflow_status` | `ExecutionTimeline.tsx`, `App.tsx` | Core runs fixed 4-step sequence (context → schedule → task → cart). Handoff claims dynamic Gemini routing. | Operations logged with step, tool, status, timestamp, and isolated failure. |
| **Calendar and Gmail retrieval** | **Demo-Only (Calendar) / Missing (Gmail)** | Tool: `nexus_get_schedule`<br>REST: `/api/schedule` | `SmartDisplayHub.tsx` (Calendar cards) | `nexus_get_schedule` takes `{ targetDate?: string, includeBuffer?: boolean }`. Handoff expects `workspace.calendar.list_events({ timeMin })` and `workspace.gmail.summarize_threads({ query })`. | Backend returns static sample events (`sample_calendar_adapter`). Gmail has no backend handler or tool whatsoever. |
| **Google Tasks creation following approval** | **Demo-Only (Internal Memory)** | Tool: `nexus_create_task` | `SmartDisplayHub.tsx` | Handoff claimed direct client call to `tasks.googleapis.com` via `createGoogleTask(accessToken, title, notes)`. Core creates in-memory task in `LocalMemoryStorageAdapter`. | No Google OAuth token ingestion in backend. Zero sync to external Google Tasks API. |
| **User preferences and context retrieval** | **Implemented (In-Memory)** | Tool: `nexus_get_context`<br>Storage: `persistence.getContextProfile()` | Used internally by orchestrator | Core takes `{ query?: string }` and returns profile for Alex Rivera. Handoff expects Firestore document `/user_preferences/{userId}`. | Hardcoded default profile in `persistence.ts`. No user isolation. |
| **Cart staging and approval state** | **Implemented (In-Memory)** | Tools: `nexus_stage_cart`, `nexus_confirm_action`<br>REST: `/api/cart/:stageId`, `/api/cart/confirm` | `SmartDisplayHub.tsx` (Approval card & buttons) | Core `nexus_stage_cart` requires `{ items: Array<{ title, quantity, unitPrice, category? }> }`. Handoff expects `commerce.cart.prepare_checkout({ items })`. | Two-phase safety gate enforces `PENDING_APPROVAL` until token or stage ID confirmed via `APPROVE` / `REJECT`. |
| **Gemini conversation & voice services** | **Missing (Backend) / Fallback-Only (Frontend)** | None in `nexus-core` | `VoiceAssistantPanel.tsx` | Handoff specifies Gemini 3.8 Flash, Gemini TTS, and Gemini Live (`gemini-3.8-live`). `nexus-web` uses browser `SpeechRecognition` and `speechSynthesis`. | Fallback to Web Speech API works in supported browsers. Zero Gemini SDK or API key verification. |
| **Firebase data & user ownership** | **Missing** | None in `nexus-core` | None in `nexus-web` | Handoff specifies Firestore collections (`/users`, `/tasks`, `/workflows`, `/commerce_orders`). Core uses local JavaScript `Map` structures in `persistence.ts`. | Zero Firebase Auth or Firestore security rule enforcement. Single-tenant in-memory state. |
| **Frontend MCP relay & configurable URL** | **Missing (Relay) / Dev Proxy (Local)** | None | Vite proxy config in `vite.config.ts` | Handoff specifies `/api/nexus/mcp-relay` accepting `{ targetUrl, payload }`. In reality, Vite proxies `/mcp` directly to `127.0.0.1:3001`. | Missing relay route. No dynamic backend URL switcher in UI. |

---

## 3. Missing and Incompatible Schemas

### 3.1 MCP Tool Naming and Schema Conflicts

A complete namespace and schema collision exists between what the frontend handoff document expects and what `nexus-core/src/tools/registry.ts` exposes.

```
Handoff Specification (Expected by UI Contract)       Nexus Core Reality (Registered in registry.ts)
───────────────────────────────────────────────       ──────────────────────────────────────────────
workspace.calendar.list_events                   ≠     nexus_get_schedule
workspace.gmail.summarize_threads                ≠     [DOES NOT EXIST]
workspace.tasks.create                           ≠     nexus_create_task
smarthome.scenes.activate                        ≠     [DOES NOT EXIST]
commerce.cart.prepare_checkout                   ≠     nexus_stage_cart
[Unspecified in handoff]                         ≠     nexus_get_context
[Unspecified in handoff]                         ≠     nexus_get_workflow_status
[Unspecified in handoff]                         ≠     nexus_confirm_action
```

#### Detailed Schema Differences:

1. **Calendar Tool:**
   - *Handoff Schema:* `workspace.calendar.list_events`
     ```json
     { "type": "object", "properties": { "timeMin": { "type": "string" } } }
     ```
   - *Nexus Core Schema:* `nexus_get_schedule`
     ```json
     {
       "targetDate": { "type": "string", "description": "today, tomorrow, or YYYY-MM-DD" },
       "includeBuffer": { "type": "boolean" }
     }
     ```
   - *Impact:* An MCP tool call from a client sending `timeMin` to `workspace.calendar.list_events` fails with `Method/Tool Not Found` (-32601).

2. **Task Creation Tool:**
   - *Handoff Schema:* `workspace.tasks.create`
     ```json
     {
       "type": "object",
       "required": ["title"],
       "properties": {
         "title": { "type": "string" },
         "notes": { "type": "string" }
       }
     }
     ```
   - *Nexus Core Schema:* `nexus_create_task`
     ```json
     {
       "type": "object",
       "required": ["title"],
       "properties": {
         "title": { "type": "string" },
         "description": { "type": "string" },
         "dueDate": { "type": "string" },
         "priority": { "type": "string", "enum": ["LOW", "MEDIUM", "HIGH"] }
       }
     }
     ```
   - *Impact:* Parameter key mismatch (`notes` vs. `description`). Calling `workspace.tasks.create` results in tool lookup failure.

3. **Commerce Cart Staging Tool:**
   - *Handoff Schema:* `commerce.cart.prepare_checkout`
     ```json
     { "type": "object", "required": ["items"], "properties": { "items": { "type": "array" } } }
     ```
   - *Nexus Core Schema:* `nexus_stage_cart`
     ```json
     {
       "type": "object",
       "required": ["items"],
       "properties": {
         "items": {
           "type": "array",
           "items": {
             "id": { "type": "string" },
             "title": { "type": "string" },
             "category": { "type": "string" },
             "quantity": { "type": "integer", "minimum": 1 },
             "unitPrice": { "type": "number", "minimum": 0 }
           }
         }
       }
     }
     ```
   - *Impact:* Incompatible tool name. Schema properties require strictly typed price and quantity fields in `nexus-core`.

4. **Missing Tools in Backend:**
   - `workspace.gmail.summarize_threads`: Absent in `nexus-core`.
   - `smarthome.scenes.activate`: Absent in `nexus-core`. Context contains lighting presets, but no callable tool exists to trigger them.

### 3.2 REST API Response Incompatibilities

1. **Health Probe:**
   - *Handoff Expectation (`GET /api/health`):*
     ```json
     {
       "status": "ok",
       "hasGeminiApiKey": true,
       "mcpBackendStatus": "ready",
       "version": "1.0.0"
     }
     ```
   - *Nexus Core Reality (`GET /health`):*
     ```json
     {
       "status": "UP",
       "timestamp": "2026-10-21T10:00:00.000Z",
       "uptimeSeconds": 42
     }
     ```

2. **Backend Status & Tool Catalog:**
   - *Handoff Expectation (`GET /api/nexus/status`):*
     Returns `{ backendName: "nexus-core", toolsAvailable: [...], note: "..." }`.
   - *Nexus Core Reality:*
     Endpoint does not exist. `GET /` returns server metadata, but with a different schema (`{ name, version, endpoints, tools }`).

---

## 4. Authentication and Authorization Requirements

Connecting the frontend to `nexus-core` requires establishing four strictly separated security domains. The backend currently contains **zero authentication checks** (`cors: origin: '*'`), making all endpoints public.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FOUR DISTINCT AUTHENTICATION DOMAINS                 │
├───────────────────────────────┬────────────────────────────────────────┤
│ 1. Firebase ID Token          │ 2. Google OAuth Access Token           │
│    • Authenticates App User   │    • Authorizes Google Workspace APIs  │
│    • Verified via Admin SDK   │    • Scoped: calendar, gmail, tasks    │
│    • Grants Firestore/DB      │    • Held strictly in-memory           │
├───────────────────────────────┼────────────────────────────────────────┤
│ 3. Gemini API Credentials     │ 4. Nexus MCP Authorization (RFC 9728)  │
│    • Server-side secret       │    • Advertised PRM scopes:            │
│    • Never exposed to client  │      alexa::mcp:read, alexa::mcp:write │
│    • Issues ephemeral tokens  │    • Validated on /mcp requests        │
└───────────────────────────────┴────────────────────────────────────────┘
```

### 4.1 Firebase ID Token & User Identity Verification
- **Current Vulnerability:** `nexus-core` relies on a hardcoded context profile (`userId: 'user_alex_rivera'`). Any client calling `/api/tasks` or `/api/workflow/run` operates within this shared context.
- **Requirement:**
  1. The client must pass `Authorization: Bearer <firebase_id_token>` on all HTTP requests to `nexus-core`.
  2. The backend must verify the token using `firebase-admin` (`admin.auth().verifyIdToken(token)`).
  3. **Never trust client-supplied `userId`:** The backend must extract the verified `auth.uid` from the token and scope all task creation, profile lookups, and workflows to that UID.

### 4.2 Google OAuth Token Handling
- **Separation:** The Firebase ID Token authenticates the user to Nexus, but **does not grant permission to call Google Calendar or Gmail APIs**.
- **Requirement:**
  1. If Google Workspace calls remain client-side (as proposed in `src/lib/workspace.ts`), the browser uses `credential.accessToken` directly against `googleapis.com`.
  2. If `nexus-core` executes Workspace tools autonomously, the client must transmit the Google OAuth access token to the backend in a custom header (e.g., `X-Google-Workspace-Token: Bearer <accessToken>`).
  3. The backend must validate the token against Google's tokeninfo endpoint (`https://oauth2.googleapis.com/tokeninfo?access_token=...`) before using it in tools.

### 4.3 Nexus MCP Relay Security & SSRF Risk Assessment
- **Critical Vulnerability in Handoff Design:**
  Section 1.7 of `docs/handoff.md` proposes `/api/nexus/mcp-relay`:
  ```json
  POST /api/nexus/mcp-relay
  {
    "targetUrl": "http://localhost:8080/mcp",
    "payload": { "jsonrpc": "2.0", ... }
  }
  ```
  Allowing the client to supply an arbitrary `targetUrl` creates a severe **Server-Side Request Forgery (SSRF)** vulnerability. A malicious client could instruct the relay server to send POST payloads to:
  - Cloud metadata services: `http://169.254.169.254/computeMetadata/v1/`
  - Internal network databases and microservices
- **Requirement:**
  1. The backend or proxy relay must **never accept an arbitrary `targetUrl`** in the request body.
  2. The target URL must be configured strictly through a server-side environment variable (`NEXUS_CORE_URL=http://127.0.0.1:3001/mcp`).
  3. If multi-backend targeting is required, the server must validate the target against a strict URL whitelist.

### 4.4 Firestore Security Rules vs. Backend Admin SDK
- **Current Gap:** Firestore rules described in the handoff (lines 302–334) enforce `resource.data.userId == request.auth.uid`.
- **Backend Bypass Risk:** If `nexus-core` uses `firebase-admin` to persist workflows and tasks to Firestore, **the Admin SDK completely bypasses Firestore Security Rules**.
- **Requirement:** `nexus-core` must implement authoritative authorization in its own code before writing to Firestore, ensuring that operations initiated by a user only write documents where `userId == verified_uid`.

---

## 5. MCP Protocol Verification Gaps

### 5.1 Protocol Version Discrepancy
- **Handoff Claim:** Repeatedly mandates Protocol Version `2025-11-25` (lines 12, 21, 211, 368, 379, 397).
- **Reality:** As of late 2024 / 2025, the Model Context Protocol standard supported by the official SDK (`@modelcontextprotocol/sdk@^1.6.1`) is **`2024-11-05`**.
- **Impact:** The version `2025-11-25` appears to be a speculative or hallucinated date string. Sending `2025-11-25` during handshake causes compliant SDK servers to negotiate down to `2024-11-05` or reject the handshake. `nexus-web/src/mcp/client.ts` correctly uses `2024-11-05`.

### 5.2 Transport & Header Requirements
- **Streamable HTTP Transport:** `nexus-core` implements `StreamableHTTPServerTransport` at `/mcp`.
- **Mandatory Headers:**
  - `Content-Type: application/json`
  - `Accept: application/json, text/event-stream` (Requests missing `text/event-stream` are rejected by the SDK transport).
- **Session Tracking:** The server issues an `Mcp-Session-Id` header (UUID) on initialization. Subsequent requests in the session must include this header. `nexus-web/src/mcp/client.ts` implements this tracking, but the handoff relay specification did not document it.

### 5.3 Architectural Disconnect: REST vs. MCP Client in UI
- Although `nexus-web/src/mcp/client.ts` implements a full `StreamableHttpMcpClient`, **the UI does not use it to trigger workflows**.
- In `nexus-web/src/App.tsx`, user messages trigger:
  ```typescript
  fetch('/api/workflow/run', { method: 'POST', body: JSON.stringify({ query: text }) })
  ```
- The frontend acts as a REST client to the orchestrator, rather than executing autonomous MCP tool loops in the browser.

---

## 6. Firebase and Google Integration Dependencies

### 6.1 Package Dependency Inventory

#### `nexus-core/package.json`:
- **Current Dependencies:** `@modelcontextprotocol/sdk@^1.6.1`, `cors@^2.8.5`, `dotenv@^16.4.7`, `express@^4.21.2`, `zod@^3.24.2`.
- **Missing Dependencies for Integration:**
  - `firebase-admin`: Required for verifying Firebase ID tokens and connecting `persistence.ts` to Firestore.
  - `@google/genai` or `@google/generative-ai`: Required if `nexus-core` is to host `/api/gemini/chat`, `/api/gemini/tts`, or `/api/gemini/session-token`.
  - `googleapis`: Required if `nexus-core` executes Google Calendar, Gmail, or Tasks tools directly.

#### `nexus-web/package.json`:
- **Current Dependencies:** `react@^18.3.1`, `react-dom@^18.3.1`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `typescript`, `vite`.
- **Missing Dependencies for Integration:**
  - `firebase`: Required for client-side authentication (`signInWithPopup`, Google Auth Provider).
  - `@google/genai`: Required if Gemini Live streaming is done directly from the browser.

### 6.2 Required Environment Variables

```ini
# nexus-core/.env
PORT=3001
HOST=127.0.0.1
NODE_ENV=development

# Gemini API Integration
GEMINI_API_KEY=<REDACTED_SERVER_SECRET>

# Firebase Admin SDK (Server Identity & Persistence)
FIREBASE_PROJECT_ID=gen-lang-client-0651785302
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@gen-lang-client-0651785302.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIRESTORE_DATABASE_ID=ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46

# Nexus Security
NEXUS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

```ini
# nexus-web/.env
VITE_FIREBASE_API_KEY=<CLIENT_API_KEY>
VITE_FIREBASE_AUTH_DOMAIN=gen-lang-client-0651785302.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gen-lang-client-0651785302
VITE_GOOGLE_CLIENT_ID=528279542257-7qk0r6046cmchlf5isrr8a7nsif77a4u.apps.googleusercontent.com
VITE_NEXUS_CORE_URL=/mcp
```

---

## 7. Minimum Implementation Sequence

To bridge the gap between the frontend contract and `nexus-core` without destabilizing existing functionality, execute the following phased sequence:

```
Phase 1: Tool Aliasing & Schema Normalization (nexus-core)
   │
   ▼
Phase 2: Add Relay & Port Harmonization (resolve 3000/3001/8080)
   │
   ▼
Phase 3: Security & Token Verification Middleware (Firebase ID token)
   │
   ▼
Phase 4: Missing REST Route Shims (/api/health, /api/nexus/status)
   │
   ▼
Phase 5: Persistence Firestore Adapter (swappable for LocalMemory)
   │
   ▼
Phase 6: Gemini Gateway Endpoints (/api/gemini/chat, /tts, /session-token)
   │
   ▼
Phase 7: Google Workspace Connector Integration (Calendar & Tasks)
```

### Detailed Steps:

1. **Step 1: Tool Naming & Schema Aliasing in `nexus-core/src/tools/registry.ts`**
   - Register alias tools matching the handoff contract alongside existing `nexus_*` tools:
     - `workspace.calendar.list_events` → aliases `nexus_get_schedule` (accepting both `timeMin` and `targetDate`).
     - `workspace.tasks.create` → aliases `nexus_create_task` (mapping `notes` to `description`).
     - `commerce.cart.prepare_checkout` → aliases `nexus_stage_cart`.
   - Ensures any client using either naming convention succeeds.

2. **Step 2: Port Harmonization & Secure Proxy Routing**
   - Align ports: `nexus-core` on 3001; Vite frontend dev server on 5173 proxying to 3001.
   - If an Express relay is needed for cloud environments, implement `POST /api/nexus/mcp-relay` in `nexus-core` pointing to a **fixed internal destination** (`http://127.0.0.1:3001/mcp`) to eliminate SSRF.

3. **Step 3: Missing REST Route Compatibility Shims**
   - Implement `GET /api/health` returning `{ status: "ok", hasGeminiApiKey: boolean, mcpBackendStatus: "ready", version: "1.0.0" }`.
   - Implement `GET /api/nexus/status` returning the tool catalog expected by the frontend.

4. **Step 4: Authentication Middleware in `nexus-core`**
   - Install `firebase-admin`.
   - Add an authentication middleware to `/api/*` and `/mcp` verifying `Authorization: Bearer <token>`.
   - Provide a `DEMO_BYPASS_AUTH=true` environment flag for local development and test execution.

5. **Step 5: Firestore Storage Adapter**
   - Implement `FirestoreStorageAdapter` implementing the `StorageAdapter` interface in `nexus-core/src/store/persistence.ts`.
   - Bind to database `ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46` using verified user UID.

6. **Step 6: Gemini Voice & Chat Services**
   - Implement `POST /api/gemini/chat` and `POST /api/gemini/tts` using `@google/genai` on `nexus-core`.
   - Implement `POST /api/gemini/session-token` issuing short-lived ephemeral tokens for direct WebSocket streaming to Gemini Live.

7. **Step 7: Google Workspace Token Passthrough**
   - Add `workspace.gmail.summarize_threads` tool to `registry.ts`.
   - Bind real `googleapis` calls to `workspace.calendar.list_events` and `workspace.tasks.create` using the user's forwarded Google OAuth token.

---

## 8. Exact Tests Required to Confirm Real End-to-End Connection

> [!IMPORTANT]
> This audit is read-only. The tests below are specifications required for validation once implementation begins. None of these tests are claimed to have passed yet.

### Test 1: MCP Streamable HTTP Handshake
- **Objective:** Verify MCP protocol handshake over Streamable HTTP transport.
- **Command:**
  ```bash
  curl -i -X POST http://127.0.0.1:3001/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{
      "jsonrpc": "2.0",
      "id": 1,
      "method": "initialize",
      "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": { "name": "nexus-test-client", "version": "1.0.0" }
      }
    }'
  ```
- **Expected Assertion:**
  - Status code: `200 OK`
  - Response header: `Mcp-Session-Id: <uuid>`
  - Body: JSON-RPC result containing `protocolVersion: "2024-11-05"`, `serverInfo: { name: "nexus-core", version: "1.0.0" }`.

### Test 2: MCP Tool Discovery (`tools/list`)
- **Objective:** Verify that both `nexus_*` and `workspace.*` tools are discovered.
- **Command:**
  ```bash
  curl -i -X POST http://127.0.0.1:3001/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: <SESSION_ID_FROM_TEST_1>" \
    -d '{
      "jsonrpc": "2.0",
      "id": 2,
      "method": "tools/list",
      "params": {}
    }'
  ```
- **Expected Assertion:**
  - Result contains tool array including `nexus_get_schedule`, `workspace.calendar.list_events`, `nexus_create_task`, `workspace.tasks.create`, and `commerce.cart.prepare_checkout`.

### Test 3: Contract-Compliant Tool Invocation (`workspace.tasks.create`)
- **Objective:** Verify task creation using the frontend handoff schema (`title` and `notes`).
- **Command:**
  ```bash
  curl -i -X POST http://127.0.0.1:3001/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: <SESSION_ID_FROM_TEST_1>" \
    -d '{
      "jsonrpc": "2.0",
      "id": 3,
      "method": "tools/call",
      "params": {
        "name": "workspace.tasks.create",
        "arguments": {
          "title": "Review Product Launch Deck",
          "notes": "Verify slides 12 through 15 before morning sync"
        }
      }
    }'
  ```
- **Expected Assertion:**
  - `isError` is false.
  - Content text parses to JSON containing created task ID and status `PENDING`.

### Test 4: Two-Phase Cart Approval State Machine
- **Objective:** Verify cart staging in `PENDING_APPROVAL` and subsequent execution via confirmation token.
- **Command (Stage):**
  ```bash
  curl -i -X POST http://127.0.0.1:3001/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: <SESSION_ID_FROM_TEST_1>" \
    -d '{
      "jsonrpc": "2.0",
      "id": 4,
      "method": "tools/call",
      "params": {
        "name": "commerce.cart.prepare_checkout",
        "arguments": {
          "items": [
            { "title": "Ethiopian Yirgacheffe", "quantity": 1, "unitPrice": 18.50 }
          ]
        }
      }
    }'
  ```
- **Assertion (Stage):** Status is `PENDING_APPROVAL`, `confirmationToken` is generated.
- **Command (Confirm):**
  ```bash
  curl -i -X POST http://127.0.0.1:3001/api/cart/confirm \
    -H "Content-Type: application/json" \
    -d '{
      "tokenOrStageId": "<CONFIRMATION_TOKEN>",
      "decision": "APPROVE"
    }'
  ```
- **Assertion (Confirm):** Cart state updates to `APPROVED`.

### Test 5: Health Check & Status Shims
- **Objective:** Verify that frontend status probes receive valid responses.
- **Command:**
  ```bash
  curl -i http://127.0.0.1:3001/api/health
  curl -i http://127.0.0.1:3001/api/nexus/status
  ```
- **Expected Assertion:** Both return `200 OK` with JSON schemas matching Sections 1.1 and 1.4 of the handoff contract.

### Test 6: SSRF Protection on Relay
- **Objective:** Ensure the relay rejects non-whitelisted target URLs.
- **Command:**
  ```bash
  curl -i -X POST http://127.0.0.1:3001/api/nexus/mcp-relay \
    -H "Content-Type: application/json" \
    -d '{
      "targetUrl": "http://169.254.169.254/latest/meta-data/",
      "payload": { "jsonrpc": "2.0", "id": 1, "method": "initialize" }
    }'
  ```
- **Expected Assertion:** Status code `400 Bad Request` or `403 Forbidden` (`{"error": "Invalid or untrusted target URL"}`).

---

## 9. Single Highest-Priority Integration Fix

The single highest-priority integration fix is:

> **Normalize and Alias the MCP Tool Schemas in `nexus-core/src/tools/registry.ts` to Accept Both `workspace.*` / `commerce.*` and `nexus_*` Namespaces with Tolerant Parameter Mapping.**

### Rationale:
The Model Context Protocol is the primary architectural bridge between the frontend and `nexus-core`. Currently, the frontend handoff contract expects tool names `workspace.calendar.list_events`, `workspace.tasks.create`, and `commerce.cart.prepare_checkout`, while `nexus-core` only registers `nexus_get_schedule`, `nexus_create_task`, and `nexus_stage_cart`.

Furthermore, parameter names conflict (`notes` vs. `description`). Until this alias and mapping layer is registered in `registry.ts`, **every single tool invocation from the contract-compliant frontend will fail immediately with MCP Error `-32601` (Method/Tool Not Found)**, regardless of whether network proxies, authentication, or streaming transports are functioning. Normalizing the tool registry immediately unblocks functional MCP communication without breaking any existing Vitest tests or backend orchestrator logic.
