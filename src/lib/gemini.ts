export interface ChatResponse {
  reply: string;
  model: string;
  status: 'success' | 'demo_fallback';
  note?: string;
  error?: string;
}

export interface TTSResponse {
  audioBase64?: string | null;
  mimeType?: string;
  voiceName?: string;
  fallbackToWebSpeech?: boolean;
  status: string;
  error?: string;
}

export async function askGemini(
  prompt: string,
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [],
  userContext: Record<string, any> = {}
): Promise<ChatResponse> {
  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, history, userContext }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Server responded with ${res.status}`);
  }

  return await res.json();
}

export async function synthesizeSpeech(
  text: string,
  voiceName: string = 'Zephyr'
): Promise<TTSResponse> {
  const res = await fetch('/api/gemini/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceName }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    return {
      audioBase64: null,
      fallbackToWebSpeech: true,
      status: 'error_fallback',
      error: errorData.error,
    };
  }

  return await res.json();
}

export async function checkServerHealth(): Promise<{
  status: string;
  hasGeminiApiKey: boolean;
  mcpBackendStatus: string;
}> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch {
    return { status: 'offline', hasGeminiApiKey: false, mcpBackendStatus: 'standby' };
  }
}

export async function getEphemeralLiveToken(): Promise<{
  token: string;
  expiresIn: number;
  model: string;
  status: string;
}> {
  const res = await fetch('/api/gemini/session-token', {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('Failed to retrieve ephemeral voice session token');
  }
  return await res.json();
}

