import path from 'node:path';
import type {
  LibraryAsset,
  LibraryAssetMetaOverride,
  LibraryStudioKey,
  LibraryVaultStats,
} from './src/types/library.ts';
import {
  getMediaStorageProvider,
  type MediaCategory,
} from './server_cloud_persistence.ts';
import {
  mutateTenantCollection,
  readTenantCollection,
} from './server_tenant_store.ts';
import { validateBinaryMediaSignature } from './server_security.ts';
import {
  deleteTenantVisionAsset,
  readTenantVisionAssetBuffer,
  saveTenantVisionAsset,
} from './server_vision_engine.ts';
import {
  deleteTenantCinemaAssets,
  readTenantCinemaAssetBuffer,
  saveTenantCinemaAssetBuffer,
} from './server_cinema_engine.ts';
import {
  deleteTenantMusicAssets,
  readTenantMusicAssetBuffer,
  saveTenantMusicAssetBuffer,
} from './server_music_engine.ts';
import {
  buildDocumentRecord,
  deleteTenantDocAssets,
  extractUploadedDocumentWithOcrFallback,
  normalizeDocumentConfig,
  readTenantDocAssetBuffer,
  saveTenantDocAssetBuffer,
} from './server_document_engine.ts';
import {
  generateTrueDocxBuffer,
  generateTrueHtmlDocument,
  generateTruePdfBuffer,
  generateTruePptxBuffer,
  generateTrueXlsxBuffer,
} from './server_exports.ts';
import { compileFilesIntoHtmlBundle } from './server_studio_engine.ts';

