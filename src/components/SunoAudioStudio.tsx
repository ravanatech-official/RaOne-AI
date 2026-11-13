import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Download,
  Trash2,
  Heart,
  Dices,
  Music,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Repeat,
  Scissors,
  FastForward,
  Cpu,
  Wand2,
  Search,
  Mic,
  Disc3,
} from 'lucide-react';
import { GeneratedAudioItem, ClonedVoiceProfile } from '../types/index.ts';
import {
  UnifiedStudioWorkspace,
  WorkspaceTurn,
  WorkspaceRightTab,
} from './UnifiedStudioWorkspace';

interface SunoAudioStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

const TTA_MODELS = [
  { id: 'Suno v4 Alpha (RVQ DiT)', label: 'Suno v4 Alpha', description: '48kHz stereo master & expressive vocals' },
  { id: 'Suno v3.5 SOTA', label: 'Suno v3.5', description: 'Radio song structure & transitions' },
  { id: 'Udio 130 Clarity Pro', label: 'Udio 130 Pro', description: 'High dynamic range vocal synthesis' },
  { id: 'Google Lyria AudioLM', label: 'Google Lyria', description: 'Hierarchical acoustic token conditioning' },
  { id: 'ElevenLabs Music/Voice Pro', label: 'ElevenLabs Voice', description: 'Voiceovers & spoken storytelling' },
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
];

const RANDOM_SONG_IDEAS = [
  {
    title: 'Quantum Horizon',
    prompt: 'Upbeat 80s synthwave anthem with pulsating basslines, glittering analog synths, and emotive vocals.',
    style: 'Synthwave, Retro Electro',
  },
  {
    title: 'Monsoon in Kandy',
    prompt: 'Soothing lo-fi chillhop with organic rain sounds, mellow Rhodes keyboard chords, and warm acoustic guitar.',
    style: 'Lo-Fi Chill, Study Beats',
  },
  {
    title: 'Thunder over Sigiriya',
    prompt: 'Epic cinematic orchestral hybrid with traditional Sri Lankan geta bera drums, brass horns, and choir.',
    style: 'Cinematic Orchestral, Choir',
  },
];

