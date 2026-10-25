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

export interface TranscribeResponse {
  text: string;
  model: string;
  status: 'success' | 'demo_fallback';
  error?: string;
  note?: string;
}

export async function transcribeAudio(
  audioBlob: Blob,
  prompt: string = 'Transcribe this audio precisely.'
): Promise<TranscribeResponse> {
  const base64Audio = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  const mimeType = audioBlob.type || 'audio/webm';
  const res = await fetch('/api/gemini/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64: base64Audio, mimeType, prompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Transcription failed with HTTP ${res.status}`);
  }

  return await res.json();
}

export async function getLiveConfig(): Promise<{
  model: string;
  wsPath: string;
  status: string;
  sampleRate: number;
  inputSampleRate: number;
  hasGeminiApiKey: boolean;
}> {
  const res = await fetch('/api/gemini/live-config');
  if (!res.ok) throw new Error('Failed to load Live API config');
  return await res.json();
}

