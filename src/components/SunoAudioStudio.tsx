import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Play,
  Pause,
  Maximize2,
  Download,
  Copy,
  Trash2,
  Heart,
  RefreshCw,
  Dices,
  Sliders,
  Music,
  Radio,
  Mic2,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  FileText,
  Scissors,
  FastForward,
  Cpu,
  Layers,
  Wand2,
  Check,
  ChevronDown,
  Clock,
  Disc3,
  Search,
  Share2,
  Flame,
  AudioWaveform,
} from 'lucide-react';
import { GeneratedAudioItem } from '../types/index.ts';

interface SunoAudioStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

const TTA_MODELS = [
  {
    id: 'Suno v4 Alpha (RVQ DiT)',
    name: 'Suno v4 Alpha (RVQ DiT)',
    provider: 'Suno AI',
    badge: 'State of the Art',
    desc: '48kHz high-definition stereo master with natural vocal inflections, rich acoustic drums, and multi-part harmonies.',
    color: 'from-amber-500 to-rose-600',
  },
  {
    id: 'Suno v3.5 SOTA',
    name: 'Suno v3.5 SOTA',
    provider: 'Suno AI',
    badge: 'Hitmaker Standard',
    desc: 'Elite song structure adherence, radio-ready verse/chorus transitions, and polished pop/electronic production.',
    color: 'from-orange-500 to-amber-600',
  },
  {
    id: 'Udio 130 Clarity Pro',
    name: 'Udio 130 Clarity Pro',
    provider: 'Udio Research',
    badge: 'Vocal Nuance',
    desc: 'High dynamic range vocal synthesis with expressive vibrato, emotional breath control, and complex time signatures.',
    color: 'from-purple-500 to-indigo-600',
  },
  {
    id: 'Google Lyria AudioLM',
    name: 'Google Lyria AudioLM',
    provider: 'Google DeepMind',
    badge: 'Multimodal Audio',
    desc: 'Hierarchical acoustic and semantic token conditioning for sprawling instrumental landscapes and seamless continuation.',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    id: 'ElevenLabs Music/Voice Pro',
    name: 'ElevenLabs Voice Pro',
    provider: 'ElevenLabs',
    badge: 'Spoken / Speech',
    desc: 'Pristine human voice generation, audio storytelling, spoken word poetry, and studio voiceovers.',
    color: 'from-emerald-500 to-teal-600',
  },
];

const GENRE_TAGS = [
  'Synthwave',
  'Cyberpunk',
  'EDM Pop',
  'Cinematic Epic',
  'Lo-Fi Chill',
  'Baila Fusion',
  'Industrial Rock',
  'RnB Melodic',
  'Acoustic Folk',
  'Deep House',
  'Trap Beats',
  'Orchestral Choir',
];

const KEY_SIGNATURES = [
  'C Major',
  'A Minor',
  'G Major',
  'E Minor',
  'D Major',
  'B Minor',
  'F Major',
  'D Minor',
  'Bb Major',
  'G Minor',
];

const RANDOM_SONG_IDEAS = [
  {
    title: 'Quantum Horizon',
    prompt: 'Upbeat 80s synthwave anthem with pulsating basslines, glittering analog synths, and powerful emotive female vocals about escaping to the neon stars.',
    style: 'Synthwave, Retro Electro, 128 BPM',
  },
  {
    title: 'Monsoon in Kandy',
    prompt: 'Soothing lo-fi chillhop with organic rain sounds, mellow Rhodes keyboard chords, smooth bassline, and warm acoustic guitar fingerpicking.',
    style: 'Lo-Fi Chill, Study Beats, 85 BPM',
  },
  {
    title: 'Thunder over Sigiriya',
    prompt: 'Epic cinematic orchestral hybrid with ancient Sri Lankan traditional geta bera drums, heavy brass horns, and dramatic operatic choir crescendos.',
    style: 'Cinematic Orchestral, Epic Trailer, Choir',
  },
  {
    title: 'Electric Baila Fiesta',
    prompt: 'High energy modern Baila dance party with acoustic guitar strums, fast brass horn stabs, bouncy synth bass, and celebratory Sinhala fusion vibes.',
    style: 'Baila Fusion, World Beat, 135 BPM',
  },
  {
    title: 'Silicon Awakening',
    prompt: 'Dark cyber industrial rock with heavily distorted guitars, aggressive electronic beat, raw passionate male vocals, and soaring lead synths.',
    style: 'Industrial Rock, Cyberpunk, 140 BPM',
  },
];

