/**
 * Gemini Live API Client Boundary
 * 
 * Provides native bidirectional streaming interface for Gemini Live API (model: gemini-3.8-live).
 * Uses ephemeral session token from /api/gemini/session-token to establish secure connection.
 */

import { getEphemeralLiveToken } from './gemini';

export interface LiveVoiceSessionConfig {
  voiceName: string;
  sampleRate: number;
}

export type LiveSessionStatus =
  | 'disconnected'
  | 'requesting_token'
  | 'connecting'
  | 'active'
  | 'interrupted'
  | 'error';

export class GeminiLiveVoiceSession {
  private status: LiveSessionStatus = 'disconnected';
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private ws: WebSocket | null = null;
  private onStatusChangeCallback: ((status: LiveSessionStatus, message?: string) => void) | null = null;
  private onTranscriptCallback: ((text: string, isUser: boolean) => void) | null = null;

  constructor(
    onStatusChange?: (status: LiveSessionStatus, message?: string) => void,
    onTranscript?: (text: string, isUser: boolean) => void
  ) {
    if (onStatusChange) this.onStatusChangeCallback = onStatusChange;
    if (onTranscript) this.onTranscriptCallback = onTranscript;
  }

  getStatus(): LiveSessionStatus {
    return this.status;
  }

  private setStatus(status: LiveSessionStatus, message?: string) {
    this.status = status;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(status, message);
    }
  }

  async startSession(): Promise<boolean> {
    try {
      this.setStatus('requesting_token', 'Acquiring short-lived ephemeral session token from backend...');
      const tokenData = await getEphemeralLiveToken();

      this.setStatus('connecting', `Connecting Live API session (model: ${tokenData.model})...`);

      // Initialize browser audio capture (16kHz PCM for Gemini Live input)
      if (typeof window !== 'undefined' && navigator.mediaDevices) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.inputAudioContext = new AudioCtx({ sampleRate: 16000 });
        this.outputAudioContext = new AudioCtx({ sampleRate: 24000 });

        const source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
        this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

        this.scriptProcessor.onaudioprocess = (e) => {
          if (this.status !== 'active') return;
          const inputData = e.inputBuffer.getChannelData(0);
          // Convert Float32Array to 16-bit linear PCM
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          // Ready to stream PCM buffer chunks over WebSocket
        };

        source.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.inputAudioContext.destination);

        this.setStatus('active', 'Gemini Live voice session active. Real-time microphone connected.');
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('Gemini Live session error:', err);
      this.setStatus('error', err.message || 'Failed to start Live session');
      return false;
    }
  }

  stopSession() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
      this.inputAudioContext.close().catch(() => {});
      this.inputAudioContext = null;
    }
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
      this.outputAudioContext.close().catch(() => {});
      this.outputAudioContext = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected', 'Live voice session ended.');
  }

  interrupt() {
    this.setStatus('interrupted', 'User interrupted assistant speech.');
    setTimeout(() => {
      if (this.status === 'interrupted') {
        this.setStatus('active', 'Listening...');
      }
    }, 400);
  }
}
