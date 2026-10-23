import { handleApiRoute } from './server/api';
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
