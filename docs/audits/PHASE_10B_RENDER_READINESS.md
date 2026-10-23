# Nexus AI — Phase 10B: Render Web Service Deployment Readiness Report

**Audit Date:** October 24, 2026
**Auditor:** Antigravity Advanced Agentic AI Engineering
**Repository Scope:** `Aluro7in/FoodMind` (`nexus-core` backend, `nexus-web` frontend)
**Deliverable File:** [`docs/audits/PHASE_10B_RENDER_READINESS.md`](file:///c:/Users/Lenovo/backend/docs/audits/PHASE_10B_RENDER_READINESS.md)
**Deployment Decision:** **GO FOR MANUAL RENDER WEB SERVICE DEPLOYMENT** ✅ (Pending Secret File and Project Owner Manual Action)

---

## 1. Verified Repository Layout & Workspaces

The actual directory layout of the active workspace has been determined via filesystem inspection and `git rev-parse --show-toplevel`:

| Component | Path | Description |
| :--- | :--- | :--- |
| **Workspace Root** | `C:\Users\Lenovo\backend` | Current editor workspace and project container. |
| **Git Repository Root** | `C:/Users/Lenovo/backend` | Single top-level Git tracking root. (`nexus-core` is a child directory, not a separate Git submodule). |
| **Backend Directory** | `C:\Users\Lenovo\backend\nexus-core` | Node.js/TypeScript MCP orchestrator service. Contains `package.json`, `tsconfig.json`, `Dockerfile`, `src/`, `test/`, and `dist/`. |
| **Frontend Directory** | `C:\Users\Lenovo\backend\nexus-web` | Client-side React/Vite single-page application simulator. |
| **Documentation Root** | `C:\Users\Lenovo\backend\docs\audits` | Repository audit archive (`PHASE_9B_VERIFICATION_REPORT.md`, `PHASE_9C_READINESS_REPORT.md`, `PHASE_10B_RENDER_READINESS.md`). |
| **External Agent Sources** | `C:\Users\Lenovo\backend\Tools` | Unbuilt source archives (`openclaw-main`, `hermes-agent-main`, `supermemory-main`). Not part of active production build. |

---

## 2. Baseline vs. Final Test & Build Results

Both verification passes were executed from `c:\Users\Lenovo\backend\nexus-core` using the existing package scripts without altering test assertions.

### 2.1 Baseline Audit (Pre-Changes)
- **`npm test` (`vitest run`):**
  - **Exit Code:** `0`
  - **Passed Tests:** **68 / 68 passed** (3 test files: `firestore.test.ts` [15], `server.test.ts` [29], `verification.test.ts` [24])
  - **Duration:** 38.80s
- **`npm run build` (`tsc`):**
  - **Exit Code:** `0`
  - **Output:** Clean compilation emitted to `dist/` (`dist/index.js`, `dist/auth.js`, etc.)
  - **Runtime Start Script:** `"start": "node dist/index.js"` (Confirmed compiling TypeScript and executing native compiled output, not a development watcher).

### 2.2 Final Verification (Post-Changes)
- **`npm test` (`vitest run`):**
  - **Exit Code:** `0`
  - **Passed Tests:** **72 / 72 passed** (3 test files: `firestore.test.ts` [15], `server.test.ts` [33], `verification.test.ts` [24])
  - **Duration:** 8.07s
  - **Delta:** +4 new tests added in `server.test.ts` verifying explicit production Vercel CORS allowlisting, rejection of arbitrary origins without reflection, strict production origin confinement, and `/health` probe credential privacy.
- **`npm run build` (`tsc`):**
  - **Exit Code:** `0` (Clean compilation, zero TypeScript diagnostics or emit errors).

---

## 3. Files Changed and Technical Rationale

All changes made were surgical and minimal, strictly preserving the existing architecture, token-verification logic, multi-tenant ownership, and MCP Streamable HTTP transport:

### 3.1 [`nexus-core/src/index.ts`](file:///c:/Users/Lenovo/backend/nexus-core/src/index.ts)
1. **Binding Host Configuration:**
   - *Previous:* `const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');`
   - *Changed to:* `const HOST = process.env.HOST || '0.0.0.0';`
   - *Rationale:* Render requires web services to bind to `0.0.0.0`. Defaulting to `0.0.0.0` ensures the server is reachable behind Render's reverse proxy in all environments while continuing to accept local loopback requests (`127.0.0.1`) during development.
2. **Dynamic PORT Binding:**
   - *Existing:* `const PORT = parseInt(process.env.PORT || '3001', 10);`
   - *Verified:* Conforms directly to Render's dynamically assigned `$PORT` without hardcoding port `8080`.
3. **CORS Origin Protection:**
   - *Previous:* Allowed dev origins unconditionally and threw an unhandled Express error when an origin was disallowed.
   - *Changed to:* In `NODE_ENV=production` with `ALLOWED_ORIGINS` specified, strictly confines allowed origins to the configured list. Disallowed origins invoke `callback(null, false)`, correctly preventing `Access-Control-Allow-Origin` headers from being attached without exposing an internal 500 error or reflecting arbitrary client origins.
4. **Global Error Middleware:**
   - Added Express error middleware `app.use((err, req, res, next) => ...)` to catch any unhandled request errors and return sanitized JSON responses (`500 Internal Server Error` or specific HTTP status) without leaking stack traces, auth tokens, or private keys.
5. **Graceful Shutdown Handling:**
   - Attached `SIGTERM` and `SIGINT` process listeners that call `server.close()`, cleanly disconnecting active TCP sockets and allowing Render to orchestrate zero-downtime rolling deploys and restarts.

### 3.2 [`nexus-core/test/server.test.ts`](file:///c:/Users/Lenovo/backend/nexus-core/test/server.test.ts)
- Added `10. Render Deployment & CORS Origin Protection Suite` (4 tests) covering:
  - Allowing configured Vercel production origin (`https://nexus-ai-web.vercel.app`).
  - Blocking arbitrary origins (`https://malicious-attacker.com`) without reflection.
  - Strict production-mode origin confinement (blocking local origins in production when explicit origins are defined).
  - Validating that `/health` exposes zero credential keys, secrets, or internal metadata.

### 3.3 [`render.yaml`](file:///c:/Users/Lenovo/backend/render.yaml)
- Updated Render Blueprint configuration file at the repository root (`C:\Users\Lenovo\backend\render.yaml`) pointing to `rootDir: nexus-core`.
- Configured with `plan: free` for zero-cost demo hosting.
- Omitted unsupported `secretFiles:` block from Blueprint to comply with Render Blueprint specification; Secret Files are configured manually in the Render dashboard.

---

## 4. Render Web Service Deployment Configuration

### 4.1 Deployment Strategy: Native Node.js Web Service (Free Tier)
A native Node.js Web Service on Render is chosen over Docker because:
1. `nexus-core` is a pure Node.js/TypeScript service with zero OS-level or C-binary compile requirements.
2. Native Node.js builds are significantly faster and natively support Render Secret File mounting (`/etc/secrets/...`).
3. The existing `Dockerfile` was authored for Google Cloud Run (hardcoding `ENV PORT=8080` and `EXPOSE 8080`), whereas native Node.js respects Render's dynamic runtime `$PORT` natively.
4. Render's Free tier provides 512 MB RAM and 0.1 CPU, sufficient for lightweight demo orchestration.

### 4.2 Free-Tier Operational Characteristics & Cold-Start Dynamics
Render Free Tier instances operate under specific operational constraints:
- **Inactivity Sleep:** The service automatically spins down after 15 minutes of HTTP inactivity.
- **Cold-Start Latency:** The initial HTTP request after sleeping triggers an automatic instance wake-up, taking approximately 50 to 90 seconds before responding.
- **Session Reset on Sleep:** Because active MCP session IDs reside strictly in process memory, spinning down purges all active session tokens. Clients will receive an HTTP 404 (`-32001: Session not found`) upon waking and must execute an `initialize` handshake to create a fresh session.
- **Single Instance:** The free tier allocates 1 instance, perfectly matching the process-local MCP session architecture and preventing multi-instance routing errors.

### 4.3 Web Service Settings (Render Dashboard / Blueprint)
| Setting Field | Exact Value | Notes |
| :--- | :--- | :--- |
| **Service Type** | `Web Service` | Standard HTTP/HTTPS endpoint. |
| **Runtime / Environment** | `Node` | Node.js 22 LTS runtime. |
| **Plan** | `Free` (`plan: free`) | 512 MB RAM, 0.1 CPU, zero-cost tier. |
| **Root Directory** | `nexus-core` | Points directly to backend folder in the mono-repo. |
| **Build Command** | `npm ci && npm run build` | Installs dependencies cleanly from lockfile and executes `tsc`. |
| **Start Command** | `npm start` | Executes `node dist/index.js` (verified in `nexus-core/package.json`). |
| **Health Check Path** | `/health` | Returns `200 OK` (`{"status":"UP","timestamp":"...","uptimeSeconds":...}`). Exposes no secrets. |
| **Instance Scaling** | `1 Instance` (Single process) | **Mandatory** due to in-memory MCP session tracking (see Section 6). |
| **Auto Deploy** | `No` (Manual Deploy recommended for initial launch) | Allows verifying secret files before first start. |

---

## 5. Google Credentials & Cloud Firestore Status

### 5.1 Real Live Firestore Smoke Test Results
A live Cloud Firestore smoke test was executed against the configured production database using [`nexus-core/scripts/live-cloud-smoke-test.ts`](file:///c:/Users/Lenovo/backend/nexus-core/scripts/live-cloud-smoke-test.ts):

```
================================================================
🚀 Nexus AI — Cloud Firestore Live Smoke Test
================================================================

📌 Target Project ID:   gen-lang-client-0651785302
📌 Target Database ID:  ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46

[1/5] Checking Google Cloud Credentials...
✅ ADC or Service Account Credentials detected successfully.

[2/5] Initializing Google Cloud Firestore client...

[3/5] Performing isolated probe test on dedicated "nexus_health_checks" collection...
   ✅ Successfully wrote probe document: nexus_health_checks/probe_1792784390051_bf05103e
   ✅ Successfully read back probe document. Field values match expected.
   ✅ Successfully deleted temporary probe document. Cleanup confirmed.

[4/5] Testing real task persistence across server restart on live Firestore...
   ✅ Task created: task_1792784394909_2be393 (Owner: smoke_test_user_1792784394527)
   ✅ Task verified directly in Firestore /tasks/task_1792784394909_2be393
   🔄 Simulating backend restart (instantiating new adapter instance)...
   ✅ Recovered task matches all attributes (ID, owner, title, status) across restart.

[5/5] Cleaning up test task...
   ✅ Test task cleaned up successfully.

================================================================
🎉 ALL LIVE CLOUD FIRESTORE SMOKE TESTS PASSED SUCCESSFULLY!
================================================================
```
- **Exit Code:** `0`
- **Verification Verdict:** **VERIFIED LIVE ACTIVE**.
- **Billing Note:** The Cloud Run deployment quota blocker noted in Phase 9C does **NOT** impair Cloud Firestore API operations on the named database `ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46`. Firestore reads, writes, transactions, and deletions execute successfully.

### 5.2 Google Service Account Setup for Render
Render does not run inside Google Cloud and does not inherit workstation ADC. A service account key JSON must be provided via a Render Secret File:

1. **Required Google IAM Roles:**
   - `roles/datastore.user` (Cloud Datastore User — gives read/write access to Firestore).
   - `roles/firebaseauth.admin` or `roles/identityplatform.admin` (Allows Firebase Admin SDK to verify user ID tokens against Google public keys).
   - *Least-privilege principle:* Do **NOT** grant `roles/owner` or `roles/editor`.
2. **Render Secret File Configuration:**
   - In Render Dashboard: Service `nexus-core` ➔ **Environment** ➔ **Secret Files**.
   - **Filename:** `nexus-core-service-account.json`
   - **Mount Path:** `/etc/secrets/nexus-core-service-account.json`
   - **Contents:** Paste the downloaded JSON private key for the service account.
   - Set Environment Variable: `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/nexus-core-service-account.json`.

---

## 6. MCP Session Architecture & Lifecycle Limitations

1. **Storage Topology:**
   - In `nexus-core/src/index.ts`, active sessions are held in a process-local `Map<string, ActiveSession>`:
     ```typescript
     const sessions = new Map<string, ActiveSession>();
     ```
   - Each entry stores the transport object (`StreamableHTTPServerTransport`), `McpServer` instance, user ID, and activity timestamps.
   - MCP session state is **in-process memory only** and is **not** mirrored to external storage or Redis.
2. **Process Restart Impact:**
   - Whenever Render restarts, redeploys, or wakes a sleeping instance, all in-memory sessions are discarded.
   - Subsequent requests containing a previous `Mcp-Session-Id` header return `404 Not Found` with JSON-RPC error:
     ```json
     { "jsonrpc": "2.0", "error": { "code": -32001, "message": "Session not found" }, "id": null }
     ```
   - **Client Behavior Requirement:** Clients (including `nexus-web` and AI Studio) must catch `-32001` or `404` and execute a new `initialize` handshake to establish a fresh session.
3. **Horizontal Scaling Limitation:**
   - Because sessions are process-local, multi-instance deployment (`numInstances > 1`) will cause intermittent session-not-found errors unless sticky sessions or a shared Redis MCP transport adapter are implemented.
   - **Enforced Constraint:** Keep Render service set to **1 instance**.

---

## 7. Frontend Integration Contract: Vercel vs. Google AI Studio

### 7.1 Architecture Clarification
The repository contains `nexus-web` (React/Vite). Prior documentation referenced a Google AI Studio frontend with a server-side proxy `/api/nexus/mcp-relay`. They are distinct targets:

| Characteristic | `nexus-web` (In Repository) | Google AI Studio Frontend (External / Handoff) |
| :--- | :--- | :--- |
| **Location** | `nexus-web/` | External Google AI Studio web application. |
| **Technology** | Pure React + Vite SPA (Client-side). | React + Vite + Node/Express server proxy. |
| **Server Relay** | **No server relay in source.** Directly fetches `/mcp` and `/api/*`. | Contains `/api/nexus/mcp-relay` and Gemini server proxy. |
| **Vercel Routing** | Requires `vercel.json` rewrites or direct `VITE_NEXUS_API_URL`. | Handled by its own Express proxy. |
| **Authentication** | Browser-managed Firebase ID token or dev loopback. | Firebase ID token forwarded in Bearer header. |

### 7.2 Configuration Table

#### Render Backend Variables (`nexus-core`)
| Variable | Value / Format | Secret / Public | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `production` | Public | Enforces production security, disables demo bypass. |
| `HOST` | `0.0.0.0` | Public | Binds HTTP server across all container interfaces. |
| `PORT` | *(Provided by Render runtime)* | System | Render assigns dynamic port (e.g. 10000). |
| `STORAGE_MODE` | `firestore` | Public | Activates durable Cloud Firestore adapter. |
| `FIREBASE_PROJECT_ID` | `gen-lang-client-0651785302` | Public | Google Cloud project ID. |
| `FIRESTORE_DATABASE_ID`| `ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46` | Public | Explicit named Firestore database ID. |
| `GOOGLE_APPLICATION_CREDENTIALS` | `/etc/secrets/nexus-core-service-account.json` | Public | Path to mounted secret file. |
| `ALLOWED_ORIGINS` | `https://<your-app>.vercel.app` | Configurable | Comma-delimited list of allowed Vercel web origins. |
| `DEV_AUTH_BYPASS` | `false` | Public | Prevents unauthenticated access in production. |

#### Render Secret Files (Configured via Dashboard)
Render Blueprints do not allow embedding private key payloads in git-tracked YAML. Secret Files must be created manually in the Render dashboard:

| Setting | Value / Path | Notes |
| :--- | :--- | :--- |
| **Secret File Name** | `nexus-core-service-account.json` | Name of the secret file in Render. |
| **Mount Path** | `/etc/secrets/nexus-core-service-account.json` | Exact file path read by `GOOGLE_APPLICATION_CREDENTIALS`. |
| **Contents** | *(Paste full contents of downloaded Service Account JSON)* | Never commit to Git or print to chat logs. |

#### Vercel Frontend Variables (`nexus-web`)
| Variable | Value / Format | Purpose |
| :--- | :--- | :--- |
| `VITE_NEXUS_API_URL` | `https://<your-render-service>.onrender.com` | Base URL of deployed Render backend. |

*(Note: If deploying `nexus-web` using Vercel rewrites to prevent cross-origin preflight requests, add a `vercel.json` in `nexus-web` routing `/mcp`, `/api/:path*`, and `/health` to `https://<your-render-service>.onrender.com`).*

---

## 8. Deployment Checklist & Final GO / NO-GO Decision

### 8.1 Pre-Flight Deployment Checklist for the User

#### Step 1: Create Google Cloud Service Account Key (Manual GCP Action)
1. Navigate to [Google Cloud Console](https://console.cloud.google.com/) ➔ Project `gen-lang-client-0651785302`.
2. Go to **IAM & Admin** ➔ **Service Accounts** ➔ **Create Service Account**.
3. Name: `nexus-core-render` (e.g. `nexus-core-render@gen-lang-client-0651785302.iam.gserviceaccount.com`).
4. Assign least-privilege roles:
   - `Cloud Datastore User` (`roles/datastore.user`)
   - `Firebase Authentication Admin` (`roles/firebaseauth.admin`)
5. Click **Done**, then click the created account ➔ **Keys** tab ➔ **Add Key** ➔ **Create new key (JSON)**.
6. Download the key JSON to a secure local folder outside Git (do NOT copy into the repository).

#### Step 2: Deploy on Render (Manual Render Action)
1. Log in to [Render.com](https://render.com) and click **New +** ➔ **Web Service** (or connect repo via Blueprint using [`render.yaml`](file:///c:/Users/Lenovo/backend/render.yaml)).
2. Connect your Git repository (`Aluro7in/FoodMind` or equivalent).
3. If setting up manually in the Dashboard:
   - **Name:** `nexus-core`
   - **Region:** Any preferred region (e.g., Oregon or Ohio)
   - **Root Directory:** `nexus-core`
   - **Environment:** `Node`
   - **Plan:** `Free` ($0/mo)
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
4. In the **Environment** tab:
   - Click **Add Environment Variable** for each:
     - `NODE_ENV` = `production`
     - `HOST` = `0.0.0.0`
     - `STORAGE_MODE` = `firestore`
     - `FIREBASE_PROJECT_ID` = `gen-lang-client-0651785302`
     - `FIRESTORE_DATABASE_ID` = `ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46`
     - `GOOGLE_APPLICATION_CREDENTIALS` = `/etc/secrets/nexus-core-service-account.json`
     - `ALLOWED_ORIGINS` = `https://<your-frontend>.vercel.app`
     - `DEV_AUTH_BYPASS` = `false`
5. In the **Secret Files** section (under Environment):
   - Click **Add Secret File**.
   - **Filename / Mount Path:** `/etc/secrets/nexus-core-service-account.json`
   - **Contents:** Open your downloaded JSON key and paste its entire contents.
   - Click **Save**.
6. Click **Deploy Web Service** (or **Manual Deploy ➔ Deploy latest commit**).
7. Once deployed, verify process liveness:
   ```bash
   curl -i https://<your-service-name>.onrender.com/health
   ```
   Expected response:
   ```json
   HTTP/2 200
   {"status":"UP","timestamp":"...","uptimeSeconds":...}
   ```

---

### 8.2 Final Decision: **GO FOR MANUAL RENDER WEB SERVICE DEPLOYMENT** ✅

- **Rationale:**
  1. The backend builds cleanly (`tsc` exit code 0) and passes all **72/72 tests** (`vitest run` exit code 0).
  2. Live Cloud Firestore connectivity to named database `ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46` on project `gen-lang-client-0651785302` is confirmed active and verified through end-to-end write/read/delete/persistence recovery probes.
  3. Server startup binds to `0.0.0.0` and listens on Render's dynamic runtime `$PORT`.
  4. Package script `npm start` launches compiled output `node dist/index.js`.
  5. Authentication enforces strict Firebase ID-token verification with fail-closed behavior in production.
  6. CORS origin controls prevent unauthorized access and forbid arbitrary origin reflection.
  7. The `render.yaml` Blueprint is prepared at the repository root matching the actual monorepo layout, set to `plan: free` with single-instance enforcement.
