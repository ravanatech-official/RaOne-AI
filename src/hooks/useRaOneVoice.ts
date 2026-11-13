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
  const transcriptRef = useRef('');
  const isContinuousWakeRef = useRef(false);
  const manualStopRef = useRef(false);
  const onCommandRecognizedRef = useRef(onCommandRecognized);
  const onWakeWordTriggeredRef = useRef(onWakeWordTriggered);

  useEffect(() => {
    onCommandRecognizedRef.current = onCommandRecognized;
  }, [onCommandRecognized]);

  useEffect(() => {
    onWakeWordTriggeredRef.current = onWakeWordTriggered;
  }, [onWakeWordTriggered]);

  const WAKE_WORD_REGEX = /\b(hey\s*raone|hey\s*ra[\s-]*one|hey\s*ravan[a]?|hey\s*rawan[a]?)\b/i;
  const WAKE_WORD_STRIP_REGEX = /^[\s,.:;-]*(hey\s*raone|hey\s*ra[\s-]*one|hey\s*ravan[a]?|hey\s*rawan[a]?)[\s,.:;-]*/i;

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
    return () => {
      isContinuousWakeRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      try {
        wakeRecognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  // Voice level simulation when listening/speaking
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isListening || isSpeaking) {
      interval = setInterval(() => {
        setAudioLevel(Math.floor(Math.random() * 60) + 30);
      }, 100);
    } else {
      setAudioLevel(0);
    }
    return () => clearInterval(interval);
  }, [isListening, isSpeaking]);

  const clearTranscript = useCallback(() => {
    transcriptRef.current = '';
    setTranscript('');
  }, []);

  // Main active command listener
  const startListening = useCallback(() => {
    if (!isSupported) {
      setVoiceError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      setVoiceError(null);
      manualStopRef.current = false;
      transcriptRef.current = '';
      setTranscript('');

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        transcriptRef.current = '';
        setTranscript('');
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        transcriptRef.current = currentTranscript;
        setTranscript(currentTranscript);

        if (WAKE_WORD_REGEX.test(currentTranscript)) {
          onWakeWordTriggeredRef.current?.();
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Voice recognition error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setVoiceError(`Voice input error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (manualStopRef.current) {
          manualStopRef.current = false;
          return;
        }
        const raw = transcriptRef.current.trim();
        if (!raw) return;

        // If user only spoke the wake phrase without a command, keep transcript ready instead of auto-sending an empty wake greeting
        const stripped = raw.replace(WAKE_WORD_STRIP_REGEX, '').trim();
        if (WAKE_WORD_REGEX.test(raw) && !stripped) {
          return;
        }

        const commandToSend = stripped || raw;
        if (commandToSend && onCommandRecognizedRef.current) {
          transcriptRef.current = '';
          setTranscript('');
          onCommandRecognizedRef.current(commandToSend);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setVoiceError(err.message || 'Failed to start microphone');
      setIsListening(false);
    }
  }, [isSupported]);

  const stopListening = useCallback((suppressAutoSubmit = false) => {
    manualStopRef.current = suppressAutoSubmit;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }
  }, []);

  // Toggle Continuous Wake Word Mode ("Hey RaOne")
  const toggleContinuousWakeListening = useCallback(() => {
    if (!isSupported) return;

    if (isContinuousWakeRef.current) {
      isContinuousWakeRef.current = false;
      if (wakeRecognitionRef.current) {
        try {
          wakeRecognitionRef.current.stop();
        } catch {
          // ignore
        }
        wakeRecognitionRef.current = null;
      }
      setIsContinuousWakeListening(false);
    } else {
      try {
        setVoiceError(null);
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const wakeRec = new SpeechRecognition();
        wakeRec.continuous = true;
        wakeRec.interimResults = true;
        wakeRec.lang = 'en-US';

        wakeRec.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const rawText = String(result[0]?.transcript || '').trim();
            if (!rawText) continue;

            if (WAKE_WORD_REGEX.test(rawText) || /\braone\b/i.test(rawText)) {
              onWakeWordTriggeredRef.current?.();
              setTranscript(rawText);
              transcriptRef.current = rawText;

              if (result.isFinal) {
                const command = rawText
                  .replace(/\b(hey\s*raone|hey\s*ra[\s-]*one|hey\s*ravan[a]?|hey\s*rawan[a]?|raone)\b/gi, '')
                  .trim();
                if (command && onCommandRecognizedRef.current) {
                  transcriptRef.current = '';
                  setTranscript('');
                  onCommandRecognizedRef.current(command);
                }
              }
            }
          }
        };

        wakeRec.onerror = (event: any) => {
          if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed' || event?.error === 'audio-capture') {
            isContinuousWakeRef.current = false;
            setIsContinuousWakeListening(false);
            setVoiceError(`Wake listener microphone error: ${event.error}`);
            return;
          }
          // Transient error (e.g. no-speech) handled cleanly in onend
        };

        wakeRec.onend = () => {
          if (isContinuousWakeRef.current) {
            setTimeout(() => {
              if (!isContinuousWakeRef.current) return;
              try {
                wakeRec.start();
              } catch {
                // ignore already-started races
              }
            }, 250);
          }
        };

        isContinuousWakeRef.current = true;
        wakeRecognitionRef.current = wakeRec;
        wakeRec.start();
        setIsContinuousWakeListening(true);
      } catch (err: any) {
        isContinuousWakeRef.current = false;
        setIsContinuousWakeListening(false);
        setVoiceError(err?.message || 'Failed to start wake listener');
        console.error('Failed wake listener:', err);
      }
    }
  }, [isSupported]);

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
    clearTranscript,
    toggleContinuousWakeListening,
    speakText,
    stopSpeaking,
  };
}
