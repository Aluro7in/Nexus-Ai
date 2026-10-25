/**
 * Client-side manager for Gemini 3.8 Live API real-time bidirectional audio streaming.
 * Handles:
 * - WebSocket connection to /api/live-stream
 * - 16kHz PCM microphone audio capture & streaming
 * - 24kHz PCM audio playback with precise timeline scheduling (gapless playback)
 * - Interruption handling & barge-in
 */

export interface LiveClientCallbacks {
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error') => void;
  onTranscript?: (text: string, isModel: boolean) => void;
  onInterrupted?: () => void;
  onAudioLevel?: (level: number) => void;
  onError?: (error: string) => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private callbacks: LiveClientCallbacks = {};
  private isConnected = false;
  private isSessionActive = false;

  constructor(callbacks: LiveClientCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: LiveClientCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public async connect(): Promise<void> {
    if (this.isConnected || this.ws) {
      return;
    }

    this.callbacks.onStatusChange?.('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/live-stream`;

    return new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(wsUrl);
        this.ws = socket;

        socket.onopen = async () => {
          console.log('[GeminiLiveClient] WebSocket connected');
          this.isConnected = true;
          this.callbacks.onStatusChange?.('connected');
          resolve();
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
          } catch (e) {
            console.warn('[GeminiLiveClient] Non-JSON WS message received:', event.data);
          }
        };

        socket.onerror = (err) => {
          console.error('[GeminiLiveClient] WebSocket error:', err);
          this.callbacks.onError?.('Live stream connection failed');
          this.callbacks.onStatusChange?.('error');
          reject(err);
        };

        socket.onclose = () => {
          console.log('[GeminiLiveClient] WebSocket closed');
          this.cleanup();
          this.callbacks.onStatusChange?.('disconnected');
        };
      } catch (err: any) {
        this.callbacks.onError?.(err.message || 'Unable to initialize Live WebSocket');
        reject(err);
      }
    });
  }

  /**
   * Start microphone capture at 16kHz PCM and stream to Gemini Live API
   */
  public async startMicrophone(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Initialize 16kHz audio context for input capturing
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });

      // Output context for model's 24kHz PCM stream
      if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
        this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      } else if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);

      // Buffer size 4096 = ~256ms of audio at 16kHz
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isSessionActive) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Calculate audio RMS level for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.callbacks.onAudioLevel?.(Math.min(1, rms * 5));

        // Convert Float32 to 16-bit PCM Little Endian
        const base64Pcm = this.floatTo16BitPCMBase64(inputData);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'audio',
              audio: base64Pcm,
            })
          );
        }
      };

      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);

      this.isSessionActive = true;
      this.callbacks.onStatusChange?.('listening');
    } catch (err: any) {
      console.error('[GeminiLiveClient] Microphone initialization error:', err);
      this.callbacks.onError?.(err.message || 'Microphone access denied or unavailable');
      this.callbacks.onStatusChange?.('error');
      throw err;
    }
  }

  /**
   * Stop microphone stream while keeping WebSocket open
   */
  public stopMicrophone() {
    this.isSessionActive = false;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.scriptProcessor && this.sourceNode) {
      try {
        this.sourceNode.disconnect();
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
      this.sourceNode = null;
    }

    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch {}
      this.inputAudioCtx = null;
    }

    this.callbacks.onStatusChange?.(this.isConnected ? 'connected' : 'disconnected');
  }

  /**
   * Send text prompt or interruption command directly
   */
  public sendText(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'text', text }));
      this.callbacks.onTranscript?.(text, false);
    }
  }

  /**
   * Stop currently playing audio on barge-in / interruption
   */
  public interrupt() {
    this.activeSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    this.activeSources = [];
    this.nextStartTime = 0;
    this.callbacks.onInterrupted?.();
    this.callbacks.onStatusChange?.(this.isSessionActive ? 'listening' : 'connected');
  }

  /**
   * Disconnect everything
   */
  public disconnect() {
    this.stopMicrophone();
    this.interrupt();

    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch {}
      this.outputAudioCtx = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.cleanup();
  }

  private cleanup() {
    this.isConnected = false;
    this.isSessionActive = false;
    this.ws = null;
  }

  private handleServerMessage(msg: Record<string, any>) {
    // 1. Audio chunk (24kHz PCM)
    if (msg.type === 'audio' && msg.audio) {
      this.playAudioChunk(msg.audio);
    }

    // 2. Transcript from model
    if (msg.type === 'text' && msg.text) {
      this.callbacks.onTranscript?.(msg.text, true);
    }

    // 3. User barge-in detected
    if (msg.type === 'interrupted' || msg.interrupted) {
      this.interrupt();
    }

    // 4. Turn completion
    if (msg.type === 'turn_complete') {
      if (this.isSessionActive) {
        this.callbacks.onStatusChange?.('listening');
      }
    }

    // 5. Status notification
    if (msg.type === 'session_ready') {
      console.log('[GeminiLiveClient] Session ready:', msg);
    }

    if (msg.type === 'error') {
      this.callbacks.onError?.(msg.message || 'Gemini Live session error');
    }
  }

  /**
   * Schedule 24kHz raw PCM chunk for gapless playback
   */
  private playAudioChunk(base64Audio: string) {
    if (!this.outputAudioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
    }

    if (this.outputAudioCtx.state === 'suspended') {
      this.outputAudioCtx.resume();
    }

    try {
      const pcmBytes = this.base64ToUint8Array(base64Audio);
      const int16 = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength / 2);

      // Convert 16-bit signed PCM to Float32 [-1, 1]
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioCtx.destination);

      // Gapless scheduling
      const currentTime = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.02; // Small 20ms buffer for jitter
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.push(source);
      this.callbacks.onStatusChange?.('speaking');

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
        if (this.activeSources.length === 0) {
          if (this.isSessionActive) {
            this.callbacks.onStatusChange?.('listening');
          } else {
            this.callbacks.onStatusChange?.('connected');
          }
        }
      };
    } catch (err) {
      console.warn('[GeminiLiveClient] Error decoding audio chunk:', err);
    }
  }

  private floatTo16BitPCMBase64(input: Float32Array): string {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const uint8 = new Uint8Array(output.buffer);
    let binary = '';
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    return bytes;
  }
}
