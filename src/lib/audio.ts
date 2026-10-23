import { synthesizeSpeech } from './gemini';

// Web Speech Recognition Type shim
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export class NexusAudioEngine {
  private recognition: any = null;
  private currentAudio: HTMLAudioElement | null = null;
  private isListening = false;
  private isMuted = false;
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onStatusChangeCallback: ((status: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error') => void) | null = null;

  constructor() {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRec = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (SpeechRec) {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        // If user interrupts by speaking while audio is playing, interrupt audio!
        if ((finalTranscript || interimTranscript) && this.currentAudio && !this.currentAudio.paused) {
          this.interrupt();
        }

        if (this.onTranscriptCallback) {
          if (finalTranscript) {
            this.onTranscriptCallback(finalTranscript.trim(), true);
          } else if (interimTranscript) {
            this.onTranscriptCallback(interimTranscript.trim(), false);
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition event:', event.error);
        if (event.error !== 'no-speech' && this.onStatusChangeCallback) {
          this.onStatusChangeCallback('idle');
        }
      };

      this.recognition.onend = () => {
        if (this.isListening && !this.isMuted) {
          try {
            this.recognition.start();
          } catch {
            // Already started or busy
          }
        } else if (this.onStatusChangeCallback) {
          this.onStatusChangeCallback('idle');
        }
      };
    }
  }

  setCallbacks(
    onTranscript: (text: string, isFinal: boolean) => void,
    onStatusChange: (status: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error') => void
  ) {
    this.onTranscriptCallback = onTranscript;
    this.onStatusChangeCallback = onStatusChange;
  }

  startListening(): boolean {
    if (!this.recognition) {
      console.warn('Speech recognition not supported in this browser.');
      return false;
    }
    this.interrupt();
    this.isListening = true;
    this.isMuted = false;
    try {
      this.recognition.start();
      if (this.onStatusChangeCallback) this.onStatusChangeCallback('listening');
      return true;
    } catch {
      return false;
    }
  }

  stopListening() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignored
      }
    }
    if (this.onStatusChangeCallback) this.onStatusChangeCallback('idle');
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopListening();
    } else {
      this.startListening();
    }
    return this.isMuted;
  }

  interrupt() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.onStatusChangeCallback) this.onStatusChangeCallback('idle');
  }

  async speak(text: string, voiceName: string = 'Zephyr', autoSpeak: boolean = true): Promise<void> {
    if (!autoSpeak || !text) return;

    this.interrupt();
    if (this.onStatusChangeCallback) this.onStatusChangeCallback('speaking');

    try {
      // 1. Try Gemini 3.8 Flash Lite TTS
      const res = await synthesizeSpeech(text, voiceName);

      if (res.audioBase64) {
        const audioUrl = `data:${res.mimeType || 'audio/wav'};base64,${res.audioBase64}`;
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;

        audio.onended = () => {
          this.currentAudio = null;
          if (this.onStatusChangeCallback) this.onStatusChangeCallback(this.isListening ? 'listening' : 'idle');
        };

        audio.onerror = () => {
          this.fallbackWebSpeech(text);
        };

        await audio.play();
        return;
      }
    } catch (e) {
      console.warn('Gemini TTS failed, falling back to Web Speech:', e);
    }

    // 2. Fallback to Web Speech API
    this.fallbackWebSpeech(text);
  }

  private fallbackWebSpeech(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (this.onStatusChangeCallback) this.onStatusChangeCallback('idle');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (this.onStatusChangeCallback) this.onStatusChangeCallback(this.isListening ? 'listening' : 'idle');
    };

    utterance.onerror = () => {
      if (this.onStatusChangeCallback) this.onStatusChangeCallback('idle');
    };

    window.speechSynthesis.speak(utterance);
  }
}

export const audioEngine = new NexusAudioEngine();
