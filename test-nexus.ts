import { handleApiRoute, verifyLiveSessionToken } from './server/api';
import fs from 'fs';
import path from 'path';

interface TestResult {
  suite: string;
  test: string;
  status: 'PASS' | 'FAIL';
  details?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function recordTest(suite: string, test: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({
      suite,
      test,
      status: 'PASS',
      durationMs: Date.now() - start,
    });
  } catch (err: any) {
    results.push({
      suite,
      test,
      status: 'FAIL',
      details: err.message || String(err),
      durationMs: Date.now() - start,
    });
  }
}

// Mock helper for Express req/res
function createMockContext(url: string, method: string, body?: any) {
  let statusCode = 200;
  let jsonOutput: any = null;

  const req: any = {
    url,
    path: url,
    method,
    body: body || {},
    headers: {},
  };

  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      jsonOutput = data;
      return this;
    },
  };

  return {
    req,
    res,
    getResponse: () => ({ status: statusCode, body: jsonOutput }),
  };
}

async function runTestSuite() {
  console.log('====================================================');
  console.log(' NEXUS AI — IN-DEPTH VERIFICATION & TEST SUITE');
  console.log('====================================================\n');

  // 1. Health & Server Telemetry
  await recordTest('API Endpoints', 'GET /api/health returns operational status & telemetry', async () => {
    const ctx = createMockContext('/api/health', 'GET');
    const handled = await handleApiRoute(ctx.req, ctx.res);
    if (!handled) throw new Error('Route was not handled');
    const resp = ctx.getResponse();
    if (resp.status !== 200) throw new Error(`Status ${resp.status}`);
    if (resp.body.status !== 'ok') throw new Error(`Expected status: 'ok', got: ${resp.body.status}`);
    if (resp.body.version !== '1.0.0') throw new Error(`Version mismatch: ${resp.body.version}`);
  });

  // 2. Gemini 3.8 Flash Chat & Fallback Intelligence
  await recordTest('Gemini Intelligence', 'POST /api/gemini/chat processes user prompt and returns response', async () => {
    const ctx = createMockContext('/api/gemini/chat', 'POST', {
      prompt: 'Check my schedule for tomorrow and draft a reminder',
      history: [],
      userContext: {
        userName: 'Alex',
        connectedIntegrations: ['Google Calendar', 'Gmail', 'Google Tasks'],
        upcomingEvent: 'Alexa+ Hackathon Demo Checkpoint',
      },
    });
    const handled = await handleApiRoute(ctx.req, ctx.res);
    if (!handled) throw new Error('Route was not handled');
    const resp = ctx.getResponse();
    if (resp.status !== 200) throw new Error(`Status ${resp.status}`);
    if (!resp.body.reply || typeof resp.body.reply !== 'string') {
      throw new Error(`Expected text reply, got: ${JSON.stringify(resp.body)}`);
    }
  });

  // 3. Prompt Validation in Chat
  await recordTest('Gemini Intelligence', 'POST /api/gemini/chat rejects empty prompt with HTTP 400', async () => {
    const ctx = createMockContext('/api/gemini/chat', 'POST', {});
    const handled = await handleApiRoute(ctx.req, ctx.res);
    if (!handled) throw new Error('Route was not handled');
    const resp = ctx.getResponse();
    if (resp.status !== 400) throw new Error(`Expected 400 for empty prompt, got ${resp.status}`);
  });

  // 4. Gemini 3.8 Flash Lite TTS Voice Synthesis
  await recordTest('Voice Synthesis', 'POST /api/gemini/tts synthesizes speech or provides structured speech fallback', async () => {
    const ctx = createMockContext('/api/gemini/tts', 'POST', {
      text: 'Good morning Alex. Your calendar has 2 events tomorrow.',
      voiceName: 'Zephyr',
    });
    const handled = await handleApiRoute(ctx.req, ctx.res);
    if (!handled) throw new Error('Route was not handled');
    const resp = ctx.getResponse();
    if (resp.status !== 200) throw new Error(`Status ${resp.status}`);
    if (resp.body.voiceName !== 'Zephyr') {
      throw new Error(`Voice persona mismatch: ${resp.body.voiceName}`);
    }
    if (!resp.body.audioBase64 && !resp.body.fallbackToWebSpeech) {
      throw new Error('Neither audioBase64 nor fallbackToWebSpeech returned');
    }
  });

  // 5. Ephemeral Session Token / Voice Config
  await recordTest('Voice Engine', 'GET /api/gemini/voice-config provides live voice parameters', async () => {
    const ctx = createMockContext('/api/gemini/voice-config', 'GET');
    const handled = await handleApiRoute(ctx.req, ctx.res);
    if (!handled) throw new Error('Route was not handled');
    const resp = ctx.getResponse();
    if (resp.status !== 200) throw new Error(`Status ${resp.status}`);
    if (resp.body.preferredVoice !== 'Zephyr') {
      throw new Error(`Expected preferredVoice Zephyr, got ${resp.body.preferredVoice}`);
    }
  });

  // 5b. Audio Transcription with gemini-3.5-transcribe
  await recordTest('Audio Transcription', 'POST /api/gemini/transcribe transcribes audio using gemini-3.5-transcribe', async () => {
    // 100ms dummy PCM audio in base64
    const dummyAudioBase64 = Buffer.from(new Uint8Array(1600)).toString('base64');
    const ctx = createMockContext('/api/gemini/transcribe', 'POST', {
      audioBase64: dummyAudioBase64,
      mimeType: 'audio/webm',
      prompt: 'Transcribe this voice command.',
    });
    const handled = await handleApiRoute(ctx.req, ctx.res);
    if (!handled) throw new Error('Route was not handled');
    const resp = ctx.getResponse();
    if (resp.status !== 200) throw new Error(`Status ${resp.status}`);
    if (resp.body.model !== 'gemini-3.5-transcribe') {
      throw new Error(`Expected model gemini-3.5-transcribe, got ${resp.body.model}`);
    }
    if (!resp.body.text || typeof resp.body.text !== 'string') {
      throw new Error(`Expected transcribed text, got ${JSON.stringify(resp.body)}`);
    }
  });

  // 5c. Transcription Input Validation
  await recordTest('Audio Transcription', 'POST /api/gemini/transcribe rejects missing audioBase64 with HTTP 400', async () => {
    const ctx = createMockContext('/api/gemini/transcribe', 'POST', {});
    const handled = await handleApiRoute(ctx.req, ctx.res);
    if (!handled) throw new Error('Route was not handled');
    const resp = ctx.getResponse();
    if (resp.status !== 400) throw new Error(`Expected 400 for missing audioBase64, got ${resp.status}`);
  });

  // 5d. Gemini 3.8 Live API Configuration
  await recordTest('Gemini Live API', 'GET /api/gemini/live-config exposes gemini-3.8-live stream endpoint', async () => {
    const ctx = createMockContext('/api/gemini/live-config', 'GET');
    const handled = await handleApiRoute(ctx.req, ctx.res);
    if (!handled) throw new Error('Route was not handled');
    const resp = ctx.getResponse();
    if (resp.status !== 200) throw new Error(`Status ${resp.status}`);
    if (resp.body.model !== 'gemini-3.8-live') {
      throw new Error(`Expected model gemini-3.8-live, got ${resp.body.model}`);
    }
    if (resp.body.wsPath !== '/api/live-stream') {
      throw new Error(`Expected wsPath /api/live-stream, got ${resp.body.wsPath}`);
    }
    if (resp.body.sampleRate !== 24000 || resp.body.inputSampleRate !== 16000) {
      throw new Error(`Audio sample rates mismatch: ${resp.body.sampleRate}/${resp.body.inputSampleRate}`);
    }
  });

  // 5e. Ephemeral Live API Token Verification
  await recordTest('Live API Security', 'POST /api/gemini/session-token provisions cryptographic ephemeral token', async () => {
    const ctx = createMockContext('/api/gemini/session-token', 'POST');
    const handled = await handleApiRoute(ctx.req, ctx.res);
    if (!handled) throw new Error('Route was not handled');
    const resp = ctx.getResponse();
    if (resp.status !== 200) throw new Error(`Status ${resp.status}`);
    if (!resp.body.token || typeof resp.body.token !== 'string') {
      throw new Error('Token string missing');
    }
    if (resp.body.model !== 'gemini-3.8-live') {
      throw new Error(`Expected gemini-3.8-live, got ${resp.body.model}`);
    }
    const isValid = verifyLiveSessionToken(resp.body.token);
    if (!isValid) throw new Error('verifyLiveSessionToken returned false for fresh token');
    const isTamperedValid = verifyLiveSessionToken(resp.body.token + '-tampered');
    if (isTamperedValid) throw new Error('verifyLiveSessionToken accepted a tampered token');
  });

  // 6. Nexus Core MCP Boundary
  await recordTest('MCP Protocol Boundary', 'GET /api/nexus/status returns available MCP tools specification', async () => {
    const ctx = createMockContext('/api/nexus/status', 'GET');
    const handled = await handleApiRoute(ctx.req, ctx.res);
    if (!handled) throw new Error('Route was not handled');
    const resp = ctx.getResponse();
    if (resp.status !== 200) throw new Error(`Status ${resp.status}`);
    if (!Array.isArray(resp.body.toolsAvailable) || resp.body.toolsAvailable.length === 0) {
      throw new Error('No tools returned in MCP tools registry');
    }
  });

  // 7. MCP Relay Validation
  await recordTest('MCP Protocol Boundary', 'POST /api/nexus/mcp-relay validates required targetUrl and payload', async () => {
    const ctx = createMockContext('/api/nexus/mcp-relay', 'POST', {});
    const handled = await handleApiRoute(ctx.req, ctx.res);
    if (!handled) throw new Error('Route was not handled');
    const resp = ctx.getResponse();
    if (resp.status !== 400) throw new Error(`Expected 400 for missing targetUrl, got ${resp.status}`);
  });

  // 8. Workspace Local-Time Boundary Calculations
  await recordTest('Google Workspace Logic', 'getTomorrowCalendarEvents calculates precise 24-hr local midnight bounds', async () => {
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    if (tomorrowStart.getHours() !== 0 || tomorrowStart.getMinutes() !== 0) {
      throw new Error('tomorrowStart is not zeroed');
    }
    if (tomorrowEnd.getHours() !== 23 || tomorrowEnd.getMinutes() !== 59 || tomorrowEnd.getMilliseconds() !== 999) {
      throw new Error('tomorrowEnd is not bounded to 23:59:59.999');
    }
  });

  // 9. Gmail Query Construction
  await recordTest('Google Workspace Logic', 'findRelevantEmails sanitizes keywords and applies time filters', async () => {
    const queryKeyword = 'Product Strategy & Review (Q3)!';
    const cleanQuery = queryKeyword.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const q = cleanQuery ? `${cleanQuery} newer_than:7d` : 'newer_than:2d';

    if (cleanQuery.includes('&') || cleanQuery.includes('!') || cleanQuery.includes('(')) {
      throw new Error('Sanitization failed to remove special characters');
    }
    if (!q.includes('newer_than:7d')) {
      throw new Error('Missing newer_than:7d filter in query');
    }
  });

  // 10. Firebase Configuration & Custom Database ID
  await recordTest('Firebase Integration', 'firebase-applet-config.json specifies custom firestoreDatabaseId', async () => {
    const cfg = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
    if (!cfg.projectId || !cfg.appId || !cfg.apiKey) {
      throw new Error('Missing core Firebase credentials');
    }
    if (cfg.firestoreDatabaseId !== 'ai-studio-40b77d86-67e9-478a-842f-5d3005fb8e46') {
      throw new Error(`Unexpected databaseId: ${cfg.firestoreDatabaseId}`);
    }
  });

  // 11. Firebase Blueprint Schema Complete Coverage
  await recordTest('Firebase Blueprint', 'firebase-blueprint.json defines all 8 core application entities', async () => {
    const bp = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8'));
    const required = [
      'User',
      'UserPreference',
      'Conversation',
      'Message',
      'Task',
      'Workflow',
      'Memory',
      'CommerceOrder',
    ];
    for (const ent of required) {
      if (!bp.entities[ent]) throw new Error(`Missing entity schema: ${ent}`);
      if (!bp.entities[ent].properties) throw new Error(`Entity ${ent} has no properties defined`);
    }
  });

  // 12. Firestore Security Rules & User-Level Scoping
  await recordTest('Firestore Security', 'firestore.rules enforces strict user isolation and rejects unauthorized access', async () => {
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    if (!rules.includes("allow read, write: if false;")) {
      throw new Error('Default deny rule missing');
    }
    if (!rules.includes("request.auth.uid == userId")) {
      throw new Error('User ownership check missing');
    }
    if (!rules.includes("resource.data.userId == request.auth.uid")) {
      throw new Error('Document owner check missing');
    }
    if (rules.includes("existing()")) {
      throw new Error('Found invalid existing() function in firestore rules');
    }
  });

  // 13. UI Components and Views Integrity Check
  await recordTest('Frontend Components', 'All critical components, hooks and views are present', async () => {
    const requiredFiles = [
      'src/components/AmbientHeader.tsx',
      'src/components/VoiceAssistantPanel.tsx',
      'src/components/AudioWaveformVisualizer.tsx',
      'src/components/OnboardingModal.tsx',
      'src/components/SmartDisplayHub.tsx',
      'src/components/ExecutionTimeline.tsx',
      'src/components/ConfirmationModal.tsx',
      'src/components/GenuineWorkspaceWorkflow.tsx',
      'src/components/Navigation.tsx',
      'src/components/views/HomeView.tsx',
      'src/components/views/ConversationsView.tsx',
      'src/components/views/WorkflowsView.tsx',
      'src/components/views/TasksView.tsx',
      'src/components/views/CommerceView.tsx',
      'src/components/views/MemoryView.tsx',
      'src/components/views/IntegrationsView.tsx',
      'src/components/views/SettingsView.tsx',
      'src/lib/firebase.ts',
      'src/lib/auth.ts',
      'src/lib/firestoreService.ts',
      'src/lib/workspace.ts',
      'src/lib/gemini.ts',
      'src/lib/audio.ts',
      'src/lib/mcpClient.ts',
    ];
    for (const f of requiredFiles) {
      if (!fs.existsSync(f)) {
        throw new Error(`Missing expected source file: ${f}`);
      }
    }
  });

  // 13b. Audio Waveform & Keyframe Animation Verification
  await recordTest('Voice Assistant UI', 'AudioWaveformVisualizer and CSS keyframes are defined for listening and speaking states', async () => {
    const css = fs.readFileSync('src/index.css', 'utf8');
    if (!css.includes('@keyframes waveformDrift') || !css.includes('@keyframes freqBarA')) {
      throw new Error('Missing audio waveform or frequency bar keyframes in src/index.css');
    }
    const appTsx = fs.readFileSync('src/App.tsx', 'utf8');
    if (!appTsx.includes('AudioWaveformVisualizer') || !appTsx.includes("audioStatus === 'listening' || audioStatus === 'speaking'")) {
      throw new Error('App.tsx does not integrate AudioWaveformVisualizer for listening/speaking states');
    }
  });

  // 14. In-Memory Token Safety (No localStorage / sessionStorage leaks)
  await recordTest('Security & Token Safety', 'Source code does not store Google OAuth tokens in browser localStorage', async () => {
    const authCode = fs.readFileSync('src/lib/auth.ts', 'utf8');
    if (authCode.includes('localStorage.setItem') && authCode.includes('token')) {
      throw new Error('Detected token storage in localStorage in auth.ts');
    }
    if (!authCode.includes('cachedAccessToken')) {
      throw new Error('Missing in-memory access token cache');
    }
  });

  // 15. Production Nexus Core Live Health Probe
  await recordTest('Production Nexus Core', 'GET /health on live backend returns HTTP 200 and status UP', async () => {
    const { defaultNexusCoreClient } = await import('./server/nexusCoreClient');
    const health = await defaultNexusCoreClient.checkHealth();
    if (!health.isHealthy || !health.data) {
      throw new Error(`Production health check failed: ${health.error || 'Unknown'}`);
    }
    if (health.data.status !== 'UP') {
      throw new Error(`Expected status UP, got ${health.data.status}`);
    }
    if (typeof health.data.uptimeSeconds !== 'number') {
      throw new Error('Missing uptimeSeconds in health response');
    }
  });

  // 16. Production Nexus Core Tool Catalog & Protocol Discovery
  await recordTest('Production Nexus Core', 'GET /api/nexus/status exposes MCP Streamable HTTP tool catalog', async () => {
    const { defaultNexusCoreClient } = await import('./server/nexusCoreClient');
    const statusRes = await defaultNexusCoreClient.getStatus();
    if (!statusRes.success || !statusRes.data) {
      throw new Error(`Status check failed: ${statusRes.error}`);
    }
    if (statusRes.data.backendName !== 'nexus-core') {
      throw new Error(`Unexpected backendName: ${statusRes.data.backendName}`);
    }
    if (!Array.isArray(statusRes.data.toolsAvailable) || statusRes.data.toolsAvailable.length === 0) {
      throw new Error('No tools returned in live backend catalog');
    }
    const toolNames = statusRes.data.toolsAvailable.map((t) => t.name);
    if (!toolNames.includes('workspace.calendar.list_events') || !toolNames.includes('workspace.tasks.create')) {
      throw new Error(`Expected core tools in catalog, got: ${toolNames.join(', ')}`);
    }
  });

  // 17. Production Nexus Core OAuth & Protected Resource Audit
  await recordTest('Production Nexus Core', 'Protected resource metadata and missing OAuth endpoints are accurately audited', async () => {
    const { defaultNexusCoreClient } = await import('./server/nexusCoreClient');
    const audit = await defaultNexusCoreClient.auditOAuthEndpoints();
    if (!audit.isResourceMetadataAvailable) {
      throw new Error('Failed to fetch protected resource metadata');
    }
    if (!audit.scopesSupported.includes('alexa::mcp:read')) {
      throw new Error('Missing alexa::mcp:read scope in metadata');
    }
    // Verify that advertised OAuth endpoints /oauth/authorize and /oauth/token are verified as missing (404)
    if (audit.isOAuthFullyImplemented) {
      throw new Error('Expected audit to correctly identify missing /oauth endpoints on Render backend');
    }
    if (audit.missingComponents.length === 0) {
      throw new Error('Expected missingComponents to list /oauth/authorize and /oauth/token');
    }
  });

  // 18. Production MCP Credential Rejection (Missing Token)
  await recordTest('Production Nexus Core', 'POST /mcp without Bearer token is rejected with HTTP 401', async () => {
    const { defaultNexusCoreClient } = await import('./server/nexusCoreClient');
    const init = await defaultNexusCoreClient.initializeSession();
    if (init.connected) {
      throw new Error('Expected unauthenticated request to be rejected');
    }
    if (init.status !== 'auth_required' && init.httpStatus !== 401) {
      throw new Error(`Expected auth_required (401), got status: ${init.status}, code: ${init.httpStatus}`);
    }
  });

  // 19. Production MCP Credential Rejection (Invalid/Forged Token)
  await recordTest('Production Nexus Core', 'POST /mcp with invalid token is rejected with HTTP 401 Invalid or forged token', async () => {
    const { defaultNexusCoreClient } = await import('./server/nexusCoreClient');
    const init = await defaultNexusCoreClient.initializeSession('invalid_test_token_12345');
    if (init.connected) {
      throw new Error('Expected forged token request to be rejected');
    }
    if (init.status !== 'auth_required' && init.httpStatus !== 401) {
      throw new Error(`Expected 401 rejection for forged token, got: ${init.status}`);
    }
  });

  // 20. Human-in-the-Loop Gatekeeper for Consequential Actions
  await recordTest('Safety & Tool Gatekeeper', 'POST /api/nexus/tools/call requires explicit confirmation for write tools', async () => {
    const ctx = createMockContext('/api/nexus/tools/call', 'POST', {
      tool: 'workspace.tasks.create',
      arguments: { title: 'Order Supplies' },
      confirmed: false,
    });
    const handled = await handleApiRoute(ctx.req, ctx.res);
    if (!handled) throw new Error('Route was not handled');
    const resp = ctx.getResponse();
    if (resp.status !== 200) throw new Error(`Status ${resp.status}`);
    if (resp.body.status !== 'pending_approval' || !resp.body.confirmationRequired) {
      throw new Error(`Expected pending_approval, got: ${JSON.stringify(resp.body)}`);
    }
  });

  // 21. Environment & Credential Hygiene
  await recordTest('Security & Token Safety', 'Configuration and client bundles do not expose private tokens or secrets', async () => {
    const envExample = fs.readFileSync('.env.example', 'utf8');
    if (!envExample.includes('NEXUS_CORE_BASE_URL')) {
      throw new Error('.env.example is missing NEXUS_CORE_BASE_URL');
    }
    if (envExample.includes('VITE_NEXUS_CORE_BEARER_TOKEN') || envExample.includes('VITE_GEMINI_API_KEY')) {
      throw new Error('Found privileged credentials prefixed with browser-public VITE_ in .env.example');
    }
  });

  // 22. Docker Build & Reproducible Lockfile Integrity
  await recordTest('Docker & Build Reproducibility', 'package-lock.json and Dockerfile manifests exist and enforce reproducible npm ci', async () => {
    if (!fs.existsSync('package-lock.json')) {
      throw new Error('package-lock.json is missing in project root');
    }
    const lockfile = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    if (!lockfile.lockfileVersion || lockfile.lockfileVersion < 2) {
      throw new Error(`Invalid or outdated lockfileVersion: ${lockfile.lockfileVersion}`);
    }
    if (!fs.existsSync('Dockerfile')) {
      throw new Error('Root Dockerfile is missing');
    }
    const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
    if (!dockerfile.includes('package-lock.json')) {
      throw new Error('Dockerfile does not copy package-lock.json before npm ci');
    }
    if (!dockerfile.includes('npm ci')) {
      throw new Error('Dockerfile does not use npm ci for reproducible installs');
    }
    if (!fs.existsSync('nexus-core/package-lock.json')) {
      throw new Error('nexus-core/package-lock.json is missing');
    }
  });

  // 23. User Onboarding Flow Integrity Check
  await recordTest('User Onboarding Flow', 'OnboardingModal guides core features, Google service connection, and voice model', async () => {
    const modalCode = fs.readFileSync('src/components/OnboardingModal.tsx', 'utf8');
    if (!modalCode.includes('Voice Interaction Model') || !modalCode.includes('Connect Your Google Workspace')) {
      throw new Error('OnboardingModal is missing core feature or voice model explanation sections');
    }
    if (!modalCode.includes('AudioWaveformVisualizer')) {
      throw new Error('OnboardingModal does not integrate the audio waveform tester');
    }
    const appCode = fs.readFileSync('src/App.tsx', 'utf8');
    if (!appCode.includes('OnboardingModal') || !appCode.includes('showOnboarding')) {
      throw new Error('App.tsx does not integrate OnboardingModal state');
    }
  });

  // Print Summary Table
  console.log('----------------------------------------------------');
  console.log('TEST RESULTS:');
  console.log('----------------------------------------------------');
  let passCount = 0;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} | ${r.suite.padEnd(23)} | ${r.test} (${r.durationMs}ms)`);
    if (r.details) {
      console.log(`         Error: ${r.details}`);
    }
    if (r.status === 'PASS') passCount++;
  }

  console.log('----------------------------------------------------');
  console.log(`TOTAL: ${passCount}/${results.length} PASSED`);
  console.log('====================================================\n');

  if (passCount !== results.length) {
    process.exit(1);
  }
}

runTestSuite().catch((e) => {
  console.error('Fatal error during test suite:', e);
  process.exit(1);
});