// ---------------------------------------------------------------------------
// Zero-dependency Pure Node Store ZIP Packager (Valid PKZIP / CRC-32)
// ---------------------------------------------------------------------------
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function buildZipBuffer(entries: { path: string; data: Buffer | string }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const usedPaths = new Set<string>();

  for (const entry of entries) {
    let cleanPath = String(entry.path || 'file.txt')
      .replace(/^\/+/, '')
      .replace(/\.\.\//g, '')
      .replace(/\\/g, '/');
    if (usedPaths.has(cleanPath)) {
      const extIdx = cleanPath.lastIndexOf('.');
      const stem = extIdx > 0 ? cleanPath.slice(0, extIdx) : cleanPath;
      const ext = extIdx > 0 ? cleanPath.slice(extIdx) : '';
      let counter = 2;
      while (usedPaths.has(`${stem}_${counter}${ext}`)) counter++;
      cleanPath = `${stem}_${counter}${ext}`;
    }
    usedPaths.add(cleanPath);

    const nameBuf = Buffer.from(cleanPath, 'utf-8');
    const dataBuf = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(String(entry.data || ''), 'utf-8');
    const sum = crc32(dataBuf);

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 bit
    localHeader.writeUInt16LE(0, 8); // store (method 0)
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(sum, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);

    // Central directory header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(sum, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(centralHeader, 46);

    localParts.push(localHeader, dataBuf);
    centralParts.push(centralHeader);
    offset += localHeader.length + dataBuf.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

async function resolveMediaSizeBytes(
  tenantId: string,
  category: MediaCategory,
  filename?: string | null
): Promise<number> {
  if (!filename) return 0;
  try {
    const meta = await getMediaStorageProvider().getMetadata(tenantId, category, filename);
    return meta?.size ? Number(meta.size) : 0;
  } catch {
    return 0;
  }
}

function estimateBase64Bytes(dataUri?: string): number {
  if (!dataUri || typeof dataUri !== 'string') return 0;
  const commaIdx = dataUri.indexOf(',');
  if (commaIdx === -1) return 0;
  return Math.floor(((dataUri.length - commaIdx - 1) * 3) / 4);
}

function sanitizeFilename(raw: string, fallback = 'asset'): string {
  return (
    String(raw || fallback)
      .replace(/[^a-zA-Z0-9_\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 64) || fallback
  );
}

function buildDownloadUrl(studio: LibraryStudioKey, id: string, format: string): string {
  return `/api/library/download?studio=${encodeURIComponent(studio)}&id=${encodeURIComponent(id)}&format=${encodeURIComponent(format)}`;
}

// ---------------------------------------------------------------------------
// Unified Multi-Studio Asset Indexer
// ---------------------------------------------------------------------------
export async function listUnifiedLibraryAssets(
  tenantId: string
): Promise<{ items: LibraryAsset[]; stats: LibraryVaultStats }> {
  const [apps, images, videos, tracks, docs, metaMap] = await Promise.all([
    readTenantCollection<any[]>(tenantId, 'studio_apps', []),
    readTenantCollection<any[]>(tenantId, 'vision_images', []),
    readTenantCollection<any[]>(tenantId, 'motion_videos', []),
    readTenantCollection<any[]>(tenantId, 'audio_tracks', []),
    readTenantCollection<any[]>(tenantId, 'documents', []),
    readTenantCollection<Record<string, LibraryAssetMetaOverride>>(
      tenantId,
      'library_meta',
      {}
    ),
  ]);

  const items: LibraryAsset[] = [];

  // 1. Code Studio Apps
  for (const app of apps) {
    if (!app || typeof app !== 'object') continue;
    const rawId = String(app.id || '');
    if (!rawId) continue;
    const key = `code:${rawId}`;
    const meta = metaMap[key] || {};
    const filesMap: Record<string, string> =
      app.files && typeof app.files === 'object' ? { ...app.files } : {};
    if (app.code && !filesMap['index.html']) filesMap['index.html'] = String(app.code);
    const totalBytes = Object.values(filesMap).reduce(
      (sum, content) => sum + Buffer.byteLength(String(content || ''), 'utf-8'),
      0
    );

    items.push({
      id: key,
      rawId,
      studio: 'code',
      categoryLabel: 'Code & Apps',
      subCategory: String(app.category || 'Web App'),
      title: meta.customTitle || String(app.title || 'Untitled App'),
      originalTitle: String(app.title || 'Untitled App'),
      subtitle: String(app.description || app.category || 'RaOne Code Studio'),
      contentPreview: String(filesMap['index.html'] || app.code || '').slice(0, 6000),
      model: String(app.tag || 'Code Studio Engine'),
      format: 'ZIP',
      fileSizeBytes: totalBytes || 2048,
      version: Number(app.version || 1),
      rootId: rawId,
      tags: Array.isArray(meta.tags)
        ? meta.tags
        : [String(app.category || 'App'), `${Object.keys(filesMap).length} files`].filter(Boolean),
      createdAt: app.createdAt || app.updatedAt || new Date().toISOString(),
      updatedAt: app.updatedAt || app.createdAt || new Date().toISOString(),
      trashedAt: meta.trashedAt || null,
      isFavorite: Boolean(meta.isFavorite ?? app.isFavorite),
      downloads: [
        { label: 'Source Bundle (.ZIP)', format: 'zip', url: buildDownloadUrl('code', rawId, 'zip') },
        { label: 'Single HTML Bundle (.HTML)', format: 'html', url: buildDownloadUrl('code', rawId, 'html') },
      ],
      metadata: {
        fileCount: Object.keys(filesMap).length,
        filenames: Object.keys(filesMap),
      },
    });
  }

  // 2. Vision Studio Images
  const visionSizes = await Promise.all(
    images.map(async (img) => {
      if (!img || typeof img !== 'object') return 0;
      if (Number(img.fileSizeBytes || 0) > 0) return Number(img.fileSizeBytes);
      const assetFilename =
        img.assetFilename ||
        (typeof img.imageUrl === 'string' && img.imageUrl.includes('/api/vision/assets/')
          ? decodeURIComponent(img.imageUrl.split('/').pop() || '')
          : '');
      const cloudOrLocalSize = await resolveMediaSizeBytes(tenantId, 'vision', assetFilename);
      return cloudOrLocalSize || estimateBase64Bytes(img.imageUrl) || 0;
    })
  );

  images.forEach((img, idx) => {
    if (!img || typeof img !== 'object') return;
    const rawId = String(img.id || '');
    if (!rawId) return;
    const key = `vision:${rawId}`;
    const meta = metaMap[key] || {};
    const assetFilename =
      img.assetFilename ||
      (typeof img.imageUrl === 'string' && img.imageUrl.includes('/api/vision/assets/')
        ? decodeURIComponent(img.imageUrl.split('/').pop() || '')
        : '');
    const bytes = visionSizes[idx] || 0;
    const ext = assetFilename.toLowerCase().endsWith('.jpg') || assetFilename.toLowerCase().endsWith('.jpeg')
      ? 'JPG'
      : assetFilename.toLowerCase().endsWith('.webp')
      ? 'WEBP'
      : 'PNG';

    items.push({
      id: key,
      rawId,
      studio: 'vision',
      categoryLabel: 'Vision Images',
      subCategory: String(img.style || img.operationType || 'Studio Render'),
      title: meta.customTitle || String(img.prompt || 'Generated Image').slice(0, 96),
      originalTitle: String(img.prompt || 'Generated Image').slice(0, 96),
      subtitle: `${img.resolution || '2K'} · ${img.aspectRatio || '1:1'} · ${img.style || 'Photoreal'}`,
      previewUrl: img.imageUrl,
      thumbnailUrl: img.imageUrl,
      model: String(img.model || 'Nano Banana'),
      format: ext,
      fileSizeBytes: bytes,
      version: Number(img.version || 1),
      rootId: img.rootId || rawId,
      parentId: img.parentId || null,
      tags: Array.isArray(meta.tags)
        ? meta.tags
        : [img.style, img.resolution, img.aspectRatio].filter(Boolean),
      shareUrl: img.publishMeta?.shareUrl,
      createdAt: img.createdAt || new Date().toISOString(),
      updatedAt: img.createdAt || new Date().toISOString(),
      trashedAt: meta.trashedAt || null,
      isFavorite: Boolean(img.isFavorite),
      downloads: [
        { label: `Download Image (.${ext})`, format: ext.toLowerCase(), url: buildDownloadUrl('vision', rawId, ext.toLowerCase()) },
      ],
      metadata: {
        dimensions: img.dimensions,
        aspectRatio: img.aspectRatio,
        resolution: img.resolution,
        seed: img.seed,
        cameraSpec: img.cameraSpec,
      },
    });
  });

  // 3. Cinema Studio Videos
  const cinemaSizes = await Promise.all(
    videos.map(async (vid) => {
      if (!vid || typeof vid !== 'object') return 0;
      if (Number(vid.fileSizeBytes || 0) > 0) return Number(vid.fileSizeBytes);
      const assetFilename =
        vid.assetFilename ||
        (typeof vid.videoUrl === 'string' && vid.videoUrl.includes('/api/motion/assets/')
          ? decodeURIComponent(vid.videoUrl.split('/').pop() || '')
          : '');
      const resolvedSize = await resolveMediaSizeBytes(tenantId, 'cinema', assetFilename);
      return resolvedSize || estimateBase64Bytes(vid.videoUrl);
    })
  );

  videos.forEach((vid, idx) => {
    if (!vid || typeof vid !== 'object') return;
    const rawId = String(vid.id || '');
    if (!rawId) return;
    const key = `cinema:${rawId}`;
    const meta = metaMap[key] || {};
    const bytes = cinemaSizes[idx] || 0;

    const downloads = [
      { label: 'Video Clip (.MP4)', format: 'mp4', url: buildDownloadUrl('cinema', rawId, 'mp4') },
    ];
    if (vid.posterFilename || vid.posterUrl) {
      downloads.push({
        label: 'Poster Frame (.JPG)',
        format: 'poster',
        url: buildDownloadUrl('cinema', rawId, 'poster'),
      });
    }

    items.push({
      id: key,
      rawId,
      studio: 'cinema',
      categoryLabel: 'Cinema Videos',
      subCategory: String(vid.mode || vid.operationType || 'Text-to-Video'),
      title: meta.customTitle || String(vid.prompt || 'Cinema Clip').slice(0, 96),
      originalTitle: String(vid.prompt || 'Cinema Clip').slice(0, 96),
      subtitle: `${vid.duration || 5}s · ${vid.fps || 24}fps · ${vid.resolution || vid.aspectRatio || '16:9'}`,
      previewUrl: vid.videoUrl,
      thumbnailUrl: vid.posterUrl || vid.thumbnailUrl,
      model: String(vid.model || 'Veo Cinema'),
      format: 'MP4',
      fileSizeBytes: bytes,
      version: Number(vid.version || 1),
      rootId: vid.rootId || rawId,
      parentId: vid.parentId || null,
      tags: Array.isArray(meta.tags)
        ? meta.tags
        : [vid.cameraMotion, vid.aspectRatio, vid.hasAudio ? 'Audio' : 'Silent'].filter(Boolean),
      shareUrl: vid.publishMeta?.shareUrl,
      createdAt: vid.createdAt || new Date().toISOString(),
      updatedAt: vid.createdAt || new Date().toISOString(),
      trashedAt: meta.trashedAt || null,
      isFavorite: Boolean(vid.isFavorite),
      downloads,
      metadata: {
        duration: vid.duration,
        fps: vid.fps,
        aspectRatio: vid.aspectRatio,
        cameraMotion: vid.cameraMotion,
      },
    });
  });

  // 4. Music Studio Tracks & Stems
  const musicSizes = await Promise.all(
    tracks.map(async (trk) => {
      if (!trk || typeof trk !== 'object') return 0;
      if (Number(trk.fileSizeBytes || 0) > 0) return Number(trk.fileSizeBytes);
      const assetFilename =
        trk.assetFilename ||
        (typeof trk.audioUrl === 'string' && trk.audioUrl.includes('/api/audio/assets/')
          ? decodeURIComponent(trk.audioUrl.split('/').pop() || '')
          : '');
      const resolvedSize = await resolveMediaSizeBytes(tenantId, 'music', assetFilename);
      return resolvedSize || estimateBase64Bytes(trk.audioUrl);
    })
  );

  tracks.forEach((trk, idx) => {
    if (!trk || typeof trk !== 'object') return;
    const rawId = String(trk.id || '');
    if (!rawId) return;
    const key = `music:${rawId}`;
    const meta = metaMap[key] || {};
    const assetFilename =
      trk.assetFilename ||
      (typeof trk.audioUrl === 'string' && trk.audioUrl.includes('/api/audio/assets/')
        ? decodeURIComponent(trk.audioUrl.split('/').pop() || '')
        : '');
    const bytes = musicSizes[idx] || 0;
    const audioFmt = String(trk.format || (assetFilename.endsWith('.wav') ? 'WAV' : 'MP3')).toUpperCase();

    const downloads = [
      {
        label: `Master Track (.${audioFmt})`,
        format: audioFmt.toLowerCase(),
        url: buildDownloadUrl('music', rawId, audioFmt.toLowerCase()),
      },
    ];
    if (trk.stemFilenames?.vocals || trk.vocalStemUrl) {
      downloads.push({ label: 'Vocals Stem (.MP3)', format: 'stem_vocals', url: buildDownloadUrl('music', rawId, 'stem_vocals') });
    }
    if (trk.stemFilenames?.instrumental || trk.instrumentalStemUrl) {
      downloads.push({ label: 'Instrumental Stem (.MP3)', format: 'stem_instrumental', url: buildDownloadUrl('music', rawId, 'stem_instrumental') });
    }
    if (trk.stemFilenames?.drums || trk.drumsStemUrl) {
      downloads.push({ label: 'Drums Stem (.MP3)', format: 'stem_drums', url: buildDownloadUrl('music', rawId, 'stem_drums') });
    }
    if (trk.stemFilenames?.bass || trk.bassStemUrl) {
      downloads.push({ label: 'Bass Stem (.MP3)', format: 'stem_bass', url: buildDownloadUrl('music', rawId, 'stem_bass') });
    }
    if (trk.lyrics) {
      downloads.push({ label: 'Lyrics Sheet (.TXT)', format: 'lyrics', url: buildDownloadUrl('music', rawId, 'lyrics') });
    }

    items.push({
      id: key,
      rawId,
      studio: 'music',
      categoryLabel: 'Music & Audio',
      subCategory: trk.isInstrumental ? 'Instrumental' : 'Vocal Production',
      title: meta.customTitle || String(trk.title || trk.prompt || 'Audio Track'),
      originalTitle: String(trk.title || trk.prompt || 'Audio Track'),
      subtitle: `${Math.round(Number(trk.duration || 30))}s · ${trk.bpm ? `${trk.bpm} BPM · ` : ''}${(trk.styleTags || []).slice(0, 2).join(', ') || 'Music Studio'}`,
      previewUrl: trk.audioUrl,
      thumbnailUrl: trk.coverUrl,
      contentPreview: trk.lyrics || trk.prompt,
      model: String(trk.model || 'Lyria Music AI'),
      format: audioFmt,
      fileSizeBytes: bytes,
      version: Number(trk.version || 1),
      rootId: trk.rootId || rawId,
      parentId: trk.parentId || null,
      tags: Array.isArray(meta.tags)
        ? meta.tags
        : [...(Array.isArray(trk.styleTags) ? trk.styleTags.slice(0, 4) : []), trk.mood].filter(Boolean),
      shareUrl: trk.publishMeta?.shareUrl,
      createdAt: trk.createdAt || new Date().toISOString(),
      updatedAt: trk.createdAt || new Date().toISOString(),
      trashedAt: meta.trashedAt || null,
      isFavorite: Boolean(trk.isFavorite),
      downloads,
      metadata: {
        bpm: trk.bpm,
        keySignature: trk.keySignature,
        duration: trk.duration,
        stemsSeparated: trk.stemsSeparated,
      },
    });
  });

  // 5. Document Studio Deliverables
  const docAudioSizes = await Promise.all(
    docs.map((doc) =>
      doc && doc.audioOverviewFilename
        ? resolveMediaSizeBytes(tenantId, 'documents', doc.audioOverviewFilename)
        : Promise.resolve(0)
    )
  );

  docs.forEach((doc, idx) => {
    if (!doc || typeof doc !== 'object') return;
    const rawId = String(doc.id || '');
    if (!rawId) return;
    const key = `document:${rawId}`;
    const meta = metaMap[key] || {};
    const mdBytes = Buffer.byteLength(String(doc.content || ''), 'utf-8');
    const audioBytes = docAudioSizes[idx] || 0;

    const downloads = [
      { label: 'Word Document (.DOCX)', format: 'docx', url: buildDownloadUrl('document', rawId, 'docx') },
      { label: 'PDF Report (.PDF)', format: 'pdf', url: buildDownloadUrl('document', rawId, 'pdf') },
      { label: 'Slide Deck (.PPTX)', format: 'pptx', url: buildDownloadUrl('document', rawId, 'pptx') },
      { label: 'Spreadsheet (.XLSX)', format: 'xlsx', url: buildDownloadUrl('document', rawId, 'xlsx') },
      { label: 'Web Document (.HTML)', format: 'html', url: buildDownloadUrl('document', rawId, 'html') },
      { label: 'Markdown Source (.MD)', format: 'md', url: buildDownloadUrl('document', rawId, 'md') },
    ];
    if (doc.audioOverviewFilename || doc.audioOverviewUrl) {
      downloads.push({
        label: 'Podcast Overview (.MP3)',
        format: 'podcast',
        url: buildDownloadUrl('document', rawId, 'podcast'),
      });
    }

    items.push({
      id: key,
      rawId,
      studio: 'document',
      categoryLabel: 'Documents',
      subCategory: String(doc.docCategory || doc.docType || 'report').replace(/_/g, ' '),
      title: meta.customTitle || String(doc.title || 'Untitled Document'),
      originalTitle: String(doc.title || 'Untitled Document'),
      subtitle: `${doc.wordCount || 0} words · ${doc.pageCount || 1} pages · ${doc.language || 'English'}`,
      contentPreview: String(doc.content || doc.summary || ''),
      model: String(doc.model || 'Document AI'),
      format: 'DOCX / PDF',
      fileSizeBytes: mdBytes + audioBytes,
      version: Number(doc.version || 1),
      rootId: doc.rootId || rawId,
      parentId: doc.parentId || null,
      tags: Array.isArray(meta.tags)
        ? meta.tags
        : [...(Array.isArray(doc.tags) ? doc.tags : []), doc.docCategory || doc.docType].filter(Boolean),
      shareUrl: doc.publishMeta?.shareUrl,
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: doc.updatedAt || doc.createdAt || new Date().toISOString(),
      trashedAt: meta.trashedAt || null,
      isFavorite: Boolean(doc.isFavorite),
      downloads,
      metadata: {
        wordCount: doc.wordCount,
        pageCount: doc.pageCount,
        slidesCount: Array.isArray(doc.slides) ? doc.slides.length : 0,
        sourceFile: doc.sourceFile,
        hasPodcast: Boolean(doc.audioOverviewUrl),
      },
    });
  });

  // Sort default newest first
  items.sort(
    (a, b) =>
      (new Date(b.updatedAt || b.createdAt).getTime() || 0) -
      (new Date(a.updatedAt || a.createdAt).getTime() || 0)
  );

  const byStudio: Record<LibraryStudioKey, { count: number; bytes: number }> = {
    code: { count: 0, bytes: 0 },
    vision: { count: 0, bytes: 0 },
    cinema: { count: 0, bytes: 0 },
    music: { count: 0, bytes: 0 },
    document: { count: 0, bytes: 0 },
  };

  let activeAssets = 0;
  let trashedAssets = 0;
  let favoritesCount = 0;
  let totalBytes = 0;

  for (const item of items) {
    totalBytes += item.fileSizeBytes;
    if (item.trashedAt) {
      trashedAssets++;
      continue;
    }
    activeAssets++;
    if (item.isFavorite) favoritesCount++;
    byStudio[item.studio].count++;
    byStudio[item.studio].bytes += item.fileSizeBytes;
  }

  return {
    items,
    stats: {
      totalAssets: items.length,
      activeAssets,
      trashedAssets,
      favoritesCount,
      totalBytes,
      byStudio,
    },
  };
}

// ---------------------------------------------------------------------------
// Universal Download Resolver across all 5 Studios
// ---------------------------------------------------------------------------
function readDataUriBuffer(dataUri: string): { buffer: Buffer; mimeType: string } | null {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(String(dataUri || ''));
  if (!m) return null;
  return { mimeType: m[1], buffer: Buffer.from(m[2], 'base64') };
}

export async function resolveLibraryDownloadAsset(opts: {
  tenantId: string;
  studio: LibraryStudioKey;
  rawId: string;
  format?: string;
}): Promise<{ filename: string; mimeType: string; buffer: Buffer } | null> {
  const { tenantId, studio, rawId } = opts;
  const fmt = String(opts.format || '').toLowerCase();

  if (studio === 'code') {
    const apps = await readTenantCollection<any[]>(tenantId, 'studio_apps', []);
    const app = apps.find((a) => a.id === rawId);
    if (!app) return null;
    const baseName = sanitizeFilename(app.title || 'RaOne_App');
    const filesMap: Record<string, string> =
      app.files && typeof app.files === 'object' ? { ...app.files } : {};
    if (app.code && !filesMap['index.html']) filesMap['index.html'] = String(app.code);

    if (fmt === 'html') {
      const html = compileFilesIntoHtmlBundle(filesMap);
      return {
        filename: `${baseName}.html`,
        mimeType: 'text/html; charset=utf-8',
        buffer: Buffer.from(html, 'utf-8'),
      };
    }

    const zipEntries = Object.entries(filesMap).map(([fname, body]) => ({
      path: `${baseName}/${fname}`,
      data: Buffer.from(String(body || ''), 'utf-8'),
    }));
    if (zipEntries.length === 0) {
      zipEntries.push({
        path: `${baseName}/README.md`,
        data: Buffer.from(`# ${app.title || 'RaOne App'}\n`, 'utf-8'),
      });
    }
    return {
      filename: `${baseName}.zip`,
      mimeType: 'application/zip',
      buffer: buildZipBuffer(zipEntries),
    };
  }

  if (studio === 'document') {
    const docs = await readTenantCollection<any[]>(tenantId, 'documents', []);
    const doc = docs.find((d) => d.id === rawId);
    if (!doc) return null;
    const baseName = sanitizeFilename(doc.title || 'RaOne_Document');
    const branding = doc.configSnapshot?.branding || {};

    if (fmt === 'podcast' && doc.audioOverviewFilename) {
      const buf = await readTenantDocAssetBuffer(tenantId, doc.audioOverviewFilename);
      if (buf) {
        return {
          filename: `${baseName}_Podcast.mp3`,
          mimeType: 'audio/mpeg',
          buffer: buf,
        };
      }
    }

    const exportPayload = {
      title: String(doc.title || 'Executive Document'),
      content: String(doc.content || ''),
      summary: String(doc.summary || ''),
      slides: Array.isArray(doc.slides) ? doc.slides : [],
      companyName: branding.companyName,
      authorName: branding.authorName,
      footerNote: branding.footerNote,
      visualTheme: branding.visualTheme,
      pageSize: branding.pageSize,
      orientation: branding.orientation,
    };

    if (fmt === 'pptx') {
      return {
        filename: `${baseName}.pptx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        buffer: await generateTruePptxBuffer(exportPayload),
      };
    }
    if (fmt === 'xlsx') {
      return {
        filename: `${baseName}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: await generateTrueXlsxBuffer(exportPayload),
      };
    }
    if (fmt === 'pdf') {
      return {
        filename: `${baseName}.pdf`,
        mimeType: 'application/pdf',
        buffer: await generateTruePdfBuffer(exportPayload),
      };
    }
    if (fmt === 'html') {
      return {
        filename: `${baseName}.html`,
        mimeType: 'text/html; charset=utf-8',
        buffer: Buffer.from(generateTrueHtmlDocument(exportPayload), 'utf-8'),
      };
    }
    if (fmt === 'md') {
      const md = `# ${doc.title}\n\n${doc.summary ? `> ${doc.summary}\n\n` : ''}${doc.content || ''}`;
      return {
        filename: `${baseName}.md`,
        mimeType: 'text/markdown; charset=utf-8',
        buffer: Buffer.from(md, 'utf-8'),
      };
    }

    return {
      filename: `${baseName}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: await generateTrueDocxBuffer(exportPayload),
    };
  }

  if (studio === 'vision') {
    const imgs = await readTenantCollection<any[]>(tenantId, 'vision_images', []);
    const img = imgs.find((i) => i.id === rawId);
    if (!img) return null;
    const baseName = sanitizeFilename(String(img.prompt || 'Vision_Render').slice(0, 42));
    const assetFilename =
      img.assetFilename ||
      (typeof img.imageUrl === 'string' && img.imageUrl.includes('/api/vision/assets/')
        ? decodeURIComponent(img.imageUrl.split('/').pop() || '')
        : '');
    if (assetFilename) {
      const asset = await readTenantVisionAssetBuffer(tenantId, assetFilename);
      if (asset) {
        const ext = path.extname(assetFilename).replace('.', '') || 'png';
        return {
          filename: `${baseName}.${ext}`,
          mimeType: asset.mimeType || (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png'),
          buffer: asset.buffer,
        };
      }
    }
    const inline = readDataUriBuffer(img.imageUrl);
    if (inline) {
      const ext = inline.mimeType.includes('jpeg') ? 'jpg' : inline.mimeType.includes('webp') ? 'webp' : 'png';
      return { filename: `${baseName}.${ext}`, mimeType: inline.mimeType, buffer: inline.buffer };
    }
    return null;
  }

  if (studio === 'cinema') {
    const vids = await readTenantCollection<any[]>(tenantId, 'motion_videos', []);
    const vid = vids.find((v) => v.id === rawId);
    if (!vid) return null;
    const baseName = sanitizeFilename(String(vid.prompt || 'Cinema_Clip').slice(0, 42));

    if (fmt === 'poster' && vid.posterFilename) {
      const posterBuf = await readTenantCinemaAssetBuffer(tenantId, vid.posterFilename);
      if (posterBuf) {
        return { filename: `${baseName}_Poster.jpg`, mimeType: 'image/jpeg', buffer: posterBuf };
      }
    }

    const assetFilename =
      vid.assetFilename ||
      (typeof vid.videoUrl === 'string' && vid.videoUrl.includes('/api/motion/assets/')
        ? decodeURIComponent(vid.videoUrl.split('/').pop() || '')
        : '');
    if (assetFilename) {
      const vidBuf = await readTenantCinemaAssetBuffer(tenantId, assetFilename);
      if (vidBuf) {
        return { filename: `${baseName}.mp4`, mimeType: 'video/mp4', buffer: vidBuf };
      }
    }
    const inline = readDataUriBuffer(vid.videoUrl);
    if (inline) {
      return { filename: `${baseName}.mp4`, mimeType: inline.mimeType, buffer: inline.buffer };
    }
    return null;
  }

  if (studio === 'music') {
    const tracks = await readTenantCollection<any[]>(tenantId, 'audio_tracks', []);
    const trk = tracks.find((t) => t.id === rawId);
    if (!trk) return null;
    const baseName = sanitizeFilename(String(trk.title || trk.prompt || 'Music_Track').slice(0, 48));

    if (fmt === 'lyrics') {
      return {
        filename: `${baseName}_Lyrics.txt`,
        mimeType: 'text/plain; charset=utf-8',
        buffer: Buffer.from(String(trk.lyrics || trk.prompt || ''), 'utf-8'),
      };
    }

    const stemKeyMap: Record<string, string | undefined> = {
      stem_vocals: trk.stemFilenames?.vocals,
      stem_instrumental: trk.stemFilenames?.instrumental,
      stem_drums: trk.stemFilenames?.drums,
      stem_bass: trk.stemFilenames?.bass,
    };
    if (fmt.startsWith('stem_') && stemKeyMap[fmt]) {
      const stemBuf = await readTenantMusicAssetBuffer(tenantId, String(stemKeyMap[fmt]));
      if (stemBuf) {
        return {
          filename: `${baseName}_${fmt.replace('stem_', '')}.mp3`,
          mimeType: 'audio/mpeg',
          buffer: stemBuf,
        };
      }
    }

    const assetFilename =
      trk.assetFilename ||
      (typeof trk.audioUrl === 'string' && trk.audioUrl.includes('/api/audio/assets/')
        ? decodeURIComponent(trk.audioUrl.split('/').pop() || '')
        : '');
    if (assetFilename) {
      const audioBuf = await readTenantMusicAssetBuffer(tenantId, assetFilename);
      if (audioBuf) {
        const isWav = assetFilename.toLowerCase().endsWith('.wav');
        return {
          filename: `${baseName}.${isWav ? 'wav' : 'mp3'}`,
          mimeType: isWav ? 'audio/wav' : 'audio/mpeg',
          buffer: audioBuf,
        };
      }
    }
    const inline = readDataUriBuffer(trk.audioUrl);
    if (inline) {
      const isWav = inline.mimeType.includes('wav');
      return {
        filename: `${baseName}.${isWav ? 'wav' : 'mp3'}`,
        mimeType: inline.mimeType,
        buffer: inline.buffer,
      };
    }
    return null;
  }

  return null;
}

export async function buildLibraryBulkZip(
  tenantId: string,
  specs: { studio: LibraryStudioKey; rawId: string; format?: string }[]
): Promise<{ filename: string; buffer: Buffer }> {
  const folderMap: Record<LibraryStudioKey, string> = {
    code: 'Code_Apps',
    vision: 'Vision_Images',
    cinema: 'Cinema_Videos',
    music: 'Music_Audio',
    document: 'Documents',
  };

  const entries: { path: string; data: Buffer }[] = [];
  for (const spec of specs.slice(0, 40)) {
    const resolved = await resolveLibraryDownloadAsset({
      tenantId,
      studio: spec.studio,
      rawId: spec.rawId,
      format: spec.format,
    });
    if (resolved) {
      entries.push({
        path: `${folderMap[spec.studio] || 'Assets'}/${resolved.filename}`,
        data: resolved.buffer,
      });
    }
  }

  if (entries.length === 0) {
    entries.push({
      path: 'README.txt',
      data: Buffer.from('No downloadable binary or source payloads matched the selection.', 'utf-8'),
    });
  }

  return {
    filename: `RaOne_Vault_Bundle_${new Date().toISOString().slice(0, 10)}.zip`,
    buffer: buildZipBuffer(entries),
  };
}

// ---------------------------------------------------------------------------
// Asset Lifecycle Mutations: Rename/Tag, Favorite, Trash/Restore, Permanent Purge
// ---------------------------------------------------------------------------
export async function renameOrTagLibraryAsset(
  tenantId: string,
  assetKey: string,
  updates: { customTitle?: string; tags?: string[] }
) {
  const cleanTitle =
    typeof updates.customTitle === 'string' ? updates.customTitle.trim().slice(0, 120) : undefined;
  const cleanTags = Array.isArray(updates.tags)
    ? updates.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
    : undefined;

  return mutateTenantCollection<Record<string, LibraryAssetMetaOverride>>(
    tenantId,
    'library_meta',
    {},
    (meta) => {
      const prev = meta[assetKey] || {};
      return {
        ...meta,
        [assetKey]: {
          ...prev,
          ...(cleanTitle !== undefined ? { customTitle: cleanTitle } : {}),
          ...(cleanTags !== undefined ? { tags: cleanTags } : {}),
        },
      };
    }
  );
}

export async function toggleFavoriteLibraryAsset(
  tenantId: string,
  studio: LibraryStudioKey,
  rawId: string
): Promise<boolean> {
  const collectionMap: Record<Exclude<LibraryStudioKey, 'code'>, string> = {
    vision: 'vision_images',
    cinema: 'motion_videos',
    music: 'audio_tracks',
    document: 'documents',
  };

  if (studio === 'code') {
    let nextState = false;
    await mutateTenantCollection<Record<string, LibraryAssetMetaOverride>>(
      tenantId,
      'library_meta',
      {},
      (meta) => {
        const key = `code:${rawId}`;
        const prev = meta[key] || {};
        nextState = !prev.isFavorite;
        return { ...meta, [key]: { ...prev, isFavorite: nextState } };
      }
    );
    return nextState;
  }

  const col = collectionMap[studio];
  let nextFav = false;
  await mutateTenantCollection<any[]>(tenantId, col, [], (list) =>
    list.map((entry) => {
      if (entry.id === rawId) {
        nextFav = !entry.isFavorite;
        return { ...entry, isFavorite: nextFav };
      }
      return entry;
    })
  );
  return nextFav;
}

export async function setLibraryAssetsTrashed(
  tenantId: string,
  assetKeys: string[],
  trashed: boolean
) {
  const ts = trashed ? new Date().toISOString() : null;
  await mutateTenantCollection<Record<string, LibraryAssetMetaOverride>>(
    tenantId,
    'library_meta',
    {},
    (meta) => {
      const next = { ...meta };
      for (const k of assetKeys) {
        next[k] = { ...(next[k] || {}), trashedAt: ts };
      }
      return next;
    }
  );
}

export async function purgeLibraryAssets(tenantId: string, assetKeys: string[]) {
  const byStudio: Record<LibraryStudioKey, Set<string>> = {
    code: new Set(),
    vision: new Set(),
    cinema: new Set(),
    music: new Set(),
    document: new Set(),
  };

  for (const key of assetKeys) {
    const idx = key.indexOf(':');
    if (idx === -1) continue;
    const studio = key.slice(0, idx) as LibraryStudioKey;
    const rawId = key.slice(idx + 1);
    if (byStudio[studio] && rawId) byStudio[studio].add(rawId);
  }

  const visionDeletes: string[] = [];
  const cinemaDeletes: string[] = [];
  const musicDeletes: string[] = [];
  const docDeletes: string[] = [];

  if (byStudio.code.size > 0) {
    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', [], (list) =>
      list.filter((a) => !byStudio.code.has(a.id))
    );
  }

  if (byStudio.vision.size > 0) {
    await mutateTenantCollection<any[]>(tenantId, 'vision_images', [], (list) =>
      list.filter((item) => {
        if (byStudio.vision.has(item.id)) {
          if (item.assetFilename) visionDeletes.push(item.assetFilename);
          return false;
        }
        return true;
      })
    );
  }

  if (byStudio.cinema.size > 0) {
    await mutateTenantCollection<any[]>(tenantId, 'motion_videos', [], (list) =>
      list.filter((item) => {
        if (byStudio.cinema.has(item.id)) {
          if (item.assetFilename) cinemaDeletes.push(item.assetFilename);
          if (item.posterFilename) cinemaDeletes.push(item.posterFilename);
          return false;
        }
        return true;
      })
    );
  }

  if (byStudio.music.size > 0) {
    await mutateTenantCollection<any[]>(tenantId, 'audio_tracks', [], (list) =>
      list.filter((item) => {
        if (byStudio.music.has(item.id)) {
          if (item.assetFilename) musicDeletes.push(item.assetFilename);
          if (item.coverFilename) musicDeletes.push(item.coverFilename);
          if (item.stemFilenames) {
            for (const s of Object.values(item.stemFilenames)) {
              if (typeof s === 'string') musicDeletes.push(s);
            }
          }
          return false;
        }
        return true;
      })
    );
  }

  if (byStudio.document.size > 0) {
    await mutateTenantCollection<any[]>(tenantId, 'documents', [], (list) =>
      list.filter((item) => {
        if (byStudio.document.has(item.id)) {
          if (item.audioOverviewFilename) docDeletes.push(item.audioOverviewFilename);
          if (item.docAssetFilename) docDeletes.push(item.docAssetFilename);
          return false;
        }
        return true;
      })
    );
  }

  await Promise.all([
    ...visionDeletes.map((fn) => deleteTenantVisionAsset(tenantId, fn)),
    cinemaDeletes.length > 0 ? deleteTenantCinemaAssets(tenantId, cinemaDeletes) : Promise.resolve(),
    musicDeletes.length > 0 ? deleteTenantMusicAssets(tenantId, musicDeletes) : Promise.resolve(),
    docDeletes.length > 0 ? deleteTenantDocAssets(tenantId, docDeletes) : Promise.resolve(),
  ]);

  // Also strip purged keys from library_meta and library_folders
  const purgeSet = new Set(assetKeys);
  await Promise.all([
    mutateTenantCollection<Record<string, LibraryAssetMetaOverride>>(
      tenantId,
      'library_meta',
      {},
      (meta) => {
        const next = { ...meta };
        for (const k of purgeSet) delete next[k];
        return next;
      }
    ),
    mutateTenantCollection<any[]>(tenantId, 'library_folders', [], (folders) =>
      folders.map((f) => ({
        ...f,
        itemIds: Array.isArray(f.itemIds) ? f.itemIds.filter((id: string) => !purgeSet.has(id)) : [],
      }))
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Direct Upload into Files Vault -> Route to Native Studio Collection
// ---------------------------------------------------------------------------
export async function uploadExternalFileToVault(opts: {
  tenantId: string;
  filename: string;
  mimeType: string;
  base64Data: string;
  geminiClient: any;
}): Promise<{ studio: LibraryStudioKey; rawId: string }> {
  const { tenantId, filename, mimeType, base64Data, geminiClient } = opts;
  const parsed = readDataUriBuffer(base64Data);
  const rawBase64 = parsed ? parsed.buffer.toString('base64') : String(base64Data || '');
  const rawBuffer = parsed
    ? parsed.buffer
    : Buffer.from(rawBase64, 'base64');
  const lower = filename.toLowerCase();
  const cleanMime = String(mimeType || '').toLowerCase().trim();
  if (
    cleanMime.includes('svg') ||
    cleanMime.includes('html') ||
    cleanMime.includes('xml') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.svgz')
  ) {
    throw new Error('SVG, HTML, and XML payloads are blocked from binary media vault ingestion.');
  }
  if (!rawBuffer || rawBuffer.length === 0) {
    throw new Error('Uploaded file payload is empty.');
  }
  if (rawBuffer.length > 60 * 1024 * 1024) {
    throw new Error('Uploaded file exceeds maximum 60 MB vault size limit.');
  }
  const title = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Uploaded Asset';

  // 1. Image upload -> Vision Studio (verify magic bytes before saving)
  if (cleanMime.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(lower)) {
    const sigCheck = validateBinaryMediaSignature(rawBuffer, 'image');
    if (!sigCheck.ok) {
      throw new Error(sigCheck.reason);
    }
    const id = `vis_up_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const imgMime = cleanMime.startsWith('image/')
      ? cleanMime
      : lower.endsWith('.webp')
      ? 'image/webp'
      : lower.endsWith('.png')
      ? 'image/png'
      : 'image/jpeg';
    const saved = await saveTenantVisionAsset(tenantId, id, rawBase64, imgMime);
    const record = {
      id,
      prompt: title,
      model: 'Uploaded Image',
      style: 'Uploaded Vault Asset',
      aspectRatio: '1:1',
      resolution: '2K',
      imageUrl: saved.imageUrl,
      assetFilename: saved.assetFilename,
      createdAt: new Date().toISOString(),
    };
    await mutateTenantCollection<any[]>(tenantId, 'vision_images', [], (list) => [record, ...list]);
    return { studio: 'vision', rawId: id };
  }

  // 2. Video upload -> Cinema Studio (verify magic bytes)
  if (cleanMime.startsWith('video/') || /\.(mp4|webm|mov)$/.test(lower)) {
    const sigCheck = validateBinaryMediaSignature(rawBuffer, 'video');
    if (!sigCheck.ok) {
      throw new Error(sigCheck.reason);
    }
    const id = `mov_up_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const saved = await saveTenantCinemaAssetBuffer(tenantId, id, 'mp4', rawBuffer);
    const record = {
      id,
      prompt: title,
      model: 'Uploaded Video',
      mode: 'video-edit',
      duration: 5,
      fps: 24,
      aspectRatio: '16:9',
      videoUrl: saved.url,
      assetFilename: saved.filename,
      fileSizeBytes: rawBuffer.length,
      createdAt: new Date().toISOString(),
    };
    await mutateTenantCollection<any[]>(tenantId, 'motion_videos', [], (list) => [record, ...list]);
    return { studio: 'cinema', rawId: id };
  }

  // 3. Audio upload -> Music Studio (verify magic bytes)
  if (cleanMime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/.test(lower)) {
    const sigCheck = validateBinaryMediaSignature(rawBuffer, 'audio');
    if (!sigCheck.ok) {
      throw new Error(sigCheck.reason);
    }
    const id = `aud_up_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const ext = lower.endsWith('.wav') ? 'wav' : 'mp3';
    const saved = await saveTenantMusicAssetBuffer(tenantId, id, ext, rawBuffer);
    const record = {
      id,
      title,
      prompt: `Uploaded audio: ${filename}`,
      styleTags: ['Uploaded'],
      model: 'Uploaded Vault Asset',
      isInstrumental: false,
      duration: 30,
      audioUrl: saved.url,
      assetFilename: saved.filename,
      fileSizeBytes: rawBuffer.length,
      format: ext.toUpperCase(),
      createdAt: new Date().toISOString(),
    };
    await mutateTenantCollection<any[]>(tenantId, 'audio_tracks', [], (list) => [record, ...list]);
    return { studio: 'music', rawId: id };
  }

  // 2. Document / OCR Image -> Document Studio
  const extracted = await extractUploadedDocumentWithOcrFallback({
    filename,
    mimeType,
    base64Data,
    geminiClient,
  });

  if (extracted.extractedText) {
    const docId = `doc_up_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const mdAsset = await saveTenantDocAssetBuffer(
      tenantId,
      docId,
      'md',
      Buffer.from(`# ${title}\n\n${extracted.extractedText}`, 'utf-8')
    ).catch(() => null);
    const record = buildDocumentRecord({
      id: docId,
      operationType: 'upload',
      title,
      prompt: `Uploaded file: ${filename}`,
      compiledPrompt: `Vault import via ${extracted.ocrEngine}`,
      content: extracted.extractedText,
      summary: extracted.extractedText.slice(0, 240).replace(/\n+/g, ' ').trim(),
      config: normalizeDocumentConfig({ mode: 'edit' }),
      sourceFile: filename,
      ocrEngine: extracted.ocrEngine,
      tags: ['Vault Upload'],
      aiNotes: `Imported into Files Library (${extracted.ocrEngine})`,
    });
    if (mdAsset) {
      (record as any).docAssetFilename = mdAsset.filename;
      (record as any).docAssetUrl = mdAsset.url;
    }
    await mutateTenantCollection<any[]>(tenantId, 'documents', [], (list) => [record, ...list]);
    return { studio: 'document', rawId: docId };
  }

  throw new Error(`Unsupported or unreadable file payload for "${filename}".`);
}
