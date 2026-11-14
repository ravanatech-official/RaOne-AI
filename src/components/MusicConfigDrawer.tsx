import React, { useState, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Sliders,
  Disc3,
  Mic,
  Music,
  Guitar,
  AudioWaveform,
  Settings2,
  Upload,
  Lock,
  Unlock,
  Dices,
  RotateCcw,
  Wand2,
} from 'lucide-react';
import {
  DEFAULT_MUSIC_CONFIG,
  type MusicConfig,
  type MusicEditPreset,
  type MusicEnhancerMode,
  type MusicGenerationMode,
} from '../types/music.ts';
import type { ClonedVoiceProfile } from '../types/index.ts';

interface MusicConfigDrawerProps {
  config: MusicConfig;
  onChange: (next: MusicConfig) => void;
  title: string;
  onTitleChange: (val: string) => void;
  lyrics: string;
  onLyricsChange: (val: string) => void;
  styleInput: string;
  onStyleInputChange: (val: string) => void;
  onAiWriteLyrics: () => void;
  isEnhancingLyrics: boolean;
  onUploadSourceAudio: (file: File) => void;
  hasSelectedTrack: boolean;
  clonedVoices: ClonedVoiceProfile[];
  selectedVoiceClone: ClonedVoiceProfile | null;
  onSelectVoiceClone: (profile: ClonedVoiceProfile | null) => void;
  onCreateVoiceClone: (name: string) => void;
  isCreatingVoice: boolean;
}

const PRIMARY_GENRES = [
  'Synthwave & Electronic Pop',
  'Sri Lankan Baila Fusion',
  'Cinematic Orchestral Hybrid',
  'Hip-Hop & Trap 808',
  'Lo-Fi Chillhop & Jazz',
  'Contemporary R&B / Soul',
  'EDM Progressive House',
  'Acoustic Folk & Unplugged',
  'Modern Rock & Indie',
  'South Asian Classical Pop',
  'Deep House / Afrohouse',
  'Cyberpunk Dark Electro',
];

const SECONDARY_GENRES = [
  'Cinematic Hybrid',
  'Ambient Chill',
  'Orchestral Strings',
  'Funk Groove',
  'Trap Percussion',
  'Retro 80s Synth',
  'Traditional Acoustic',
  'Minimal Techno',
  'None',
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
  'Eb Major',
  'C Minor',
  'F# Minor',
];

const INSTRUMENT_PALETTE = [
  'Analog Synth Pad',
  'Punchy Drums',
  '808 Sub Bass',
  'Grand Piano',
  'Acoustic Guitar',
  'Electric Guitar',
  'Orchestral Strings',
  'Geta Bera Percussion',
  'Bansuri Flute',
  'Rhodes Electric Piano',
  'Brass Horns',
  'Saxophone Lead',
  'Ethereal Choir',
  'Tabla & Hand Perc',
];

const EDIT_PRESETS: Array<{ id: MusicEditPreset; label: string; desc: string }> = [
  { id: 'ai_remix', label: 'AI Full Remix', desc: 'Gemini Audio Analysis + Lyria re-imagining' },
  { id: 'karaoke_instrumental', label: 'Karaoke / No Vocals', desc: 'FFmpeg mid-side center vocal attenuation' },
  { id: 'lofi_vinyl', label: 'Lo-Fi Warm Tape', desc: 'FFmpeg analog warmth & dust EQ curve' },
  { id: 'stadium_reverb', label: 'Arena Reverb', desc: 'Wide stereo hall echo & shimmer' },
  { id: 'tempo_pitch', label: 'Speed & Pitch Shift', desc: 'Time stretch + semitone key shift' },
  { id: 'dsp_master', label: 'Studio Master DSP', desc: 'Custom EQ sliders + -14 LUFS loudnorm' },
];

type SectionId =
  | 'mode'
  | 'genre'
  | 'vocals'
  | 'musicality'
  | 'instruments'
  | 'mix_dsp'
  | 'export';