export const SunoAudioStudio: React.FC<SunoAudioStudioProps> = ({ isOpen, onClose }) => {
  // Creation Form State (Suno Left Drawer)
  const [customMode, setCustomMode] = useState<boolean>(true);
  const [isInstrumental, setIsInstrumental] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>('Cyberpunk synthwave electronic with driving analog bassline, retro arpeggiators, punchy 80s drums, and soaring futuristic synth leads');
  const [lyrics, setLyrics] = useState<string>(
    `[Verse 1]\nRain falling down on the chrome and glass\nHovercars burning in the neon flash\nFrom Pettah towers to the ocean line\nQuantum signals humming through the wire and vine\n\n[Chorus]\nWe are the children of the neon sea\nElectric pulses set our spirits free\nColombo 2099, shining in the rain\nRewriting all the codes inside our veins!\n\n[Guitar Solo]\n\n[Outro]\nPulse in the dark\nIgnite the spark\nHorizon glow...`
  );
  const [title, setTitle] = useState<string>('Neon Horizons of Colombo 2099');
  const [selectedModel, setSelectedModel] = useState<string>('Suno v4 Alpha (RVQ DiT)');
  const [styleInput, setStyleInput] = useState<string>('Synthwave, Cyberpunk, Retro Electro, 120 BPM');
  const [bpm, setBpm] = useState<number>(120);
  const [keySignature, setKeySignature] = useState<string>('D Minor');

  // Studio State
  const [tracks, setTracks] = useState<GeneratedAudioItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEnhancingLyrics, setIsEnhancingLyrics] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'library' | 'architecture'>('library');
  const [filterFavorite, setFilterFavorite] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showLyricsModal, setShowLyricsModal] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Persistent Global Audio Player State
  const [activeTrack, setActiveTrack] = useState<GeneratedAudioItem | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [stemMode, setStemMode] = useState<'mix' | 'vocals' | 'instrumental'>('mix');

  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  // Load Tracks on mount & when open
  useEffect(() => {
    if (isOpen) {
      fetchAudioHistory();
    }
  }, [isOpen]);

  const fetchAudioHistory = async () => {
    try {
      const res = await fetch('/api/audio/history');
      const data = await res.json();
      if (data.success && data.items) {
        setTracks(data.items);
        if (!activeTrack && data.items.length > 0) {
          setActiveTrack(data.items[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load audio history:', err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !lyrics.trim()) return;
    setIsLoading(true);

    try {
      const tags = styleInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        prompt,
        lyrics: isInstrumental ? '' : lyrics,
        title: title || 'Sovereign Track',
        styleTags: tags,
        model: selectedModel,
        isInstrumental,
        bpm,
        keySignature,
        duration: 180,
      };

      const res = await fetch('/api/audio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.track) {
        setTracks((prev) => [data.track, ...prev]);
        setActiveTrack(data.track);
        setIsPlaying(true);
        if (audioPlayerRef.current) {
          audioPlayerRef.current.currentTime = 0;
          audioPlayerRef.current.play().catch(() => {});
        }
      }
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnhanceLyrics = async () => {
    if (!prompt.trim()) return;
    setIsEnhancingLyrics(true);

    try {
      const res = await fetch('/api/audio/enhance-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style: styleInput,
          title,
        }),
      });

      const data = await res.json();
      if (data.success && data.lyrics) {
        setLyrics(data.lyrics);
        setCustomMode(true);
      }
    } catch (err) {
      console.error('Lyrics generation failed:', err);
    } finally {
      setIsEnhancingLyrics(false);
    }
  };

  const handleRandomizeSongIdea = () => {
    const random = RANDOM_SONG_IDEAS[Math.floor(Math.random() * RANDOM_SONG_IDEAS.length)];
    setTitle(random.title);
    setPrompt(random.prompt);
    setStyleInput(random.style);
    setBpm(Math.floor(Math.random() * 60) + 80);
    setKeySignature(KEY_SIGNATURES[Math.floor(Math.random() * KEY_SIGNATURES.length)]);
  };

  const handleToggleTag = (tag: string) => {
    const existing = styleInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (existing.includes(tag)) {
      setStyleInput(existing.filter((t) => t !== tag).join(', '));
    } else {
      setStyleInput([...existing, tag].join(', '));
    }
  };

  const handleToggleFavorite = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch('/api/audio/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, isFavorite: data.item.isFavorite } : t)));
        if (activeTrack?.id === id) {
          setActiveTrack((prev) => (prev ? { ...prev, isFavorite: data.item.isFavorite } : null));
        }
      }
    } catch (err) {
      console.error('Favorite toggle failed:', err);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch('/api/audio/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setTracks((prev) => prev.filter((t) => t.id !== id));
        if (activeTrack?.id === id) {
          const remaining = tracks.filter((t) => t.id !== id);
          setActiveTrack(remaining[0] || null);
        }
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleExtendTrack = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch('/api/audio/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setTracks((prev) => prev.map((t) => (t.id === id ? data.item : t)));
        if (activeTrack?.id === id) setActiveTrack(data.item);
      }
    } catch (err) {
      console.error('Extend failed:', err);
    }
  };

  const handleSeparateStems = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch('/api/audio/separate-stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setTracks((prev) => prev.map((t) => (t.id === id ? data.item : t)));
        if (activeTrack?.id === id) setActiveTrack(data.item);
      }
    } catch (err) {
      console.error('Separate stems failed:', err);
    }
  };

  // Global Audio Playback controls
  const handlePlayTrack = (track: GeneratedAudioItem) => {
    if (activeTrack?.id === track.id) {
      if (isPlaying) {
        audioPlayerRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioPlayerRef.current?.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      setActiveTrack(track);
      setIsPlaying(true);
      setStemMode('mix');
      // Record play count
      fetch('/api/audio/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: track.id }),
      }).catch(() => {});
    }
  };

  const handleNextTrack = () => {
    if (!activeTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === activeTrack.id);
    const nextIndex = (currentIndex + 1) % tracks.length;
    setActiveTrack(tracks[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrevTrack = () => {
    if (!activeTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === activeTrack.id);
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    setActiveTrack(tracks[prevIndex]);
    setIsPlaying(true);
  };

  const handleTimeUpdate = () => {
    if (audioPlayerRef.current) {
      setCurrentTime(audioPlayerRef.current.currentTime);
      setDuration(audioPlayerRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.volume = val;
    }
    if (val === 0) setIsMuted(true);
    else setIsMuted(false);
  };

  const toggleMute = () => {
    if (audioPlayerRef.current) {
      if (isMuted) {
        audioPlayerRef.current.volume = volume || 0.8;
        setIsMuted(false);
      } else {
        audioPlayerRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Determine which audio stream URL to play based on stem mode
  const currentAudioSource =
    stemMode === 'vocals' && activeTrack?.vocalStemUrl
      ? activeTrack.vocalStemUrl
      : stemMode === 'instrumental' && activeTrack?.instrumentalStemUrl
      ? activeTrack.instrumentalStemUrl
      : activeTrack?.audioUrl || '';

  useEffect(() => {
    if (audioPlayerRef.current && isPlaying) {
      audioPlayerRef.current.play().catch(() => {});
    }
  }, [activeTrack, stemMode, isPlaying]);

  if (!isOpen) return null;

  const filteredTracks = tracks.filter((t) => {
    const matchesFav = !filterFavorite || t.isFavorite;
    const matchesSearch =
      !searchQuery ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.styleTags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFav && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#08080c] text-slate-100 font-sans overflow-hidden select-none">
      {/* Hidden Global Audio Element */}
      <audio
        ref={audioPlayerRef}
        src={currentAudioSource}
        loop={isLooping}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleNextTrack}
        autoPlay={isPlaying}
      />

      {/* Main Studio Body: Left Suno Drawer + Right Track Library / Guide */}
      <div className="flex-1 flex overflow-hidden">
        {/* ============================================================== */}
        {/* 1. LEFT DRAWER: EXACT SUNO AI CREATION PANEL                  */}
        {/* ============================================================== */}
        <aside className="w-96 flex-shrink-0 bg-[#0e0f18] border-r border-slate-800/80 flex flex-col h-full z-20 overflow-y-auto custom-scrollbar">
          {/* Header Branding */}
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-[#121320]/70 backdrop-blur sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 p-[1.5px] shadow-lg shadow-orange-500/20">
                <div className="w-full h-full bg-[#0a0b12] rounded-[10px] flex items-center justify-center">
                  <Music className="w-5 h-5 text-amber-400 animate-pulse" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-wide text-white">RaOne Suno</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-semibold">
                    v4 SOTA
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Generative Music & Audio Synthesis</p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-[#191b2c] px-2.5 py-1 rounded-full border border-amber-500/30 text-amber-300 text-xs font-mono font-semibold">
              <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>250</span>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Mode Controls: Custom Mode Toggle & Instrumental Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-[#141624] rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-slate-200">Custom Mode</span>
                </div>
                <button
                  onClick={() => setCustomMode(!customMode)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    customMode ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      customMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-[#141624] rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-200">Instrumental Only</span>
                </div>
                <button
                  onClick={() => setIsInstrumental(!isInstrumental)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    isInstrumental ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      isInstrumental ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Custom Mode: Lyrics & Songwriting AI */}
            {customMode && !isInstrumental ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    Lyrics & Song Structure
                  </label>
                  <button
                    onClick={handleEnhanceLyrics}
                    disabled={isEnhancingLyrics || !prompt.trim()}
                    className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 disabled:opacity-50"
                  >
                    <Wand2 className={`w-3 h-3 ${isEnhancingLyrics ? 'animate-spin' : ''}`} />
                    <span>{isEnhancingLyrics ? 'Writing...' : 'Write Lyrics with AI'}</span>
                  </button>
                </div>
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  rows={6}
                  placeholder="[Verse 1]&#10;Write your lyrics here...&#10;[Chorus]&#10;Add catchy hook...&#10;[Bridge]&#10;Climax of the song..."
                  className="w-full bg-[#07080e] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500/70 font-mono resize-none leading-relaxed"
                />
              </div>
            ) : (
              /* Simple Mode: Song Description */
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Song Description
                  </label>
                  <button
                    onClick={handleRandomizeSongIdea}
                    className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300"
                  >
                    <Dices className="w-3 h-3" />
                    <span>Surprise Me</span>
                  </button>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder="A cinematic 80s synthwave anthem with punchy analog drums, heavy bass, and driving guitar solo..."
                  className="w-full bg-[#07080e] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500/70 resize-none"
                />
              </div>
            )}

            {/* Song Title */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Song Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Neon Horizons of Colombo"
                className="w-full bg-[#07080e] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/70"
              />
            </div>

            {/* Style of Music Tags & Quick Toggles */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Style of Music & Genre Tags
              </label>
              <input
                type="text"
                value={styleInput}
                onChange={(e) => setStyleInput(e.target.value)}
                placeholder="e.g. Synthwave, Cyberpunk, 120 BPM, Melodic Vocals"
                className="w-full bg-[#07080e] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/70"
              />
              {/* Quick Tag Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {GENRE_TAGS.map((tag) => {
                  const active = styleInput.toLowerCase().includes(tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      onClick={() => handleToggleTag(tag)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                        active
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : 'bg-[#141624] text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      +{tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Audio Model Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                AI Music Engine
              </label>
              <div className="space-y-1.5">
                {TTA_MODELS.map((model) => {
                  const active = selectedModel === model.id;
                  return (
                    <div
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        active
                          ? 'bg-[#181a2c] border-amber-500/80 shadow-md shadow-amber-500/10'
                          : 'bg-[#141624]/60 border-slate-800/80 hover:border-slate-700 hover:bg-[#141624]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${active ? 'text-amber-300' : 'text-slate-200'}`}>
                          {model.name}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-gradient-to-r ${model.color} text-white`}
                        >
                          {model.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">{model.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tempo (BPM) & Key Signature Selector */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span>Tempo</span>
                  <span className="font-mono text-amber-400">{bpm} BPM</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="180"
                  step="1"
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Key Signature</label>
                <select
                  value={keySignature}
                  onChange={(e) => setKeySignature(e.target.value)}
                  className="w-full bg-[#07080e] border border-slate-800 rounded-lg p-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/70"
                >
                  {KEY_SIGNATURES.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Primary Create Button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || (!prompt.trim() && !lyrics.trim())}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-98"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Audio Waveforms...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-white" />
                  <span>Create Track</span>
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-mono text-amber-200 border border-amber-400/20">
                    <Zap className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                    10 Credits
                  </span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* ============================================================== */}
        {/* 2. MAIN WORKSPACE: SUNO TRACK FEED & ARCHITECTURE GUIDE        */}
        {/* ============================================================== */}
        <main className="flex-1 flex flex-col h-full bg-[#08080c] overflow-hidden">
          {/* Top Bar Header */}
          <header className="h-14 border-b border-slate-800/80 px-6 flex items-center justify-between bg-[#0e0f18]/60 backdrop-blur z-10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 bg-[#050508] p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveTab('library')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'library'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  My Library ({tracks.length})
                </button>
                <button
                  onClick={() => setActiveTab('architecture')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'architecture'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Silicon Valley TTA Architecture Guide
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tracks, styles, lyrics..."
                  className="bg-[#121320] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 w-56"
                />
              </div>

              <button
                onClick={() => setFilterFavorite(!filterFavorite)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  filterFavorite
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : 'bg-[#141624]/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${filterFavorite ? 'fill-rose-400 text-rose-400' : ''}`} />
                Favorites
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar pb-28">
            {activeTab === 'library' ? (
              <div className="max-w-6xl mx-auto space-y-4">
                {filteredTracks.length === 0 ? (
                  <div className="h-80 flex flex-col items-center justify-center text-center">
                    <Disc3 className="w-12 h-12 text-slate-600 mb-3 animate-spin-slow" />
                    <h3 className="text-base font-bold text-white mb-1">No Tracks Found</h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Use the left panel to create your first hit song with lyrics, beats, and instruments.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTracks.map((track) => {
                      const isCurrent = activeTrack?.id === track.id;
                      const isCurrentlyPlaying = isCurrent && isPlaying;

                      return (
                        <div
                          key={track.id}
                          onClick={() => handlePlayTrack(track)}
                          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 cursor-pointer group ${
                            isCurrent
                              ? 'bg-[#151728] border-amber-500/60 shadow-lg shadow-amber-950/20'
                              : 'bg-[#0f101b] border-slate-800/80 hover:border-slate-700 hover:bg-[#121322]'
                          }`}
                        >
                          {/* Album Art + Play Overlay */}
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-black flex-shrink-0 group/cover">
                              <img
                                src={track.coverUrl}
                                alt={track.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div
                                className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                                  isCurrentlyPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                <div className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg">
                                  {isCurrentlyPlaying ? (
                                    <Pause className="w-4 h-4 fill-black" />
                                  ) : (
                                    <Play className="w-4 h-4 fill-black ml-0.5" />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Title & Metadata */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4
                                  className={`text-sm font-bold truncate ${
                                    isCurrent ? 'text-amber-400' : 'text-white'
                                  }`}
                                >
                                  {track.title}
                                </h4>
                                {track.isInstrumental ? (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 font-mono">
                                    Instrumental
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-500/30 font-mono">
                                    Vocals
                                  </span>
                                )}
                                {track.stemsSeparated && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-500/30 font-mono">
                                    Stems Ready
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                {track.styleTags.slice(0, 3).map((tag, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] px-2 py-0.5 rounded-md bg-[#191b2c] text-slate-300 border border-slate-800"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                <span className="text-[10px] text-slate-500 font-mono">
                                  • {track.bpm} BPM • {track.keySignature}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-400 truncate max-w-lg">
                                {track.lyrics || track.prompt}
                              </p>
                            </div>
                          </div>

                          {/* Interactive Mini Waveform Visualizer */}
                          <div className="hidden lg:flex items-center gap-1 h-8 w-36 px-2 bg-black/40 rounded-lg">
                            {Array.from({ length: 24 }).map((_, i) => {
                              const height = Math.sin(i * 0.5) * 12 + 14;
                              return (
                                <div
                                  key={i}
                                  style={{ height: `${height}px` }}
                                  className={`w-1 rounded-full transition-all ${
                                    isCurrentlyPlaying
                                      ? 'bg-amber-400 animate-pulse'
                                      : 'bg-slate-700'
                                  }`}
                                />
                              );
                            })}
                          </div>

                          {/* Right Utilities & Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-mono text-slate-400 w-12 text-right">
                              {formatTime(track.duration)}
                            </span>

                            {/* View Lyrics */}
                            {track.lyrics && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTrack(track);
                                  setShowLyricsModal(true);
                                }}
                                className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition-colors"
                                title="View Lyrics"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}

                            {/* Separate Stems */}
                            <button
                              onClick={(e) => handleSeparateStems(track.id, e)}
                              className={`p-2 rounded-xl border transition-colors ${
                                track.stemsSeparated
                                  ? 'bg-purple-950/60 text-purple-300 border-purple-500/50'
                                  : 'bg-slate-800/60 hover:bg-slate-700 text-slate-300 border-slate-800'
                              }`}
                              title={
                                track.stemsSeparated
                                  ? 'Stems Separated (Vocals & Instruments)'
                                  : 'Separate Stems (Demucs v4)'
                              }
                            >
                              <Scissors className="w-4 h-4" />
                            </button>

                            {/* Extend Track (+60s) */}
                            <button
                              onClick={(e) => handleExtendTrack(track.id, e)}
                              className={`p-2 rounded-xl border transition-colors ${
                                track.extended
                                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/50'
                                  : 'bg-slate-800/60 hover:bg-slate-700 text-slate-300 border-slate-800'
                              }`}
                              title="Extend Song +60 Seconds"
                            >
                              <FastForward className="w-4 h-4" />
                            </button>

                            {/* Favorite Heart */}
                            <button
                              onClick={(e) => handleToggleFavorite(track.id, e)}
                              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition-colors"
                            >
                              <Heart
                                className={`w-4 h-4 ${
                                  track.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                                }`}
                              />
                            </button>

                            {/* Download MP3 */}
                            <a
                              href={track.audioUrl}
                              download={`${track.title}.mp3`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Download MP3"
                            >
                              <Download className="w-4 h-4" />
                            </a>

                            {/* Delete */}
                            <button
                              onClick={(e) => handleDelete(track.id, e)}
                              className="p-2 rounded-xl bg-slate-800/60 hover:bg-red-950/60 text-slate-400 hover:text-red-400 transition-colors"
                              title="Delete Track"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* ============================================================== */
              /* 3. SILICON VALLEY GRADE TTA ARCHITECTURE EXPLANATION           */
              /* ============================================================== */
              <div className="max-w-4xl mx-auto py-4 space-y-6">
                <div className="bg-gradient-to-r from-amber-950/40 via-orange-950/40 to-rose-950/40 border border-amber-500/40 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Cpu className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        Silicon Valley-Grade Text-to-Audio (TTA) Synthesis Architecture
                      </h2>
                      <p className="text-xs text-amber-300">
                        Inside Suno AI, Udio, Google Lyria AudioLM, and ElevenLabs
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    AI Music Generation (Text-to-Audio / Generative Audio Models) synthesizes full studio-grade acoustic arrangements, human vocalists, and complex melodies in a single unified neural pass. Below is the blueprint of what a production-grade Silicon Valley music generation engine requires:
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-[#111220] border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                      <span className="w-6 h-6 rounded-full bg-amber-950 flex items-center justify-center text-xs font-mono border border-amber-500/40">1</span>
                      Neural Audio Codecs with RVQ (Residual Vector Quantization)
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Raw 48kHz audio contains 48,000 samples per second. Models like EnCodec, SoundStream, and DAC (Descript Audio Codec) compress raw waveforms into discrete acoustic tokens across 8-32 hierarchical quantizer codebooks, reducing token count by 300× while retaining full audio fidelity.
                    </p>
                  </div>

                  <div className="p-4 bg-[#111220] border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                      <span className="w-6 h-6 rounded-full bg-rose-950 flex items-center justify-center text-xs font-mono border border-rose-500/40">2</span>
                      Autoregressive Transformers & Flow Matching
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Suno v4 and Udio use a two-stage architecture: an Autoregressive Transformer generates coarse semantic acoustic tokens (melody & structure), followed by a continuous Flow-Matching Diffusion model that denoises high-frequency spectrograms into pristine 48kHz master audio.
                    </p>
                  </div>

                  <div className="p-4 bg-[#111220] border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                      <span className="w-6 h-6 rounded-full bg-purple-950 flex items-center justify-center text-xs font-mono border border-purple-500/40">3</span>
                      Phoneme Alignment & Lyric Cross-Attention
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      To synchronize singing voices with beats, text lyrics are converted to IPA phoneme tokens. Cross-attention layers in the Transformer map each phoneme to its musical timestamp, ensuring the virtual singer lands exactly on beat without slurring or skipped words.
                    </p>
                  </div>

                  <div className="p-4 bg-[#111220] border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
                      <span className="w-6 h-6 rounded-full bg-cyan-950 flex items-center justify-center text-xs font-mono border border-cyan-500/40">4</span>
                      Deep Stem Isolation (Demucs v4 Hybrid Transformer)
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      After generation, artists need separate tracks for mixing. Neural stem separators (Demucs / MDX-Net) process the stereo mix in time and frequency domains simultaneously, cleanly splitting the audio into isolated Vocals, Drums, Bass, and Synth stems.
                    </p>
                  </div>
                </div>

                <div className="bg-[#0f101b] border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Key Silicon Valley Upgrades for RaOne Suno Audio:
                  </h3>
                  <ul className="text-xs text-slate-300 space-y-2 list-disc pl-5 leading-relaxed">
                    <li>
                      <strong className="text-white">Karaoke Real-Time Phoneme Highlighting:</strong> Synchronize the lyrics view with the audio playback cursor so words glow in real time.
                    </li>
                    <li>
                      <strong className="text-white">Multi-Stem Mixing Console:</strong> Provide separate volume faders for Vocals, Bass, Drums, and Melodies directly in the bottom player dock.
                    </li>
                    <li>
                      <strong className="text-white">Audio Inpainting / Section Replace:</strong> Allow creators to highlight a 5-second guitar solo or vocal line and re-generate just that bar without changing the rest of the song.
                    </li>
                    <li>
                      <strong className="text-white">Custom Voice Cloning:</strong> Upload a 10-second vocal sample to sing the user's generated songs with personalized voice timbre.
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ============================================================== */}
      {/* 4. PERSISTENT GLOBAL SUNO BOTTOM PLAYER DOCK                   */}
      {/* ============================================================== */}
      {activeTrack && (
        <div className="h-20 bg-[#0d0e19] border-t border-slate-800/80 px-6 flex items-center justify-between z-30 shadow-2xl relative">
          {/* Left: Track Info & Cover */}
          <div className="flex items-center gap-3 w-72 min-w-0">
            <img
              src={activeTrack.coverUrl}
              alt={activeTrack.title}
              className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-slate-700 shadow-md"
            />
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white truncate">{activeTrack.title}</h4>
              <p className="text-[10px] text-amber-400 truncate">{activeTrack.model}</p>
            </div>
            <button
              onClick={(e) => handleToggleFavorite(activeTrack.id, e)}
              className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors flex-shrink-0"
            >
              <Heart
                className={`w-4 h-4 ${
                  activeTrack.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
            </button>
          </div>

          {/* Center: Playback Controls & Progress Scrubber */}
          <div className="flex-1 max-w-2xl px-4 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsLooping(!isLooping)}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  isLooping ? 'text-amber-400' : 'text-slate-500 hover:text-white'
                }`}
                title="Loop Track"
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handlePrevTrack}
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
                title="Previous Track"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => handlePlayTrack(activeTrack)}
                className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center shadow-lg transition-transform active:scale-95"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
              </button>

              <button
                onClick={handleNextTrack}
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
                title="Next Track"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Stem Switcher Pill */}
              {activeTrack.stemsSeparated && (
                <div className="flex items-center bg-[#07080e] p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                  <button
                    onClick={() => setStemMode('mix')}
                    className={`px-2 py-0.5 rounded ${
                      stemMode === 'mix' ? 'bg-amber-500 text-black font-bold' : 'text-slate-400'
                    }`}
                  >
                    Mix
                  </button>
                  <button
                    onClick={() => setStemMode('vocals')}
                    className={`px-2 py-0.5 rounded ${
                      stemMode === 'vocals' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    Vocals
                  </button>
                  <button
                    onClick={() => setStemMode('instrumental')}
                    className={`px-2 py-0.5 rounded ${
                      stemMode === 'instrumental' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400'
                    }`}
                  >
                    Inst
                  </button>
                </div>
              )}
            </div>

            {/* Scrubber Bar */}
            <div className="w-full flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-400 w-9 text-right">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min="0"
                max={duration || activeTrack.duration || 180}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <span className="text-[10px] font-mono text-slate-400 w-9">
                {formatTime(duration || activeTrack.duration || 180)}
              </span>
            </div>
          </div>

          {/* Right: Volume & Extra Utilities */}
          <div className="flex items-center gap-3 w-72 justify-end">
            {activeTrack.lyrics && (
              <button
                onClick={() => setShowLyricsModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#191b2c] hover:bg-[#23263e] text-xs text-amber-300 font-medium transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Lyrics</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-slate-400 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            <a
              href={activeTrack.audioUrl}
              download={`${activeTrack.title}.mp3`}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Download MP3"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. LYRICS MODAL DRAWER                                         */}
      {/* ============================================================== */}
      {showLyricsModal && activeTrack && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-xl bg-[#10111d] border border-amber-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-[#151728]">
              <div className="flex items-center gap-3">
                <img
                  src={activeTrack.coverUrl}
                  alt={activeTrack.title}
                  className="w-10 h-10 rounded-lg object-cover"
                />
                <div>
                  <h3 className="text-sm font-bold text-white">{activeTrack.title}</h3>
                  <p className="text-[11px] text-amber-400 font-mono">
                    Lyrics & Song Structure
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(activeTrack.lyrics || '', 'lyrics')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1e2035] hover:bg-[#282b48] text-slate-300 text-xs font-medium"
                >
                  {copyFeedback === 'lyrics' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Copy</span>
                </button>
                <button
                  onClick={() => setShowLyricsModal(false)}
                  className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar bg-[#0b0c14]">
              <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                {activeTrack.lyrics}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SunoAudioStudio;