export const SunoAudioStudio: React.FC<SunoAudioStudioProps> = ({
  isOpen,
  onClose,
}) => {
  const [rightTab, setRightTab] = useState<WorkspaceRightTab>('preview');
  const [customMode, setCustomMode] = useState<boolean>(true);
  const [isInstrumental, setIsInstrumental] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>('');
  const [lyrics, setLyrics] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('Suno v4 Alpha (RVQ DiT)');
  const [styleInput, setStyleInput] = useState<string>('Synthwave, Cyberpunk, Retro Electro');
  const [bpm, setBpm] = useState<number>(120);
  const [keySignature, setKeySignature] = useState<string>('D Minor');

  const [tracks, setTracks] = useState<GeneratedAudioItem[]>([]);
  const [activeTrack, setActiveTrack] = useState<GeneratedAudioItem | null>(null);
  const [turns, setTurns] = useState<WorkspaceTurn[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEnhancingLyrics, setIsEnhancingLyrics] = useState<boolean>(false);
  const [filterFavorite, setFilterFavorite] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [stemMode, setStemMode] = useState<
    'mix' | 'vocals' | 'bass' | 'drums' | 'synths' | 'instrumental'
  >('mix');

  const [clonedVoices, setClonedVoices] = useState<ClonedVoiceProfile[]>([]);
  const [selectedVoiceClone, setSelectedVoiceClone] = useState<ClonedVoiceProfile | null>(null);
  const [newCloneName, setNewCloneName] = useState<string>('Studio Vocal');
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);

  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const fetchAudioHistory = async () => {
    try {
      const res = await fetch('/api/audio/history');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setTracks(data.items);
      }
    } catch {
      // ignore
    }
  };

  const fetchVoiceClones = async () => {
    try {
      const res = await fetch('/api/audio/voice-clone/list');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setClonedVoices(data.items);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAudioHistory();
      fetchVoiceClones();
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();
    if ((!cleanPrompt && !lyrics.trim()) || isLoading) return;

    const startMs = Date.now();
    const userDisplay = cleanPrompt || `Generate track: ${title || 'Custom Lyrics'}`;
    setTurns((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', content: userDisplay },
    ]);
    setPrompt('');
    setIsLoading(true);

    try {
      const tags = styleInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/audio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanPrompt || title || 'Studio Audio Composition',
          lyrics: isInstrumental ? '' : lyrics,
          title: title || cleanPrompt.slice(0, 32) || 'Untitled Track',
          styleTags: tags,
          model: selectedModel,
          isInstrumental,
          bpm,
          keySignature,
          duration: 180,
          clonedVoiceName: selectedVoiceClone?.name,
          clonedVoiceId: selectedVoiceClone?.id,
        }),
      });
      const data = await res.json();
      const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
      if (data.success && data.track) {
        setTracks((prev) => [data.track, ...prev]);
        setActiveTrack(data.track);
        setIsPlaying(true);
        setRightTab('preview');
        setTurns((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            modelLabel: selectedModel,
            durationSec: elapsed,
            content: `Synthesized "${data.track.title}" (${bpm} BPM · ${keySignature}).`,
            details: [
              `Tags: ${data.track.styleTags?.join(', ') || styleInput}`,
              isInstrumental ? 'Instrumental Arrangement' : 'Vocals + Full Mix',
            ],
          },
        ]);
        setTimeout(() => {
          audioPlayerRef.current?.play().catch(() => {});
        }, 100);
      } else {
        showToast(data?.error || 'Track synthesis failed.');
      }
    } catch {
      showToast('Audio generation error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnhanceLyrics = async () => {
    if (!prompt.trim() || isEnhancingLyrics) return;
    setIsEnhancingLyrics(true);
    try {
      const res = await fetch('/api/audio/enhance-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style: styleInput,
          title: title || prompt.slice(0, 28),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.lyrics) {
        setLyrics(data.lyrics);
        setCustomMode(true);
        showToast('Lyrics generated into editor.');
      } else {
        showToast(data?.error || 'Lyrics generation unavailable.');
      }
    } catch {
      showToast('Lyrics generation failed.');
    } finally {
      setIsEnhancingLyrics(false);
    }
  };

  const handleSaveVoiceClone = async () => {
    setIsRecordingVoice(true);
    try {
      const res = await fetch('/api/audio/voice-clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCloneName || 'Studio Vocal',
          sampleDuration: 10,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.clone) {
        setClonedVoices((prev) => [data.clone, ...prev]);
        setSelectedVoiceClone(data.clone);
        showToast(`Voice profile "${data.clone.name}" created.`);
      } else {
        showToast(data?.error || 'Voice cloning requires an external voice synthesis worker.');
      }
    } catch {
      showToast('Voice cloning failed.');
    } finally {
      setIsRecordingVoice(false);
    }
  };

  const handleToggleFavorite = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch('/api/audio/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setTracks((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, isFavorite: data.item.isFavorite } : t
          )
        );
        if (activeTrack?.id === id) {
          setActiveTrack((prev) =>
            prev ? { ...prev, isFavorite: data.item.isFavorite } : null
          );
        }
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
          setActiveTrack(null);
          setIsPlaying(false);
        }
        showToast('Track deleted.');
      }
    } catch {
      showToast('Delete failed.');
    }
  };

  const handleTrackOp = async (
    endpoint: 'extend' | 'separate-stems',
    id: string,
    label: string
  ) => {
    showToast(`Running ${label}...`);
    try {
      const res = await fetch(`/api/audio/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.item) {
        setTracks((prev) => prev.map((t) => (t.id === id ? data.item : t)));
        if (activeTrack?.id === id) setActiveTrack(data.item);
        showToast(`${label} complete.`);
      } else {
        showToast(data?.error || `${label} requires an external audio DSP/Demucs worker.`);
      }
    } catch {
      showToast(`${label} failed.`);
    }
  };

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
      fetch('/api/audio/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: track.id }),
      }).catch(() => {});
      setTimeout(() => {
        audioPlayerRef.current?.play().catch(() => {});
      }, 80);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const downloadTrack = (track: GeneratedAudioItem) => {
    const a = document.createElement('a');
    a.href = track.audioUrl;
    a.download = `${track.title}.mp3`;
    a.click();
  };

  const previewContent = activeTrack ? (
    <div className="p-5 md:p-6 max-w-4xl mx-auto space-y-5">
      <audio
        ref={audioPlayerRef}
        src={activeTrack.audioUrl}
        loop={isLooping}
        onTimeUpdate={() => {
          if (audioPlayerRef.current) {
            setCurrentTime(audioPlayerRef.current.currentTime);
            setDuration(audioPlayerRef.current.duration || 0);
          }
        }}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Track Header Card */}
      <div className="p-5 rounded-2xl bg-[#18191C] border border-[#282A2E] flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="relative w-28 h-28 rounded-xl overflow-hidden bg-black shrink-0 border border-[#2C2D30]">
          <img
            src={activeTrack.coverUrl}
            alt={activeTrack.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => handlePlayTrack(activeTrack)}
            className="absolute inset-0 bg-black/40 hover:bg-black/55 flex items-center justify-center transition-colors"
          >
            <div className="w-11 h-11 rounded-full bg-[#E3E3E3] text-[#131314] flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </div>
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-2 w-full">
          <div>
            <h2 className="text-lg font-semibold text-white truncate">{activeTrack.title}</h2>
            <p className="text-xs text-[#9AA0A6] tabular-nums">
              {activeTrack.model} · {activeTrack.bpm} BPM · {activeTrack.keySignature} ·{' '}
              {activeTrack.isInstrumental ? 'Instrumental' : 'Vocals'}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px] text-[#9AA0A6]">
            {activeTrack.styleTags?.map((tag, i) => (
              <span key={i}>
                {i > 0 && '· '}
                {tag}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => handleTrackOp('separate-stems', activeTrack.id, 'Stem Separation')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>{activeTrack.stemsSeparated ? 'Stems Ready' : 'Separate Stems'}</span>
            </button>
            <button
              onClick={() => handleTrackOp('extend', activeTrack.id, 'Extend +60s')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Extend +60s</span>
            </button>
            <button
              onClick={() => handleToggleFavorite(activeTrack.id)}
              className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#E3E3E3]"
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  activeTrack.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
            </button>
            <button
              onClick={() => downloadTrack(activeTrack)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2B2D30] hover:bg-[#383A40] text-xs font-medium text-white"
            >
              <Download className="w-3.5 h-3.5" />
              <span>MP3</span>
            </button>
            <button
              onClick={() => handleDelete(activeTrack.id)}
              className="p-1.5 rounded-lg bg-[#252629] hover:bg-red-950/60 text-[#9AA0A6] hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stem Channel Switcher */}
      <div className="flex flex-wrap items-center gap-1.5 bg-[#161719] border border-[#252629] rounded-xl p-2">
        {(['mix', 'vocals', 'drums', 'bass', 'synths', 'instrumental'] as const).map((stem) => (
          <button
            key={stem}
            onClick={() => setStemMode(stem)}
            className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
              stemMode === stem
                ? 'bg-[#2B2D30] text-white'
                : 'text-[#8E918F] hover:text-white'
            }`}
          >
            {stem}
          </button>
        ))}
      </div>

      {/* Lyrics / Prompt Display */}
      <div className="p-5 rounded-2xl bg-[#161719] border border-[#252629] space-y-2">
        <div className="text-xs font-medium text-[#9AA0A6]">
          {activeTrack.lyrics ? 'Lyrics & Arrangement' : 'Prompt Description'}
        </div>
        <pre className="whitespace-pre-wrap font-sans text-xs text-[#E3E3E3] leading-relaxed select-text">
          {activeTrack.lyrics || activeTrack.prompt}
        </pre>
      </div>
    </div>
  ) : null;

  const bottomDockContent = activeTrack ? (
    <div className="px-4 py-2.5 flex items-center gap-4">
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => {
            if (!tracks.length) return;
            const idx = tracks.findIndex((t) => t.id === activeTrack.id);
            const prevTrack = tracks[(idx - 1 + tracks.length) % tracks.length];
            handlePlayTrack(prevTrack);
          }}
          className="p-1 text-[#9AA0A6] hover:text-white"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={() => handlePlayTrack(activeTrack)}
          className="w-8 h-8 rounded-full bg-[#E3E3E3] hover:bg-white text-[#131314] flex items-center justify-center"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
        <button
          onClick={() => {
            if (!tracks.length) return;
            const idx = tracks.findIndex((t) => t.id === activeTrack.id);
            const nextTrack = tracks[(idx + 1) % tracks.length];
            handlePlayTrack(nextTrack);
          }}
          className="p-1 text-[#9AA0A6] hover:text-white"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-mono text-[#9AA0A6] tabular-nums">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min="0"
          max={duration || activeTrack.duration || 180}
          value={currentTime}
          onChange={(e) => {
            const val = Number(e.target.value);
            setCurrentTime(val);
            if (audioPlayerRef.current) audioPlayerRef.current.currentTime = val;
          }}
          className="flex-1 accent-[#8AB4F8]"
        />
        <span className="text-[11px] font-mono text-[#9AA0A6] tabular-nums">
          {formatTime(duration || activeTrack.duration)}
        </span>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <button
          onClick={() => setIsLooping(!isLooping)}
          className={`p-1 rounded ${isLooping ? 'text-[#8AB4F8]' : 'text-[#8E918F] hover:text-white'}`}
          title="Repeat"
        >
          <Repeat className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            if (!audioPlayerRef.current) return;
            if (isMuted) {
              audioPlayerRef.current.volume = volume || 0.85;
              setIsMuted(false);
            } else {
              audioPlayerRef.current.volume = 0;
              setIsMuted(true);
            }
          }}
          className="p-1 text-[#9AA0A6] hover:text-white"
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  ) : null;

  const codeContent = (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-2">
        <span className="text-xs font-medium text-white block">
          Audio Synthesis Parameters & Lyrics Spec
        </span>
        <pre className="font-mono text-xs text-[#D4D7DD] bg-[#111214] p-3.5 rounded-lg border border-[#252629] overflow-x-auto">
          {JSON.stringify(
            activeTrack || {
              model: selectedModel,
              title: title || 'Untitled Track',
              styleTags: styleInput,
              bpm,
              keySignature,
              isInstrumental,
              customMode,
            },
            null,
            2
          )}
        </pre>
      </div>

      <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-white">
          <Cpu className="w-4 h-4 text-[#8AB4F8]" />
          <span>Neural Audio Synthesis Architecture</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#9AA0A6]">
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">1. RVQ Neural Audio Codecs</div>
            Compresses 48kHz audio into discrete multi-codebook acoustic tokens.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">2. Autoregressive + Flow Matching</div>
            Two-stage melody structure and high-frequency spectrogram denoising.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">3. IPA Phoneme Alignment</div>
            Aligns vocal syllables cleanly to tempo and measure boundaries.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">4. Demucs v4 Stem Separation</div>
            Isolates Vocals, Drums, Bass, and Synths cleanly from stereo mix.
          </div>
        </div>
      </div>
    </div>
  );

  const filteredTracks = tracks.filter((t) => {
    const matchFav = !filterFavorite || t.isFavorite;
    const matchSearch =
      !searchQuery.trim() ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFav && matchSearch;
  });

  const filesContent = (
    <div className="p-5 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#252629] pb-3">
        <div className="flex items-center gap-1 bg-[#1B1C1E] p-0.5 rounded-lg border border-[#2C2D30]">
          <button
            onClick={() => setFilterFavorite(false)}
            className={`px-3 py-1 rounded-md text-xs font-medium ${
              !filterFavorite ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F] hover:text-white'
            }`}
          >
            All Tracks ({tracks.length})
          </button>
          <button
            onClick={() => setFilterFavorite(true)}
            className={`px-3 py-1 rounded-md text-xs font-medium ${
              filterFavorite ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F] hover:text-white'
            }`}
          >
            Favorites ({tracks.filter((t) => t.isFavorite).length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#8E918F] absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks..."
            className="bg-[#1B1C1E] border border-[#2C2D30] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#E3E3E3] placeholder-[#6E7075] focus:outline-none w-56"
          />
        </div>
      </div>

      {filteredTracks.length === 0 ? (
        <div className="py-16 text-center text-xs text-[#8E918F]">
          <Disc3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No tracks found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTracks.map((track) => (
            <div
              key={track.id}
              onClick={() => {
                handlePlayTrack(track);
                setRightTab('preview');
              }}
              className="p-3 rounded-xl bg-[#18191B] border border-[#27292D] hover:border-[#42454C] transition-colors cursor-pointer flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-lg object-cover bg-black shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{track.title}</div>
                  <div className="text-[11px] text-[#8E918F] truncate tabular-nums">
                    {track.bpm} BPM · {track.keySignature} · {formatTime(track.duration)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => handleToggleFavorite(track.id, e)}
                  className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-rose-400"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      track.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                    }`}
                  />
                </button>
                <button
                  onClick={(e) => handleDelete(track.id, e)}
                  className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const editDrawerContent = (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-[#1B1C1E] border border-[#2C2D30] space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#E3E3E3]">Custom Lyrics Mode</span>
          <button
            onClick={() => setCustomMode(!customMode)}
            className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors ${
              customMode ? 'bg-[#8AB4F8] justify-end' : 'bg-[#34363A] justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-[#131314]" />
          </button>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-[#282A2E]">
          <span className="text-[#E3E3E3]">Instrumental Only</span>
          <button
            onClick={() => setIsInstrumental(!isInstrumental)}
            className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors ${
              isInstrumental ? 'bg-[#8AB4F8] justify-end' : 'bg-[#34363A] justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-[#131314]" />
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#C4C7C5] block mb-1">Track Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Track"
          className="w-full bg-[#1E1F20] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
        />
      </div>

      {customMode && !isInstrumental && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-[#C4C7C5]">Lyrics</label>
            <button
              onClick={handleEnhanceLyrics}
              disabled={!prompt.trim() || isEnhancingLyrics}
              className="text-[11px] text-[#8AB4F8] hover:underline disabled:opacity-50"
            >
              {isEnhancingLyrics ? 'Writing...' : 'AI Write Lyrics'}
            </button>
          </div>
          <textarea
            rows={5}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="[Verse 1]..."
            className="w-full bg-[#1E1F20] border border-[#2F3135] rounded-lg p-2 text-xs text-[#E3E3E3] focus:outline-none resize-none font-mono"
          />
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-[#C4C7C5] block mb-1">Style Tags</label>
        <input
          type="text"
          value={styleInput}
          onChange={(e) => setStyleInput(e.target.value)}
          className="w-full bg-[#1E1F20] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
        />
        <div className="flex flex-wrap gap-1 mt-2">
          {GENRE_TAGS.slice(0, 6).map((tag) => (
            <button
              key={tag}
              onClick={() => {
                const list = styleInput.split(',').map((s) => s.trim()).filter(Boolean);
                setStyleInput(
                  list.includes(tag)
                    ? list.filter((x) => x !== tag).join(', ')
                    : [...list, tag].join(', ')
                );
              }}
              className="px-2 py-0.5 rounded bg-[#1E1F20] hover:bg-[#2B2D30] border border-[#2F3135] text-[11px] text-[#C4C7C5]"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-[#C4C7C5] block mb-1">
            BPM ({bpm})
          </label>
          <input
            type="range"
            min="60"
            max="180"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-full accent-[#8AB4F8]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#C4C7C5] block mb-1">Key</label>
          <select
            value={keySignature}
            onChange={(e) => setKeySignature(e.target.value)}
            className="w-full bg-[#1E1F20] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
          >
            {KEY_SIGNATURES.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-[#1B1C1E] border border-[#2C2D30] space-y-2">
        <div className="text-xs font-medium text-white flex items-center gap-1.5">
          <Mic className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Voice Clone Profile</span>
        </div>
        {clonedVoices.length > 0 && (
          <select
            value={selectedVoiceClone?.id || ''}
            onChange={(e) =>
              setSelectedVoiceClone(
                clonedVoices.find((v) => v.id === e.target.value) || null
              )
            }
            className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
          >
            <option value="">Default Studio Vocalist</option>
            {clonedVoices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newCloneName}
            onChange={(e) => setNewCloneName(e.target.value)}
            placeholder="Voice name"
            className="flex-1 bg-[#131314] border border-[#2F3135] rounded-lg px-2 py-1 text-xs text-white"
          />
          <button
            onClick={handleSaveVoiceClone}
            disabled={isRecordingVoice}
            className="px-2.5 py-1 rounded-lg bg-[#2B2D30] hover:bg-[#383A40] text-xs text-white shrink-0"
          >
            {isRecordingVoice ? 'Saving...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );

  const composerAddContent = (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={handleEnhanceLyrics}
          disabled={!prompt.trim() || isEnhancingLyrics}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3] disabled:opacity-50"
        >
          <Wand2 className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>{isEnhancingLyrics ? 'Writing...' : 'Generate Lyrics'}</span>
        </button>

        <button
          onClick={() => {
            const idea =
              RANDOM_SONG_IDEAS[
                Math.floor(Math.random() * RANDOM_SONG_IDEAS.length)
              ];
            setTitle(idea.title);
            setPrompt(idea.prompt);
            setStyleInput(idea.style);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <Dices className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Song Idea</span>
        </button>

        <button
          onClick={() => setIsInstrumental(!isInstrumental)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
            isInstrumental
              ? 'bg-[#2B2D30] border-[#8AB4F8] text-white'
              : 'bg-[#252629] border-[#35373B] text-[#E3E3E3]'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          <span>Instrumental: {isInstrumental ? 'On' : 'Off'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <UnifiedStudioWorkspace
      isOpen={isOpen}
      onBackToStart={onClose}
      moduleName="RaOne Suno Audio"
      workspaceTitle={activeTrack ? activeTrack.title : 'Untitled Workspace'}
      modelOptions={TTA_MODELS}
      selectedModel={selectedModel}
      onSelectModel={setSelectedModel}
      prompt={prompt}
      onPromptChange={setPrompt}
      onSubmitPrompt={handleGenerate}
      isGenerating={isLoading}
      turns={turns}
      onResetWorkspace={() => {
        setActiveTrack(null);
        setIsPlaying(false);
        setTurns([]);
        setPrompt('');
        setRightTab('preview');
        showToast('Started empty workspace.');
      }}
      rightTab={rightTab}
      onRightTabChange={setRightTab}
      routePath={activeTrack ? `/audio/${activeTrack.id}` : '/'}
      onRefresh={fetchAudioHistory}
      onRemix={() => {
        if (activeTrack) {
          setTitle(`${activeTrack.title} Remix`);
          setPrompt(activeTrack.prompt);
          setLyrics(activeTrack.lyrics || '');
          setStyleInput(activeTrack.styleTags?.join(', ') || styleInput);
          showToast('Track parameters loaded for remix.');
        } else {
          const idea = RANDOM_SONG_IDEAS[0];
          setTitle(idea.title);
          setPrompt(idea.prompt);
          showToast('Sample song idea loaded.');
        }
      }}
      onShare={() => {
        if (activeTrack) {
          navigator.clipboard?.writeText(activeTrack.prompt).catch(() => {});
          showToast('Track prompt copied.');
        } else {
          showToast('Workspace ready.');
        }
      }}
      onPublish={() => {
        if (activeTrack) {
          downloadTrack(activeTrack);
        } else {
          showToast('Generate or select a track first.');
        }
      }}
      publishLabel="Download"
      filesCount={tracks.length}
      hasActiveItem={!!activeTrack}
      previewContent={previewContent}
      codeContent={codeContent}
      filesContent={filesContent}
      editDrawerContent={editDrawerContent}
      composerAddContent={composerAddContent}
      bottomDockContent={bottomDockContent}
      emptyStateTitle="Empty Workspace"
      emptyStateSubtitle="Describe a song, beat, or voiceover on the left, or browse saved tracks."
      emptyStateActionLabel="Open Files"
      onEmptyStateAction={() => setRightTab('files')}
      toastMessage={toastMessage}
    />
  );
};
