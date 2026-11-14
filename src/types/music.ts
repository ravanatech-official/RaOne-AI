export type MusicOperationType =
  | 'generate'
  | 'upload'
  | 'ai_remix'
  | 'dsp_edit'
  | 'trim'
  | 'extend'
  | 'separate_stems'
  | 'master'
  | 'vocal_intro';

export type MusicGenerationMode =
  | 'text-to-song'
  | 'custom-lyrics'
  | 'instrumental'
  | 'music-edit';

export type MusicEnhancerMode =
  | 'auto'
  | 'pop_rnb'
  | 'sri_lankan_fusion'
  | 'cinematic_orchestral'
  | 'edm_club'
  | 'lofi_ambient'
  | 'acoustic_unplugged';

export type MusicEditPreset =
  | 'ai_remix'
  | 'dsp_master'
  | 'karaoke_instrumental'
  | 'lofi_vinyl'
  | 'tempo_pitch'
  | 'stadium_reverb';

export interface MusicDspSettings {
  pitchSemitones: number; // -6 to +6
  tempoMultiplier: number; // 0.70 to 1.40
  bassDb: number; // -8 to +10
  trebleDb: number; // -8 to +10
  reverbWet: number; // 0 to 100
  lofiWarmth: boolean;
  normalizeLufs: boolean;
  fadeInSec: number;
  fadeOutSec: number;
}

export interface MusicVocalConfig {
  mode: 'full_vocals' | 'instrumental' | 'duet_harmony' | 'choir';
  timbre:
    | 'Balanced Modern Vocal'
    | 'Warm Male Baritone'
    | 'Soaring Female Soprano'
    | 'Raspy Rock Lead'
    | 'Melodic Auto-Tune'
    | 'Rap / Spoken Flow'
    | 'Traditional Folk';
  language: 'English' | 'Sinhala (සිංහල)' | 'Singlish' | 'Tamil / Bilingual' | 'Instrumental';
  producerTagText: string;
  producerTagVoice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
}

export interface MusicProductionConfig {
  mixSpace: 'Modern Radio Punch' | 'Wide Stereo Stage' | 'Intimate Acoustic Room' | 'Arena Stadium Reverb' | 'Warm Analog Tape';
  masteringPreset: 'Radio -14 LUFS' | 'Club Sub Heavy' | 'Audiophile Dynamic' | 'Lo-Fi Dusty Tape';
  era: '2026 Hyper-Modern' | '90s Golden Era' | '80s Analog Synth' | '70s Vintage Warmth' | 'Timeless Classical';
  timeSignature: '4/4 Standard' | '3/4 Waltz' | '6/8 Baila Groove' | '7/8 Progressive';
  mood: 'Euphoric & Uplifting' | 'Melancholic & Emotional' | 'Dark & Intense' | 'Chill & Numb' | 'Heroic & Epic' | 'Romantic';
  instruments: string[];
  generateCoverArt: boolean;
  outputFormat: 'mp3' | 'wav';
}

export interface MusicConfig {
  mode: MusicGenerationMode;
  model: string;
  enginePreference: 'lyria-3-pro-preview' | 'lyria-3-clip-preview';
  enhancerMode: MusicEnhancerMode;
  editPreset: MusicEditPreset;
  primaryGenre: string;
  secondaryGenre: string;
  bpm: number;
  keySignature: string;
  targetDurationSec: number;
  seed: number;
  seedLocked: boolean;
  negativePrompt: string;
  vocal: MusicVocalConfig;
  production: MusicProductionConfig;
  dsp: MusicDspSettings;
}

export const DEFAULT_MUSIC_CONFIG: MusicConfig = {
  mode: 'text-to-song',
  model: 'Google Lyria 3 Pro (Full Track)',
  enginePreference: 'lyria-3-pro-preview',
  enhancerMode: 'auto',
  editPreset: 'ai_remix',
  primaryGenre: 'Synthwave & Electronic Pop',
  secondaryGenre: 'Cinematic Hybrid',
  bpm: 120,
  keySignature: 'D Minor',
  targetDurationSec: 90,
  seed: 482910,
  seedLocked: false,
  negativePrompt: 'Harsh clipping, muddy low end, off-key noise, distorted static',
  vocal: {
    mode: 'full_vocals',
    timbre: 'Balanced Modern Vocal',
    language: 'English',
    producerTagText: '',
    producerTagVoice: 'Kore',
  },
  production: {
    mixSpace: 'Modern Radio Punch',
    masteringPreset: 'Radio -14 LUFS',
    era: '2026 Hyper-Modern',
    timeSignature: '4/4 Standard',
    mood: 'Euphoric & Uplifting',
    instruments: ['Analog Synth Pad', 'Punchy Drums', '808 Sub Bass'],
    generateCoverArt: true,
    outputFormat: 'mp3',
  },
  dsp: {
    pitchSemitones: 0,
    tempoMultiplier: 1.0,
    bassDb: 0,
    trebleDb: 0,
    reverbWet: 0,
    lofiWarmth: false,
    normalizeLufs: true,
    fadeInSec: 0,
    fadeOutSec: 0,
  },
};

export interface MusicEnhanceBreakdown {
  concept?: string;
  arrangement?: string;
  instrumentation?: string;
  vocalDirection?: string;
  mixNotes?: string;
}
