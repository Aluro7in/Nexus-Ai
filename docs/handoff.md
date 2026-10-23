Nexus AI — Frontend-to-Backend Integration Contract & Antigravity nexus-core Handoff Specification
Document Version: 1.0.0
Target Environment: Google AI Studio (Frontend/Proxy) ⟷ Google Antigravity (nexus-core Backend)
Hackathon Target Track: Amazon Developer Hackathon — Alexa+ Ambient OS
Specification Date: October 20, 2026
Status: Frozen & Ready for Backend Connection
Executive Summary & Architecture Boundary
This contract establishes the formal technical boundary between the Nexus AI Frontend (built with React, TypeScript, Tailwind CSS, Vite, and an Express middleware proxy in Google AI Studio) and the nexus-core Backend (developed in Google Antigravity containing the MCP server, tool registry, autonomous orchestrator, and external connectors).
Architectural Invariants:
No Backend Duplication: The frontend does not replace or duplicate the nexus-core orchestrator. The frontend acts as the ambient interface (Voice Orb, Smart Display, Timeline, and Approval Modals).
Explicit Approval Gates (Human-in-the-Loop): Destructive or external state-changing operations (such as creating tasks in Google Tasks, sending emails via Gmail, staging commerce checkouts, or adjusting critical smart-home states) require user confirmation before execution.
Model Context Protocol (MCP) Compliance: All tool discovery and invocation follow the MCP Streamable HTTP Specification (Protocol Version 2025-11-25).
Token & Credential Hygiene: Google OAuth user tokens are strictly managed in-memory on the client and passed via standard Bearer headers. Gemini permanent API keys remain strictly on the server and are never exposed to browser storage.
code
Code
┌────────────────────────────────────────────────────────────────────────┐
│                   NEXUS AI AMBIENT FRONTEND                            │
│  [Ambient Voice Orb]  [Smart Display]  [Workspace Hub]  [Approval UI]   │
└──────────────────┬─────────────────────────────┬───────────────────────┘
                   │                             │
    Client-side OAuth Bearer Tokens              │ JSON-RPC 2.0 (MCP 2025-11-25)
    (Google Calendar, Gmail, Tasks)              │
                   ▼                             ▼
┌──────────────────────────────┐  ┌──────────────────────────────────────┐
│  GOOGLE WORKSPACE APIS       │  │  SERVER PROXY & GEMINI GATEWAY       │
│  • calendar.googleapis.com   │  │  • /api/gemini/chat                  │
│  • gmail.googleapis.com      │  │  • /api/gemini/tts                   │
│  • tasks.googleapis.com      │  │  • /api/gemini/session-token         │
│  • drive.googleapis.com      │  │  • /api/nexus/mcp-relay ─────────┐   │
└──────────────────────────────┘  └──────────────────────────────────┼───┘
                                                                     │
                                  MCP Streamable HTTP (Port 8080)    │
                                  (CORS / Mixed-content safe)        ▼
                                  ┌──────────────────────────────────────┐
                                  │   ANTIGRAVITY `nexus-core` BACKEND   │
                                  │   • Tool Registry & MCP Server       │
                                  │   • Autonomous Orchestrator Engine   │
                                  │   • IoT / Commerce Connectors        │
                                  │   • Persistent Workflow State        │
                                  └──────────────────────────────────────┘
