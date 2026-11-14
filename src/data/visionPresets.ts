import type { VisionDarkroomAdjustments } from '../types/index.ts';

export interface VisionModelOption {
  id: string;
  label: string;
  description: string;
}

export const VISION_MODELS: VisionModelOption[] = [
  {
    id: 'Flux 1.1 Pro (LDM)',
    label: 'Flux 1.1 Pro',
    description: 'Rectified Flow · Studio Photoreal & Lighting',
  },
  {
    id: 'Nano Banana 2.1 Ultra',
    label: 'Nano Banana 2.1',
    description: '2K/4K Native Resolution · Multi-Ref & Web Grounding',
  },
  {
    id: 'Nano Banana Flash Lite',
    label: 'Nano Banana Lite',
    description: 'Ultra-fast 1K Drafts & Rapid Iterations',
  },
  {
    id: 'Midjourney v6.1 Aesthetics',
    label: 'Midjourney v6.1',
    description: 'Cinematic Framing & Editorial Atmosphere',
  },
  {
    id: 'Google Imagen 3 Ultra',
    label: 'Imagen 3 Ultra',
    description: 'Spatial Accuracy & Clean Typography Rendering',
  },
  {
    id: 'DALL-E 3 Precision',
    label: 'DALL-E 3',
    description: 'Dense Multi-Object Semantic Compliance',
  },
  {
    id: 'Leonardo Diffusion XL',
    label: 'Leonardo XL',
    description: 'Concept Illustration & Character Lighting',
  },
  {
    id: 'Stable Diffusion 3.5 Large',
    label: 'SD 3.5 Large',
    description: 'MMDiT High-Detail Stylization & Fine Textures',
  },
];

export const ENHANCER_MODES = [
  { id: 'auto', label: 'Auto Smart', hint: 'Balanced pro photography & lighting' },
  { id: 'cinematic', label: 'Cinema IMAX', hint: 'Anamorphic lens & dramatic film look' },
  { id: 'product', label: 'Product Studio', hint: 'Commercial packshot & softbox gloss' },
  { id: 'anime', label: 'Anime / Illus.', hint: 'Cel-shaded & painted sky storytelling' },
  { id: 'concept3d', label: '3D / Concept', hint: 'Octane PBR materials & volumetric rays' },
  { id: 'minimal', label: 'Minimal Brand', hint: 'Clean Swiss geometry & negative space' },
] as const;

export const STYLE_GROUPS: { group: string; styles: string[] }[] = [
  {
    group: 'Photography & Realism',
    styles: [
      'Cinematic Photoreal',
      'Editorial Portrait',
      'Commercial Product Studio',
      'Macro Photography',
      'Architectural Digest',
      'Street Documentary 35mm',
    ],
  },
  {
    group: '3D, CG & Concept',
    styles: [
      'Ray Traced 3D',
      'Octane Render PBR',
      'Isometric 3D Toy',
      'Concept Art',
      'Sci-Fi Hard Surface',
      'Dark Fantasy',
    ],
  },
  {
    group: 'Illustration & Fine Art',
    styles: [
      'Anime Illustration',
      'Watercolor & Ink',
      'Oil Painting Impasto',
      'Digital Comic Book',
      'Minimalist Vector Flat',
      'Cyberpunk Neon Noir',
    ],
  },
  {
    group: 'Design & Marketing',
    styles: [
      'High Fashion Concept',
      'Luxury Editorial Poster',
      'Retro Synthwave 80s',
      'Clean UI/App Mockup',
      'Double Exposure',
      'None',
    ],
  },
];

export const ALL_STYLE_PRESETS = STYLE_GROUPS.flatMap((g) => g.styles);

export const ASPECT_RATIO_OPTIONS = [
  { id: '16:9', label: '16:9', tag: 'Widescreen', dim: '1344×768' },
  { id: '1:1', label: '1:1', tag: 'Square', dim: '1024×1024' },
  { id: '9:16', label: '9:16', tag: 'Reels/Story', dim: '768×1344' },
  { id: '4:3', label: '4:3', tag: 'Classic', dim: '1152×864' },
  { id: '3:4', label: '3:4', tag: 'Portrait', dim: '864×1152' },
  { id: '21:9', label: '21:9', tag: 'Cinema', dim: '1536×640' },
  { id: '4:1', label: '4:1', tag: 'Banner', dim: '2048×512' },
  { id: '1:4', label: '1:4', tag: 'Vertical Strip', dim: '512×2048' },
];

export const RESOLUTION_TIERS: { id: '1K' | '2K' | '4K'; label: string; badge: string }[] = [
  { id: '1K', label: '1K Fast', badge: 'Standard' },
  { id: '2K', label: '2K Crisp HD', badge: 'Ultra Engine' },
  { id: '4K', label: '4K Master', badge: 'Print Quality' },
];

