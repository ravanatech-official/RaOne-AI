import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Dices,
  Music,
  Wand2,
  Search,
  Heart,
  Upload,
  Sparkles,
  Disc3,
  Trash2,
} from 'lucide-react';
import {
  DEFAULT_MUSIC_CONFIG,
  type MusicConfig,
  type MusicDspSettings,
  type MusicEditPreset,
} from '../types/music.ts';
import type { GeneratedAudioItem, ClonedVoiceProfile } from '../types/index.ts';
import {
  UnifiedStudioWorkspace,
  type WorkspaceTurn,
  type WorkspaceRightTab,
} from './UnifiedStudioWorkspace';
import { MusicConfigDrawer } from './MusicConfigDrawer';
import { MusicTrackStage } from './MusicTrackStage';
import {
  fetchUniversalSettings,
  subscribeUniversalSettings,
} from '../utils/settingsClient.ts';

interface SunoAudioStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

const TTA_MODELS = [
  {
    id: 'Google Lyria 3 Pro (Full Track)',
    label: 'Lyria 3 Pro',
    description: 'Full-length vocals, lyrics & stereo orchestration',
  },
  {
    id: 'Google Lyria 3 Clip (Fast 30s)',
    label: 'Lyria 3 Clip',
    description: 'Rapid 30s musical motifs & hooks',
  },
  {
    id: 'Suno v4 Profile (Lyria Bridged)',
    label: 'Suno v4 Style',
    description: 'Radio verse-chorus arrangement preset',
  },
  {
    id: 'Udio 130 Clarity Profile',
    label: 'Udio 130 Pro',
    description: 'Dynamic vocal & instrument separation preset',
  },
];

const RANDOM_SONG_IDEAS = [
  {
    title: 'Neon Colombo',
    prompt: 'Upbeat futuristic synthwave pop blending cybernetic basslines, warm 80s neon arpeggios, and bright modern vocals',
    style: 'Synthwave, Electronic Pop, Analog Bass',
    bpm: 122,
    key: 'D Minor',
  },
  {
    title: 'Monsoon Over Kandy',
    prompt: 'Soothing Sri Lankan rainy afternoon fusion with soft geta bera groove, bansuri flute, dusty Rhodes keys, and rain ambience',
    style: 'Lo-Fi Chillhop, Sri Lankan Fusion, Acoustic',
    bpm: 84,
    key: 'G Major',
  },
  {
    title: 'Midnight Baila',
    prompt: 'High-energy 6/8 Baila electro fusion with punchy brass horns, festive acoustic guitars, and modern club 808s',
    style: 'Sri Lankan Baila Fusion, Club Brass, Dance',
    bpm: 132,
    key: 'A Minor',
  },
  {
    title: 'Fortress of Cloud',
    prompt: 'Grand orchestral trailer score with sweeping string ensembles, thunderous war drums, and ethereal choir swells',
    style: 'Cinematic Orchestral Hybrid, Epic Choir',
    bpm: 100,
    key: 'C Minor',
  },
];

