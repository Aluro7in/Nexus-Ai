import React, { useState, useEffect, useRef } from 'react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface VoiceAssistantPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
}

export const VoiceAssistantPanel: React.FC<VoiceAssistantPanelProps> = ({
  messages,
  onSendMessage,
  isProcessing,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check SpeechRecognition support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          onSendMessage(transcript);
        }
      };

      recognitionRef.current = recognition;
    } else {
      setVoiceSupported(false);
    }
  }, [onSendMessage]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleListening = () => {
    if (!voiceSupported) {
      alert('Speech recognition is not supported in this browser. Please use text input.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="voice-panel glass-panel">
      {/* Ambient Orb */}
      <div className="orb-container">
        <div className="orb-ring" />
        <div
          className={`ambient-orb ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
          onClick={toggleListening}
          title={isListening ? 'Listening... click to stop' : 'Click to speak'}
        />
      </div>

      <div className="voice-status-text">
        {isProcessing
          ? 'Nexus is orchestrating tools across your ecosystem...'
          : isListening
          ? 'Listening to voice command...'
          : isSpeaking
          ? 'Speaking response...'
          : 'Tap orb or microphone to speak, or type your request below.'}
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSend} className="voice-input-bar">
        <button
          type="button"
          className={`mic-toggle-btn ${isListening ? 'active' : ''}`}
          onClick={toggleListening}
          title="Toggle voice input"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        </button>

        <input
          type="text"
          className="voice-input-field"
          placeholder="Ask Nexus to check schedule, stage orders, or set routines..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isProcessing}
        />

        <button
          type="submit"
          className="btn-primary"
          style={{ padding: '8px 18px', fontSize: '13px' }}
          disabled={isProcessing || !inputText.trim()}
        >
          Send
        </button>
      </form>

      {/* Conversation Feed */}
      <div className="conversation-feed" style={{ width: '100%', marginTop: '24px' }}>
        {messages.map((msg) => (
          <div key={msg.id} className={`message-bubble ${msg.sender}`}>
            <div className="message-bubble-header">
              <span>{msg.sender === 'user' ? 'You' : 'Nexus AI (Alexa+)'}</span>
              <span>{msg.timestamp}</span>
            </div>
            <div>{msg.text}</div>
            {msg.sender === 'assistant' && (
              <button
                type="button"
                onClick={() => speakText(msg.text)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '6px',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                Listen
              </button>
            )}
          </div>
        ))}
        <div ref={feedEndRef} />
      </div>
    </div>
  );
};
