import { useState, useEffect, useRef, useCallback } from 'react';

// Declaration for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

interface UseRaOneVoiceProps {
  onCommandRecognized?: (command: string) => void;
  onWakeWordTriggered?: () => void;
}

export function useRaOneVoice({ onCommandRecognized, onWakeWordTriggered }: UseRaOneVoiceProps = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isContinuousWakeListening, setIsContinuousWakeListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const wakeRecognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSupported(true);
      }
      if ('speechSynthesis' in window) {
        synthRef.current = window.speechSynthesis;
      }
    }
  }, []);

  // Voice level simulation when listening/speaking
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isListening || isSpeaking) {
      interval = setInterval(() => {
        setAudioLevel(Math.floor(Math.random() * 60) + 30);
      }, 100);
    } else {
      setAudioLevel(0);
    }
    return () => clearInterval(interval);
  }, [isListening, isSpeaking]);

  // Main active command listener
  const startListening = useCallback(() => {
    if (!isSupported) {
      setVoiceError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      setVoiceError(null);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);

        // Check if wake word in stream
        const lower = currentTranscript.toLowerCase();
        if (lower.includes('hey raone') || lower.includes('hey ra one')) {
          onWakeWordTriggered?.();
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Voice recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setVoiceError(`Voice input error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (transcript.trim() && onCommandRecognized) {
          onCommandRecognized(transcript.trim());
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setVoiceError(err.message || 'Failed to start microphone');
      setIsListening(false);
    }
  }, [isSupported, transcript, onCommandRecognized, onWakeWordTriggered]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  // Toggle Continuous Wake Word Mode ("Hey RaOne")
  const toggleContinuousWakeListening = useCallback(() => {
    if (!isSupported) return;

    if (isContinuousWakeListening) {
      if (wakeRecognitionRef.current) {
        wakeRecognitionRef.current.stop();
        wakeRecognitionRef.current = null;
      }
      setIsContinuousWakeListening(false);
    } else {
      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const wakeRec = new SpeechRecognition();
        wakeRec.continuous = true;
        wakeRec.interimResults = true;
        wakeRec.lang = 'en-US';

        wakeRec.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript.toLowerCase();
            if (
              text.includes('hey raone') ||
              text.includes('hey ra one') ||
              text.includes('hey ravana') ||
              text.includes('raone')
            ) {
              onWakeWordTriggered?.();
              // Clean query after wake word
              const command = text.replace(/hey\s*raone|hey\s*ra\s*one/gi, '').trim();
              if (command && onCommandRecognized) {
                onCommandRecognized(command);
              }
            }
          }
        };

        wakeRec.onerror = () => {
          // Restart quietly if listening
          if (isContinuousWakeListening) {
            try {
              wakeRec.start();
            } catch (e) {
              // ignore
            }
          }
        };

        wakeRec.onend = () => {
          if (isContinuousWakeListening) {
            try {
              wakeRec.start();
            } catch (e) {
              // ignore
            }
          }
        };

        wakeRecognitionRef.current = wakeRec;
        wakeRec.start();
        setIsContinuousWakeListening(true);
      } catch (err) {
        console.error('Failed wake listener:', err);
      }
    }
  }, [isSupported, isContinuousWakeListening, onWakeWordTriggered, onCommandRecognized]);

  // Speak text back using SpeechSynthesis
  const speakText = useCallback((text: string) => {
    if (!synthRef.current) return;

    // Stop ongoing speech
    synthRef.current.cancel();

    // Clean markdown code blocks from speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Code block generated.')
      .replace(/[#*`_~]/g, '')
      .replace(/\(http[s]?:\/\/[^\)]+\)/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;

    // Pick best English voice if available
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Daniel'))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    currentUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    isSupported,
    isListening,
    isContinuousWakeListening,
    isSpeaking,
    transcript,
    audioLevel,
    voiceError,
    startListening,
    stopListening,
    toggleContinuousWakeListening,
    speakText,
    stopSpeaking,
  };
}
