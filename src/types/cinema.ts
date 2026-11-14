export type CinemaOperationType =
  | 'generate'
  | 'i2v'
  | 'edit'
  | 'restyle'
  | 'object_swap'
  | 'weather_swap'
  | 'background_replace'
  | 'motion_brush'
  | 'extend'
  | 'trim'
  | 'interpolate'
  | 'upscale'
  | 'audio_sync'
  | 'upload'
  | 'storyboard';

export type CinemaGenerationMode =
  | 'text-to-video'
  | 'image-to-video'
  | 'video-edit'
  | 'storyboard';

export type CinemaEnhancerMode =
  | 'auto'
  | 'hollywood'
  | 'commercial'
  | 'anime'
  | 'drone_doc'
  | 'scifi_vfx';

export type CinemaResolutionTier = '360p' | '720p' | '1080p' | '4k';

export type CinemaEditPreset =
  | 'custom'
  | 'restyle'
  | 'object_swap'
  | 'background_replace'
  | 'weather_lighting'
  | 'character_swap';

export interface CinemaCameraRig {
  trajectory: string;
  motionStrength: number; // 1 - 10
  speed: 'Slow' | 'Natural' | 'Dynamic' | 'Hyper';
  stabilization: 'Tripod' | 'Gimbal' | 'Handheld' | 'FPV Drone' | 'Steadicam';
  focalLength: '14mm Ultra-Wide' | '24mm Wide' | '35mm Cinema' | '50mm Natural' | '85mm Portrait' | '135mm Telephoto' | 'Anamorphic 2x';
  aperture: 'f/1.4 Shallow DOF' | 'f/2.8 Cinematic' | 'f/5.6 Balanced' | 'f/11 Deep Focus';
  shutterRule: '180° Standard Motion' | '90° Crisp Action' | '360° Dreamy Blur';
}

export interface CinemaLookSpec {
  visualStyle: string;
  lighting: string;
  colorGrade: string;
  weatherParticles: string;
  filmStock: 'Clean Digital 8K' | 'Kodak Vision3 35mm' | 'IMAX 70mm' | '16mm Vintage Grain' | 'Anamorphic Teal & Orange';
  pacing: 'Contemplative' | 'Cinematic Flow' | 'High-Octane Action' | 'Slow Motion';
}

export interface CinemaAudioSpec {
  audioMode: 'native' | 'lyria_score' | 'ambient_foley' | 'muted';
  audioPrompt: string;
  musicMood: string;
  voiceoverCue: string;
}

export interface CinemaEditSpec {
  preset: CinemaEditPreset;
  preservationStrength: number; // 0 - 100
  motionBrushDirection: 'Static Mask' | 'Flow Right' | 'Flow Left' | 'Push Forward' | 'Pull Back' | 'Swirl / Vortex' | 'Rise Up';
}

export interface CinemaConfig {
  mode: CinemaGenerationMode;
  model: string;
  duration: number; // 3 - 15s
  fps: 24 | 30 | 60;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
  resolution: CinemaResolutionTier;
  seed: number;
  seedLocked: boolean;
  negativePrompt: string;
  enhancerMode: CinemaEnhancerMode;
  camera: CinemaCameraRig;
  look: CinemaLookSpec;
  audio: CinemaAudioSpec;
  edit: CinemaEditSpec;
}

export const DEFAULT_CINEMA_CONFIG: CinemaConfig = {
  mode: 'text-to-video',
  model: 'Google Veo 2 (Gemini Omni)',
  duration: 5,
  fps: 24,
  aspectRatio: '16:9',
  resolution: '720p',
  seed: 894172,
  seedLocked: false,
  negativePrompt: 'blurry, morphing faces, frame jitter, watermark, text overlay, low resolution, artifacts',
  enhancerMode: 'auto',
  camera: {
    trajectory: 'Fly Through Forward',
    motionStrength: 7,
    speed: 'Natural',
    stabilization: 'Gimbal',
    focalLength: '35mm Cinema',
    aperture: 'f/2.8 Cinematic',
    shutterRule: '180° Standard Motion',
  },
  look: {
    visualStyle: 'Photorealistic Cinema',
    lighting: 'Volumetric Golden Hour',
    colorGrade: 'Kodak 2383 Film Print',
    weatherParticles: 'None / Clear',
    filmStock: 'Kodak Vision3 35mm',
    pacing: 'Cinematic Flow',
  },
  audio: {
    audioMode: 'native',
    audioPrompt: '',
    musicMood: 'Atmospheric Orchestral',
    voiceoverCue: '',
  },
  edit: {
    preset: 'custom',
    preservationStrength: 75,
    motionBrushDirection: 'Flow Right',
  },
};

export interface CinemaEnhanceBreakdown {
  subject?: string;
  camera?: string;
  lighting?: string;
  physics?: string;
  colorGrade?: string;
  audioCue?: string;
}