1. Actual HTTP API Contract
All server routes are hosted on the Node.js Express server (server.ts & server/api.ts) listening on port 3000.
1.1 GET /api/health
Purpose: System readiness probe, API key presence check, and MCP backend standby verification.
Responsible Component: src/lib/gemini.ts (checkServerHealth), System Status Header.
Authentication: None (Public health endpoint).
Request Headers: None required.
Request Body: None.
Response Format (application/json):
code
JSON
{
  "status": "ok",
  "hasGeminiApiKey": true,
  "mcpBackendStatus": "ready",
  "version": "1.0.0"
}
Error Responses: 500 Internal Server Error if server crashes.
Environment Variables: GEMINI_API_KEY (optional for health check itself, reflects in boolean).
Implementation Status: Real & Active.
1.2 POST /api/gemini/chat
Purpose: Ambient conversational intelligence, natural language intent analysis, and fallback tool detection.
Responsible Component: src/components/VoiceAssistantPanel.tsx, ConversationsView.tsx, src/lib/gemini.ts (askGemini).
Authentication: Handled by server using GEMINI_API_KEY.
Request Headers: Content-Type: application/json
Request Body Schema:
code
TypeScript
interface ChatRequestBody {
  prompt: string; // Required
  history?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  userContext?: {
    userName?: string;
    connectedIntegrations?: string[];
    activeTaskCount?: number;
    upcomingEvent?: string;
    ambientPreferences?: Record<string, any>;
  };
}
Response Schema (application/json, 200 OK):
code
JSON
{
  "reply": "I've checked your Google Calendar. You have Team Sync at 2:00 PM...",
  "model": "gemini-3.8-flash",
  "status": "success",
  "note": null
}
Fallback / Resilient Response Schema (When Gemini upstream capacity is saturated or key is missing):
code
JSON
{
  "reply": "I understand: '...'. I'm standing by to coordinate your calendar, inbox, workflows, and ambient devices.",
  "model": "ambient-resilient-fallback",
  "status": "demo_fallback",
  "note": "Using ambient intelligent fallback layer."
}
Error Responses:
400 Bad Request: {"error": "Prompt is required"}
500 Internal Server Error: {"error": "<details>"}
Environment Variables: GEMINI_API_KEY (Server-side secret).
Implementation Status: Real (Primary: gemini-3.8-flash via @google/genai SDK; Fallback: Ambient intent router).
1.3 POST /api/gemini/tts
Purpose: Speech synthesis converting assistant textual answers into natural audio.
Responsible Component: src/lib/gemini.ts (synthesizeSpeech), VoiceOrb.tsx.
Authentication: Server-side GEMINI_API_KEY.
Request Headers: Content-Type: application/json
Request Body Schema:
code
TypeScript
interface TTSRequestBody {
  text: string; // Required (sliced to first 300 chars for low-latency voice)
  voiceName?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'; // Default: "Zephyr"
}
Response Schema (application/json, 200 OK — Audio Generation):
code
JSON
{
  "audioBase64": "UklGRi...",
  "mimeType": "audio/wav",
  "voiceName": "Zephyr",
  "status": "success"
}
Fallback Response Schema (When API key is absent or browser client speech fallback is required):
code
JSON
{
  "audioBase64": null,
  "fallbackToWebSpeech": true,
  "voiceName": "Zephyr",
  "text": "...",
  "status": "client_fallback"
}
Error Responses:
400 Bad Request: {"error": "Text is required"}
Environment Variables: GEMINI_API_KEY.
Implementation Status: Real (gemini-3.8-flash-lite-tts with client Web Speech API fallback).
1.4 GET /api/nexus/status
Purpose: Advertises the nexus-core backend protocol capability and available tool catalog to client views.
Responsible Component: src/components/views/IntegrationsView.tsx, SettingsView.tsx.
Authentication: None.
Response Schema (application/json, 200 OK):
code
JSON
{
  "backendName": "nexus-core",
  "protocol": "MCP-Streamable-HTTP",
  "status": "standby",
  "toolsAvailable": [
    { "name": "workspace_calendar_get_events", "category": "productivity", "permissions": "read" },
    { "name": "workspace_gmail_query", "category": "communication", "permissions": "read" },
    { "name": "workspace_drive_search", "category": "knowledge", "permissions": "read" },
    { "name": "workspace_tasks_manage", "category": "productivity", "permissions": "write_guarded" },
    { "name": "smart_home_set_scene", "category": "iot", "permissions": "execute" },
    { "name": "commerce_stage_order", "category": "commerce", "permissions": "approval_required" }
  ],
  "note": "Nexus Core MCP server connection ready. Adapter active."
}
Implementation Status: Real Protocol Handshake Contract.
1.5 GET /api/gemini/voice-config
Purpose: Supplies client with default real-time audio configuration parameters.
Responsible Component: src/lib/liveVoice.ts.
Response Schema (application/json, 200 OK):
code
JSON
{
  "model": "gemini-3.8-live",
  "preferredVoice": "Zephyr",
  "sampleRate": 24000,
  "hasServerAuth": true
}
Implementation Status: Real Configuration Provider.
1.6 POST /api/gemini/session-token
Purpose: Generates constrained, short-lived ephemeral session tokens for direct browser-to-Live-API streaming, eliminating the need to expose long-lived server keys to the browser.
Responsible Component: src/lib/gemini.ts (getEphemeralLiveToken), GeminiLiveVoiceSession.
Authentication: Server-side verification of GEMINI_API_KEY.
Response Schema (application/json, 200 OK):
code
JSON
{
  "token": "bmV4dXMtbGl2ZS0xN...",
  "expiresIn": 300,
  "model": "gemini-3.8-live",
  "status": "authenticated"
}
Error Responses:
503 Service Unavailable: {"error": "Server Gemini API key not configured"}
Implementation Status: Real Ephemeral Token Issuer.
1.7 POST /api/nexus/mcp-relay
Purpose: Server-side HTTP proxy relay dispatching MCP JSON-RPC 2.0 payloads to nexus-core backend URL (e.g. http://localhost:8080/mcp). Resolves browser HTTPS mixed-content blocks and CORS restrictions in preview/cloud-hosted environments.
Responsible Component: src/lib/mcpClient.ts (dispatchJsonRpc).
Request Headers: Content-Type: application/json
Request Body Schema:
code
JSON
{
  "targetUrl": "http://localhost:8080/mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": { ... }
  }
}
Upstream Forwarding Headers:
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2025-11-25
Response Schema (200 / Upstream Status):
code
JSON
{
  "isReachable": true,
  "status": 200,
  "data": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": { ... }
  }
}
Timeout & Error Handling: 3000ms abort controller timeout.
If unreachable: 502 Bad Gateway:
code
JSON
{
  "error": "Unable to reach MCP backend at http://localhost:8080/mcp. Server is currently on standby.",
  "isReachable": false
}
Implementation Status: Real Active Relay Proxy.
2. Google Workspace Integration Contract
All client-side Google Workspace API integrations are encapsulated in src/lib/workspace.ts and executed visually in src/components/GenuineWorkspaceWorkflow.tsx.
2.1 OAuth Token Lifecycle & In-Memory Isolation
Authentication Source: Firebase Authentication signInWithPopup(auth, googleProvider).
Token Extraction: GoogleAuthProvider.credentialFromResult(result)?.accessToken.
Storage Policy: Strictly kept in memory (cachedAccessToken in src/lib/auth.ts). Never written to localStorage, sessionStorage, or IndexedDB.
Token Injection: Injected directly into the HTTP header:
Authorization: Bearer <accessToken>.
code
Code
Firebase signInWithPopup(auth, provider)
               │
               ▼
