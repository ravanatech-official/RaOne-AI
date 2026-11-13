import React, { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  Image as ImageIcon,
  Music,
  Video,
  Mic,
  Copy,
  Check,
  Download,
  Upload,
  ArrowRight,
} from 'lucide-react';

interface AIStudioHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToChat: (content: string, media?: any) => void;
  initialTab?: 'image' | 'music' | 'video' | 'transcribe';
}

export const AIStudioHubModal: React.FC<AIStudioHubModalProps> = ({
  isOpen,
  onClose,
  onInsertToChat,
  initialTab = 'image',
}) => {
  const [activeTab, setActiveTab] = useState<'image' | 'music' | 'video' | 'transcribe'>(initialTab);

  // --- Image Studio State ---
  const [imagePrompt, setImagePrompt] = useState('Futuristic cybernetic Ravana with golden solar armor and celestial cyan circuits, 8k render');
  const [imageRatio, setImageRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedRefImage, setUploadedRefImage] = useState<string | null>(null);

  // --- Music Studio State ---
  const [musicPrompt, setMusicPrompt] = useState('Cinematic sci-fi orchestral track with ancient Ravana temple drums, ambient electronic brass, and heroic buildup');
  const [musicDuration, setMusicDuration] = useState<'clip' | 'full'>('clip');
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicResult, setMusicResult] = useState<{ audioUrl: string | null; lyrics: string; prompt: string } | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // --- Video Studio State ---
  const [videoPrompt, setVideoPrompt] = useState('Cinematic aerial drone flight approaching Sigiriya at sunrise, enveloped in neon quantum data beams');
  const [videoRatio, setVideoRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoResult, setVideoResult] = useState<{ videoUrl?: string | null; storyboard?: string[]; prompt: string } | null>(null);

  // --- Transcriber State ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [transcribeLoading, setTranscribeLoading] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<any>(null);

  // --- Copy Feedback State ---
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // --- Image Generation Handler ---
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setImageLoading(true);
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          aspectRatio: imageRatio,
          imageSize,
          base64Image: uploadedRefImage,
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
      }
    } catch (e) {
      console.error('Image gen error:', e);
    } finally {
      setImageLoading(false);
    }
  };

  // --- Music Generation Handler ---
  const handleGenerateMusic = async () => {
    if (!musicPrompt.trim()) return;
    setMusicLoading(true);
    setIsPlayingMusic(false);
    try {
      const res = await fetch('/api/ai/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: musicPrompt,
          model: musicDuration === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview',
        }),
      });
      const data = await res.json();
      setMusicResult({
        audioUrl: data.audioDataUrl || null,
        lyrics: data.lyrics || '',
        prompt: musicPrompt,
      });
    } catch (e) {
      console.error('Music gen error:', e);
    } finally {
      setMusicLoading(false);
    }
  };

  // --- Video Generation Handler ---
  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) return;
    setVideoLoading(true);
    try {
      const res = await fetch('/api/ai/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          aspectRatio: videoRatio,
          duration: '10s',
          base64Image: uploadedRefImage,
        }),
      });
      const data = await res.json();
      setVideoResult({
        videoUrl: data.videoDataUrl || null,
        storyboard: data.storyboard || [],
        prompt: videoPrompt,
      });
    } catch (e) {
      console.error('Video gen error:', e);
    } finally {
      setVideoLoading(false);
    }
  };

  // --- Audio Recording & Transcribing Handler ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          await sendForTranscription(base64Audio);
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordDuration(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordIntervalRef.current);
    }
  };

  const sendForTranscription = async (base64Audio: string) => {
    setTranscribeLoading(true);
    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64Audio, mimeType: 'audio/webm' }),
      });
      const data = await res.json();
      setTranscribedText(data.transcript || '');
    } catch (e) {
      console.error('Transcribe error:', e);
    } finally {
      setTranscribeLoading(false);
    }
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64Audio = reader.result as string;
      await sendForTranscription(base64Audio);
    };
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      setUploadedRefImage(reader.result as string);
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[88vh] bg-[#141822] border border-amber-500/30 rounded-2xl shadow-[0_0_60px_rgba(245,158,11,0.15)] flex flex-col overflow-hidden text-[#ECECEC]">
        {/* Top Header Bar */}
        <div className="h-16 px-6 border-b border-slate-800 bg-[#0E121C] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-amber-500/40 p-0.5 bg-black shadow-md">
              <img
                src="/assets/aistudio/RaOne_Logo_c8b49006.png"
                alt="RaOne Emblem"
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-display text-white tracking-tight">
                  RaOne Studio Hub
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Creative Suite
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                RaOne AI by RavanaTec · Think. Create. Act.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-[#0A0D14] border-b border-slate-800/80 overflow-x-auto shrink-0 scrollbar-none">
          {[
            { id: 'image', label: 'Visual Studio', icon: ImageIcon, badge: '4K Synthesis' },
            { id: 'music', label: 'Music Studio', icon: Music, badge: 'Acoustic Audio' },
            { id: 'video', label: 'Video Studio', icon: Video, badge: 'Cinematic Motion' },
            { id: 'transcribe', label: 'Voice Transcribe', icon: Mic, badge: 'Speech to Text' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                <span className="text-[9px] text-slate-400 opacity-60 ml-0.5 hidden sm:inline">
                  ({tab.badge})
                </span>
              </button>
            );
          })}
        </div>

        {/* Main Body View */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-[#0B0F19]">
          {/* TAB 1: VISUAL STUDIO */}
          {activeTab === 'image' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
              {/* Controls Column */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#121724] border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      RaOne Visual Engine
                    </span>
                    <span className="text-[10px] text-slate-400">4K Ultra-Resolution</span>
                  </div>

                  {/* Prompt Textarea */}
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Creative Visual Prompt
                  </label>
                  <textarea
                    rows={4}
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Describe the image you want RaOne AI to render..."
                    className="w-full bg-[#080B12] border border-slate-700 focus:border-amber-400 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
                  />

                  {/* Aspect Ratio Selector */}
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Aspect Ratio
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {['1:1', '16:9', '9:16', '4:3', '3:4'].map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() => setImageRatio(ratio)}
                          className={`py-1.5 text-xs font-medium rounded-lg border transition-all text-center ${
                            imageRatio === ratio
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resolution Selector */}
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Resolution Quality
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['1K', '2K', '4K'].map((res) => (
                        <button
                          key={res}
                          onClick={() => setImageSize(res)}
                          className={`py-1.5 text-xs font-medium rounded-lg border transition-all ${
                            imageSize === res
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Optional Reference Image Upload for Editing */}
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Optional Image-to-Image / Editing Input
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-3 py-2 text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer text-slate-300 transition-colors">
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        <span>Upload Reference</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                      {uploadedRefImage && (
                        <div className="flex items-center gap-2">
                          <img
                            src={uploadedRefImage}
                            alt="Ref"
                            className="w-8 h-8 rounded-lg object-cover border border-amber-500/40"
                          />
                          <button
                            onClick={() => setUploadedRefImage(null)}
                            className="text-xs text-rose-400 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerateImage}
                    disabled={imageLoading || !imagePrompt.trim()}
                    className="w-full mt-5 py-2.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{imageLoading ? 'Synthesizing Visual Canvas...' : 'Generate with RaOne AI'}</span>
                  </button>
                </div>
              </div>

              {/* Preview Column */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="flex-1 bg-[#0A0D14] border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                  <div className="p-3 border-b border-slate-800 bg-[#0F131E] flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-300">
                      Visual Canvas · {imageRatio} · {imageSize}
                    </span>
                    {generatedImage && (
                      <div className="flex items-center gap-2">
                        <a
                          href={generatedImage}
                          download="RaOne_Visual_Creation.png"
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                        <button
                          onClick={() => {
                            onInsertToChat(`Here is the visual piece synthesized by RaOne AI: "${imagePrompt}"`, {
                              imageUrl: generatedImage,
                              prompt: imagePrompt,
                            });
                            onClose();
                          }}
                          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors"
                        >
                          <span>Insert into Chat</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex items-center justify-center p-6 bg-black/60 min-h-[360px]">
                    {imageLoading ? (
                      <div className="text-center space-y-3">
                        <div className="w-12 h-12 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto" />
                        <p className="text-xs font-mono text-amber-300">
                          RaOne is synthesizing visual canvas...
                        </p>
                      </div>
                    ) : generatedImage ? (
                      <div className="relative group max-h-full max-w-full">
                        <img
                          src={generatedImage}
                          alt="RaOne Synthesis"
                          className="max-h-[500px] w-auto rounded-xl object-contain shadow-2xl border border-amber-500/30"
                        />
                      </div>
                    ) : (
                      <div className="text-center space-y-3 max-w-sm">
                        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                          <ImageIcon className="w-7 h-7" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-300">
                          No visual render yet
                        </h3>
                        <p className="text-xs text-slate-500">
                          Enter your prompt on the left and tap &ldquo;Generate with RaOne AI&rdquo; to experience sovereign high-definition synthesis.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MUSIC STUDIO */}
          {activeTab === 'music' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#121724] border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5" />
                      RaOne Acoustic Engine
                    </span>
                    <span className="text-[10px] text-slate-400">Mastered Audio MP3</span>
                  </div>

                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Musical Composition Directive
                  </label>
                  <textarea
                    rows={4}
                    value={musicPrompt}
                    onChange={(e) => setMusicPrompt(e.target.value)}
                    placeholder="Describe instruments, tempo, mood, and genre..."
                    className="w-full bg-[#080B12] border border-slate-700 focus:border-amber-400 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
                  />

                  {/* Duration Toggle */}
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Track Length
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setMusicDuration('clip')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          musicDuration === 'clip'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-semibold text-xs">Short Clip</div>
                        <div className="text-[10px] text-slate-500">30s audio prelude</div>
                      </button>
                      <button
                        onClick={() => setMusicDuration('full')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          musicDuration === 'full'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-semibold text-xs">Full Track</div>
                        <div className="text-[10px] text-slate-500">Multi-section production</div>
                      </button>
                    </div>
                  </div>

                  {/* Preset Buttons */}
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Quick Presets
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Ravana Cosmic War Drums & Brass',
                        'Sigiriya Ambient Lo-Fi Rain & Flute',
                        'Cyberpunk Kinetic Synthwave',
                        'Sri Lankan Fusion Orchestral',
                      ].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setMusicPrompt(preset)}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400 text-slate-300 transition-colors"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateMusic}
                    disabled={musicLoading || !musicPrompt.trim()}
                    className="w-full mt-5 py-2.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{musicLoading ? 'Composing Track with RaOne...' : 'Compose Track with RaOne'}</span>
                  </button>
                </div>
              </div>

              {/* Music Player & Lyrics Column */}
              <div className="lg:col-span-7 flex flex-col space-y-4">
                <div className="bg-[#121724] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-white">Audio Waveform & Player</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Synthesized by RaOne AI Acoustic Studio
                      </p>
                    </div>
                    {musicResult?.audioUrl && (
                      <a
                        href={musicResult.audioUrl}
                        download="RaOne_Track.mp3"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download MP3</span>
                      </a>
                    )}
                  </div>

                  {/* Audio Player Component */}
                  <div className="my-6 p-5 rounded-xl bg-[#090D15] border border-slate-800 flex flex-col items-center justify-center">
                    {musicLoading ? (
                      <div className="py-8 text-center space-y-3">
                        <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto" />
                        <p className="text-xs font-mono text-amber-300">
                          Composing stems & synthesizing audio...
                        </p>
                      </div>
                    ) : musicResult?.audioUrl ? (
                      <div className="w-full space-y-4">
                        <audio
                          ref={audioPlayerRef}
                          src={musicResult.audioUrl}
                          onPlay={() => setIsPlayingMusic(true)}
                          onPause={() => setIsPlayingMusic(false)}
                          onEnded={() => setIsPlayingMusic(false)}
                          controls
                          className="w-full"
                        />
                        <div className="flex items-center justify-center gap-1.5 h-8">
                          {[30, 60, 90, 45, 80, 50, 100, 70, 40, 85, 60, 35].map((h, i) => (
                            <span
                              key={i}
                              className="w-1 bg-amber-400 rounded-full transition-all duration-200"
                              style={{
                                height: isPlayingMusic ? `${Math.max(6, (h * Math.random()) + 10)}px` : '8px',
                                opacity: isPlayingMusic ? 0.9 : 0.4,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center space-y-2">
                        <Music className="w-10 h-10 text-slate-600 mx-auto" />
                        <p className="text-xs text-slate-400">
                          No audio track generated yet. Tap compose to synthesize.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Lyrics / Composition Metadata */}
                  {musicResult && (
                    <div className="flex-1 mt-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                        <span>Lyrics & Composition Structure</span>
                        <button
                          onClick={() => handleCopyText(musicResult.lyrics, 'lyrics-1')}
                          className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                        >
                          {copiedId === 'lyrics-1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>Copy Lyrics</span>
                        </button>
                      </div>
                      <div className="p-4 rounded-xl bg-[#080B12] border border-slate-800 text-xs font-mono text-slate-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {musicResult.lyrics}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VIDEO STUDIO */}
          {activeTab === 'video' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#121724] border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5" />
                      RaOne Motion Engine
                    </span>
                    <span className="text-[10px] text-slate-400">Neural Video Direction</span>
                  </div>

                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Video Scene & Motion Direction
                  </label>
                  <textarea
                    rows={4}
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    placeholder="Describe the cinematic scene, camera motion, and action..."
                    className="w-full bg-[#080B12] border border-slate-700 focus:border-amber-400 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
                  />

                  <div className="mt-4">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Orientation
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setVideoRatio('16:9')}
                        className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                          videoRatio === '16:9'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        16:9 Landscape
                      </button>
                      <button
                        onClick={() => setVideoRatio('9:16')}
                        className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                          videoRatio === '9:16'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        9:16 Vertical Reel
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Optional Keyframe (Image-to-Video Animation)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-3 py-2 text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer text-slate-300 transition-colors">
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        <span>Upload Keyframe</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                      {uploadedRefImage && (
                        <div className="flex items-center gap-2">
                          <img
                            src={uploadedRefImage}
                            alt="Keyframe"
                            className="w-8 h-8 rounded-lg object-cover border border-amber-500/40"
                          />
                          <button
                            onClick={() => setUploadedRefImage(null)}
                            className="text-xs text-rose-400 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateVideo}
                    disabled={videoLoading || !videoPrompt.trim()}
                    className="w-full mt-5 py-2.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{videoLoading ? 'Rendering Video Sequence...' : 'Render Video with RaOne'}</span>
                  </button>
                </div>
              </div>

              {/* Video Player & Storyboard Column */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="bg-[#121724] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col flex-1">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-white">Video Studio Player</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        High-frame-rate cinematic rendering · {videoRatio}
                      </p>
                    </div>
                  </div>

                  <div className="my-5 flex-1 bg-black/60 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px]">
                    {videoLoading ? (
                      <div className="text-center space-y-3">
                        <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto" />
                        <p className="text-xs font-mono text-amber-300">
                          Rendering video sequence with RaOne...
                        </p>
                      </div>
                    ) : videoResult?.videoUrl ? (
                      <video
                        src={videoResult.videoUrl}
                        controls
                        autoPlay
                        loop
                        className="max-h-[400px] w-auto rounded-lg shadow-2xl"
                      />
                    ) : (
                      <div className="text-center space-y-2 p-6">
                        <Video className="w-10 h-10 text-slate-600 mx-auto" />
                        <p className="text-xs text-slate-400">
                          No video rendered yet. Specify scene details and click Render.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Storyboard Sequence */}
                  {videoResult?.storyboard && videoResult.storyboard.length > 0 && (
                    <div className="p-4 rounded-xl bg-[#090D15] border border-slate-800">
                      <div className="text-xs font-semibold text-slate-300 mb-2">
                        Keyframe Sequence Breakdown
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-400 font-mono">
                        {videoResult.storyboard.map((frame, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-amber-400 shrink-0">▸</span>
                            <span>{frame}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUDIO TRANSCRIBE */}
          {activeTab === 'transcribe' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-[#121724] border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Voice Transcription Matrix</h3>
                  </div>
                  <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    High Accuracy
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Record directly from your microphone or upload audio files (.mp3, .wav, .webm, .m4a). RaOne accurately transcribes verbatim in Sinhala, English, and Singlish.
                </p>

                {/* Live Mic Recording Action */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-8 border-y border-slate-800/80 bg-black/30 rounded-xl my-4">
                  {isRecording ? (
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-3 px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all shadow-[0_0_20px_rgba(225,29,72,0.4)] animate-pulse"
                    >
                      <span className="w-3 h-3 rounded-full bg-white" />
                      <span>Stop Recording ({recordDuration}s)</span>
                    </button>
                  ) : (
                    <button
                      onClick={startRecording}
                      className="flex items-center gap-3 px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                    >
                      <Mic className="w-4 h-4" />
                      <span>Start Voice Recording</span>
                    </button>
                  )}

                  <span className="text-xs text-slate-500">or</span>

                  <label className="flex items-center gap-2 px-4 py-2.5 text-xs bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-full cursor-pointer text-slate-300 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Upload Audio File</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Transcribing Status */}
                {transcribeLoading && (
                  <div className="text-center py-4 space-y-2">
                    <div className="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto" />
                    <p className="text-xs font-mono text-amber-300">
                      RaOne is transcribing speech...
                    </p>
                  </div>
                )}

                {/* Result Transcript Box */}
                {transcribedText && (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span>Transcribed Text</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyText(transcribedText, 'transcribe-copy')}
                          className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                        >
                          {copiedId === 'transcribe-copy' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>Copy</span>
                        </button>
                        <button
                          onClick={() => {
                            onInsertToChat(transcribedText);
                            onClose();
                          }}
                          className="px-3 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <span>Insert into Chat</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-[#090D15] border border-slate-800 text-sm text-slate-200 leading-relaxed">
                      “{transcribedText}”
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