export const CAMERA_SHOTS = [
  'Auto',
  'Close-Up',
  'Extreme Close-Up',
  'Portrait Head & Shoulders',
  'Medium Shot',
  'Full Body Wide',
  'Low-Angle Hero',
  'High-Angle Overlook',
  'Aerial Drone Bird’s-Eye',
  'Isometric Top-Down',
];

export const LENS_OPTIONS = [
  'Auto',
  '14mm Ultra-Wide',
  '24mm Architectural Wide',
  '35mm Cinema Street',
  '50mm Natural Prime',
  '85mm Portrait Telephoto',
  '105mm Macro Detail',
  '200mm Compressed Telephoto',
];

export const APERTURE_OPTIONS = [
  'Auto',
  'f/1.2 Ultra Creamy Bokeh',
  'f/1.8 Shallow Depth',
  'f/2.8 Balanced Editorial',
  'f/5.6 Crisp Group Focus',
  'f/11 Deep Landscape',
];

export const LIGHTING_PRESETS = [
  'Auto',
  'Golden Hour Warm Sun',
  'Studio 3-Point Softbox',
  'Rembrandt Dramatic Key',
  'Neon Cyberpunk Rim Light',
  'Volumetric God Rays',
  'Bioluminescent Glow',
  'Overcast Soft Diffused',
  'Chiaroscuro Deep Shadow',
  'Backlit Silhouette Rim',
];

export const ATMOSPHERE_PRESETS = [
  'Auto',
  'Crisp Clear Air',
  'Morning Mist & Haze',
  'Rainy Street Reflections',
  'Floating Dust Motes',
  'Snowfall & Frost',
  'Dramatic Storm Clouds',
];

export const COLOR_GRADES = [
  'Auto',
  'Kodak Portra 400 Warm',
  'Teal & Orange Blockbuster',
  'Fujifilm Velvia Vivid',
  'Leica Monochrome Noir',
  'Pastel Dreamy Matte',
  'Emerald & Gold Luxury',
  'Cyberpunk Magenta & Cyan',
];

export const COMPOSITION_RULES = [
  'Auto',
  'Rule of Thirds',
  'Centered Symmetry',
  'Leading Lines',
  'Golden Ratio Spiral',
  'Generous Negative Space',
  'Dynamic Diagonal',
];

export const EDIT_OPERATIONS = [
  { id: 'edit', label: 'Smart Edit', desc: 'Modify scene/objects smoothly' },
  { id: 'inpaint', label: 'Mask Inpaint', desc: 'Edit only painted brush region' },
  { id: 'background_swap', label: 'Swap Background', desc: 'Keep subject, change environment' },
  { id: 'object_remove', label: 'Remove Object', desc: 'Erase unwanted element cleanly' },
  { id: 'restyle', label: 'Restyle', desc: 'Change art medium & palette' },
  { id: 'outpaint', label: 'Expand Canvas', desc: 'Extend scene outward naturally' },
] as const;

export const BEGINNER_TEMPLATES = [
  {
    label: 'Product Ad Shot',
    style: 'Commercial Product Studio',
    aspect: '1:1',
    prompt: 'Luxury matte-black wireless headphones resting on dark volcanic stone with water droplets and warm amber rim light',
  },
  {
    label: 'Sigiriya Epic',
    style: 'Cinematic Photoreal',
    aspect: '16:9',
    prompt: 'A majestic cybernetic lion with subtle glowing gold runes standing before mist-covered ancient Sigiriya Rock at sunrise',
  },
  {
    label: 'Editorial Portrait',
    style: 'Editorial Portrait',
    aspect: '3:4',
    prompt: 'Editorial close-up fashion portrait in evening rain with soft neon reflections and shallow 85mm bokeh',
  },
  {
    label: 'Colombo 2077',
    style: 'Cyberpunk Neon Noir',
    aspect: '16:9',
    prompt: 'Futuristic rainy night street market in Colombo 2077, holographic signboards reflected in wet pavement, cinematic depth',
  },
  {
    label: 'Anime Key Visual',
    style: 'Anime Illustration',
    aspect: '16:9',
    prompt: 'Young traveler looking over a floating cloud city at golden twilight, luminous painted sky and drifting lanterns',
  },
  {
    label: 'Minimal Emblem Logo',
    style: 'Minimalist Vector Flat',
    aspect: '1:1',
    prompt: 'Minimalist geometric metallic phoenix emblem centered on a pure matte charcoal backdrop, Swiss modern design',
  },
];

export const DEFAULT_DARKROOM: VisionDarkroomAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
  sharpness: 0,
  vignette: 0,
  flipH: false,
  flipV: false,
};