export const MusicConfigDrawer: React.FC<MusicConfigDrawerProps> = ({
  config,
  onChange,
  title,
  onTitleChange,
  lyrics,
  onLyricsChange,
  styleInput,
  onStyleInputChange,
  onAiWriteLyrics,
  isEnhancingLyrics,
  onUploadSourceAudio,
  hasSelectedTrack,
  clonedVoices,
  selectedVoiceClone,
  onSelectVoiceClone,
  onCreateVoiceClone,
  isCreatingVoice,
}) => {
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    mode: true,
    genre: true,
    vocals: true,
    musicality: false,
    instruments: false,
    mix_dsp: false,
    export: false,
  });
  const [newVoiceName, setNewVoiceName] = useState('Studio Vocalist');
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (id: SectionId) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleInstrument = (inst: string) => {
    const exists = config.production.instruments.includes(inst);
    const next = exists
      ? config.production.instruments.filter((i) => i !== inst)
      : [...config.production.instruments, inst];
    onChange({
      ...config,
      production: { ...config.production, instruments: next },
    });
  };

  const renderSectionHeader = (
    id: SectionId,
    label: string,
    summary: string,
    Icon: React.ComponentType<{ className?: string }>
  ) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#1E2024] transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-3.5 h-3.5 text-[#8AB4F8] shrink-0" />
        <span className="text-xs font-medium text-[#E3E3E3] truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className="text-[11px] text-[#8E9198] max-w-[115px] truncate">{summary}</span>
        {openSections[id] ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#8E9198]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#8E9198]" />
        )}
      </div>
    </button>
  );

  return (
    <div className="space-y-3 text-xs text-[#E3E3E3]">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-medium text-[#9AA0A6]">
          Studio Parameter Rack
        </span>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_MUSIC_CONFIG)}
          className="inline-flex items-center gap-1 text-[11px] text-[#9AA0A6] hover:text-white transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Track Title Quick Input */}
      <div className="rounded-lg bg-[#151618] border border-[#282A2E] p-3 space-y-1.5">
        <label className="text-[11px] text-[#9AA0A6] block">Song Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Optional title (auto-generated by Enhancer)"
          className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
        />
      </div>

      {/* 1. Mode, Engine & Source Audio */}
      <div className="rounded-lg bg-[#151618] border border-[#282A2E] overflow-hidden">
        {renderSectionHeader('mode', '1. Mode & Audio Source', config.mode, Sliders)}
        {openSections.mode && (
          <div className="p-3 pt-1 border-t border-[#24262A] space-y-3">
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Studio Mode</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'text-to-song', label: 'Text to Song' },
                    { id: 'custom-lyrics', label: 'Custom Lyrics' },
                    { id: 'instrumental', label: 'Instrumental' },
                    { id: 'music-edit', label: 'Edit / Remix' },
                  ] as Array<{ id: MusicGenerationMode; label: string }>
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...config,
                        mode: m.id,
                        vocal: {
                          ...config.vocal,
                          mode:
                            m.id === 'instrumental'
                              ? 'instrumental'
                              : config.vocal.mode === 'instrumental'
                              ? 'full_vocals'
                              : config.vocal.mode,
                        },
                      })
                    }
                    className={`px-2.5 py-1.5 rounded-md text-xs text-left border transition-colors ${
                      config.mode === m.id
                        ? 'bg-[#262930] border-[#8AB4F8] text-white font-medium'
                        : 'bg-[#1B1C1E] border-[#2C2D30] text-[#9AA0A6] hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {config.mode === 'music-edit' && (
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1.5">
                  Edit / Transformation Engine
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {EDIT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onChange({ ...config, editPreset: p.id })}
                      className={`px-2.5 py-1.5 rounded-md border text-left transition-colors ${
                        config.editPreset === p.id
                          ? 'bg-[#262930] border-[#8AB4F8] text-white'
                          : 'bg-[#1B1C1E] border-[#2C2D30] text-[#C4C7C5] hover:border-[#44474E]'
                      }`}
                    >
                      <div className="text-xs font-medium">{p.label}</div>
                      <div className="text-[10px] text-[#8E9198]">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Lyria Synthesis Engine</label>
                <select
                  value={config.enginePreference}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      enginePreference: e.target.value as 'lyria-3-pro-preview' | 'lyria-3-clip-preview',
                    })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
                >
                  <option value="lyria-3-pro-preview">Lyria 3 Pro (Full Track)</option>
                  <option value="lyria-3-clip-preview">Lyria 3 Clip (Fast 30s)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Enhancer Profile</label>
                <select
                  value={config.enhancerMode}
                  onChange={(e) =>
                    onChange({ ...config, enhancerMode: e.target.value as MusicEnhancerMode })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
                >
                  <option value="auto">Auto Smart Producer</option>
                  <option value="pop_rnb">Billboard Pop / R&B</option>
                  <option value="sri_lankan_fusion">Sri Lankan Fusion</option>
                  <option value="cinematic_orchestral">Cinematic Orchestral</option>
                  <option value="edm_club">EDM Festival Drop</option>
                  <option value="lofi_ambient">Lo-Fi Chill / Rain</option>
                  <option value="acoustic_unplugged">Acoustic Unplugged</option>
                </select>
              </div>
            </div>

            <div className="pt-1">
              <input
                ref={audioFileInputRef}
                type="file"
                accept="audio/mp3,audio/mpeg,audio/wav,audio/flac,audio/ogg,audio/m4a,audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadSourceAudio(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => audioFileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[#1F2125] hover:bg-[#2A2D33] border border-[#34373D] text-xs text-[#E3E3E3] transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#8AB4F8]" />
                <span>Upload Audio File (MP3, WAV, FLAC, M4A)</span>
              </button>
              {hasSelectedTrack && (
                <p className="text-[10px] text-[#8E9198] mt-1">
                  Active track loaded for Remix, DSP Mastering, Stem Isolation, and Trim.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Genre Fusion & Era */}
      <div className="rounded-lg bg-[#151618] border border-[#282A2E] overflow-hidden">
        {renderSectionHeader('genre', '2. Genre Fusion & Era', config.primaryGenre, Disc3)}
        {openSections.genre && (
          <div className="p-3 pt-1 border-t border-[#24262A] space-y-2.5">
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Primary Genre</label>
              <select
                value={config.primaryGenre}
                onChange={(e) => onChange({ ...config, primaryGenre: e.target.value })}
                className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
              >
                {PRIMARY_GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Secondary Fusion</label>
                <select
                  value={config.secondaryGenre}
                  onChange={(e) => onChange({ ...config, secondaryGenre: e.target.value })}
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
                >
                  {SECONDARY_GENRES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Sonic Era</label>
                <select
                  value={config.production.era}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      production: { ...config.production, era: e.target.value as any },
                    })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
                >
                  <option value="2026 Hyper-Modern">2026 Hyper-Modern</option>
                  <option value="90s Golden Era">90s Golden Era</option>
                  <option value="80s Analog Synth">80s Analog Synth</option>
                  <option value="70s Vintage Warmth">70s Vintage Warmth</option>
                  <option value="Timeless Classical">Timeless Classical</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Style Tags</label>
              <input
                type="text"
                value={styleInput}
                onChange={(e) => onStyleInputChange(e.target.value)}
                placeholder="Synthwave, Baila Fusion, Analog Bass"
                className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Vocals, Lyrics & Producer Tag */}
      <div className="rounded-lg bg-[#151618] border border-[#282A2E] overflow-hidden">
        {renderSectionHeader('vocals', '3. Vocals, Lyrics & Tag', config.vocal.language, Mic)}
        {openSections.vocals && (
          <div className="p-3 pt-1 border-t border-[#24262A] space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Vocal Arrangement</label>
                <select
                  value={config.vocal.mode}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      mode: e.target.value === 'instrumental' ? 'instrumental' : config.mode,
                      vocal: { ...config.vocal, mode: e.target.value as any },
                    })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
                >
                  <option value="full_vocals">Full Lead Vocals</option>
                  <option value="duet_harmony">Duet & Harmonies</option>
                  <option value="choir">Symphonic Choir</option>
                  <option value="instrumental">Instrumental (No Vocals)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Vocal Language</label>
                <select
                  value={config.vocal.language}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      vocal: { ...config.vocal, language: e.target.value as any },
                    })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
                >
                  <option value="English">English</option>
                  <option value="Sinhala (සිංහල)">Sinhala (සිංහල)</option>
                  <option value="Singlish">Singlish (Mixed)</option>
                  <option value="Tamil / Bilingual">Tamil / Bilingual</option>
                  <option value="Instrumental">Instrumental</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Vocal Timbre & Delivery</label>
              <select
                value={config.vocal.timbre}
                onChange={(e) =>
                  onChange({
                    ...config,
                    vocal: { ...config.vocal, timbre: e.target.value as any },
                  })
                }
                className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
              >
                <option value="Balanced Modern Vocal">Balanced Modern Vocal</option>
                <option value="Warm Male Baritone">Warm Male Baritone</option>
                <option value="Soaring Female Soprano">Soaring Female Soprano</option>
                <option value="Raspy Rock Lead">Raspy Rock Lead</option>
                <option value="Melodic Auto-Tune">Melodic Auto-Tune</option>
                <option value="Rap / Spoken Flow">Rap / Spoken Flow</option>
                <option value="Traditional Folk">Traditional Folk</option>
              </select>
            </div>

            {config.vocal.mode !== 'instrumental' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-[#9AA0A6]">Lyrics Editor ([Verse] / [Chorus])</label>
                  <button
                    type="button"
                    onClick={onAiWriteLyrics}
                    disabled={isEnhancingLyrics}
                    className="inline-flex items-center gap-1 text-[11px] text-[#8AB4F8] hover:underline disabled:opacity-50"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>{isEnhancingLyrics ? 'Writing...' : 'AI Write Lyrics'}</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={lyrics}
                  onChange={(e) => onLyricsChange(e.target.value)}
                  placeholder="[Verse 1]&#10;Write lyrics or click AI Write Lyrics..."
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md p-2 text-xs text-[#E3E3E3] font-mono resize-y focus:outline-none focus:border-[#8AB4F8]"
                />
              </div>
            )}

            <div className="pt-1 border-t border-[#24262A] space-y-2">
              <label className="text-[11px] text-[#9AA0A6] block">
                Studio Producer Intro Tag (Gemini TTS Drop)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={config.vocal.producerTagText}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      vocal: { ...config.vocal, producerTagText: e.target.value },
                    })
                  }
                  placeholder="Optional e.g. RaOne Exclusive"
                  className="flex-1 bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1 text-xs text-white"
                />
                <select
                  value={config.vocal.producerTagVoice}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      vocal: { ...config.vocal, producerTagVoice: e.target.value as any },
                    })
                  }
                  className="w-24 bg-[#1B1C1E] border border-[#2F3135] rounded-md px-1.5 py-1 text-xs text-white"
                >
                  <option value="Kore">Kore</option>
                  <option value="Puck">Puck</option>
                  <option value="Charon">Charon</option>
                  <option value="Fenrir">Fenrir</option>
                  <option value="Zephyr">Zephyr</option>
                </select>
              </div>
            </div>

            {/* Saved Vocal Profiles */}
            <div className="pt-1 border-t border-[#24262A] space-y-1.5">
              <label className="text-[11px] text-[#9AA0A6] block">Saved Vocal Preset</label>
              {clonedVoices.length > 0 && (
                <select
                  value={selectedVoiceClone?.id || ''}
                  onChange={(e) =>
                    onSelectVoiceClone(
                      clonedVoices.find((v) => v.id === e.target.value) || null
                    )
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1 text-xs text-white"
                >
                  <option value="">Default Session Voice</option>
                  {clonedVoices.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              )}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newVoiceName}
                  onChange={(e) => setNewVoiceName(e.target.value)}
                  placeholder="Save current vocal profile"
                  className="flex-1 bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => onCreateVoiceClone(newVoiceName)}
                  disabled={isCreatingVoice}
                  className="px-2.5 py-1 rounded-md bg-[#282A2E] hover:bg-[#34373D] text-xs text-white"
                >
                  {isCreatingVoice ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Musicality: BPM, Key, Meter, Mood */}
      <div className="rounded-lg bg-[#151618] border border-[#282A2E] overflow-hidden">
        {renderSectionHeader('musicality', '4. Tempo, Key & Mood', `${config.bpm} BPM · ${config.keySignature}`, Music)}
        {openSections.musicality && (
          <div className="p-3 pt-1 border-t border-[#24262A] space-y-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-[#9AA0A6]">Tempo (BPM)</label>
                <span className="text-xs font-mono tabular-nums text-white">{config.bpm} BPM</span>
              </div>
              <input
                type="range"
                min={55}
                max={190}
                value={config.bpm}
                onChange={(e) => onChange({ ...config, bpm: Number(e.target.value) })}
                className="w-full accent-[#8AB4F8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Musical Key</label>
                <select
                  value={config.keySignature}
                  onChange={(e) => onChange({ ...config, keySignature: e.target.value })}
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
                >
                  {KEY_SIGNATURES.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Time Signature</label>
                <select
                  value={config.production.timeSignature}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      production: { ...config.production, timeSignature: e.target.value as any },
                    })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
                >
                  <option value="4/4 Standard">4/4 Standard</option>
                  <option value="3/4 Waltz">3/4 Waltz</option>
                  <option value="6/8 Baila Groove">6/8 Baila Groove</option>
                  <option value="7/8 Progressive">7/8 Progressive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Emotional Mood</label>
              <select
                value={config.production.mood}
                onChange={(e) =>
                  onChange({
                    ...config,
                    production: { ...config.production, mood: e.target.value as any },
                  })
                }
                className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
              >
                <option value="Euphoric & Uplifting">Euphoric & Uplifting</option>
                <option value="Melancholic & Emotional">Melancholic & Emotional</option>
                <option value="Dark & Intense">Dark & Intense</option>
                <option value="Chill & Numb">Chill & Ambient</option>
                <option value="Heroic & Epic">Heroic & Epic</option>
                <option value="Romantic">Romantic</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 5. Instrumentation Matrix */}
      <div className="rounded-lg bg-[#151618] border border-[#282A2E] overflow-hidden">
        {renderSectionHeader(
          'instruments',
          '5. Instrumentation Matrix',
          `${config.production.instruments.length} selected`,
          Guitar
        )}
        {openSections.instruments && (
          <div className="p-3 pt-2 border-t border-[#24262A]">
            <div className="grid grid-cols-2 gap-1.5">
              {INSTRUMENT_PALETTE.map((inst) => {
                const active = config.production.instruments.includes(inst);
                return (
                  <button
                    key={inst}
                    type="button"
                    onClick={() => toggleInstrument(inst)}
                    className={`px-2 py-1.5 rounded-md border text-[11px] text-left truncate transition-colors ${
                      active
                        ? 'bg-[#262930] border-[#8AB4F8] text-white'
                        : 'bg-[#1B1C1E] border-[#2C2D30] text-[#9AA0A6] hover:text-white'
                    }`}
                  >
                    {inst}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 6. Mix, Mastering & FFmpeg DSP Rack */}
      <div className="rounded-lg bg-[#151618] border border-[#282A2E] overflow-hidden">
        {renderSectionHeader('mix_dsp', '6. Mix, Mastering & DSP', config.production.mixSpace, AudioWaveform)}
        {openSections.mix_dsp && (
          <div className="p-3 pt-1 border-t border-[#24262A] space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Acoustic Space</label>
                <select
                  value={config.production.mixSpace}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      production: { ...config.production, mixSpace: e.target.value as any },
                    })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
                >
                  <option value="Modern Radio Punch">Modern Radio Punch</option>
                  <option value="Wide Stereo Stage">Wide Stereo Stage</option>
                  <option value="Intimate Acoustic Room">Intimate Acoustic Room</option>
                  <option value="Arena Stadium Reverb">Arena Stadium Reverb</option>
                  <option value="Warm Analog Tape">Warm Analog Tape</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Master Target</label>
                <select
                  value={config.production.masteringPreset}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      production: { ...config.production, masteringPreset: e.target.value as any },
                    })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
                >
                  <option value="Radio -14 LUFS">Radio -14 LUFS</option>
                  <option value="Club Sub Heavy">Club Sub Heavy</option>
                  <option value="Audiophile Dynamic">Audiophile Dynamic</option>
                  <option value="Lo-Fi Dusty Tape">Lo-Fi Dusty Tape</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between text-[11px] text-[#9AA0A6]">
                  <span>Pitch Shift</span>
                  <span className="font-mono tabular-nums text-white">{config.dsp.pitchSemitones} st</span>
                </div>
                <input
                  type="range"
                  min={-6}
                  max={6}
                  step={1}
                  value={config.dsp.pitchSemitones}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      dsp: { ...config.dsp, pitchSemitones: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-[#8AB4F8]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-[#9AA0A6]">
                  <span>Speed Factor</span>
                  <span className="font-mono tabular-nums text-white">{config.dsp.tempoMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.4}
                  step={0.05}
                  value={config.dsp.tempoMultiplier}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      dsp: { ...config.dsp, tempoMultiplier: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-[#8AB4F8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between text-[11px] text-[#9AA0A6]">
                  <span>Bass Boost</span>
                  <span className="font-mono tabular-nums text-white">{config.dsp.bassDb} dB</span>
                </div>
                <input
                  type="range"
                  min={-8}
                  max={10}
                  step={1}
                  value={config.dsp.bassDb}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      dsp: { ...config.dsp, bassDb: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-[#8AB4F8]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-[#9AA0A6]">
                  <span>Reverb Send</span>
                  <span className="font-mono tabular-nums text-white">{config.dsp.reverbWet}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={config.dsp.reverbWet}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      dsp: { ...config.dsp, reverbWet: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-[#8AB4F8]"
                />
              </div>
            </div>

            <label className="flex items-center justify-between pt-1 cursor-pointer">
              <span className="text-[11px] text-[#C4C7C5]">Loudness Normalize (-14 LUFS)</span>
              <input
                type="checkbox"
                checked={config.dsp.normalizeLufs}
                onChange={(e) =>
                  onChange({ ...config, dsp: { ...config.dsp, normalizeLufs: e.target.checked } })
                }
                className="accent-[#8AB4F8]"
              />
            </label>

            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Negative Prompt (Avoid)</label>
              <textarea
                rows={2}
                value={config.negativePrompt}
                onChange={(e) => onChange({ ...config, negativePrompt: e.target.value })}
                className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md p-2 text-xs text-[#E3E3E3] resize-none focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* 7. Export Format, Cover Art & Seed Lock */}
      <div className="rounded-lg bg-[#151618] border border-[#282A2E] overflow-hidden">
        {renderSectionHeader(
          'export',
          '7. Format, Art & Seed',
          `${config.production.outputFormat.toUpperCase()} · #${config.seed}`,
          Settings2
        )}
        {openSections.export && (
          <div className="p-3 pt-1 border-t border-[#24262A] space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Output Format</label>
                <select
                  value={config.production.outputFormat}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      production: {
                        ...config.production,
                        outputFormat: e.target.value as 'mp3' | 'wav',
                      },
                    })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1.5 text-xs text-white"
                >
                  <option value="mp3">MP3 (256 kbps)</option>
                  <option value="wav">WAV (16-bit Studio PCM)</option>
                </select>
              </div>
              <label className="flex flex-col justify-end pb-1.5 cursor-pointer">
                <div className="flex items-center justify-between bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2.5 py-1.5">
                  <span className="text-xs text-[#E3E3E3]">Cover Art</span>
                  <input
                    type="checkbox"
                    checked={config.production.generateCoverArt}
                    onChange={(e) =>
                      onChange({
                        ...config,
                        production: {
                          ...config.production,
                          generateCoverArt: e.target.checked,
                        },
                      })
                    }
                    className="accent-[#8AB4F8]"
                  />
                </div>
              </label>
            </div>

            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Generation Seed</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={config.seed}
                  onChange={(e) => onChange({ ...config, seed: Number(e.target.value) || 100000 })}
                  className="flex-1 bg-[#1B1C1E] border border-[#2F3135] rounded-md px-2 py-1 text-xs font-mono tabular-nums text-white"
                />
                <button
                  type="button"
                  onClick={() => onChange({ ...config, seedLocked: !config.seedLocked })}
                  title={config.seedLocked ? 'Unlock Seed' : 'Lock Seed'}
                  className="p-1.5 rounded-md bg-[#1B1C1E] border border-[#2F3135] text-[#E3E3E3] hover:bg-[#282A2E]"
                >
                  {config.seedLocked ? (
                    <Lock className="w-3.5 h-3.5 text-[#8AB4F8]" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 text-[#9AA0A6]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...config, seed: Math.floor(100000 + Math.random() * 899999) })
                  }
                  title="Randomize Seed"
                  className="p-1.5 rounded-md bg-[#1B1C1E] border border-[#2F3135] text-[#E3E3E3] hover:bg-[#282A2E]"
                >
                  <Dices className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
