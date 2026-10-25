import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

interface LiveClientMessage {
  type?: 'audio' | 'text' | 'init';
  audio?: string; // base64 PCM 16kHz
  text?: string;
  voiceName?: string;
}

export function setupGeminiLiveWebSocket(wss: WebSocketServer, ai: GoogleGenAI | null, apiKey?: string) {
  wss.on('connection', async (clientWs: WebSocket, req: IncomingMessage) => {
    console.log('[Gemini Live] Client connected to /api/live-stream');

    clientWs.send(
      JSON.stringify({
        type: 'session_init',
        status: 'connecting',
        model: 'gemini-3.8-live',
        sampleRate: 24000,
      })
    );

    let liveSession: any = null;
    let isClosed = false;

    // Helper to send JSON safely to client
    const sendToClient = (msg: Record<string, any>) => {
      if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(msg));
      }
    };

    if (ai) {
      try {
        liveSession = await ai.live.connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction:
              'You are Nexus AI, an ambient operating system for the Alexa+ ecosystem. Respond concisely, intelligently, and warmly in conversational English.',
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              const parts = message.serverContent?.modelTurn?.parts || [];
              for (const part of parts) {
                if (part.inlineData?.data) {
                  sendToClient({
                    type: 'audio',
                    audio: part.inlineData.data,
                    mimeType: 'audio/pcm;rate=24000',
                  });
                }
                if (part.text) {
                  sendToClient({
                    type: 'text',
                    text: part.text,
                  });
                }
              }

              if (message.serverContent?.interrupted) {
                sendToClient({
                  type: 'interrupted',
                  interrupted: true,
                });
              }

              if (message.serverContent?.turnComplete) {
                sendToClient({
                  type: 'turn_complete',
                  turnComplete: true,
                });
              }
            },
            onclose: () => {
              sendToClient({ type: 'session_closed', model: 'gemini-3.8-live' });
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.close();
              }
            },
            onerror: (err: any) => {
              console.warn('[Gemini Live] Session error:', err?.message || err);
              sendToClient({
                type: 'error',
                message: err?.message || 'Live API session warning',
              });
            },
          },
        });

        sendToClient({
          type: 'session_ready',
          status: 'connected',
          model: 'gemini-3.8-live',
        });
      } catch (connErr: any) {
        console.warn('[Gemini Live] Live connection error, activating ambient fallback:', connErr?.message || connErr);
        sendToClient({
          type: 'session_ready',
          status: 'ready_fallback',
          model: 'gemini-3.8-live',
          notice: 'Live API standing by in ambient resilient mode.',
          error: connErr?.message,
        });
      }
    } else {
      sendToClient({
        type: 'session_ready',
        status: 'ready_demo',
        model: 'gemini-3.8-live',
        notice: 'Live API initialized with demo voice adapter.',
      });
    }

    clientWs.on('message', async (data: Buffer | string) => {
      try {
        const payload = JSON.parse(data.toString()) as LiveClientMessage;

        // 1. Audio stream from client mic (16kHz PCM)
        if (payload.audio) {
          if (liveSession && typeof liveSession.sendRealtimeInput === 'function') {
            liveSession.sendRealtimeInput({
              audio: { data: payload.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          } else {
            // Echo back speech recognition heartbeat in fallback mode
            sendToClient({
              type: 'audio_ack',
              receivedBytes: payload.audio.length,
            });
          }
        }

        // 2. Direct text / speech barge-in command
        if (payload.text) {
          if (liveSession && typeof liveSession.sendRealtimeInput === 'function') {
            liveSession.sendRealtimeInput({
              text: payload.text,
            });
          } else {
            // In resilient mode, synthesize reply
            setTimeout(() => {
              sendToClient({
                type: 'text',
                text: `Nexus Live heard: "${payload.text}". Orchestrating ambient workflow.`,
              });
              sendToClient({
                type: 'turn_complete',
                turnComplete: true,
              });
            }, 300);
          }
        }
      } catch (err: any) {
        console.error('[Gemini Live] Error parsing client message:', err);
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      if (liveSession && typeof liveSession.close === 'function') {
        try {
          liveSession.close();
        } catch {}
      }
    });

    clientWs.on('error', (err) => {
      console.warn('[Gemini Live] Client WS socket error:', err);
    });
  });
}
