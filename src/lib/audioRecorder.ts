/**
 * AudioRecorder utility for capturing voice audio clips to transcribe with gemini-3.5-transcribe.
 */

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private isRecordingState = false;

  public async start(): Promise<void> {
    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // Check supported mime types
    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    const selectedMime = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';

    this.mediaRecorder = selectedMime
      ? new MediaRecorder(this.stream, { mimeType: selectedMime })
      : new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250); // Emit chunk every 250ms
    this.isRecordingState = true;
  }

  public async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecordingState) {
        return reject(new Error('Recorder is not active'));
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanup();
        resolve(audioBlob);
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        this.cleanup();
        reject(e);
      }
    });
  }

  public isRecording(): boolean {
    return this.isRecordingState;
  }

  public cancel(): void {
    if (this.mediaRecorder && this.isRecordingState) {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.isRecordingState = false;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

export const audioRecorder = new AudioRecorder();