export const SunoAudioStudio: React.FC<SunoAudioStudioProps> = ({
  isOpen,
  onClose,
}) => {
  const [rightTab, setRightTab] = useState<WorkspaceRightTab>('preview');
  const [prompt, setPrompt] = useState('');
  const [enhancedFromPrompt, setEnhancedFromPrompt] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [styleInput, setStyleInput] = useState('Synthwave, Electronic Pop, Analog Bass');
  const [config, setConfig] = useState<MusicConfig>(DEFAULT_MUSIC_CONFIG);

  const [tracks, setTracks] = useState<GeneratedAudioItem[]>([]);
  const [activeTrack, setActiveTrack] = useState<GeneratedAudioItem | null>(null);
  const [turns, setTurns] = useState<WorkspaceTurn[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isPostBusy, setIsPostBusy] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [isEnhancingLyrics, setIsEnhancingLyrics] = useState(false);

  const [libraryFilter, setLibraryFilter] = useState<'all' | 'favorites' | 'uploads' | 'remixes'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [clonedVoices, setClonedVoices] = useState<ClonedVoiceProfile[]>([]);
  const [selectedVoiceClone, setSelectedVoiceClone] = useState<ClonedVoiceProfile | null>(null);
  const [isCreatingVoice, setIsCreatingVoice] = useState(false);

  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const quickAudioUploadRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const fetchAudioHistory = async () => {
    try {
      const res = await fetch('/api/audio/history');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setTracks(data.items);
      }
    } catch {
      // ignore transient errors
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
      // ignore transient errors
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchAudioHistory();
    fetchVoiceClones();
    fetchUniversalSettings()
      .then((profile) => {
        if (profile?.studioDefaults?.music) {
          setConfig((prev) => ({ ...prev, ...profile.studioDefaults.music }));
        }
      })
      .catch(() => {});

    return subscribeUniversalSettings((profile) => {
      if (profile?.studioDefaults?.music) {
        setConfig((prev) => ({ ...prev, ...profile.studioDefaults.music }));
      }
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || tracks.length === 0) return;
    const pending = (window as any).__RAONE_PENDING_ASSET__;
    if (pending && pending.studio === 'music' && pending.rawId) {
      const match = tracks.find((t) => t.id === pending.rawId);
      if (match) {
        setActiveTrack(match);
        setRightTab('preview');
        delete (window as any).__RAONE_PENDING_ASSET__;
      }
    }
  }, [isOpen, tracks]);

  const versionTree = useMemo(() => {
    if (!activeTrack) return [];
    const rootKey = activeTrack.rootId || activeTrack.id;
    return tracks
      .filter((t) => (t.rootId || t.id) === rootKey)
      .sort((a, b) => Number(a.version || 1) - Number(b.version || 1));
  }, [activeTrack, tracks]);

  const handleModelChange = (modelId: string) => {
    const isClip = modelId.toLowerCase().includes('clip');
    setConfig((prev) => ({
      ...prev,
      model: modelId,
      enginePreference: isClip ? 'lyria-3-clip-preview' : 'lyria-3-pro-preview',
    }));
  };

  const handleEnhancePrompt = async () => {
    const seed = prompt.trim();
    if (!seed || isEnhancingPrompt) return;
    setIsEnhancingPrompt(true);
    try {
      const res = await fetch('/api/audio/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: seed,
          enhancerMode: config.enhancerMode,
          musicConfig: config,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.enhancedPrompt) {
        setEnhancedFromPrompt(seed);
        setPrompt(data.enhancedPrompt);
        if (data.suggestedTitle && !title.trim()) setTitle(data.suggestedTitle);
        if (data.suggestedLyrics && config.vocal.mode !== 'instrumental') {
          setLyrics(data.suggestedLyrics);
        }
        if (Array.isArray(data.suggestedStyleTags) && data.suggestedStyleTags.length) {
          setStyleInput(data.suggestedStyleTags.join(', '));
        }
        setConfig((prev) => ({
          ...prev,
          bpm: Number(data.suggestedBpm) || prev.bpm,
          keySignature: data.suggestedKey || prev.keySignature,
          negativePrompt: data.suggestedNegativePrompt || prev.negativePrompt,
        }));
        setTurns((prev) => [
          ...prev,
          {
            id: `enh_${Date.now()}`,
            role: 'assistant',
            modelLabel: data.providerUsed || 'Producer Architect',
            content: `Expanded "${seed}" into full song blueprint (${data.suggestedBpm || config.bpm} BPM · ${data.suggestedKey || config.keySignature}).`,
            details: [
              data.breakdown?.arrangement ? `Structure: ${data.breakdown.arrangement}` : '',
              data.breakdown?.instrumentation ? `Instruments: ${data.breakdown.instrumentation}` : '',
            ].filter(Boolean),
          },
        ]);
        showToast('Prompt, title, BPM, key & lyrics enhanced.');
      } else {
        showToast(data?.error || 'Could not enhance prompt.');
      }
    } catch {
      showToast('Prompt enhancer failed.');
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  const handleEnhanceLyrics = async () => {
    const seed = (prompt || title).trim();
    if (!seed || isEnhancingLyrics) {
      showToast('Enter a song idea or title first.');
      return;
    }
    setIsEnhancingLyrics(true);
    try {
      const res = await fetch('/api/audio/enhance-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: seed,
          style: styleInput,
          title: title || seed.slice(0, 28),
          language: config.vocal.language,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.lyrics) {
        setLyrics(data.lyrics);
        showToast('Structured lyrics written.');
      } else {
        showToast(data?.error || 'Lyrics writer unavailable.');
      }
    } catch {
      showToast('Lyrics generation failed.');
    } finally {
      setIsEnhancingLyrics(false);
    }
  };

  const handleUploadAudioFile = async (file: File) => {
    if (!file) return;
    setIsPostBusy(true);
    showToast(`Uploading & normalizing ${file.name}...`);
    try {
      const res = await fetch('/api/audio/upload', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'audio/mpeg',
          'X-File-Name': file.name,
          'X-Track-Title': file.name.replace(/\.[^.]+$/, ''),
        },
        body: file,
      });
      const data = await res.json();
      if (res.ok && data.success && data.track) {
        setTracks((prev) => [data.track, ...prev]);
        setActiveTrack(data.track);
        setRightTab('preview');
        setConfig((prev) => ({ ...prev, mode: 'music-edit' }));
        showToast(`"${data.track.title}" imported ready for editing & stems.`);
      } else {
        showToast(data?.error || 'Audio upload failed.');
      }
    } catch {
      showToast('Audio upload failed.');
    } finally {
      setIsPostBusy(false);
    }
  };

  const handleCreateVoiceClone = async (name: string) => {
    if (isCreatingVoice) return;
    setIsCreatingVoice(true);
    try {
      const res = await fetch('/api/audio/voice-clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'Studio Vocalist',
          timbre: config.vocal.timbre,
          voiceName: config.vocal.producerTagVoice,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.clone) {
        setClonedVoices((prev) => [data.clone, ...prev]);
        setSelectedVoiceClone(data.clone);
        showToast(`Vocal preset "${data.clone.name}" saved.`);
      } else {
        showToast(data?.error || 'Could not save vocal preset.');
      }
    } catch {
      showToast('Vocal preset save failed.');
    } finally {
      setIsCreatingVoice(false);
    }
  };

  const handleSubmitComposer = async () => {
    const cleanPrompt = prompt.trim();
    if ((!cleanPrompt && !lyrics.trim()) || isLoading) return;

    const startMs = Date.now();
    const isEditMode = config.mode === 'music-edit' && !!activeTrack;
    const userDisplay = cleanPrompt || `Generate: ${title || 'Custom Lyrics Track'}`;

    setTurns((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', content: isEditMode ? `[Edit] ${userDisplay}` : userDisplay },
    ]);
    setPrompt('');
    setIsLoading(true);

    try {
      if (isEditMode && activeTrack) {
        const res = await fetch('/api/audio/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeTrack.id,
            instruction: cleanPrompt,
            editPreset: config.editPreset,
            musicConfig: config,
          }),
        });
        const data = await res.json();
        const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
        if (res.ok && data.success && data.track) {
          setTracks((prev) => [data.track, ...prev]);
          setActiveTrack(data.track);
          setRightTab('preview');
          setTurns((prev) => [
            ...prev,
            {
              id: `a_${Date.now()}`,
              role: 'assistant',
              modelLabel: data.track.engineModelUsed || 'Audio Edit Engine',
              durationSec: elapsed,
              content: `Created v${data.track.version || 2}: "${data.track.title}".`,
              details: [data.track.aiNotes || `Preset: ${config.editPreset}`],
            },
          ]);
          showToast('Edited version created.');
        } else {
          showToast(data?.error || 'Audio edit failed.');
        }
        return;
      }

      const tags = styleInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/audio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanPrompt || title || 'Studio Musical Composition',
          lyrics: config.vocal.mode === 'instrumental' ? '' : lyrics,
          title: title || undefined,
          styleTags: tags,
          enhancedFrom: enhancedFromPrompt || undefined,
          musicConfig: config,
        }),
      });
      const data = await res.json();
      const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
      if (res.ok && data.success && data.track) {
        setEnhancedFromPrompt(null);
        setTracks((prev) => [data.track, ...prev]);
        setActiveTrack(data.track);
        setRightTab('preview');
        setTurns((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            modelLabel: data.track.engineModelUsed || config.model,
            durationSec: elapsed,
            content: `Produced "${data.track.title}" (${data.track.bpm} BPM · ${data.track.keySignature}).`,
            details: [
              `Tags: ${data.track.styleTags?.join(', ') || styleInput}`,
              data.track.isInstrumental ? 'Instrumental Arrangement' : `Vocals (${config.vocal.language})`,
            ],
          },
        ]);
        setTimeout(() => {
          audioPlayerRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
        }, 120);
      } else {
        showToast(data?.error || 'Music generation failed.');
      }
    } catch {
      showToast('Audio studio request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextEditTrack = async (
    trackId: string,
    instruction: string,
    preset: MusicEditPreset
  ) => {
    setIsPostBusy(true);
    try {
      const res = await fetch('/api/audio/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: trackId,
          instruction,
          editPreset: preset,
          musicConfig: { ...config, editPreset: preset },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.track) {
        setTracks((prev) => [data.track, ...prev]);
        setActiveTrack(data.track);
        showToast(`Created edited version "${data.track.title}".`);
      } else {
        showToast(data?.error || 'Track edit failed.');
      }
    } catch {
      showToast('Track edit error.');
    } finally {
      setIsPostBusy(false);
    }
  };

  const handleMasterTrack = async (
    trackId: string,
    dsp: MusicDspSettings,
    removeVocals: boolean,
    outputFormat: 'mp3' | 'wav'
  ) => {
    setIsPostBusy(true);
    try {
      const res = await fetch('/api/audio/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trackId, dsp, removeVocals, outputFormat }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.track) {
        setTracks((prev) => [data.track, ...prev]);
        setActiveTrack(data.track);
        showToast('Mastered version rendered.');
      } else {
        showToast(data?.error || 'Mastering failed.');
      }
    } catch {
      showToast('Mastering error.');
    } finally {
      setIsPostBusy(false);
    }
  };

  const handleTrimTrack = async (trackId: string, startSec: number, endSec: number) => {
    setIsPostBusy(true);
    try {
      const res = await fetch('/api/audio/trim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trackId, startSec, endSec }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.track) {
        setTracks((prev) => [data.track, ...prev]);
        setActiveTrack(data.track);
        showToast(`Trimmed cut (${startSec.toFixed(1)}s–${endSec.toFixed(1)}s) created.`);
      } else {
        showToast(data?.error || 'Trim failed.');
      }
    } catch {
      showToast('Trim error.');
    } finally {
      setIsPostBusy(false);
    }
  };

  const handleExtendTrack = async (trackId: string, extensionPrompt: string) => {
    setIsPostBusy(true);
    try {
      const res = await fetch('/api/audio/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trackId, extensionPrompt }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.track) {
        setTracks((prev) => [data.track, ...prev]);
        setActiveTrack(data.track);
        showToast('Extended outro seamlessly merged.');
      } else {
        showToast(data?.error || 'Extend failed.');
      }
    } catch {
      showToast('Extend error.');
    } finally {
      setIsPostBusy(false);
    }
  };

  const handleSeparateStems = async (trackId: string) => {
    setIsPostBusy(true);
    showToast('Isolating Vocals, Instrumental, Bass & Drums...');
    try {
      const res = await fetch('/api/audio/separate-stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trackId }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.item) {
        setTracks((prev) => prev.map((t) => (t.id === trackId ? data.item : t)));
        if (activeTrack?.id === trackId) setActiveTrack(data.item);
        showToast('4-Stem isolation complete.');
      } else {
        showToast(data?.error || 'Stem separation failed.');
      }
    } catch {
      showToast('Stem separation error.');
    } finally {
      setIsPostBusy(false);
    }
  };

  const handleAddProducerTag = async (trackId: string, tagText: string, voiceName: string) => {
    setIsPostBusy(true);
    try {
      const res = await fetch('/api/audio/producer-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trackId, tagText, voiceName }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.track) {
        setTracks((prev) => [data.track, ...prev]);
        setActiveTrack(data.track);
        showToast('Studio producer vocal tag mixed.');
      } else {
        showToast(data?.error || 'Producer tag failed.');
      }
    } catch {
      showToast('Producer tag error.');
    } finally {
      setIsPostBusy(false);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const res = await fetch('/api/audio/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setTracks((prev) => prev.map((t) => (t.id === id ? data.item : t)));
        if (activeTrack?.id === id) setActiveTrack(data.item);
      }
    } catch {
      // ignore
    }
  };

  const handlePublishShare = async (id: string) => {
    try {
      const res = await fetch('/api/audio/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.shareUrl) {
        const fullUrl = `${window.location.origin}${data.shareUrl}`;
        navigator.clipboard?.writeText(fullUrl).catch(() => {});
        if (data.item) {
          setTracks((prev) => prev.map((t) => (t.id === id ? data.item : t)));
          if (activeTrack?.id === id) setActiveTrack(data.item);
        }
        showToast('Public player share link copied to clipboard.');
      } else {
        showToast(data?.error || 'Share failed.');
      }
    } catch {
      showToast('Share failed.');
    }
  };

  const handleDeleteTrack = async (id: string) => {
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

  const handlePlayToggle = (track: GeneratedAudioItem) => {
    if (activeTrack?.id === track.id) {
      if (isPlaying) {
        audioPlayerRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioPlayerRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else {
      setActiveTrack(track);
      fetch('/api/audio/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: track.id }),
      }).catch(() => {});
      setTimeout(() => {
        audioPlayerRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
      }, 90);
    }
  };

  const filteredTracks = tracks.filter((t) => {
    if (libraryFilter === 'favorites' && !t.isFavorite) return false;
    if (libraryFilter === 'uploads' && t.operationType !== 'upload') return false;
    if (
      libraryFilter === 'remixes' &&
      !['ai_remix', 'dsp_edit', 'master', 'trim', 'extend', 'vocal_intro'].includes(
        t.operationType || ''
      )
    ) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.prompt.toLowerCase().includes(q) ||
        t.styleTags?.some((s) => s.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const previewContent = activeTrack ? (
    <MusicTrackStage
      track={activeTrack}
      versionTree={versionTree}
      onSelectTrack={(t) => {
        setActiveTrack(t);
        setIsPlaying(false);
      }}
      audioRef={audioPlayerRef}
      isPlaying={isPlaying}
      onTogglePlay={handlePlayToggle}
      isBusy={isPostBusy}
      onTextEditTrack={handleTextEditTrack}
      onMasterTrack={handleMasterTrack}
      onTrimTrack={handleTrimTrack}
      onExtendTrack={handleExtendTrack}
      onSeparateStems={handleSeparateStems}
      onAddProducerTag={handleAddProducerTag}
      onToggleFavorite={handleToggleFavorite}
      onPublishShare={handlePublishShare}
      onDeleteTrack={handleDeleteTrack}
      onTimeSync={(t, d, playing) => {
        setCurrentTime(t);
        setDuration(d);
        setIsPlaying(playing);
      }}
    />
  ) : null;

  const filesContent = (
    <div className="p-5 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-[#8E9198] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks, genres, lyrics..."
            className="w-full bg-[#1B1C1E] border border-[#2C2D30] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#151618] border border-[#282A2E]">
          {(['all', 'favorites', 'uploads', 'remixes'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setLibraryFilter(tab)}
              className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${
                libraryFilter === tab
                  ? 'bg-[#282A2E] text-white font-medium'
                  : 'text-[#9AA0A6] hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {filteredTracks.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <Disc3 className="w-8 h-8 text-[#5F6368] mx-auto" />
          <p className="text-sm text-[#C4C7C5]">No tracks found in library</p>
          <p className="text-xs text-[#8E9198]">
            Generate a new track from text or upload an MP3/WAV file to edit.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredTracks.map((t) => (
            <div
              key={t.id}
              onClick={() => {
                setActiveTrack(t);
                setRightTab('preview');
              }}
              className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-colors ${
                activeTrack?.id === t.id
                  ? 'bg-[#21242B] border-[#8AB4F8]'
                  : 'bg-[#18191C] border-[#282A2E] hover:border-[#3E4148]'
              }`}
            >
              <img
                src={t.coverUrl}
                alt={t.title}
                className="w-14 h-14 rounded-lg object-cover bg-black shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">{t.title}</div>
                <div className="text-[11px] text-[#9AA0A6] truncate">
                  {t.bpm || 120} BPM · {t.keySignature || 'C Major'} · v{t.version || 1}
                </div>
                <div className="text-[10px] text-[#8E9198] truncate">
                  {t.engineModelUsed || t.model}
                </div>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(t.id)}
                  className={`p-1.5 rounded hover:bg-[#2A2D33] ${
                    t.isFavorite ? 'text-[#8AB4F8]' : 'text-[#8E9198]'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${t.isFavorite ? 'fill-current' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTrack(t.id)}
                  className="p-1.5 rounded hover:bg-red-950/50 text-[#8E9198] hover:text-red-400"
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

  const codeContent = activeTrack ? (
    <div className="p-5 font-mono text-xs text-[#C4C7C5] space-y-4">
      <div className="text-sm font-sans font-medium text-white">
        Audio Production Manifest & Mastering JSON
      </div>
      <pre className="p-4 rounded-xl bg-[#111214] border border-[#26282C] overflow-x-auto">
        {JSON.stringify(
          {
            id: activeTrack.id,
            title: activeTrack.title,
            version: activeTrack.version || 1,
            operationType: activeTrack.operationType || 'generate',
            engineModelUsed: activeTrack.engineModelUsed,
            bpm: activeTrack.bpm,
            keySignature: activeTrack.keySignature,
            durationSec: activeTrack.duration,
            format: activeTrack.format,
            sampleRate: activeTrack.sampleRate,
            bitrateKbps: activeTrack.bitrateKbps,
            fileSizeBytes: activeTrack.fileSizeBytes,
            stemsSeparated: Boolean(activeTrack.stemsSeparated),
            compiledPrompt: activeTrack.compiledPrompt,
            seed: activeTrack.seed,
          },
          null,
          2
        )}
      </pre>
    </div>
  ) : (
    <div className="p-6 text-xs text-[#8E9198]">
      Select or generate a track to inspect its technical synthesis & mastering manifest.
    </div>
  );

  const editDrawerContent = (
    <MusicConfigDrawer
      config={config}
      onChange={setConfig}
      title={title}
      onTitleChange={setTitle}
      lyrics={lyrics}
      onLyricsChange={setLyrics}
      styleInput={styleInput}
      onStyleInputChange={setStyleInput}
      onAiWriteLyrics={handleEnhanceLyrics}
      isEnhancingLyrics={isEnhancingLyrics}
      onUploadSourceAudio={handleUploadAudioFile}
      hasSelectedTrack={!!activeTrack}
      clonedVoices={clonedVoices}
      selectedVoiceClone={selectedVoiceClone}
      onSelectVoiceClone={setSelectedVoiceClone}
      onCreateVoiceClone={handleCreateVoiceClone}
      isCreatingVoice={isCreatingVoice}
    />
  );

  const composerAddContent = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={handleEnhanceLyrics}
          disabled={(!prompt.trim() && !title.trim()) || isEnhancingLyrics}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3] disabled:opacity-50"
        >
          <Wand2 className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>{isEnhancingLyrics ? 'Writing...' : 'Write Lyrics'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const idea =
              RANDOM_SONG_IDEAS[Math.floor(Math.random() * RANDOM_SONG_IDEAS.length)];
            setTitle(idea.title);
            setPrompt(idea.prompt);
            setStyleInput(idea.style);
            setConfig((prev) => ({
              ...prev,
              bpm: idea.bpm,
              keySignature: idea.key,
            }));
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <Dices className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Random Idea</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setConfig((prev) => {
              const nextInst = prev.vocal.mode !== 'instrumental';
              return {
                ...prev,
                mode: nextInst ? 'instrumental' : 'text-to-song',
                vocal: {
                  ...prev.vocal,
                  mode: nextInst ? 'instrumental' : 'full_vocals',
                },
              };
            })
          }
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
            config.vocal.mode === 'instrumental'
              ? 'bg-[#2B2D30] border-[#8AB4F8] text-white'
              : 'bg-[#252629] border-[#35373B] text-[#E3E3E3]'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          <span>Instrumental: {config.vocal.mode === 'instrumental' ? 'On' : 'Off'}</span>
        </button>
      </div>
    </div>
  );

  const composerInlineActions = (
    <button
      type="button"
      onClick={handleEnhancePrompt}
      disabled={!prompt.trim() || isEnhancingPrompt}
      title="Expand short idea into full prompt, title, BPM, key & lyrics"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#222429] hover:bg-[#2C2F36] border border-[#34373E] text-xs text-[#E3E3E3] disabled:opacity-40 transition-colors"
    >
      <Sparkles className="w-3.5 h-3.5 text-[#8AB4F8]" />
      <span>{isEnhancingPrompt ? 'Enhancing...' : 'Enhance'}</span>
    </button>
  );

  const extraToolbarActions = (
    <>
      <input
        ref={quickAudioUploadRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUploadAudioFile(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => quickAudioUploadRef.current?.click()}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1F2125] hover:bg-[#2A2D33] border border-[#30333A] text-xs text-[#E3E3E3]"
      >
        <Upload className="w-3.5 h-3.5 text-[#8AB4F8]" />
        <span className="hidden sm:inline">Upload Audio</span>
      </button>

      {activeTrack && (
        <button
          type="button"
          onClick={() =>
            setConfig((prev) => ({
              ...prev,
              mode: prev.mode === 'music-edit' ? 'text-to-song' : 'music-edit',
            }))
          }
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
            config.mode === 'music-edit'
              ? 'bg-[#262930] border-[#8AB4F8] text-white'
              : 'bg-[#1F2125] border-[#30333A] text-[#C4C7C5] hover:text-white'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {config.mode === 'music-edit' ? 'Edit Mode Active' : 'Edit Track'}
          </span>
        </button>
      )}
    </>
  );

  const bottomDockContent = activeTrack ? (
    <div className="px-4 py-2 bg-[#141518] border-t border-[#26282D] flex items-center justify-between gap-4 text-xs">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => handlePlayToggle(activeTrack)}
          className="w-7 h-7 rounded-full bg-[#E3E3E3] text-[#131314] flex items-center justify-center shrink-0"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
        </button>
        <div className="min-w-0">
          <div className="text-white font-medium truncate">{activeTrack.title}</div>
          <div className="text-[11px] text-[#8E9198] tabular-nums">
            {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} /{' '}
            {Math.floor((duration || activeTrack.duration) / 60)}:
            {String(Math.floor((duration || activeTrack.duration) % 60)).padStart(2, '0')}
          </div>
        </div>
      </div>
      <div className="text-[11px] text-[#9AA0A6] hidden md:block">
        {activeTrack.bpm || 120} BPM · {activeTrack.keySignature || 'C Major'}
      </div>
    </div>
  ) : undefined;

  return (
    <UnifiedStudioWorkspace
      isOpen={isOpen}
      onBackToStart={onClose}
      moduleName="RaOne Music Studio"
      workspaceTitle={activeTrack ? activeTrack.title : 'Untitled Music Session'}
      modelOptions={TTA_MODELS}
      selectedModel={config.model}
      onSelectModel={handleModelChange}
      prompt={prompt}
      onPromptChange={setPrompt}
      onSubmitPrompt={handleSubmitComposer}
      isGenerating={isLoading || isPostBusy}
      turns={turns}
      onResetWorkspace={() => {
        setActiveTrack(null);
        setIsPlaying(false);
        setTurns([]);
        setPrompt('');
        setTitle('');
        setLyrics('');
        setEnhancedFromPrompt(null);
        setConfig(DEFAULT_MUSIC_CONFIG);
        setRightTab('preview');
        showToast('Started fresh music workspace.');
      }}
      rightTab={rightTab}
      onRightTabChange={setRightTab}
      routePath={activeTrack ? `/music/${activeTrack.id}` : '/'}
      onRefresh={fetchAudioHistory}
      onRemix={() => {
        if (activeTrack) {
          setConfig((prev) => ({ ...prev, mode: 'music-edit' }));
          setPrompt(`Transform rhythm and instrumentation while keeping the core motif of "${activeTrack.title}"`);
          showToast('Track loaded into Edit/Remix mode.');
        } else {
          const idea = RANDOM_SONG_IDEAS[0];
          setTitle(idea.title);
          setPrompt(idea.prompt);
          setStyleInput(idea.style);
          showToast('Sample song idea loaded.');
        }
      }}
      onShare={() => {
        if (activeTrack) {
          handlePublishShare(activeTrack.id);
        } else {
          showToast('Select or generate a track to share.');
        }
      }}
      onPublish={() => {
        if (activeTrack) {
          const a = document.createElement('a');
          a.href = activeTrack.audioUrl;
          a.download = `${activeTrack.title}.${activeTrack.format?.toLowerCase() === 'wav' ? 'wav' : 'mp3'}`;
          a.click();
        } else {
          showToast('Select or generate a track first.');
        }
      }}
      publishLabel={activeTrack ? `Download ${activeTrack.format || 'MP3'}` : 'Download'}
      filesCount={tracks.length}
      hasActiveItem={!!activeTrack}
      previewContent={previewContent}
      codeContent={codeContent}
      filesContent={filesContent}
      editDrawerContent={editDrawerContent}
      composerAddContent={composerAddContent}
      composerInlineActions={composerInlineActions}
      extraToolbarActions={extraToolbarActions}
      bottomDockContent={bottomDockContent}
      emptyStateTitle="RaOne Music Studio Ready"
      emptyStateSubtitle="Type even 2 words and click Enhance, generate full songs & instrumentals with Lyria 3, or upload any MP3/WAV track to edit, master & isolate stems."
      emptyStateActionLabel="Browse Audio Library"
      onEmptyStateAction={() => setRightTab('files')}
      toastMessage={toastMessage}
      universalSettingsSection="music_studio"
    />
  );
};