Extract credential.accessToken
               │
               ▼
Store in-memory (cachedAccessToken) ──(Zero disk persistence)──┐
               │                                               │
               ▼                                               ▼
Passed to workspace functions              No leak to localStorage/cookies
(Authorization: Bearer <token>)
2.2 Configured OAuth Scopes
The active OAuth client (528279542257-7qk0r6046cmchlf5isrr8a7nsif77a4u.apps.googleusercontent.com) contains the following scopes:
https://www.googleapis.com/auth/calendar.events (Read/write primary calendar)
https://www.googleapis.com/auth/calendar.readonly (Read agenda)
https://www.googleapis.com/auth/gmail.readonly (Query inbox and threads)
https://www.googleapis.com/auth/gmail.send (Send outgoing messages)
https://www.googleapis.com/auth/gmail.compose (Draft messages)
https://www.googleapis.com/auth/drive.readonly (Read Drive files)
https://www.googleapis.com/auth/drive.file (Create/access app files)
https://www.googleapis.com/auth/tasks (Read/write Google Tasks)
https://www.googleapis.com/auth/contacts.readonly (Read People connections)
2.3 Workspace Function Signatures & Endpoints
Function	Endpoint Called	Scopes Required	Input Type	Output Type	Live vs Demo Fallback Behavior
getTomorrowCalendarEvents(accessToken)	GET https://www.googleapis.com/calendar/v3/calendars/primary/events	calendar.readonly or calendar.events	accessToken: string	Promise<CalendarEvent[]>	Queries local calendar bounds (00:00:00.000 to 23:59:59.999 tomorrow). If no token, caller uses labeled fallback.
getCalendarEvents(accessToken)	GET https://www.googleapis.com/calendar/v3/calendars/primary/events	calendar.readonly	accessToken: string | null	Promise<CalendarEvent[]>	Fetches next 8 upcoming events. Falls back to 3 demo entries when null.
createCalendarEvent(accessToken, event)	POST https://www.googleapis.com/calendar/v3/calendars/primary/events	calendar.events	{ summary, description?, startTime, endTime }	Promise<any>	Creates event in user's primary calendar. Requires user approval.
findRelevantEmails(accessToken, keyword)	GET https://gmail.googleapis.com/gmail/v1/users/me/messages followed by batch metadata fetch	gmail.readonly	accessToken: string, keyword: string	Promise<GmailMessageSummary[]>	Sanitizes alphanumeric keywords, queries newer_than:7d, parses Subject, From, Date.
getGmailMessages(accessToken)	GET https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=label:INBOX	gmail.readonly	accessToken: string | null	Promise<GmailMessageSummary[]>	Fetches latest 5 inbox headers. Returns 3 labeled demo emails if null.
sendGmailMessage(accessToken, to, subject, body)	POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send	gmail.send	to: string, subject: string, body: string	Promise<any>	RFC 2822 base64url-encoded email payload. Approval gate enforced.
getDriveFiles(accessToken)	GET https://www.googleapis.com/drive/v3/files	drive.readonly	accessToken: string | null	Promise<DriveFileItem[]>	Lists 10 recent files. Returns 3 labeled mock documents if null.
getGoogleTasks(accessToken)	GET https://tasks.googleapis.com/tasks/v1/users/@me/lists/@default/tasks	tasks	accessToken: string | null	Promise<GoogleTaskItem[]>	Lists pending tasks from @default tasklist.
createGoogleTask(accessToken, title, notes?)	POST https://tasks.googleapis.com/tasks/v1/users/@me/lists/@default/tasks	tasks	accessToken: string, title: string, notes?: string	Promise<any>	Genuine Task Creation: Creates live task in Google Tasks. Returns created task ID. Tested & verified against authorized Google account.
getContacts(accessToken)	GET https://people.googleapis.com/v1/people/me/connections	contacts.readonly	accessToken: string | null	Promise<ContactItem[]>	Fetches 10 People connections with names and emails.
2.4 Priority Genuine Workspace Workflow (3-Step Pipeline)
Implemented in src/components/GenuineWorkspaceWorkflow.tsx:
Step 1 (Calendar Extraction): Computes strict local date bounds for tomorrow (Date.setDate(getDate() + 1) with 00:00:00 and 23:59:59.999) and calls getTomorrowCalendarEvents(accessToken).
Step 2 (Gmail Context Gathering): Takes the subject of tomorrow's primary event (e.g., "Product Strategy Review") and calls findRelevantEmails(accessToken, queryKeyword) to retrieve unread threads and briefing notes.
Step 3 (Guarded Task Creation): Stashes the proposed task title ("Prepare briefing for: ...") and context notes. HALTS and opens the onRequestTaskConfirmation modal. The user must click "Confirm & Create Task" before createGoogleTask is invoked. Prevents duplicate task submissions on retry.
3. Firebase Data Contract & Security Invariants
3.1 Project Topology
Firebase Project ID: gen-lang-client-0651785302
Firestore Database ID: ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46 (Bound explicitly in src/lib/firebase.ts)
Web App ID: 1:528279542257:web:bb00aa6c23e244f85c4c50
Authentication Provider: Google Auth Provider (signInWithPopup).
3.2 Collection Schemas & Authority Ownership Matrix
Collection Path	Key Document Fields	User Ownership Field	Browser Write Allowed?	Backend (nexus-core) Authority Role
/users/{userId}	userId, email, displayName, photoURL, createdAt, updatedAt	userId (must equal request.auth.uid)	Yes (on sign-in)	Read-only identity reference
/user_preferences/{userId}	userId, voiceName, ambientTheme, autoSpeak, mcpBackendUrl, updatedAt	userId	Yes (settings toggle)	Read for ambient personalization & voice routing
/conversations/{conversationId}	userId, title, lastMessage, createdAt, updatedAt	userId	Yes	Appends context threads; orchestrator summarizes
/messages/{messageId}	userId, conversationId, role, content, createdAt	userId	Yes	Consumes user prompts; emits model responses
/tasks/{taskId}	userId, title, description, priority, status, dueDate, googleTaskId	userId	Yes (manual tasks)	Bi-directional sync: Orchestrator creates tasks from autonomous workflows
/workflows/{workflowId}	userId, title, status, triggerType, steps[], currentStepIndex	userId	Read / Cancel only	Authoritative Owner: nexus-core creates, advances, and logs step outputs
/memories/{memoryId}	userId, category, key, value, confidence, createdAt	userId	Yes (manual delete)	Authoritative Owner: Autonomous memory extraction from voice/chat
/commerce_orders/{orderId}	userId, title, items[], totalAmount, currency, status, approvalRequired	userId	State approve/cancel only	Authoritative Owner: Staging carts, inventory checks, payment fulfillment
3.3 Security Rules Invariants (firestore.rules)
All documents enforce strict ownership validation deployed directly to ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46:
code
JavaScript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }

    // Direct path ownership
    match /users/{userId} {
      allow get: if isOwner(userId);
      allow list: if false;
      allow create: if isOwner(userId) && request.resource.data.userId == request.auth.uid;
      allow update: if isOwner(userId) && request.resource.data.userId == resource.data.userId;
      allow delete: if isOwner(userId);
    }
    
    // User-scoped collections (tasks, messages, workflows, etc.)
    match /{collectionName}/{docId} {
      allow get, list: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update: if isSignedIn() && resource.data.userId == request.auth.uid && request.resource.data.userId == resource.data.userId;
      allow delete: if isSignedIn() && resource.data.userId == request.auth.uid;
    }
  }
}
4. Gemini Voice Contract
The voice stack is decoupled into two distinct modes to guarantee high availability:
code
Code
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXUS VOICE SUBSYSTEM                           │
├───────────────────────────────────┬────────────────────────────────────┤
│       MODE A: TURN-BASED TTS      │       MODE B: GEMINI LIVE API      │
│  (For Standard Voice Responses)   │ (For Real-Time Bidirectional Voice)│
├───────────────────────────────────┼────────────────────────────────────┤
│ 1. User speaks or types           │ 1. Browser captures 16kHz PCM audio│
│ 2. Text generated via Gemini      │ 2. Obtains short-lived token from  │
│ 3. Audio synthesized via          │    /api/gemini/session-token       │
│    gemini-3.8-flash-lite-tts      │ 3. Direct WebSocket stream to      │
│ 4. Fallback to Web Speech API     │    Gemini Live (gemini-3.8-live)   │
│    if API unavailable             │ 4. Native barge-in / interruption  │
└───────────────────────────────────┴────────────────────────────────────┘
4.1 Mode A: Turn-Based Voice Synthesis (gemini-3.8-flash-lite-tts)
Trigger: Audio response requested after a conversational response is returned.
Payload: Text (max 300 characters) + Prebuilt voice (Zephyr, Puck, Charon, Kore, Fenrir).
Output: Base64-encoded audio/wav rendered via HTML5 Audio element.
Failover: If server synthesis times out or key is missing, client invokes browser window.speechSynthesis.speak(utterance).
4.2 Mode B: Gemini Live Bidirectional Streaming (gemini-3.8-live)
Audio Capture: navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true } }).
Processing: ScriptProcessorNode (4096 buffer size) converting Float32Array audio buffers into 16-bit linear PCM (Int16Array).
Connection Handshake:
Frontend requests ephemeral session token from POST /api/gemini/session-token.
Receives { token, expiresIn: 300, model: "gemini-3.8-live" }.
Prepares WebSocket streaming session with token authorization header.
Interruption (Barge-In) Handling:
GeminiLiveVoiceSession.interrupt() cuts off current audio playback immediately.
Transitions session status to 'interrupted', settles for 400ms, and re-engages 'active' listening.
5. Antigravity nexus-core Handoff Architecture
5.1 Protocol: MCP Streamable HTTP (2025-11-25)
The frontend communicates with nexus-core using the official Streamable HTTP binding.
Session Initialization:
code
JSON
// Client -> Backend (via /api/nexus/mcp-relay)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "roots": { "listChanged": false },
      "sampling": {}
    },
    "clientInfo": {
      "name": "nexus-ambient-os-client",
      "version": "1.0.0"
    }
  }
}
Expected nexus-core Response:
code
JSON
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": {},
      "prompts": {}
    },
    "serverInfo": {
      "name": "nexus-core",
      "version": "0.9.0"
    }
  }
}
5.2 Tool Registration Contract (tools/list)
nexus-core must expose tools categorized by capability:
code
JSON
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
Required Tool Schemas:
workspace.calendar.list_events
inputSchema: {"type": "object", "properties": {"timeMin": {"type": "string"}}}
approvalRequired: false
workspace.gmail.summarize_threads
inputSchema: {"type": "object", "properties": {"query": {"type": "string"}}}
approvalRequired: false
workspace.tasks.create
inputSchema: {"type": "object", "required": ["title"], "properties": {"title": {"type": "string"}, "notes": {"type": "string"}}}
approvalRequired: true (Triggers ConfirmationModal in UI)
smarthome.scenes.activate
inputSchema: {"type": "object", "required": ["sceneId"], "properties": {"sceneId": {"type": "string"}}}
approvalRequired: false
commerce.cart.prepare_checkout
inputSchema: {"type": "object", "required": ["items"], "properties": {"items": {"type": "array"}}}
approvalRequired: true (Triggers visual checkout review before placing order)
5.3 Tool Invocation & Approval Gate (tools/call)
code
JSON
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "workspace.tasks.create",
    "arguments": {
      "title": "Follow up with client",
      "notes": "Review action items from meeting"
    }
  }
}
Status States Returned to UI:
status: "completed": Action executed, UI displays success toast and timeline card.
status: "pending_approval": Action halted at safety gate. The UI shows the exact parameters and requires explicit user tap or voice confirmation.
status: "failed": Human-readable error message rendered in the timeline.
5.4 Backend Connection Readiness Checklist

Express Proxy Relay Active: /api/nexus/mcp-relay ready to forward JSON-RPC payloads to target backend URL without CORS errors.

Configurable Backend URL: Configurable in UI Settings (http://localhost:8080/mcp or tunneled Cloud Run / Antigravity URL).

Standby Demo Adapter Labeled: When nexus-core is offline, all UI views explicitly display "Demo Adapter Active" labels and mock data is clearly indicated.

Firestore Security Rules Deployed: Multi-tenant user isolation enforced on the selected database ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46.

Zero Hardcoded Secrets: No API keys, OAuth client secrets, or private keys in the client bundle.

Automated Test Suite Verified: 14/14 automated system tests passing (npm test).
Artifact Location: docs/NEXUS_BACKEND_HANDOFF.md
Contact / Owner: Nexus AI Principal Architect & Senior Full-Stack Engineer